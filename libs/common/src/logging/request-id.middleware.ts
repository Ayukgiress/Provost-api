import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { PinoLogger } from './pino-logger.service.js';

const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Ensures every request has a unique request id, propagated via the
 * `X-Request-Id` header. If the client supplies one it is reused (so ids
 * can be traced across services); otherwise a new UUID v4 is generated.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER);
    const requestId =
      incoming &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        incoming,
      )
        ? incoming
        : randomUUID();
    (req as Request & { id: string }).id = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = Date.now();
    res.once('finish', () => {
      const route = req.route?.path;
      this.logger.getPino().info(
        {
          requestId,
          method: req.method,
          route:
            typeof route === 'string' ? `${req.baseUrl}${route}` : 'unmatched',
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
        },
        'HTTP request completed',
      );
    });

    next();
  }
}
