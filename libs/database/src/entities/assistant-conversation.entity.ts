import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

@Entity('assistant_conversations')
@Index(['userId', 'createdAt'])
export class AssistantConversation extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;
}
