import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source.js';
import { entities } from './data-source.js';

/**
 * Database module.
 *
 * The database connection is established in the BACKGROUND and must never
 * block app startup. The app must answer GET /health even when Postgres is
 * down. To achieve this:
 *
 *   1. A `dataSourceFactory` is provided to @nestjs/typeorm so we control the
 *      DataSource instance.
 *   2. `initialize()` is fired off without awaiting it (fire-and-forget with
 *      error logging).
 *   3. `initialize()` is wrapped so it never throws — TypeOrmModule calls it
 *      during module init; if the DB is down we swallow the error and let
 *      queries fail lazily until the DB recovers.
 *   4. `retryAttempts: 0` disables @nestjs/typeorm's internal retry loop.
 *
 * `autoLoadEntities: true` loads every entity listed in `dataSourceOptions`.
 * Migrations are run separately via the CLI (`pnpm migration:run`), never
 * by the application.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...dataSourceOptions,
        migrations: [],
        autoLoadEntities: true,
        retryAttempts: 0,
      }),
      // Custom factory so we own the DataSource and can make init non-fatal.
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('TypeORM data source options are undefined');
        }
        const dataSource = new DataSource(options);

        // Background initialization — never blocks the Nest lifecycle.
        void dataSource.initialize().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[Database] Connection failed (non-fatal): ${message}`);
        });

        // Wrap initialize() so TypeOrmModule's init never throws on a down DB.
        const originalInitialize = dataSource.initialize.bind(dataSource);
        dataSource.initialize = async () => {
          try {
            return await originalInitialize();
          } catch {
            return dataSource;
          }
        };

        return dataSource;
      },
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
