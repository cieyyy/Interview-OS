<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { CalendarClock, Copy, ExternalLink, MapPin, MessageSquareText, Plus, Search, Sparkles, WalletCards } from '@lucide/vue';
import type { ApplicationPriority, ApplicationStatus, JobApplication, JobApplicationInput } from '../../shared/domain';
import { buildGreetingDraft } from '../../shared/job-intelligence';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, saveApplication } = useWorkspace();
const showForm = ref(false);
const search = ref('');
const priorityFilter = ref<'all' | ApplicationPriority>('all');

const emptyForm = (): JobApplicationInput => ({
  jobId: '', company: '', title: '', source: '', sourceUrl: '', location: '', salaryRange: '',
  status: 'saved', priority: 'medium', deadline: '', appliedAt: '', nextAction: '', nextActionAt: '', notes: '',
  greetingDraft: '', submissionMode: 'manual'
});
const form = reactive<JobApplicationInput>(emptyForm());

const statusLabels: Record<ApplicationStatus, string> = {
  saved: '已收藏', preparing: '准备中', applied: '已投递', screening: '沟通中',
  interview: '面试中', offer: 'Offer', rejected: '未通过', withdrawn: '已放弃'
};
const columns: Array<{ key: string; title: string; statuses: ApplicationStatus[] }> = [
  { key: 'focus', title: '关注与准备', statuses: ['saved', 'preparing'] },
  { key: 'applied', title: '已投递', statuses: ['applied'] },
  { key: 'screening', title: '沟通推进', statuses: ['screening'] },
  { key: 'interview', title: '面试阶段', statuses: ['interview'] },
  { key: 'result', title: '结果归档', statuses: ['offer', 'rejected', 'withdrawn'] }
];

const applications = computed(() => store.workspace?.applications ?? []);
const filtered = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  return applications.value.filter((item) => {
    const matchesKeyword = !keyword || `${item.company} ${item.title} ${item.source} ${item.location}`.toLocaleLowerCase().includes(keyword);
    const matchesPriority = priorityFilter.value === 'all' || item.priority === priorityFilter.value;
    return matchesKeyword && matchesPriority;
  });
});
const activeCount = computed(() => applications.value.filter((item) => !['offer', 'rejected', 'withdrawn'].includes(item.status)).length);
const interviewCount = computed(() => applications.value.filter((item) => item.status === 'interview').length);
const offerCount = computed(() => applications.value.filter((item) => item.status === 'offer').length);
const dueSoonCount = computed(() => {
  const now = Date.now();
  const limit = now + 7 * 24 * 60 * 60 * 1000;
  return applications.value.filter((item) => item.deadline && new Date(item.deadline).getTime() >= now && new Date(item.deadline).getTime() <= limit).length;
});

watch(() => form.jobId, (jobId) => {
  if (!jobId) return;
  const job = store.workspace?.jobs.find((item) => item.id === jobId);
  if (job) {
    form.company = job.company;
    form.title = job.title;
  }
});

function localDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function displayDate(value?: string): string {
  return value ? new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}

function resetForm(): void {
  Object.assign(form, emptyForm());
}

function createOpportunity(): void {
  resetForm();
  showForm.value = true;
}

function editOpportunity(item: JobApplication): void {
  Object.assign(form, {
    ...item,
    deadline: localDateTime(item.deadline),
    appliedAt: localDateTime(item.appliedAt),
    nextActionAt: localDateTime(item.nextActionAt)
  });
  showForm.value = true;
}

async function submit(): Promise<void> {
  const saved = await saveApplication(form);
  if (saved) {
    showForm.value = false;
    resetForm();
  }
}

function itemsFor(statuses: ApplicationStatus[]): JobApplication[] {
  return filtered.value.filter((item) => statuses.includes(item.status));
}

function generateGreeting(): void {
  const job = form.jobId ? store.workspace?.jobs.find((item) => item.id === form.jobId) : undefined;
  form.greetingDraft = buildGreetingDraft(store.workspace!.profile, {
    title: form.title || job?.title || '目标岗位', company: form.company || job?.company, description: job?.rawText
  });
}

async function copyGreeting(): Promise<void> {
  if (form.greetingDraft) await navigator.clipboard.writeText(form.greetingDraft);
}
</script>

