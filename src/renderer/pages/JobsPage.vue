<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { AlertTriangle, ListChecks, Trash2, X } from '@lucide/vue';
import type { DocumentImportResult, JobDescription, JobInput } from '../../shared/domain';
import { analyzeJob as buildJobAnalysis } from '../../shared/job-analyzer';
import DocumentImportButton from '../components/DocumentImportButton.vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, analyzeJob, deleteJobAnalysis, deleteJobAnalyses } = useWorkspace();
const route = useRoute();
const showForm = ref(false);
const selectedId = ref<string>();
const deleteConfirmId = ref<string>();
const selectedJobIds = ref<string[]>([]);
const batchDeleteScope = ref<'selected' | 'all'>();
const form = reactive<JobInput>({ title: '', company: '', rawText: '' });
const selected = computed(() => store.workspace?.jobs.find((item) => item.id === selectedId.value) ?? store.workspace?.jobs[0]);
const selectedAnalysis = computed(() => {
  if (!selected.value || !store.workspace) return undefined;
  return buildJobAnalysis({
    title: selected.value.title,
    company: selected.value.company,
    rawText: selected.value.rawText
  }, store.workspace);
});
const jobs = computed(() => store.workspace?.jobs ?? []);
const allJobsSelected = computed(() => jobs.value.length > 0 && selectedJobIds.value.length === jobs.value.length);
function select(job: JobDescription): void { selectedId.value = job.id; showForm.value = false; }
function requestDelete(job: JobDescription): void { deleteConfirmId.value = job.id; }
async function confirmDelete(job: JobDescription): Promise<void> {
  const result = await deleteJobAnalysis(job.id);
  if (!result?.deleted) return;
  selectedJobIds.value = selectedJobIds.value.filter((id) => id !== job.id);
  deleteConfirmId.value = undefined;
  selectedId.value = undefined;
}
function toggleJobSelection(id: string): void {
  selectedJobIds.value = selectedJobIds.value.includes(id)
    ? selectedJobIds.value.filter((item) => item !== id)
    : [...selectedJobIds.value, id];
}
function toggleAllJobs(): void {
  selectedJobIds.value = allJobsSelected.value ? [] : jobs.value.map((job) => job.id);
}
async function confirmBatchDelete(): Promise<void> {
  const ids = batchDeleteScope.value === 'all' ? jobs.value.map((job) => job.id) : selectedJobIds.value;
  if (!ids.length) return;
  const result = await deleteJobAnalyses(ids);
  if (!result?.deleted) return;
  if (selectedId.value && ids.includes(selectedId.value)) selectedId.value = undefined;
  selectedJobIds.value = selectedJobIds.value.filter((id) => !ids.includes(id));
  batchDeleteScope.value = undefined;
}
watch(
  () => [route.query.jobId, store.workspace?.jobs.length] as const,
  ([jobId]) => {
    if (typeof jobId !== 'string') return;
    if (store.workspace?.jobs.some((job) => job.id === jobId)) {
      selectedId.value = jobId;
      showForm.value = false;
    }
  },
  { immediate: true }
);
watch(jobs, (currentJobs) => {
  const existingIds = new Set(currentJobs.map((job) => job.id));
  selectedJobIds.value = selectedJobIds.value.filter((id) => existingIds.has(id));
});
function applyImport(result: DocumentImportResult): void {
  if (!result.job) return;
  showForm.value = true;
  Object.assign(form, {
    title: result.job.title ?? '',
    company: result.job.company ?? '',
    rawText: result.job.rawText ?? result.extractedText
  });
}
async function submit(): Promise<void> {
  const saved = await analyzeJob(form);
  if (saved) { selectedId.value = saved.id; showForm.value = false; Object.assign(form, { title: '', company: '', rawText: '' }); }
}
const matchLabel = (value: string) => ({ evidenced: '已有证据', related: '相关经验', 'missing-evidence': '缺少证据', gap: '能力缺口' }[value] ?? value);
</script>

