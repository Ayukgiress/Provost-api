import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Opportunity, OpportunityStatus, Report } from '@provost/database';
import { DataSource, Repository } from 'typeorm';
import type { CreateReportDto } from './dto/create-report.dto.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
  ) {}

  async create(userId: string, opportunityId: string, dto: CreateReportDto) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [opportunityId]);
      const opportunityRepo = manager.getRepository(Opportunity);
      const opportunity = await opportunityRepo.findOne({ where: { id: opportunityId } });
      if (!opportunity) throw new NotFoundException('Opportunity not found');
      const reportRepo = manager.getRepository(Report);
      const previous = await reportRepo.findOne({ where: { userId, opportunityId, status: 'pending' } });
      if (previous) {
        const openReports = await reportRepo.count({ where: { opportunityId, status: 'pending' } });
        return { report: previous, openReports, hidden: opportunity.status === OpportunityStatus.Hidden };
      }
      const report = await reportRepo.save(reportRepo.create({
        userId, opportunityId, reason: dto.reason, comment: dto.comment ?? null, status: 'pending',
      }));
      const openReports = await manager.getRepository(Report).count({ where: { opportunityId, status: 'pending' } });
      if (openReports >= 3 && opportunity.status === OpportunityStatus.Published) {
        opportunity.status = OpportunityStatus.Hidden;
        await opportunityRepo.save(opportunity);
      }
      return { report, openReports, hidden: opportunity.status === OpportunityStatus.Hidden };
    });
  }
}
