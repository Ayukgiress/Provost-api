import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { NotificationChannel } from './enums.js';

/**
 * A notification sent to a user (deadline reminders, match alerts, etc.).
 */
@Entity('notifications')
@Index(['userId', 'sentAt'])
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

  @Column({ type: 'timestamptz' })
  sentAt: Date;

  /** Delivery status: "pending", "sent", "failed". */
  @Column({ type: 'text', default: 'pending' })
  status: string;
}
