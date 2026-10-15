import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, Document, Draft, Notification, Profile, Report, SavedItem, Subscription } from '@provost/database';
import { SupabaseStorageService } from '../../storage/supabase-storage.service.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Document, Draft, Notification, Profile, Report, SavedItem, Subscription])],
  controllers: [AccountController], providers: [AccountService, SupabaseStorageService],
})
export class AccountModule {}
