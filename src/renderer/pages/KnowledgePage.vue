<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ExternalLink, Link2, Network, RefreshCw } from '@lucide/vue';
import type { DocumentImportResult, KnowledgeInput, KnowledgeItem, KnowledgeStatus, KnowledgeType, KnowledgeVisibility } from '../../shared/domain';
import { buildKnowledgeGraph, knowledgeBacklinks, parseWikiLinks } from '../../shared/knowledge-graph';
import DocumentImportButton from '../components/DocumentImportButton.vue';
import PageHeader from '../components/PageHeader.vue';
import MarkdownEditor from '../components/ui/MarkdownEditor.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, saveKnowledge, deleteKnowledge, runObsidianSync, openObsidianNote, copyObsidianWikiLink } = useWorkspace();
const search = ref('');
const viewMode = ref<'editor' | 'graph'>('editor');
const selectedId = ref<string>();
const form = reactive<KnowledgeInput>({
  type: 'technical', title: '', contentMarkdown: '', tags: [], status: 'draft', source: '', relatedIds: [],
  jobIds: [], projectIds: [], skillNames: [], visibility: 'private'
});
const tagsText = ref('');
const skillsText = ref('');
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
const visibilities: Array<{ value: KnowledgeVisibility; label: string }> = [
  { value: 'private', label: '私有' }, { value: 'publish-ready', label: '可发布' }, { value: 'public', label: '公开' }
];
const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase();
  return (store.workspace?.knowledge ?? []).filter((item) => !q || [item.title, item.contentMarkdown, ...item.tags].join(' ').toLocaleLowerCase().includes(q));
});
const syncEntry = computed(() => store.workspace?.obsidianSyncIndex.find((item) => item.entityId === selectedId.value));
const obsidianEnabled = computed(() => Boolean(store.workspace?.settings.obsidian.enabled));
const selectedItem = computed(() => store.workspace?.knowledge.find((item) => item.id === selectedId.value));
const backlinks = computed(() => selectedItem.value && store.workspace ? knowledgeBacklinks(store.workspace.knowledge, selectedItem.value) : []);
const wikiLinks = computed(() => parseWikiLinks(form.contentMarkdown));
const graph = computed(() => store.workspace ? buildKnowledgeGraph(store.workspace) : { nodes: [], edges: [] });
const selectedGraphNodeId = ref('');
const graphSections = computed(() => ({
  knowledge: graph.value.nodes.filter((item) => item.kind === 'knowledge').slice(0, 30),
  business: graph.value.nodes.filter((item) => ['project', 'job'].includes(item.kind)).slice(0, 30),
  skills: graph.value.nodes.filter((item) => item.kind === 'skill').slice(0, 40)
}));
const visibleGraphEdges = computed(() => selectedGraphNodeId.value
  ? graph.value.edges.filter((edge) => edge.source === selectedGraphNodeId.value || edge.target === selectedGraphNodeId.value)
  : graph.value.edges.slice(0, 20));
const relationLabels = { related: '关联', wikilink: '双向链接', project: '项目', job: '岗位', skill: '技能' };

function openGraph(): void {
  viewMode.value = 'graph';
  selectedGraphNodeId.value = selectedId.value && graph.value.nodes.some((node) => node.id === selectedId.value)
    ? selectedId.value
    : graph.value.nodes.find((node) => node.kind === 'knowledge')?.id ?? '';
}

function select(item: KnowledgeItem): void {
  selectedId.value = item.id;
  Object.assign(form, item, {
    relatedIds: [...(item.relatedIds ?? [])], jobIds: [...(item.jobIds ?? [])], projectIds: [...(item.projectIds ?? [])],
    skillNames: [...(item.skillNames ?? [])], visibility: item.visibility ?? 'private'
  });
  tagsText.value = item.tags.join(', ');
  skillsText.value = item.skillNames.join(', ');
  viewMode.value = 'editor';
}

function selectById(id: string): void {
  const item = store.workspace?.knowledge.find((entry) => entry.id === id);
  if (item) select(item);
}

function clear(): void {
  selectedId.value = undefined;
  Object.assign(form, { id: undefined, type: 'technical', title: '', contentMarkdown: '', tags: [], status: 'draft', source: '', relatedIds: [], jobIds: [], projectIds: [], skillNames: [], visibility: 'private', reviewAt: undefined });
  tagsText.value = '';
  skillsText.value = '';
  viewMode.value = 'editor';
}

