import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommonModule, RequestIdMiddleware, type Env } from '@provost/common';
import { DatabaseModule } from '@provost/database';
import { HealthModule } from './health/health.module.js';
import { AccountModule } from './me/account/account.module.js';
import { MatchesModule } from './me/matches/matches.module.js';
import { ProfileModule } from './me/profile/profile.module.js';
import { SavedModule } from './me/saved/saved.module.js';
import { OpportunitiesModule } from './opportunities/opportunities.module.js';
import { ReportsModule } from './opportunities/reports.module.js';
import { AdminModule } from './admin/admin.module.js';
import { DocumentsModule } from './me/documents/documents.module.js';
import { DraftsModule } from './me/drafts/drafts.module.js';

@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    HealthModule,
    ProfileModule,
    DocumentsModule,
    DraftsModule,
    OpportunitiesModule,
    MatchesModule,
    SavedModule,
    ReportsModule,
    AdminModule,
    AccountModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: config.get('THROTTLE_TTL', { infer: true }),
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
      ],
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
