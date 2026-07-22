import type {
  CareerAgentRun,
  CareerMemoryInput,
  CareerMemoryItem,
  CareerSearchPlan,
  CareerSearchPlanInput,
  CompanyWatch,
  CompanyWatchInput,
  AppMeta,
  BackupInfo,
  ConnectionResult,
  DocumentImportResult,
  DocumentImportTarget,
  ExportInfo,
  JobApplication,
  JobApplicationInput,
  JobAlertRule,
  JobAlertRuleInput,
  JobFilterPreset,
  JobFilterPresetInput,
  JobSyncBridgeStatus,
  JobDescription,
  JobInput,
  JobSourceConfig,
  JobSourceInput,
  KnowledgeInput,
  KnowledgeItem,
  ObsidianIntegrationSettings,
  ObsidianIntegrationSettingsInput,
  ObsidianIntegrationStatus,
  ObsidianNoteLocation,
  ObsidianSyncPreview,
  ObsidianSyncRequest,
  ObsidianSyncRun,
  ObsidianVaultCheck,
  ProjectExperience,
  ProjectInput,
  ProfileInput,
  CareerProfile,
  ProviderConfig,
  ProviderInput,
  ResumeVariant,
  ResumeVariantInput,
  SyncedJob,
  SyncedJobStatus,
  JobSyncRun,
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
  saveApplication: 'application:save',
  saveResumeVariant: 'resume-variant:save',
  saveJobSource: 'job-source:save',
  saveJobFilterPreset: 'job-filter:save',
  saveJobAlertRule: 'job-alert:save',
  validateJobSource: 'job-source:validate',
  saveCareerSearchPlan: 'career-search-plan:save',
  runCareerSearchPlan: 'career-search-plan:run',
  saveCareerMemory: 'career-memory:save',
  saveCompanyWatch: 'company-watch:save',
  validateCompanyWatch: 'company-watch:validate',
  checkCompanyWatchesOnStartup: 'company-watch:startup-check',
  getJobSyncStatus: 'job-sync:status',
  promoteSyncedJob: 'job-sync:promote',
  updateSyncedJobStatus: 'job-sync:update-status',
  deleteSyncedJobPermanently: 'job-sync:delete-permanently',
  startTraining: 'training:start',
  submitTraining: 'training:submit',
  finalizeTraining: 'training:finalize',
  coachTraining: 'training:coach',
  createBackup: 'backup:create',
  exportMarkdown: 'export:markdown',
  saveProvider: 'provider:save',
  testProvider: 'provider:test',
  getMeta: 'app:get-meta',
  copyText: 'clipboard:write-text',
  importDocument: 'document:import'
  ,
  selectObsidianVault: 'obsidian:select-vault',
  createObsidianVault: 'obsidian:create-vault',
  testObsidianVault: 'obsidian:test-vault',
  getObsidianSettings: 'obsidian:get-settings',
  updateObsidianSettings: 'obsidian:update-settings',
  previewObsidianSync: 'obsidian:preview-initial-sync',
  runObsidianSync: 'obsidian:run-sync',
  getObsidianStatus: 'obsidian:get-status',
  openObsidianNote: 'obsidian:open-note',
  openObsidianFolder: 'obsidian:open-folder',
  copyObsidianWikiLink: 'obsidian:copy-wikilink',
  disconnectObsidian: 'obsidian:disconnect'
} as const;

export interface InterviewOSApi {
  getState(): Promise<Result<WorkspaceState>>;
  resetDemo(): Promise<Result<WorkspaceState>>;
  saveProfile(input: ProfileInput): Promise<Result<CareerProfile>>;
  saveKnowledge(input: KnowledgeInput): Promise<Result<KnowledgeItem>>;
  deleteKnowledge(id: string): Promise<Result<{ deleted: boolean }>>;
  saveProject(input: ProjectInput): Promise<Result<ProjectExperience>>;
  analyzeJob(input: JobInput): Promise<Result<JobDescription>>;
  saveApplication(input: JobApplicationInput): Promise<Result<JobApplication>>;
  saveResumeVariant(input: ResumeVariantInput): Promise<Result<ResumeVariant>>;
  saveJobSource(input: JobSourceInput): Promise<Result<JobSourceConfig>>;
  saveJobFilterPreset(input: JobFilterPresetInput): Promise<Result<JobFilterPreset>>;
  saveJobAlertRule(input: JobAlertRuleInput): Promise<Result<JobAlertRule>>;
  validateJobSource(id: string): Promise<Result<JobSyncRun>>;
  saveCareerSearchPlan(input: CareerSearchPlanInput): Promise<Result<CareerSearchPlan>>;
  runCareerSearchPlan(id: string): Promise<Result<CareerAgentRun>>;
  saveCareerMemory(input: CareerMemoryInput): Promise<Result<CareerMemoryItem>>;
  saveCompanyWatch(input: CompanyWatchInput): Promise<Result<CompanyWatch>>;
  validateCompanyWatch(id: string): Promise<Result<CompanyWatch>>;
  checkCompanyWatchesOnStartup(): Promise<Result<JobSyncRun[]>>;
  getJobSyncStatus(): Promise<Result<JobSyncBridgeStatus>>;
  promoteSyncedJob(id: string): Promise<Result<JobDescription>>;
  updateSyncedJobStatus(id: string, status: SyncedJobStatus): Promise<Result<SyncedJob>>;
  deleteSyncedJobPermanently(id: string): Promise<Result<{ deleted: boolean }>>;
  startTraining(input: TrainingStartInput): Promise<Result<TrainingSession>>;
  submitTraining(input: TrainingAnswerInput): Promise<Result<TrainingSession>>;
  finalizeTraining(input: TrainingFinalizeInput): Promise<Result<TrainingSession>>;
  coachTraining(input: TrainingCoachInput): Promise<Result<TrainingCoachResult>>;
  createBackup(): Promise<Result<BackupInfo>>;
  exportMarkdown(): Promise<Result<ExportInfo>>;
  saveProvider(input: ProviderInput): Promise<Result<ProviderConfig>>;
  testProvider(): Promise<Result<ConnectionResult>>;
  getMeta(): Promise<Result<AppMeta>>;
  copyText(value: string): Promise<Result<{ copied: boolean }>>;
  importDocument(target: DocumentImportTarget): Promise<Result<DocumentImportResult | null>>;
  selectObsidianVault(): Promise<Result<ObsidianVaultCheck | null>>;
  createObsidianVault(): Promise<Result<ObsidianVaultCheck | null>>;
  testObsidianVault(): Promise<Result<ObsidianVaultCheck>>;
  getObsidianSettings(): Promise<Result<ObsidianIntegrationSettings>>;
  updateObsidianSettings(input: ObsidianIntegrationSettingsInput): Promise<Result<ObsidianIntegrationSettings>>;
  previewObsidianSync(input?: ObsidianSyncRequest): Promise<Result<ObsidianSyncPreview>>;
  runObsidianSync(input?: ObsidianSyncRequest): Promise<Result<ObsidianSyncRun>>;
  getObsidianStatus(): Promise<Result<ObsidianIntegrationStatus>>;
  openObsidianNote(entityId: string): Promise<Result<ObsidianNoteLocation>>;
  openObsidianFolder(): Promise<Result<{ opened: boolean; message: string }>>;
  copyObsidianWikiLink(entityId: string): Promise<Result<{ wikiLink: string }>>;
  disconnectObsidian(): Promise<Result<ObsidianIntegrationSettings>>;
}
