import { Inject, Injectable, LoggerService } from '@nestjs/common';
import pino, { type Logger, type DestinationStream } from 'pino';
import pretty from 'pino-pretty';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';

/**
 * Structured JSON logger backed by pino.
 *
 * Used as the app-level logger (app.useLogger) so all Nest logs are emitted
 * as JSON and enriched with the current request id when available.
 */
@Injectable()
export class PinoLogger implements LoggerService {
  private readonly logger: Logger;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {
    const level = this.config.get('LOG_LEVEL', { infer: true });
    const prettyPrint = this.config.get('LOG_PRETTY', { infer: true });

    // pino-pretty as a synchronous stream (no worker thread) so it works
    // in every environment, including serverless.
    const stream: DestinationStream | undefined = prettyPrint
      ? pretty({ colorize: true, translateTime: 'SYS:standard' })
      : undefined;

    this.logger = pino(
      {
        level,
        base: { service: 'provost-api' },
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          remove: true,
        },
      },
      stream,
    );
  }

  private childWithRequestId(requestId?: string): Logger {
    return requestId ? this.logger.child({ requestId }) : this.logger;
  }

  log(message: string, context?: string): void {
    this.info(message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    const log = this.logger.child({ context });
    if (trace) log.error({ trace }, message);
    else log.error(message);
  }

  warn(message: string, context?: string): void {
    this.logger.child({ context }).warn(message);
  }

  debug(message: string, context?: string): void {
    this.logger.child({ context }).debug(message);
  }

  verbose(message: string, context?: string): void {
    this.logger.child({ context }).trace(message);
  }

  fatal(message: string, context?: string): void {
    this.logger.child({ context }).fatal(message);
  }

  info(message: string, context?: string): void {
    this.logger.child({ context }).info(message);
  }

  /** Direct access to the underlying pino logger for structured object logs. */
  getPino(): Logger {
    return this.logger;
  }
}
