import { ProfileService } from './profile.service.js';

describe('ProfileService ownership', () => {
  it('reads only the authenticated user profile', async () => {
    const profiles = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
    };
    const service = new ProfileService(profiles as never);

    await service.get('user-a');
    expect(profiles.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-a' },
    });
  });

  it('updates only the authenticated user profile', async () => {
    const profile = { userId: 'user-a', completeness: 0 };
    const profiles = {
      findOne: vi.fn().mockResolvedValue(profile),
      save: vi.fn(async (value) => value),
    };
    const service = new ProfileService(profiles as never);

    await service.update('user-a', { goals: 'My goal' } as never);
    expect(profiles.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-a' },
    });
    expect(profiles.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a', goals: 'My goal' }),
    );
  });
});
