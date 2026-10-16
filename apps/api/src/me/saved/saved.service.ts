import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Opportunity, OpportunityStatus, SavedItem, SavedItemStatus, Subscription, SubscriptionPlan } from '@provost/database';
import { DataSource, In, Repository } from 'typeorm';
import type { CreateSavedDto } from './dto/create-saved.dto.js';
import type { UpdateSavedDto } from './dto/update-saved.dto.js';

const ACTIVE_STATUSES = [SavedItemStatus.Saved, SavedItemStatus.InProgress];

@Injectable()
export class SavedService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SavedItem) private readonly savedItems: Repository<SavedItem>,
    @InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>,
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
  ) {}

  async canSave(userId: string, opportunityId: string): Promise<boolean> {
    const existing = await this.savedItems.findOne({ where: { userId, opportunityId } });
    if (existing) return true;
    const subscription = await this.subscriptions.createQueryBuilder('subscription')
      .where('subscription.user_id = :userId', { userId })
      .andWhere('subscription.plan = :plan', { plan: SubscriptionPlan.Plus })
      .andWhere("subscription.status IN ('active', 'trialing')")
      .andWhere('(subscription.ends_at IS NULL OR subscription.ends_at > NOW())')
      .orderBy('subscription.created_at', 'DESC')
      .getOne();
    if (subscription) return true;
    const activeCount = await this.savedItems.count({ where: { userId, status: In(ACTIVE_STATUSES) } });
    return activeCount < 3;
  }

  list(userId: string) {
    return this.savedItems.find({ where: { userId }, relations: { opportunity: { funder: true } }, order: { createdAt: 'DESC' } });
  }

  async create(userId: string, dto: CreateSavedDto) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
      const savedRepo = manager.getRepository(SavedItem);
      const existing = await savedRepo.findOne({ where: { userId, opportunityId: dto.opportunityId } });
      if (existing) return existing;

      const opportunity = await manager.getRepository(Opportunity).findOne({ where: { id: dto.opportunityId, status: OpportunityStatus.Published } });
      if (!opportunity || (opportunity.deadline && new Date(opportunity.deadline) < new Date(new Date().toISOString().slice(0, 10)))) {
        throw new NotFoundException('Published, unexpired opportunity not found');
      }
      const subscription = await manager.getRepository(Subscription).createQueryBuilder('subscription')
        .where('subscription.user_id = :userId', { userId })
        .andWhere('subscription.plan = :plan', { plan: SubscriptionPlan.Plus })
        .andWhere("subscription.status IN ('active', 'trialing')")
        .andWhere('(subscription.ends_at IS NULL OR subscription.ends_at > NOW())')
        .orderBy('subscription.created_at', 'DESC')
        .getOne();
      if (!subscription) {
        const activeCount = await savedRepo.count({ where: { userId, status: In(ACTIVE_STATUSES) } });
        if (activeCount >= 3) throw new ConflictException('Free plan allows up to 3 active saved items');
      }
      return savedRepo.save(savedRepo.create({ userId, opportunityId: dto.opportunityId }));
    });
  }

  async update(userId: string, dto: UpdateSavedDto) {
    if (!dto.opportunityId) throw new NotFoundException('opportunityId is required');
    const item = await this.savedItems.findOne({ where: { userId, opportunityId: dto.opportunityId } });
    if (!item) throw new NotFoundException('Saved item not found');
    Object.assign(item, dto);
    return this.savedItems.save(item);
  }

  async remove(userId: string, opportunityId: string) {
    const result = await this.savedItems.delete({ userId, opportunityId });
    if (!result.affected) throw new NotFoundException('Saved item not found');
    return { deleted: true };
  }
}
