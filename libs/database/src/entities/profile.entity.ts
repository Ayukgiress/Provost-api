import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { EducationLevel } from './enums.js';

/**
 * Application profile for a user. Supabase Auth owns credentials; this table
 * holds the matching-relevant profile data.
 *
 * `user_id` is the Supabase auth user id (JWT `sub` claim) and is unique.
 */
@Entity('profiles')
@Index(['userId'], { unique: true })
export class Profile extends BaseEntity {
  /** Supabase auth user id (JWT `sub` claim). */
  @Column({ type: 'uuid' })
  userId: string;

  /** Mirrored from the authenticated Supabase JWT for reminder delivery. */
  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'boolean', default: true })
  deadlineRemindersEnabled: boolean;

  /** Country of citizenship (ISO code or name). */
  @Column({ type: 'text', nullable: true })
  citizenship: string | null;

  /** Country of current residence. */
  @Column({ type: 'text', nullable: true })
  residenceCountry: string | null;

  /** Year of birth (for age-based eligibility). */
  @Column({ type: 'int', nullable: true })
  birthYear: number | null;

  @Column({ type: 'enum', enum: EducationLevel, nullable: true })
  educationLevel: EducationLevel | null;

  /** Field of study / discipline. */
  @Column({ type: 'text', nullable: true })
  fieldOfStudy: string | null;

  /** University or institution name. */
  @Column({ type: 'text', nullable: true })
  institution: string | null;

  /** GPA on a 4.0 scale, if provided. */
  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true })
  gpa: string | null;

  @Column({ type: 'int', nullable: true })
  graduationYear: number | null;

  /** Languages spoken, e.g. ["english", "french"]. */
  @Column({ type: 'jsonb', nullable: true })
  languages: string[] | null;

  /** Standardized test scores, e.g. { "gre": 320, "toefl": 105 }. */
  @Column({ type: 'jsonb', nullable: true })
  testScores: Record<string, number> | null;

  /** Years of relevant work experience. */
  @Column({ type: 'int', nullable: true })
  experienceYears: number | null;

  /** User's goals / motivations (free-form list). */
  @Column({ type: 'jsonb', nullable: true })
  goals: string[] | null;

  /** 0–100 completeness score of the profile. */
  @Column({ type: 'int', default: 0 })
  completeness: number;
}
