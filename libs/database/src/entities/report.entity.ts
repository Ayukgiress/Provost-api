import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { ReportReason } from './enums.js';
import { Opportunity } from './opportunity.entity.js';

/**
 * A user report flagging an opportunity as problematic (scam, wrong info,
 * expired, etc.). Admins review reports to moderate the catalog.
 */
@Entity('reports')
@Index(['opportunityId'])
@Index(['userId'])
export class Report extends BaseEntity {
  @Column({ type: 'uuid' })
  opportunityId: string;

  @ManyToOne(() => Opportunity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opportunity_id' })
  opportunity: Opportunity;

  /** Supabase auth user id who filed the report. */
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  /** Additional comment from the reporter. */
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  /** Review status: "pending", "resolved", "dismissed". */
  @Column({ type: 'text', default: 'pending' })
  status: string;
}
