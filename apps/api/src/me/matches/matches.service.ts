import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Opportunity, OpportunityStatus, Profile } from '@provost/database';
import { matchOpportunity } from '@provost/matching';
import { Repository } from 'typeorm';
import type { ListMatchesDto } from './dto/list-matches.dto.js';

type Verdict = 'eligible' | 'partial' | 'ineligible';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
  ) {}

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
      }, {
        id: opportunity.id,
        title: opportunity.title,
        eligibility: opportunity.eligibility as Record<string, unknown> | null,
      });
      const verdict: Verdict = result.score === 100 ? 'eligible' : result.score === 0 ? 'ineligible' : 'partial';
      return { opportunity, ...result, verdict };
    });
    const counts = matches.reduce<Record<Verdict, number>>((result, item) => {
      result[item.verdict] += 1;
      return result;
    }, { eligible: 0, partial: 0, ineligible: 0 });
    const filtered = filters.verdict ? matches.filter((item) => item.verdict === filters.verdict) : matches;
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;
    return { items: filtered.slice(offset, offset + limit), total: filtered.length, page, limit, counts };
  }
}
