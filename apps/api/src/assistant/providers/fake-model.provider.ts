import type { AssistantModelChunk, AssistantModelRequest, ModelProvider } from './model-provider.js';

/** Deterministic provider for unit tests; it never performs network requests. */
export class FakeModelProvider implements ModelProvider {
  readonly requests: AssistantModelRequest[] = [];

  constructor(private readonly chunks: AssistantModelChunk[] = []) {}

  async *streamChat(request: AssistantModelRequest): AsyncIterable<AssistantModelChunk> {
    this.requests.push(request);
    for (const chunk of this.chunks) yield chunk;
  }
}
