import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { WorkerModule } from './worker.module.js';
import { PinoLogger, type Env } from '@provost/common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(WorkerModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService<Env, true>);
  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  // Minimal hardening for the worker's /health endpoint.
  app.use(helmet());

  const port = config.get('WORKER_PORT', { infer: true });
  await app.listen(port);
  logger.log(`Provost worker listening on port ${port}`, 'Bootstrap');
  app.enableShutdownHooks();
}

void bootstrap();
