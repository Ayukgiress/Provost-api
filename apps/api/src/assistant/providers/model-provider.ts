export type AssistantModelRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AssistantModelMessage {
  role: AssistantModelRole;
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}

export interface AssistantToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AssistantToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AssistantModelRequest {
  model: string;
  messages: AssistantModelMessage[];
  tools: AssistantToolDefinition[];
}

export type AssistantModelChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; toolCall: AssistantToolCall }
  | { type: 'usage'; inputTokens: number; outputTokens: number };

export const MODEL_PROVIDER = 'MODEL_PROVIDER';

export interface ModelProvider {
  streamChat(request: AssistantModelRequest, signal?: AbortSignal): AsyncIterable<AssistantModelChunk>;
}