import type { ConnectionResult, ProviderConfig } from '../../shared/domain';
import type { AIProvider, CompletionRequest, CompletionResponse } from './ai-provider';
import { fetchWithTimeout, ProviderHttpError } from './ai-provider';

export class OpenAICompatibleProvider implements AIProvider {
  constructor(readonly config: ProviderConfig) {}

  private headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  private async completeWithResponses(request: CompletionRequest, apiKey: string): Promise<CompletionResponse> {
    const content = request.image
      ? [
          { type: 'input_text', text: request.prompt },
          {
            type: 'input_image',
            image_url: `data:${request.image.mimeType};base64,${request.image.base64}`,
            detail: 'auto'
          }
        ]
      : [{ type: 'input_text', text: request.prompt }];

    const response = await fetchWithTimeout(`${this.config.baseUrl}/responses`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify({
        model: this.config.model,
        store: false,
        instructions: request.system,
        input: [{ role: 'user', content }]
      })
    }, 45_000);

    if (!response.ok) throw new ProviderHttpError(response.status, `模型服务返回 HTTP ${response.status}`);
    const body = await response.json() as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const text = body.output_text?.trim()
      || body.output?.flatMap((item) => item.content ?? [])
        .filter((item) => item.type === 'output_text' || item.type === 'text')
        .map((item) => item.text ?? '')
        .join('\n')
        .trim();
    if (!text) throw new Error('模型服务没有返回有效内容');
    return { text };
  }

  async testConnection(apiKey: string): Promise<ConnectionResult> {
    const started = Date.now();
    await this.complete({
      system: 'You are a connection tester. Follow the user instruction exactly.',
      prompt: 'Reply with OK only.'
    }, apiKey);
    return { ok: true, message: '连接和模型调用成功', latencyMs: Date.now() - started };
  }

  async complete(request: CompletionRequest, apiKey: string): Promise<CompletionResponse> {
    const userContent = request.image
      ? [
          { type: 'text', text: request.prompt },
          { type: 'image_url', image_url: { url: `data:${request.image.mimeType};base64,${request.image.base64}` } }
        ]
      : request.prompt;
    const response = await fetchWithTimeout(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify({
        model: this.config.model,
        store: false,
        temperature: 0.2,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: userContent }
        ]
      })
    }, 45_000);
    // OpenAI-compatible gateways differ here: some expose Chat Completions,
    // while others (including common Sub2API setups) expose only Responses.
    if (!response.ok && [400, 404, 405, 415, 422, 501].includes(response.status)) {
      return this.completeWithResponses(request, apiKey);
    }
    if (!response.ok) throw new ProviderHttpError(response.status, `模型服务返回 HTTP ${response.status}`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('模型服务没有返回有效内容');
    return { text };
  }
}
