<script setup lang="ts">
import { computed, onMounted, reactive, ref, watchEffect } from 'vue';
import {
  CheckCircle2,
  Eye,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Save,
  Unplug
} from '@lucide/vue';
import type { ObsidianEntityType, ObsidianIntegrationSettings } from '../../shared/domain';
import { createDefaultObsidianSettings } from '../../shared/domain';
import { useWorkspace } from '../composables/useWorkspace';

const {
  store,
  selectObsidianVault,
  createObsidianVault,
  testObsidianVault,
  updateObsidianSettings,
  previewObsidianSync,
  runObsidianSync,
  refreshObsidianStatus,
  openObsidianFolder,
  disconnectObsidian
} = useWorkspace();

const form = reactive<ObsidianIntegrationSettings>(createDefaultObsidianSettings());
const feedback = ref('');
const entityOptions: Array<{ value: ObsidianEntityType; label: string }> = [
  { value: 'project', label: '项目经历' },
  { value: 'incident', label: '故障案例' },
  { value: 'technical-knowledge', label: '技术知识' },
  { value: 'interview-question', label: '面试问题' },
  { value: 'interview-answer', label: '回答与表达训练' },
  { value: 'jd-analysis', label: '岗位分析' },
  { value: 'learning-plan', label: '学习计划' },
  { value: 'company-research', label: '公司研究' },
  { value: 'retrospective', label: '求职复盘' },
  { value: 'resume-metadata', label: '简历元数据' }
];

const configured = computed(() => Boolean(form.enabled && form.vaultPath));
const statusLabel = computed(() => {
  if (!form.enabled) return '未启用';
  if (store.obsidianStatus?.available) return 'Vault 可用';
  return '需要检查';
});

watchEffect(() => {
  const current = store.workspace?.settings.obsidian;
  if (!current) return;
  Object.assign(form, JSON.parse(JSON.stringify(current)) as ObsidianIntegrationSettings);
});

onMounted(() => { void refreshObsidianStatus(); });

async function selectVault(): Promise<void> {
  const result = await selectObsidianVault();
  if (result) {
    feedback.value = result.hasObsidianDirectory
      ? '已连接现有 Obsidian Vault，未修改 .obsidian。'
      : '已连接普通 Markdown 目录，可在安装 Obsidian 后直接打开。';
    await refreshObsidianStatus();
  }
}

async function createVault(): Promise<void> {
  const result = await createObsidianVault();
  if (result) {
    feedback.value = '专属职业知识 Vault 已创建，目录、模板和首页已初始化。';
    await refreshObsidianStatus();
  }
}

async function saveSettings(): Promise<void> {
  const value = await updateObsidianSettings(form);
  if (value) feedback.value = '同步范围和目录配置已保存。';
}

async function testVault(): Promise<void> {
  const result = await testObsidianVault();
  if (result) feedback.value = result.message;
}

async function preview(): Promise<void> {
  const result = await previewObsidianSync();
  if (result) feedback.value = `预览完成：${result.items.length} 个对象，不会写入文件。`;
}

async function sync(): Promise<void> {
  const result = await runObsidianSync();
  if (result) {
    feedback.value = `同步完成：新建 ${result.created}，更新 ${result.updated}，冲突 ${result.conflicts}，失败 ${result.failed}。`;
  }
}

async function openFolder(): Promise<void> {
  await openObsidianFolder();
}

async function disconnect(): Promise<void> {
  if (!window.confirm('确认断开 Vault？Interview OS 本地知识和 Vault 文件都不会被删除。')) return;
  const result = await disconnectObsidian();
  if (result) feedback.value = '已断开 Vault，本地知识保持不变。';
}
</script>

