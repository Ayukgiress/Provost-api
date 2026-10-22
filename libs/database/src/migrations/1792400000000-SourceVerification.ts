import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceVerification1792400000000 implements MigrationInterface {
  name = 'SourceVerification1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sources"
        ADD COLUMN "verification_status" text NOT NULL DEFAULT 'unverified',
        ADD COLUMN "verified_by"         uuid             NULL,
        ADD COLUMN "verification_note"   text             NULL,
        ADD COLUMN "verified_at"         timestamptz      NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "sources"
        ADD CONSTRAINT "sources_verification_status_check"
        CHECK ("verification_status" IN ('unverified', 'trusted', 'fake'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sources" DROP CONSTRAINT "sources_verification_status_check"`);
    await queryRunner.query(`ALTER TABLE "sources" DROP COLUMN "verified_at"`);
    await queryRunner.query(`ALTER TABLE "sources" DROP COLUMN "verification_note"`);
    await queryRunner.query(`ALTER TABLE "sources" DROP COLUMN "verified_by"`);
    await queryRunner.query(`ALTER TABLE "sources" DROP COLUMN "verification_status"`);
  }
}