function applyImport(result: DocumentImportResult): void {
  const imported = result.knowledge;
  if (!imported) return;
  clear();
  Object.assign(form, {
    type: imported.type ?? 'technical', title: imported.title ?? '', contentMarkdown: imported.contentMarkdown ?? result.extractedText,
    status: imported.status ?? 'draft', source: imported.source ?? '', tags: imported.tags ?? [], relatedIds: [], jobIds: [],
    projectIds: [], skillNames: imported.tags ?? [], visibility: 'private'
  });
  tagsText.value = imported.tags?.join(', ') ?? '';
  skillsText.value = imported.tags?.join(', ') ?? '';
}

async function submit(syncAfterSave = false): Promise<void> {
  const saved = await saveKnowledge({
    ...form, id: selectedId.value,
    tags: tagsText.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
    skillNames: skillsText.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
  });
  if (saved) { select(saved); if (syncAfterSave) await runObsidianSync(saved.id); }
}

function openWikiLink(title: string): void {
  const item = store.workspace?.knowledge.find((entry) => entry.title.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase());
  if (item) select(item);
}

async function syncSelected(): Promise<void> { if (selectedId.value) await runObsidianSync(selectedId.value); }
async function openInObsidian(): Promise<void> { if (selectedId.value) await openObsidianNote(selectedId.value); }
async function copyWikiLink(): Promise<void> { if (selectedId.value) await copyObsidianWikiLink(selectedId.value); }
async function remove(): Promise<void> {
  if (selectedId.value && window.confirm('确认删除这条知识卡片？')) { await deleteKnowledge(selectedId.value); clear(); }
}
</script>

