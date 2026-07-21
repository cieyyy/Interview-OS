import { computed, reactive } from 'vue';
import type {
  CareerMemoryInput,
  CareerSearchPlanInput,
  CompanyWatchInput,
  AppMeta,
  DocumentImportTarget,
  JobInput,
  JobApplicationInput,
  JobAlertRuleInput,
  JobFilterPresetInput,
  JobSyncBridgeStatus,
  JobSourceInput,
  KnowledgeInput,
  ObsidianIntegrationSettingsInput,
  ObsidianIntegrationStatus,
  ObsidianSyncPreview,
  ProfileInput,
  ProjectInput,
  ProviderInput,
  ResumeVariantInput,
  SyncedJobStatus,
  Result,
  TrainingAnswerInput,
  TrainingCoachInput,
  TrainingFinalizeInput,
  TrainingSession,
  TrainingStartInput,
  WorkspaceState
} from '../../shared/domain';

const store = reactive<{
  workspace?: WorkspaceState;
  meta?: AppMeta;
  loading: boolean;
  error: string;
  notice: string;
  activeSession?: TrainingSession;
  jobSyncStatus?: JobSyncBridgeStatus;
  obsidianStatus?: ObsidianIntegrationStatus;
  obsidianPreview?: ObsidianSyncPreview;
}>({ loading: false, error: '', notice: '' });

let initialized = false;

function toIpcPayload<T>(value: T): T {
  // Vue wraps nested form arrays and objects in Proxy instances. Electron IPC
  // only accepts structured-clone values, so cross the process boundary with
  // an explicitly plain JSON payload.
  return JSON.parse(JSON.stringify(value)) as T;
}

async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

async function run<T>(operation: () => Promise<T>, notice?: string): Promise<T | undefined> {
  store.loading = true;
  store.error = '';
  try {
    const value = await operation();
    if (notice) {
      store.notice = notice;
      window.setTimeout(() => { if (store.notice === notice) store.notice = ''; }, 2500);
    }
    return value;
  } catch (error) {
    store.error = error instanceof Error ? error.message : '操作失败';
    return undefined;
  } finally {
    store.loading = false;
  }
}

async function refresh(): Promise<void> {
  const value = await run(() => unwrap(window.interviewOS.getState()));
  if (value) store.workspace = value;
}

