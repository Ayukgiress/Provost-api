import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Source } from './source.entity.js';

/**
 * A stored snapshot of a source's page content. Used for change detection
 * and re-processing without re-fetching.
 */
@Entity('snapshots')
@Index(['sourceId', 'fetchedAt'])
export class Snapshot extends BaseEntity {
  @Column({ type: 'uuid' })
  sourceId: string;

  @ManyToOne(() => Source, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source: Source;

  /** Hash of the page content (for deduplication / change detection). */
  @Column({ type: 'text', nullable: true })
  contentHash: string | null;

  /** The extracted text content of the page. */
  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'timestamptz' })
  fetchedAt: Date;
}
