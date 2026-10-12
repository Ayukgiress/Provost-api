import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { SubscriptionPlan } from './enums.js';

/**
 * A user's subscription (free or plus). Tracks billing period and status.
 */
@Entity('subscriptions')
@Index(['userId'])
export class Subscription extends BaseEntity {
  /** Supabase auth user id. */
  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.Free,
  })
  plan: SubscriptionPlan;

  /** Billing period, e.g. "monthly", "yearly". */
  @Column({ type: 'text', nullable: true })
  period: string | null;

  /** Subscription status: "active", "canceled", "past_due", "trialing". */
  @Column({ type: 'text', nullable: true })
  status: string | null;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;
}
