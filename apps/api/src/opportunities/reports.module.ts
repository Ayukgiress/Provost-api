import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opportunity, Report } from '@provost/database';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({ imports: [TypeOrmModule.forFeature([Opportunity, Report])], controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
