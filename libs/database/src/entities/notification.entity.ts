import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { NotificationChannel } from './enums.js';

/**
 * A notification sent to a user (deadline reminders, match alerts, etc.).
 */
@Entity('notifications')
@Index(['userId', 'sentAt'])
@Index(['opportunityId'])
@Index(['userId', 'opportunityId', 'type'], { unique: true, where: '"opportunity_id" IS NOT NULL AND "type" LIKE \'deadline_reminder_%\'' })
export class Notification extends BaseEntity {
  /** Supabase auth user id. */
  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.Email,
  })
  channel: NotificationChannel;

  /** Notification type, e.g. "deadline_reminder", "new_match". */
  @Column({ type: 'text' })
  type: string;

  /** Opportunity associated with the notification, when applicable. */
  @Column({ type: 'uuid', nullable: true })
  opportunityId: string | null;

  /** Notification details consumed by delivery clients/workers. */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  /** Delivery status: "pending", "sent", "failed". */
  @Column({ type: 'text', default: 'pending' })
  status: string;
}
