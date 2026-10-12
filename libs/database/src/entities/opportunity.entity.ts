import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { OpportunityStatus, OpportunityType } from './enums.js';
import { Funder } from './funder.entity.js';

/**
 * Shape of the `eligibility` JSONB column.
 *
 * Stored as JSON so the matching engine can compare against a user's profile
 * without forcing a rigid schema. All fields are optional.
 */
export interface OpportunityEligibility {
  countries?: string[];
  levels?: string[];
  fields?: string[];
  minGpa?: number;
  maxAge?: number;
  minExperience?: number;
  languages?: string[];
  other?: Record<string, unknown>;
}

/**
 * A scholarship, fellowship, or grant opportunity.
 *
 * Opportunities are ingested from scraped sources (and may be curated by
 * admins). The `slug` is a URL-friendly unique identifier; `content_hash`
 * lets the scraper detect unchanged pages and skip reprocessing.
 *
 * A full-text search GIN index on (title, summary) is created in the
 * migration; funder name is joined at query time.
 */
@Entity('opportunities')
@Index(['funderId'])
@Index(['status'])
@Index(['deadline'])
@Index(['slug'], { unique: true })
export class Opportunity extends BaseEntity {
  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'uuid' })
  funderId: string;

  @ManyToOne(() => Funder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'funder_id' })
  funder: Funder;

  @Column({ type: 'enum', enum: OpportunityType })
  type: OpportunityType;

  /** Award amount in `currency`. Null if unknown / not applicable. */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  amount: string | null;

  /** ISO 4217 currency code, e.g. "USD", "EUR". */
  @Column({ type: 'text', nullable: true })
  currency: string | null;

  /** Application deadline (date only). Null = rolling / no hard deadline. */
  @Column({ type: 'date', nullable: true })
  deadline: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  eligibility: OpportunityEligibility | null;

  /** Free-text requirements / what the application asks for. */
  @Column({ type: 'text', nullable: true })
  requirements: string | null;

  /** List of documents required to apply, e.g. ["transcript", "essay", "lor"]. */
  @Column({ type: 'jsonb', nullable: true })
  documentsNeeded: string[] | null;

  /** Direct URL to the application page. */
  @Column({ type: 'text', nullable: true })
  applyUrl: string | null;

  /** URL the opportunity was scraped from. */
  @Column({ type: 'text', nullable: true })
  sourceUrl: string | null;

  /** Short human-readable summary. */
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({
    type: 'enum',
    enum: OpportunityStatus,
    default: OpportunityStatus.Pending,
  })
  status: OpportunityStatus;

  /** Computed trust score 0–100. Higher = more trustworthy. */
  @Column({ type: 'int', default: 0 })
  trustScore: number;

  /** When an admin verified this opportunity. */
  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  /** Last time the source URL was checked for changes. */
  @Column({ type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  /** URL-friendly unique slug, e.g. "mit-presidential-scholarship-2025". */
  @Column({ type: 'text', unique: true })
  slug: string;

  /** Hash of the page content used for change detection. */
  @Column({ type: 'text', nullable: true })
  contentHash: string | null;
}
