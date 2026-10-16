import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@provost/common';
import {
  DatabaseModule, Funder, Notification, Opportunity, Profile, ReviewItem, SavedItem, ScrapeRun, Snapshot, Source,
} from '@provost/database';
import { WorkerHealthController } from './health/worker-health.controller.js';
import { WorkerService } from './worker.service.js';

/**
 * Worker application root module.
 *
 * The worker is a separate Nest app that runs scheduled jobs (scraping,
 * AI extraction, reminders) on pg-boss. It exposes only a /health endpoint
 * so it can be crash/restarted independently of the API.
 *
 */
@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    TypeOrmModule.forFeature([Funder, Notification, Opportunity, Profile, ReviewItem, SavedItem, ScrapeRun, Snapshot, Source]),
  ],
  controllers: [WorkerHealthController],
  providers: [WorkerService],
})
export class WorkerModule {}
