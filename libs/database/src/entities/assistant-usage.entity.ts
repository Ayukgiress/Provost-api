import { Column, Entity, Index } from 'typeorm';

@Entity('assistant_usage')
@Index(['userId', 'date'], { unique: true })
export class AssistantUsage {
  @Column({ type: 'uuid', primary: true })
  userId: string;

  @Column({ type: 'date', primary: true })
  date: string;

  @Column({ type: 'int', default: 0 })
  messageCount: number;

  @Column({ type: 'int', default: 0 })
  inputTokens: number;

  @Column({ type: 'int', default: 0 })
  outputTokens: number;
}
