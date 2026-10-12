import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { validateEnv } from '../../common/src/config/env.schema.js';
import { SnakeNamingStrategy } from './naming-strategy.js';
import { Profile } from './entities/profile.entity.js';
import { Funder } from './entities/funder.entity.js';
import { Opportunity } from './entities/opportunity.entity.js';
import { Source } from './entities/source.entity.js';
import { ScrapeRun } from './entities/scrape-run.entity.js';
import { Snapshot } from './entities/snapshot.entity.js';
import { ReviewItem } from './entities/review-item.entity.js';
import { SavedItem } from './entities/saved-item.entity.js';
import { Document } from './entities/document.entity.js';
import { Draft } from './entities/draft.entity.js';
import { Report } from './entities/report.entity.js';
import { Notification } from './entities/notification.entity.js';
import { Subscription } from './entities/subscription.entity.js';
import { AuditLog } from './entities/audit-log.entity.js';

/**
 * All database entities, registered both for the running app and the
 * migration CLI.
 */
export const entities = [
  Profile,
  Funder,
  Opportunity,
  Source,
  ScrapeRun,
  Snapshot,
  ReviewItem,
  SavedItem,
  Document,
  Draft,
  Report,
  Notification,
  Subscription,
  AuditLog,
];

/**
 * TypeORM DataSource used for both the running app and the migration CLI.
 *
 * Reads `DATABASE_URL` directly from process.env (validated via the Zod
 * schema) so it works outside the Nest DI context (e.g. `pnpm migration:run`).
 *
 * Migrations are loaded from `./migrations` and entities from the explicit
 * list above. `synchronize` is ALWAYS false — schema changes go through
 * migrations only.
 *
 * `SnakeNamingStrategy` converts camelCase property names to snake_case
 * column/table names, matching the data model spec.
 */
const env = validateEnv();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: env.DATABASE_URL,
  entities,
  namingStrategy: new SnakeNamingStrategy(),
  // Glob string resolved at runtime by the TypeORM CLI. The app bundle
  // overrides this to an empty array (see DatabaseModule) since the app
  // never runs migrations.
  migrations: ['libs/database/src/migrations/*-*.{js,ts}'],
  synchronize: false,
  logging: env.NODE_ENV === 'development',
  // Connection pool tuning — keep startup fast and never block on connect.
  poolSize: env.NODE_ENV === 'production' ? 10 : 5,
  extra: {
    max: env.NODE_ENV === 'production' ? 10 : 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
};

export const AppDataSource = new DataSource(dataSourceOptions);
