import { computed, reactive } from 'vue';
import type {
  AppMeta,
  DocumentImportTarget,
  JobInput,
  KnowledgeInput,
  ProfileInput,
  ProjectInput,
  ProviderInput,
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
