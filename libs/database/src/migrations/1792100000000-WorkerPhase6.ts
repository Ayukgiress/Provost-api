import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkerPhase61792100000000 implements MigrationInterface {
  name = 'WorkerPhase61792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "snapshots" ADD "url" text`);
    await queryRunner.query(`UPDATE "snapshots" snapshot SET "url" = source."url" FROM "sources" source WHERE snapshot."source_id" = source."id"`);
    await queryRunner.query(`ALTER TABLE "snapshots" ALTER COLUMN "url" SET NOT NULL`);
    await queryRunner.query(`DROP INDEX "IDX_snapshots_source_fetched"`);
    await queryRunner.query(`CREATE INDEX "IDX_snapshots_source_url_fetched" ON "snapshots" ("source_id", "url", "fetched_at")`);
    await queryRunner.query(`ALTER TABLE "opportunities" ADD "contact_email" text`);
    await queryRunner.query(`ALTER TABLE "opportunities" ADD "applicant_fee_required" boolean`);
    await queryRunner.query(`ALTER TABLE "profiles" ADD "email" text`);
    await queryRunner.query(`ALTER TABLE "profiles" ADD "deadline_reminders_enabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_notifications_deadline_reminder_once" ON "notifications" ("user_id", "opportunity_id", "type") WHERE "opportunity_id" IS NOT NULL AND "type" LIKE 'deadline_reminder_%'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_deadline_reminder_once"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "deadline_reminders_enabled"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "email"`);
    await queryRunner.query(`ALTER TABLE "opportunities" DROP COLUMN "applicant_fee_required"`);
    await queryRunner.query(`ALTER TABLE "opportunities" DROP COLUMN "contact_email"`);
    await queryRunner.query(`DROP INDEX "IDX_snapshots_source_url_fetched"`);
    await queryRunner.query(`CREATE INDEX "IDX_snapshots_source_fetched" ON "snapshots" ("source_id", "fetched_at")`);
    await queryRunner.query(`ALTER TABLE "snapshots" DROP COLUMN "url"`);
  }
}