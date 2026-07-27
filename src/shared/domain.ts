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
  | 'learning-plan'
  | 'company-research'
  | 'retrospective'
  | 'note';

export type KnowledgeStatus = 'draft' | 'learning' | 'mastered' | 'review';
export type KnowledgeVisibility = 'private' | 'publish-ready' | 'public';

export interface KnowledgeItem extends BaseEntity {
  type: KnowledgeType;
  title: string;
  contentMarkdown: string;
  tags: string[];
  status: KnowledgeStatus;
  source: string;
  relatedIds: EntityId[];
  jobIds: EntityId[];
  projectIds: EntityId[];
  skillNames: string[];
  visibility: KnowledgeVisibility;
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
  interviewRevisionNotes?: string;
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

export type ApplicationStatus =
  | 'saved'
  | 'preparing'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export type ApplicationPriority = 'high' | 'medium' | 'low';
export type ApplicationSubmissionMode = 'manual' | 'assisted';

export interface ApplicationStatusEvent {
  id: EntityId;
  status: ApplicationStatus;
  note: string;
  occurredAt: ISODateString;
}

export interface JobApplication extends BaseEntity {
  jobId?: EntityId;
  resumeVariantId?: EntityId;
  company: string;
  title: string;
  source: string;
  sourceUrl: string;
  location: string;
  salaryRange: string;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  deadline?: ISODateString;
  appliedAt?: ISODateString;
  nextAction: string;
  nextActionAt?: ISODateString;
  notes: string;
  greetingDraft: string;
  submissionMode: ApplicationSubmissionMode;
  statusHistory: ApplicationStatusEvent[];
}

export interface JobApplicationInput {
  id?: EntityId;
  jobId?: EntityId;
  resumeVariantId?: EntityId;
  company?: string;
  title?: string;
  source?: string;
  sourceUrl?: string;
  location?: string;
  salaryRange?: string;
  status?: ApplicationStatus;
  priority?: ApplicationPriority;
  deadline?: ISODateString;
  appliedAt?: ISODateString;
  nextAction?: string;
  nextActionAt?: ISODateString;
  notes?: string;
  greetingDraft?: string;
  submissionMode?: ApplicationSubmissionMode;
}

export type ResumeVariantStatus = 'draft' | 'ready' | 'submitted';

export interface ResumeVariant extends BaseEntity {
  name: string;
  jobId?: EntityId;
  headline: string;
  summary: string;
  highlights: string[];
  projectIds: EntityId[];
  skillIds: EntityId[];
  targetKeywords: string[];
  matchScore: number;
  status: ResumeVariantStatus;
  version: number;
}

export interface ResumeVariantInput {
  id?: EntityId;
  name: string;
  jobId?: EntityId;
  headline: string;
  summary: string;
  highlights?: string[];
  projectIds?: EntityId[];
  skillIds?: EntityId[];
  status?: ResumeVariantStatus;
}

export type SyncedJobStatus = 'new' | 'saved' | 'ignored' | 'trashed';
export type JobLifecycleStatus = 'new' | 'active' | 'changed' | 'closed';
export type JobIndustry =
  | 'technology'
  | 'operations'
  | 'product'
  | 'design'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'human-resources'
  | 'legal'
  | 'healthcare'
  | 'education'
  | 'manufacturing'
  | 'general';

export interface SyncedJob extends BaseEntity {
  externalId: string;
  fingerprint: string;
  sourceSite: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  company: string;
  location: string;
  salaryRange: string;
  description: string;
  industry: JobIndustry;
  employmentType: string;
  education: string;
  experience: string;
  skills: string[];
  salaryMinK?: number;
  salaryMaxK?: number;
  remote: boolean;
  matchScore: number;
  matchDimensions: JobMatchDimensions;
  matchReasons: string[];
  trustScore: number;
  riskFlags: string[];
  biasFlags: string[];
  qualityScore: number;
  lifecycleStatus: JobLifecycleStatus;
  postedAt?: ISODateString;
  capturedAt: ISODateString;
  lastSeenAt: ISODateString;
  seenCount: number;
  status: SyncedJobStatus;
  linkedJobId?: EntityId;
}

export interface SyncedJobInput {
  externalId?: string;
  sourceUrl: string;
  title: string;
  company?: string;
  location?: string;
  salaryRange?: string;
  description?: string;
  postedAt?: ISODateString;
}

export interface JobSyncBatchInput {
  token: string;
  sourceSite: string;
  sourceName?: string;
  pageUrl: string;
  jobs: SyncedJobInput[];
}

export interface JobSyncBridgeStatus {
  running: boolean;
  port: number;
  lastBatchAt?: ISODateString;
  lastError?: string;
}

export type JobConnectorType = 'browser-extension' | 'mcp' | 'api' | 'company-careers' | 'scraper' | 'import';
export type JobSourceStatus = 'ready' | 'configured' | 'planned' | 'error';
export type JobSourceCapability = 'search' | 'detail' | 'change-tracking' | 'company-check' | 'apply-assist' | 'push';

export interface JobSourceConfig extends BaseEntity {
  name: string;
  platform: string;
  connectorType: JobConnectorType;
  status: JobSourceStatus;
  enabled: boolean;
  endpoint: string;
  intervalMinutes: number;
  capabilities: JobSourceCapability[];
  notes: string;
  lastSyncAt?: ISODateString;
  lastError?: string;
}

export interface JobSourceInput {
  id?: EntityId;
  name: string;
  platform: string;
  connectorType: JobConnectorType;
  status?: JobSourceStatus;
  enabled?: boolean;
  endpoint?: string;
  intervalMinutes?: number;
  capabilities?: JobSourceCapability[];
  notes?: string;
}

export interface JobFilterPreset extends BaseEntity {
  name: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  cities: string[];
  industries: JobIndustry[];
  sources: string[];
  minSalaryK?: number;
  minMatchScore: number;
  minTrustScore: number;
  remoteOnly: boolean;
  freshWithinDays: number;
}

export interface JobFilterPresetInput {
  id?: EntityId;
  name: string;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  cities?: string[];
  industries?: JobIndustry[];
  sources?: string[];
  minSalaryK?: number;
  minMatchScore?: number;
  minTrustScore?: number;
  remoteOnly?: boolean;
  freshWithinDays?: number;
}

export type JobAlertChannel = 'in-app' | 'webhook' | 'email' | 'feishu' | 'wecom' | 'dingtalk' | 'telegram';

export interface JobAlertRule extends BaseEntity {
  name: string;
  presetId?: EntityId;
  channel: JobAlertChannel;
  enabled: boolean;
  threshold: number;
  target: string;
}

export interface JobAlertRuleInput {
  id?: EntityId;
  name: string;
  presetId?: EntityId;
  channel?: JobAlertChannel;
  enabled?: boolean;
  threshold?: number;
  target?: string;
}

export type JobSyncRunStatus = 'success' | 'warning' | 'failed' | 'dry-run';

export interface JobSyncRun extends BaseEntity {
  sourceId: EntityId;
  sourceName: string;
  status: JobSyncRunStatus;
  fetched: number;
  added: number;
  updated: number;
  durationMs: number;
  message: string;
}

export interface JobMatchDimensions {
  role: number;
  skills: number;
  experience: number;
  education: number;
  location: number;
  salary: number;
  freshness: number;
}

export type CareerSearchRunStatus = 'planned' | 'completed' | 'failed';

export interface CareerSearchPlan extends BaseEntity {
  title: string;
  goal: string;
  cities: string[];
  keywords: string[];
  excludeKeywords: string[];
  platforms: string[];
  jobTypes: string[];
  salaryMinK?: number;
  salaryMaxK?: number;
  remotePreference: 'required' | 'preferred' | 'any';
  hardConstraints: string[];
  softPreferences: string[];
}

export interface CareerSearchPlanInput {
  id?: EntityId;
  title?: string;
  goal: string;
  cities?: string[];
  keywords?: string[];
  excludeKeywords?: string[];
  platforms?: string[];
  jobTypes?: string[];
  salaryMinK?: number;
  salaryMaxK?: number;
  remotePreference?: CareerSearchPlan['remotePreference'];
  hardConstraints?: string[];
  softPreferences?: string[];
}

export interface CareerAgentStep {
  id: EntityId;
  label: string;
  status: 'pending' | 'completed' | 'warning';
  message: string;
}

export interface CareerAgentRun extends BaseEntity {
  planId: EntityId;
  title: string;
  status: CareerSearchRunStatus;
  steps: CareerAgentStep[];
  matchedJobIds: EntityId[];
  summary: string;
}

export type CareerMemoryType = 'profile' | 'preference' | 'feedback' | 'decision' | 'note';

export interface CareerMemoryItem extends BaseEntity {
  type: CareerMemoryType;
  content: string;
  tags: string[];
  sourceSessionId?: EntityId;
  evidenceIds?: EntityId[];
}

export interface CareerMemoryInput {
  id?: EntityId;
  type?: CareerMemoryType;
  content: string;
  tags?: string[];
  sourceSessionId?: EntityId;
  evidenceIds?: EntityId[];
}

export interface CareerContextEvidence {
  id: EntityId;
  kind: 'project' | 'knowledge' | 'resume' | 'training';
  title: string;
  summary: string;
}

export interface CareerContextOverview {
  generatedAt: ISODateString;
  headline: string;
  targetRoles: string[];
  strengths: string[];
  preferences: string[];
  gaps: string[];
  evidence: CareerContextEvidence[];
  counts: {
    projects: number;
    knowledge: number;
    resumes: number;
    trainingSessions: number;
    memories: number;
  };
}

export type CompanyWatchStatus = 'watching' | 'paused';
export type CompanyPriority = 'focus' | 'normal' | 'backup';

export interface CompanyWatch extends BaseEntity {
  name: string;
  industry: string;
  careerUrl: string;
  priority: CompanyPriority;
  status: CompanyWatchStatus;
  recruitmentType: string;
  tags: string[];
  notes: string;
  nextRecruitmentAt?: ISODateString;
  lastCheckedAt?: ISODateString;
  openJobs: number;
  newJobs: number;
  changedJobs: number;
}

export interface CompanyWatchInput {
  id?: EntityId;
  name: string;
  industry?: string;
  careerUrl?: string;
  priority?: CompanyPriority;
  status?: CompanyWatchStatus;
  recruitmentType?: string;
  tags?: string[];
  notes?: string;
  nextRecruitmentAt?: ISODateString;
}

export type InterviewQuestionType = 'project' | 'technical' | 'behavioral' | 'hr' | 'pressure';
export type TrainingLanguage = 'zh-CN' | 'en-US';
export type TrainingMode = 'standard' | 'pressure';

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
  diagnosis?: InterviewDiagnosis;
}

