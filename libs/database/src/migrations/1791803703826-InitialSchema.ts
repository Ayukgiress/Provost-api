import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for the Provost database.
 *
 * Creates all application tables, enum types, foreign keys, indexes, and a
 * full-text search GIN index on opportunities (title + summary).
 *
 * Funder name is joined at query time for search; the tsvector index covers
 * the opportunity's own title and summary columns.
 */
export class InitialSchema1791803703826 implements MigrationInterface {
  name = 'InitialSchema1791803703826';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enum types ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "education_level" AS ENUM
        ('high_school', 'bachelor', 'master', 'phd', 'professional');
    `);
    await queryRunner.query(`
      CREATE TYPE "opportunity_type" AS ENUM
        ('scholarship', 'fellowship', 'grant');
    `);
    await queryRunner.query(`
      CREATE TYPE "trust_tier" AS ENUM ('A', 'B', 'C');
    `);
    await queryRunner.query(`
      CREATE TYPE "opportunity_status" AS ENUM
        ('pending', 'published', 'rejected', 'expired', 'hidden');
    `);
    await queryRunner.query(`
      CREATE TYPE "review_queue" AS ENUM
        ('needs_review', 'quick_approve', 'auto_rejected');
    `);
    await queryRunner.query(`
      CREATE TYPE "saved_item_status" AS ENUM
        ('saved', 'in_progress', 'submitted', 'decision');
    `);
    await queryRunner.query(`
      CREATE TYPE "notification_channel" AS ENUM ('email');
    `);
    await queryRunner.query(`
      CREATE TYPE "subscription_plan" AS ENUM ('free', 'plus');
    `);
    await queryRunner.query(`
      CREATE TYPE "report_reason" AS ENUM
        ('scam', 'wrong_info', 'expired', 'other');
    `);

    // ── profiles ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "citizenship" text,
        "residence_country" text,
        "birth_year" integer,
        "education_level" "education_level",
        "field_of_study" text,
        "institution" text,
        "gpa" numeric(4,2),
        "graduation_year" integer,
        "languages" jsonb,
        "test_scores" jsonb,
        "experience_years" integer,
        "goals" jsonb,
        "completeness" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_profiles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_profiles_user_id" UNIQUE ("user_id")
      );
    `);

    // ── funders ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "funders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "website" text,
        "country" text,
        "type" text,
        "trust_tier" "trust_tier" NOT NULL DEFAULT 'C',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_funders_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_funders_name" ON "funders" ("name");`,
    );

    // ── opportunities ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "opportunities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" text NOT NULL,
        "funder_id" uuid NOT NULL,
        "type" "opportunity_type" NOT NULL,
        "amount" numeric(12,2),
        "currency" text,
        "deadline" date,
        "eligibility" jsonb,
        "requirements" text,
        "documents_needed" jsonb,
        "apply_url" text,
        "source_url" text,
        "summary" text,
        "status" "opportunity_status" NOT NULL DEFAULT 'pending',
        "trust_score" integer NOT NULL DEFAULT 0,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "last_checked_at" TIMESTAMP WITH TIME ZONE,
        "slug" text NOT NULL,
        "content_hash" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_opportunities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_opportunities_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_opportunities_funder_id"
          FOREIGN KEY ("funder_id") REFERENCES "funders"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_opportunities_funder_id" ON "opportunities" ("funder_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_opportunities_status" ON "opportunities" ("status");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_opportunities_deadline" ON "opportunities" ("deadline");`,
    );

    // Full-text search index on title + summary.
    // Funder name is joined at query time for search.
    await queryRunner.query(`
      CREATE INDEX "IDX_opportunities_search" ON "opportunities"
      USING gin (to_tsvector('english',
        "title" || ' ' || COALESCE("summary", '')));
    `);

    // ── sources ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "sources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "url" text NOT NULL,
        "country" text,
        "type" text,
        "trust_tier" "trust_tier" NOT NULL DEFAULT 'C',
        "frequency_minutes" integer NOT NULL DEFAULT 60,
        "needs_browser" boolean NOT NULL DEFAULT false,
        "active" boolean NOT NULL DEFAULT true,
        "last_run_at" TIMESTAMP WITH TIME ZONE,
        "last_status" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sources_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sources_url" UNIQUE ("url")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sources_active" ON "sources" ("active");`,
    );

    // ── scrape_runs ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "scrape_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_id" uuid NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "finished_at" TIMESTAMP WITH TIME ZONE,
        "status" text NOT NULL DEFAULT 'running',
        "items_found" integer NOT NULL DEFAULT 0,
        "error" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scrape_runs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_scrape_runs_source_id"
          FOREIGN KEY ("source_id") REFERENCES "sources"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_scrape_runs_source_started" ON "scrape_runs" ("source_id", "started_at");`,
    );

    // ── snapshots ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_id" uuid NOT NULL,
        "content_hash" text,
        "text" text NOT NULL,
        "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_snapshots_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_snapshots_source_id"
          FOREIGN KEY ("source_id") REFERENCES "sources"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_snapshots_source_fetched" ON "snapshots" ("source_id", "fetched_at");`,
    );

    // ── review_items ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "review_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "opportunity_id" uuid NOT NULL,
        "queue" "review_queue" NOT NULL,
        "trust_signals" jsonb,
        "decision" text,
        "reviewer_id" uuid,
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_review_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_review_items_opportunity_id"
          FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_review_items_queue" ON "review_items" ("queue");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_review_items_opportunity_id" ON "review_items" ("opportunity_id");`,
    );

    // ── saved_items ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "saved_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "opportunity_id" uuid NOT NULL,
        "status" "saved_item_status" NOT NULL DEFAULT 'saved',
        "outcome" text,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saved_items_user_opportunity" UNIQUE ("user_id", "opportunity_id"),
        CONSTRAINT "FK_saved_items_opportunity_id"
          FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_items_user_status" ON "saved_items" ("user_id", "status");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_items_opportunity_id" ON "saved_items" ("opportunity_id");`,
    );

    // ── documents ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "label" text NOT NULL,
        "storage_path" text NOT NULL,
        "mime_type" text NOT NULL,
        "size_bytes" bigint NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_user_id" ON "documents" ("user_id");`,
    );

    // ── drafts ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "drafts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "opportunity_id" uuid NOT NULL,
        "prompt" text,
        "content" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_drafts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_drafts_opportunity_id"
          FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_drafts_user_opportunity" ON "drafts" ("user_id", "opportunity_id");`,
    );

    // ── reports ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "opportunity_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "reason" "report_reason" NOT NULL,
        "comment" text,
        "status" text NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reports_opportunity_id"
          FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_opportunity_id" ON "reports" ("opportunity_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_user_id" ON "reports" ("user_id");`,
    );

    // ── notifications ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "channel" "notification_channel" NOT NULL DEFAULT 'email',
        "type" text NOT NULL,
        "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_sent" ON "notifications" ("user_id", "sent_at");`,
    );

    // ── subscriptions ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "plan" "subscription_plan" NOT NULL DEFAULT 'free',
        "period" text,
        "status" text,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_user_id" ON "subscriptions" ("user_id");`,
    );

    // ── audit_log ─────────────────────────────────────────────────────────
    // No updated_at — audit records are immutable.
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id" uuid,
        "action" text NOT NULL,
        "target_type" text NOT NULL,
        "target_id" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_actor_id" ON "audit_log" ("actor_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_target" ON "audit_log" ("target_type", "target_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_created_at" ON "audit_log" ("created_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order.
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drafts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_items";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "review_items";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "snapshots";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scrape_runs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sources";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "opportunities";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "funders";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "profiles";`);

    // Drop enum types.
    await queryRunner.query(`DROP TYPE IF EXISTS "report_reason";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_plan";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_channel";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "saved_item_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "review_queue";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "opportunity_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "trust_tier";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "opportunity_type";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "education_level";`);
  }
}
