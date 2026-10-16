import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpportunityStatus, OpportunityType } from '@provost/database';
import { AssistantToolsService } from './assistant-tools.service.js';

describe('AssistantToolsService', () => {
  const opportunities = {
    assistantSearch: vi.fn(),
    assistantGetById: vi.fn(),
    assistantGetPublishedByIds: vi.fn(),
  };
  const matches = {
    list: vi.fn(),
    explain: vi.fn(),
  };
  const profiles = { get: vi.fn() };
  const saved = { canSave: vi.fn(), create: vi.fn() };
  const repository = {
    findOwnedConversation: vi.fn(),
    createPendingAction: vi.fn(),
  };
  let tools: AssistantToolsService;

  const opportunity = {
    id: '4318b1d0-b190-4970-90ce-ad5e4491c9d5',
    title: 'Research award',
    slug: 'research-award',
    status: OpportunityStatus.Published,
    type: OpportunityType.Scholarship,
    amount: '1000',
    currency: 'USD',
    deadline: null,
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    summary: 'Award summary',
    requirements: 'Official requirements',
    documentsNeeded: [],
    funder: { name: 'Research Funder' },
  };
  const context = { userId: '1b36fab7-820b-4a44-b6d4-d6557a846430', conversationId: '62899d5e-47bf-48fa-8326-04f80cb8122b' };

  beforeEach(() => {
    vi.clearAllMocks();
    tools = new AssistantToolsService(opportunities as never, matches as never, profiles as never, saved as never, repository as never);
    opportunities.assistantSearch.mockResolvedValue([opportunity]);
    opportunities.assistantGetById.mockResolvedValue(opportunity);
    opportunities.assistantGetPublishedByIds.mockResolvedValue([opportunity]);
    matches.explain.mockResolvedValue({ opportunity, verdict: 'apply', fitScore: 82, reasons: ['Strong fit'], checklist: [] });
    saved.canSave.mockResolvedValue(true);
    repository.findOwnedConversation.mockResolvedValue({ id: context.conversationId, userId: context.userId });
    repository.createPendingAction.mockResolvedValue({ id: '6a3d2b55-7080-4ce4-a23c-d15777ac8f2c' });
  });

  it('rejects unknown tool names', async () => {
    await expect(tools.execute('read_admin_data', {}, context)).rejects.toMatchObject({ response: { code: 'unknown_tool' } });
  });

  it('validates arguments strictly before calling a service', async () => {
    await expect(tools.execute('get_opportunity', { id: 'not-a-uuid' }, context)).rejects.toThrow();
    await expect(tools.execute('get_my_matches', { limit: 6 }, context)).rejects.toThrow();
    await expect(tools.execute('search_opportunities', { query: '', extra: 'rejected' }, context)).rejects.toThrow();
    expect(opportunities.assistantGetById).not.toHaveBeenCalled();
    expect(matches.list).not.toHaveBeenCalled();
    expect(opportunities.assistantSearch).not.toHaveBeenCalled();
  });

  it('passes the authenticated user to matching and emits only database-verified cards', async () => {
    const output = await tools.execute('search_opportunities', { query: 'research', limit: 5 }, context);
    expect(opportunities.assistantSearch).toHaveBeenCalledWith(expect.objectContaining({ query: 'research', limit: 5 }));
    expect(matches.explain).toHaveBeenCalledWith(context.userId, opportunity.id);
    expect(output.cards).toEqual([expect.objectContaining({ id: opportunity.id, verdict: 'apply', fitScore: 82 })]);
    expect(output.result).toEqual({ opportunityIds: [opportunity.id], summaries: [{ id: opportunity.id, summary: 'Award summary' }] });
  });

  it('never returns a card if the published-opportunity recheck fails', async () => {
    opportunities.assistantGetPublishedByIds.mockResolvedValue([]);
    const output = await tools.execute('search_opportunities', { query: 'research' }, context);
    expect(output.cards).toEqual([]);
    expect(matches.explain).not.toHaveBeenCalled();
  });

  it('creates a pending save action and does not save before confirmation', async () => {
    const output = await tools.execute('save_opportunity', { opportunityId: opportunity.id }, context);
    expect(repository.findOwnedConversation).toHaveBeenCalledWith(context.conversationId, context.userId);
    expect(repository.createPendingAction).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: context.conversationId,
      userId: context.userId,
      action: 'save_opportunity',
      payload: { opportunityId: opportunity.id },
    }));
    expect(saved.create).not.toHaveBeenCalled();
    expect(output.confirmRequest).toEqual(expect.objectContaining({ action: 'save_opportunity', opportunityId: opportunity.id }));
  });

  it('does not issue a save confirmation when the Free saved-item limit is reached', async () => {
    saved.canSave.mockResolvedValue(false);
    const output = await tools.execute('save_opportunity', { opportunityId: opportunity.id }, context);
    expect(output.result).toMatchObject({ status: 'limit_reached' });
    expect(output.confirmRequest).toBeUndefined();
    expect(repository.createPendingAction).not.toHaveBeenCalled();
  });
});