<template>
  <section>
    <PageHeader eyebrow="KNOWLEDGE SPACE" title="知识空间" description="在软件内部用 Markdown、标签、属性、双向链接和关系图连接项目、技能、岗位与训练结果。">
      <DocumentImportButton target="knowledge" label="上传识别" test-id="knowledge-import-file" @imported="applyImport" />
      <button class="button secondary" type="button" @click="clear">新建知识</button>
    </PageHeader>

    <div class="knowledge-view-switch segmented"><button :class="{ active: viewMode === 'editor' }" data-testid="knowledge-editor-tab" type="button" @click="viewMode = 'editor'">编辑与属性</button><button :class="{ active: viewMode === 'graph' }" data-testid="knowledge-graph-tab" type="button" @click="openGraph"><Network :size="15" />知识图谱</button></div>

    <div v-if="viewMode === 'editor'" class="workspace-layout knowledge-space-layout">
      <aside class="collection-panel">
        <input v-model="search" class="input search-input" placeholder="搜索标题、内容或标签" data-testid="knowledge-search" />
        <div class="collection-list">
          <button v-for="item in filtered" :key="item.id" type="button" class="collection-item" :class="{ selected: item.id === selectedId }" @click="select(item)">
            <span class="type-dot"></span><span><strong>{{ item.title }}</strong><small>{{ types.find((type) => type.value === item.type)?.label }} · {{ item.tags.join(' / ') || '无标签' }}</small><em>{{ visibilities.find((value) => value.value === item.visibility)?.label ?? '私有' }}</em></span>
          </button>
          <p v-if="!filtered.length" class="list-empty">没有匹配的知识内容</p>
        </div>
      </aside>

      <form class="editor-panel" data-testid="knowledge-form" @submit.prevent="submit(false)">
        <div class="editor-topline"><span>{{ selectedId ? '编辑知识' : '新建知识' }}</span><span class="save-state">本地自动保护</span></div>
        <div class="import-summary compact"><span>支持图片、PDF、Word 与文本导入</span><small>核对并保存后才进入知识空间</small></div>
        <div class="form-grid knowledge-properties-grid">
          <label>类型<select v-model="form.type" class="input" data-testid="knowledge-type"><option v-for="item in types" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
          <label>状态<select v-model="form.status" class="input"><option v-for="item in statuses" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
          <label>可见性<select v-model="form.visibility" class="input"><option v-for="item in visibilities" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
          <label>复习时间<input v-model="form.reviewAt" class="input" type="date" /></label>
        </div>
        <label>标题<input v-model="form.title" class="input title-input" maxlength="160" required data-testid="knowledge-title" placeholder="例如：Pod 启动失败排查" /></label>
        <div class="form-grid two"><label>标签<input v-model="tagsText" class="input" placeholder="Kubernetes, 故障排查" /></label><label>技能<input v-model="skillsText" class="input" placeholder="Kubernetes, Docker" /></label></div>
        <label>来源<input v-model="form.source" class="input" placeholder="工作实践 / 官方文档 / 学习记录" /></label>
        <details class="knowledge-relations"><summary>关联岗位、项目和知识</summary><div class="form-grid knowledge-properties-grid"><label>关联项目<select v-model="form.projectIds" class="input" multiple><option v-for="item in store.workspace?.projects" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label>关联岗位<select v-model="form.jobIds" class="input" multiple><option v-for="item in store.workspace?.jobs" :key="item.id" :value="item.id">{{ item.company }} · {{ item.title }}</option></select></label><label>关联知识<select v-model="form.relatedIds" class="input" multiple><option v-for="item in store.workspace?.knowledge.filter((entry) => entry.id !== selectedId)" :key="item.id" :value="item.id">{{ item.title }}</option></select></label></div></details>
        <MarkdownEditor v-model="form.contentMarkdown" class="grow" test-id="knowledge-content" />
        <div v-if="selectedId" class="knowledge-links-panel"><section><h3>双向链接</h3><div v-if="wikiLinks.length" class="tag-row"><button v-for="title in wikiLinks" :key="title" type="button" @click="openWikiLink(title)">[[{{ title }}]]</button></div><p v-else>输入 <code>[[知识标题]]</code> 建立内部链接。</p></section><section><h3>反向链接</h3><div v-if="backlinks.length" class="knowledge-backlinks"><button v-for="item in backlinks" :key="item.id" type="button" @click="selectById(item.id)">{{ item.title }}</button></div><p v-else>还没有其他内容引用当前知识。</p></section></div>
        <details v-if="selectedId" class="legacy-integration"><summary>兼容导出：Obsidian</summary><div class="knowledge-sync-toolbar"><span class="status-badge" :class="syncEntry?.syncStatus === 'synced' ? 'completed' : syncEntry?.syncStatus === 'conflict' ? 'active' : 'draft'">{{ syncEntry?.syncStatus ?? '未同步' }}</span><small>{{ syncEntry?.filePath ?? (obsidianEnabled ? '可选单向导出' : '未启用') }}</small><button class="icon-button" type="button" title="立即同步" :disabled="!obsidianEnabled" @click="syncSelected"><RefreshCw :size="15" /></button><button class="icon-button" type="button" title="在 Obsidian 中打开" :disabled="!syncEntry" @click="openInObsidian"><ExternalLink :size="15" /></button><button class="icon-button" type="button" title="复制 WikiLink" :disabled="!syncEntry" @click="copyWikiLink"><Link2 :size="15" /></button></div></details>
        <div class="form-actions"><button v-if="selectedId" class="button danger ghost" type="button" @click="remove">删除</button><span></span><button class="button primary" type="submit" data-testid="knowledge-save">保存到知识空间</button></div>
      </form>
    </div>

    <div v-else class="panel knowledge-graph-board">
      <header><div><span class="eyebrow">RELATION GRAPH</span><h2>知识关系图</h2><p>选择一个节点查看它的直接关系；浏览图谱不会创建或修改知识。</p></div><div class="graph-summary"><strong>{{ graph.nodes.length }} 节点 · {{ graph.edges.length }} 关系</strong><small>当前显示 {{ visibleGraphEdges.length }} 条</small><button v-if="selectedGraphNodeId" type="button" @click="selectedGraphNodeId = ''">显示全部概览</button></div></header>
      <div class="knowledge-graph-columns">
        <section><h3>知识</h3><button v-for="node in graphSections.knowledge" :key="node.id" type="button" :class="{ selected: node.id === selectedGraphNodeId }" @click="selectedGraphNodeId = node.id">{{ node.label }}</button></section>
        <section><h3>项目 / 岗位</h3><button v-for="node in graphSections.business" :key="node.id" type="button" :class="{ selected: node.id === selectedGraphNodeId }" @click="selectedGraphNodeId = node.id">{{ node.label }}</button></section>
        <section><h3>技能</h3><button v-for="node in graphSections.skills" :key="node.id" type="button" :class="{ selected: node.id === selectedGraphNodeId }" @click="selectedGraphNodeId = node.id">{{ node.label }}</button></section>
      </div>
      <div class="knowledge-edge-list"><span v-for="edge in visibleGraphEdges" :key="`${edge.source}-${edge.target}-${edge.relation}`"><b>{{ graph.nodes.find((node) => node.id === edge.source)?.label }}</b><i>{{ relationLabels[edge.relation] }}</i><b>{{ graph.nodes.find((node) => node.id === edge.target)?.label }}</b></span><p v-if="!visibleGraphEdges.length">当前节点暂无直接关系。</p></div>
    </div>
  </section>
</template>