export interface InterviewDiagnosis {
  evidenceGaps: string[];
  logicIssues: string[];
  interviewerChallenge: string;
  starAnswer: string;
  resumeUpdateNeeded: boolean;
  resumeSuggestion: string;
}

export interface PressureSessionSummary {
  coreStrengths: string[];
  highRiskGaps: string[];
  practiceQuestions: string[];
  resumeSuggestions: string[];
  checklist: string[];
}

export interface TrainingSession extends BaseEntity {
  jobId?: EntityId;
  projectId?: EntityId;
  title: string;
  status: 'active' | 'completed';
  questions: InterviewQuestion[];
  attempts: AnswerAttempt[];
  currentQuestionIndex: number;
  language?: TrainingLanguage;
  mode?: TrainingMode;
  maxRounds?: number;
  summary?: PressureSessionSummary;
}

export type CoachMode =
  | 'mock-interview'
  | 'project-deep-dive'
  | 'technical-qa'
  | 'resume-follow-up'
  | 'jd-analysis'
  | 'english-interview'
  | 'career-companion';

export interface CoachMessage {
  id: EntityId;
  role: 'system' | 'coach' | 'user';
  content: string;
  createdAt: ISODateString;
}

export interface CoachSession extends BaseEntity {
  mode: CoachMode;
  title: string;
  status: 'active' | 'completed';
  pinned?: boolean;
  targetJobId?: EntityId;
  resumeId?: EntityId;
  projectIds: EntityId[];
  messages: CoachMessage[];
  answers: AnswerAttempt[];
  report?: PressureSessionSummary;
  linkedTrainingSessionId?: EntityId;
}

