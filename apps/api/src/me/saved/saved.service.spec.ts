import { NotFoundException } from '@nestjs/common';
import { SavedService } from './saved.service.js';

describe('SavedService ownership', () => {
  it('does not update another user’s saved item', async () => {
    const savedItems = {
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    };
    const service = new SavedService(
      {} as never,
      savedItems as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update('user-a', {
        opportunityId: 'opp-1',
        notes: 'changed',
      } as never),
    ).rejects.toThrow(NotFoundException);
    expect(savedItems.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-a', opportunityId: 'opp-1' },
    });
    expect(savedItems.save).not.toHaveBeenCalled();
  });

  it('does not delete another user’s saved item', async () => {
    const savedItems = { delete: vi.fn().mockResolvedValue({ affected: 0 }) };
    const service = new SavedService(
      {} as never,
      savedItems as never,
      {} as never,
      {} as never,
    );

    await expect(service.remove('user-a', 'opp-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(savedItems.delete).toHaveBeenCalledWith({
      userId: 'user-a',
      opportunityId: 'opp-1',
    });
  });
});
