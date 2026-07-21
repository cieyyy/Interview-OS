<script setup lang="ts">
import { computed } from 'vue';
import { Activity, BarChart3, Building2, CalendarDays, MapPinned, ShieldCheck, Sparkles } from '@lucide/vue';
import type { JobIndustry, SyncedJob } from '../../shared/domain';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store } = useWorkspace();
const jobs = computed(() => store.workspace?.syncedJobs ?? []);
const runs = computed(() => store.workspace?.jobSyncRuns ?? []);

const industryLabels: Record<JobIndustry, string> = {
  technology: '研发技术', operations: '运维支持', product: '产品', design: '设计创意', sales: '销售商务',
  marketing: '市场运营', finance: '财务金融', 'human-resources': '人力资源', legal: '法务合规',
  healthcare: '医疗健康', education: '教育培训', manufacturing: '制造供应链', general: '综合岗位'
};

function groupBy(items: SyncedJob[], key: (item: SyncedJob) => string): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = key(item) || '未识别';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function topSkills(items: SyncedJob[]): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const skill of items.flatMap((item) => item.skills)) counts.set(skill, (counts.get(skill) ?? 0) + 1);
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
}

const cityStats = computed(() => groupBy(jobs.value, (item) => item.location.split(/[·,/，]/u)[0]?.trim() || '未识别').slice(0, 8));
const industryStats = computed(() => groupBy(jobs.value, (item) => industryLabels[item.industry]).slice(0, 8));
const sourceStats = computed(() => groupBy(jobs.value, (item) => item.sourceName).slice(0, 8));
const skillStats = computed(() => topSkills(jobs.value));
const salaryStats = computed(() => {
  const buckets = [
    { label: '<10K', min: 0, max: 10 }, { label: '10-20K', min: 10, max: 20 },
    { label: '20-30K', min: 20, max: 30 }, { label: '30-50K', min: 30, max: 50 },
    { label: '50K+', min: 50, max: Number.POSITIVE_INFINITY }
  ];
  return buckets.map((bucket) => ({ label: bucket.label, value: jobs.value.filter((item) => item.salaryMinK != null && item.salaryMinK >= bucket.min && item.salaryMinK < bucket.max).length }));
});
const dailyStats = computed(() => Array.from({ length: 7 }, (_, index) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (6 - index));
  const end = date.getTime() + 86_400_000;
  return { label: `${date.getMonth() + 1}/${date.getDate()}`, value: jobs.value.filter((item) => {
    const time = new Date(item.capturedAt).getTime();
    return time >= date.getTime() && time < end;
  }).length };
}));

const averageMatch = computed(() => jobs.value.length ? Math.round(jobs.value.reduce((sum, item) => sum + item.matchScore, 0) / jobs.value.length) : 0);
const averageTrust = computed(() => jobs.value.length ? Math.round(jobs.value.reduce((sum, item) => sum + item.trustScore, 0) / jobs.value.length) : 0);
const completeCount = computed(() => jobs.value.filter((item) => item.company && item.location && item.description.length >= 60).length);
const activeSources = computed(() => store.workspace?.jobSources.filter((item) => item.enabled).length ?? 0);

function maxValue(rows: Array<{ value: number }>): number {
  return Math.max(1, ...rows.map((item) => item.value));
}
</script>

<template>
  <section>
    <PageHeader eyebrow="JOB MARKET" title="岗位洞察" description="从本地标准化职位池查看地区、行业、技能、薪资和采集任务趋势，为筛选与能力补强提供依据。" />

    <div class="career-metrics insights-metrics">
      <div><span>标准化岗位</span><strong>{{ jobs.length }}</strong></div>
      <div><span>平均匹配度</span><strong>{{ averageMatch }}</strong></div>
      <div><span>平均可信度</span><strong>{{ averageTrust }}</strong></div>
      <div><span>字段完整岗位</span><strong>{{ completeCount }}</strong></div>
      <div><span>启用数据源</span><strong>{{ activeSources }}</strong></div>
    </div>

    <div v-if="jobs.length" class="insights-grid">
      <section class="insight-panel wide"><header><span><CalendarDays :size="17" /><strong>最近 7 天新增</strong></span><small>按首次进入职位池时间</small></header><div class="vertical-bars"><div v-for="item in dailyStats" :key="item.label"><span><i :style="{ height: `${Math.max(4, item.value / maxValue(dailyStats) * 100)}%` }"></i></span><b>{{ item.value }}</b><small>{{ item.label }}</small></div></div></section>
      <section class="insight-panel"><header><span><MapPinned :size="17" /><strong>地区分布</strong></span><small>Top 8</small></header><div class="horizontal-bars"><div v-for="item in cityStats" :key="item.label"><span>{{ item.label }}</span><i><b :style="{ width: `${item.value / maxValue(cityStats) * 100}%` }"></b></i><strong>{{ item.value }}</strong></div></div></section>
      <section class="insight-panel"><header><span><Building2 :size="17" /><strong>行业分布</strong></span><small>自动分类</small></header><div class="horizontal-bars green"><div v-for="item in industryStats" :key="item.label"><span>{{ item.label }}</span><i><b :style="{ width: `${item.value / maxValue(industryStats) * 100}%` }"></b></i><strong>{{ item.value }}</strong></div></div></section>
      <section class="insight-panel"><header><span><Sparkles :size="17" /><strong>技能热度</strong></span><small>JD 关键词</small></header><div class="skill-cloud"><span v-for="item in skillStats" :key="item.label"><b>{{ item.label }}</b><small>{{ item.value }}</small></span><p v-if="!skillStats.length">等待完整 JD 后提取技能。</p></div></section>
      <section class="insight-panel"><header><span><BarChart3 :size="17" /><strong>最低月薪分布</strong></span><small>K / 月</small></header><div class="horizontal-bars amber"><div v-for="item in salaryStats" :key="item.label"><span>{{ item.label }}</span><i><b :style="{ width: `${item.value / maxValue(salaryStats) * 100}%` }"></b></i><strong>{{ item.value }}</strong></div></div></section>
      <section class="insight-panel wide source-health"><header><span><Activity :size="17" /><strong>来源与任务健康度</strong></span><small>{{ runs.length }} 条运行记录</small></header><div class="source-health-grid"><div v-for="item in sourceStats" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>岗位</small></div><div class="health-summary"><ShieldCheck :size="20" /><span><strong>{{ runs.filter((item) => item.status === 'failed').length }}</strong><small>失败任务</small></span><span><strong>{{ runs.filter((item) => item.status === 'success').length }}</strong><small>成功批次</small></span><span><strong>{{ jobs.filter((item) => item.riskFlags.length).length }}</strong><small>风险待核验</small></span></div></div></section>
    </div>

    <div v-else class="empty-state career-empty"><div class="empty-icon"><BarChart3 :size="22" /></div><h3>职位池暂无可分析数据</h3><p>岗位通过浏览器扩展、MCP、公司官网适配器或结构化文件进入后，这里会自动生成统计。</p></div>
  </section>
</template>
