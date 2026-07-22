<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, BookOpenCheck, BrainCircuit, BriefcaseBusiness, Building2, CalendarCheck, ChartNoAxesCombined, FileSearch, FileUser, GitBranch, Play, Sparkles, SquareKanban, Target, UserRound } from '@lucide/vue';
import { buildSkillGraph } from '../../shared/career-agent-engine';
import EmptyState from '../components/EmptyState.vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const router = useRouter();
const { store, resetDemo } = useWorkspace();
const workspace = computed(() => store.workspace);
const today = new Date().toISOString().slice(0, 10);
const todayTraining = computed(() => workspace.value?.trainingSessions.filter((item) => item.updatedAt.startsWith(today)) ?? []);
const pendingAnswers = computed(() => workspace.value?.knowledge.filter((item) => item.type === 'answer' && item.status === 'review') ?? []);
const skillGaps = computed(() => workspace.value ? buildSkillGraph(workspace.value).filter((item) => item.category === 'gap').slice(0, 5) : []);
const targetJobs = computed(() => (workspace.value?.syncedJobs ?? []).filter((item) => item.status !== 'ignored' && item.lifecycleStatus !== 'closed').sort((a, b) => b.matchScore - a.matchScore).slice(0, 4));
const todayTasks = computed(() => {
  if (!workspace.value) return [];
  const applicationTasks = workspace.value.applications
    .filter((item) => item.nextAction && (!item.nextActionAt || item.nextActionAt.slice(0, 10) <= today))
    .map((item) => ({ id: `application-${item.id}`, title: item.nextAction, meta: `${item.company || '目标公司'} · ${item.title}`, to: '/applications' }));
  const reviewTasks = workspace.value.knowledge
    .filter((item) => item.reviewAt && item.reviewAt.slice(0, 10) <= today && item.status !== 'mastered')
    .map((item) => ({ id: `knowledge-${item.id}`, title: `复习：${item.title}`, meta: item.tags.slice(0, 3).join(' · ') || '知识复习', to: '/knowledge' }));
  return [...applicationTasks, ...reviewTasks].slice(0, 6);
});

const loop = [
  { label: '发现岗位', to: '/job-sync' },
  { label: '分析 JD', to: '/jobs' },
  { label: '匹配能力', to: '/skill-graph' },
  { label: '修改简历', to: '/resumes' },
  { label: '包装项目', to: '/projects' },
  { label: '教练训练', to: '/coach' },
  { label: '知识沉淀', to: '/knowledge' }
];
</script>