<template>
  <article class="panel settings-card obsidian-settings" data-testid="obsidian-settings">
    <div class="settings-heading">
      <div>
        <span class="settings-icon"><FolderOpen :size="18" aria-hidden="true" /></span>
        <div>
          <h3>知识库与 Obsidian</h3>
          <p>Phase 1：标准 Markdown 单向导出，不修改 .obsidian</p>
        </div>
      </div>
      <span class="status-badge" :class="store.obsidianStatus?.available ? 'completed' : 'draft'">{{ statusLabel }}</span>
    </div>

    <div class="obsidian-actions primary-actions">
      <button class="button secondary" type="button" data-testid="obsidian-select-vault" @click="selectVault">
        <FolderOpen :size="15" aria-hidden="true" />连接现有 Vault
      </button>
      <button class="button secondary" type="button" data-testid="obsidian-create-vault" @click="createVault">
        <FolderPlus :size="15" aria-hidden="true" />创建专属 Vault
      </button>
      <button v-if="configured" class="button ghost" type="button" @click="openFolder">
        打开目录
      </button>
    </div>

    <dl class="obsidian-summary">
      <div><dt>Vault 路径</dt><dd>{{ form.vaultPath || '尚未连接' }}</dd></div>
      <div><dt>工作目录</dt><dd>{{ store.obsidianStatus?.workspacePath || form.workspaceSubdirectory }}</dd></div>
      <div><dt>同步方向</dt><dd>Interview OS → Obsidian</dd></div>
      <div><dt>同步状态</dt><dd>已同步 {{ store.obsidianStatus?.synced ?? 0 }} · 冲突 {{ store.obsidianStatus?.conflicts ?? 0 }} · 失败 {{ store.obsidianStatus?.failed ?? 0 }}</dd></div>
    </dl>

    <form class="obsidian-config" @submit.prevent="saveSettings">
      <div class="form-grid three">
        <label>工作子目录<input v-model="form.workspaceSubdirectory" class="input" :disabled="form.mode === 'dedicated-vault'" /></label>
        <label>附件目录<input v-model="form.attachmentDirectory" class="input" /></label>
        <label>同步间隔（秒）<input v-model.number="form.syncIntervalSeconds" class="input" type="number" min="30" max="86400" /></label>
      </div>

      <div class="settings-toggle-row">
        <label class="inline-check"><input v-model="form.enabled" type="checkbox" />启用集成</label>
        <label class="inline-check"><input v-model="form.autoSync" type="checkbox" disabled />自动同步（Phase 3）</label>
        <label class="inline-check"><input v-model="form.scanOnStartup" type="checkbox" disabled />启动扫描（Phase 2）</label>
        <label class="inline-check"><input v-model="form.syncFullResume" type="checkbox" disabled />完整简历（后续阶段）</label>
      </div>

      <fieldset class="sync-scope">
        <legend>同步范围</legend>
        <div class="checkbox-grid">
          <label v-for="option in entityOptions" :key="option.value" class="inline-check">
            <input v-model="form.enabledEntityTypes" type="checkbox" :value="option.value" />{{ option.label }}
          </label>
        </div>
      </fieldset>

      <details class="folder-mapping">
        <summary>目录映射</summary>
        <div class="form-grid three">
          <label>项目经历<input v-model="form.folderMapping.projects" class="input" /></label>
          <label>故障案例<input v-model="form.folderMapping.incidents" class="input" /></label>
          <label>技术知识<input v-model="form.folderMapping.technicalKnowledge" class="input" /></label>
          <label>面试题库<input v-model="form.folderMapping.interviewQuestions" class="input" /></label>
          <label>表达训练<input v-model="form.folderMapping.expressionTraining" class="input" /></label>
          <label>岗位分析<input v-model="form.folderMapping.jdAnalysis" class="input" /></label>
        </div>
      </details>

      <div class="obsidian-actions">
        <button class="button secondary" type="button" :disabled="!configured" @click="testVault">
          <CheckCircle2 :size="15" aria-hidden="true" />测试目录
        </button>
        <button class="button secondary" type="button" :disabled="!configured" data-testid="obsidian-preview" @click="preview">
          <Eye :size="15" aria-hidden="true" />首次同步预览
        </button>
        <button class="button primary" type="button" :disabled="!configured" data-testid="obsidian-run-sync" @click="sync">
          <RefreshCw :size="15" aria-hidden="true" />立即同步
        </button>
        <button class="button secondary" type="submit"><Save :size="15" aria-hidden="true" />保存配置</button>
        <button class="button danger ghost" type="button" :disabled="!configured" data-testid="obsidian-disconnect" @click="disconnect">
          <Unplug :size="15" aria-hidden="true" />断开 Vault
        </button>
      </div>
    </form>

    <p v-if="feedback" class="path-result" data-testid="obsidian-feedback">{{ feedback }}</p>

    <div v-if="store.obsidianPreview?.items.length" class="sync-preview" data-testid="obsidian-preview-list">
      <div class="sync-preview-head"><strong>首次同步预览</strong><span>{{ store.obsidianPreview.items.length }} 项</span></div>
      <div class="sync-preview-list">
        <div v-for="item in store.obsidianPreview.items.slice(0, 30)" :key="`${item.entityType}:${item.entityId}`">
          <span class="status-badge" :class="item.action === 'conflict' ? 'active' : item.action === 'skip' ? 'draft' : 'completed'">{{ item.action }}</span>
          <span><strong>{{ item.title }}</strong><small>{{ item.filePath }} · {{ item.reason }}</small></span>
        </div>
      </div>
    </div>
  </article>
</template>
