import type {
  CareerMemoryInput,
  CareerSearchPlanInput,
  CompanyWatchInput,
  JobAlertRuleInput,
  JobApplicationInput,
  JobFilterPresetInput,
  JobSyncBatchInput,
  JobInput,
  JobSourceCapability,
  JobSourceInput,
  KnowledgeInput,
  ObsidianEntityType,
  ObsidianIntegrationSettings,
  ObsidianIntegrationSettingsInput,
  ProjectInput,
  ProviderInput,
  ResumeVariantInput,
  TrainingAnswerInput,
  TrainingSession,
  CoachSession,
  TrainingCoachResult,
  TrainingFinalizeInput,
  TrainingStartInput,
  WorkspaceState
} from './domain';
import {
  createDefaultJobAlertRules,
  createDefaultJobFilterPresets,
  createDefaultJobSources,
  createDefaultObsidianSettings
} from './domain';
import { analyzeSyncedJob } from './job-intelligence';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function cleanText(value: unknown, field: string, maxLength = 20_000, required = true): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} 必须是文本`);
  }
  const cleaned = value.replace(/\0/g, '').trim();
  if (required && !cleaned) {
    throw new ValidationError(`${field} 不能为空`);
  }
  if (cleaned.length > maxLength) {
    throw new ValidationError(`${field} 不能超过 ${maxLength} 个字符`);
  }
  return cleaned;
}

export function cleanTags(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new ValidationError('标签必须是数组');
  return [...new Set(value.map((tag) => cleanText(tag, '标签', 40)).filter(Boolean))].slice(0, 30);
}

export function cleanEntityIds(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new ValidationError('关联 ID 必须是数组');
  return [...new Set(value.map((id) => cleanText(id, '关联 ID', 160)).filter(Boolean))].slice(0, 200);
}

export function validateHttpUrl(value: string, field = 'URL'): string {
  const cleaned = cleanText(value, field, 2_000);
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    throw new ValidationError(`${field} 格式不正确`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ValidationError(`${field} 只允许 HTTP 或 HTTPS`);
  }
  return url.toString().replace(/\/$/, '');
}

export function validateKnowledgeInput(input: KnowledgeInput): KnowledgeInput {
  const allowedTypes = [
    'technical', 'project', 'incident', 'question', 'answer', 'jd',
    'learning-plan', 'company-research', 'retrospective', 'note'
  ];
  const allowedStatus = ['draft', 'learning', 'mastered', 'review'];
  const allowedVisibility = ['private', 'publish-ready', 'public'];
  if (!input || !allowedTypes.includes(input.type)) throw new ValidationError('知识类型无效');
  if (input.status && !allowedStatus.includes(input.status)) throw new ValidationError('知识状态无效');
  if (input.visibility && !allowedVisibility.includes(input.visibility)) throw new ValidationError('知识可见性无效');
  return {
    ...input,
    id: input.id ? cleanText(input.id, 'ID', 80) : undefined,
    title: cleanText(input.title, '标题', 160),
    contentMarkdown: cleanText(input.contentMarkdown, '内容', 100_000),
    tags: cleanTags(input.tags),
    source: input.source ? cleanText(input.source, '来源', 200, false) : '',
    relatedIds: cleanEntityIds(input.relatedIds),
    jobIds: cleanEntityIds(input.jobIds),
    projectIds: cleanEntityIds(input.projectIds),
    skillNames: cleanTags(input.skillNames),
    visibility: input.visibility ?? 'private'
  };
}

function coachSessionFromTraining(session: TrainingSession): CoachSession {
  const messages: CoachSession['messages'] = [];
  for (const question of session.questions ?? []) {
    messages.push({
      id: `coach-question-${question.id}`,
      role: 'coach',
      content: question.text,
      createdAt: session.createdAt
    });
    for (const attempt of (session.attempts ?? []).filter((item) => item.questionId === question.id)) {
      messages.push({
        id: `coach-answer-${attempt.id}`,
        role: 'user',
        content: attempt.answer,
        createdAt: attempt.createdAt
      });
    }
  }
  return {
    id: `coach-${session.id}`,
    mode: session.language === 'en-US' ? 'english-interview' : 'mock-interview',
    title: session.title,
    status: session.status,
    targetJobId: session.jobId,
    projectIds: session.projectId ? [session.projectId] : [],
    messages,
    answers: session.attempts ?? [],
    report: session.summary,
    linkedTrainingSessionId: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

export function validateProjectInput(input: ProjectInput): ProjectInput {
  if (!input) throw new ValidationError('项目数据不能为空');
  return {
    ...input,
    id: input.id ? cleanText(input.id, 'ID', 80) : undefined,
    name: cleanText(input.name, '项目名称', 160),
    role: cleanText(input.role, '项目角色', 120),
    background: cleanText(input.background, '项目背景', 10_000),
    objective: cleanText(input.objective ?? '', '项目目标', 10_000, false),
    architecture: cleanText(input.architecture ?? '', '系统架构', 20_000, false),
    responsibilities: cleanText(input.responsibilities, '个人职责', 20_000),
    actions: cleanText(input.actions ?? '', '采取行动', 20_000, false),
    challenges: cleanText(input.challenges ?? '', '问题难点', 20_000, false),
    results: cleanText(input.results, '项目结果', 20_000),
    techStack: cleanTags(input.techStack),
    relatedKnowledgeIds: cleanEntityIds(input.relatedKnowledgeIds),
    pitch30: cleanText(input.pitch30 ?? '', '30 秒版本', 5_000, false),
    pitch90: cleanText(input.pitch90 ?? '', '90 秒版本', 15_000, false),
    deepDive: cleanText(input.deepDive ?? '', '深入版本', 30_000, false),
    interviewRevisionNotes: cleanText(input.interviewRevisionNotes ?? '', '面试校准记录', 50_000, false)
  };
}

export function validateJobInput(input: JobInput): JobInput {
  if (!input) throw new ValidationError('岗位数据不能为空');
  return {
    title: cleanText(input.title, '岗位名称', 160),
    company: cleanText(input.company ?? '', '公司名称', 160, false),
    rawText: cleanText(input.rawText, '岗位描述原文', 100_000)
  };
}

function cleanOptionalDate(value: unknown, field: string): string | undefined {
  if (value == null || value === '') return undefined;
  const cleaned = cleanText(value, field, 80);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`${field}格式无效`);
  return parsed.toISOString();
}

export function validateJobApplicationInput(input: JobApplicationInput): JobApplicationInput {
  const statuses = ['saved', 'preparing', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'];
  const priorities = ['high', 'medium', 'low'];
  const submissionModes = ['manual', 'assisted'];
  if (!input || typeof input !== 'object') throw new ValidationError('求职机会数据不能为空');
  if (input.status && !statuses.includes(input.status)) throw new ValidationError('投递状态无效');
  if (input.priority && !priorities.includes(input.priority)) throw new ValidationError('机会优先级无效');
  if (input.submissionMode && !submissionModes.includes(input.submissionMode)) throw new ValidationError('投递方式无效');
  const sourceUrl = input.sourceUrl ? validateHttpUrl(input.sourceUrl, '职位链接') : '';
  return {
    ...input,
    id: input.id ? cleanText(input.id, 'ID', 80) : undefined,
    jobId: input.jobId ? cleanText(input.jobId, '岗位 ID', 80) : undefined,
    resumeVariantId: input.resumeVariantId ? cleanText(input.resumeVariantId, '简历版本 ID', 80) : undefined,
    company: cleanText(input.company ?? '', '公司名称', 160, false),
    title: cleanText(input.title ?? '', '岗位名称', 160, false),
    source: cleanText(input.source ?? '', '职位来源', 120, false),
    sourceUrl,
    location: cleanText(input.location ?? '', '工作地点', 120, false),
    salaryRange: cleanText(input.salaryRange ?? '', '薪资范围', 120, false),
    status: input.status ?? 'saved',
    priority: input.priority ?? 'medium',
    deadline: cleanOptionalDate(input.deadline, '截止时间'),
    appliedAt: cleanOptionalDate(input.appliedAt, '投递时间'),
    nextAction: cleanText(input.nextAction ?? '', '下一步动作', 500, false),
    nextActionAt: cleanOptionalDate(input.nextActionAt, '下一步时间'),
    notes: cleanText(input.notes ?? '', '求职备注', 20_000, false),
    greetingDraft: cleanText(input.greetingDraft ?? '', '沟通话术', 5_000, false),
    submissionMode: input.submissionMode ?? 'manual'
  };
}

export function validateResumeVariantInput(input: ResumeVariantInput): ResumeVariantInput {
  if (!input || typeof input !== 'object') throw new ValidationError('简历版本数据不能为空');
  if (input.status && !['draft', 'ready', 'submitted'].includes(input.status)) throw new ValidationError('简历状态无效');
  return {
    ...input,
    id: input.id ? cleanText(input.id, 'ID', 80) : undefined,
    jobId: input.jobId ? cleanText(input.jobId, '岗位 ID', 80) : undefined,
    name: cleanText(input.name, '简历版本名称', 160),
    headline: cleanText(input.headline, '求职标题', 240),
    summary: cleanText(input.summary, '个人摘要', 10_000),
    highlights: cleanStringList(input.highlights, '简历亮点', 20),
    projectIds: cleanEntityIds(input.projectIds),
    skillIds: cleanEntityIds(input.skillIds),
    skillNames: cleanTags(input.skillNames),
    status: input.status ?? 'draft'
  };
}

export function validateJobSyncBatchInput(input: JobSyncBatchInput): JobSyncBatchInput {
  if (!input || typeof input !== 'object') throw new ValidationError('岗位同步数据不能为空');
  if (!Array.isArray(input.jobs)) throw new ValidationError('同步岗位必须是数组');
  return {
    token: cleanText(input.token, '同步令牌', 120),
    sourceSite: cleanText(input.sourceSite, '来源站点', 80),
    sourceName: cleanText(input.sourceName ?? input.sourceSite, '来源名称', 120),
    pageUrl: validateHttpUrl(input.pageUrl, '来源页面'),
    jobs: input.jobs.slice(0, 100).map((item) => ({
      externalId: item.externalId ? cleanText(item.externalId, '外部职位 ID', 240, false) : '',
      sourceUrl: validateHttpUrl(item.sourceUrl, '职位链接'),
      title: cleanText(item.title, '岗位名称', 240),
      company: cleanText(item.company ?? '', '公司名称', 200, false),
      location: cleanText(item.location ?? '', '工作地点', 160, false),
      salaryRange: cleanText(item.salaryRange ?? '', '薪资范围', 160, false),
      description: cleanText(item.description ?? '', '职位描述', 100_000, false),
      postedAt: cleanOptionalDate(item.postedAt, '发布时间')
    }))
  };
}

export function validateJobSourceInput(input: JobSourceInput): JobSourceInput {
  const connectorTypes = ['browser-extension', 'mcp', 'api', 'company-careers', 'scraper', 'import'];
  const statuses = ['ready', 'configured', 'planned', 'error'];
  const allowedCapabilities: JobSourceCapability[] = ['search', 'detail', 'change-tracking', 'company-check', 'apply-assist', 'push'];
  if (!input || !connectorTypes.includes(input.connectorType)) throw new ValidationError('连接器类型无效');
  if (input.status && !statuses.includes(input.status)) throw new ValidationError('数据源状态无效');
  const capabilities = (input.capabilities ?? []).filter((item): item is JobSourceCapability => allowedCapabilities.includes(item));
  const endpoint = cleanText(input.endpoint ?? '', '连接器地址', 500, false);
  const pseudoEndpointAllowed =
    (input.connectorType === 'browser-extension' && endpoint.startsWith('browser-extension://')) ||
    (input.connectorType === 'company-careers' && endpoint.startsWith('company-watches://'));
  return {
    ...input,
    id: input.id ? cleanText(input.id, '数据源 ID', 80) : undefined,
    name: cleanText(input.name, '数据源名称', 120),
    platform: cleanText(input.platform, '平台名称', 160),
    endpoint: endpoint && !pseudoEndpointAllowed ? validateHttpUrl(endpoint, '连接器地址') : endpoint,
    intervalMinutes: Math.max(0, Math.min(10_080, Number(input.intervalMinutes ?? 30))),
    capabilities: [...new Set(capabilities)],
    notes: cleanText(input.notes ?? '', '数据源说明', 2_000, false),
    enabled: Boolean(input.enabled),
    status: input.status ?? 'planned'
  };
}

function mergeDefaultJobSources(existingSources: WorkspaceState['jobSources'] | undefined): WorkspaceState['jobSources'] {
  const defaults = createDefaultJobSources();
  if (!Array.isArray(existingSources)) return defaults;
  const existingById = new Map(existingSources.map((source) => [source.id, source]));
  const mergedDefaults = defaults.map((source) => {
    const existing = existingById.get(source.id);
    if (!existing) return source;
    const shouldUpgradePlanned = existing.status === 'planned' && source.status !== 'planned';
    return {
      ...source,
      ...existing,
      status: shouldUpgradePlanned ? source.status : existing.status,
      enabled: shouldUpgradePlanned ? source.enabled : existing.enabled,
      endpoint: existing.endpoint || source.endpoint,
      intervalMinutes: existing.intervalMinutes ?? source.intervalMinutes,
      capabilities: existing.capabilities?.length ? existing.capabilities : source.capabilities,
      notes: existing.notes || source.notes,
      createdAt: existing.createdAt || source.createdAt,
      updatedAt: existing.updatedAt || source.updatedAt
    };
  });
  const defaultIds = new Set(defaults.map((source) => source.id));
  const customSources = existingSources.filter((source) => !defaultIds.has(source.id));
  return [...mergedDefaults, ...customSources];
}

function mergeDefaultJobFilterPresets(existingPresets: WorkspaceState['jobFilterPresets'] | undefined): WorkspaceState['jobFilterPresets'] {
  const defaults = createDefaultJobFilterPresets();
  if (!Array.isArray(existingPresets)) return defaults;
  return existingPresets;
}

function mergeDefaultJobAlertRules(existingRules: WorkspaceState['jobAlertRules'] | undefined): WorkspaceState['jobAlertRules'] {
  const defaults = createDefaultJobAlertRules();
  if (!Array.isArray(existingRules)) return defaults;
  return existingRules;
}

export function validateJobFilterPresetInput(input: JobFilterPresetInput): JobFilterPresetInput {
  const industries = ['technology', 'operations', 'product', 'design', 'sales', 'marketing', 'finance', 'human-resources', 'legal', 'healthcare', 'education', 'manufacturing', 'general'];
  if (!input || typeof input !== 'object') throw new ValidationError('筛选规则不能为空');
  return {
    ...input,
    id: input.id ? cleanText(input.id, '筛选规则 ID', 80) : undefined,
    name: cleanText(input.name, '筛选规则名称', 120),
    includeKeywords: cleanStringList(input.includeKeywords, '包含关键词', 30),
    excludeKeywords: cleanStringList(input.excludeKeywords, '排除关键词', 30),
    cities: cleanStringList(input.cities, '城市', 30),
    industries: (input.industries ?? []).filter((item) => industries.includes(item)),
    sources: cleanStringList(input.sources, '来源', 30),
    minSalaryK: input.minSalaryK == null ? undefined : Math.max(0, Math.min(1_000, Number(input.minSalaryK))),
    minMatchScore: Math.max(0, Math.min(100, Number(input.minMatchScore ?? 60))),
    minTrustScore: Math.max(0, Math.min(100, Number(input.minTrustScore ?? 70))),
    remoteOnly: Boolean(input.remoteOnly),
    freshWithinDays: Math.max(0, Math.min(365, Number(input.freshWithinDays ?? 30)))
  };
}

export function validateJobAlertRuleInput(input: JobAlertRuleInput): JobAlertRuleInput {
  const channels = ['in-app', 'webhook', 'email', 'feishu', 'wecom', 'dingtalk', 'telegram'];
  if (!input || typeof input !== 'object') throw new ValidationError('提醒规则不能为空');
  if (input.channel && !channels.includes(input.channel)) throw new ValidationError('提醒渠道无效');
  const target = cleanText(input.target ?? '', '提醒目标', 2_000, false);
  if (input.channel === 'webhook' && target) validateHttpUrl(target, 'Webhook 地址');
  return {
    ...input,
    id: input.id ? cleanText(input.id, '提醒规则 ID', 80) : undefined,
    name: cleanText(input.name, '提醒规则名称', 120),
    presetId: input.presetId ? cleanText(input.presetId, '筛选规则 ID', 80) : undefined,
    channel: input.channel ?? 'in-app',
    enabled: Boolean(input.enabled),
    threshold: Math.max(1, Math.min(100, Number(input.threshold ?? 1))),
    target
  };
}

export function validateCareerSearchPlanInput(input: CareerSearchPlanInput): CareerSearchPlanInput {
  if (!input || typeof input !== 'object') throw new ValidationError('求职搜索计划不能为空');
  const remotePreference = input.remotePreference ?? 'any';
  if (!['required', 'preferred', 'any'].includes(remotePreference)) throw new ValidationError('远程偏好无效');
  return {
    ...input,
    id: input.id ? cleanText(input.id, '搜索计划 ID', 80) : undefined,
    title: cleanText(input.title ?? '', '搜索计划名称', 160, false),
    goal: cleanText(input.goal, '求职目标', 5_000),
    cities: cleanStringList(input.cities, '目标城市', 30),
    keywords: cleanStringList(input.keywords, '搜索关键词', 50),
    excludeKeywords: cleanStringList(input.excludeKeywords, '排除关键词', 50),
    platforms: cleanStringList(input.platforms, '招聘平台', 30),
    jobTypes: cleanStringList(input.jobTypes, '岗位类型', 20),
    salaryMinK: input.salaryMinK == null ? undefined : Math.max(0, Math.min(1_000, Number(input.salaryMinK))),
    salaryMaxK: input.salaryMaxK == null ? undefined : Math.max(0, Math.min(1_000, Number(input.salaryMaxK))),
    remotePreference,
    hardConstraints: cleanStringList(input.hardConstraints, '硬性条件', 30),
    softPreferences: cleanStringList(input.softPreferences, '偏好条件', 30)
  };
}

export function validateCareerMemoryInput(input: CareerMemoryInput): CareerMemoryInput {
  const types = ['profile', 'preference', 'feedback', 'decision', 'note'];
  if (!input || typeof input !== 'object') throw new ValidationError('求职记忆不能为空');
  if (input.type && !types.includes(input.type)) throw new ValidationError('求职记忆类型无效');
  return {
    ...input,
    id: input.id ? cleanText(input.id, '记忆 ID', 80) : undefined,
    type: input.type ?? 'note',
    content: cleanText(input.content, '记忆内容', 5_000),
    tags: cleanTags(input.tags)
  };
}

export function validateCompanyWatchInput(input: CompanyWatchInput): CompanyWatchInput {
  if (!input || typeof input !== 'object') throw new ValidationError('公司关注信息不能为空');
  if (input.priority && !['focus', 'normal', 'backup'].includes(input.priority)) throw new ValidationError('公司优先级无效');
  if (input.status && !['watching', 'paused'].includes(input.status)) throw new ValidationError('公司关注状态无效');
  return {
    ...input,
    id: input.id ? cleanText(input.id, '公司 ID', 80) : undefined,
    name: cleanText(input.name, '公司名称', 160),
    industry: cleanText(input.industry ?? '', '公司行业', 120, false),
    careerUrl: input.careerUrl ? validateHttpUrl(input.careerUrl, '招聘官网') : '',
    priority: input.priority ?? 'normal',
    status: input.status ?? 'watching',
    recruitmentType: cleanText(input.recruitmentType ?? '', '招聘类型', 80, false),
    tags: cleanTags(input.tags),
    notes: cleanText(input.notes ?? '', '公司备注', 5_000, false),
    nextRecruitmentAt: cleanOptionalDate(input.nextRecruitmentAt, '招聘时间')
  };
}

export function validateTrainingStartInput(input: TrainingStartInput): TrainingStartInput {
  const count = Math.max(1, Math.min(10, Number(input?.questionCount ?? 5)));
  const language = input?.language ?? 'zh-CN';
  const mode = input?.mode ?? 'standard';
  if (!['zh-CN', 'en-US'].includes(language)) throw new ValidationError('训练语言无效');
  if (!['standard', 'pressure'].includes(mode)) throw new ValidationError('训练模式无效');
  const coachModes = ['mock-interview', 'project-deep-dive', 'technical-qa', 'resume-follow-up', 'jd-analysis', 'english-interview'];
  if (input?.coachMode && !coachModes.includes(input.coachMode)) throw new ValidationError('职业教练模式无效');
  return {
    jobId: input?.jobId ? cleanText(input.jobId, '岗位 ID', 80) : undefined,
    projectId: input?.projectId ? cleanText(input.projectId, '项目 ID', 80) : undefined,
    projectIds: cleanEntityIds(input?.projectIds),
    resumeId: input?.resumeId ? cleanText(input.resumeId, '简历 ID', 80) : undefined,
    coachMode: input?.coachMode ?? (language === 'en-US' ? 'english-interview' : 'mock-interview'),
    type: input?.type ?? 'mixed',
    difficulty: input?.difficulty ?? 'medium',
    questionCount: count,
    language,
    mode,
    maxRounds: Math.max(2, Math.min(8, Number(input?.maxRounds ?? 8)))
  };
}

export function validateTrainingAnswerInput(
  input: TrainingAnswerInput | TrainingFinalizeInput
): TrainingAnswerInput {
  if (!input) throw new ValidationError('回答数据不能为空');
  return {
    sessionId: cleanText(input.sessionId, '会话 ID', 80),
    questionId: cleanText(input.questionId, '问题 ID', 80),
    answer: cleanText(input.answer, '回答', 30_000)
  };
}

function cleanStringList(value: unknown, field: string, limit: number): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`${field}必须是数组`);
  return value.map((item) => cleanText(item, field, 2_000)).filter(Boolean).slice(0, limit);
}

function validateCoachResult(value: TrainingCoachResult | undefined): TrainingCoachResult | undefined {
  if (!value) return undefined;
  if (!['ai', 'local'].includes(value.source)) throw new ValidationError('陪练来源无效');
  const diagnosis = value.diagnosis;
  if (!diagnosis || typeof diagnosis !== 'object') throw new ValidationError('陪练诊断无效');
  const summary = value.sessionSummary;
  return {
    feedback: cleanText(value.feedback, '教练反馈', 10_000),
    recommendedAnswer: cleanText(value.recommendedAnswer, '推荐回答', 20_000),
    followUpQuestion: cleanText(value.followUpQuestion, '追问', 5_000),
    diagnosis: {
      evidenceGaps: cleanStringList(diagnosis.evidenceGaps, '证据缺口', 10),
      logicIssues: cleanStringList(diagnosis.logicIssues, '逻辑问题', 10),
      interviewerChallenge: cleanText(diagnosis.interviewerChallenge, '面试官质疑', 5_000),
      starAnswer: cleanText(diagnosis.starAnswer, 'STAR 回答', 20_000),
      resumeUpdateNeeded: Boolean(diagnosis.resumeUpdateNeeded),
      resumeSuggestion: cleanText(diagnosis.resumeSuggestion, '简历修改建议', 10_000, false)
    },
    sessionSummary: summary ? {
      coreStrengths: cleanStringList(summary.coreStrengths, '核心竞争力', 5),
      highRiskGaps: cleanStringList(summary.highRiskGaps, '高风险漏洞', 5),
      practiceQuestions: cleanStringList(summary.practiceQuestions, '练习问题', 8),
      resumeSuggestions: cleanStringList(summary.resumeSuggestions, '简历建议', 8),
      checklist: cleanStringList(summary.checklist, '面试清单', 10)
    } : undefined,
    source: value.source
  };
}

export function validateTrainingFinalizeInput(input: TrainingFinalizeInput): TrainingFinalizeInput {
  const answer = validateTrainingAnswerInput(input);
  return { ...answer, coach: validateCoachResult(input.coach) };
}

export function validateProviderInput(input: ProviderInput): ProviderInput {
  if (!input || !['openai-compatible', 'dify'].includes(input.kind)) {
    throw new ValidationError('Provider 类型无效');
  }
  return {
    kind: input.kind,
    name: cleanText(input.name, 'Provider 名称', 100),
    baseUrl: validateHttpUrl(input.baseUrl, 'Base URL'),
    model: cleanText(input.model, '模型名称', 160, input.kind === 'openai-compatible'),
    apiKey: input.apiKey ? cleanText(input.apiKey, 'API Key', 10_000) : undefined,
    enabled: Boolean(input.enabled)
  };
}

export function cleanVaultRelativePath(value: unknown, field: string): string {
  const cleaned = cleanText(value, field, 240).replace(/\\/g, '/').replace(/\/+$/g, '');
  if (/^(?:[a-zA-Z]:|\/)/.test(cleaned)) throw new ValidationError(`${field}必须是 Vault 内的相对路径`);
  const segments = cleaned.split('/').filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === '..' || segment === '.' || segment === '.obsidian')) {
    throw new ValidationError(`${field}包含不允许的目录`);
  }
  return segments.join('/');
}

export function validateObsidianSettingsInput(
  input: ObsidianIntegrationSettingsInput,
  current: ObsidianIntegrationSettings = createDefaultObsidianSettings()
): ObsidianIntegrationSettings {
  if (!input || typeof input !== 'object') throw new ValidationError('Obsidian 配置不能为空');
  const modes = ['disabled', 'existing-vault', 'dedicated-vault'];
  const directions = ['bidirectional', 'export-only', 'import-only'];
  const allowedTypes: ObsidianEntityType[] = [
    'project', 'incident', 'technical-knowledge', 'interview-question', 'interview-answer',
    'jd-analysis', 'learning-plan', 'company-research', 'retrospective', 'resume-metadata'
  ];
  const mode = input.mode ?? current.mode;
  const syncDirection = input.syncDirection ?? current.syncDirection;
  if (!modes.includes(mode)) throw new ValidationError('Obsidian 集成模式无效');
  if (!directions.includes(syncDirection)) throw new ValidationError('Obsidian 同步方向无效');
  const defaults = createDefaultObsidianSettings();
  const folderMapping = { ...defaults.folderMapping, ...current.folderMapping, ...input.folderMapping };
  for (const [key, value] of Object.entries(folderMapping)) {
    folderMapping[key as keyof typeof folderMapping] = cleanVaultRelativePath(value, `目录映射 ${key}`);
  }
  const enabledEntityTypes = [...new Set(input.enabledEntityTypes ?? current.enabledEntityTypes)]
    .filter((value): value is ObsidianEntityType => allowedTypes.includes(value));
  return {
    enabled: Boolean(input.enabled ?? current.enabled),
    vaultPath: input.vaultPath === undefined
      ? current.vaultPath
      : input.vaultPath == null || input.vaultPath === '' ? null : cleanText(input.vaultPath, 'Vault 路径', 2_000),
    workspaceSubdirectory: cleanVaultRelativePath(
      input.workspaceSubdirectory ?? current.workspaceSubdirectory,
      '工作子目录'
    ),
    mode,
    syncDirection,
    autoSync: Boolean(input.autoSync ?? current.autoSync),
    scanOnStartup: Boolean(input.scanOnStartup ?? current.scanOnStartup),
    syncIntervalSeconds: Math.max(30, Math.min(86_400, Number(input.syncIntervalSeconds ?? current.syncIntervalSeconds))),
    attachmentDirectory: cleanVaultRelativePath(
      input.attachmentDirectory ?? current.attachmentDirectory,
      '附件目录'
    ),
    folderMapping,
    enabledEntityTypes,
    syncFullResume: Boolean(input.syncFullResume ?? current.syncFullResume)
  };
}

export function migrateWorkspaceState(value: unknown): WorkspaceState {
  if (!value || typeof value !== 'object') throw new ValidationError('工作区状态格式错误');
  const state = value as Record<string, unknown>;
  const version = Number(state.schemaVersion ?? 1);
  if (![1, 2, 3].includes(version)) throw new ValidationError('不支持的工作区版本');
  const settings = state.settings as Record<string, unknown> | undefined;
  if (settings) {
    const currentObsidian = settings.obsidian as ObsidianIntegrationSettings | undefined;
    settings.obsidian = validateObsidianSettingsInput(currentObsidian ?? {}, createDefaultObsidianSettings());
  }
  state.obsidianSyncIndex = Array.isArray(state.obsidianSyncIndex) ? state.obsidianSyncIndex : [];
  state.obsidianSyncConflicts = Array.isArray(state.obsidianSyncConflicts) ? state.obsidianSyncConflicts : [];
  state.obsidianSyncRuns = Array.isArray(state.obsidianSyncRuns) ? state.obsidianSyncRuns : [];
  const knowledge = Array.isArray(state.knowledge) ? state.knowledge as Array<Record<string, unknown>> : [];
  for (const item of knowledge) {
    item.relatedIds = Array.isArray(item.relatedIds) ? item.relatedIds : [];
    item.jobIds = Array.isArray(item.jobIds) ? item.jobIds : [];
    item.projectIds = Array.isArray(item.projectIds) ? item.projectIds : [];
    item.skillNames = Array.isArray(item.skillNames) ? item.skillNames : [];
    item.visibility = ['private', 'publish-ready', 'public'].includes(String(item.visibility)) ? item.visibility : 'private';
  }
  const trainingSessions = Array.isArray(state.trainingSessions) ? state.trainingSessions as TrainingSession[] : [];
  state.coachSessions = Array.isArray(state.coachSessions)
    ? state.coachSessions
    : trainingSessions.map(coachSessionFromTraining);
  const migrationHistory = Array.isArray(state.migrationHistory) ? state.migrationHistory as Array<Record<string, unknown>> : [];
  if (version < 3 && !migrationHistory.some((item) => Number(item.fromVersion) === version && Number(item.toVersion) === 3)) {
    migrationHistory.unshift({
      id: `migration-${version}-3-${Date.now()}`,
      fromVersion: version,
      toVersion: 3,
      migratedAt: new Date().toISOString()
    });
  }
  state.migrationHistory = migrationHistory;
  state.schemaVersion = 3;
  return state as unknown as WorkspaceState;
}

export function validateWorkspaceState(value: unknown): WorkspaceState {
  const state = migrateWorkspaceState(value) as Partial<WorkspaceState>;
  if (state.schemaVersion !== 3) throw new ValidationError('不支持的工作区版本');
  if (!state.profile || !Array.isArray(state.projects) || !Array.isArray(state.knowledge)) {
    throw new ValidationError('工作区缺少必要数据');
  }
  if (!Array.isArray(state.jobs) || !Array.isArray(state.trainingSessions) || !state.settings) {
    throw new ValidationError('工作区数据不完整');
  }
  if (!Array.isArray(state.applications)) state.applications = [];
  for (const application of state.applications) {
    application.greetingDraft ??= '';
    application.submissionMode ??= 'manual';
  }
  if (!Array.isArray(state.resumeVariants)) state.resumeVariants = [];
  for (const resume of state.resumeVariants) {
    resume.skillNames = Array.isArray(resume.skillNames) ? resume.skillNames : [];
  }
  if (!Array.isArray(state.syncedJobs)) state.syncedJobs = [];
  for (const job of state.syncedJobs) {
    const intelligence = analyzeSyncedJob(job, state.profile);
    job.industry ??= intelligence.industry;
    job.employmentType ??= intelligence.employmentType;
    job.education ??= intelligence.education;
    job.experience ??= intelligence.experience;
    job.skills ??= intelligence.skills;
    job.salaryMinK ??= intelligence.salaryMinK;
    job.salaryMaxK ??= intelligence.salaryMaxK;
    job.remote ??= intelligence.remote;
    job.matchScore ??= intelligence.matchScore;
    job.matchDimensions ??= intelligence.matchDimensions;
    job.matchReasons ??= intelligence.matchReasons;
    job.trustScore ??= intelligence.trustScore;
    job.riskFlags ??= intelligence.riskFlags;
    job.biasFlags ??= intelligence.biasFlags;
    job.qualityScore ??= intelligence.qualityScore;
    job.lifecycleStatus ??= 'active';
  }
  state.jobSources = mergeDefaultJobSources(state.jobSources);
  if (!Array.isArray(state.jobSyncRuns)) state.jobSyncRuns = [];
  state.jobFilterPresets = mergeDefaultJobFilterPresets(state.jobFilterPresets);
  state.jobAlertRules = mergeDefaultJobAlertRules(state.jobAlertRules);
  if (!Array.isArray(state.careerSearchPlans)) state.careerSearchPlans = [];
  if (!Array.isArray(state.careerAgentRuns)) state.careerAgentRuns = [];
  if (!Array.isArray(state.careerMemory)) state.careerMemory = [];
  if (!Array.isArray(state.companyWatches)) state.companyWatches = [];
  if (!Array.isArray(state.coachSessions)) state.coachSessions = [];
  if (!Array.isArray(state.migrationHistory)) state.migrationHistory = [];
  if (!Array.isArray(state.obsidianSyncIndex)) state.obsidianSyncIndex = [];
  if (!Array.isArray(state.obsidianSyncConflicts)) state.obsidianSyncConflicts = [];
  if (!Array.isArray(state.obsidianSyncRuns)) state.obsidianSyncRuns = [];
  if (!state.settings.jobSyncToken) state.settings.jobSyncToken = crypto.randomUUID();
  state.settings.obsidian = validateObsidianSettingsInput(
    state.settings.obsidian ?? {},
    createDefaultObsidianSettings()
  );
  return state as WorkspaceState;
}

export function safeFileName(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\.\.+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return (normalized || 'untitled').slice(0, 100);
}
