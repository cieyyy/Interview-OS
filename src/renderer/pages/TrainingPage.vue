<script setup lang="ts">
import { computed, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, startTraining, submitTraining, finalizeTraining } = useWorkspace();
const jobId = ref('');
const projectId = ref('');
const answer = ref('');
const submitted = ref(false);
const active = computed(() => store.activeSession);
const currentQuestion = computed(() => active.value?.questions[active.value.currentQuestionIndex]);
const latestAttempt = computed(() => {
  if (!active.value || !currentQuestion.value) return undefined;
  return [...active.value.attempts].reverse().find((item) => item.questionId === currentQuestion.value?.id);
});

async function start(): Promise<void> {
  const session = await startTraining({ jobId: jobId.value || undefined, projectId: projectId.value || undefined, type: 'mixed', difficulty: 'medium', questionCount: 5 });
  if (session) { answer.value = ''; submitted.value = false; }
}

async function submit(): Promise<void> {
  if (!active.value || !currentQuestion.value) return;
  const value = await submitTraining({ sessionId: active.value.id, questionId: currentQuestion.value.id, answer: answer.value });
  if (value) submitted.value = true;
}

async function finalize(): Promise<void> {
  if (!active.value || !currentQuestion.value) return;
  const previousQuestionId = currentQuestion.value.id;
  const value = await finalizeTraining({ sessionId: active.value.id, questionId: previousQuestionId, answer: answer.value });
  if (value) { answer.value = ''; submitted.value = false; }
}

function leaveSession(): void { store.activeSession = undefined; answer.value = ''; submitted.value = false; }
</script>

<template>
  <section>
    <PageHeader eyebrow="PRACTICE" title="面试训练" description="先说出真实答案，再从准确性、结构和岗位价值逐步改进。">
      <button v-if="active" class="button ghost" type="button" @click="leaveSession">结束本次训练</button>
    </PageHeader>

    <div v-if="!active" class="training-setup">
      <div class="setup-copy"><span class="eyebrow">BASELINE FIRST</span><h2>第一次回答不需要完美</h2><p>系统不会在你回答前展示标准答案。选择上下文后，题目会优先来自目标 JD 和真实项目。</p><ul><li>离线题目生成，不依赖 Docker</li><li>每次反馈都有具体证据</li><li>最终答案可以回写知识库</li></ul></div>
      <form class="panel setup-form" data-testid="training-setup" @submit.prevent="start">
        <h3>设置训练范围</h3>
        <label>目标 JD<select v-model="jobId" class="input" data-testid="training-job"><option value="">综合训练</option><option v-for="job in store.workspace?.jobs" :key="job.id" :value="job.id">{{ job.company }} · {{ job.title }}</option></select></label>
        <label>项目经历<select v-model="projectId" class="input" data-testid="training-project"><option value="">不指定项目</option><option v-for="project in store.workspace?.projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></label>
        <div class="info-box"><strong>本次模式</strong><span>综合问题 · 中等难度 · 5 题 · 文字回答</span></div>
        <button class="button primary full" type="submit" data-testid="training-start">开始训练</button>
      </form>
    </div>

    <div v-else-if="currentQuestion" class="training-stage" data-testid="training-stage">
      <article class="question-card">
        <div class="question-meta"><span>第 {{ active.currentQuestionIndex + 1 }} / {{ active.questions.length }} 题</span><span>{{ currentQuestion.type }} · {{ currentQuestion.difficulty }}</span></div>
        <h2 data-testid="training-question">{{ currentQuestion.text }}</h2>
        <p class="rationale">提问依据：{{ currentQuestion.rationale }}</p>
        <div class="tag-row"><span v-for="keyword in currentQuestion.targetKeywords" :key="keyword">{{ keyword }}</span></div>
      </article>

      <div class="answer-layout">
        <form class="panel answer-panel" @submit.prevent="submit">
          <label>你的回答<textarea v-model="answer" class="input answer-textarea" required data-testid="training-answer" placeholder="像真实面试一样直接回答。可以卡顿，但不要查标准答案。"></textarea></label>
          <div class="answer-footer"><small>{{ answer.length }} 字</small><button class="button primary" type="submit" data-testid="training-submit">分析回答</button></div>
        </form>

        <article class="panel feedback-panel">
          <template v-if="submitted && latestAttempt">
            <div class="score-orbit"><strong data-testid="training-score">{{ latestAttempt.totalScore }}</strong><span>综合得分</span></div>
            <div class="dimension-list"><div v-for="item in latestAttempt.dimensions" :key="item.key" class="dimension-row"><span>{{ item.label }}</span><div><i :style="{ width: `${item.score}%` }"></i></div><b>{{ item.score }}</b></div></div>
            <div class="feedback-copy"><h4>具体建议</h4><p v-for="item in latestAttempt.feedback" :key="item">{{ item }}</p><h4 v-if="latestAttempt.clarifyingQuestions.length">重答前想清楚</h4><p v-for="item in latestAttempt.clarifyingQuestions" :key="item">• {{ item }}</p></div>
            <button class="button secondary full" type="button" data-testid="training-finalize" @click="finalize">保存本题最终回答并继续</button>
          </template>
          <div v-else class="feedback-placeholder"><div>01</div><h3>提交后再显示反馈</h3><p>系统会检查内容准确性、结构、个人贡献、岗位匹配、自然度和真实性风险。</p></div>
        </article>
      </div>
    </div>
  </section>
</template>