export interface WorkspaceMigrationRecord {
  id: EntityId;
  fromVersion: number;
  toVersion: number;
  migratedAt: ISODateString;
}

export interface ProviderConfig {
  kind: 'openai-compatible' | 'dify';
  name: string;
  baseUrl: string;
  model: string;
  authMode?: 'api-key' | 'none';
  enabled: boolean;
  hasSecret: boolean;
}

export type ObsidianIntegrationMode = 'disabled' | 'existing-vault' | 'dedicated-vault';
export type ObsidianSyncDirection = 'bidirectional' | 'export-only' | 'import-only';
export type ObsidianEntityType =
  | 'project'
  | 'incident'
  | 'technical-knowledge'
  | 'interview-question'
  | 'interview-answer'
  | 'jd-analysis'
  | 'learning-plan'
  | 'company-research'
  | 'retrospective'
  | 'resume-metadata';

export interface ObsidianFolderMapping {
  inbox: string;
  profile: string;
  targetJobs: string;
  projects: string;
  incidents: string;
  technicalKnowledge: string;
  interviewQuestions: string;
  expressionTraining: string;
  jdAnalysis: string;
  resumes: string;
  learningPlans: string;
  companyResearch: string;
  retrospectives: string;
  attachments: string;
  archive: string;
  templates: string;
}

export interface ObsidianIntegrationSettings {
  enabled: boolean;
  vaultPath: string | null;
  workspaceSubdirectory: string;
  mode: ObsidianIntegrationMode;
  syncDirection: ObsidianSyncDirection;
  autoSync: boolean;
  scanOnStartup: boolean;
  syncIntervalSeconds: number;
  attachmentDirectory: string;
  folderMapping: ObsidianFolderMapping;
  enabledEntityTypes: ObsidianEntityType[];
  syncFullResume: boolean;
}

export interface ObsidianIntegrationSettingsInput
  extends Partial<Omit<ObsidianIntegrationSettings, 'folderMapping'>> {
  folderMapping?: Partial<ObsidianFolderMapping>;
}

export type ObsidianSyncStatus =
  | 'synced'
  | 'workspace-newer'
  | 'vault-newer'
  | 'conflict'
  | 'missing'
  | 'ignored'
  | 'error';

export interface ObsidianSyncIndexEntry {
  entityId: EntityId;
  entityType: ObsidianEntityType;
  title: string;
  filePath: string;
  fileHash: string;
  workspaceVersion: number;
  vaultVersion: number;
  lastWorkspaceModifiedAt: ISODateString;
  lastVaultModifiedAt: ISODateString;
  lastSyncedAt: ISODateString;
  syncStatus: ObsidianSyncStatus;
}

export type ObsidianConflictResolution =
  | 'pending'
  | 'keep-workspace'
  | 'keep-vault'
  | 'merged'
  | 'duplicated'
  | 'ignored';

export interface ObsidianSyncConflict {
  id: EntityId;
  entityId: EntityId;
  entityType: ObsidianEntityType;
  filePath: string;
  workspaceContent: string;
  vaultContent: string;
  detectedAt: ISODateString;
  resolution: ObsidianConflictResolution;
}

