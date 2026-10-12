import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { TrustTier } from './enums.js';

/**
 * A scraping source — a URL that the worker periodically fetches to discover
 * new opportunities.
 */
@Entity('sources')
@Index(['url'], { unique: true })
@Index(['active'])
export class Source extends BaseEntity {
  /** URL to scrape. */
  @Column({ type: 'text' })
  url: string;

  /** Country the source is associated with. */
  @Column({ type: 'text', nullable: true })
  country: string | null;

  /** Source type (e.g. "university", "government", "aggregator"). */
  @Column({ type: 'text', nullable: true })
  type: string | null;

  /** Trust tier inherited by opportunities scraped from this source. */
  @Column({ type: 'enum', enum: TrustTier, default: TrustTier.C })
  trustTier: TrustTier;

  /** How often to scrape, in minutes. */
  @Column({ type: 'int', default: 60 })
  frequencyMinutes: number;

  /** Whether the page requires a headless browser to render JS. */
  @Column({ type: 'boolean', default: false })
  needsBrowser: boolean;

  /** Whether this source is actively being scraped. */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** Last time this source was scraped. */
  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  /** Status of the last scrape run (e.g. "success", "error"). */
  @Column({ type: 'text', nullable: true })
  lastStatus: string | null;
}
