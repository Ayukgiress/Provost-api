import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlusEntitlementGuard } from './plus-entitlement.guard.js';

describe('PlusEntitlementGuard', () => {
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1' } }) }),
  } as unknown as ExecutionContext;

  function createGuard(subscription: unknown) {
    const query = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(subscription),
    };
    const repository = { createQueryBuilder: vi.fn().mockReturnValue(query) };
    return { guard: new PlusEntitlementGuard(repository as never), query };
  }

  it('allows a qualifying Plus subscription', async () => {
    const { guard, query } = createGuard({ plan: 'plus', status: 'active' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(query.andWhere).toHaveBeenCalledWith("subscription.status IN ('active', 'trialing')");
    expect(query.andWhere).toHaveBeenCalledWith('(subscription.ends_at IS NULL OR subscription.ends_at > NOW())');
  });

  it('rejects users without an active Plus subscription', async () => {
    const { guard } = createGuard(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
