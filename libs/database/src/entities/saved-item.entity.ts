import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { SavedItemStatus } from './enums.js';
import { Opportunity } from './opportunity.entity.js';

/**
 * An opportunity saved by a user for tracking. Users can mark progress
 * (saved -> in_progress -> submitted -> decision) and add notes.
 */
@Entity('saved_items')
@Unique(['userId', 'opportunityId'])
@Index(['userId', 'status'])
@Index(['opportunityId'])
export class SavedItem extends BaseEntity {
  /** Supabase auth user id. */
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  opportunityId: string;

  @ManyToOne(() => Opportunity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opportunity_id' })
  opportunity: Opportunity;

  @Column({
    type: 'enum',
    enum: SavedItemStatus,
    default: SavedItemStatus.Saved,
  })
  status: SavedItemStatus;

  /** Outcome after decision: "accepted", "rejected", "waitlisted", etc. */
  @Column({ type: 'text', nullable: true })
  outcome: string | null;

  /** User notes / tracking comments. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
