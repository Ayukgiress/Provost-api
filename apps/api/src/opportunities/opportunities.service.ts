import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Opportunity, OpportunityStatus } from '@provost/database';
import { Brackets, Repository } from 'typeorm';
import type { ListOpportunitiesDto } from './dto/list-opportunities.dto.js';

@Injectable()
export class OpportunitiesService {
  constructor(@InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>) {}

  async list(filters: ListOpportunitiesDto) {
    const query = this.opportunities.createQueryBuilder('opportunity')
      .leftJoinAndSelect('opportunity.funder', 'funder')
      .where('opportunity.status = :published', { published: OpportunityStatus.Published })
      .andWhere('(opportunity.deadline IS NULL OR opportunity.deadline >= CURRENT_DATE)');

    const search = filters.search?.trim();
    if (search) {
      query.andWhere(new Brackets((qb) => qb.where('opportunity.title ILIKE :search', { search: `%${search}%` })
        .orWhere('opportunity.summary ILIKE :search', { search: `%${search}%` })
        .orWhere('funder.name ILIKE :search', { search: `%${search}%` })));
    }
    if (filters.type) query.andWhere('opportunity.type = :type', { type: filters.type });
    if (filters.country) query.andWhere("COALESCE(opportunity.eligibility->'countries', '[]'::jsonb) @> :country", { country: JSON.stringify([filters.country]) });
    if (filters.level) query.andWhere("COALESCE(opportunity.eligibility->'levels', '[]'::jsonb) @> :level", { level: JSON.stringify([filters.level]) });
    if (filters.field) query.andWhere("COALESCE(opportunity.eligibility->'fields', '[]'::jsonb) @> :field", { field: JSON.stringify([filters.field]) });
    if (filters.closing_soon) query.andWhere('opportunity.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL \'30 days\'');

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const [items, total] = await query.orderBy('opportunity.deadline', 'ASC', 'NULLS LAST')
      .addOrderBy('opportunity.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getBySlug(slug: string): Promise<Opportunity> {
    const opportunity = await this.opportunities.createQueryBuilder('opportunity')
      .leftJoinAndSelect('opportunity.funder', 'funder')
      .where('opportunity.slug = :slug', { slug })
      .andWhere('opportunity.status = :published', { published: OpportunityStatus.Published })
      .andWhere('(opportunity.deadline IS NULL OR opportunity.deadline >= CURRENT_DATE)')
      .getOne();
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    return opportunity;
  }
}
