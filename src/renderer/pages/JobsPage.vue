<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { DocumentImportResult, JobDescription, JobInput } from '../../shared/domain';
import DocumentImportButton from '../components/DocumentImportButton.vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, analyzeJob } = useWorkspace();
const showForm = ref(false);
const selectedId = ref<string>();
const form = reactive<JobInput>({ title: '', company: '', rawText: '' });
const selected = computed(() => store.workspace?.jobs.find((item) => item.id === selectedId.value) ?? store.workspace?.jobs[0]);
function select(job: JobDescription): void { selectedId.value = job.id; showForm.value = false; }
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
    <PageHeader eyebrow="TARGET" title="JD 中心" description="不是只给匹配分，而是说明每项要求对应的真实证据和缺口。">
      <DocumentImportButton target="job" label="上传识别 JD" test-id="job-import-file" @imported="applyImport" />
      <button class="button primary" type="button" data-testid="job-add" @click="showForm = true">导入 JD</button>
    </PageHeader>

    <form v-if="showForm" class="panel form-card job-import" data-testid="job-form" @submit.prevent="submit">
      <div class="import-summary"><span>支持 PNG/JPG、PDF、DOCX、TXT、Markdown</span><small>文档在本地提取；图片将通过已配置的 AI Provider 识别</small></div>
      <div class="form-grid two"><label>岗位名称<input v-model="form.title" class="input" required data-testid="job-title" /></label><label>公司<input v-model="form.company" class="input" /></label></div>
      <label>JD 原文<textarea v-model="form.rawText" class="input jd-textarea" required data-testid="job-raw" placeholder="粘贴岗位职责和任职要求……"></textarea></label>
      <div class="form-actions"><button class="button ghost" type="button" @click="showForm = false">取消</button><span></span><button class="button primary" type="submit" data-testid="job-analyze">离线分析并保存</button></div>
    </form>

    <div v-else class="jobs-layout">
      <aside class="collection-panel jobs-list">
        <button v-for="job in store.workspace?.jobs" :key="job.id" class="collection-item" :class="{ selected: selected?.id === job.id }" type="button" @click="select(job)"><span class="type-dot"></span><span><strong>{{ job.title }}</strong><small>{{ job.company || '未填写公司' }} · {{ job.requirements.length }} 项要求</small></span></button>
        <p v-if="!store.workspace?.jobs.length" class="list-empty">还没有目标 JD</p>
      </aside>
      <article v-if="selected" class="panel job-detail" data-testid="job-detail">
        <div class="job-title"><div><span class="eyebrow">{{ selected.company || 'TARGET JOB' }}</span><h2>{{ selected.title }}</h2></div><span class="chip accent">{{ selected.requirements.length }} 项能力</span></div>
        <div class="requirement-list">
          <div v-for="req in selected.requirements" :key="req.id" class="requirement-row"><span class="priority" :class="req.priority">{{ req.priority === 'must' ? '必须' : req.priority === 'preferred' ? '加分' : '场景' }}</span><div><strong>{{ req.label }}</strong><small>{{ req.evidenceSummary }}</small></div><span class="match" :class="req.matchStatus">{{ matchLabel(req.matchStatus) }}</span></div>
        </div>
        <h3 class="section-title">准备清单</h3>
        <div class="task-list simple"><div v-for="task in selected.tasks.slice(0, 8)" :key="task.id" class="task-row"><span class="task-check">○</span><span><strong>{{ task.title }}</strong><small>{{ task.bucket }}</small></span></div></div>
      </article>
      <div v-else class="panel empty-panel"><h3>导入第一份目标 JD</h3><p>离线分析无需 Docker 或模型 Key。</p><button class="button primary" @click="showForm = true">现在导入</button></div>
    </div>
  </section>
</template>