<template>
  <section>
    <PageHeader eyebrow="TODAY" title="今天，推进一件最重要的事" description="围绕目标岗位组织任务、训练、回答优化和技能学习，让每一步都进入同一条求职闭环。">
      <button class="button primary" type="button" data-testid="dashboard-start-training" @click="router.push('/coach')"><Play :size="16" fill="currentColor" aria-hidden="true" />开始教练训练</button>
    </PageHeader>

    <EmptyState v-if="workspace && !workspace.projects.length && !workspace.knowledge.length" title="建立你的职业工作区" description="从职业档案或简历导入开始，已有 v0.5 数据会自动保留并升级。" action="加载演示数据" test-id="dashboard-empty" @action="resetDemo" />

    <template v-else-if="workspace">
      <div class="career-loop" aria-label="求职闭环">
        <button v-for="(item, index) in loop" :key="item.to" type="button" @click="router.push(item.to)"><span>{{ index + 1 }}</span><strong>{{ item.label }}</strong><ArrowRight v-if="index < loop.length - 1" :size="14" aria-hidden="true" /></button>
      </div>

      <div class="today-grid">
        <article class="panel today-primary-card">
          <div class="panel-heading"><div><span class="eyebrow">TODAY TASKS</span><h3>今日任务</h3></div><strong>{{ todayTasks.length }}</strong></div>
          <div v-if="todayTasks.length" class="task-list">
            <button v-for="task in todayTasks" :key="task.id" class="task-row" type="button" @click="router.push(task.to)"><CalendarCheck :size="18" /><span><strong>{{ task.title }}</strong><small>{{ task.meta }}</small></span><ArrowRight :size="16" /></button>
          </div>
          <div v-else class="today-empty"><BookOpenCheck :size="28" /><strong>今天没有到期任务</strong><span>可以从目标岗位中选择一个，生成简历或开始训练。</span><button class="button secondary" type="button" @click="router.push('/job-sync')">查看目标岗位</button></div>
        </article>

        <div class="today-summary-grid">
          <button class="focus-card" type="button" @click="router.push('/coach')"><span><BrainCircuit :size="18" />今日训练</span><strong>{{ todayTraining.length }}</strong><small>统一职业教练会话</small></button>
          <button class="focus-card" type="button" @click="router.push('/knowledge')"><span><Sparkles :size="18" />待优化回答</span><strong>{{ pendingAnswers.length }}</strong><small>复盘并沉淀为知识</small></button>
          <button class="focus-card" type="button" @click="router.push('/skill-graph')"><span><GitBranch :size="18" />待学习技能</span><strong>{{ skillGaps.length }}</strong><small>{{ skillGaps.map((item) => item.name).slice(0, 2).join(' · ') || '暂无明确缺口' }}</small></button>
          <button class="focus-card" type="button" @click="router.push('/applications')"><span><SquareKanban :size="18" />活跃机会</span><strong data-testid="stat-applications">{{ workspace.applications.filter((item) => !['offer', 'rejected', 'withdrawn'].includes(item.status)).length }}</strong><small>查看下一步和截止时间</small></button>
        </div>
      </div>

      <div class="two-column dashboard-targets">
        <article class="panel">
          <div class="panel-heading"><div><span class="eyebrow">TARGET JOBS</span><h3>目标岗位</h3></div><button class="button ghost compact" type="button" @click="router.push('/job-sync')">岗位中心</button></div>
          <div v-if="targetJobs.length" class="compact-list">
            <button v-for="job in targetJobs" :key="job.id" class="target-job-row" type="button" @click="router.push('/job-sync')"><span><strong>{{ job.company }} · {{ job.title }}</strong><small>{{ job.location }} · {{ job.salaryRange || '薪资面议' }} · {{ job.skills.slice(0, 3).join(' / ') }}</small></span><b>{{ job.matchScore }}</b></button>
          </div>
          <p v-else class="muted-block">当前没有同步岗位。可先导入或从浏览器同步可见职位。</p>
        </article>
        <article class="panel">
          <div class="panel-heading"><div><span class="eyebrow">RECENT COACHING</span><h3>最近教练会话</h3></div><button class="button ghost compact" type="button" @click="router.push('/reports')">全部报告</button></div>
          <div v-if="workspace.coachSessions.length" class="compact-list"><div v-for="session in workspace.coachSessions.slice(0, 4)" :key="session.id" class="compact-row"><span class="status-badge" :class="session.status">{{ session.status === 'completed' ? '完成' : '进行中' }}</span><div><strong>{{ session.title }}</strong><small>{{ session.answers.length }} 次回答 · {{ session.mode }}</small></div></div></div>
          <p v-else class="muted-block">还没有教练会话。历史训练会在升级时自动转换。</p>
        </article>
      </div>

      <div class="supporting-tools" aria-label="保留的辅助工作流">
        <button type="button" @click="router.push('/career-agent')"><BriefcaseBusiness :size="17" /><span><strong>求职 Agent</strong><small>搜索计划与推荐</small></span></button>
        <button type="button" @click="router.push('/profile')"><UserRound :size="17" /><span><strong>职业档案</strong><small>基础信息与技能</small></span></button>
        <button type="button" @click="router.push('/job-insights')"><ChartNoAxesCombined :size="17" /><span><strong>岗位洞察</strong><small>趋势和分布</small></span></button>
        <button type="button" @click="router.push('/companies')"><Building2 :size="17" /><span><strong>公司关注</strong><small>官网与招聘时间线</small></span></button>
        <button type="button" @click="router.push('/resumes')"><FileUser :size="17" /><span><strong>简历工坊</strong><small>定向版本</small></span></button>
        <button type="button" @click="router.push('/jobs')"><FileSearch :size="17" /><span><strong>JD 分析</strong><small>要求与证据</small></span></button>
      </div>

      <span class="sr-only" data-testid="stat-knowledge">{{ workspace.knowledge.length }}</span><span class="sr-only" data-testid="stat-projects">{{ workspace.projects.length }}</span><span class="sr-only" data-testid="stat-jobs">{{ workspace.jobs.length }}</span><span class="sr-only" data-testid="stat-resumes">{{ workspace.resumeVariants.length }}</span><span class="sr-only" data-testid="stat-synced-jobs">{{ workspace.syncedJobs.length }}</span>
    </template>
  </section>
</template>
