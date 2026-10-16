import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { PinoLogger, type Env } from '@provost/common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService<Env, true>);

  // Structured JSON logging via pino.
  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  // Security headers.
  app.use(helmet());

  // CORS allowlist from env.
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global validation: strip unknown properties and reject them.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger — disabled in production unless explicitly enabled.
  const swaggerEnabled = config.get('SWAGGER_ENABLED', { infer: true });
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
  if (!isProd || swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Provost API')
      .setDescription(
        'Scholarship, fellowship & grant discovery and application tracking',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'openapi.json',
    });
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  logger.log(`Provost API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
