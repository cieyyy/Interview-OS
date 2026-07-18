import type { ConnectionResult, ProviderConfig, ProviderInput } from '../../shared/domain';
import { validateProviderInput } from '../../shared/validation';
import type { AIProvider } from '../connectors/ai-provider';
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

  private createProvider(config: ProviderConfig): AIProvider {
    return config.kind === 'dify' ? new DifyProvider(config) : new OpenAICompatibleProvider(config);
  }
}
