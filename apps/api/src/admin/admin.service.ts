import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuditLog,
  Funder,
  Notification,
  NotificationChannel,
  Opportunity,
  OpportunityStatus,
  Report,
  ReviewItem,
  ReviewQueue,
  SavedItem,
  ScrapeRun,
  Snapshot,
  Source,
} from '@provost/database';
import { DataSource, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import type {
  AdminListDto,
  AdminReportListDto,
  CreateOpportunityDto,
  CreateSourceDto,
  OpportunityFieldsDto,
  ResolveReportDto,
  ReviewMoreInfoDto,
  ReviewQueueListDto,
  ReviewRejectDto,
  UpdateSourceDto,
  VerifySourceDto,
} from './dto/admin.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>,
    @InjectRepository(Funder) private readonly funders: Repository<Funder>,
    @InjectRepository(ReviewItem) private readonly reviewItems: Repository<ReviewItem>,
    @InjectRepository(Source) private readonly sources: Repository<Source>,
    @InjectRepository(ScrapeRun) private readonly scrapeRuns: Repository<ScrapeRun>,
    @InjectRepository(Snapshot) private readonly snapshots: Repository<Snapshot>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
  ) {}

  async dashboard() {
    const [pending, published, rejected, expiring, openReports, failingSources] =
      await Promise.all([
        this.opportunities.count({ where: { status: OpportunityStatus.Pending } }),
        this.opportunities.count({ where: { status: OpportunityStatus.Published } }),
        this.opportunities.count({ where: { status: OpportunityStatus.Rejected } }),
        this.opportunities
          .createQueryBuilder('opportunity')
          .where('opportunity.status = :published', { published: OpportunityStatus.Published })
          .andWhere('opportunity.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL \'7 days\'')
          .getCount(),
        this.reports.count({ where: { status: 'pending' } }),
        this.sources.count({ where: { active: true, lastStatus: 'error' } }),
      ]);
    return { pending, published, rejected, expiringIn7Days: expiring, openReports, failingSources };
  }

  async listReviewQueue(query: ReviewQueueListDto) {
    const qb = this.reviewItems.createQueryBuilder('review')
      .leftJoinAndSelect('review.opportunity', 'opportunity')
      .leftJoinAndSelect('opportunity.funder', 'funder')
      .where('review.decision IS NULL');
    if (query.queue) qb.andWhere('review.queue = :queue', { queue: query.queue });
    return this.paginate(qb.orderBy('review.createdAt', 'ASC'), query);
  }

  async getReviewItem(id: string) {
    const review = await this.reviewItems.findOne({
      where: { id }, relations: { opportunity: { funder: true } },
    });
    if (!review) throw new NotFoundException('Review item not found');
    const latestSnapshot = review.opportunity.sourceUrl
      ? await this.snapshots.createQueryBuilder('snapshot')
          .innerJoin(Source, 'source', 'source.id = snapshot.source_id')
          .where('source.url = :url', { url: review.opportunity.sourceUrl })
          .orderBy('snapshot.fetched_at', 'DESC').getOne()
      : null;
    return { review, extractedFields: review.opportunity, trustSignals: review.trustSignals, latestSnapshot };
  }

  async approveReview(id: string, actorId: string, publish: boolean, fields?: OpportunityFieldsDto) {
    return this.decideReview(id, actorId, publish ? 'approve_publish' : 'approve', fields, null, publish);
  }

  async publishApprovedReview(id: string, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const reviewRepo = manager.getRepository(ReviewItem);
      const review = await reviewRepo.findOne({ where: { id } });
      if (!review) throw new NotFoundException('Review item not found');
      if (review.decision !== 'approved') throw new BadRequestException('Review item must be approved before publication');
      const opportunityRepo = manager.getRepository(Opportunity);
      const opportunity = await opportunityRepo.findOne({ where: { id: review.opportunityId } });
      if (!opportunity) throw new NotFoundException('Opportunity not found');
      opportunity.status = OpportunityStatus.Published;
      opportunity.verifiedAt = new Date();
      await opportunityRepo.save(opportunity);
      await this.audit(manager, actorId, 'opportunity.publish', 'opportunity', opportunity.id, { reviewItemId: id });
      return { review, opportunity };
    });
  }

  async rejectReview(id: string, actorId: string, dto: ReviewRejectDto) {
    return this.decideReview(id, actorId, 'reject', undefined, dto.reason, false);
  }

  async requestMoreInfo(id: string, actorId: string, dto: ReviewMoreInfoDto) {
    return this.dataSource.transaction(async (manager) => {
      const reviewRepo = manager.getRepository(ReviewItem);
      const review = await reviewRepo.findOne({ where: { id } });
      if (!review) throw new NotFoundException('Review item not found');
      review.decision = null;
      review.reason = dto.reason;
      review.reviewerId = actorId;
      review.decidedAt = new Date();
      review.queue = ReviewQueue.NeedsReview;
      await reviewRepo.save(review);
      await this.audit(manager, actorId, 'review.request_more_info', 'review_item', id, { reason: dto.reason });
      return review;
    });
  }

  async createOpportunity(dto: CreateOpportunityDto, actorId: string) {
    if (!dto.title || !dto.funderId || !dto.type) throw new BadRequestException('title, funderId and type are required');
    return this.dataSource.transaction(async (manager) => {
      const funder = await manager.getRepository(Funder).findOne({ where: { id: dto.funderId } });
      if (!funder) throw new NotFoundException('Funder not found');
      const opportunity = manager.getRepository(Opportunity).create({
        ...this.opportunityFields(dto), title: dto.title, funderId: dto.funderId,
        type: dto.type, slug: dto.slug ?? this.slugify(dto.title), status: OpportunityStatus.Pending,
      });
      const saved = await manager.getRepository(Opportunity).save(opportunity);
      await this.audit(manager, actorId, 'opportunity.create', 'opportunity', saved.id);
      return saved;
    });
  }

  async editOpportunity(id: string, dto: OpportunityFieldsDto, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Opportunity);
      const opportunity = await repo.findOne({ where: { id } });
      if (!opportunity) throw new NotFoundException('Opportunity not found');
      const oldDeadline = opportunity.deadline?.toISOString().slice(0, 10) ?? null;
      Object.assign(opportunity, this.opportunityFields(dto));
      if (dto.slug) opportunity.slug = dto.slug;
      const saved = await repo.save(opportunity);
      const newDeadline = saved.deadline?.toISOString().slice(0, 10) ?? null;
      if (oldDeadline !== newDeadline) {
        await this.notifySavedUsers(manager, saved, 'deadline_changed', { oldDeadline, newDeadline });
      }
      await this.audit(manager, actorId, 'opportunity.edit', 'opportunity', id, { changedFields: Object.keys(dto) });
      return saved;
    });
  }

  async unpublishOpportunity(id: string, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Opportunity);
      const opportunity = await repo.findOne({ where: { id } });
      if (!opportunity) throw new NotFoundException('Opportunity not found');
      const previousStatus = opportunity.status;
      opportunity.status = OpportunityStatus.Hidden;
      const saved = await repo.save(opportunity);
      if (previousStatus !== OpportunityStatus.Hidden) {
        await this.notifySavedUsers(manager, saved, 'opportunity_unpublished', { previousStatus });
      }
      await this.audit(manager, actorId, 'opportunity.unpublish', 'opportunity', id, { previousStatus });
      return saved;
    });
  }

  async listSources(query: AdminListDto) {
    const qb = this.sources.createQueryBuilder('source').orderBy('source.createdAt', 'DESC');
    return this.paginate(qb, query);
  }

  async createSource(dto: CreateSourceDto, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const source = await manager.getRepository(Source).save(manager.getRepository(Source).create({
        url: dto.url,
        country: dto.country ?? null,
        type: dto.type ?? null,
        trustTier: dto.trustTier,
        frequencyMinutes: dto.frequencyMinutes,
        needsBrowser: dto.needsBrowser,
        active: true,
      }));
      await this.audit(manager, actorId, 'source.create', 'source', source.id);
      return source;
    });
  }

  async updateSource(id: string, dto: UpdateSourceDto, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Source);
      const source = await repo.findOne({ where: { id } });
      if (!source) throw new NotFoundException('Source not found');
      Object.assign(source, dto);
      const saved = await repo.save(source);
      await this.audit(manager, actorId, dto.active === false ? 'source.pause' : 'source.edit', 'source', id, { changedFields: Object.keys(dto) });
      return saved;
    });
  }

  async verifySource(id: string, dto: VerifySourceDto, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Source);
      const source = await repo.findOne({ where: { id } });
      if (!source) throw new NotFoundException('Source not found');
      source.verificationStatus = dto.status;
      source.verifiedBy = actorId;
      source.verificationNote = dto.note ?? null;
      source.verifiedAt = new Date();
      // Fake sources are automatically deactivated.
      if (dto.status === 'fake') source.active = false;
      const saved = await repo.save(source);
      await this.audit(manager, actorId, `source.verify.${dto.status}`, 'source', id, { note: dto.note ?? null });
      return saved;
    });
  }

  async runSourceNow(id: string, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const source = await manager.getRepository(Source).findOne({ where: { id } });
      if (!source) throw new NotFoundException('Source not found');
      const run = await manager.getRepository(ScrapeRun).save(manager.getRepository(ScrapeRun).create({
        sourceId: id, startedAt: new Date(), status: 'queued', itemsFound: 0,
      }));
      await this.audit(manager, actorId, 'source.run_now', 'source', id, { scrapeRunId: run.id });
      return { run, enqueued: true };
    });
  }

  async listScrapeRuns(sourceId: string, query: AdminListDto) {
    const source = await this.sources.findOne({ where: { id: sourceId } });
    if (!source) throw new NotFoundException('Source not found');
    const qb = this.scrapeRuns.createQueryBuilder('run').where('run.source_id = :sourceId', { sourceId })
      .orderBy('run.startedAt', 'DESC');
    return this.paginate(qb, query);
  }

  async listReports(query: AdminReportListDto) {
    const qb = this.reports.createQueryBuilder('report')
      .leftJoinAndSelect('report.opportunity', 'opportunity')
      .orderBy('report.createdAt', 'ASC');
    if (query.status) qb.andWhere('report.status = :status', { status: query.status });
    return this.paginate(qb, query);
  }

  async resolveReport(id: string, dto: ResolveReportDto, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const report = await manager.getRepository(Report).findOne({ where: { id } });
      if (!report) throw new NotFoundException('Report not found');
      report.status = dto.status;
      const saved = await manager.getRepository(Report).save(report);
      await this.audit(manager, actorId, `report.${dto.status}`, 'report', id, { note: dto.note ?? null, opportunityId: report.opportunityId });
      return saved;
    });
  }

  private async decideReview(
    id: string,
    actorId: string,
    action: string,
    fields: OpportunityFieldsDto | undefined,
    reason: string | null,
    publish: boolean,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const reviewRepo = manager.getRepository(ReviewItem);
      const review = await reviewRepo.findOne({ where: { id } });
      if (!review) throw new NotFoundException('Review item not found');
      const opportunityRepo = manager.getRepository(Opportunity);
      const opportunity = await opportunityRepo.findOne({ where: { id: review.opportunityId } });
      if (!opportunity) throw new NotFoundException('Opportunity not found');
      if (fields) Object.assign(opportunity, this.opportunityFields(fields));
      if (publish) {
        opportunity.status = OpportunityStatus.Published;
        opportunity.verifiedAt = new Date();
      } else if (action === 'reject') {
        opportunity.status = OpportunityStatus.Rejected;
      }
      await opportunityRepo.save(opportunity);
      review.decision = publish || action.startsWith('approve') ? 'approved' : 'rejected';
      review.reason = reason;
      review.reviewerId = actorId;
      review.decidedAt = new Date();
      await reviewRepo.save(review);
      await this.audit(manager, actorId, `review.${action}`, 'review_item', id, {
        opportunityId: opportunity.id, changedFields: fields ? Object.keys(fields) : [], reason,
      });
      return { review, opportunity };
    });
  }

  private async notifySavedUsers(
    manager: import('typeorm').EntityManager,
    opportunity: Opportunity,
    type: string,
    metadata: Record<string, unknown>,
  ) {
    const saved = await manager.getRepository(SavedItem).find({
      select: { userId: true }, where: { opportunityId: opportunity.id },
    });
    const recipients = [...new Set(saved.map((item) => item.userId))];
    if (!recipients.length) return;
    await manager.getRepository(Notification).insert(recipients.map((userId) => ({
      userId, opportunityId: opportunity.id, type, metadata: metadata as never,
      channel: NotificationChannel.Email, sentAt: null, status: 'pending',
    })));
  }

  private async audit(
    manager: import('typeorm').EntityManager,
    actorId: string,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata: Record<string, unknown> | null = null,
  ) {
    await manager.getRepository(AuditLog).insert({ actorId, action, targetType, targetId, metadata: metadata as never });
  }

  private opportunityFields(dto: OpportunityFieldsDto) {
    const { deadline, ...fields } = dto;
    return {
      ...fields,
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
    };
  }

  private slugify(title: string) {
    return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
  }

  private async paginate<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, dto: AdminListDto) {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, Math.max(1, dto.limit ?? 20));
    const [items, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
}