import type {
  ConnectionResult,
  DocumentImportTarget,
  ProviderConfig,
  ProviderInput,
  TrainingCoachInput,
  TrainingCoachResult
} from '../../shared/domain';
import { diagnosePressureAnswer, generateRecommendedAnswer, scoreAnswer } from '../../shared/training-engine';
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
    const job = session.jobId ? state.jobs.find((item) => item.id === session.jobId) : undefined;
    const language = input.language ?? session.language ?? 'zh-CN';
    const answer = String(input.answer ?? '').trim().slice(0, 30_000);
    const recommendedAnswer = generateRecommendedAnswer(currentQuestion, project, language);
    const scored = answer ? scoreAnswer(answer, currentQuestion, language) : undefined;
    const diagnosis = diagnosePressureAnswer(answer, currentQuestion, project, language);
    const round = session.attempts.filter((item) => item.isFinal).length + 1;
    const previousRounds = session.questions.slice(0, session.currentQuestionIndex).map((question) => ({
      question: question.text,
      answers: session.attempts.filter((item) => item.questionId === question.id && item.isFinal).map((item) => item.answer)
    }));
    const local: TrainingCoachResult = {
      feedback: scored
        ? scored.feedback.join(language === 'en-US' ? ' ' : '')
        : (language === 'en-US'
            ? 'Use the recommended answer as a structure reference, but replace every detail with your own verifiable experience.'
            : '推荐回答只用于参考结构，请将其中每个细节替换为你自己可以被追问验证的真实经历。'),
      recommendedAnswer,
      followUpQuestion: scored?.clarifyingQuestions[0]
        ?? (language === 'en-US' ? 'Which part of this answer can you support with a specific action or result?' : '这段回答中，哪一部分可以补充你亲自完成的动作或验证结果？'),
      diagnosis,
      source: 'local'
    };

    const config = state.settings.provider;
    const apiKey = await this.secrets.get(SECRET_NAME);
    if (!config?.enabled || !apiKey) return local;

    try {
      const response = await this.createProvider(config).complete({
        system: language === 'en-US'
          ? 'You are a strict HR and business interviewer for the target company and role. Ask one question at a time, dynamically follow up on the previous answer, expose vague or unsupported claims directly, never invent experience or metrics, and return strict JSON only.'
          : '你是目标公司和目标岗位最严格的 HR 与业务面试官。一次只追问一个问题，根据上一轮回答动态追问，直接指出含糊、夸大、证据不足和逻辑漏洞；不得编造经历或数据，只返回严格 JSON。',
        prompt: language === 'en-US'
          ? `Target company and role: ${JSON.stringify(job ? { company: job.company, title: job.title, jd: job.rawText } : null)}\nCandidate profile: ${JSON.stringify(state.profile)}\nVerified project evidence: ${JSON.stringify(project ?? null)}\nPrevious rounds (do not repeat answered questions): ${JSON.stringify(previousRounds)}\nCurrent round: ${round}/${session.maxRounds ?? session.questions.length}\nQuestion: ${currentQuestion.text}\nCandidate answer: ${answer || '(not answered yet)'}\nDiagnose: evidence gaps, logic/expression flaws, the strongest interviewer challenge, a STAR answer using only supplied facts, whether the resume should be updated, and one non-repeated follow-up. Unknown facts must be written as [CANDIDATE MUST ADD EVIDENCE]. If this is the final round, also include a sessionSummary with 3 strengths, 3 high-risk gaps, 5 practice questions, resume suggestions, and a final checklist. Return only JSON: {"feedback":"...","recommendedAnswer":"...","followUpQuestion":"...","diagnosis":{"evidenceGaps":["..."],"logicIssues":["..."],"interviewerChallenge":"...","starAnswer":"...","resumeUpdateNeeded":true,"resumeSuggestion":"..."},"sessionSummary":{"coreStrengths":[],"highRiskGaps":[],"practiceQuestions":[],"resumeSuggestions":[],"checklist":[]}}.`
          : `目标公司与岗位：${JSON.stringify(job ? { company: job.company, title: job.title, jd: job.rawText } : null)}\n候选人档案：${JSON.stringify(state.profile)}\n已核实项目证据：${JSON.stringify(project ?? null)}\n此前轮次（不得重复已经回答充分的问题）：${JSON.stringify(previousRounds)}\n当前轮次：${round}/${session.maxRounds ?? session.questions.length}\n当前问题：${currentQuestion.text}\n候选人回答：${answer || '（尚未回答）'}\n请依次诊断：证据不足、逻辑和表达漏洞、面试官最可能的质疑；仅根据已提供事实整理 STAR 回答；判断是否需要同步修改简历并给出具体建议；最后只生成一个不重复的动态追问。任何未知事实统一写“【需要本人补充】”。如果是最后一轮，同时输出 sessionSummary：核心竞争力 3 项、高风险漏洞 3 项、最需练习问题 5 个、简历修改建议和面试前清单。只返回 JSON：{"feedback":"...","recommendedAnswer":"...","followUpQuestion":"...","diagnosis":{"evidenceGaps":["..."],"logicIssues":["..."],"interviewerChallenge":"...","starAnswer":"...","resumeUpdateNeeded":true,"resumeSuggestion":"..."},"sessionSummary":{"coreStrengths":[],"highRiskGaps":[],"practiceQuestions":[],"resumeSuggestions":[],"checklist":[]}}。`
      }, apiKey);
      const jsonText = response.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonText) as Partial<TrainingCoachResult>;
      if (!parsed.feedback || !parsed.recommendedAnswer || !parsed.followUpQuestion) return local;
      const parsedDiagnosis = parsed.diagnosis;
      return {
        feedback: String(parsed.feedback).slice(0, 10_000),
        recommendedAnswer: String(parsed.recommendedAnswer).slice(0, 20_000),
        followUpQuestion: String(parsed.followUpQuestion).slice(0, 5_000),
        diagnosis: parsedDiagnosis ? {
          evidenceGaps: Array.isArray(parsedDiagnosis.evidenceGaps) ? parsedDiagnosis.evidenceGaps.map(String).slice(0, 10) : diagnosis.evidenceGaps,
          logicIssues: Array.isArray(parsedDiagnosis.logicIssues) ? parsedDiagnosis.logicIssues.map(String).slice(0, 10) : diagnosis.logicIssues,
          interviewerChallenge: String(parsedDiagnosis.interviewerChallenge || diagnosis.interviewerChallenge).slice(0, 5_000),
          starAnswer: String(parsedDiagnosis.starAnswer || parsed.recommendedAnswer || diagnosis.starAnswer).slice(0, 20_000),
          resumeUpdateNeeded: typeof parsedDiagnosis.resumeUpdateNeeded === 'boolean'
            ? parsedDiagnosis.resumeUpdateNeeded
            : diagnosis.resumeUpdateNeeded,
          resumeSuggestion: String(parsedDiagnosis.resumeSuggestion || diagnosis.resumeSuggestion).slice(0, 10_000)
        } : diagnosis,
        sessionSummary: parsed.sessionSummary && Array.isArray(parsed.sessionSummary.coreStrengths) ? {
          coreStrengths: parsed.sessionSummary.coreStrengths.map(String).slice(0, 5),
          highRiskGaps: Array.isArray(parsed.sessionSummary.highRiskGaps) ? parsed.sessionSummary.highRiskGaps.map(String).slice(0, 5) : [],
          practiceQuestions: Array.isArray(parsed.sessionSummary.practiceQuestions) ? parsed.sessionSummary.practiceQuestions.map(String).slice(0, 8) : [],
          resumeSuggestions: Array.isArray(parsed.sessionSummary.resumeSuggestions) ? parsed.sessionSummary.resumeSuggestions.map(String).slice(0, 8) : [],
          checklist: Array.isArray(parsed.sessionSummary.checklist) ? parsed.sessionSummary.checklist.map(String).slice(0, 10) : []
        } : undefined,
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
