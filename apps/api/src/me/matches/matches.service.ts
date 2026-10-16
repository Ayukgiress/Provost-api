import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Opportunity, OpportunityStatus, Profile } from '@provost/database';
import { matchOpportunity } from '@provost/matching';
import { Repository } from 'typeorm';
import type { ListMatchesDto } from './dto/list-matches.dto.js';

type Verdict = 'apply' | 'fix_first' | 'skip';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
  ) {}

  async explain(userId: string, opportunityId: string) {
    const profile = await this.profiles.findOne({ where: { userId } });
    const opportunity = await this.opportunities.createQueryBuilder('opportunity')
      .leftJoinAndSelect('opportunity.funder', 'funder')
      .where('opportunity.id = :opportunityId', { opportunityId })
      .andWhere('opportunity.status = :published', { published: OpportunityStatus.Published })
      .andWhere('(opportunity.deadline IS NULL OR opportunity.deadline >= CURRENT_DATE)')
      .getOne();
    if (!opportunity) return null;
    const match = matchOpportunity({
      educationLevel: profile?.educationLevel,
      fieldOfStudy: profile?.fieldOfStudy,
      citizenship: profile?.citizenship,
      countryOfResidence: profile?.residenceCountry,
      gpa: profile?.gpa === null || profile?.gpa === undefined ? null : Number(profile.gpa),
      birthYear: profile?.birthYear,
      experienceYears: profile?.experienceYears,
      languages: profile?.languages,
      goals: profile?.goals,
      testScores: profile?.testScores,
    }, {
      id: opportunity.id,
      title: opportunity.title,
      eligibility: opportunity.eligibility as Record<string, unknown> | null,
      deadline: opportunity.deadline,
      documentsNeeded: opportunity.documentsNeeded,
    });
    return { opportunity, ...match };
  }

  async list(userId: string, filters: ListMatchesDto) {
    const profile = await this.profiles.findOne({ where: { userId } });
    const candidates = await this.opportunities.createQueryBuilder('opportunity')
      .leftJoinAndSelect('opportunity.funder', 'funder')
      .where('opportunity.status = :published', { published: OpportunityStatus.Published })
      .andWhere('(opportunity.deadline IS NULL OR opportunity.deadline >= CURRENT_DATE)')
      .andWhere(filters.type ? 'opportunity.type = :type' : 'TRUE', { type: filters.type })
      .getMany();
    const matches = candidates.map((opportunity) => {
      const result = matchOpportunity({
        educationLevel: profile?.educationLevel,
        fieldOfStudy: profile?.fieldOfStudy,
        citizenship: profile?.citizenship,
        countryOfResidence: profile?.residenceCountry,
        gpa: profile?.gpa === null || profile?.gpa === undefined ? null : Number(profile.gpa),
        birthYear: profile?.birthYear,
        experienceYears: profile?.experienceYears,
        languages: profile?.languages,
        goals: profile?.goals,
        testScores: profile?.testScores,
      }, {
        id: opportunity.id,
        title: opportunity.title,
        eligibility: opportunity.eligibility as Record<string, unknown> | null,
        deadline: opportunity.deadline,
        documentsNeeded: opportunity.documentsNeeded,
      });
      return { opportunity, ...result };
    });
    const counts = matches.reduce<Record<Verdict, number>>((result, item) => {
      result[item.verdict] += 1;
      return result;
    }, { apply: 0, fix_first: 0, skip: 0 });
    const filtered = filters.verdict ? matches.filter((item) => item.verdict === filters.verdict) : matches;
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;
    return { items: filtered.slice(offset, offset + limit), total: filtered.length, page, limit, counts };
  }
}
