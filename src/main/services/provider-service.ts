import type { ConnectionResult, DocumentImportTarget, ProviderConfig, ProviderInput } from '../../shared/domain';
import { validateProviderInput } from '../../shared/validation';
import type { AIProvider, CompletionRequest, CompletionResponse } from '../connectors/ai-provider';
import { DifyProvider } from '../connectors/dify-provider';
import { OpenAICompatibleProvider } from '../connectors/openai-provider';
import type { SecretStore } from '../storage/secret-store';
import type { AtomicWorkspaceRepository } from '../storage/workspace-repository';

const SECRET_NAME = 'ai-provider-api-key';

export class ProviderService {
  constructor(
    private readonly repository: AtomicWorkspaceRepository,
    private readonly secrets: SecretStore
  ) {}

  async save(input: ProviderInput): Promise<ProviderConfig> {
    const valid = validateProviderInput(input);
    if (valid.apiKey) await this.secrets.set(SECRET_NAME, valid.apiKey);
    const hasSecret = Boolean(valid.apiKey || await this.secrets.get(SECRET_NAME));
    const config: ProviderConfig = {
      kind: valid.kind,
      name: valid.name,
      baseUrl: valid.baseUrl,
      model: valid.model,
      enabled: valid.enabled,
      hasSecret
    };
    await this.repository.update((draft) => {
      draft.settings.provider = config;
    });
    return config;
  }

  async testConnection(): Promise<ConnectionResult> {
    const config = this.repository.getState().settings.provider;
    if (!config?.enabled) return { ok: false, message: '尚未启用 AI Provider' };
    const apiKey = await this.secrets.get(SECRET_NAME);
    if (!apiKey) return { ok: false, message: '尚未保存 API Key' };
    return this.createProvider(config).testConnection(apiKey);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const config = this.repository.getState().settings.provider;
    if (!config?.enabled) throw new Error('图片识别需要先在设置中启用 AI Provider');
    const apiKey = await this.secrets.get(SECRET_NAME);
    if (!apiKey) throw new Error('图片识别需要先安全保存 API Key');
    return this.createProvider(config).complete(request, apiKey);
  }

  async recognizeImage(
    data: Buffer,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
    target: DocumentImportTarget
  ): Promise<string> {
    const context = {
      job: '招聘岗位描述（JD）',
      profile: '个人简历或职业档案',
      knowledge: '技术知识、故障案例或面试笔记'
    }[target];
    const response = await this.complete({
      system: '你是严谨的 OCR 与文档转写助手。不得补写图片中不存在的信息。',
      prompt: `请识别这张${context}图片中的全部可读文字，保持标题、段落和列表结构。只返回识别出的正文，不要解释。`,
      image: { mimeType, base64: data.toString('base64') }
    });
    return response.text;
  }

  private createProvider(config: ProviderConfig): AIProvider {
    return config.kind === 'dify' ? new DifyProvider(config) : new OpenAICompatibleProvider(config);
  }
}
