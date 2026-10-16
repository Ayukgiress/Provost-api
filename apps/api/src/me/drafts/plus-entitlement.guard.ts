import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from '@provost/database/entities/subscription.entity.js';
import { SubscriptionPlan } from '@provost/database/entities/enums.js';
import type { Request } from 'express';
import { Repository } from 'typeorm';

@Injectable()
export class PlusEntitlementGuard implements CanActivate {
  constructor(@InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const userId = request.user?.id;
    const subscription = userId ? await this.subscriptions.createQueryBuilder('subscription')
      .where('subscription.user_id = :userId', { userId })
      .andWhere('subscription.plan = :plan', { plan: SubscriptionPlan.Plus })
      .andWhere("subscription.status IN ('active', 'trialing')")
      .andWhere('(subscription.ends_at IS NULL OR subscription.ends_at > NOW())')
      .orderBy('subscription.created_at', 'DESC')
      .getOne() : null;
    if (!subscription) throw new ForbiddenException('An active Plus subscription is required to generate drafts');
    return true;
  }
}