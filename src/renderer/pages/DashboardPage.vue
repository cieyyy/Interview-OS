<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, BookOpenText, BrainCircuit, BriefcaseBusiness, Building2, Database, FileSearch, FileUser, GitBranch, Play, Radar, SquareKanban, Target, Trophy } from '@lucide/vue';
import EmptyState from '../components/EmptyState.vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const router = useRouter();
const { store, resetDemo } = useWorkspace();
const workspace = computed(() => store.workspace);
const completedSessions = computed(() => workspace.value?.trainingSessions.filter((item) => item.status === 'completed') ?? []);
const averageScore = computed(() => {
  const attempts = workspace.value?.trainingSessions.flatMap((item) => item.attempts) ?? [];
  return attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.totalScore, 0) / attempts.length) : 0;
});
</script>

<template>
  <section>
    <PageHeader
      eyebrow="OVERVIEW"
      title="把经历变成可表达的能力"
      description="从岗位发现、匹配和简历准备，到投递、面试与复盘，统一管理完整求职流程。"
    >
      <button class="button primary" type="button" data-testid="dashboard-start-training" @click="router.push('/training')"><Play :size="15" fill="currentColor" aria-hidden="true" />开始训练</button>
    </PageHeader>

    <EmptyState
      v-if="workspace && !workspace.projects.length && !workspace.knowledge.length"
      title="建立你的第一个工作区"
      description="可以从空白开始，也可以加载一组不含真实凭据的演示数据。"
      action="加载演示数据"
      test-id="dashboard-empty"
      @action="resetDemo"
    />

    <template v-else-if="workspace">
      <div class="hero-card">
        <div>
          <span class="hero-kicker"><Target :size="15" aria-hidden="true" />当前目标</span>
          <h2>{{ workspace.profile.targetRoles[0] || '尚未设置目标岗位' }}</h2>
          <p>{{ workspace.profile.currentRole || '补充职业档案后，系统会生成更准确的训练内容。' }}</p>
        </div>
        <div class="hero-score"><strong>{{ averageScore || '—' }}</strong><span>平均训练分</span></div>
      </div>

      <div class="stats-grid">
        <article class="stat-card"><div class="stat-card-head"><span>知识卡片</span><BookOpenText :size="17" aria-hidden="true" /></div><strong data-testid="stat-knowledge">{{ workspace.knowledge.length }}</strong><small>长期可复用资产</small></article>
        <article class="stat-card"><div class="stat-card-head"><span>项目经历</span><BriefcaseBusiness :size="17" aria-hidden="true" /></div><strong data-testid="stat-projects">{{ workspace.projects.length }}</strong><small>真实证据来源</small></article>
        <article class="stat-card"><div class="stat-card-head"><span>目标 JD</span><FileSearch :size="17" aria-hidden="true" /></div><strong data-testid="stat-jobs">{{ workspace.jobs.length }}</strong><small>针对性准备</small></article>
        <article class="stat-card"><div class="stat-card-head"><span>完成训练</span><Trophy :size="17" aria-hidden="true" /></div><strong>{{ completedSessions.length }}</strong><small>持续复盘改进</small></article>
        <article class="stat-card"><div class="stat-card-head"><span>活跃机会</span><SquareKanban :size="17" aria-hidden="true" /></div><strong data-testid="stat-applications">{{ workspace.applications.filter((item) => !['offer', 'rejected', 'withdrawn'].includes(item.status)).length }}</strong><small>投递进展与下一步</small></article>
        <article class="stat-card"><div class="stat-card-head"><span>简历版本</span><FileUser :size="17" aria-hidden="true" /></div><strong data-testid="stat-resumes">{{ workspace.resumeVariants.length }}</strong><small>按 JD 定向表达</small></article>
        <article class="stat-card"><div class="stat-card-head"><span>同步岗位</span><Radar :size="17" aria-hidden="true" /></div><strong data-testid="stat-synced-jobs">{{ workspace.syncedJobs.length }}</strong><small>招聘页面实时职位池</small></article>
        <article class="stat-card"><div class="stat-card-head"><span>Agent 计划</span><BrainCircuit :size="17" aria-hidden="true" /></div><strong>{{ workspace.careerSearchPlans.length }}</strong><small>可重复运行的求职目标</small></article>
        <article class="stat-card"><div class="stat-card-head"><span>关注公司</span><Building2 :size="17" aria-hidden="true" /></div><strong>{{ workspace.companyWatches.length }}</strong><small>官网与招聘时间线</small></article>
      </div>

      <div class="dashboard-workflow-band"><button type="button" @click="router.push('/career-agent')"><BrainCircuit :size="18" /><span><strong>求职 Agent</strong><small>目标、计划、推荐和记忆</small></span><ArrowRight :size="15" /></button><button type="button" @click="router.push('/companies')"><Building2 :size="18" /><span><strong>公司雷达</strong><small>官网、校招和岗位变化</small></span><ArrowRight :size="15" /></button><button type="button" @click="router.push('/skill-graph')"><GitBranch :size="18" /><span><strong>能力图谱</strong><small>证据、缺口和补强路线</small></span><ArrowRight :size="15" /></button><button type="button" @click="router.push('/data-center')"><Database :size="18" /><span><strong>数据中心</strong><small>质量、报告和推送</small></span><ArrowRight :size="15" /></button></div>

      <div class="two-column">
        <article class="panel">
          <div class="panel-heading"><div><span class="eyebrow">NEXT</span><h3>下一步建议</h3></div></div>
          <div class="task-list">
            <button class="task-row" type="button" @click="router.push('/career-agent')"><span class="task-index">01</span><span><strong>创建一个求职 Agent 计划</strong><small>把城市、方向、薪资和排除项转成可执行计划</small></span><ArrowRight :size="16" aria-hidden="true" /></button>
            <button class="task-row" type="button" @click="router.push('/training')"><span class="task-index">02</span><span><strong>完成一次项目表达训练</strong><small>先回答，再获得结构化反馈</small></span><ArrowRight :size="16" aria-hidden="true" /></button>
            <button class="task-row" type="button" @click="router.push('/knowledge')"><span class="task-index">03</span><span><strong>整理一个故障案例</strong><small>沉淀现象、排查、根因和结果</small></span><ArrowRight :size="16" aria-hidden="true" /></button>
            <button class="task-row" type="button" @click="router.push('/applications')"><span class="task-index">04</span><span><strong>建立求职投递管道</strong><small>记录机会、截止日期和下一步动作</small></span><ArrowRight :size="16" aria-hidden="true" /></button>
            <button class="task-row" type="button" @click="router.push('/job-sync')"><span class="task-index">05</span><span><strong>连接浏览器岗位同步</strong><small>把招聘网站可见岗位增量同步到本机</small></span><ArrowRight :size="16" aria-hidden="true" /></button>
          </div>
        </article>

        <article class="panel">
          <div class="panel-heading"><div><span class="eyebrow">RECENT</span><h3>最近训练</h3></div></div>
          <div v-if="workspace.trainingSessions.length" class="compact-list">
            <div v-for="session in workspace.trainingSessions.slice(0, 4)" :key="session.id" class="compact-row">
              <span class="status-badge" :class="session.status">{{ session.status === 'completed' ? '完成' : '进行中' }}</span>
              <div><strong>{{ session.title }}</strong><small>{{ session.attempts.length }} 次回答</small></div>
            </div>
          </div>
          <p v-else class="muted-block">还没有训练记录。第一次回答不需要完美，它只是你的基线。</p>
        </article>
      </div>
    </template>
  </section>
</template>
