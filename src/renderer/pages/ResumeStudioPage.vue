<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { BadgeCheck, Copy, FileText, Plus, Sparkles, Target } from '@lucide/vue';
import type { ResumeVariant, ResumeVariantInput } from '../../shared/domain';
import { buildResumeDraft } from '../../shared/career-engine';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, saveResumeVariant, copyText } = useWorkspace();
const route = useRoute();
const editing = ref(false);
const copyMessage = ref('');
const emptyForm = (): ResumeVariantInput => ({
  name: '', jobId: '', headline: '', summary: '', highlights: [], projectIds: [], skillIds: [], status: 'draft'
});
const form = reactive<ResumeVariantInput>(emptyForm());
const highlightText = computed({
  get: () => (form.highlights ?? []).join('\n'),
  set: (value: string) => { form.highlights = value.split('\n').map((item) => item.trim()).filter(Boolean); }
});
const previewProjects = computed(() => store.workspace?.projects.filter((item) => form.projectIds?.includes(item.id)) ?? []);
const previewSkills = computed(() => store.workspace?.profile.skills.filter((item) => form.skillIds?.includes(item.id)) ?? []);
const targetJob = computed(() => store.workspace?.jobs.find((item) => item.id === form.jobId));
const consumedJobQuery = ref('');

watch(
  () => [route.query.jobId, store.workspace?.jobs.length] as const,
  ([value]) => {
    if (typeof value !== 'string' || value === consumedJobQuery.value || !store.workspace?.jobs.some((item) => item.id === value)) return;
    consumedJobQuery.value = value;
    Object.assign(form, emptyForm(), buildResumeDraft(store.workspace!, value));
    editing.value = true;
  },
  { immediate: true }
);

function newVariant(): void {
  Object.assign(form, emptyForm());
  editing.value = true;
  copyMessage.value = '';
}

function selectVariant(item: ResumeVariant): void {
  Object.assign(form, {
    id: item.id,
    name: item.name,
    jobId: item.jobId ?? '',
    headline: item.headline,
    summary: item.summary,
    highlights: [...item.highlights],
    projectIds: [...item.projectIds],
    skillIds: [...item.skillIds],
    status: item.status
  });
  editing.value = true;
  copyMessage.value = '';
}

function generateDraft(): void {
  if (!store.workspace) return;
  const id = form.id;
  Object.assign(form, buildResumeDraft(store.workspace, form.jobId || undefined));
  if (id) form.id = id;
  editing.value = true;
}

async function submit(): Promise<void> {
  const saved = await saveResumeVariant(form);
  if (saved) selectVariant(saved);
}

function resumeMarkdown(): string {
  const profile = store.workspace?.profile;
  const projectRows = previewProjects.value.map((item) =>
    `## ${item.name}\n\n**角色：** ${item.role}\n\n${item.responsibilities}\n\n${item.actions}\n\n**结果：** ${item.results}`
  ).join('\n\n');
  return `# ${profile?.nickname || '候选人'}\n\n${form.headline}\n\n## 个人摘要\n\n${form.summary}\n\n## 核心技能\n\n${previewSkills.value.map((item) => `- ${item.name}（${item.level}）`).join('\n')}\n\n## 核心亮点\n\n${(form.highlights ?? []).map((item) => `- ${item}`).join('\n')}\n\n${projectRows}`;
}

async function copyMarkdown(): Promise<void> {
  const copied = await copyText(resumeMarkdown(), 'Markdown 已复制');
  copyMessage.value = copied?.copied ? 'Markdown 已复制' : '复制失败';
}
</script>

