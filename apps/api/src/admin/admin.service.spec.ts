import { beforeAll, describe, expect, it } from 'vitest';
import { Opportunity } from '../../../../libs/database/src/entities/opportunity.entity.js';
import { OpportunityStatus } from '../../../../libs/database/src/entities/enums.js';
import { ReviewItem } from '../../../../libs/database/src/entities/review-item.entity.js';
import type { DataSource, EntityManager, Repository } from 'typeorm';

let AdminService: typeof import('./admin.service.js').AdminService;

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  ({ AdminService } = await import('./admin.service.js'));
});

function serviceWithReview() {
  const review = {
    id: 'review-id',
    opportunityId: 'opportunity-id',
    decision: null,
    reason: null,
    reviewerId: null,
    decidedAt: null,
  } as ReviewItem;
  const opportunity = {
    id: 'opportunity-id',
    title: 'Original title',
    status: OpportunityStatus.Pending,
    verifiedAt: null,
  } as Opportunity;
  const auditRepo = { insert: async () => undefined };
  const repos = new Map<unknown, { findOne?: () => Promise<unknown>; save?: (value: unknown) => Promise<unknown>; insert?: () => Promise<void> }>([
    [ReviewItem, { findOne: async () => review, save: async (value) => value }],
    [
      Opportunity,
      { findOne: async () => opportunity, save: async (value) => value },
    ],
    [Object, auditRepo],
  ]);
  const manager = {
    getRepository: (entity: unknown) => repos.get(entity) ?? auditRepo,
  } as unknown as EntityManager;
  const dataSource = {
    transaction: async (
      callback: (transactionManager: EntityManager) => Promise<unknown>,
    ) => callback(manager),
  } as unknown as DataSource;
  const repo = {} as Repository<Opportunity>;
  return {
    service: new AdminService(
      dataSource,
      repo,
      {} as Repository<never>,
      {} as Repository<ReviewItem>,
      {} as Repository<never>,
      {} as Repository<never>,
      {} as Repository<never>,
      {} as Repository<never>,
    ),
    review,
    opportunity,
  };
}

describe('AdminService review publication controls', () => {
  it('lets reviewer approval edit fields without publishing', async () => {
    const { service, review, opportunity } = serviceWithReview();

    await service.approveReview('review-id', 'reviewer-id', false, {
      title: 'Reviewed title',
    });

    expect(review.decision).toBe('approved');
    expect(opportunity.title).toBe('Reviewed title');
    expect(opportunity.status).toBe(OpportunityStatus.Pending);
    expect(opportunity.verifiedAt).toBeNull();
  });

  it('publishes only through the admin approval path', async () => {
    const { service, review, opportunity } = serviceWithReview();

    await service.approveReview('review-id', 'admin-id', true);

    expect(review.decision).toBe('approved');
    expect(opportunity.status).toBe(OpportunityStatus.Published);
    expect(opportunity.verifiedAt).toBeInstanceOf(Date);
  });
});
