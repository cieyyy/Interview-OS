<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Bot, BrainCircuit, CheckCircle2, CircleAlert, FileUser, MessageCircleMore, MicVocal, Play, Search, Send, Sparkles, Trash2, X } from '@lucide/vue';
import { useRouter } from 'vue-router';
import type { CareerMemoryType, SyncedJob } from '../../shared/domain';
import { buildCareerAnswer, parseCareerGoal } from '../../shared/career-agent-engine';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const router = useRouter();
const { store, saveCareerSearchPlan, deleteCareerSearchPlan, runCareerSearchPlan, saveCareerMemory, promoteSyncedJob } = useWorkspace();
const goal = ref('帮我找杭州云原生、AI 平台或技术支持岗位，20K 以上，不要外包，双休优先。');
const selectedPlanId = ref('');
const question = ref('优先投哪个？');
const answer = ref('');
const deletePlanId = ref('');
const mood = ref<'steady' | 'tired' | 'anxious'>('steady');
const memoryDraft = reactive<{ type: CareerMemoryType; content: string; tags: string }>({ type: 'preference', content: '', tags: '' });

const plans = computed(() => store.workspace?.careerSearchPlans ?? []);
const runs = computed(() => store.workspace?.careerAgentRuns ?? []);
const memories = computed(() => store.workspace?.careerMemory ?? []);
const selectedPlan = computed(() => plans.value.find((item) => item.id === selectedPlanId.value) ?? plans.value[0]);
const latestRun = computed(() => runs.value.find((item) => !selectedPlan.value || item.planId === selectedPlan.value.id));
const matchedJobs = computed(() => {
  const ids = latestRun.value?.matchedJobIds ?? [];
  return (store.workspace?.syncedJobs ?? []).filter((item) => ids.includes(item.id));
});
const moodCopy = computed(() => ({
  steady: '今天按计划推进：先筛 3 个高匹配岗位，再完成 1 份定向简历。',
  tired: '先减少决策量。今天只处理最高匹配的 1 个岗位，其余自动留在队列里。',
  anxious: '先把不确定性拆开：岗位是否真实、是否匹配、下一步做什么，逐项确认即可。'
}[mood.value]));

async function createAndRun(): Promise<void> {
  if (!store.workspace || !goal.value.trim()) return;
  const parsed = parseCareerGoal(goal.value, store.workspace);
  const plan = await saveCareerSearchPlan(parsed);
  if (plan) {
    selectedPlanId.value = plan.id;
    await runCareerSearchPlan(plan.id);
  }
}

async function rerun(): Promise<void> {
  if (selectedPlan.value) await runCareerSearchPlan(selectedPlan.value.id);
}

async function removePlan(): Promise<void> {
  if (!deletePlanId.value) return;
  const id = deletePlanId.value;
  const result = await deleteCareerSearchPlan(id);
  if (!result?.deleted) return;
  selectedPlanId.value = plans.value[0]?.id ?? '';
  deletePlanId.value = '';
}

function askAgent(): void {
  if (!store.workspace) return;
  answer.value = buildCareerAnswer(question.value, store.workspace, latestRun.value?.matchedJobIds ?? []);
}

async function addMemory(): Promise<void> {
  if (!memoryDraft.content.trim()) return;
  const saved = await saveCareerMemory({
    type: memoryDraft.type, content: memoryDraft.content,
    tags: memoryDraft.tags.split(/[,，]/u).map((item) => item.trim()).filter(Boolean)
  });
  if (saved) {
    memoryDraft.content = '';
    memoryDraft.tags = '';
  }
}

async function openJobAction(item: SyncedJob, target: 'resume' | 'training'): Promise<void> {
  const job = item.linkedJobId
    ? store.workspace?.jobs.find((row) => row.id === item.linkedJobId)
    : await promoteSyncedJob(item.id);
  if (job) await router.push({ path: target === 'resume' ? '/resumes' : '/training', query: { jobId: job.id } });
}
</script>

