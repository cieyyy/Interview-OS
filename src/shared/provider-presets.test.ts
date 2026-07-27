import { describe, expect, it } from 'vitest';
import { detectProviderPreset, getProviderPreset, providerPresets } from './provider-presets';

describe('provider presets', () => {
  it('ships cloud, Chinese and local provider choices', () => {
    expect(providerPresets.map((item) => item.id)).toEqual(expect.arrayContaining([
      'deepseek', 'openai', 'qwen', 'zhipu', 'moonshot', 'ollama', 'custom'
    ]));
    expect(getProviderPreset('ollama').authMode).toBe('none');
    expect(getProviderPreset('deepseek').model).toBe('deepseek-chat');
  });

  it('detects known endpoints and keeps unknown endpoints custom', () => {
    expect(detectProviderPreset({ kind: 'openai-compatible', baseUrl: 'https://api.deepseek.com/v1' })).toBe('deepseek');
    expect(detectProviderPreset({ kind: 'openai-compatible', baseUrl: 'https://gateway.example/v1' })).toBe('custom');
    expect(detectProviderPreset({ kind: 'dify', baseUrl: 'https://example.test/v1' })).toBe('dify');
  });
});
