<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  Activity, Bell, CheckCircle2, Copy, Database, ExternalLink, EyeOff, FileUser, Filter,
  ListChecks, MicVocal, PanelRightOpen, Play, PlugZap, Radar, RefreshCw, Search, ShieldCheck,
  SlidersHorizontal, SquareKanban, TableProperties, Wifi, X
} from '@lucide/vue';
import { useRouter } from 'vue-router';
import type { JobAlertRuleInput, JobFilterPresetInput, JobIndustry, JobSourceConfig, SyncedJob } from '../../shared/domain';
import { buildGreetingDraft, jobMatchesPreset } from '../../shared/job-intelligence';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

type WorkspaceTab = 'pool' | 'sources' | 'filters' | 'logs';

const router = useRouter();
const {
  store, refreshJobSyncStatus, promoteSyncedJob, updateSyncedJobStatus, saveApplication,
  saveJobSource, saveJobFilterPreset, saveJobAlertRule, validateJobSource
} = useWorkspace();

const activeTab = ref<WorkspaceTab>('pool');
const search = ref('');
const sourceFilter = ref('all');
const industryFilter = ref<'all' | JobIndustry>('all');
const statusFilter = ref<'active' | 'all' | 'ignored'>('active');
const activePresetId = ref('');
const compareIds = ref(new Set<string>());
const tokenMessage = ref('');
const pathMessage = ref('');
let statusTimer: number | undefined;

const filterDraft = reactive({
  name: '高匹配实时岗位', includeKeywords: '', excludeKeywords: '实习,兼职,外包', cities: '',
  minSalaryK: 0, minMatchScore: 60, minTrustScore: 70, freshWithinDays: 30, remoteOnly: false
});
const alertDraft = reactive<JobAlertRuleInput>({
  name: '高匹配岗位提醒', presetId: '', channel: 'in-app', enabled: true, threshold: 1, target: ''
});

const jobs = computed(() => store.workspace?.syncedJobs ?? []);
const sources = computed(() => store.workspace?.jobSources ?? []);
const presets = computed(() => store.workspace?.jobFilterPresets ?? []);
const alerts = computed(() => store.workspace?.jobAlertRules ?? []);
const runs = computed(() => store.workspace?.jobSyncRuns ?? []);
const sourceSites = computed(() => [...new Set(jobs.value.map((item) => item.sourceSite))]);
const activePreset = computed(() => presets.value.find((item) => item.id === activePresetId.value));
const comparedJobs = computed(() => jobs.value.filter((item) => compareIds.value.has(item.id)));
const selectedJobId = ref('');
const selectedJob = computed(() => jobs.value.find((item) => item.id === selectedJobId.value));
const dimensionLabels = { role: '岗位方向', skills: '技能覆盖', experience: '经验要求', education: '学历要求', location: '工作地点', salary: '薪资信息', freshness: '岗位时效' };

const filtered = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  return jobs.value.filter((item) => {
    const matchesKeyword = !keyword || `${item.title} ${item.company} ${item.location} ${item.description} ${item.skills.join(' ')}`.toLocaleLowerCase().includes(keyword);
    const matchesSource = sourceFilter.value === 'all' || item.sourceSite === sourceFilter.value;
    const matchesIndustry = industryFilter.value === 'all' || item.industry === industryFilter.value;
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' ? item.status !== 'ignored' : item.status === 'ignored');
    const matchesPreset = !activePreset.value || jobMatchesPreset(item, activePreset.value);
    return matchesKeyword && matchesSource && matchesIndustry && matchesStatus && matchesPreset;
  });
});

const newCount = computed(() => jobs.value.filter((item) => item.status === 'new').length);
const todayCount = computed(() => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return jobs.value.filter((item) => new Date(item.capturedAt).getTime() >= start).length;
});
const highMatchCount = computed(() => jobs.value.filter((item) => item.matchScore >= 75 && item.trustScore >= 70).length);
const riskyCount = computed(() => jobs.value.filter((item) => item.riskFlags.length > 0 || item.trustScore < 60).length);

