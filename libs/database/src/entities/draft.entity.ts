import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Opportunity } from './opportunity.entity.js';

/**
 * An AI-generated or user-edited draft for an application (essay, personal
 * statement, etc.).
 */
@Entity('drafts')
@Index(['userId', 'opportunityId'])
export class Draft extends BaseEntity {
  /** Supabase auth user id. */
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  opportunityId: string;

  @ManyToOne(() => Opportunity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opportunity_id' })
  opportunity: Opportunity;

  /** The prompt that generated this draft (for AI drafts). */
  @Column({ type: 'text', nullable: true })
  prompt: string | null;

  /** The draft content. */
  @Column({ type: 'text', nullable: true })
  content: string | null;
}
