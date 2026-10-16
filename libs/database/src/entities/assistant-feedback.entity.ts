import { Column, Entity, Index } from 'typeorm';

@Entity('assistant_feedback')
@Index(['messageId', 'userId'], { unique: true })
export class AssistantFeedback {
  @Column({ type: 'uuid', primary: true })
  messageId: string;

  @Column({ type: 'uuid', primary: true })
  userId: string;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;
}
