import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@provost/common';
import { AssistantMessageRole, AssistantPendingActionStatus } from '@provost/database';
import { performance } from 'node:perf_hooks';
import { ProfileService } from '../me/profile/profile.service.js';
import { SavedService } from '../me/saved/saved.service.js';
import { AssistantRepository } from './assistant.repository.js';
import { AssistantPromptService } from './assistant-prompt.service.js';
import { AssistantToolsService, type AssistantOpportunityCard } from './assistant-tools.service.js';
import { MODEL_PROVIDER, type AssistantModelMessage, type AssistantToolCall, type ModelProvider } from './providers/model-provider.js';
import type { ChatAssistantDto } from './dto/chat-assistant.dto.js';

export interface AssistantStreamEvent {
  type: 'token' | 'cards' | 'done' | 'error';
  data: Record<string, unknown>;
}

export interface AssistantUsageSummary {
  remaining: number;
  limit: number;
  resetsAt: string;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly repository: AssistantRepository,
    private readonly config: ConfigService<Env, true>,
    private readonly saved: SavedService,
    private readonly profiles: ProfileService,
    private readonly prompt: AssistantPromptService,
    private readonly tools: AssistantToolsService,
    @Inject(MODEL_PROVIDER) private readonly model: ModelProvider,
  ) {}

  async getUsage(userId: string): Promise<AssistantUsageSummary> {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const [usage, isPlus] = await Promise.all([
      this.repository.findUsage(userId, date),
      this.repository.isPlusUser(userId),
    ]);
    const limit = isPlus
      ? this.config.get('ASSISTANT_LIMIT_PLUS', { infer: true })
      : this.config.get('ASSISTANT_LIMIT_FREE', { infer: true });
    const remaining = Math.max(0, limit - (usage?.messageCount ?? 0));
    const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
    return { remaining, limit, resetsAt };
  }

  async *chat(userId: string, dto: ChatAssistantDto, acceptLanguage?: string, signal?: AbortSignal): AsyncIterable<AssistantStreamEvent> {
    const startedAt = performance.now();
    const locale = this.resolveLocale(dto.locale, acceptLanguage);
    let toolNames: string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const [usage, isPlus] = await Promise.all([
        this.getUsage(userId),
        this.repository.isPlusUser(userId),
      ]);
      if (usage.remaining <= 0) {
        yield { type: 'error', data: { message: locale.startsWith('fr') ? 'Votre limite quotidienne de messages est atteinte. Réessayez demain.' : 'You have reached your daily message limit. Please try again tomorrow.' } };
        return;
      }

      const profile = await this.profiles.get(userId);
      const conversation = dto.conversationId
        ? await this.repository.findOwnedConversation(dto.conversationId, userId)
        : await this.repository.createConversation(userId);
      if (!conversation) throw new NotFoundException('Assistant conversation not found');

      const history = await this.repository.findRecentMessages(conversation.id);
      const messages: AssistantModelMessage[] = [
        {
          role: 'system',
          content: this.prompt.getSystemPrompt({
            country: profile.residenceCountry ?? profile.citizenship ?? null,
            level: profile.educationLevel ?? null,
            field: profile.fieldOfStudy ?? null,
            goals: profile.goals ?? null,
          }, locale, isPlus),
        },
        ...history.map((message) => ({
          role: message.role as AssistantModelMessage['role'],
          content: message.content,
          ...(message.toolCalls?.[0]?.name ? { toolCallId: String(message.toolCalls[0].name) } : {}),
          ...(message.role === AssistantMessageRole.Assistant && message.toolCalls?.length ? {
            toolCalls: message.toolCalls as Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
          } : {}),
        })),
        { role: 'user', content: dto.message },
      ];

      const transcript: Array<{ role: AssistantMessageRole; content: string; toolCalls?: Record<string, unknown>[] }> = [];
      const cards = new Map<string, AssistantOpportunityCard>();
      let answer = '';
      let rounds = 0;
      while (rounds++ < 4) {
        const calls: AssistantToolCall[] = [];
        let roundText = '';
        for await (const chunk of this.model.streamChat({
          model: isPlus ? this.config.get('AI_MODEL_STRONG', { infer: true }) : this.config.get('AI_MODEL_FAST', { infer: true }),
          messages,
          tools: this.tools.getDefinitions(),
        }, signal)) {
          if (signal?.aborted) return;
          if (chunk.type === 'token') {
            roundText += chunk.text;
            answer += chunk.text;
            yield { type: 'token', data: { text: chunk.text } };
          } else if (chunk.type === 'tool_call') {
            // Enforce max 5 tool calls total per chat
            if (calls.length >= 5 || toolNames.length >= 5) {
              this.logger.warn(JSON.stringify({ event: 'assistant_tool_limit_reached', tool: chunk.toolCall.name, userId }));
              continue;
            }
            calls.push(chunk.toolCall);
            toolNames.push(chunk.toolCall.name);
          } else {
            inputTokens += chunk.inputTokens;
            outputTokens += chunk.outputTokens;
          }
        }
        // Prevent more than 5 tool calls total
        if (toolNames.length >= 5) {
          this.logger.warn(JSON.stringify({ event: 'assistant_total_tool_limit_reached', totalTools: toolNames.length, userId }));
          break;
        }
        if (calls.length === 0) break;
        transcript.push({
          role: AssistantMessageRole.Assistant,
          content: roundText,
          toolCalls: calls.map((call) => ({ id: call.id, name: call.name, arguments: call.arguments })),
        });
        messages.push({ role: 'assistant', content: roundText, toolCalls: calls });
        for (const call of calls) {
          const toolStartedAt = performance.now();
          try {
            const result = await this.tools.execute(call.name, call.arguments, { userId, conversationId: conversation.id });
            for (const card of result.cards) cards.set(card.id, card);
            const serialized = JSON.stringify(result.result)
              .replaceAll('<<<BEGIN UNTRUSTED TOOL RESULT', '[escaped tool-result begin marker]')
              .replaceAll('<<<END UNTRUSTED TOOL RESULT', '[escaped tool-result end marker]');
            const content = `<<<BEGIN UNTRUSTED TOOL RESULT>>>\n${serialized}\n<<<END UNTRUSTED TOOL RESULT>>>`;
            transcript.push({ role: AssistantMessageRole.Tool, content, toolCalls: [{ id: call.id, name: call.name }] });
            messages.push({ role: 'tool', content, toolCallId: call.name });
          } catch (error) {
            const errorType = error instanceof Error ? error.name : 'UnknownError';
            this.logger.warn(JSON.stringify({ event: 'assistant_tool_error', tool: call.name, durationMs: Math.round(performance.now() - toolStartedAt), error: errorType }));
            // Don't increment usage for tool failures
            const rollbackInput = inputTokens;
            const rollbackOutput = outputTokens;
            inputTokens = 0;
            outputTokens = 0;
            const content = `<<<BEGIN UNTRUSTED TOOL RESULT>>>\n${JSON.stringify({ error: 'Tool result unavailable' })}\n<<<END UNTRUSTED TOOL RESULT>>>`;
            transcript.push({ role: AssistantMessageRole.Tool, content, toolCalls: [{ id: call.id, name: call.name }] });
            messages.push({ role: 'tool', content, toolCallId: call.name });
          }
          this.logger.log(JSON.stringify({ event: 'assistant_tool', tool: call.name, durationMs: Math.round(performance.now() - toolStartedAt) }));
        }
      }

      if (signal?.aborted) return;
      const cardList = [...cards.values()];
      const now = new Date();
      await this.repository.persistChat({
        userId,
        date: now.toISOString().slice(0, 10),
        inputTokens,
        outputTokens,
        messages: [
          { conversationId: conversation.id, role: AssistantMessageRole.User, content: dto.message },
          ...transcript.map((message) => ({ conversationId: conversation.id, ...message })),
          {
            conversationId: conversation.id,
            role: AssistantMessageRole.Assistant,
            content: answer,
            toolCalls: null,
            cards: cardList as unknown as Record<string, unknown>[],
          },
        ],
      });
      if (cardList.length) yield { type: 'cards', data: { cards: cardList } };
      this.logger.log(JSON.stringify({ event: 'assistant_chat_completed', durationMs: Math.round(performance.now() - startedAt), inputTokens, outputTokens, toolNames }));
      yield { type: 'done', data: { conversationId: conversation.id, usage: await this.getUsage(userId) } };
    } catch (error) {
      const errorType = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(JSON.stringify({ event: 'assistant_chat_error', durationMs: Math.round(performance.now() - startedAt), toolNames, error: errorType }));
      // Don't increment usage for any errors
      inputTokens = 0;
      outputTokens = 0;
      yield { type: 'error', data: { message: locale.startsWith('fr') ? 'Désolé, une erreur est survenue. Votre message n’a pas été comptabilisé. Veuillez réessayer.' : 'Sorry, something went wrong. Your message was not counted. Please try again.' } };
    }
  }

  private resolveLocale(requestLocale?: string, acceptLanguage?: string): string {
    const candidate = (requestLocale ?? acceptLanguage?.split(',')[0] ?? 'en').trim();
    return candidate.toLowerCase().startsWith('fr') ? candidate : 'en';
  }

  async confirm(userId: string, conversationId: string, actionId: string, approve: boolean): Promise<{ ok: boolean; message: string }> {
    const conversation = await this.repository.findOwnedConversation(conversationId, userId);
    if (!conversation) throw new NotFoundException('Assistant conversation not found');
    const action = await this.repository.findOwnedPendingAction(actionId, conversationId, userId);
    if (!action) throw new NotFoundException('Pending assistant action not found');
    if (action.expiresAt.getTime() <= Date.now()) {
      action.status = AssistantPendingActionStatus.Expired;
      await this.repository.savePendingAction(action);
      throw new BadRequestException('Pending assistant action has expired');
    }
    if (!approve) {
      action.status = AssistantPendingActionStatus.Rejected;
      await this.repository.savePendingAction(action);
      return { ok: true, message: 'Action rejected' };
    }
    if (action.action !== 'save_opportunity' || typeof action.payload.opportunityId !== 'string') {
      throw new BadRequestException('Unsupported assistant action');
    }
    // Must have an approved pending action owned by the same user to save (already enforced by findOwnedPendingAction)
    await this.saved.create(userId, { opportunityId: action.payload.opportunityId });
    action.status = AssistantPendingActionStatus.Approved;
    await this.repository.savePendingAction(action);
    return { ok: true, message: 'Opportunity saved' };
  }
}