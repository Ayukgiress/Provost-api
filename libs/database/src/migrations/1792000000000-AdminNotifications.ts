import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminNotifications1792000000000 implements MigrationInterface {
  name = 'AdminNotifications1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" ADD "opportunity_id" uuid`);
    await queryRunner.query(`ALTER TABLE "notifications" ADD "metadata" jsonb`);
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "sent_at" DROP NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_opportunity_id" ON "notifications" ("opportunity_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_opportunity_id"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "metadata"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "opportunity_id"`);
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "sent_at" SET NOT NULL`);
  }
}