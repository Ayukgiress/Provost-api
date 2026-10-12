import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global exception filter.
 *
 * Catches every exception thrown during request handling and returns a
 * consistent JSON error envelope:
 *
 *   {
 *     "statusCode": 404,
 *     "message": "Opportunity not found",
 *     "error": "Not Found",
 *     "timestamp": "2024-01-01T00:00:00.000Z",
 *     "path": "/opportunities/abc"
 *   }
 *
 * HttpExceptions (and their subclasses like NotFoundException) are passed
 * through with their own status code and message. Anything else is treated
 * as a 500 with a generic message (the real error is logged server-side
 * only, never leaked to the client).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] | object = 'Internal server error';
    let errorName = 'Internal Server Error';

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        errorName = (body.error as string) ?? errorName;
      }
      errorName = exception.name.replace('Exception', '');
    } else {
      // Non-HTTP exceptions: log the full stack but return a generic body.
      const err =
        exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `${request.method} ${request.url} -> ${err.message}`,
        err.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
