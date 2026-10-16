import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

export enum AssistantPendingActionStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Expired = 'expired',
}

@Entity('assistant_pending_actions')
@Index(['userId', 'status', 'expiresAt'])
export class AssistantPendingAction extends BaseEntity {
  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  action: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'enum', enum: AssistantPendingActionStatus, enumName: 'assistant_pending_action_status', default: AssistantPendingActionStatus.Pending })
  status: AssistantPendingActionStatus;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
