import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema.js';

/**
 * Wraps @nestjs/config with Zod validation.
 *
 * `validateEnv` runs against process.env at startup and throws on any
 * missing/invalid required variable, so the app fails fast instead of
 * starting with undefined config.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
