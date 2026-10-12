import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../types/index.js';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to one or more roles. Roles are read from the Supabase
 * JWT `app_metadata.role` claim by the JwtAuthGuard.
 *
 * @example
 * @Roles(UserRole.Admin)
 * @Get()
 * findAll() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
