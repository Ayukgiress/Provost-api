import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Opportunity, OpportunityStatus } from '@provost/database';
import { Brackets, In, Repository } from 'typeorm';
import type { ListOpportunitiesDto } from './dto/list-opportunities.dto.js';

@Injectable()
export class OpportunitiesService {
  constructor(@InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>) {}

  async assistantSearch(filters: {
    query: string;
    type?: Opportunity['type'];
    country?: string;
    level?: string;
    field?: string;
    closingSoon?: boolean;
    limit: number;
  }): Promise<Opportunity[]> {
    const query = this.opportunities.createQueryBuilder('opportunity')
      .leftJoinAndSelect('opportunity.funder', 'funder')
      .where('opportunity.status = :published', { published: OpportunityStatus.Published })
      .andWhere('(opportunity.deadline IS NULL OR opportunity.deadline >= CURRENT_DATE)');
    if (filters.query.trim()) {
      query.andWhere(
        `to_tsvector('english', opportunity.title || ' ' || COALESCE(opportunity.summary, '')) @@ websearch_to_tsquery('english', :search)`,
        { search: filters.query.trim() },
      );
    }
    if (filters.type) query.andWhere('opportunity.type = :type', { type: filters.type });
    if (filters.country) query.andWhere("COALESCE(opportunity.eligibility->'countries', '[]'::jsonb) @> :country", { country: JSON.stringify([filters.country]) });
    if (filters.level) query.andWhere("COALESCE(opportunity.eligibility->'levels', '[]'::jsonb) @> :level", { level: JSON.stringify([filters.level]) });
    if (filters.field) query.andWhere("COALESCE(opportunity.eligibility->'fields', '[]'::jsonb) @> :field", { field: JSON.stringify([filters.field]) });
    if (filters.closingSoon) query.andWhere("opportunity.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'");
    return query.orderBy('opportunity.deadline', 'ASC', 'NULLS LAST')
      .addOrderBy('opportunity.createdAt', 'DESC')
      .take(Math.min(5, Math.max(1, filters.limit)))
      .getMany();
  }

  async assistantGetById(id: string): Promise<Opportunity> {
    const opportunity = await this.opportunities.createQueryBuilder('opportunity')
      .leftJoinAndSelect('opportunity.funder', 'funder')
      .where('opportunity.id = :id', { id })
      .andWhere('opportunity.status = :published', { published: OpportunityStatus.Published })
      .andWhere('(opportunity.deadline IS NULL OR opportunity.deadline >= CURRENT_DATE)')
      .getOne();
    if (!opportunity) throw new NotFoundException('Published, unexpired opportunity not found');
    return opportunity;
  }

  async assistantGetPublishedByIds(ids: string[]): Promise<Opportunity[]> {
    if (ids.length === 0) return [];
    return this.opportunities.find({
      where: {
        id: In([...new Set(ids)]),
        status: OpportunityStatus.Published,
      },
      relations: { funder: true },
      order: { deadline: 'ASC', createdAt: 'DESC' },
    }).then((items) => items.filter((item) => !item.deadline || item.deadline >= new Date(new Date().toISOString().slice(0, 10))));
  }

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
