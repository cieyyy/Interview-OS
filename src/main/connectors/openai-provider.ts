import type { ConnectionResult, ProviderConfig } from '../../shared/domain';
import type { AIProvider, CompletionRequest, CompletionResponse } from './ai-provider';
import { fetchWithTimeout, ProviderHttpError } from './ai-provider';

export class OpenAICompatibleProvider implements AIProvider {
  constructor(readonly config: ProviderConfig) {}

  private apiBaseUrl(): string {
    const url = new URL(this.config.baseUrl);
    if (!url.pathname || url.pathname === '/') url.pathname = '/v1';
    return url.toString().replace(/\/$/, '');
  }

  private async readJson<T>(response: Response): Promise<T> {
    const raw = await response.text();
    try {
      return JSON.parse(raw) as T;
    } catch {
      const html = /^\s*(?:<!doctype\s+html|<html|<)/i.test(raw);
      throw new Error(html
        ? '模型服务返回了 HTML 页面。请确认 Base URL 指向 Sub2API 接口并以 /v1 结尾，同时检查反向代理配置。'
        : '模型服务返回了无效 JSON，请检查 Provider 地址和接口兼容性。');
    }
  }

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

    const response = await fetchWithTimeout(`${this.apiBaseUrl()}/responses`, {
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
    const body = await this.readJson<{
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    }>(response);
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
    const response = await fetchWithTimeout(`${this.apiBaseUrl()}/chat/completions`, {
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
    const body = await this.readJson<{ choices?: Array<{ message?: { content?: string } }> }>(response);
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('模型服务没有返回有效内容');
    return { text };
  }
}
