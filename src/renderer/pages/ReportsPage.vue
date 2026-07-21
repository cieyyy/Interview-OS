<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronRight, ChevronUp } from '@lucide/vue';
import type { TrainingSession } from '../../shared/domain';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store } = useWorkspace();
const selectedId = ref('');
const sessions = computed(() => store.workspace?.trainingSessions ?? []);
const selectedSession = computed(() => sessions.value.find((item) => item.id === selectedId.value));
const allAttempts = computed(() => sessions.value.flatMap((item) => item.attempts));
const average = computed(() => allAttempts.value.length ? Math.round(allAttempts.value.reduce((sum, item) => sum + item.totalScore, 0) / allAttempts.value.length) : 0);
const dimensionAverages = computed(() => {
  const labels = ['accuracy', 'structure', 'contribution', 'jobMatch', 'naturalness', 'authenticity'];
  return labels.map((key) => {
    const rows = allAttempts.value.flatMap((attempt) => attempt.dimensions).filter((item) => item.key === key);
    return { key, label: rows[0]?.label ?? key, score: rows.length ? Math.round(rows.reduce((sum, item) => sum + item.score, 0) / rows.length) : 0 };
  });
});

function selectSession(session: TrainingSession): void {
  selectedId.value = selectedId.value === session.id ? '' : session.id;
}

function sessionAverage(session: TrainingSession): number | string {
  return session.attempts.length
    ? Math.round(session.attempts.reduce((sum, item) => sum + item.totalScore, 0) / session.attempts.length)
    : '—';
}
</script>

<template>
  <section>
    <PageHeader eyebrow="PROGRESS" title="训练报告" description="点击任意训练记录，可查看当时的问题、回答、评分与改进建议。" />
    <div class="report-hero"><div><span>当前平均分</span><strong>{{ average || '—' }}</strong><small>来自 {{ allAttempts.length }} 次回答</small></div><div class="report-bars"><div v-for="item in dimensionAverages" :key="item.key"><span>{{ item.label }}</span><div><i :style="{ width: `${item.score}%` }"></i></div><b>{{ item.score || '—' }}</b></div></div></div>
    <div class="panel history-panel">
      <div class="panel-heading"><div><span class="eyebrow">HISTORY</span><h3>训练历史</h3></div><small class="history-hint">点击一条记录查看回答详情</small></div>
      <div class="session-table">
        <button v-for="session in sessions" :key="session.id" class="session-row" :class="{ selected: selectedId === session.id }" type="button" :data-testid="`training-history-${session.id}`" @click="selectSession(session)">
          <span class="status-badge" :class="session.status">{{ session.status === 'completed' ? '完成' : '进行中' }}</span>
          <div><strong>{{ session.title }}</strong><small>{{ new Date(session.updatedAt).toLocaleString('zh-CN') }} · {{ session.language === 'en-US' ? 'English' : '中文' }} · {{ session.mode === 'pressure' ? '压力面试' : '基础训练' }}</small></div>
          <span>{{ session.questions.length }} 题</span><b>{{ session.attempts.length }} 次回答</b><span class="history-score">均分 {{ sessionAverage(session) }}</span><span class="history-arrow">{{ selectedId === session.id ? '收起' : '查看' }}<ChevronUp v-if="selectedId === session.id" :size="13" aria-hidden="true" /><ChevronRight v-else :size="13" aria-hidden="true" /></span>
        </button>
        <p v-if="!sessions.length" class="muted-block">完成第一次训练后，这里会显示问题、回答和改进建议。</p>
      </div>
    </div>

    <article v-if="selectedSession" class="panel session-detail" data-testid="training-history-detail">
      <div class="session-detail-heading"><div><span class="eyebrow">SESSION DETAIL</span><h2>{{ selectedSession.title }}</h2><p>{{ new Date(selectedSession.createdAt).toLocaleString('zh-CN') }} · {{ selectedSession.status === 'completed' ? '已完成' : '进行中' }} · {{ selectedSession.mode === 'pressure' ? `最多 ${selectedSession.maxRounds ?? 8} 轮动态追问` : '基础训练' }}</p></div><button class="button ghost compact" type="button" @click="selectedId = ''">关闭</button></div>
      <section v-if="selectedSession.summary" class="history-summary" data-testid="history-pressure-summary">
        <div><h3>核心竞争力</h3><ul><li v-for="item in selectedSession.summary.coreStrengths" :key="item">{{ item }}</li></ul></div>
        <div class="risk"><h3>高风险漏洞</h3><ul><li v-for="item in selectedSession.summary.highRiskGaps" :key="item">{{ item }}</li></ul></div>
        <div><h3>后续练习问题</h3><ol><li v-for="item in selectedSession.summary.practiceQuestions" :key="item">{{ item }}</li></ol></div>
        <div><h3>简历修改建议</h3><ul><li v-for="item in selectedSession.summary.resumeSuggestions" :key="item">{{ item }}</li></ul></div>
      </section>
      <div class="history-question-list">
        <section v-for="(question, questionIndex) in selectedSession.questions" :key="question.id" class="history-question">
          <div class="history-question-heading"><span>{{ String(questionIndex + 1).padStart(2, '0') }}</span><div><h3>{{ question.text }}</h3><small>{{ question.rationale }}</small></div></div>
          <template v-if="selectedSession.attempts.some((attempt) => attempt.questionId === question.id)">
            <article v-for="(attempt, attemptIndex) in selectedSession.attempts.filter((item) => item.questionId === question.id)" :key="attempt.id" class="history-attempt">
              <div class="attempt-meta"><strong>{{ attempt.isFinal ? '最终回答' : `第 ${attemptIndex + 1} 次回答` }}</strong><span>{{ attempt.totalScore }} 分 · {{ new Date(attempt.createdAt).toLocaleString('zh-CN') }}</span></div>
              <h4>当时如何回答</h4><p class="answer-record" data-testid="history-answer">{{ attempt.answer }}</p>
              <div class="attempt-dimensions"><span v-for="dimension in attempt.dimensions" :key="dimension.key">{{ dimension.label }} {{ dimension.score }}</span></div>
              <h4>当时的改进建议</h4><ul><li v-for="feedback in attempt.feedback" :key="feedback">{{ feedback }}</li></ul>
              <div v-if="attempt.diagnosis" class="history-diagnosis">
                <div><h4>证据不足</h4><ul><li v-for="item in attempt.diagnosis.evidenceGaps" :key="item">{{ item }}</li></ul></div>
                <div><h4>结构 / 表达漏洞</h4><ul><li v-for="item in attempt.diagnosis.logicIssues" :key="item">{{ item }}</li></ul></div>
                <div><h4>面试官质疑</h4><p>{{ attempt.diagnosis.interviewerChallenge }}</p></div>
                <div><h4>简历同步建议</h4><p>{{ attempt.diagnosis.resumeSuggestion }}</p></div>
              </div>
            </article>
          </template>
          <p v-else class="unanswered">这道题还没有保存回答。</p>
        </section>
      </div>
    </article>
  </section>
</template>
