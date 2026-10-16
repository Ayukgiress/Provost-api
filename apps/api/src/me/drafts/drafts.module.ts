import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '@provost/database/entities/document.entity.js';
import { Draft } from '@provost/database/entities/draft.entity.js';
import { Opportunity } from '@provost/database/entities/opportunity.entity.js';
import { Profile } from '@provost/database/entities/profile.entity.js';
import { Subscription } from '@provost/database/entities/subscription.entity.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { DraftsController } from './drafts.controller.js';
import { DraftsService } from './drafts.service.js';
import { PlusEntitlementGuard } from './plus-entitlement.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([Document, Draft, Opportunity, Profile, Subscription]), DocumentsModule],
  controllers: [DraftsController],
  providers: [DraftsService, PlusEntitlementGuard],
})
export class DraftsModule {}