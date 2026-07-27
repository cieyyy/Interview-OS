import type { ProviderConfig } from './domain';

export type ProviderPresetId =
  | 'deepseek'
  | 'openai'
  | 'qwen'
  | 'zhipu'
  | 'moonshot'
  | 'ollama'
  | 'custom'
  | 'dify';

export interface ProviderPreset {
  id: ProviderPresetId;
  label: string;
  kind: ProviderConfig['kind'];
  name: string;
  baseUrl: string;
  model: string;
  authMode: NonNullable<ProviderConfig['authMode']>;
  availability: 'cloud' | 'local';
}

export const providerPresets: ProviderPreset[] = [
  {
    id: 'deepseek', label: 'DeepSeek', kind: 'openai-compatible', name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', authMode: 'api-key', availability: 'cloud'
  },
  {
    id: 'openai', label: 'OpenAI', kind: 'openai-compatible', name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', authMode: 'api-key', availability: 'cloud'
  },
  {
    id: 'qwen', label: '通义千问', kind: 'openai-compatible', name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', authMode: 'api-key', availability: 'cloud'
  },
  {
    id: 'zhipu', label: '智谱 GLM', kind: 'openai-compatible', name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', authMode: 'api-key', availability: 'cloud'
  },
  {
    id: 'moonshot', label: 'Moonshot / Kimi', kind: 'openai-compatible', name: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', authMode: 'api-key', availability: 'cloud'
  },
  {
    id: 'ollama', label: '本地 Ollama', kind: 'openai-compatible', name: 'Ollama',
    baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b', authMode: 'none', availability: 'local'
  },
  {
    id: 'custom', label: '自定义兼容接口', kind: 'openai-compatible', name: 'OpenAI Compatible',
    baseUrl: 'https://example.com/v1', model: '', authMode: 'api-key', availability: 'cloud'
  },
  {
    id: 'dify', label: '远程 Dify', kind: 'dify', name: 'Dify',
    baseUrl: 'https://api.dify.ai/v1', model: '', authMode: 'api-key', availability: 'cloud'
  }
];

export function getProviderPreset(id: ProviderPresetId): ProviderPreset {
  return providerPresets.find((item) => item.id === id) ?? providerPresets[0];
}

export function detectProviderPreset(config?: Pick<ProviderConfig, 'kind' | 'baseUrl'>): ProviderPresetId {
  if (!config) return 'deepseek';
  if (config.kind === 'dify') return 'dify';
  return providerPresets.find((item) => item.kind === config.kind && item.baseUrl === config.baseUrl)?.id ?? 'custom';
}
