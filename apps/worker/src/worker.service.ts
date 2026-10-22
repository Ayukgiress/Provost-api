import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { assessOpportunityTrust, PinoLogger, type Env } from '@provost/common';
import {
  Funder, Notification, NotificationChannel, Opportunity, OpportunityStatus, OpportunityType,
  Profile, ReviewItem, ReviewQueue, SavedItem, ScrapeRun, Snapshot, Source, TrustTier,
} from '@provost/database';
import { PgBoss, type Job } from 'pg-boss';
import { Repository } from 'typeorm';
import { EmailProvider, ResendEmailProvider, UnavailableEmailProvider } from './providers/email-provider.js';
import {
  ExtractionProvider, OpenAiCompatibleExtractionProvider, UnavailableExtractionProvider,
} from './providers/extraction-provider.js';
import { fetchPage, opportunityLinks } from './scraper/fetch-page.js';

export const QUEUES = {
  scrape: 'scrape-source',
  extract: 'extract-opportunity',
  reminders: 'send-reminders',
  expire: 'expire-opportunities',
} as const;

interface SourceJob { sourceId?: string; scheduler?: boolean }
interface ExtractJob { sourceId: string; snapshotId: string; pageUrl: string }
interface NoPayload {}

const KNOWN_ORGANIZATIONS = [
  { name: 'Fulbright', domains: ['fulbrightprogram.org', 'fulbrightonline.org'] },
  { name: 'Chevening', domains: ['chevening.org'] },
  { name: 'Rhodes Trust', domains: ['rhodeshouse.ox.ac.uk'] },
  { name: 'Gates Cambridge', domains: ['gatescambridge.org'] },
  { name: 'Commonwealth Scholarship Commission', domains: ['cscuk.fcdo.gov.uk'] },
];

@Injectable()
export class WorkerService implements OnModuleInit, OnApplicationShutdown {
  private boss: PgBoss | null = null;
  private readonly extraction: ExtractionProvider;
  private readonly email: EmailProvider;
  private readonly domainAgeCache = new Map<string, number | null>();

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly logger: PinoLogger,
    @InjectRepository(Source) private readonly sources: Repository<Source>,
    @InjectRepository(ScrapeRun) private readonly scrapeRuns: Repository<ScrapeRun>,
    @InjectRepository(Snapshot) private readonly snapshots: Repository<Snapshot>,
    @InjectRepository(Funder) private readonly funders: Repository<Funder>,
    @InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>,
    @InjectRepository(ReviewItem) private readonly reviewItems: Repository<ReviewItem>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(SavedItem) private readonly savedItems: Repository<SavedItem>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {
    const extractionProvider = config.get('EXTRACTION_PROVIDER', { infer: true });
    const apiKey = config.get('EXTRACTION_API_KEY', { infer: true });
    this.extraction = extractionProvider === 'openai-compatible' && apiKey
      ? new OpenAiCompatibleExtractionProvider(
          config.get('EXTRACTION_BASE_URL', { infer: true }), apiKey,
          config.get('EXTRACTION_MODEL', { infer: true }),
        )
      : new UnavailableExtractionProvider();
    const emailProvider = config.get('EMAIL_PROVIDER', { infer: true });
    const resendKey = config.get('RESEND_API_KEY', { infer: true });
    this.email = emailProvider === 'resend' && resendKey
      ? new ResendEmailProvider(resendKey, config.get('EMAIL_FROM', { infer: true }))
      : new UnavailableEmailProvider();
  }

