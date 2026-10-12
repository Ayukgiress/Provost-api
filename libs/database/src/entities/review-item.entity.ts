import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { ReviewQueue } from './enums.js';
import { Opportunity } from './opportunity.entity.js';

/**
 * An opportunity queued for human review (or auto-decision).
 *
 * Scraped opportunities go through a review pipeline before being published.
 * `trust_signals` captures heuristic signals (domain age, HTTPS, etc.) that
 * inform the review decision.
 */
@Entity('review_items')
@Index(['queue'])
@Index(['opportunityId'])
export class ReviewItem extends BaseEntity {
  @Column({ type: 'uuid' })
  opportunityId: string;

  @ManyToOne(() => Opportunity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opportunity_id' })
  opportunity: Opportunity;

  @Column({ type: 'enum', enum: ReviewQueue })
  queue: ReviewQueue;

  /** Heuristic trust signals, e.g. { "domainAgeDays": 1200, "hasHttps": true }. */
  @Column({ type: 'jsonb', nullable: true })
  trustSignals: Record<string, unknown> | null;

  /** Final decision: "approved", "rejected", null if pending. */
  @Column({ type: 'text', nullable: true })
  decision: string | null;

  /** Supabase user id of the reviewer who decided. */
  @Column({ type: 'uuid', nullable: true })
  reviewerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  /** Human-readable reason for the decision. */
  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