export interface ObsidianSyncError {
  code: string;
  message: string;
  entityId?: EntityId;
  filePath?: string;
}

export interface ObsidianSyncRun {
  id: EntityId;
  startedAt: ISODateString;
  completedAt: ISODateString | null;
  trigger: 'manual' | 'startup' | 'watcher' | 'scheduled';
  scanned: number;
  created: number;
  updated: number;
  imported: number;
  conflicts: number;
  skipped: number;
  failed: number;
  errors: ObsidianSyncError[];
}

export interface ObsidianSyncPreviewItem {
  entityId: EntityId;
  entityType: ObsidianEntityType;
  title: string;
  filePath: string;
  action: 'create' | 'update' | 'conflict' | 'skip';
  reason: string;
}

export interface ObsidianSyncPreview {
  vaultPath: string;
  items: ObsidianSyncPreviewItem[];
}

export interface ObsidianIntegrationStatus {
  enabled: boolean;
  mode: ObsidianIntegrationMode;
  vaultPath: string | null;
  workspacePath: string | null;
  available: boolean;
  watcherActive: boolean;
  synced: number;
  pending: number;
  conflicts: number;
  failed: number;
  ignored: number;
  lastSyncAt?: ISODateString;
  lastRun?: ObsidianSyncRun;
}

export interface ObsidianVaultCheck {
  ok: boolean;
  vaultPath: string;
  workspacePath: string;
  hasObsidianDirectory: boolean;
  readable: boolean;
  writable: boolean;
  message: string;
}

export interface ObsidianSyncRequest {
  entityId?: EntityId;
  trigger?: ObsidianSyncRun['trigger'];
}

export interface ObsidianNoteLocation {
  entityId: EntityId;
  entityType: ObsidianEntityType;
  title: string;
  filePath: string;
  relativePath: string;
  wikiLink: string;
  obsidianUri: string;
}

export interface WorkspaceSettings {
  workspaceName: string;
  provider?: ProviderConfig;
  allowDiagnostics: boolean;
  jobSyncToken: string;
  obsidian: ObsidianIntegrationSettings;
}

export interface WorkspaceState {
  schemaVersion: 3;
  profile: CareerProfile;
  projects: ProjectExperience[];
  knowledge: KnowledgeItem[];
  jobs: JobDescription[];
  applications: JobApplication[];
  resumeVariants: ResumeVariant[];
  syncedJobs: SyncedJob[];
  jobSources: JobSourceConfig[];
  jobSyncRuns: JobSyncRun[];
  jobFilterPresets: JobFilterPreset[];
  jobAlertRules: JobAlertRule[];
  careerSearchPlans: CareerSearchPlan[];
  careerAgentRuns: CareerAgentRun[];
  careerMemory: CareerMemoryItem[];
  companyWatches: CompanyWatch[];
  trainingSessions: TrainingSession[];
  coachSessions: CoachSession[];
  migrationHistory: WorkspaceMigrationRecord[];
  obsidianSyncIndex: ObsidianSyncIndexEntry[];
  obsidianSyncConflicts: ObsidianSyncConflict[];
  obsidianSyncRuns: ObsidianSyncRun[];
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
  jobIds?: EntityId[];
  projectIds?: EntityId[];
  skillNames?: string[];
  visibility?: KnowledgeVisibility;
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
  interviewRevisionNotes?: string;
}

export interface JobInput {
  title: string;
  company?: string;
  rawText: string;
}

export interface TrainingStartInput {
  jobId?: EntityId;
  projectId?: EntityId;
  projectIds?: EntityId[];
  resumeId?: EntityId;
  coachMode?: CoachMode;
  type?: InterviewQuestionType | 'mixed';
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount?: number;
  language?: TrainingLanguage;
  mode?: TrainingMode;
  maxRounds?: number;
}

export interface TrainingAnswerInput {
  sessionId: EntityId;
  questionId: EntityId;
  answer: string;
}

export interface TrainingFinalizeInput extends TrainingAnswerInput {
  coach?: TrainingCoachResult;
}

export interface TrainingCoachInput {
  sessionId: EntityId;
  questionId: EntityId;
  answer?: string;
  language?: TrainingLanguage;
}

export interface TrainingCoachResult {
  feedback: string;
  recommendedAnswer: string;
  followUpQuestion: string;
  diagnosis: InterviewDiagnosis;
  sessionSummary?: PressureSessionSummary;
  source: 'ai' | 'local';
}

export interface CareerMemorySuggestion {
  type: CareerMemoryType;
  content: string;
  tags: string[];
  evidenceIds: EntityId[];
}

export interface CareerCompanionInput {
  message: string;
}

export interface CareerCompanionResult {
  session: CoachSession;
  reply: string;
  memorySuggestions: CareerMemorySuggestion[];
  source: 'ai' | 'local';
}

export interface ProviderInput {
  kind: ProviderConfig['kind'];
  name: string;
  baseUrl: string;
  model: string;
  authMode?: 'api-key' | 'none';
  apiKey?: string;
  enabled: boolean;
}

export interface BackupInfo {
  path: string;
  createdAt: ISODateString;
  sha256: string;
}

export interface DataCleanupResult {
  backup: BackupInfo;
  state: WorkspaceState;
}

