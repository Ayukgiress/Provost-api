import { Module } from '@nestjs/common';
import { CommonModule } from '@provost/common';
import { WorkerHealthController } from './health/worker-health.controller.js';

/**
 * Worker application root module.
 *
 * The worker is a separate Nest app that runs scheduled jobs (scraping,
 * AI extraction, reminders) on pg-boss. It exposes only a /health endpoint
 * so it can be crash/restarted independently of the API.
 *
 * Job modules are wired here in later phases.
 */
@Module({
  imports: [CommonModule],
  controllers: [WorkerHealthController],
})
export class WorkerModule {}
