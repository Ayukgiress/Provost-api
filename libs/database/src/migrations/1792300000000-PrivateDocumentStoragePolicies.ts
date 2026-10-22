import { MigrationInterface, QueryRunner } from 'typeorm';

/** Restrict direct authenticated access to each user's private document folder. */
export class PrivateDocumentStoragePolicies1792300000000 implements MigrationInterface {
  name = 'PrivateDocumentStoragePolicies1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE POLICY "Users upload own docs"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'scholarship-docs'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    `);
    await queryRunner.query(`
      CREATE POLICY "Users read own docs"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'scholarship-docs'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    `);
    await queryRunner.query(`
      CREATE POLICY "Users delete own docs"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'scholarship-docs'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY "Users delete own docs" ON storage.objects`);
    await queryRunner.query(`DROP POLICY "Users read own docs" ON storage.objects`);
    await queryRunner.query(`DROP POLICY "Users upload own docs" ON storage.objects`);
  }
}