<template>
  <section>
    <PageHeader eyebrow="CAREER ORCHESTRATOR" title="求职 Agent" description="把求职目标、职业档案、岗位筛选、推荐解释、行动计划和长期求职记忆放进同一条本地工作流。">
      <button class="button secondary" type="button" :disabled="!selectedPlan" @click="rerun"><Play :size="15" />重新运行</button>
    </PageHeader>

    <div class="agent-layout">
      <section class="agent-command-panel">
        <div class="agent-command-heading"><span class="agent-avatar"><Bot :size="22" /></span><div><span class="eyebrow">SEARCH GOAL</span><h3>这次想找什么工作？</h3></div></div>
        <textarea v-model="goal" class="input agent-goal-input" placeholder="输入城市、方向、薪资、岗位类型、排除项和偏好……"></textarea>
        <div class="agent-command-actions"><span>硬条件用于过滤，偏好只参与排序和风险提示。</span><button class="button primary" type="button" @click="createAndRun"><Sparkles :size="16" />生成计划并运行</button></div>
      </section>

      <aside class="career-companion">
        <div><span class="eyebrow">CARE COMPANION</span><h3>今天的状态</h3></div>
        <div class="mood-control"><button :class="{ active: mood === 'steady' }" type="button" @click="mood = 'steady'">稳定</button><button :class="{ active: mood === 'tired' }" type="button" @click="mood = 'tired'">疲惫</button><button :class="{ active: mood === 'anxious' }" type="button" @click="mood = 'anxious'">焦虑</button></div>
        <p>{{ moodCopy }}</p>
      </aside>
    </div>

    <div class="agent-workspace">
      <aside class="agent-plan-list">
        <header><span>搜索计划</span><strong>{{ plans.length }}</strong></header>
        <div v-for="plan in plans" :key="plan.id" class="agent-plan-row" :class="{ selected: selectedPlan?.id === plan.id }">
          <button type="button" class="agent-plan-select" @click="selectedPlanId = plan.id">
            <Search :size="15" /><span><strong>{{ plan.title }}</strong><small>{{ plan.cities.join('、') || '不限城市' }} · {{ plan.keywords.slice(0, 2).join('、') || '综合岗位' }}</small></span>
          </button>
          <button class="icon-command danger" type="button" title="删除计划" :aria-label="`删除计划 ${plan.title}`" @click="deletePlanId = plan.id"><Trash2 :size="15" /></button>
        </div>
      </aside>

      <main class="agent-run-panel">
        <template v-if="selectedPlan">
          <div class="agent-plan-summary">
            <div><span class="eyebrow">ACTIVE PLAN</span><h2>{{ selectedPlan.title }}</h2><p>{{ selectedPlan.goal }}</p></div>
            <div class="plan-specs"><span v-for="item in selectedPlan.hardConstraints" :key="item" class="hard">{{ item }}</span><span v-for="item in selectedPlan.softPreferences" :key="item" class="soft">偏好：{{ item }}</span><span v-if="selectedPlan.salaryMinK">≥ {{ selectedPlan.salaryMinK }}K</span></div>
          </div>

          <div v-if="latestRun" class="agent-step-list">
            <div v-for="step in latestRun.steps" :key="step.id"><CheckCircle2 v-if="step.status === 'completed'" :size="16" /><CircleAlert v-else :size="16" /><span><strong>{{ step.label }}</strong><small>{{ step.message }}</small></span></div>
          </div>

          <section class="agent-results">
            <header><div><span class="eyebrow">CURATED JOBS</span><h3>推荐岗位</h3></div><strong>{{ matchedJobs.length }}</strong></header>
            <article v-for="item in matchedJobs" :key="item.id">
              <div class="agent-job-score"><strong>{{ item.matchScore }}</strong><small>匹配</small></div>
              <div><h4>{{ item.title }}</h4><p>{{ item.company || '未识别公司' }} · {{ item.location || '地点未识别' }} · {{ item.salaryRange || '薪资未披露' }}</p><small>{{ item.matchReasons[0] }}</small></div>
              <div><button class="icon-command" type="button" title="制作定向简历" @click="openJobAction(item, 'resume')"><FileUser :size="16" /></button><button class="icon-command" type="button" title="开始面试训练" @click="openJobAction(item, 'training')"><MicVocal :size="16" /></button></div>
            </article>
            <p v-if="!matchedJobs.length" class="agent-no-results">当前本地职位池没有命中。计划已经保存，真实连接器接入后可直接复用。</p>
          </section>

          <section class="agent-question-box">
            <div><MessageCircleMore :size="18" /><span><strong>基于本次结果继续问</strong><small>回答只使用当前职位池和求职记忆。</small></span></div>
            <label><input v-model="question" class="input" @keyup.enter="askAgent" /><button class="icon-command" type="button" title="提问" @click="askAgent"><Send :size="15" /></button></label>
            <p v-if="answer">{{ answer }}</p>
          </section>
        </template>
        <div v-else class="empty-state"><BrainCircuit :size="24" /><h3>创建第一个求职计划</h3><p>Agent 会把自然语言目标拆成明确、可修改、可重复运行的筛选计划。</p></div>
      </main>

      <aside class="career-memory-panel">
        <header><div><span class="eyebrow">MEMORY</span><h3>求职记忆</h3></div><strong>{{ memories.length }}</strong></header>
        <form @submit.prevent="addMemory"><select v-model="memoryDraft.type" class="input"><option value="preference">偏好</option><option value="profile">真实经历</option><option value="feedback">岗位反馈</option><option value="decision">求职决定</option><option value="note">备注</option></select><textarea v-model="memoryDraft.content" class="input" placeholder="记录以后需要持续使用的信息……"></textarea><input v-model="memoryDraft.tags" class="input" placeholder="标签，用逗号分隔" /><button class="button primary" type="submit">保存记忆</button></form>
        <div class="memory-list"><article v-for="item in memories" :key="item.id"><span>{{ item.type }}</span><p>{{ item.content }}</p><small>{{ item.tags.join(' · ') }}</small></article></div>
      </aside>
    </div>
    <div v-if="deletePlanId" class="modal-backdrop" role="presentation" @click.self="deletePlanId = ''">
      <section class="modal-card compact-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-plan-title">
        <header><div><span class="eyebrow">DELETE PLAN</span><h3 id="delete-plan-title">删除求职计划？</h3></div><button class="icon-command" type="button" title="关闭" @click="deletePlanId = ''"><X :size="16" /></button></header>
        <p>计划及其运行记录会被删除，岗位、简历和投递记录不会受影响。</p>
        <footer><button class="button ghost" type="button" @click="deletePlanId = ''">取消</button><button class="button danger" type="button" data-testid="career-plan-delete-submit" @click="removePlan"><Trash2 :size="15" />确认删除</button></footer>
      </section>
    </div>
  </section>
</template>
