import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opportunity, SavedItem, Subscription } from '@provost/database';
import { SavedController } from './saved.controller.js';
import { SavedService } from './saved.service.js';

@Module({ imports: [TypeOrmModule.forFeature([Opportunity, SavedItem, Subscription])], controllers: [SavedController], providers: [SavedService], exports: [SavedService] })
export class SavedModule {}
