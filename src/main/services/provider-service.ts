import { randomUUID } from 'node:crypto';
import type {
  CareerCompanionInput,
  CareerCompanionResult,
  CareerMemorySuggestion,
  ConnectionResult,
  DocumentImportTarget,
  ProviderConfig,
  ProviderInput,
  TrainingCoachInput,
  TrainingCoachResult
} from '../../shared/domain';
import { buildCareerContextOverview } from '../../shared/career-context';
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
      authMode: valid.authMode ?? 'api-key',
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
    const apiKey = config.authMode === 'none' ? '' : await this.secrets.get(SECRET_NAME);
    if (config.authMode !== 'none' && !apiKey) return { ok: false, message: '尚未保存 API Key' };
    return this.createProvider(config).testConnection(apiKey ?? '');
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const config = this.repository.getState().settings.provider;
    if (!config?.enabled) throw new Error('需要先在设置中启用 AI Provider');
    const apiKey = config.authMode === 'none' ? '' : await this.secrets.get(SECRET_NAME);
    if (config.authMode !== 'none' && !apiKey) throw new Error('需要先安全保存 API Key');
    return this.createProvider(config).complete(request, apiKey ?? '');
  }

  async careerCompanion(input: CareerCompanionInput): Promise<CareerCompanionResult> {
    const message = String(input?.message ?? '').trim().slice(0, 20_000);
    if (!message) throw new Error('请输入要和职业陪练讨论的内容');
    const state = this.repository.getState();
    const context = buildCareerContextOverview(state);
    const existing = state.coachSessions.find((item) => item.mode === 'career-companion' && item.pinned)
      ?? state.coachSessions.find((item) => item.mode === 'career-companion');
    const recentMessages = existing?.messages.slice(-16) ?? [];
    const config = state.settings.provider;
    const apiKey = config?.authMode === 'none' ? '' : await this.secrets.get(SECRET_NAME);
    let reply = this.localCareerReply(message, context);
    let memorySuggestions: CareerMemorySuggestion[] = [];
    let source: CareerCompanionResult['source'] = 'local';

    if (config?.enabled && (config.authMode === 'none' || apiKey)) {
      try {
        const response = await this.createProvider(config).complete({
          system: [
            '你是用户长期固定的职业陪练，帮助用户求职定位、复盘经历、准备简历和面试。',
            '只能使用提供的职业上下文和用户明确表达的事实，不得编造公司、项目、职责、数字或结果。',
            '先直接回答用户，再给出具体下一步。只有具备长期价值的新事实、偏好、反馈或决定才可提出记忆建议。',
            '返回严格 JSON，不要使用 Markdown 代码围栏。'
          ].join(''),
          prompt: [
            `职业总览：${JSON.stringify(context)}`,
            `最近会话：${JSON.stringify(recentMessages)}`,
            `用户消息：${message}`,
            '返回格式：{"reply":"给用户的回复","memorySuggestions":[{"type":"profile|preference|feedback|decision|note","content":"长期有效且不重复的事实","tags":["标签"],"evidenceIds":["相关证据ID"]}]}。',
            'memorySuggestions 最多 3 条；如果没有值得长期保存的内容，返回空数组。'
          ].join('\n')
        }, apiKey ?? '');
        const parsed = this.parseCareerCompanionResponse(response.text, new Set(context.evidence.map((item) => item.id)));
        reply = parsed.reply;
        memorySuggestions = parsed.memorySuggestions;
        source = 'ai';
      } catch (error) {
        const reason = error instanceof Error ? error.message : '未知错误';
        reply = `${reply}\n\n远程模型暂不可用：${reason}`;
      }
    }

    const now = new Date().toISOString();
    const session = await this.repository.update((draft) => {
      let target = draft.coachSessions.find((item) => item.mode === 'career-companion' && item.pinned)
        ?? draft.coachSessions.find((item) => item.mode === 'career-companion');
      if (!target) {
        target = {
          id: randomUUID(),
          mode: 'career-companion',
          title: '我的职业陪练',
          status: 'active',
          pinned: true,
          projectIds: [],
          messages: [],
          answers: [],
          createdAt: now,
          updatedAt: now
        };
        draft.coachSessions.unshift(target);
      }
      target.pinned = true;
      target.status = 'active';
      target.messages.push(
        { id: randomUUID(), role: 'user', content: message, createdAt: now },
        { id: randomUUID(), role: 'coach', content: reply, createdAt: now }
      );
      target.messages = target.messages.slice(-200);
      target.updatedAt = now;
      return target;
    });
    return { session, reply, memorySuggestions, source };
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
    const apiKey = config?.authMode === 'none' ? '' : await this.secrets.get(SECRET_NAME);
    if (!config?.enabled || (config.authMode !== 'none' && !apiKey)) return local;

    try {
      const response = await this.createProvider(config).complete({
        system: language === 'en-US'
          ? 'You are a strict HR and business interviewer for the target company and role. Ask one question at a time, dynamically follow up on the previous answer, expose vague or unsupported claims directly, never invent experience or metrics, translate supplied Chinese facts into natural English, ensure every user-visible string contains English only with no Chinese characters, and return strict JSON only.'
          : '你是目标公司和目标岗位最严格的 HR 与业务面试官。一次只追问一个问题，根据上一轮回答动态追问，直接指出含糊、夸大、证据不足和逻辑漏洞；不得编造经历或数据，只返回严格 JSON。',
        prompt: language === 'en-US'
          ? `Target company and role: ${JSON.stringify(job ? { company: job.company, title: job.title, jd: job.rawText } : null)}\nCandidate profile: ${JSON.stringify(state.profile)}\nVerified project evidence: ${JSON.stringify(project ?? null)}\nPrevious rounds (do not repeat answered questions): ${JSON.stringify(previousRounds)}\nCurrent round: ${round}/${session.maxRounds ?? session.questions.length}\nQuestion: ${currentQuestion.text}\nCandidate answer: ${answer || '(not answered yet)'}\nDiagnose: evidence gaps, logic/expression flaws, the strongest interviewer challenge, a STAR answer using only supplied facts, whether the resume should be updated, and one non-repeated follow-up. Translate supplied Chinese source facts into natural English without changing their meaning. The JSON values must contain English only and no Chinese characters. Unknown facts must be written as [CANDIDATE MUST ADD EVIDENCE]. If this is the final round, also include a sessionSummary with 3 strengths, 3 high-risk gaps, 5 practice questions, resume suggestions, and a final checklist. Return only JSON: {"feedback":"...","recommendedAnswer":"...","followUpQuestion":"...","diagnosis":{"evidenceGaps":["..."],"logicIssues":["..."],"interviewerChallenge":"...","starAnswer":"...","resumeUpdateNeeded":true,"resumeSuggestion":"..."},"sessionSummary":{"coreStrengths":[],"highRiskGaps":[],"practiceQuestions":[],"resumeSuggestions":[],"checklist":[]}}.`
          : `目标公司与岗位：${JSON.stringify(job ? { company: job.company, title: job.title, jd: job.rawText } : null)}\n候选人档案：${JSON.stringify(state.profile)}\n已核实项目证据：${JSON.stringify(project ?? null)}\n此前轮次（不得重复已经回答充分的问题）：${JSON.stringify(previousRounds)}\n当前轮次：${round}/${session.maxRounds ?? session.questions.length}\n当前问题：${currentQuestion.text}\n候选人回答：${answer || '（尚未回答）'}\n请依次诊断：证据不足、逻辑和表达漏洞、面试官最可能的质疑；仅根据已提供事实整理 STAR 回答；判断是否需要同步修改简历并给出具体建议；最后只生成一个不重复的动态追问。任何未知事实统一写“【需要本人补充】”。如果是最后一轮，同时输出 sessionSummary：核心竞争力 3 项、高风险漏洞 3 项、最需练习问题 5 个、简历修改建议和面试前清单。只返回 JSON：{"feedback":"...","recommendedAnswer":"...","followUpQuestion":"...","diagnosis":{"evidenceGaps":["..."],"logicIssues":["..."],"interviewerChallenge":"...","starAnswer":"...","resumeUpdateNeeded":true,"resumeSuggestion":"..."},"sessionSummary":{"coreStrengths":[],"highRiskGaps":[],"practiceQuestions":[],"resumeSuggestions":[],"checklist":[]}}。`
      }, apiKey ?? '');
      const jsonText = response.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonText) as Partial<TrainingCoachResult>;
      if (language === 'en-US' && /[\u3400-\u9fff]/u.test(JSON.stringify(parsed))) return local;
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
      const englishReason = /[\u3400-\u9fff]/u.test(reason) ? 'The provider request failed.' : reason;
      return {
        ...local,
        feedback: language === 'en-US'
          ? `The remote AI coach was unavailable, so local coaching was used. ${englishReason} ${local.feedback}`
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

  private localCareerReply(message: string, context: ReturnType<typeof buildCareerContextOverview>): string {
    const directions = context.targetRoles.length ? context.targetRoles.join('、') : '尚未明确目标岗位';
    const strengths = context.strengths.slice(0, 4).join('、') || '尚未整理核心能力';
    return `我已结合当前职业档案记录这次讨论。当前目标方向是${directions}，可优先使用的能力证据包括${strengths}。针对“${message.slice(0, 120)}”，请先补充一个具体目标岗位或真实经历，我会继续按面试官视角追问。要获得完整模型回复，请在设置中启用一个云端模型或本地 Ollama。`;
  }

  private parseCareerCompanionResponse(
    value: string,
    validEvidenceIds: Set<string>
  ): Pick<CareerCompanionResult, 'reply' | 'memorySuggestions'> {
    const clean = value.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '').trim();
    let parsed: { reply?: unknown; memorySuggestions?: unknown };
    try {
      parsed = JSON.parse(clean) as typeof parsed;
    } catch {
      return { reply: clean.slice(0, 20_000), memorySuggestions: [] };
    }
    const reply = String(parsed.reply ?? '').trim().slice(0, 20_000);
    if (!reply) throw new Error('模型没有返回有效职业陪练回复');
    const allowedTypes = new Set(['profile', 'preference', 'feedback', 'decision', 'note']);
    const memorySuggestions = (Array.isArray(parsed.memorySuggestions) ? parsed.memorySuggestions : [])
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        type: allowedTypes.has(String(item.type)) ? String(item.type) as CareerMemorySuggestion['type'] : 'note',
        content: String(item.content ?? '').trim().slice(0, 5_000),
        tags: Array.isArray(item.tags) ? [...new Set(item.tags.map(String).map((tag) => tag.trim()).filter(Boolean))].slice(0, 12) : [],
        evidenceIds: Array.isArray(item.evidenceIds)
          ? [...new Set(item.evidenceIds.map(String).filter((id) => validEvidenceIds.has(id)))].slice(0, 20)
          : []
      }))
      .filter((item) => item.content)
      .slice(0, 3);
    return { reply, memorySuggestions };
  }
}
