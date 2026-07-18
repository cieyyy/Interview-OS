import type { ConnectionResult, ProviderConfig } from '../../shared/domain';
import type { AIProvider, CompletionRequest, CompletionResponse } from './ai-provider';
import { fetchWithTimeout, ProviderHttpError } from './ai-provider';

export class OpenAICompatibleProvider implements AIProvider {
  constructor(readonly config: ProviderConfig) {}

  async testConnection(apiKey: string): Promise<ConnectionResult> {
    const started = Date.now();
    const response = await fetchWithTimeout(`${this.config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) throw new ProviderHttpError(response.status, `模型服务返回 HTTP ${response.status}`);
    return { ok: true, message: '连接成功', latencyMs: Date.now() - started };
  }

  async complete(request: CompletionRequest, apiKey: string): Promise<CompletionResponse> {
    const response = await fetchWithTimeout(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt }
        ]
      })
    }, 45_000);
    if (!response.ok) throw new ProviderHttpError(response.status, `模型服务返回 HTTP ${response.status}`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('模型服务没有返回有效内容');
    return { text };
  }
}
