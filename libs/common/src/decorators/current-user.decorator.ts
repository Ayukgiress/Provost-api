import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/index.js';

/**
 * Inject the authenticated principal into a route handler.
 * The principal is attached to the request by JwtAuthGuard.
 *
 * @example
 * @Get('me')
 * getMe(@CurrentUser() user: AuthenticatedUser) { return user; }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
