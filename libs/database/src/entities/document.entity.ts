import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

/**
 * A document uploaded by a user (transcript, essay, letter of rec, etc.).
 * Stored in object storage; this table holds the metadata and storage path.
 */
@Entity('documents')
@Index(['userId'])
export class Document extends BaseEntity {
  /** Supabase auth user id who owns the document. */
  @Column({ type: 'uuid' })
  userId: string;

  /** Human-readable label, e.g. "Undergraduate Transcript". */
  @Column({ type: 'text' })
  label: string;

  /** Path/key in object storage. */
  @Column({ type: 'text' })
  storagePath: string;

  /** MIME type, e.g. "application/pdf". */
  @Column({ type: 'text' })
  mimeType: string;

  /** File size in bytes. */
  @Column({ type: 'bigint' })
  sizeBytes: string;
}
