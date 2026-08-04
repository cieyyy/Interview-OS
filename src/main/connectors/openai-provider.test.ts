import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from './openai-provider';

afterEach(() => vi.unstubAllGlobals());

describe('OpenAICompatibleProvider', () => {
  it('tests an actual model generation instead of only listing models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleProvider({
      kind: 'openai-compatible', name: 'Test', baseUrl: 'https://example.test/v1',
      model: 'test-model', enabled: true, hasSecret: true
    });

    const result = await provider.testConnection('test-key');

    expect(result.ok).toBe(true);
    expect(result.message).toBe('连接和模型调用成功');
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
  });

  it('sends an image as a data URL through chat completions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '识别出的文字' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleProvider({
      kind: 'openai-compatible', name: 'Test', baseUrl: 'https://example.test/v1',
      model: 'vision-model', enabled: true, hasSecret: true
    });

    const result = await provider.complete({
      system: 'OCR', prompt: '识别文字', image: { mimeType: 'image/png', base64: 'YWJj' }
    }, 'test-key');

    expect(result.text).toBe('识别出的文字');
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/png;base64,YWJj');
  });

  it('falls back to the Responses API for responses-only gateways', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Not found', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: 'Responses 识别结果' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleProvider({
      kind: 'openai-compatible', name: 'Sub2API', baseUrl: 'https://example.test/v1',
      model: 'vision-model', enabled: true, hasSecret: true
    });

    const result = await provider.complete({
      system: 'OCR', prompt: '识别文字', image: { mimeType: 'image/png', base64: 'YWJj' }
    }, 'test-key');

    expect(result.text).toBe('Responses 识别结果');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.test/v1/responses', expect.objectContaining({ method: 'POST' }));
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.instructions).toBe('OCR');
    expect(body.input[0].content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'input_text', text: '识别文字' }),
      expect.objectContaining({ type: 'input_image', image_url: 'data:image/png;base64,YWJj' })
    ]));
  });

  it('adds /v1 when an OpenAI-compatible root URL is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleProvider({
      kind: 'openai-compatible', name: 'Sub2API', baseUrl: 'http://127.0.0.1:3452',
      model: 'test-model', enabled: true, hasSecret: true
    });

    await provider.testConnection('test-key');

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3452/v1/chat/completions', expect.any(Object));
  });

  it('reports an actionable error when the gateway returns HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html><title>Gateway</title>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })));
    const provider = new OpenAICompatibleProvider({
      kind: 'openai-compatible', name: 'Sub2API', baseUrl: 'https://example.test',
      model: 'test-model', enabled: true, hasSecret: true
    });

    await expect(provider.testConnection('test-key')).rejects.toThrow('模型服务返回了 HTML 页面');
  });
});