export function useWorkspace() {
  if (!initialized) {
    initialized = true;
    void refresh();
    void run(() => unwrap(window.interviewOS.getMeta())).then((value) => {
      if (value) store.meta = value;
    });
  }

  return {
    store,
    ready: computed(() => Boolean(store.workspace)),
    refresh,
    async resetDemo() {
      const value = await run(() => unwrap(window.interviewOS.resetDemo()), '演示工作区已创建');
      if (value) store.workspace = value;
    },
    async saveProfile(input: ProfileInput) {
      const value = await run(() => unwrap(window.interviewOS.saveProfile(toIpcPayload(input))), '职业档案已保存');
      if (value) await refresh();
      return value;
    },
    async saveKnowledge(input: KnowledgeInput) {
      const value = await run(() => unwrap(window.interviewOS.saveKnowledge(toIpcPayload(input))), '知识卡片已保存');
      if (value) await refresh();
      return value;
    },
    async deleteKnowledge(id: string) {
      const value = await run(() => unwrap(window.interviewOS.deleteKnowledge(id)), '知识卡片已删除');
      if (value) await refresh();
      return value;
    },
    async saveProject(input: ProjectInput) {
      const value = await run(() => unwrap(window.interviewOS.saveProject(toIpcPayload(input))), '项目经历已保存');
      if (value) await refresh();
      return value;
    },
    async analyzeJob(input: JobInput) {
      const value = await run(() => unwrap(window.interviewOS.analyzeJob(toIpcPayload(input))), 'JD 分析完成');
      if (value) await refresh();
      return value;
    },
    async saveApplication(input: JobApplicationInput) {
      const value = await run(() => unwrap(window.interviewOS.saveApplication(toIpcPayload(input))), '求职进展已保存');
      if (value) await refresh();
      return value;
    },
    async saveResumeVariant(input: ResumeVariantInput) {
      const value = await run(() => unwrap(window.interviewOS.saveResumeVariant(toIpcPayload(input))), '定向简历版本已保存');
      if (value) await refresh();
      return value;
    },
    async saveJobSource(input: JobSourceInput) {
      const value = await run(() => unwrap(window.interviewOS.saveJobSource(toIpcPayload(input))), '岗位数据源已保存');
      if (value) await refresh();
      return value;
    },
    async saveJobFilterPreset(input: JobFilterPresetInput) {
      const value = await run(() => unwrap(window.interviewOS.saveJobFilterPreset(toIpcPayload(input))), '筛选规则已保存');
      if (value) await refresh();
      return value;
    },
    async saveJobAlertRule(input: JobAlertRuleInput) {
      const value = await run(() => unwrap(window.interviewOS.saveJobAlertRule(toIpcPayload(input))), '提醒规则已保存');
      if (value) await refresh();
      return value;
    },
    async validateJobSource(id: string) {
      const value = await run(() => unwrap(window.interviewOS.validateJobSource(id)), '连接器框架验证完成');
      if (value) await refresh();
      return value;
    },
    async saveCareerSearchPlan(input: CareerSearchPlanInput) {
      const value = await run(() => unwrap(window.interviewOS.saveCareerSearchPlan(toIpcPayload(input))), '求职搜索计划已保存');
      if (value) await refresh();
      return value;
    },
    async runCareerSearchPlan(id: string) {
      const value = await run(() => unwrap(window.interviewOS.runCareerSearchPlan(id)), '本地求职 Agent 已完成规划');
      if (value) await refresh();
      return value;
    },
    async saveCareerMemory(input: CareerMemoryInput) {
      const value = await run(() => unwrap(window.interviewOS.saveCareerMemory(toIpcPayload(input))), '求职记忆已保存');
      if (value) await refresh();
      return value;
    },
    async saveCompanyWatch(input: CompanyWatchInput) {
      const value = await run(() => unwrap(window.interviewOS.saveCompanyWatch(toIpcPayload(input))), '关注公司已保存');
      if (value) await refresh();
      return value;
    },
    async validateCompanyWatch(id: string) {
      const value = await run(() => unwrap(window.interviewOS.validateCompanyWatch(id)), '公司官网监控框架验证完成');
      if (value) await refresh();
      return value;
    },
    async refreshJobSyncStatus() {
      const value = await run(() => unwrap(window.interviewOS.getJobSyncStatus()));
      if (value) store.jobSyncStatus = value;
      return value;
    },
    async promoteSyncedJob(id: string) {
      const value = await run(() => unwrap(window.interviewOS.promoteSyncedJob(id)), '岗位已进入 JD 中心');
      if (value) await refresh();
      return value;
    },
    async updateSyncedJobStatus(id: string, status: SyncedJobStatus) {
      const value = await run(() => unwrap(window.interviewOS.updateSyncedJobStatus(id, status)));
      if (value) await refresh();
      return value;
    },
    async startTraining(input: TrainingStartInput) {
      const value = await run(() => unwrap(window.interviewOS.startTraining(toIpcPayload(input))));
      if (value) {
        store.activeSession = value;
        await refresh();
      }
      return value;
    },
    async submitTraining(input: TrainingAnswerInput) {
      const value = await run(() => unwrap(window.interviewOS.submitTraining(toIpcPayload(input))), '回答已分析');
      if (value) {
        store.activeSession = value;
        await refresh();
      }
      return value;
    },
    async finalizeTraining(input: TrainingFinalizeInput) {
      const value = await run(() => unwrap(window.interviewOS.finalizeTraining(toIpcPayload(input))), '最终回答已沉淀到知识库');
      if (value) {
        store.activeSession = value;
        await refresh();
      }
      return value;
    },
    async coachTraining(input: TrainingCoachInput) {
      return run(() => unwrap(window.interviewOS.coachTraining(toIpcPayload(input))), '陪练建议已生成');
    },
    async createBackup() {
      return run(() => unwrap(window.interviewOS.createBackup()), '备份已创建');
    },
    async exportMarkdown() {
      return run(() => unwrap(window.interviewOS.exportMarkdown()), 'Markdown 已导出');
    },
    async selectObsidianVault() {
      const value = await run(() => unwrap(window.interviewOS.selectObsidianVault()), '已连接 Obsidian Vault');
      if (value) await refresh();
      return value;
    },
    async createObsidianVault() {
      const value = await run(() => unwrap(window.interviewOS.createObsidianVault()), '专属职业知识 Vault 已创建');
      if (value) await refresh();
      return value;
    },
    async testObsidianVault() {
      return run(() => unwrap(window.interviewOS.testObsidianVault()));
    },
    async updateObsidianSettings(input: ObsidianIntegrationSettingsInput) {
      const value = await run(
        () => unwrap(window.interviewOS.updateObsidianSettings(toIpcPayload(input))),
        'Obsidian 配置已保存'
      );
      if (value) await refresh();
      return value;
    },
    async previewObsidianSync(entityId?: string) {
      const value = await run(() => unwrap(window.interviewOS.previewObsidianSync(entityId ? { entityId } : {})));
      if (value) store.obsidianPreview = value;
      return value;
    },
    async runObsidianSync(entityId?: string) {
      const value = await run(
        () => unwrap(window.interviewOS.runObsidianSync(entityId ? { entityId, trigger: 'manual' } : { trigger: 'manual' })),
        'Obsidian 单向同步已完成'
      );
      if (value) {
        await refresh();
        const status = await run(() => unwrap(window.interviewOS.getObsidianStatus()));
        if (status) store.obsidianStatus = status;
      }
      return value;
    },
    async refreshObsidianStatus() {
      const value = await run(() => unwrap(window.interviewOS.getObsidianStatus()));
      if (value) store.obsidianStatus = value;
      return value;
    },
    async openObsidianNote(entityId: string) {
      return run(() => unwrap(window.interviewOS.openObsidianNote(entityId)));
    },
    async openObsidianFolder() {
      return run(() => unwrap(window.interviewOS.openObsidianFolder()));
    },
    async copyObsidianWikiLink(entityId: string) {
      return run(() => unwrap(window.interviewOS.copyObsidianWikiLink(entityId)), 'WikiLink 已复制');
    },
    async disconnectObsidian() {
      const value = await run(() => unwrap(window.interviewOS.disconnectObsidian()), '已断开 Obsidian Vault');
      if (value) {
        store.obsidianStatus = undefined;
        await refresh();
      }
      return value;
    },
    async saveProvider(input: ProviderInput) {
      const value = await run(() => unwrap(window.interviewOS.saveProvider(toIpcPayload(input))), 'Provider 配置已安全保存');
      if (value) await refresh();
      return value;
    },
    async testProvider() {
      return run(() => unwrap(window.interviewOS.testProvider()));
    },
    async importDocument(target: DocumentImportTarget) {
      const value = await run(() => unwrap(window.interviewOS.importDocument(target)));
      if (value) {
        const notice = value.mode === 'ai-vision' ? '图片识别完成，请核对后保存' : '文件内容已提取，请核对后保存';
        store.notice = notice;
        window.setTimeout(() => { if (store.notice === notice) store.notice = ''; }, 3000);
      }
      return value;
    },
    clearMessages() {
      store.error = '';
      store.notice = '';
    }
  };
}
