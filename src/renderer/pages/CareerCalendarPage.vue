<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3 } from '@lucide/vue';
import type { JobApplication } from '../../shared/domain';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

interface CareerEvent {
  id: string;
  application: JobApplication;
  kind: 'deadline' | 'action';
  title: string;
  at: string;
}

const router = useRouter();
const { store } = useWorkspace();
const now = computed(() => new Date());
const dayStart = computed(() => new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate()).getTime());
const dayEnd = computed(() => dayStart.value + 24 * 60 * 60 * 1000);
const weekEnd = computed(() => dayStart.value + 7 * 24 * 60 * 60 * 1000);
const events = computed<CareerEvent[]>(() => (store.workspace?.applications ?? []).flatMap((application) => {
  const rows: CareerEvent[] = [];
  if (application.deadline) rows.push({ id: `${application.id}-deadline`, application, kind: 'deadline', title: '报名截止', at: application.deadline });
  if (application.nextActionAt && application.nextAction) rows.push({ id: `${application.id}-action`, application, kind: 'action', title: application.nextAction, at: application.nextActionAt });
  return rows;
}).sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime()));
const overdue = computed(() => events.value.filter((item) => new Date(item.at).getTime() < dayStart.value));
const today = computed(() => events.value.filter((item) => {
  const time = new Date(item.at).getTime();
  return time >= dayStart.value && time < dayEnd.value;
}));
const thisWeek = computed(() => events.value.filter((item) => {
  const time = new Date(item.at).getTime();
  return time >= dayEnd.value && time < weekEnd.value;
}));
const later = computed(() => events.value.filter((item) => new Date(item.at).getTime() >= weekEnd.value));
const unscheduled = computed(() => (store.workspace?.applications ?? []).filter((item) =>
  !['offer', 'rejected', 'withdrawn'].includes(item.status) && !item.deadline && !item.nextActionAt
));

function displayDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function eventRows(items: CareerEvent[]): CareerEvent[] {
  return items;
}
</script>

<template>
  <section>
    <PageHeader eyebrow="CAREER CALENDAR" title="求职日程" description="自动汇总职位截止、HR 跟进和面试节点，优先处理逾期与本周事项。">
      <button class="button secondary" type="button" @click="router.push('/applications')">管理求职机会<ArrowRight :size="16" /></button>
    </PageHeader>

    <div class="career-metrics calendar-metrics">
      <div><span>已逾期</span><strong class="risk-number">{{ overdue.length }}</strong></div>
      <div><span>今天</span><strong>{{ today.length }}</strong></div>
      <div><span>未来 7 天</span><strong>{{ thisWeek.length }}</strong></div>
      <div><span>未安排动作</span><strong>{{ unscheduled.length }}</strong></div>
    </div>

    <div v-if="events.length || unscheduled.length" class="calendar-layout" data-testid="career-calendar">
      <div class="calendar-stream">
        <section v-if="overdue.length" class="calendar-group danger">
          <header><AlertTriangle :size="18" /><div><span class="eyebrow">OVERDUE</span><h3>已逾期</h3></div><strong>{{ overdue.length }}</strong></header>
          <button v-for="item in eventRows(overdue)" :key="item.id" class="calendar-event" type="button" @click="router.push('/applications')"><span class="event-time">{{ displayDate(item.at) }}</span><span><strong>{{ item.title }}</strong><small>{{ item.application.company }} · {{ item.application.title }}</small></span><ArrowRight :size="15" /></button>
        </section>

        <section class="calendar-group">
          <header><Clock3 :size="18" /><div><span class="eyebrow">TODAY</span><h3>今天</h3></div><strong>{{ today.length }}</strong></header>
          <button v-for="item in eventRows(today)" :key="item.id" class="calendar-event" type="button" @click="router.push('/applications')"><span class="event-time">{{ displayDate(item.at) }}</span><span><strong>{{ item.title }}</strong><small>{{ item.application.company }} · {{ item.application.title }}</small></span><ArrowRight :size="15" /></button>
          <p v-if="!today.length" class="calendar-empty-row">今天没有已安排事项</p>
        </section>

        <section class="calendar-group">
          <header><CalendarDays :size="18" /><div><span class="eyebrow">NEXT 7 DAYS</span><h3>未来 7 天</h3></div><strong>{{ thisWeek.length }}</strong></header>
          <button v-for="item in eventRows(thisWeek)" :key="item.id" class="calendar-event" type="button" @click="router.push('/applications')"><span class="event-time">{{ displayDate(item.at) }}</span><span><strong>{{ item.title }}</strong><small>{{ item.application.company }} · {{ item.application.title }}</small></span><ArrowRight :size="15" /></button>
          <p v-if="!thisWeek.length" class="calendar-empty-row">未来 7 天没有已安排事项</p>
        </section>

        <section v-if="later.length" class="calendar-group subdued">
          <header><CalendarDays :size="18" /><div><span class="eyebrow">LATER</span><h3>稍后</h3></div><strong>{{ later.length }}</strong></header>
          <button v-for="item in eventRows(later)" :key="item.id" class="calendar-event" type="button" @click="router.push('/applications')"><span class="event-time">{{ displayDate(item.at) }}</span><span><strong>{{ item.title }}</strong><small>{{ item.application.company }} · {{ item.application.title }}</small></span><ArrowRight :size="15" /></button>
        </section>
      </div>

      <aside class="unscheduled-list">
        <div class="unscheduled-heading"><CheckCircle2 :size="17" /><div><span class="eyebrow">NEEDS A DATE</span><h3>待安排机会</h3></div></div>
        <button v-for="item in unscheduled" :key="item.id" type="button" @click="router.push('/applications')"><strong>{{ item.title }}</strong><span>{{ item.company || '未填写公司' }}</span><small>添加截止日期或下一步时间</small></button>
        <p v-if="!unscheduled.length">所有活跃机会都已经安排下一步。</p>
      </aside>
    </div>

    <div v-else class="empty-state career-empty"><div class="empty-icon"><CalendarDays :size="22" /></div><h3>日程会从求职管道自动生成</h3><p>为职位机会添加报名截止时间或下一步动作时间，这里会自动排序提醒。</p><button class="button primary" type="button" @click="router.push('/applications')">建立求职机会</button></div>
  </section>
</template>
