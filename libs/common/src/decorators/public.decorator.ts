import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route (or controller) as public — it will bypass the global
 * JwtAuthGuard. Use sparingly (e.g. /health, webhooks).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
