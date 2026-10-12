import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { TrustTier } from './enums.js';

/**
 * An organization that funds opportunities (universities, governments,
 * foundations, companies, etc.).
 */
@Entity('funders')
@Index(['name'])
export class Funder extends BaseEntity {
  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  website: string | null;

  /** Country the funder is based in. */
  @Column({ type: 'text', nullable: true })
  country: string | null;

  /** Funder type (e.g. "university", "government", "foundation"). */
  @Column({ type: 'text', nullable: true })
  type: string | null;

  /** Trust tier: A (most trusted) -> C (least). */
  @Column({ type: 'enum', enum: TrustTier, default: TrustTier.C })
  trustTier: TrustTier;
}
