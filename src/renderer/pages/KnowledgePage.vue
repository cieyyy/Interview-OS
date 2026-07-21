<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ExternalLink, Link2, RefreshCw } from '@lucide/vue';
import type { DocumentImportResult, KnowledgeInput, KnowledgeItem, KnowledgeStatus, KnowledgeType } from '../../shared/domain';
import DocumentImportButton from '../components/DocumentImportButton.vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const {
  store,
  saveKnowledge,
  deleteKnowledge,
  runObsidianSync,
  openObsidianNote,
  copyObsidianWikiLink
} = useWorkspace();
const search = ref('');
const selectedId = ref<string>();
const form = reactive<KnowledgeInput>({
  type: 'technical', title: '', contentMarkdown: '', tags: [], status: 'draft', source: '', relatedIds: []
});
const tagsText = ref('');
const types: Array<{ value: KnowledgeType; label: string }> = [
  { value: 'technical', label: '技术知识' }, { value: 'incident', label: '故障案例' },
  { value: 'question', label: '面试问题' }, { value: 'answer', label: '面试回答' },
  { value: 'project', label: '项目知识' }, { value: 'jd', label: 'JD 分析' },
  { value: 'learning-plan', label: '学习计划' }, { value: 'company-research', label: '公司研究' },
  { value: 'retrospective', label: '求职复盘' }, { value: 'note', label: '普通笔记' }
];
const statuses: Array<{ value: KnowledgeStatus; label: string }> = [
  { value: 'draft', label: '草稿' }, { value: 'learning', label: '学习中' },
  { value: 'review', label: '待复习' }, { value: 'mastered', label: '已掌握' }
];
const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase();
  return (store.workspace?.knowledge ?? []).filter((item) => !q || [item.title, item.contentMarkdown, ...item.tags].join(' ').toLocaleLowerCase().includes(q));
});
const syncEntry = computed(() => store.workspace?.obsidianSyncIndex.find((item) => item.entityId === selectedId.value));
const obsidianEnabled = computed(() => Boolean(store.workspace?.settings.obsidian.enabled));

function select(item: KnowledgeItem): void {
  selectedId.value = item.id;
  Object.assign(form, item);
  tagsText.value = item.tags.join(', ');
}

function clear(): void {
  selectedId.value = undefined;
  Object.assign(form, { id: undefined, type: 'technical', title: '', contentMarkdown: '', tags: [], status: 'draft', source: '', relatedIds: [] });
  tagsText.value = '';
}

function applyImport(result: DocumentImportResult): void {
  const imported = result.knowledge;
  if (!imported) return;
  clear();
  Object.assign(form, {
    type: imported.type ?? 'technical',
    title: imported.title ?? '',
    contentMarkdown: imported.contentMarkdown ?? result.extractedText,
    status: imported.status ?? 'draft',
    source: imported.source ?? '',
    tags: imported.tags ?? [],
    relatedIds: []
  });
  tagsText.value = imported.tags?.join(', ') ?? '';
}

async function submit(syncAfterSave = false): Promise<void> {
  const saved = await saveKnowledge({ ...form, id: selectedId.value, tags: tagsText.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) });
  if (saved) {
    select(saved);
    if (syncAfterSave) await runObsidianSync(saved.id);
  }
}

async function syncSelected(): Promise<void> {
  if (selectedId.value) await runObsidianSync(selectedId.value);
}

async function openInObsidian(): Promise<void> {
  if (selectedId.value) await openObsidianNote(selectedId.value);
}

async function copyWikiLink(): Promise<void> {
  if (selectedId.value) await copyObsidianWikiLink(selectedId.value);
}

async function remove(): Promise<void> {
  if (!selectedId.value) return;
  if (window.confirm('确认删除这条知识卡片？')) {
    await deleteKnowledge(selectedId.value);
    clear();
  }
}
</script>

<template>
  <section>
    <PageHeader eyebrow="KNOWLEDGE" title="面试知识库" description="把定义、真实场景、故障案例和表达版本连接起来。">
      <DocumentImportButton target="knowledge" label="上传识别" test-id="knowledge-import-file" @imported="applyImport" />
      <button class="button secondary" type="button" @click="clear">新建卡片</button>
    </PageHeader>
    <div class="workspace-layout">
      <aside class="collection-panel">
        <input v-model="search" class="input search-input" placeholder="搜索标题、内容或标签" data-testid="knowledge-search" />
        <div class="collection-list">
          <button
            v-for="item in filtered"
            :key="item.id"
            type="button"
            class="collection-item"
            :class="{ selected: item.id === selectedId }"
            @click="select(item)"
          >
            <span class="type-dot"></span><span><strong>{{ item.title }}</strong><small>{{ types.find((type) => type.value === item.type)?.label }} · {{ item.tags.join(' / ') || '无标签' }}</small></span>
          </button>
          <p v-if="!filtered.length" class="list-empty">没有匹配的知识卡片</p>
        </div>
      </aside>

      <form class="editor-panel" data-testid="knowledge-form" @submit.prevent="submit(false)">
        <div class="editor-topline"><span>{{ selectedId ? '编辑知识' : '新建知识' }}</span><span class="save-state">本地自动保护</span></div>
        <div v-if="selectedId" class="knowledge-sync-toolbar">
          <span class="status-badge" :class="syncEntry?.syncStatus === 'synced' ? 'completed' : syncEntry?.syncStatus === 'conflict' ? 'active' : 'draft'">
            {{ syncEntry?.syncStatus ?? '未同步' }}
          </span>
          <small>{{ syncEntry?.filePath ?? (obsidianEnabled ? '可同步到 Obsidian' : '未启用 Obsidian') }}</small>
          <button class="icon-button" type="button" title="立即同步" :disabled="!obsidianEnabled" @click="syncSelected"><RefreshCw :size="15" /></button>
          <button class="icon-button" type="button" title="在 Obsidian 中打开" :disabled="!syncEntry" @click="openInObsidian"><ExternalLink :size="15" /></button>
          <button class="icon-button" type="button" title="复制 WikiLink" :disabled="!syncEntry" @click="copyWikiLink"><Link2 :size="15" /></button>
        </div>
        <div class="import-summary compact"><span>可从图片、PDF、Word 或文本生成知识草稿</span><small>识别结果不会自动保存，请先检查内容</small></div>
        <div class="form-grid two">
          <label>类型<select v-model="form.type" class="input" data-testid="knowledge-type"><option v-for="item in types" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
          <label>状态<select v-model="form.status" class="input"><option v-for="item in statuses" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
        </div>
        <label>标题<input v-model="form.title" class="input title-input" maxlength="160" required data-testid="knowledge-title" placeholder="例如：Pod 启动失败排查" /></label>
        <label>标签<input v-model="tagsText" class="input" placeholder="Kubernetes, 故障排查" /></label>
        <label>来源<input v-model="form.source" class="input" placeholder="工作实践 / 官方文档 / 学习记录" /></label>
        <label class="grow">内容<textarea v-model="form.contentMarkdown" class="input editor-textarea" required data-testid="knowledge-content" placeholder="用自己的话记录：它解决什么问题、实际怎么用、遇到问题如何排查……"></textarea></label>
        <div class="form-actions"><button v-if="selectedId" class="button danger ghost" type="button" @click="remove">删除</button><span></span><button v-if="obsidianEnabled" class="button secondary" type="button" @click="submit(true)">保存并同步</button><button class="button primary" type="submit" data-testid="knowledge-save">保存知识卡片</button></div>
      </form>
    </div>
  </section>
</template>
