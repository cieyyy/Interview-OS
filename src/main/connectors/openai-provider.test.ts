import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from './openai-provider';

afterEach(() => vi.unstubAllGlobals());

describe('OpenAICompatibleProvider image recognition payload', () => {
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
});
