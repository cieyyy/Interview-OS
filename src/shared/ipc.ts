import type {
  AppMeta,
  BackupInfo,
  ConnectionResult,
  DocumentImportResult,
  DocumentImportTarget,
  ExportInfo,
  JobDescription,
  JobInput,
  KnowledgeInput,
  KnowledgeItem,
  ProjectExperience,
  ProjectInput,
  ProfileInput,
  CareerProfile,
  ProviderConfig,
  ProviderInput,
  Result,
  TrainingAnswerInput,
  TrainingFinalizeInput,
  TrainingCoachInput,
  TrainingCoachResult,
  TrainingSession,
  TrainingStartInput,
  WorkspaceState
} from './domain';

export const IPC = {
  getState: 'workspace:get-state',
  resetDemo: 'workspace:reset-demo',
  saveProfile: 'profile:save',
  saveKnowledge: 'knowledge:save',
  deleteKnowledge: 'knowledge:delete',
  saveProject: 'project:save',
  analyzeJob: 'job:analyze',
  startTraining: 'training:start',
  submitTraining: 'training:submit',
  finalizeTraining: 'training:finalize',
  coachTraining: 'training:coach',
  createBackup: 'backup:create',
  exportMarkdown: 'export:markdown',
  saveProvider: 'provider:save',
  testProvider: 'provider:test',
  getMeta: 'app:get-meta',
  importDocument: 'document:import'
} as const;

export interface InterviewOSApi {
  getState(): Promise<Result<WorkspaceState>>;
  resetDemo(): Promise<Result<WorkspaceState>>;
  saveProfile(input: ProfileInput): Promise<Result<CareerProfile>>;
  saveKnowledge(input: KnowledgeInput): Promise<Result<KnowledgeItem>>;
  deleteKnowledge(id: string): Promise<Result<{ deleted: boolean }>>;
  saveProject(input: ProjectInput): Promise<Result<ProjectExperience>>;
  analyzeJob(input: JobInput): Promise<Result<JobDescription>>;
  startTraining(input: TrainingStartInput): Promise<Result<TrainingSession>>;
  submitTraining(input: TrainingAnswerInput): Promise<Result<TrainingSession>>;
  finalizeTraining(input: TrainingFinalizeInput): Promise<Result<TrainingSession>>;
  coachTraining(input: TrainingCoachInput): Promise<Result<TrainingCoachResult>>;
  createBackup(): Promise<Result<BackupInfo>>;
  exportMarkdown(): Promise<Result<ExportInfo>>;
  saveProvider(input: ProviderInput): Promise<Result<ProviderConfig>>;
  testProvider(): Promise<Result<ConnectionResult>>;
  getMeta(): Promise<Result<AppMeta>>;
  importDocument(target: DocumentImportTarget): Promise<Result<DocumentImportResult | null>>;
}
