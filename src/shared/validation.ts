import type {
  JobInput,
  KnowledgeInput,
  ProjectInput,
  ProviderInput,
  TrainingAnswerInput,
  TrainingFinalizeInput,
  TrainingStartInput,
  WorkspaceState
} from './domain';

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
  const allowedTypes = ['technical', 'project', 'incident', 'question', 'answer', 'jd', 'note'];
  const allowedStatus = ['draft', 'learning', 'mastered', 'review'];
  if (!input || !allowedTypes.includes(input.type)) throw new ValidationError('知识类型无效');
  if (input.status && !allowedStatus.includes(input.status)) throw new ValidationError('知识状态无效');
  return {
    ...input,
    id: input.id ? cleanText(input.id, 'ID', 80) : undefined,
    title: cleanText(input.title, '标题', 160),
    contentMarkdown: cleanText(input.contentMarkdown, '内容', 100_000),
    tags: cleanTags(input.tags),
    source: input.source ? cleanText(input.source, '来源', 200, false) : '',
    relatedIds: cleanTags(input.relatedIds)
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
    relatedKnowledgeIds: cleanTags(input.relatedKnowledgeIds),
    pitch30: cleanText(input.pitch30 ?? '', '30 秒版本', 5_000, false),
    pitch90: cleanText(input.pitch90 ?? '', '90 秒版本', 15_000, false),
    deepDive: cleanText(input.deepDive ?? '', '深入版本', 30_000, false)
  };
}

export function validateJobInput(input: JobInput): JobInput {
  if (!input) throw new ValidationError('JD 数据不能为空');
  return {
    title: cleanText(input.title, '岗位名称', 160),
    company: cleanText(input.company ?? '', '公司名称', 160, false),
    rawText: cleanText(input.rawText, 'JD 原文', 100_000)
  };
}

export function validateTrainingStartInput(input: TrainingStartInput): TrainingStartInput {
  const count = Math.max(1, Math.min(10, Number(input?.questionCount ?? 5)));
  return {
    jobId: input?.jobId ? cleanText(input.jobId, 'JD ID', 80) : undefined,
    projectId: input?.projectId ? cleanText(input.projectId, '项目 ID', 80) : undefined,
    type: input?.type ?? 'mixed',
    difficulty: input?.difficulty ?? 'medium',
    questionCount: count
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

export function validateWorkspaceState(value: unknown): WorkspaceState {
  if (!value || typeof value !== 'object') throw new ValidationError('工作区状态格式错误');
  const state = value as Partial<WorkspaceState>;
  if (state.schemaVersion !== 1) throw new ValidationError('不支持的工作区版本');
  if (!state.profile || !Array.isArray(state.projects) || !Array.isArray(state.knowledge)) {
    throw new ValidationError('工作区缺少必要数据');
  }
  if (!Array.isArray(state.jobs) || !Array.isArray(state.trainingSessions) || !state.settings) {
    throw new ValidationError('工作区数据不完整');
  }
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

