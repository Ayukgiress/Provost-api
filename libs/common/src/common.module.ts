import { Global, Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PinoLogger } from './logging/pino-logger.service.js';
import { RequestIdMiddleware } from './logging/request-id.middleware.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Global shared module: configuration (Zod-validated), structured logging,
 * request-id propagation, and the JWT + Roles guards.
 *
 * JwtAuthGuard and RolesGuard are registered as APP_GUARD so every route
 * requires authentication by default. Public routes opt out with the
 * `@Public()` decorator (added in apps/api).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    PinoLogger,
    RequestIdMiddleware,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [PinoLogger, RequestIdMiddleware, ConfigModule],
})
export class CommonModule {}
