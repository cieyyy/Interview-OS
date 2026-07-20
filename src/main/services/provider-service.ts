import type {
  ConnectionResult,
  DocumentImportTarget,
  ProviderConfig,
  ProviderInput,
  TrainingCoachInput,
  TrainingCoachResult
} from '../../shared/domain';
import { generateRecommendedAnswer, scoreAnswer } from '../../shared/training-engine';
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
    if (!config?.enabled) throw new Error('需要先在设置中启用 AI Provider');
    const apiKey = await this.secrets.get(SECRET_NAME);
    if (!apiKey) throw new Error('需要先安全保存 API Key');
    return this.createProvider(config).complete(request, apiKey);
  }

  async coach(input: TrainingCoachInput): Promise<TrainingCoachResult> {
    const state = this.repository.getState();
    const session = state.trainingSessions.find((item) => item.id === String(input?.sessionId ?? ''));
    if (!session) throw new Error('未找到训练会话');
    const currentQuestion = session.questions.find((item) => item.id === String(input?.questionId ?? ''));
    if (!currentQuestion) throw new Error('未找到训练问题');
    const project = session.projectId ? state.projects.find((item) => item.id === session.projectId) : undefined;
    const language = input.language ?? session.language ?? 'zh-CN';
    const answer = String(input.answer ?? '').trim().slice(0, 30_000);
    const recommendedAnswer = generateRecommendedAnswer(currentQuestion, project, language);
    const scored = answer ? scoreAnswer(answer, currentQuestion, language) : undefined;
    const local: TrainingCoachResult = {
      feedback: scored
        ? scored.feedback.join(language === 'en-US' ? ' ' : '')
        : (language === 'en-US'
            ? 'Use the recommended answer as a structure reference, but replace every detail with your own verifiable experience.'
            : '推荐回答只用于参考结构，请将其中每个细节替换为你自己可以被追问验证的真实经历。'),
      recommendedAnswer,
      followUpQuestion: scored?.clarifyingQuestions[0]
        ?? (language === 'en-US' ? 'Which part of this answer can you support with a specific action or result?' : '这段回答中，哪一部分可以补充你亲自完成的动作或验证结果？'),
      source: 'local'
    };

    const config = state.settings.provider;
    const apiKey = await this.secrets.get(SECRET_NAME);
    if (!config?.enabled || !apiKey) return local;

    try {
      const response = await this.createProvider(config).complete({
        system: language === 'en-US'
          ? 'You are a rigorous 1-on-1 interview coach. Never invent experience. Return strict JSON only.'
          : '你是一名严谨的 1V1 面试教练。不得编造候选人经历，只能基于给定项目证据提出建议。只返回严格 JSON。',
        prompt: language === 'en-US'
          ? `Question: ${currentQuestion.text}\nCandidate answer: ${answer || '(not answered yet)'}\nVerified project evidence: ${JSON.stringify(project ?? null)}\nReturn JSON with exactly: {"feedback":"concise coaching feedback","recommendedAnswer":"a natural answer grounded only in verified evidence","followUpQuestion":"one interviewer follow-up"}.`
          : `面试问题：${currentQuestion.text}\n候选人回答：${answer || '（尚未回答）'}\n已核实项目证据：${JSON.stringify(project ?? null)}\n请返回且只返回 JSON：{"feedback":"简洁具体的教练建议","recommendedAnswer":"仅基于真实证据的自然参考回答","followUpQuestion":"一个面试官追问"}。`
      }, apiKey);
      const jsonText = response.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonText) as Partial<TrainingCoachResult>;
      if (!parsed.feedback || !parsed.recommendedAnswer || !parsed.followUpQuestion) return local;
      return {
        feedback: String(parsed.feedback).slice(0, 10_000),
        recommendedAnswer: String(parsed.recommendedAnswer).slice(0, 20_000),
        followUpQuestion: String(parsed.followUpQuestion).slice(0, 5_000),
        source: 'ai'
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知错误';
      return {
        ...local,
        feedback: language === 'en-US'
          ? `The remote AI coach was unavailable, so local coaching was used. ${reason} ${local.feedback}`
          : `远程 AI 陪练暂不可用，已自动切换到本地教练。${reason}。${local.feedback}`
      };
    }
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
