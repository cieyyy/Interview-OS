<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
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
      description="从真实材料出发，完成岗位分析、回答训练和知识沉淀。"
    >
      <button class="button primary" type="button" data-testid="dashboard-start-training" @click="router.push('/training')">开始训练</button>
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
          <span class="chip accent">当前目标</span>
          <h2>{{ workspace.profile.targetRoles[0] || '尚未设置目标岗位' }}</h2>
          <p>{{ workspace.profile.currentRole || '补充职业档案后，系统会生成更准确的训练内容。' }}</p>
        </div>
        <div class="hero-score"><strong>{{ averageScore || '—' }}</strong><span>平均训练分</span></div>
      </div>

      <div class="stats-grid">
        <article class="stat-card"><span>知识卡片</span><strong data-testid="stat-knowledge">{{ workspace.knowledge.length }}</strong><small>长期可复用资产</small></article>
        <article class="stat-card"><span>项目经历</span><strong data-testid="stat-projects">{{ workspace.projects.length }}</strong><small>真实证据来源</small></article>
        <article class="stat-card"><span>目标 JD</span><strong data-testid="stat-jobs">{{ workspace.jobs.length }}</strong><small>针对性准备</small></article>
        <article class="stat-card"><span>完成训练</span><strong>{{ completedSessions.length }}</strong><small>持续复盘改进</small></article>
      </div>

      <div class="two-column">
        <article class="panel">
          <div class="panel-heading"><div><span class="eyebrow">NEXT</span><h3>下一步建议</h3></div></div>
          <div class="task-list">
            <button class="task-row" type="button" @click="router.push('/jobs')"><span class="task-index">01</span><span><strong>导入一份目标岗位 JD</strong><small>系统会拆解要求并寻找你的证据</small></span><b>→</b></button>
            <button class="task-row" type="button" @click="router.push('/training')"><span class="task-index">02</span><span><strong>完成一次项目表达训练</strong><small>先回答，再获得结构化反馈</small></span><b>→</b></button>
            <button class="task-row" type="button" @click="router.push('/knowledge')"><span class="task-index">03</span><span><strong>整理一个故障案例</strong><small>沉淀现象、排查、根因和结果</small></span><b>→</b></button>
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

