import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  Funder,
  Notification,
  Opportunity,
  Report,
  ReviewItem,
  SavedItem,
  ScrapeRun,
  Snapshot,
  Source,
} from '@provost/database';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([
    AuditLog, Funder, Notification, Opportunity, Report, ReviewItem,
    SavedItem, ScrapeRun, Snapshot, Source,
  ])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}