const industryLabels: Record<JobIndustry, string> = {
  technology: '研发技术', operations: '运维支持', product: '产品', design: '设计创意', sales: '销售商务',
  marketing: '市场运营', finance: '财务金融', 'human-resources': '人力资源', legal: '法务合规',
  healthcare: '医疗健康', education: '教育培训', manufacturing: '制造供应链', general: '综合岗位'
};
const connectorLabels = {
  'browser-extension': '浏览器扩展', mcp: 'MCP', api: '结构化 API', 'company-careers': '公司官网', scraper: '爬虫适配器', import: '文件导入'
};
const sourceStatusLabels = { ready: '可用', configured: '已配置', planned: '待接入', error: '异常' };
const capabilityLabels = {
  search: '搜索', detail: '详情', 'change-tracking': '变更追踪', 'company-check': '企业核验', 'apply-assist': '投递辅助', push: '推送'
};

function displayDate(value?: string): string {
  return value ? new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '暂无';
}

function splitTags(value: string): string[] {
  return [...new Set(value.split(/[,，\n]/u).map((item) => item.trim()).filter(Boolean))];
}

function scoreClass(score: number): string {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'medium';
  return 'weak';
}

async function copyToken(): Promise<void> {
  const token = store.workspace?.settings.jobSyncToken;
  if (!token) return;
  await navigator.clipboard.writeText(token);
  tokenMessage.value = '令牌已复制';
  window.setTimeout(() => { tokenMessage.value = ''; }, 1800);
}

async function copyExtensionPath(): Promise<void> {
  const value = store.meta?.extensionDirectory;
  if (!value) return;
  await navigator.clipboard.writeText(value);
  pathMessage.value = '扩展目录已复制';
  window.setTimeout(() => { pathMessage.value = ''; }, 1800);
}

async function ensureJob(item: SyncedJob) {
  if (item.linkedJobId) return store.workspace?.jobs.find((job) => job.id === item.linkedJobId);
  return promoteSyncedJob(item.id);
}

async function openResume(item: SyncedJob): Promise<void> {
  const job = await ensureJob(item);
  if (job) await router.push({ path: '/resumes', query: { jobId: job.id } });
}

async function openTraining(item: SyncedJob): Promise<void> {
  const job = await ensureJob(item);
  if (job) await router.push({ path: '/training', query: { jobId: job.id } });
}

async function addToPipeline(item: SyncedJob): Promise<void> {
  const job = await ensureJob(item);
  if (!job) return;
  const saved = await saveApplication({
    jobId: job.id, company: item.company, title: item.title, source: item.sourceName, sourceUrl: item.sourceUrl,
    location: item.location, salaryRange: item.salaryRange, status: 'saved', priority: item.matchScore >= 80 ? 'high' : 'medium',
    nextAction: '核对匹配证据，生成定向简历与沟通话术', notes: item.riskFlags.length ? `风险提示：${item.riskFlags.join('；')}` : '',
    greetingDraft: buildGreetingDraft(store.workspace!.profile, item), submissionMode: 'manual'
  });
  if (saved) await router.push('/applications');
}

function toggleCompare(id: string): void {
  const next = new Set(compareIds.value);
  if (next.has(id)) next.delete(id);
  else if (next.size < 4) next.add(id);
  compareIds.value = next;
}

async function toggleSource(source: JobSourceConfig): Promise<void> {
  await saveJobSource({
    id: source.id, name: source.name, platform: source.platform, connectorType: source.connectorType,
    status: source.status, enabled: !source.enabled, endpoint: source.endpoint, intervalMinutes: source.intervalMinutes,
    capabilities: source.capabilities, notes: source.notes
  });
}

async function savePreset(): Promise<void> {
  const input: JobFilterPresetInput = {
    name: filterDraft.name, includeKeywords: splitTags(filterDraft.includeKeywords), excludeKeywords: splitTags(filterDraft.excludeKeywords),
    cities: splitTags(filterDraft.cities), minSalaryK: filterDraft.minSalaryK || undefined,
    minMatchScore: filterDraft.minMatchScore, minTrustScore: filterDraft.minTrustScore,
    remoteOnly: filterDraft.remoteOnly, freshWithinDays: filterDraft.freshWithinDays
  };
  const saved = await saveJobFilterPreset(input);
  if (saved) {
    activePresetId.value = saved.id;
    alertDraft.presetId = saved.id;
  }
}

async function saveAlert(): Promise<void> {
  await saveJobAlertRule(alertDraft);
}

onMounted(() => {
  void refreshJobSyncStatus();
  statusTimer = window.setInterval(() => { void refreshJobSyncStatus(); }, 5000);
});
onBeforeUnmount(() => { if (statusTimer) window.clearInterval(statusTimer); });
</script>

