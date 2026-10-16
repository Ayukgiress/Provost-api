import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantService } from './assistant.service.js';
import { FakeModelProvider } from './providers/fake-model.provider.js';
import { AssistantPendingActionStatus } from '@provost/database';

describe('AssistantService', () => {
  const repository = {
    findUsage: vi.fn(),
    isPlusUser: vi.fn(),
    findOwnedConversation: vi.fn(),
    findOwnedPendingAction: vi.fn(),
    savePendingAction: vi.fn(),
  };
  const saved = { create: vi.fn() };
  const config = {
    get: vi.fn((key: string) => key === 'ASSISTANT_LIMIT_PLUS' ? 50 : 5),
  };
  let service: AssistantService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findUsage.mockResolvedValue(null);
    repository.isPlusUser.mockResolvedValue(false);
    service = new AssistantService(repository as never, config as never, saved as never);
    repository.findOwnedConversation.mockResolvedValue({ id: '62899d5e-47bf-48fa-8326-04f80cb8122b' });
    repository.savePendingAction.mockImplementation(async (action: unknown) => action);
  });

  it('returns the free quota and next UTC midnight', async () => {
    const usage = await service.getUsage('e385b1d6-3a07-4c08-b5dd-6dd106deab83');
    const now = new Date();
    const expectedReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
    expect(usage).toEqual({ remaining: 5, limit: 5, resetsAt: expectedReset });
    expect(repository.findUsage).toHaveBeenCalledWith('e385b1d6-3a07-4c08-b5dd-6dd106deab83', now.toISOString().slice(0, 10));
  });

  it('uses the Plus quota and never returns negative remaining usage', async () => {
    repository.isPlusUser.mockResolvedValue(true);
    repository.findUsage.mockResolvedValue({ messageCount: 60 });
    const usage = await service.getUsage('e385b1d6-3a07-4c08-b5dd-6dd106deab83');
    expect(usage.remaining).toBe(0);
    expect(usage.limit).toBe(50);
  });

  it('does not allow a user to confirm another user’s action', async () => {
    repository.findOwnedPendingAction.mockResolvedValue(null);
    await expect(service.confirm(
      'e385b1d6-3a07-4c08-b5dd-6dd106deab83',
      '62899d5e-47bf-48fa-8326-04f80cb8122b',
      '6a3d2b55-7080-4ce4-a23c-d15777ac8f2c',
      true,
    )).rejects.toMatchObject({ status: 404 });
    expect(saved.create).not.toHaveBeenCalled();
  });

  it('saves an opportunity only after approval of an owned pending action', async () => {
    const action = {
      action: 'save_opportunity',
      payload: { opportunityId: '4318b1d0-b190-4970-90ce-ad5e4491c9d5' },
      status: AssistantPendingActionStatus.Pending,
      expiresAt: new Date(Date.now() + 60_000),
    };
    repository.findOwnedPendingAction.mockResolvedValue(action);
    const result = await service.confirm(
      'e385b1d6-3a07-4c08-b5dd-6dd106deab83',
      '62899d5e-47bf-48fa-8326-04f80cb8122b',
      '6a3d2b55-7080-4ce4-a23c-d15777ac8f2c',
      true,
    );
    expect(saved.create).toHaveBeenCalledWith('e385b1d6-3a07-4c08-b5dd-6dd106deab83', { opportunityId: action.payload.opportunityId });
    expect(action.status).toBe(AssistantPendingActionStatus.Approved);
    expect(result).toEqual({ ok: true, message: 'Opportunity saved' });
  });
});

describe('FakeModelProvider', () => {
  it('returns configured chunks and captures requests without network access', async () => {
    const provider = new FakeModelProvider([{ type: 'token', text: 'hello' }]);
    const request = { model: 'test-model', messages: [], tools: [] };
    const received = [];
    for await (const chunk of provider.streamChat(request)) received.push(chunk);
    expect(received).toEqual([{ type: 'token', text: 'hello' }]);
    expect(provider.requests).toEqual([request]);
  });
});