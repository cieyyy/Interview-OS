import { afterEach, describe, expect, it, vi } from 'vitest';
import { DifyProvider } from './dify-provider';

afterEach(() => vi.unstubAllGlobals());

describe('DifyProvider', () => {
  it('tests an actual blocking chat request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      answer: 'OK', conversation_id: 'test-conversation'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new DifyProvider({
      kind: 'dify', name: 'Dify', baseUrl: 'https://example.test/v1',
      model: '', enabled: true, hasSecret: true
    });

    const result = await provider.testConnection('test-key');

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Dify 连接和模型调用成功');
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/v1/chat-messages', expect.objectContaining({ method: 'POST' }));
  });
});
