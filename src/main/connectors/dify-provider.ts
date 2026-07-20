import type { ConnectionResult, ProviderConfig } from '../../shared/domain';
import type { AIProvider, CompletionRequest, CompletionResponse } from './ai-provider';
import { fetchWithTimeout, ProviderHttpError } from './ai-provider';

export class DifyProvider implements AIProvider {
  constructor(readonly config: ProviderConfig) {}

  async testConnection(apiKey: string): Promise<ConnectionResult> {
    const started = Date.now();
    await this.complete({
      system: 'You are a connection tester. Follow the user instruction exactly.',
      prompt: 'Reply with OK only.'
    }, apiKey);
    return { ok: true, message: 'Dify 连接和模型调用成功', latencyMs: Date.now() - started };
  }

  async complete(request: CompletionRequest, apiKey: string): Promise<CompletionResponse> {
    if (request.image) throw new Error('当前图片识别仅支持 OpenAI 兼容 Provider');
    const response = await fetchWithTimeout(`${this.config.baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { system_instruction: request.system },
        query: request.prompt,
        response_mode: 'blocking',
        user: 'interview-os-local-user',
        conversation_id: request.conversationId ?? ''
      })
    }, 60_000);
    if (!response.ok) throw new ProviderHttpError(response.status, `Dify 返回 HTTP ${response.status}`);
    const body = await response.json() as { answer?: string; conversation_id?: string };
    if (!body.answer?.trim()) throw new Error('Dify 没有返回有效内容');
    return { text: body.answer.trim(), conversationId: body.conversation_id };
  }
}
