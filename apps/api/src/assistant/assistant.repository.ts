import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AssistantConversation,
  AssistantMessage,
  AssistantMessageRole,
  AssistantPendingAction,
  AssistantPendingActionStatus,
  AssistantUsage,
  Subscription,
  SubscriptionPlan,
} from '@provost/database';
import { Repository } from 'typeorm';

@Injectable()
export class AssistantRepository {
  constructor(
    @InjectRepository(AssistantUsage) private readonly usage: Repository<AssistantUsage>,
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(AssistantConversation) private readonly conversations: Repository<AssistantConversation>,
    @InjectRepository(AssistantMessage) private readonly messages: Repository<AssistantMessage>,
    @InjectRepository(AssistantPendingAction) private readonly pendingActions: Repository<AssistantPendingAction>,
  ) {}

  findUsage(userId: string, date: string): Promise<AssistantUsage | null> {
    return this.usage.findOne({ where: { userId, date } });
  }

  async isPlusUser(userId: string): Promise<boolean> {
    const subscription = await this.subscriptions.createQueryBuilder('subscription')
      .where('subscription.user_id = :userId', { userId })
      .andWhere('subscription.plan = :plan', { plan: SubscriptionPlan.Plus })
      .andWhere("subscription.status IN ('active', 'trialing')")
      .andWhere('(subscription.ends_at IS NULL OR subscription.ends_at > NOW())')
      .orderBy('subscription.created_at', 'DESC')
      .getOne();
    return subscription !== null;
  }

  findOwnedConversation(conversationId: string, userId: string): Promise<AssistantConversation | null> {
    return this.conversations.findOne({ where: { id: conversationId, userId } });
  }

  createConversation(userId: string): Promise<AssistantConversation> {
    return this.conversations.save(this.conversations.create({ userId }));
  }

  async findRecentMessages(conversationId: string, limit = 20): Promise<AssistantMessage[]> {
    const messages = await this.messages.find({ where: { conversationId }, order: { createdAt: 'DESC' }, take: limit });
    return messages.reverse();
  }

  saveMessages(messages: Array<{
    conversationId: string;
    role: AssistantMessageRole;
    content: string;
    toolCalls?: Record<string, unknown>[] | null;
    cards?: Record<string, unknown>[] | null;
  }>): Promise<AssistantMessage[]> {
    return this.messages.save(messages.map((message) => this.messages.create(message)));
  }

  async persistChat(input: {
    messages: Array<{
      conversationId: string;
      role: AssistantMessageRole;
      content: string;
      toolCalls?: Record<string, unknown>[] | null;
      cards?: Record<string, unknown>[] | null;
    }>;
    userId: string;
    date: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    await this.usage.manager.transaction(async (manager) => {
      const messages = manager.getRepository(AssistantMessage);
      await messages.save(input.messages.map((message) => messages.create(message)));
      await manager.query(
        `INSERT INTO "assistant_usage" ("user_id", "date", "message_count", "input_tokens", "output_tokens")
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT ("user_id", "date") DO UPDATE SET
           "message_count" = "assistant_usage"."message_count" + 1,
           "input_tokens" = "assistant_usage"."input_tokens" + EXCLUDED."input_tokens",
           "output_tokens" = "assistant_usage"."output_tokens" + EXCLUDED."output_tokens"`,
        [input.userId, input.date, input.inputTokens, input.outputTokens],
      );
    });
  }

  async incrementUsage(userId: string, date: string, inputTokens: number, outputTokens: number): Promise<void> {
    await this.usage.manager.query(
      `INSERT INTO "assistant_usage" ("user_id", "date", "message_count", "input_tokens", "output_tokens")
       VALUES ($1, $2, 1, $3, $4)
       ON CONFLICT ("user_id", "date") DO UPDATE SET
         "message_count" = "assistant_usage"."message_count" + 1,
         "input_tokens" = "assistant_usage"."input_tokens" + EXCLUDED."input_tokens",
         "output_tokens" = "assistant_usage"."output_tokens" + EXCLUDED."output_tokens"`,
      [userId, date, inputTokens, outputTokens],
    );
  }

  createPendingAction(input: {
    conversationId: string;
    userId: string;
    action: string;
    payload: Record<string, unknown>;
    expiresAt: Date;
  }): Promise<AssistantPendingAction> {
    return this.pendingActions.save(this.pendingActions.create({
      ...input,
      status: AssistantPendingActionStatus.Pending,
    }));
  }

  findOwnedPendingAction(actionId: string, conversationId: string, userId: string): Promise<AssistantPendingAction | null> {
    return this.pendingActions.findOne({ where: {
      id: actionId,
      conversationId,
      userId,
      status: AssistantPendingActionStatus.Pending,
    } });
  }

  savePendingAction(action: AssistantPendingAction): Promise<AssistantPendingAction> {
    return this.pendingActions.save(action);
  }
}
