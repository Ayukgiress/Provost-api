import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantConversation, AssistantFeedback, AssistantMessage, AssistantPendingAction, AssistantUsage, Subscription } from '@provost/database';
import type { Env } from '@provost/common';
import { AssistantController } from './assistant.controller.js';
import { AssistantRepository } from './assistant.repository.js';
import { AssistantService } from './assistant.service.js';
import { AssistantPromptService } from './assistant-prompt.service.js';
import { AssistantToolsService } from './assistant-tools.service.js';
import { OpportunitiesModule } from '../opportunities/opportunities.module.js';
import { MatchesModule } from '../me/matches/matches.module.js';
import { ProfileModule } from '../me/profile/profile.module.js';
import { SavedModule } from '../me/saved/saved.module.js';
import { OllamaModelProvider } from './providers/ollama-model.provider.js';
import { MODEL_PROVIDER, type ModelProvider } from './providers/model-provider.js';

@Module({
  imports: [OpportunitiesModule, MatchesModule, ProfileModule, SavedModule, TypeOrmModule.forFeature([
    AssistantConversation,
    AssistantMessage,
    AssistantUsage,
    AssistantFeedback,
    AssistantPendingAction,
    Subscription,
  ])],
  controllers: [AssistantController],
  providers: [
    AssistantRepository,
    AssistantService,
    AssistantPromptService,
    AssistantToolsService,
    {
      provide: MODEL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): ModelProvider => new OllamaModelProvider(
        config.get('AI_BASE_URL', { infer: true }),
        config.get('AI_API_KEY', { infer: true }),
      ),
    },
  ],
  exports: [AssistantService, AssistantToolsService, MODEL_PROVIDER],
})
export class AssistantModule {}