  async onModuleInit(): Promise<void> {
    try {
      const databaseUrl = this.config.get('DATABASE_URL', { infer: true });
      this.boss = new PgBoss({ connectionString: databaseUrl, supervise: true });
      this.boss.on('error', (error: Error) => this.logger.error(`pg-boss: ${error.message}`, error.stack, 'Worker'));
      await this.boss.start();
      await this.boss.createQueue(QUEUES.scrape, { retryLimit: 5, retryDelay: 30, retryBackoff: true, retryDelayMax: 3600 });
      await this.boss.createQueue(QUEUES.extract, { retryLimit: 4, retryDelay: 45, retryBackoff: true, retryDelayMax: 1800 });
      await this.boss.createQueue(QUEUES.reminders, { retryLimit: 5, retryDelay: 60, retryBackoff: true, retryDelayMax: 3600 });
      await this.boss.createQueue(QUEUES.expire, { retryLimit: 5, retryDelay: 60, retryBackoff: true, retryDelayMax: 3600 });
      await this.boss.work<SourceJob>(QUEUES.scrape, (jobs: Job<SourceJob>[]) => this.withJobs(jobs, async (job) => {
        if (job.data.scheduler) await this.enqueueDueSources();
        else if (job.data.sourceId) await this.scrapeSource({ sourceId: job.data.sourceId });
      }));
      await this.boss.work<ExtractJob>(QUEUES.extract, (jobs: Job<ExtractJob>[]) => this.withJobs(jobs, (job) => this.extractOpportunity(job.data)));
      await this.boss.work<NoPayload>(QUEUES.reminders, (jobs: Job<NoPayload>[]) => this.withJobs(jobs, () => this.sendReminders()));
      await this.boss.work<NoPayload>(QUEUES.expire, (jobs: Job<NoPayload>[]) => this.withJobs(jobs, () => this.expireOpportunities()));
      await this.boss.schedule(QUEUES.scrape, '* * * * *', { scheduler: true }, { singletonKey: 'scheduler' });
      await this.boss.schedule(QUEUES.reminders, '0 8 * * *', {});
      await this.boss.schedule(QUEUES.expire, '15 0 * * *', {});
      this.logger.log('Worker queues and schedules started', 'Worker');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Worker queue initialization failed; health endpoint remains available: ${message}`, undefined, 'Worker');
      if (this.boss) {
        await this.boss.stop({ graceful: false }).catch(() => undefined);
        this.boss = null;
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.boss) await this.boss.stop({ graceful: true, timeout: 10000 });
  }

  private async withJobs<T>(jobs: Job<T>[], handler: (job: Job<T>) => Promise<void>): Promise<void> {
    for (const job of jobs) await handler(job);
  }

  async enqueueDueSources(now = new Date()): Promise<number> {
    if (!this.boss) return 0;
    const active = await this.sources.find({ where: { active: true } });
    let count = 0;
    for (const source of active) {
      const dueAt = source.lastRunAt ? source.lastRunAt.getTime() + source.frequencyMinutes * 60_000 : 0;
      if (dueAt > now.getTime()) continue;
      await this.boss.send(QUEUES.scrape, { sourceId: source.id }, { singletonKey: source.id, singletonSeconds: Math.max(60, source.frequencyMinutes * 60) });
      count++;
    }
    return count;
  }

  private async scrapeSource({ sourceId }: SourceJob): Promise<void> {
    const source = await this.sources.findOne({ where: { id: sourceId, active: true } });
    if (!source) return;
    // Skip scraping sources flagged as fake by an admin.
    if (source.verificationStatus === 'fake') {
      source.active = false;
      await this.sources.save(source);
      return;
    }
    const startedAt = new Date();
    const run = await this.scrapeRuns.save(this.scrapeRuns.create({ sourceId, startedAt, status: 'running', itemsFound: 0 }));
    try {
      const fetched = await fetchPage(source.url, source.needsBrowser, this.config);
      const links = opportunityLinks(fetched.links, source.url);
      const existing = await this.snapshots.findOne({ where: { sourceId, url: source.url }, order: { fetchedAt: 'DESC' } });
      if (existing?.contentHash === fetched.hash) {
        run.status = 'skipped';
        source.lastStatus = 'unchanged';
      } else {
        for (const pageUrl of links) {
          const page = pageUrl === source.url ? fetched : await fetchPage(pageUrl, source.needsBrowser, this.config);
          const pageSnapshot = await this.snapshots.findOne({ where: { sourceId, url: pageUrl }, order: { fetchedAt: 'DESC' } });
          if (pageSnapshot?.contentHash === page.hash) continue;
          const snapshot = await this.snapshots.save(this.snapshots.create({
            sourceId, url: pageUrl, text: page.text, contentHash: page.hash, fetchedAt: new Date(),
          }));
          await this.boss?.send(QUEUES.extract, { sourceId, snapshotId: snapshot.id, pageUrl }, {
            singletonKey: `${sourceId}:${pageUrl}:${page.hash}`, singletonSeconds: 7 * 24 * 60 * 60,
          });
        }
        run.status = 'success';
        run.itemsFound = links.length;
        source.lastStatus = 'success';
      }
      source.lastRunAt = new Date();
      run.finishedAt = new Date();
      await this.scrapeRuns.save(run);
      await this.sources.save(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      run.status = 'error';
      run.error = message.slice(0, 4000);
      run.finishedAt = new Date();
      source.lastRunAt = new Date();
      const recentRuns = await this.scrapeRuns.find({ where: { sourceId }, order: { startedAt: 'DESC' }, take: 4 });
      const consecutiveFailures = recentRuns.slice(0, 3).length === 3 && recentRuns.slice(0, 3).every((item) => item.status === 'error');
      source.lastStatus = consecutiveFailures ? `alert: ${message.slice(0, 450)}` : `error: ${message.slice(0, 450)}`;
      await this.scrapeRuns.save(run);
      await this.sources.save(source);
      if (consecutiveFailures) this.logger.error(`Source ${source.url} failed three consecutive times: ${message}`, error instanceof Error ? error.stack : undefined, 'Scraper');
      throw error;
    }
  }

  private async extractOpportunity({ sourceId, snapshotId, pageUrl }: ExtractJob): Promise<void> {
    const [source, snapshot] = await Promise.all([
      this.sources.findOneByOrFail({ id: sourceId }), this.snapshots.findOneByOrFail({ id: snapshotId }),
    ]);
    const parsed = await this.extraction.extract({ sourceUrl: pageUrl, sourceDomain: new URL(source.url).hostname, text: snapshot.text });
    if (parsed.deadline) {
      const date = new Date(parsed.deadline);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.deadline) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== parsed.deadline || date.toISOString().slice(0, 10) <= new Date().toISOString().slice(0, 10)) {
        throw new Error('Extracted deadline must be a valid future YYYY-MM-DD date');
      }
    }
    if (parsed.applicationLink) {
      const applyHost = new URL(parsed.applicationLink).hostname.toLowerCase();
      const sourceHost = new URL(source.url).hostname.toLowerCase();
      const officialDomains = this.config.get('TRUSTED_OFFICIAL_DOMAINS', { infer: true });
      if (!this.isSameDomain(applyHost, sourceHost) && !officialDomains.some((domain) => this.isSameDomain(applyHost, domain))) {
        throw new Error('Application link is not on the source domain or a configured official domain');
      }
    }

    const funder = await this.findOrCreateFunder(parsed.funder, source);
    const duplicateQuery = this.opportunities.createQueryBuilder('opportunity')
      .where('opportunity.funder_id = :funderId', { funderId: funder.id })
      .andWhere('LOWER(opportunity.title) = LOWER(:title)', { title: parsed.title });
    if (parsed.deadline) duplicateQuery.andWhere('opportunity.deadline = :deadline', { deadline: parsed.deadline });
    else duplicateQuery.andWhere('opportunity.deadline IS NULL');
    const existing = await duplicateQuery.getOne();
    if (existing) return;

    const opportunityPage = pageUrl === snapshot.url ? { text: snapshot.text } : await fetchPage(pageUrl, source.needsBrowser, this.config);
    const funderWebsite = funder.website ?? null;
    const assessment = assessOpportunityTrust({
      pageText: opportunityPage.text,
      sourceUrl: pageUrl,
      funderName: parsed.funder,
      funderWebsite,
      applicationUrl: parsed.applicationLink,
      contactEmail: parsed.contactEmail,
      linkedFromFunderHomepage: new URL(source.url).pathname === '/' && new URL(source.url).hostname === new URL(pageUrl).hostname,
      domainAgeDays: await this.domainAge(new URL(pageUrl).hostname),
      knownOrganizations: KNOWN_ORGANIZATIONS,
      unusuallyLargeAward: parsed.amount != null && parsed.amount >= 100_000,
    });
    const rejected = assessment.autoRejected;
    // Auto-publish only when: source is admin-verified trusted, Tier A, score ≥ 70,
    // no fee flag, and type is known. Everything else goes to a human queue.
    const autoPublish = !rejected
      && source.verificationStatus === 'trusted'
      && source.trustTier === TrustTier.A
      && assessment.score >= 70
      && !assessment.feeNeedsReview
      && parsed.type !== null;
    const queue = rejected
      ? ReviewQueue.AutoRejected
      : source.trustTier === TrustTier.A && assessment.score >= 70 && !assessment.feeNeedsReview && parsed.type !== null
        ? ReviewQueue.QuickApprove
        : ReviewQueue.NeedsReview;
    const slugBase = `${parsed.funder}-${parsed.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'opportunity';
    const opportunity = await this.opportunities.save(this.opportunities.create({
      title: parsed.title,
      funderId: funder.id,
      type: (parsed.type as OpportunityType | null) ?? OpportunityType.Grant,
      amount: parsed.amount == null ? null : parsed.amount.toFixed(2),
      currency: parsed.currency,
      deadline: parsed.deadline ? new Date(parsed.deadline) : null,
      eligibility: { countries: parsed.eligibleCountries ?? undefined, levels: parsed.level ?? undefined, fields: parsed.field ?? undefined },
      requirements: parsed.requirements,
      documentsNeeded: parsed.documentsNeeded,
      applyUrl: parsed.applicationLink,
      contactEmail: parsed.contactEmail,
      applicantFeeRequired: parsed.applicantFeeRequired,
      sourceUrl: pageUrl,
      summary: parsed.summary,
      status: rejected ? OpportunityStatus.Rejected : autoPublish ? OpportunityStatus.Published : OpportunityStatus.Pending,
      trustScore: assessment.score,
      lastCheckedAt: new Date(),
      ...(autoPublish ? { verifiedAt: new Date() } : {}),
      slug: `${slugBase}-${snapshot.contentHash?.slice(0, 8) ?? Date.now().toString(36)}`,
      contentHash: snapshot.contentHash,
    }));
    await this.reviewItems.save(this.reviewItems.create({
      opportunityId: opportunity.id,
      queue,
      trustSignals: { score: assessment.score, signals: assessment.signals, feeNeedsReview: assessment.feeNeedsReview, sourceTrustTier: source.trustTier },
      reason: rejected ? assessment.signals.filter((signal) => signal.includes('automatic rejection')).join(' ') : null,
    }));
  }

  private isSameDomain(host: string, domain: string): boolean {
    const normalized = domain.toLowerCase().replace(/^www\./, '');
    const candidate = host.toLowerCase().replace(/^www\./, '');
    return candidate === normalized || candidate.endsWith(`.${normalized}`);
  }

  private async findOrCreateFunder(name: string, source: Source): Promise<Funder> {
    const existing = await this.funders.createQueryBuilder('funder')
      .where('LOWER(funder.name) = LOWER(:name)', { name }).getOne();
    if (existing) return existing;
    const funder = this.funders.create({ name, website: source.url, country: source.country, type: source.type, trustTier: source.trustTier });
    return this.funders.save(funder);
  }

  private async domainAge(host: string): Promise<number | null> {
    if (this.domainAgeCache.has(host)) return this.domainAgeCache.get(host) ?? null;
    try {
      const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(host)}`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) { this.domainAgeCache.set(host, null); return null; }
      const body = await response.json() as { events?: Array<{ eventAction?: string; eventDate?: string }> };
      const registration = body.events?.find((event) => event.eventAction === 'registration')?.eventDate;
      const days = registration ? Math.floor((Date.now() - Date.parse(registration)) / 86_400_000) : null;
      this.domainAgeCache.set(host, days);
      return days;
    } catch {
      this.domainAgeCache.set(host, null);
      return null;
    }
  }

  private async sendReminders(): Promise<void> {
    const today = new Date();
    const items = await this.savedItems.createQueryBuilder('saved')
      .innerJoinAndSelect('saved.opportunity', 'opportunity')
      .where('opportunity.deadline IN (:...dates)', {
        dates: [14, 7, 2].map((days) => {
          const target = new Date(today);
          target.setDate(target.getDate() + days);
          return target.toISOString().slice(0, 10);
        }),
      })
      .andWhere('saved.status IN (:...statuses)', { statuses: ['saved', 'in_progress'] })
      .getMany();
    for (const saved of items) {
      const days = Math.round((new Date(saved.opportunity.deadline!).getTime() - new Date(today.toISOString().slice(0, 10)).getTime()) / 86_400_000);
      const type = `deadline_reminder_${days}d`;
      const profile = await this.profiles.findOne({ where: { userId: saved.userId } });
      if (!profile?.deadlineRemindersEnabled || !profile.email) continue;
      const exists = await this.notifications.findOne({ where: { userId: saved.userId, opportunityId: saved.opportunityId, type } });
      if (exists?.status === 'sent') continue;
      const notification = exists ?? await this.notifications.save(this.notifications.create({
        userId: saved.userId, channel: NotificationChannel.Email, type, opportunityId: saved.opportunityId,
        metadata: { deadline: saved.opportunity.deadline, daysUntilDeadline: days }, status: 'pending', sentAt: null,
      }));
      try {
        await this.email.send({
          to: profile.email,
          subject: `${saved.opportunity.title} deadline in ${days} days`,
          text: `${saved.opportunity.title} is due in ${days} days (${new Date(saved.opportunity.deadline!).toISOString().slice(0, 10)}). Visit Provost to review your saved opportunity.`,
          idempotencyKey: notification.id,
        });
        notification.status = 'sent';
        notification.sentAt = new Date();
        await this.notifications.save(notification);
      } catch (error) {
        notification.status = 'failed';
        notification.sentAt = null;
        await this.notifications.save(notification);
        throw error;
      }
    }
  }

  private async expireOpportunities(): Promise<void> {
    await this.opportunities.createQueryBuilder()
      .update(Opportunity)
      .set({ status: OpportunityStatus.Expired })
      .where('status = :status', { status: OpportunityStatus.Published })
      .andWhere('deadline < CURRENT_DATE')
      .execute();
  }
}