<template>
  <section>
    <PageHeader eyebrow="JOB ANALYSIS" title="岗位分析" description="拆解岗位技能、面试重点与学习建议，并说明每项要求对应的真实证据和缺口。">
      <DocumentImportButton target="job" label="上传识别岗位描述" test-id="job-import-file" @imported="applyImport" />
      <button class="button primary" type="button" data-testid="job-add" @click="showForm = true">导入岗位描述</button>
    </PageHeader>

    <form v-if="showForm" class="panel form-card job-import" data-testid="job-form" @submit.prevent="submit">
      <div class="import-summary"><span>支持 PNG/JPG、PDF、DOCX、TXT、Markdown</span><small>文档在本地提取；图片将通过已配置的 AI Provider 识别</small></div>
      <div class="form-grid two"><label>岗位名称<input v-model="form.title" class="input" required data-testid="job-title" /></label><label>公司<input v-model="form.company" class="input" /></label></div>
      <label>岗位描述原文<textarea v-model="form.rawText" class="input jd-textarea" required data-testid="job-raw" placeholder="粘贴岗位职责和任职要求……"></textarea></label>
      <div class="form-actions"><button class="button ghost" type="button" @click="showForm = false">取消</button><span></span><button class="button primary" type="submit" data-testid="job-analyze">离线分析并保存</button></div>
    </form>

    <div v-else class="job-analysis-workspace">
      <div v-if="jobs.length" class="job-batch-toolbar">
        <label class="job-select-all"><input type="checkbox" :checked="allJobsSelected" @change="toggleAllJobs" /><span>全选</span></label>
        <span class="job-selection-count">已选择 {{ selectedJobIds.length }} / {{ jobs.length }} 项</span>
        <span class="toolbar-spacer"></span>
        <button class="button ghost compact" type="button" :disabled="!selectedJobIds.length" data-testid="job-analysis-bulk-delete" @click="batchDeleteScope = 'selected'"><ListChecks :size="15" />删除所选</button>
        <button class="button danger compact" type="button" data-testid="job-analysis-delete-all" @click="batchDeleteScope = 'all'"><Trash2 :size="15" />清空全部自定义分析</button>
      </div>
      <div v-if="batchDeleteScope" class="job-delete-confirm batch" data-testid="job-analysis-bulk-delete-confirm">
        <AlertTriangle :size="18" />
        <div><strong>{{ batchDeleteScope === 'all' ? `确认清空全部 ${jobs.length} 项自定义岗位分析？` : `确认删除选中的 ${selectedJobIds.length} 项岗位分析？` }}</strong><small>系统会先自动备份。岗位池原始数据及历史业务记录会保留，但会解除与被删分析的关联。</small></div>
        <button class="button ghost compact" type="button" @click="batchDeleteScope = undefined"><X :size="15" />取消</button>
        <button class="button danger compact" type="button" data-testid="job-analysis-bulk-delete-submit" @click="confirmBatchDelete"><Trash2 :size="15" />确认删除</button>
      </div>
      <div class="jobs-layout">
        <aside class="collection-panel jobs-list">
          <div v-for="job in jobs" :key="job.id" class="collection-item job-list-item" :class="{ selected: selected?.id === job.id }">
            <input class="job-list-checkbox" type="checkbox" :checked="selectedJobIds.includes(job.id)" :aria-label="`选择 ${job.title}`" @change="toggleJobSelection(job.id)" />
            <button class="job-list-select" type="button" @click="select(job)"><span class="type-dot"></span><span><strong>{{ job.title }}</strong><small>{{ job.company || '未填写公司' }} · {{ job.requirements.length }} 项要求</small></span></button>
          </div>
          <p v-if="!jobs.length" class="list-empty">还没有目标岗位描述</p>
        </aside>
        <article v-if="selected" class="panel job-detail" data-testid="job-detail">
        <div class="job-title"><div><span class="eyebrow">{{ selected.company || 'TARGET JOB' }}</span><h2>{{ selected.title }}</h2></div><div class="job-title-actions"><span class="chip accent">{{ selectedAnalysis?.requirements.length ?? selected.requirements.length }} 项能力</span><button class="icon-command danger" type="button" title="删除岗位分析" data-testid="job-analysis-delete" @click="requestDelete(selected)"><Trash2 :size="16" /></button></div></div>
        <div v-if="deleteConfirmId === selected.id" class="job-delete-confirm" data-testid="job-analysis-delete-confirm">
          <AlertTriangle :size="18" /><div><strong>确认删除“{{ selected.title }}”的岗位分析？</strong><small>系统会先自动备份。关联的简历、投递和训练记录会保留，但会解除与该岗位的关联。</small></div><button class="button ghost compact" type="button" @click="deleteConfirmId = undefined"><X :size="15" />取消</button><button class="button danger compact" type="button" data-testid="job-analysis-delete-submit" @click="confirmDelete(selected)"><Trash2 :size="15" />确认删除</button>
        </div>
        <div class="requirement-list">
          <div v-for="req in (selectedAnalysis?.requirements ?? selected.requirements)" :key="req.id" class="requirement-row"><span class="priority" :class="req.priority">{{ req.priority === 'must' ? '必须' : req.priority === 'preferred' ? '加分' : '场景' }}</span><div><strong>{{ req.label }}</strong><small>{{ req.evidenceSummary }}</small></div><span class="match" :class="req.matchStatus">{{ matchLabel(req.matchStatus) }}</span></div>
        </div>
        <h3 class="section-title">准备清单</h3>
        <div class="task-list simple"><div v-for="task in (selectedAnalysis?.tasks ?? selected.tasks).slice(0, 8)" :key="task.id" class="task-row"><span class="task-check">○</span><span><strong>{{ task.title }}</strong><small>{{ task.bucket }}</small></span></div></div>
        </article>
        <div v-else class="panel empty-panel"><h3>导入第一份目标岗位描述</h3><p>离线分析无需 Docker 或模型 Key。</p><button class="button primary" @click="showForm = true">现在导入</button></div>
      </div>
    </div>
  </section>
</template>
