export type EntityId = string;
export type ISODateString = string;

export interface BaseEntity {
  id: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type SkillLevel = '了解' | '熟悉' | '掌握' | '精通';

export interface Skill {
  id: EntityId;
  name: string;
  level: SkillLevel;
}

export interface CareerProfile {
  nickname: string;
  currentRole: string;
  yearsExperience: number;
  education: string;
  targetRoles: string[];
  skills: Skill[];
  updatedAt: ISODateString;
}

export type KnowledgeType =
  | 'technical'
  | 'project'
  | 'incident'
  | 'question'
  | 'answer'
  | 'jd'
  | 'note';

export type KnowledgeStatus = 'draft' | 'learning' | 'mastered' | 'review';

export interface KnowledgeItem extends BaseEntity {
  type: KnowledgeType;
  title: string;
  contentMarkdown: string;
  tags: string[];
  status: KnowledgeStatus;
  source: string;
  relatedIds: EntityId[];
  reviewAt?: ISODateString;
}

export interface ProjectExperience extends BaseEntity {
  name: string;
  role: string;
  background: string;
  objective: string;
  architecture: string;
  responsibilities: string;
  actions: string;
  challenges: string;
  results: string;
  techStack: string[];
  relatedKnowledgeIds: EntityId[];
  pitch30: string;
  pitch90: string;
  deepDive: string;
}

export type RequirementPriority = 'must' | 'preferred' | 'context';
export type RequirementCategory = 'technology' | 'business' | 'experience' | 'soft-skill';
export type MatchStatus = 'evidenced' | 'related' | 'missing-evidence' | 'gap';

export interface JobRequirement {
  id: EntityId;
  label: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  matchStatus: MatchStatus;
  evidenceIds: EntityId[];
  evidenceSummary: string;
}

export interface PreparationTask {
  id: EntityId;
  title: string;
  bucket: 'now' | 'short-term' | 'before-interview' | 'later';
  completed: boolean;
}

export interface JobDescription extends BaseEntity {
  title: string;
  company: string;
  rawText: string;
  requirements: JobRequirement[];
  tasks: PreparationTask[];
}

export type InterviewQuestionType = 'project' | 'technical' | 'behavioral' | 'hr' | 'pressure';

export interface InterviewQuestion {
  id: EntityId;
  text: string;
  type: InterviewQuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  rationale: string;
  targetKeywords: string[];
  relatedIds: EntityId[];
}

export interface ScoreDimension {
  key: 'accuracy' | 'structure' | 'contribution' | 'jobMatch' | 'naturalness' | 'authenticity';
  label: string;
  score: number;
  evidence: string;
}

export interface AnswerAttempt extends BaseEntity {
  questionId: EntityId;
  answer: string;
  dimensions: ScoreDimension[];
  totalScore: number;
  feedback: string[];
  clarifyingQuestions: string[];
  isFinal: boolean;
}

export interface TrainingSession extends BaseEntity {
  jobId?: EntityId;
  projectId?: EntityId;
  title: string;
  status: 'active' | 'completed';
  questions: InterviewQuestion[];
  attempts: AnswerAttempt[];
  currentQuestionIndex: number;
}

export interface ProviderConfig {
  kind: 'openai-compatible' | 'dify';
  name: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  hasSecret: boolean;
}

export interface WorkspaceSettings {
  workspaceName: string;
  provider?: ProviderConfig;
  allowDiagnostics: boolean;
}

export interface WorkspaceState {
  schemaVersion: 1;
  profile: CareerProfile;
  projects: ProjectExperience[];
  knowledge: KnowledgeItem[];
  jobs: JobDescription[];
  trainingSessions: TrainingSession[];
  settings: WorkspaceSettings;
  updatedAt: ISODateString;
}

export interface KnowledgeInput {
  id?: EntityId;
  type: KnowledgeType;
  title: string;
  contentMarkdown: string;
  tags?: string[];
  status?: KnowledgeStatus;
  source?: string;
  relatedIds?: EntityId[];
  reviewAt?: ISODateString;
}

export interface ProfileInput {
  nickname: string;
  currentRole: string;
  yearsExperience: number;
  education: string;
  targetRoles: string[];
  skills: Array<{ name: string; level: SkillLevel }>;
}

export interface ProjectInput {
  id?: EntityId;
  name: string;
  role: string;
  background: string;
  objective?: string;
  architecture?: string;
  responsibilities: string;
  actions?: string;
  challenges?: string;
  results: string;
  techStack?: string[];
  relatedKnowledgeIds?: EntityId[];
  pitch30?: string;
  pitch90?: string;
  deepDive?: string;
}

export interface JobInput {
  title: string;
  company?: string;
  rawText: string;
}

export interface TrainingStartInput {
  jobId?: EntityId;
  projectId?: EntityId;
  type?: InterviewQuestionType | 'mixed';
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount?: number;
}

export interface TrainingAnswerInput {
  sessionId: EntityId;
  questionId: EntityId;
  answer: string;
}

export interface TrainingFinalizeInput extends TrainingAnswerInput {}

export interface ProviderInput {
  kind: ProviderConfig['kind'];
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  enabled: boolean;
}

export interface BackupInfo {
  path: string;
  createdAt: ISODateString;
  sha256: string;
}

export interface ExportInfo {
  path: string;
  files: number;
  createdAt: ISODateString;
}

export interface ConnectionResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export interface AppMeta {
  version: string;
  dataDirectory: string;
  platform: string;
  isPackaged: boolean;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNSUPPORTED_OPERATION'
  | 'INTERNAL_ERROR';

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };

export function nowIso(): ISODateString {
  return new Date().toISOString();
}

export function createEmptyState(): WorkspaceState {
  const now = nowIso();
  return {
    schemaVersion: 1,
    profile: {
      nickname: '',
      currentRole: '',
      yearsExperience: 0,
      education: '',
      targetRoles: [],
      skills: [],
      updatedAt: now
    },
    projects: [],
    knowledge: [],
    jobs: [],
    trainingSessions: [],
    settings: {
      workspaceName: '我的面试知识库',
      allowDiagnostics: false
    },
    updatedAt: now
  };
}

export function createDemoState(): WorkspaceState {
  const now = nowIso();
  const projectId = crypto.randomUUID();
  const knowledgeId = crypto.randomUUID();
  return {
    ...createEmptyState(),
    profile: {
      nickname: '演示用户',
      currentRole: '运维工程师',
      yearsExperience: 2,
      education: '本科',
      targetRoles: ['AI 大模型技术支持工程师', '云计算技术支持工程师'],
      skills: [
        { id: crypto.randomUUID(), name: 'Kubernetes', level: '熟悉' },
        { id: crypto.randomUUID(), name: '阿里云 ACK', level: '熟悉' },
        { id: crypto.randomUUID(), name: 'Docker', level: '熟悉' }
      ],
      updatedAt: now
    },
    projects: [
      {
        id: projectId,
        name: 'AI 漫剧算力平台',
        role: '平台运维',
        background: '公司使用画布软件生成图片和视频，算力平台统一转发上游大模型 API。',
        objective: '保障模型调用链路和平台版本稳定运行。',
        architecture: '画布 → 算力平台 → 大模型服务商；平台运行于阿里云 ACK。',
        responsibilities: '负责部署更新、Pod 状态检查、日志排查和 API 联调。',
        actions: '构建镜像并推送 ACR，更新 Deployment，验证 Service/Ingress 与模型 API。',
        challenges: '模型名称和上游模型 ID 映射不一致导致请求无法正确路由。',
        results: '协调第三方修复并完成版本上线。',
        techStack: ['ACK', 'Kubernetes', 'ACR', 'RDS', 'Docker', 'Nginx'],
        relatedKnowledgeIds: [knowledgeId],
        pitch30: '',
        pitch90: '',
        deepDive: '',
        createdAt: now,
        updatedAt: now
      }
    ],
    knowledge: [
      {
        id: knowledgeId,
        type: 'incident',
        title: '模型名称与上游 ID 映射异常',
        contentMarkdown: '通过平台日志、接口测试和内置测试功能对比，定位模型映射逻辑差异。',
        tags: ['大模型 API', '故障排查'],
        status: 'learning',
        source: '工作实践',
        relatedIds: [projectId],
        createdAt: now,
        updatedAt: now
      }
    ],
    updatedAt: now
  };
}
