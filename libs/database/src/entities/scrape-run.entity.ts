import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Source } from './source.entity.js';

/**
 * A single execution of a scrape job for a source. Tracks how many items were
 * found and any error that occurred.
 */
@Entity('scrape_runs')
@Index(['sourceId', 'startedAt'])
export class ScrapeRun extends BaseEntity {
  @Column({ type: 'uuid' })
  sourceId: string;

  @ManyToOne(() => Source, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source: Source;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  /** Run status: "running", "success", "error", "skipped". */
  @Column({ type: 'text', default: 'running' })
  status: string;

  /** Number of opportunity links found on the page. */
  @Column({ type: 'int', default: 0 })
  itemsFound: number;

  /** Error message if the run failed. */
  @Column({ type: 'text', nullable: true })
  error: string | null;
}
