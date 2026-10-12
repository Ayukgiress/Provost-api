import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Append-only audit log of sensitive actions (profile updates, admin
 * decisions, subscription changes, etc.).
 *
 * Intentionally has only `created_at` (no `updated_at`) — audit records are
 * immutable, so it does not extend BaseEntity.
 */
@Entity('audit_log')
@Index(['actorId'])
@Index(['targetType', 'targetId'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Supabase auth user id who performed the action (null = system). */
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  /** Action performed, e.g. "opportunity.publish", "profile.update". */
  @Column({ type: 'text' })
  action: string;

  /** Type of entity acted upon, e.g. "opportunity", "profile". */
  @Column({ type: 'text' })
  targetType: string;

  /** Id of the entity acted upon. */
  @Column({ type: 'text', nullable: true })
  targetId: string | null;

  /** Additional structured context for the action. */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
