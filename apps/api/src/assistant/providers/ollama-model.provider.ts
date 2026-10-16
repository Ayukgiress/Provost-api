import type {
  AssistantModelChunk,
  AssistantModelRequest,
  AssistantToolCall,
  ModelProvider,
} from './model-provider.js';

interface OllamaResponseChunk {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function?: { name?: string; arguments?: unknown };
    }>;
  };
  prompt_eval_count?: number;
  eval_count?: number;
  done?: boolean;
}

export class OllamaModelProvider implements ModelProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async *streamChat(request: AssistantModelRequest, signal?: AbortSignal): AsyncIterable<AssistantModelChunk> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: request.model,
        stream: true,
        messages: request.messages.map(({ role, content, toolCallId, toolCalls }) => ({
          role,
          content,
          ...(toolCallId ? { tool_name: toolCallId } : {}),
          ...(toolCalls ? { tool_calls: toolCalls.map(({ name, arguments: args }) => ({ type: 'function', function: { name, arguments: args } })) } : {}),
        })),
        tools: request.tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
      }),
      signal: signal ?? AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    if (!response.body) throw new Error('Ollama returned an empty stream');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let toolIndex = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const chunk = this.parseChunk(line);
          if (!chunk) continue;
          for (const tool of chunk.message?.tool_calls ?? []) {
            const name = tool.function?.name;
            if (!name) continue;
            const call: AssistantToolCall = {
              id: `ollama-${toolIndex++}`,
              name,
              arguments: this.toArguments(tool.function?.arguments),
            };
            yield { type: 'tool_call', toolCall: call };
          }
          const text = chunk.message?.content;
          if (text) yield { type: 'token', text };
          if (chunk.done) {
            yield {
              type: 'usage',
              inputTokens: chunk.prompt_eval_count ?? 0,
              outputTokens: chunk.eval_count ?? 0,
            };
          }
        }
        if (done) break;
      }
      if (buffer.trim()) {
        const finalChunk = this.parseChunk(buffer);
        if (finalChunk?.message?.content) yield { type: 'token', text: finalChunk.message.content };
        if (finalChunk?.done) {
          yield { type: 'usage', inputTokens: finalChunk.prompt_eval_count ?? 0, outputTokens: finalChunk.eval_count ?? 0 };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseChunk(line: string): OllamaResponseChunk | null {
    if (!line.trim()) return null;
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid Ollama stream response');
    return parsed as OllamaResponseChunk;
  }

  private toArguments(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }
}
