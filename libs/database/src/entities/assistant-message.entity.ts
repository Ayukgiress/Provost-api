import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

export enum AssistantMessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
  Tool = 'tool',
}

@Entity('assistant_messages')
@Index(['conversationId', 'createdAt'])
export class AssistantMessage extends BaseEntity {
  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'enum', enum: AssistantMessageRole, enumName: 'assistant_message_role' })
  role: AssistantMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  toolCalls: Record<string, unknown>[] | null;

  @Column({ type: 'jsonb', nullable: true })
  cards: Record<string, unknown>[] | null;
}
