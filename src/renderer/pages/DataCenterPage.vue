<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { BellRing, CheckCircle2, Clipboard, Database, FileBarChart, Filter, RadioTower, Rows3, ShieldCheck, Table2 } from '@lucide/vue';
import type { JobAlertChannel, JobAlertRuleInput, SyncedJob } from '../../shared/domain';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

type DataTab = 'quality' | 'report' | 'push';
const { store, saveJobAlertRule } = useWorkspace();
const activeTab = ref<DataTab>('quality');
const copied = ref('');
const alertDraft = reactive<JobAlertRuleInput>({ name: '高匹配岗位提醒', presetId: '', channel: 'in-app', enabled: true, threshold: 1, target: '' });

const jobs = computed(() => store.workspace?.syncedJobs ?? []);
const sources = computed(() => store.workspace?.jobSources ?? []);
const runs = computed(() => store.workspace?.jobSyncRuns ?? []);
const alerts = computed(() => store.workspace?.jobAlertRules ?? []);
const presets = computed(() => store.workspace?.jobFilterPresets ?? []);

function filled(item: SyncedJob, field: keyof SyncedJob): boolean {
  const value = item[field];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

const fieldQuality = computed(() => [
  { label: '公司名称', field: 'company' as const }, { label: '工作地点', field: 'location' as const },
  { label: '薪资区间', field: 'salaryRange' as const }, { label: '完整 JD', field: 'description' as const },
  { label: '学历要求', field: 'education' as const }, { label: '经验要求', field: 'experience' as const },
  { label: '技能标签', field: 'skills' as const }, { label: '发布时间', field: 'postedAt' as const }
].map((item) => ({ ...item, count: jobs.value.filter((job) => filled(job, item.field)).length, percent: jobs.value.length ? Math.round(jobs.value.filter((job) => filled(job, item.field)).length / jobs.value.length * 100) : 0 })));

const sourceQuality = computed(() => sources.value.map((source) => {
  const sourceJobs = jobs.value.filter((item) => item.sourceSite === source.platform || item.sourceName.includes(source.platform) || source.platform.includes(item.sourceName));
  return {
    ...source,
    jobs: sourceJobs.length,
    quality: sourceJobs.length ? Math.round(sourceJobs.reduce((sum, item) => sum + item.qualityScore, 0) / sourceJobs.length) : 0,
    failures: runs.value.filter((item) => item.sourceId === source.id && item.status === 'failed').length
  };
}));
const averageQuality = computed(() => jobs.value.length ? Math.round(jobs.value.reduce((sum, item) => sum + item.qualityScore, 0) / jobs.value.length) : 0);
const duplicateSignals = computed(() => jobs.value.filter((item) => item.seenCount > 1).length);
const riskCount = computed(() => jobs.value.filter((item) => item.riskFlags.length || item.biasFlags.length).length);
const channelLabels: Record<JobAlertChannel, string> = { 'in-app': '应用内', webhook: '通用 Webhook', email: '邮件', feishu: '飞书', wecom: '企业微信', dingtalk: '钉钉', telegram: 'Telegram' };

function csvEscape(value: unknown): string {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(): string {
  const headers = ['title', 'company', 'city', 'salary', 'education', 'experience', 'skills', 'source', 'publish_time', 'detail_url', 'match_score', 'trust_score'];
  const rows = jobs.value.map((item) => [item.title, item.company, item.location, item.salaryRange, item.education, item.experience, item.skills, item.sourceName, item.postedAt ?? '', item.sourceUrl, item.matchScore, item.trustScore]);
  return [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

function buildReport(): string {
  const topSkills = new Map<string, number>();
  for (const skill of jobs.value.flatMap((item) => item.skills)) topSkills.set(skill, (topSkills.get(skill) ?? 0) + 1);
  const skills = [...topSkills.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return [
    '# Interview OS 岗位数据报告', '', `- 岗位总数：${jobs.value.length}`, `- 平均字段质量：${averageQuality.value}`,
    `- 重复出现岗位：${duplicateSignals.value}`, `- 风险待核验：${riskCount.value}`, '', '## 热门技能',
    ...skills.map(([skill, count]) => `- ${skill}: ${count}`), '', '## 数据源',
    ...sourceQuality.value.map((source) => `- ${source.name}: ${source.jobs} 条，质量 ${source.quality}`)
  ].join('\n');
}

async function copyExport(kind: 'csv' | 'json' | 'report'): Promise<void> {
  const value = kind === 'csv' ? buildCsv() : kind === 'json' ? JSON.stringify(jobs.value, null, 2) : buildReport();
  await navigator.clipboard.writeText(value);
  copied.value = kind;
  window.setTimeout(() => { copied.value = ''; }, 1800);
}

async function saveAlert(): Promise<void> {
  await saveJobAlertRule(alertDraft);
}
</script>

<template>
  <section>
    <PageHeader eyebrow="DATA PIPELINE" title="数据中心" description="统一查看采集、清洗、标准化、去重、分析和推送链路，输出结构化职位数据与质量报告。" />

    <div class="career-metrics data-metrics"><div><span>职位记录</span><strong>{{ jobs.length }}</strong></div><div><span>平均数据质量</span><strong>{{ averageQuality }}</strong></div><div><span>重复更新</span><strong>{{ duplicateSignals }}</strong></div><div><span>风险待核验</span><strong>{{ riskCount }}</strong></div><div><span>运行日志</span><strong>{{ runs.length }}</strong></div></div>

    <div class="job-workspace-tabs"><button :class="{ active: activeTab === 'quality' }" type="button" @click="activeTab = 'quality'"><ShieldCheck :size="15" />质量与流水线</button><button :class="{ active: activeTab === 'report' }" type="button" @click="activeTab = 'report'"><FileBarChart :size="15" />结构化输出</button><button :class="{ active: activeTab === 'push' }" type="button" @click="activeTab = 'push'"><RadioTower :size="15" />推送中心</button></div>

    <template v-if="activeTab === 'quality'">
      <div class="pipeline-stages"><div><span><Database :size="17" /></span><strong>采集</strong><small>{{ runs.length }} 次运行</small></div><i></i><div><span><Filter :size="17" /></span><strong>清洗</strong><small>薪资/城市/字段</small></div><i></i><div><span><Rows3 :size="17" /></span><strong>标准化</strong><small>{{ jobs.length }} 条岗位</small></div><i></i><div><span><ShieldCheck :size="17" /></span><strong>质量审计</strong><small>{{ riskCount }} 条待核验</small></div><i></i><div><span><BellRing :size="17" /></span><strong>分发</strong><small>{{ alerts.filter((item) => item.enabled).length }} 条规则</small></div></div>

      <div class="data-quality-layout">
        <section class="data-quality-panel"><header><div><span class="eyebrow">FIELD COVERAGE</span><h3>标准字段完整度</h3></div><strong>{{ averageQuality }}</strong></header><div class="dimension-bars"><div v-for="item in fieldQuality" :key="item.field"><span>{{ item.label }}</span><i><b :style="{ width: `${item.percent}%` }"></b></i><strong>{{ item.percent }}%</strong></div></div></section>
        <section class="data-quality-panel source-quality"><header><div><span class="eyebrow">SOURCE HEALTH</span><h3>数据源质量</h3></div><strong>{{ sources.length }}</strong></header><div><article v-for="source in sourceQuality" :key="source.id"><span><strong>{{ source.name }}</strong><small>{{ source.connectorType }} · {{ source.status }}</small></span><b>{{ source.jobs }}</b><i>{{ source.quality || '-' }}</i><em :class="{ danger: source.failures }">{{ source.failures }}</em></article></div></section>
      </div>
    </template>

    <template v-else-if="activeTab === 'report'">
      <div class="export-layout">
        <section class="export-command"><span><Table2 :size="20" /></span><div><h3>标准化 CSV</h3><p>岗位、公司、城市、薪资、学历、经验、技能、来源、时间和评分。</p></div><button class="button secondary" type="button" @click="copyExport('csv')"><Clipboard :size="15" />{{ copied === 'csv' ? '已复制' : '复制 CSV' }}</button></section>
        <section class="export-command"><span><Database :size="20" /></span><div><h3>完整 JSON</h3><p>保留统一职位契约、匹配分项、风险标记和生命周期字段。</p></div><button class="button secondary" type="button" @click="copyExport('json')"><Clipboard :size="15" />{{ copied === 'json' ? '已复制' : '复制 JSON' }}</button></section>
        <section class="export-command"><span><FileBarChart :size="20" /></span><div><h3>职位分布报告</h3><p>汇总数据质量、来源健康度、热门技能和异常数量。</p></div><button class="button secondary" type="button" @click="copyExport('report')"><Clipboard :size="15" />{{ copied === 'report' ? '已复制' : '复制报告' }}</button></section>
      </div>
      <section class="report-preview"><header><span class="eyebrow">REPORT PREVIEW</span><h3>本地报告预览</h3></header><pre>{{ buildReport() }}</pre></section>
    </template>

    <template v-else>
      <div class="push-layout">
        <form class="panel push-rule-form" @submit.prevent="saveAlert"><div class="panel-heading"><div><span class="eyebrow">NOTIFICATION RULE</span><h3>新增推送规则</h3></div><BellRing :size="19" /></div><label>规则名称<input v-model="alertDraft.name" class="input" required /></label><label>筛选规则<select v-model="alertDraft.presetId" class="input"><option value="">全部岗位</option><option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.name }}</option></select></label><label>推送渠道<select v-model="alertDraft.channel" class="input"><option v-for="(label, value) in channelLabels" :key="value" :value="value">{{ label }}</option></select></label><label>累计命中数量<input v-model.number="alertDraft.threshold" class="input" type="number" min="1" max="100" /></label><label class="binary-field"><input v-model="alertDraft.enabled" type="checkbox" />启用规则</label><button class="button primary" type="submit">保存推送框架</button><small>应用内提醒可直接使用；外部渠道的密钥和真实发送将在服务器阶段接入。</small></form>
        <section class="push-channel-grid"><header><div><span class="eyebrow">CHANNELS</span><h3>推送通道</h3></div><strong>{{ Object.keys(channelLabels).length }}</strong></header><article v-for="(label, value) in channelLabels" :key="value"><span><RadioTower :size="16" /><strong>{{ label }}</strong></span><small>{{ value === 'in-app' ? '本地可用' : '连接器框架已预留' }}</small><CheckCircle2 :size="16" :class="{ active: value === 'in-app' }" /></article></section>
      </div>
      <div v-if="alerts.length" class="sync-log-table push-rule-table"><header><span>规则</span><span>筛选</span><span>渠道</span><span>阈值</span><span>状态</span></header><div v-for="alert in alerts" :key="alert.id"><strong>{{ alert.name }}</strong><span>{{ presets.find((item) => item.id === alert.presetId)?.name || '全部岗位' }}</span><span>{{ channelLabels[alert.channel] }}</span><span>{{ alert.threshold }}</span><span>{{ alert.enabled ? '已启用' : '已停用' }}</span></div></div>
    </template>
  </section>
</template>