<template>
  <section>
    <PageHeader eyebrow="RESUME STUDIO" title="简历工坊" description="从真实职业档案和项目证据生成多个定向版本，针对每份岗位描述调整重点而不编造经历。">
      <button class="button primary" type="button" data-testid="resume-add" @click="newVariant"><Plus :size="16" />新建版本</button>
    </PageHeader>

    <div class="resume-studio-layout">
      <aside class="resume-variant-list">
        <div class="resume-list-heading"><span>简历版本</span><strong>{{ store.workspace?.resumeVariants.length ?? 0 }}</strong></div>
        <button v-for="item in store.workspace?.resumeVariants" :key="item.id" class="resume-version-row" :class="{ selected: form.id === item.id }" type="button" @click="selectVariant(item)">
          <span class="resume-file-icon"><FileText :size="16" /></span>
          <span><strong>{{ item.name }}</strong><small>v{{ item.version }} · 匹配 {{ item.matchScore }}%</small></span>
          <span class="status-badge" :class="item.status">{{ item.status === 'draft' ? '草稿' : item.status === 'ready' ? '可投递' : '已投递' }}</span>
        </button>
        <p v-if="!store.workspace?.resumeVariants.length" class="list-empty">还没有定向简历版本</p>
      </aside>

      <div v-if="editing" class="resume-workspace">
        <form class="panel resume-editor" data-testid="resume-form" @submit.prevent="submit">
          <div class="resume-editor-heading"><div><span class="eyebrow">TARGETED VERSION</span><h3>{{ form.id ? '编辑定向简历' : '创建定向简历' }}</h3></div><button class="button secondary" type="button" data-testid="resume-generate" @click="generateDraft"><Sparkles :size="15" />根据档案生成</button></div>
          <div class="form-grid two">
            <label>目标岗位<select v-model="form.jobId" class="input"><option value="">通用简历</option><option v-for="job in store.workspace?.jobs" :key="job.id" :value="job.id">{{ job.company }} · {{ job.title }}</option></select></label>
            <label>版本状态<select v-model="form.status" class="input"><option value="draft">草稿</option><option value="ready">可投递</option><option value="submitted">已投递</option></select></label>
          </div>
          <label>版本名称<input v-model="form.name" class="input" required data-testid="resume-name" placeholder="公司 · 岗位 定向简历" /></label>
          <label>求职标题<input v-model="form.headline" class="input" required placeholder="岗位方向 · 核心技能" /></label>
          <label>个人摘要<textarea v-model="form.summary" class="input compact-textarea" required></textarea></label>
          <label>核心亮点（每行一条）<textarea v-model="highlightText" class="input compact-textarea" placeholder="写清个人动作、结果和验证方式"></textarea></label>
          <fieldset class="selection-fieldset"><legend>选择项目证据</legend><label v-for="project in store.workspace?.projects" :key="project.id"><input v-model="form.projectIds" type="checkbox" :value="project.id" /><span><strong>{{ project.name }}</strong><small>{{ project.role }} · {{ project.techStack.slice(0, 4).join(' / ') }}</small></span></label></fieldset>
          <fieldset class="selection-fieldset compact"><legend>选择核心技能</legend><label v-for="skill in store.workspace?.profile.skills" :key="skill.id"><input v-model="form.skillIds" type="checkbox" :value="skill.id" /><span>{{ skill.name }}</span></label></fieldset>
          <div class="form-actions"><span></span><button class="button primary" type="submit" data-testid="resume-save">保存版本</button></div>
        </form>

        <article class="resume-sheet" data-testid="resume-preview">
          <div class="resume-sheet-actions"><span v-if="targetJob"><Target :size="15" />{{ targetJob.company || '目标公司' }} · {{ targetJob.title }}</span><span v-else>通用求职版本</span><button class="icon-command" type="button" title="复制 Markdown" aria-label="复制 Markdown" data-testid="resume-copy-markdown" @click="copyMarkdown"><Copy :size="16" /></button></div>
          <header><span class="eyebrow">CURRICULUM VITAE</span><h2>{{ store.workspace?.profile.nickname || '候选人' }}</h2><p>{{ form.headline || '填写求职标题' }}</p></header>
          <section><h3>个人摘要</h3><p>{{ form.summary || '根据目标岗位，说明经验年限、能力边界和可以验证的价值。' }}</p></section>
          <section><h3>核心技能</h3><div class="resume-skill-row"><span v-for="skill in previewSkills" :key="skill.id">{{ skill.name }}</span><small v-if="!previewSkills.length">尚未选择技能</small></div></section>
          <section><h3>核心亮点</h3><ul><li v-for="item in form.highlights" :key="item">{{ item }}</li><li v-if="!form.highlights?.length">尚未添加可验证亮点</li></ul></section>
          <section><h3>项目经历</h3><div v-for="project in previewProjects" :key="project.id" class="resume-project"><div><strong>{{ project.name }}</strong><span>{{ project.role }}</span></div><p>{{ project.responsibilities }}</p><p>{{ project.actions }}</p><b>{{ project.results }}</b></div><p v-if="!previewProjects.length">尚未选择项目证据</p></section>
          <footer><BadgeCheck :size="15" /><span>仅使用本地档案中的真实信息</span><small>{{ copyMessage }}</small></footer>
        </article>
      </div>

      <div v-else class="empty-state resume-empty"><div class="empty-icon"><FileText :size="22" /></div><h3>创建第一份定向简历</h3><p>选择目标岗位后，系统会从职业档案、技能和项目经历中生成可编辑草稿。</p><button class="button primary" type="button" @click="newVariant">新建简历版本</button></div>
    </div>
  </section>
</template>