<template>
  <section>
    <PageHeader eyebrow="JOB INTELLIGENCE" title="岗位工作台" description="统一接入、标准化、筛选和评估岗位，再进入定向简历、沟通准备、投递管理与面试训练。">
      <button class="button secondary" type="button" @click="refreshJobSyncStatus"><RefreshCw :size="15" />刷新状态</button>
    </PageHeader>

    <div class="sync-status-band job-intelligence-metrics">
      <div class="sync-connection" :class="{ online: store.jobSyncStatus?.running }"><Wifi :size="18" /><span><strong>{{ store.jobSyncStatus?.running ? '本机 Bridge 已运行' : 'Bridge 未运行' }}</strong><small>127.0.0.1:{{ store.jobSyncStatus?.port ?? 19426 }}</small></span></div>
      <div><span>岗位总数</span><strong>{{ jobs.length }}</strong></div>
      <div><span>今日新增</span><strong>{{ todayCount }}</strong></div>
      <div><span>高匹配</span><strong>{{ highMatchCount }}</strong></div>
      <div><span>风险待核验</span><strong>{{ riskyCount }}</strong></div>
      <div><span>待处理</span><strong>{{ newCount }}</strong></div>
    </div>

    <div class="job-workspace-tabs" role="tablist" aria-label="岗位工作台视图">
      <button :class="{ active: activeTab === 'pool' }" type="button" @click="activeTab = 'pool'"><Database :size="15" />职位池</button>
      <button :class="{ active: activeTab === 'sources' }" type="button" @click="activeTab = 'sources'"><PlugZap :size="15" />数据源</button>
      <button :class="{ active: activeTab === 'filters' }" type="button" @click="activeTab = 'filters'"><SlidersHorizontal :size="15" />筛选与提醒</button>
      <button :class="{ active: activeTab === 'logs' }" type="button" @click="activeTab = 'logs'"><Activity :size="15" />采集日志</button>
    </div>

    <template v-if="activeTab === 'pool'">
      <div class="career-toolbar sync-toolbar job-filter-toolbar">
        <label class="search-field"><Search :size="16" /><input v-model="search" aria-label="搜索同步岗位" placeholder="搜索岗位、公司、地点、技能或描述" /></label>
        <select v-model="activePresetId" class="input compact-select" aria-label="应用筛选规则"><option value="">不使用规则</option><option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.name }}</option></select>
        <select v-model="sourceFilter" class="input compact-select" aria-label="筛选招聘来源"><option value="all">全部来源</option><option v-for="source in sourceSites" :key="source" :value="source">{{ source }}</option></select>
        <select v-model="industryFilter" class="input compact-select" aria-label="筛选行业"><option value="all">全部行业</option><option v-for="(label, value) in industryLabels" :key="value" :value="value">{{ label }}</option></select>
        <select v-model="statusFilter" class="input compact-select" aria-label="筛选岗位状态"><option value="active">有效岗位</option><option value="all">全部岗位</option><option value="ignored">已忽略</option></select>
      </div>

      <section v-if="comparedJobs.length" class="job-compare-panel">
        <header><div><span class="eyebrow">COMPARE</span><h3>岗位对比 · {{ comparedJobs.length }}/4</h3></div><button class="icon-command" type="button" title="清空对比" @click="compareIds = new Set()"><X :size="15" /></button></header>
        <div class="job-compare-grid">
          <div class="compare-labels"><span>岗位</span><span>薪资</span><span>匹配</span><span>可信度</span><span>技能</span><span>风险</span></div>
          <article v-for="item in comparedJobs" :key="item.id"><strong>{{ item.title }}</strong><small>{{ item.company }}</small><span>{{ item.salaryRange || '未披露' }}</span><b>{{ item.matchScore }}</b><b>{{ item.trustScore }}</b><span>{{ item.skills.slice(0, 3).join('、') || '待提取' }}</span><span>{{ item.riskFlags.join('、') || '未发现明显风险' }}</span></article>
        </div>
      </section>

      <div v-if="filtered.length" class="synced-job-list" data-testid="synced-job-list">
        <article v-for="item in filtered" :key="item.id" class="synced-job-row intelligence-job-row">
          <label class="job-compare-check" :title="compareIds.size >= 4 && !compareIds.has(item.id) ? '最多对比 4 个岗位' : '加入对比'"><input type="checkbox" :checked="compareIds.has(item.id)" :disabled="compareIds.size >= 4 && !compareIds.has(item.id)" @change="toggleCompare(item.id)" /></label>
          <div class="synced-job-source"><span>{{ item.sourceName }}</span><small>{{ displayDate(item.lastSeenAt) }}</small><b>{{ industryLabels[item.industry] }} · {{ item.employmentType }}</b></div>
          <div class="synced-job-main">
            <div><span class="status-badge" :class="item.status">{{ item.status === 'new' ? '新岗位' : item.status === 'saved' ? '已保存' : '已忽略' }}</span><h3>{{ item.title }}</h3></div>
            <p>{{ item.company || '未识别公司' }}<span v-if="item.location"> · {{ item.location }}</span><span v-if="item.salaryRange"> · {{ item.salaryRange }}</span><span v-if="item.remote"> · 远程</span></p>
            <div class="job-skill-strip"><span v-for="skill in item.skills.slice(0, 5)" :key="skill">{{ skill }}</span><small v-if="!item.skills.length">技能待提取</small></div>
            <small>{{ item.matchReasons[0] || item.description.slice(0, 120) || '打开岗位详情后可补全 JD。' }}</small>
          </div>
          <div class="job-score-stack"><div :class="scoreClass(item.matchScore)"><span>匹配</span><strong>{{ item.matchScore }}</strong></div><div :class="scoreClass(item.trustScore)"><span>可信</span><strong>{{ item.trustScore }}</strong></div><small v-if="item.riskFlags.length">{{ item.riskFlags[0] }}</small></div>
          <div class="synced-job-actions">
            <a class="icon-command" :href="item.sourceUrl" target="_blank" rel="noreferrer" title="查看原职位"><ExternalLink :size="15" /></a>
            <button class="icon-command" type="button" title="查看岗位详情" @click="selectedJobId = item.id"><PanelRightOpen :size="16" /></button>
            <button class="icon-command" type="button" title="加入求职管道" @click="addToPipeline(item)"><SquareKanban :size="16" /></button>
            <button class="icon-command" type="button" title="制作定向简历" @click="openResume(item)"><FileUser :size="16" /></button>
            <button class="icon-command" type="button" title="开始岗位面试训练" @click="openTraining(item)"><MicVocal :size="16" /></button>
            <button v-if="item.status !== 'ignored'" class="icon-command muted" type="button" title="忽略岗位" @click="updateSyncedJobStatus(item.id, 'ignored')"><EyeOff :size="16" /></button>
          </div>
        </article>
      </div>
      <div v-else class="empty-state career-empty"><div class="empty-icon"><Radar :size="22" /></div><h3>{{ jobs.length ? '没有符合当前规则的岗位' : '等待岗位数据进入职位池' }}</h3><p>{{ jobs.length ? '调整搜索条件、可信度或筛选规则后重试。' : '可先配置数据源框架，真实同步连接器后续逐个启用。' }}</p></div>

      <section v-if="selectedJob" class="job-detail-review">
        <header><div><span class="eyebrow">JOB REVIEW</span><h2>{{ selectedJob.title }}</h2><p>{{ selectedJob.company || '未识别公司' }} · {{ selectedJob.location || '地点未识别' }} · {{ selectedJob.salaryRange || '薪资未披露' }}</p></div><button class="icon-command" type="button" title="关闭详情" @click="selectedJobId = ''"><X :size="16" /></button></header>
        <div class="job-detail-grid">
          <main><div class="job-detail-section"><h3>职位描述</h3><p>{{ selectedJob.description || '当前来源未提供完整 JD。' }}</p></div><div class="job-detail-section"><h3>标准化字段</h3><dl><div><dt>行业</dt><dd>{{ industryLabels[selectedJob.industry] }}</dd></div><div><dt>类型</dt><dd>{{ selectedJob.employmentType }}</dd></div><div><dt>学历</dt><dd>{{ selectedJob.education || '未识别' }}</dd></div><div><dt>经验</dt><dd>{{ selectedJob.experience || '未识别' }}</dd></div><div><dt>远程</dt><dd>{{ selectedJob.remote ? '支持' : '未标明' }}</dd></div><div><dt>状态</dt><dd>{{ selectedJob.lifecycleStatus }}</dd></div></dl></div><div class="job-detail-section"><h3>技能要求</h3><div class="job-skill-strip"><span v-for="skill in selectedJob.skills" :key="skill">{{ skill }}</span><small v-if="!selectedJob.skills.length">待补充完整 JD 后提取</small></div></div></main>
          <aside><div class="detail-score-row"><span><strong>{{ selectedJob.matchScore }}</strong><small>综合匹配</small></span><span><strong>{{ selectedJob.trustScore }}</strong><small>可信度</small></span><span><strong>{{ selectedJob.qualityScore }}</strong><small>数据质量</small></span></div><div class="dimension-bars"><div v-for="(value, key) in selectedJob.matchDimensions" :key="key"><span>{{ dimensionLabels[key] }}</span><i><b :style="{ width: `${value}%` }"></b></i><strong>{{ value }}</strong></div></div><div class="detail-reasons"><strong>推荐依据</strong><span v-for="reason in selectedJob.matchReasons" :key="reason">{{ reason }}</span></div><div class="audit-flags"><span v-for="flag in selectedJob.riskFlags" :key="flag" class="risk">{{ flag }}</span><span v-for="flag in selectedJob.biasFlags" :key="flag" class="bias">{{ flag }}</span></div><div class="job-detail-actions"><button class="button secondary" type="button" @click="openResume(selectedJob)"><FileUser :size="15" />定向简历</button><button class="button primary" type="button" @click="openTraining(selectedJob)"><MicVocal :size="15" />面试准备</button></div></aside>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'sources'">
      <section class="panel sync-setup">
        <div><span class="eyebrow">LOCAL CONNECTOR</span><h3>浏览器可见岗位同步</h3><p>Chrome 扩展只读取当前已打开招聘页面中的可见内容，经本机 Bridge 增量去重后写入职位池。</p><div class="extension-path"><code>{{ store.meta?.extensionDirectory || 'browser-extension' }}</code><button class="icon-command" type="button" title="复制扩展目录" @click="copyExtensionPath"><Copy :size="15" /></button></div><small>{{ pathMessage || '不读取密码、不导出 Cookie，也不在后台绕过验证码。' }}</small></div>
        <div class="sync-token"><label>同步令牌</label><div><code>{{ store.workspace?.settings.jobSyncToken }}</code><button class="icon-command" type="button" title="复制同步令牌" @click="copyToken"><Copy :size="15" /></button></div><small>{{ tokenMessage || `最近接收：${displayDate(store.jobSyncStatus?.lastBatchAt)}` }}</small></div>
      </section>

      <div class="source-registry">
        <article v-for="source in sources" :key="source.id" class="source-row">
          <div class="source-state"><span class="connector-icon"><PlugZap :size="17" /></span><span><strong>{{ source.name }}</strong><small>{{ connectorLabels[source.connectorType] }} · {{ source.platform }}</small></span></div>
          <div class="source-capabilities"><span v-for="capability in source.capabilities" :key="capability">{{ capabilityLabels[capability] }}</span></div>
          <div class="source-endpoint"><code>{{ source.endpoint || '待配置端点 / 适配器' }}</code><small>{{ source.notes }}</small></div>
          <span class="source-status" :class="source.status">{{ sourceStatusLabels[source.status] }}</span>
          <label class="switch compact-switch" :title="source.enabled ? '停用数据源' : '启用数据源'"><input type="checkbox" :checked="source.enabled" @change="toggleSource(source)" /><span></span></label>
          <button class="button ghost compact" type="button" @click="validateJobSource(source.id)"><Play :size="14" />验证框架</button>
        </article>
      </div>
    </template>

    <template v-else-if="activeTab === 'filters'">
      <div class="filter-builder-layout">
        <form class="panel filter-builder" @submit.prevent="savePreset">
          <div class="panel-heading"><div><span class="eyebrow">FILTER SPEC</span><h3>工业级岗位筛选规则</h3></div><Filter :size="19" /></div>
          <label>规则名称<input v-model="filterDraft.name" class="input" required /></label>
          <div class="form-grid two"><label>包含关键词<input v-model="filterDraft.includeKeywords" class="input" placeholder="Kubernetes, SRE, 云原生" /></label><label>排除关键词<input v-model="filterDraft.excludeKeywords" class="input" placeholder="外包, 兼职, 销售" /></label></div>
          <label>目标城市<input v-model="filterDraft.cities" class="input" placeholder="杭州, 上海, 远程；留空表示不限" /></label>
          <div class="form-grid three"><label>最低月薪 K<input v-model.number="filterDraft.minSalaryK" class="input" type="number" min="0" /></label><label>最低匹配度<input v-model.number="filterDraft.minMatchScore" class="input" type="number" min="0" max="100" /></label><label>最低可信度<input v-model.number="filterDraft.minTrustScore" class="input" type="number" min="0" max="100" /></label></div>
          <div class="form-grid two"><label>岗位新鲜度（天）<input v-model.number="filterDraft.freshWithinDays" class="input" type="number" min="0" max="365" /></label><label class="binary-field"><input v-model="filterDraft.remoteOnly" type="checkbox" />只保留远程岗位</label></div>
          <div class="form-actions"><span></span><button class="button primary" type="submit"><ListChecks :size="15" />保存并应用</button></div>
        </form>

        <section class="filter-rule-list">
          <header><div><span class="eyebrow">SAVED SPECS</span><h3>已保存规则</h3></div><strong>{{ presets.length }}</strong></header>
          <button v-for="preset in presets" :key="preset.id" type="button" :class="{ selected: activePresetId === preset.id }" @click="activePresetId = preset.id">
            <span><strong>{{ preset.name }}</strong><small>匹配 ≥ {{ preset.minMatchScore }} · 可信 ≥ {{ preset.minTrustScore }} · {{ preset.freshWithinDays }} 天内</small></span><b>{{ jobs.filter((job) => jobMatchesPreset(job, preset)).length }}</b>
          </button>
          <p v-if="!presets.length">还没有规则。先保存一条规则，职位池即可直接应用。</p>
        </section>
      </div>

      <form class="panel alert-builder" @submit.prevent="saveAlert">
        <div><span class="eyebrow">ALERT ROUTING</span><h3>新增岗位提醒</h3><p>当前版本完整实现应用内提醒规则；Webhook 和邮件只保留配置框架，未发送外部消息。</p></div>
        <label>提醒名称<input v-model="alertDraft.name" class="input" required /></label>
        <label>关联规则<select v-model="alertDraft.presetId" class="input"><option value="">全部岗位</option><option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.name }}</option></select></label>
        <label>渠道<select v-model="alertDraft.channel" class="input"><option value="in-app">应用内</option><option value="webhook">Webhook（框架）</option><option value="email">邮件（框架）</option></select></label>
        <label>累计条数<input v-model.number="alertDraft.threshold" class="input" type="number" min="1" max="100" /></label>
        <label class="binary-field"><input v-model="alertDraft.enabled" type="checkbox" />启用规则</label>
        <button class="button primary" type="submit"><Bell :size="15" />保存提醒</button>
      </form>

      <div v-if="alerts.length" class="alert-rule-strip"><span v-for="alert in alerts" :key="alert.id"><Bell :size="13" />{{ alert.name }} · {{ alert.channel === 'in-app' ? '应用内' : `${alert.channel} 框架` }} · {{ alert.enabled ? '已启用' : '已停用' }}</span></div>
    </template>

    <template v-else>
      <div class="sync-log-table">
        <header><span>执行时间</span><span>数据源</span><span>状态</span><span>抓取</span><span>新增</span><span>更新</span><span>说明</span></header>
        <div v-for="run in runs" :key="run.id"><span>{{ displayDate(run.createdAt) }}</span><strong>{{ run.sourceName }}</strong><span class="run-status" :class="run.status"><CheckCircle2 v-if="run.status !== 'failed'" :size="14" /><ShieldCheck v-else :size="14" />{{ run.status === 'dry-run' ? '框架验证' : run.status === 'success' ? '成功' : run.status === 'warning' ? '警告' : '失败' }}</span><span>{{ run.fetched }}</span><span>{{ run.added }}</span><span>{{ run.updated }}</span><small>{{ run.message }}</small></div>
      </div>
      <div v-if="!runs.length" class="empty-state career-empty"><div class="empty-icon"><TableProperties :size="22" /></div><h3>暂无采集日志</h3><p>在数据源页执行“验证框架”，或由浏览器扩展同步一批岗位后，这里会记录结果。</p></div>
    </template>
  </section>
</template>