<template>
  <section>
    <PageHeader eyebrow="PIPELINE" title="求职管道" description="把职位机会、投递进展、面试节点和下一步动作放进同一条可追溯流程。">
      <button class="button primary" type="button" data-testid="application-add" @click="createOpportunity"><Plus :size="16" aria-hidden="true" />新增机会</button>
    </PageHeader>

    <div class="career-metrics">
      <div><span>活跃机会</span><strong data-testid="application-active-count">{{ activeCount }}</strong></div>
      <div><span>面试阶段</span><strong>{{ interviewCount }}</strong></div>
      <div><span>已获 Offer</span><strong>{{ offerCount }}</strong></div>
      <div><span>7 天内截止</span><strong>{{ dueSoonCount }}</strong></div>
    </div>

    <form v-if="showForm" class="panel career-form" data-testid="application-form" @submit.prevent="submit">
      <div class="panel-heading"><div><span class="eyebrow">OPPORTUNITY</span><h3>{{ form.id ? '更新求职进展' : '新增职位机会' }}</h3></div></div>
      <div class="form-grid three">
        <label>关联 JD<select v-model="form.jobId" class="input"><option value="">不关联</option><option v-for="job in store.workspace?.jobs" :key="job.id" :value="job.id">{{ job.company }} · {{ job.title }}</option></select></label>
        <label>公司<input v-model="form.company" class="input" /></label>
        <label>岗位<input v-model="form.title" class="input" required data-testid="application-title" /></label>
      </div>
      <div class="form-grid three">
        <label>来源<input v-model="form.source" class="input" placeholder="官网 / Boss / 内推" /></label>
        <label>地点<input v-model="form.location" class="input" /></label>
        <label>薪资范围<input v-model="form.salaryRange" class="input" placeholder="例如 20K-30K" /></label>
      </div>
      <label>职位链接<input v-model="form.sourceUrl" class="input" type="url" placeholder="https://" /></label>
      <div class="form-grid three">
        <label>阶段<select v-model="form.status" class="input" data-testid="application-status"><option v-for="(label, value) in statusLabels" :key="value" :value="value">{{ label }}</option></select></label>
        <label>优先级<select v-model="form.priority" class="input"><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
        <label>报名截止<input v-model="form.deadline" class="input" type="datetime-local" /></label>
      </div>
      <div class="form-grid two">
        <label>下一步动作<input v-model="form.nextAction" class="input" placeholder="准备自我介绍、跟进 HR、参加二面……" /></label>
        <label>下一步时间<input v-model="form.nextActionAt" class="input" type="datetime-local" /></label>
      </div>
      <div class="application-greeting-field">
        <div><label>沟通话术草稿</label><span><button class="button ghost compact" type="button" @click="generateGreeting"><Sparkles :size="14" />基于真实档案生成</button><button class="icon-command" type="button" title="复制话术" @click="copyGreeting"><Copy :size="14" /></button></span></div>
        <textarea v-model="form.greetingDraft" class="input compact-textarea" placeholder="用于打招呼或申请备注；发送前请人工核对。"></textarea>
        <div class="submission-safety"><MessageSquareText :size="15" /><span><strong>投递方式</strong><small>当前只生成材料并记录进度，不会自动向招聘平台发送。</small></span><select v-model="form.submissionMode" class="input compact-select"><option value="manual">人工投递</option><option value="assisted">辅助投递（框架）</option></select></div>
      </div>
      <label>备注<textarea v-model="form.notes" class="input compact-textarea" placeholder="岗位判断、沟通记录、面试信息和风险点……"></textarea></label>
      <div class="form-actions"><button class="button ghost" type="button" @click="showForm = false">取消</button><span></span><button class="button primary" type="submit" data-testid="application-save">保存机会</button></div>
    </form>

    <div v-else>
      <div class="career-toolbar">
        <label class="search-field"><Search :size="16" aria-hidden="true" /><input v-model="search" aria-label="搜索求职机会" placeholder="搜索公司、岗位、来源或地点" /></label>
        <select v-model="priorityFilter" class="input compact-select" aria-label="筛选优先级"><option value="all">全部优先级</option><option value="high">高优先级</option><option value="medium">中优先级</option><option value="low">低优先级</option></select>
      </div>

      <div v-if="applications.length" class="application-board" data-testid="application-board">
        <section v-for="column in columns" :key="column.key" class="pipeline-column">
          <header><h3>{{ column.title }}</h3><span>{{ itemsFor(column.statuses).length }}</span></header>
          <article v-for="item in itemsFor(column.statuses)" :key="item.id" class="application-card">
            <button class="application-card-main" type="button" @click="editOpportunity(item)">
              <div class="application-card-head"><span class="priority-dot" :class="item.priority"></span><strong>{{ item.title }}</strong><span class="status-badge" :class="item.status">{{ statusLabels[item.status] }}</span></div>
              <p>{{ item.company || '未填写公司' }}</p>
              <div class="application-meta"><span v-if="item.location"><MapPin :size="13" />{{ item.location }}</span><span v-if="item.salaryRange"><WalletCards :size="13" />{{ item.salaryRange }}</span></div>
              <div v-if="item.nextAction" class="next-action"><CalendarClock :size="14" /><span><b>{{ item.nextAction }}</b><small>{{ displayDate(item.nextActionAt) || '未设置时间' }}</small></span></div>
            </button>
            <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noreferrer"><ExternalLink :size="14" />查看职位</a>
          </article>
          <p v-if="!itemsFor(column.statuses).length" class="column-empty">暂无机会</p>
        </section>
      </div>
      <div v-else class="empty-state career-empty"><div class="empty-icon"><WalletCards :size="22" /></div><h3>建立第一条求职机会</h3><p>可以先关联已经分析过的 JD，再持续更新投递阶段和下一步动作。</p><button class="button primary" type="button" @click="createOpportunity">新增机会</button></div>
    </div>
  </section>
</template>
