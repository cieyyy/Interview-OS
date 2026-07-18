<script setup lang="ts">
import { computed } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';
const { store } = useWorkspace();
const sessions = computed(() => store.workspace?.trainingSessions ?? []);
const allAttempts = computed(() => sessions.value.flatMap((item) => item.attempts));
const average = computed(() => allAttempts.value.length ? Math.round(allAttempts.value.reduce((sum, item) => sum + item.totalScore, 0) / allAttempts.value.length) : 0);
const dimensionAverages = computed(() => {
  const labels = ['accuracy', 'structure', 'contribution', 'jobMatch', 'naturalness', 'authenticity'];
  return labels.map((key) => {
    const rows = allAttempts.value.flatMap((attempt) => attempt.dimensions).filter((item) => item.key === key);
    return { key, label: rows[0]?.label ?? key, score: rows.length ? Math.round(rows.reduce((sum, item) => sum + item.score, 0) / rows.length) : 0 };
  });
});
</script>

<template>
  <section>
    <PageHeader eyebrow="PROGRESS" title="训练报告" description="关注各维度变化，而不是被一个不透明的总分定义。" />
    <div class="report-hero"><div><span>当前平均分</span><strong>{{ average || '—' }}</strong><small>来自 {{ allAttempts.length }} 次回答</small></div><div class="report-bars"><div v-for="item in dimensionAverages" :key="item.key"><span>{{ item.label }}</span><div><i :style="{ width: `${item.score}%` }"></i></div><b>{{ item.score || '—' }}</b></div></div></div>
    <div class="panel"><div class="panel-heading"><div><span class="eyebrow">HISTORY</span><h3>训练历史</h3></div></div><div class="session-table"><div v-for="session in sessions" :key="session.id" class="session-row"><span class="status-badge" :class="session.status">{{ session.status === 'completed' ? '完成' : '进行中' }}</span><div><strong>{{ session.title }}</strong><small>{{ new Date(session.updatedAt).toLocaleString('zh-CN') }}</small></div><span>{{ session.questions.length }} 题</span><b>{{ session.attempts.length }} 次回答</b></div><p v-if="!sessions.length" class="muted-block">完成第一次训练后，这里会显示各项能力变化。</p></div></div>
  </section>
</template>

