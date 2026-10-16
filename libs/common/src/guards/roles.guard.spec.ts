import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../types/index.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  it('rejects an applicant from an admin-only route', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.Admin]),
    } as unknown as Reflector;
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'applicant-1', role: UserRole.Applicant },
        }),
      }),
    } as unknown as ExecutionContext;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows an admin to access an admin-only route', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.Admin]),
    } as unknown as Reflector;
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'admin-1', role: UserRole.Admin } }),
      }),
    } as unknown as ExecutionContext;

    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });
});