export interface JobAnalysisDeletionResult {
  deleted: boolean;
  backup?: BackupInfo;
  unlinkedRecords: number;
}

export interface JobAnalysesDeletionResult {
  deleted: number;
  requested: number;
  backup?: BackupInfo;
  unlinkedRecords: number;
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

export type DocumentImportTarget = 'job' | 'profile' | 'knowledge';
export type DocumentRecognitionMode = 'local' | 'ai-vision';

export interface DocumentImportResult {
  target: DocumentImportTarget;
  fileName: string;
  mode: DocumentRecognitionMode;
  extractedText: string;
  warnings: string[];
  job?: Partial<JobInput>;
  profile?: Partial<ProfileInput>;
  projects?: ProjectInput[];
  knowledge?: Partial<KnowledgeInput>;
}

export interface AppMeta {
  version: string;
  dataDirectory: string;
  extensionDirectory: string;
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

export function createDefaultObsidianFolderMapping(): ObsidianFolderMapping {
  return {
    inbox: '00-收件箱',
    profile: '01-职业档案',
    targetJobs: '02-目标岗位',
    projects: '03-项目经历',
    incidents: '04-故障案例',
    technicalKnowledge: '05-技术知识',
    interviewQuestions: '06-面试题库',
    expressionTraining: '07-表达训练',
    jdAnalysis: '08-JD分析',
    resumes: '09-简历版本',
    learningPlans: '10-学习计划',
    companyResearch: '11-公司研究',
    retrospectives: '12-求职复盘',
    attachments: '90-附件',
    archive: '98-归档',
    templates: '99-模板'
  };
}

export function createDefaultObsidianSettings(): ObsidianIntegrationSettings {
  return {
    enabled: false,
    vaultPath: null,
    workspaceSubdirectory: 'Interview-OS',
    mode: 'disabled',
    syncDirection: 'export-only',
    autoSync: false,
    scanOnStartup: false,
    syncIntervalSeconds: 300,
    attachmentDirectory: '90-附件',
    folderMapping: createDefaultObsidianFolderMapping(),
    enabledEntityTypes: [
      'project',
      'incident',
      'technical-knowledge',
      'interview-question',
      'interview-answer',
      'jd-analysis'
    ],
    syncFullResume: false
  };
}

export function createDefaultJobSources(now = nowIso()): JobSourceConfig[] {
  return [
    {
      id: 'source-browser-extension', name: '浏览器岗位同步', platform: 'BOSS / 猎聘 / 智联 / 51job / 拉勾',
      connectorType: 'browser-extension', status: 'ready', enabled: true, endpoint: 'http://127.0.0.1:19426',
      intervalMinutes: 5, capabilities: ['search', 'detail'], notes: '支持当前页同步，以及列表岗位后台打开详情页补全 JD；本地令牌鉴权。',
      createdAt: now, updatedAt: now
    },
    {
      id: 'source-boss-visible', name: 'BOSS 页面适配器', platform: 'BOSS 直聘',
      connectorType: 'browser-extension', status: 'configured', enabled: true, endpoint: 'browser-extension://boss',
      intervalMinutes: 0, capabilities: ['search', 'detail', 'company-check', 'apply-assist'],
      notes: '支持 BOSS 搜索列表识别与后台详情补全；不读取密码、Cookie，不绕过验证码或风控。',
      createdAt: now, updatedAt: now
    },
    {
      id: 'source-zhaopin-visible', name: '智联页面适配器', platform: '智联招聘',
      connectorType: 'browser-extension', status: 'configured', enabled: true, endpoint: 'browser-extension://zhaopin',
      intervalMinutes: 0, capabilities: ['search', 'detail', 'company-check'],
      notes: '支持智联搜索页列表识别与详情页补全，需用户在浏览器中打开目标页面。',
      createdAt: now, updatedAt: now
    },
    {
      id: 'source-51job-visible', name: '前程无忧页面适配器', platform: '前程无忧 / 51job',
      connectorType: 'browser-extension', status: 'configured', enabled: true, endpoint: 'browser-extension://51job',
      intervalMinutes: 0, capabilities: ['search', 'detail'],
      notes: '支持 51job 搜索页列表识别与详情页补全，适合批量浏览后同步到岗位池。',
      createdAt: now, updatedAt: now
    },
    {
      id: 'source-lagou-visible', name: '拉勾页面适配器', platform: '拉勾',
      connectorType: 'browser-extension', status: 'configured', enabled: true, endpoint: 'browser-extension://lagou',
      intervalMinutes: 0, capabilities: ['search', 'detail'],
      notes: '支持拉勾列表识别与详情补全；出现滑块验证、登录或风控页时会停止同步并提示用户处理。',
      createdAt: now, updatedAt: now
    },
    {
      id: 'source-liepin-visible', name: '猎聘页面适配器', platform: '猎聘',
      connectorType: 'browser-extension', status: 'configured', enabled: true, endpoint: 'browser-extension://liepin',
      intervalMinutes: 0, capabilities: ['search', 'detail', 'company-check'],
      notes: '支持猎聘列表识别与详情补全；登录弹窗、验证码和官方频率限制由用户自行处理。',
      createdAt: now, updatedAt: now
    },
    {
      id: 'source-liepin-mcp', name: '猎聘官方 MCP', platform: '猎聘', connectorType: 'mcp', status: 'configured', enabled: false,
      endpoint: 'https://open-agent.liepin.com/mcp/user', intervalMinutes: 30, capabilities: ['search', 'detail'],
      notes: '框架已预留；正式接入需要用户授权 Key，并遵守官方频率限制。', createdAt: now, updatedAt: now
    },
    {
      id: 'source-boss-mcp', name: 'BOSS MCP 连接器', platform: 'BOSS 直聘', connectorType: 'mcp', status: 'configured', enabled: false,
      endpoint: 'http://127.0.0.1:8080/mcp', intervalMinutes: 30, capabilities: ['search', 'detail', 'company-check', 'apply-assist'],
      notes: '仅保留连接器契约；登录、沟通和简历发送必须由用户确认。', createdAt: now, updatedAt: now
    },
    {
      id: 'source-company-careers', name: '目标公司官网监控', platform: '公司招聘官网', connectorType: 'company-careers', status: 'configured', enabled: true,
      endpoint: 'company-watches://configured', intervalMinutes: 60, capabilities: ['search', 'detail', 'change-tracking'],
      notes: '跟踪公司关注清单中的官网新增、变更和关闭岗位；打开软件时可自动检查匹配岗位。', createdAt: now, updatedAt: now
    },
    {
      id: 'source-google-jobs-api', name: 'Google Jobs 聚合 API', platform: 'Google Jobs', connectorType: 'api', status: 'configured', enabled: false,
      endpoint: 'https://jobs.googleapis.com/', intervalMinutes: 60, capabilities: ['search', 'detail'],
      notes: '预留结构化 API 接入；需要 API Key 或合规聚合服务后才发起真实请求。', createdAt: now, updatedAt: now
    },
    {
      id: 'source-linkedin-api', name: 'LinkedIn / 海外岗位 API', platform: 'LinkedIn / 海外职位源', connectorType: 'api', status: 'configured', enabled: false,
      endpoint: 'https://api.linkedin.com/', intervalMinutes: 60, capabilities: ['search', 'detail', 'company-check'],
      notes: '预留海外岗位结构化数据入口；需要合法 API 权限或第三方聚合服务。',
      createdAt: now, updatedAt: now
    },
    {
      id: 'source-custom-scraper', name: '自定义爬虫适配器', platform: '自建采集服务', connectorType: 'scraper', status: 'configured', enabled: false,
      endpoint: 'http://127.0.0.1:18080/jobs', intervalMinutes: 30, capabilities: ['search', 'detail', 'change-tracking', 'push'],
      notes: '用于对接你后续自建的 Python/Node 采集服务，要求输出标准化岗位 JSON。',
      createdAt: now, updatedAt: now
    },
    {
      id: 'source-generic-import', name: '结构化文件导入', platform: 'CSV / JSON', connectorType: 'import', status: 'configured', enabled: true,
      endpoint: '', intervalMinutes: 0, capabilities: ['detail'], notes: '用于导入第三方爬虫或人工整理的数据。', createdAt: now, updatedAt: now
    }
  ];
}

export function createDefaultJobFilterPresets(now = nowIso()): JobFilterPreset[] {
  return [
    {
      id: 'preset-tech-cloud-native', name: '技术研发 · 云原生高匹配',
      includeKeywords: ['Kubernetes', 'Docker', '云原生', 'SRE', '后端', '平台工程'],
      excludeKeywords: ['实习', '兼职', '外包', '培训', '销售'],
      cities: ['杭州', '上海', '北京', '深圳', '远程'],
      industries: ['technology', 'operations'], sources: [], minSalaryK: 15, minMatchScore: 70, minTrustScore: 70,
      remoteOnly: false, freshWithinDays: 30, createdAt: now, updatedAt: now
    },
    {
      id: 'preset-operations-delivery', name: '运维支持 · 交付实施',
      includeKeywords: ['运维', '实施', '交付', 'Linux', '网络', '故障排查'],
      excludeKeywords: ['兼职', '外包', '电话销售', '无责底薪'],
      cities: ['杭州', '上海', '成都', '远程'],
      industries: ['operations', 'technology'], sources: [], minSalaryK: 8, minMatchScore: 60, minTrustScore: 65,
      remoteOnly: false, freshWithinDays: 30, createdAt: now, updatedAt: now
    },
    {
      id: 'preset-product-ai-saas', name: '产品 · AI / SaaS',
      includeKeywords: ['产品经理', 'AI', 'SaaS', 'B端', '数据分析', '用户增长'],
      excludeKeywords: ['销售', '客服', '实习', '外包'],
      cities: ['杭州', '上海', '北京', '深圳'],
      industries: ['product'], sources: [], minSalaryK: 12, minMatchScore: 65, minTrustScore: 70,
      remoteOnly: false, freshWithinDays: 45, createdAt: now, updatedAt: now
    },
    {
      id: 'preset-design-ux', name: '设计 · UI/UX / 视觉',
      includeKeywords: ['UI', 'UX', '视觉设计', '交互设计', 'Figma', '作品集'],
      excludeKeywords: ['电商客服', '销售', '外包', '兼职'],
      cities: ['杭州', '上海', '北京', '深圳', '远程'],
      industries: ['design'], sources: [], minSalaryK: 8, minMatchScore: 60, minTrustScore: 65,
      remoteOnly: false, freshWithinDays: 45, createdAt: now, updatedAt: now
    },
    {
      id: 'preset-sales-enterprise', name: '销售商务 · 企业客户',
      includeKeywords: ['销售', '商务', '客户经理', '大客户', '解决方案'],
      excludeKeywords: ['电销', '保险', '贷款', '兼职', '无经验高薪'],
      cities: ['杭州', '上海', '北京', '深圳', '成都'],
      industries: ['sales'], sources: [], minSalaryK: 8, minMatchScore: 55, minTrustScore: 70,
      remoteOnly: false, freshWithinDays: 30, createdAt: now, updatedAt: now
    },
    {
      id: 'preset-marketing-growth', name: '市场运营 · 增长内容',
      includeKeywords: ['运营', '增长', '内容', '新媒体', '活动', '数据分析'],
      excludeKeywords: ['主播', '客服', '兼职', '刷单', '外包'],
      cities: ['杭州', '上海', '北京', '深圳', '远程'],
      industries: ['marketing'], sources: [], minSalaryK: 7, minMatchScore: 55, minTrustScore: 65,
      remoteOnly: false, freshWithinDays: 30, createdAt: now, updatedAt: now
    },
    {
      id: 'preset-finance-hr-legal', name: '职能 · 财务 / HR / 法务',
      includeKeywords: ['财务', '会计', '人力资源', '招聘', '法务', '合规'],
      excludeKeywords: ['销售', '兼职', '外包', '培训收费'],
      cities: ['杭州', '上海', '北京', '深圳'],
      industries: ['finance', 'human-resources', 'legal'], sources: [], minSalaryK: 6, minMatchScore: 55, minTrustScore: 70,
      remoteOnly: false, freshWithinDays: 45, createdAt: now, updatedAt: now
    },
    {
      id: 'preset-education-general', name: '教育 / 综合 · 稳定岗位',
      includeKeywords: ['教育', '培训', '教研', '课程', '助教', '行政'],
      excludeKeywords: ['收费培训', '兼职', '销售', '招生高提成'],
      cities: ['杭州', '上海', '成都', '远程'],
      industries: ['education', 'general'], sources: [], minSalaryK: 5, minMatchScore: 50, minTrustScore: 70,
      remoteOnly: false, freshWithinDays: 45, createdAt: now, updatedAt: now
    }
  ];
}

export function createDefaultJobAlertRules(now = nowIso()): JobAlertRule[] {
  return createDefaultJobFilterPresets(now).map((preset) => ({
    id: `alert-${preset.id.replace(/^preset-/u, '')}`,
    name: `${preset.name}提醒`,
    presetId: preset.id,
    channel: 'in-app',
    enabled: true,
    threshold: 1,
    target: '',
    createdAt: now,
    updatedAt: now
  }));
}

export function createEmptyState(): WorkspaceState {
  const now = nowIso();
  return {
    schemaVersion: 3,
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
    applications: [],
    resumeVariants: [],
    syncedJobs: [],
    jobSources: createDefaultJobSources(now),
    jobSyncRuns: [],
    jobFilterPresets: createDefaultJobFilterPresets(now),
    jobAlertRules: createDefaultJobAlertRules(now),
    careerSearchPlans: [],
    careerAgentRuns: [],
    careerMemory: [],
    companyWatches: [],
    trainingSessions: [],
    coachSessions: [],
    migrationHistory: [],
    obsidianSyncIndex: [],
    obsidianSyncConflicts: [],
    obsidianSyncRuns: [],
    settings: {
      workspaceName: '我的面试知识库',
      allowDiagnostics: false,
      jobSyncToken: crypto.randomUUID(),
      obsidian: createDefaultObsidianSettings()
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
        interviewRevisionNotes: '',
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
        jobIds: [],
        projectIds: [projectId],
        skillNames: ['大模型 API'],
        visibility: 'private',
        createdAt: now,
        updatedAt: now
      }
    ],
    syncedJobs: [
      {
        id: 'demo-job-cloud', externalId: 'demo-cloud-001', fingerprint: 'demo-cloud-001', sourceSite: 'company-careers',
        sourceName: '目标公司官网', sourceUrl: 'https://careers.example.com/jobs/cloud-support', title: '云原生技术支持工程师',
        company: '示例云科技', location: '杭州', salaryRange: '20K-30K', salaryMinK: 20, salaryMaxK: 30,
        description: '负责 Kubernetes、Docker、Nginx 平台问题排查、客户技术支持和发布验证，要求本科及 2-4 年经验。',
        industry: 'operations', employmentType: '全职', education: '本科', experience: '2-4年',
        skills: ['Kubernetes', 'Docker', 'Nginx'], remote: false, matchScore: 92,
        matchDimensions: { role: 100, skills: 88, experience: 90, education: 100, location: 70, salary: 80, freshness: 100 },
        matchReasons: ['目标方向命中：云计算技术支持工程师', '已有技能命中：Kubernetes、Docker'],
        trustScore: 96, riskFlags: [], biasFlags: [], qualityScore: 96, lifecycleStatus: 'new', postedAt: now, capturedAt: now, lastSeenAt: now,
        seenCount: 1, status: 'new', createdAt: now, updatedAt: now
      },
      {
        id: 'demo-job-design', externalId: 'demo-design-001', fingerprint: 'demo-design-001', sourceSite: 'import',
        sourceName: '结构化文件导入', sourceUrl: 'https://careers.example.com/jobs/product-designer', title: '产品视觉设计师',
        company: '示例内容科技', location: '上海', salaryRange: '18K-26K', salaryMinK: 18, salaryMaxK: 26,
        description: '负责品牌视觉、活动页面和 AIGC 素材设计，需要熟悉 Figma、Photoshop 和 Illustrator。',
        industry: 'design', employmentType: '全职', education: '', experience: '',
        skills: ['Figma', 'Photoshop', 'Illustrator', 'AIGC'], remote: false, matchScore: 34,
        matchDimensions: { role: 10, skills: 0, experience: 60, education: 60, location: 70, salary: 80, freshness: 100 },
        matchReasons: ['建议补证据：Figma、Photoshop、Illustrator'], trustScore: 88, riskFlags: [], lifecycleStatus: 'active',
        biasFlags: [], qualityScore: 86,
        postedAt: now, capturedAt: now, lastSeenAt: now, seenCount: 1, status: 'new', createdAt: now, updatedAt: now
      },
      {
        id: 'demo-job-warning', externalId: 'demo-warning-001', fingerprint: 'demo-warning-001', sourceSite: 'search-api',
        sourceName: '公开搜索聚合', sourceUrl: 'http://jobs.example.com/high-income', title: '在线兼职推广', company: '',
        location: '', salaryRange: '30K-50K', salaryMinK: 30, salaryMaxK: 50,
        description: '无需经验轻松月入，入职前需缴纳培训费并添加私人微信。', industry: 'marketing', employmentType: '兼职',
        education: '不限', experience: '不限', skills: [], remote: true, matchScore: 5, matchReasons: ['职业方向与已有技能均未命中'],
        matchDimensions: { role: 0, skills: 0, experience: 50, education: 50, location: 20, salary: 50, freshness: 50 },
        trustScore: 18, riskFlags: ['公司信息缺失', '疑似要求付费', '夸大收益表述', '要求转至私人联系方式'], biasFlags: [], qualityScore: 35,
        lifecycleStatus: 'new', capturedAt: now, lastSeenAt: now, seenCount: 1, status: 'new', createdAt: now, updatedAt: now
      }
    ],
    jobFilterPresets: [
      {
        id: 'demo-preset-high-match', name: '高匹配可信岗位', includeKeywords: [], excludeKeywords: ['兼职', '外包'], cities: [],
        industries: [], sources: [], minSalaryK: 15, minMatchScore: 70, minTrustScore: 75, remoteOnly: false,
        freshWithinDays: 30, createdAt: now, updatedAt: now
      }
    ],
    jobAlertRules: [
      {
        id: 'demo-alert-high-match', name: '高匹配岗位提醒', presetId: 'demo-preset-high-match', channel: 'in-app', enabled: true,
        threshold: 1, target: '', createdAt: now, updatedAt: now
      }
    ],
    jobSyncRuns: [
      {
        id: 'demo-sync-run', sourceId: 'source-browser-extension', sourceName: '浏览器可见岗位同步', status: 'success',
        fetched: 3, added: 3, updated: 0, durationMs: 420, message: '演示批次：完成字段标准化、去重与风险分析。',
        createdAt: now, updatedAt: now
      }
    ],
    careerSearchPlans: [
      {
        id: 'demo-search-plan', title: '杭州 · 云原生技术支持',
        goal: '帮我找杭州云原生或大模型技术支持岗位，20K 以上，不要外包，双休优先。',
        cities: ['杭州'], keywords: ['云原生', '大模型', '技术支持'], excludeKeywords: ['外包'], platforms: [],
        jobTypes: ['社招'], salaryMinK: 20, remotePreference: 'any', hardConstraints: ['排除 外包'],
        softPreferences: ['双休'], createdAt: now, updatedAt: now
      }
    ],
    careerMemory: [
      {
        id: 'demo-memory-preference', type: 'preference', content: '优先考虑云原生、AI 平台和技术支持方向，不接受纯销售岗位。',
        tags: ['方向偏好', '岗位筛选'], createdAt: now, updatedAt: now
      },
      {
        id: 'demo-memory-evidence', type: 'profile', content: '可验证的核心证据来自 ACK 发布、日志排查、模型 API 联调和故障复盘。',
        tags: ['真实经历', '面试证据'], createdAt: now, updatedAt: now
      }
    ],
    companyWatches: [
      {
        id: 'demo-company-watch', name: '示例云科技', industry: '云计算', careerUrl: 'https://careers.example.com',
        priority: 'focus', status: 'watching', recruitmentType: '社招', tags: ['云原生', '技术支持'],
        notes: '重点关注平台技术支持和运维岗位。', nextRecruitmentAt: now, lastCheckedAt: now,
        openJobs: 1, newJobs: 1, changedJobs: 0, createdAt: now, updatedAt: now
      }
    ],
    updatedAt: now
  };
}
