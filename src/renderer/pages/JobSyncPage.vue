<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  Activity, Bell, CheckCircle2, Copy, Database, ExternalLink, EyeOff, FileSearch, FileUser, Filter,
  ListChecks, MapPin, MicVocal, PanelRightOpen, Play, PlugZap, Radar, RefreshCw, Search, ShieldCheck, Star,
  RotateCcw, SlidersHorizontal, SquareKanban, TableProperties, Trash2, Wifi, X
} from '@lucide/vue';
import { useRouter } from 'vue-router';
import type { JobAlertRuleInput, JobFilterPreset, JobFilterPresetInput, JobIndustry, JobSourceConfig, SyncedJob } from '../../shared/domain';
import { buildGreetingDraft, jobMatchesPreset } from '../../shared/job-intelligence';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

type WorkspaceTab = 'pool' | 'sources' | 'filters' | 'logs';

const router = useRouter();
const {
  store, refreshJobSyncStatus, promoteSyncedJob, updateSyncedJobStatus, bulkUpdateSyncedJobStatus, saveApplication,
  saveJobSource, saveJobFilterPreset, deleteJobFilterPreset, saveJobAlertRule, deleteJobAlertRule, validateJobSource, copyText,
  bulkRestoreSyncedJobs, deleteSyncedJobPermanently, bulkDeleteSyncedJobsPermanently
} = useWorkspace();

const activeTab = ref<WorkspaceTab>('pool');
const search = ref('');
const sourceFilter = ref('all');
const industryFilter = ref<'all' | JobIndustry>('all');
const statusFilter = ref<'active' | 'all' | 'ignored' | 'trashed'>('active');
const preferredAddress = ref('');
const nearestOnly = ref(false);
const locationSort = ref<'default' | 'nearest'>('default');
const activePresetId = ref('');
const selectedPresetId = ref('');
const editingPresetId = ref('');
const compareIds = ref(new Set<string>());
const bulkMode = ref(false);
const bulkSelection = ref(new Set<string>());
const tokenMessage = ref('');
const pathMessage = ref('');
const rulePage = ref(1);
const logPage = ref(1);
const pageSize = 5;
let statusTimer: number | undefined;

const filterDraft = reactive<{
  name: string;
  includeKeywords: string;
  excludeKeywords: string;
  cities: string;
  industries: JobIndustry[];
  sources: string[];
  minSalaryK: number;
  minMatchScore: number;
  minTrustScore: number;
  freshWithinDays: number;
  remoteOnly: boolean;
}>({
  name: '高匹配实时岗位', includeKeywords: '', excludeKeywords: '实习,兼职,外包', cities: '',
  industries: [], sources: [],
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
const pagedPresets = computed(() => presets.value.slice((rulePage.value - 1) * pageSize, rulePage.value * pageSize));
const ruleTotalPages = computed(() => Math.max(1, Math.ceil(presets.value.length / pageSize)));
const pagedRuns = computed(() => runs.value.slice((logPage.value - 1) * pageSize, logPage.value * pageSize));
const logTotalPages = computed(() => Math.max(1, Math.ceil(runs.value.length / pageSize)));
const sourceSites = computed(() => [...new Set(jobs.value.map((item) => item.sourceSite))]);
const nonTrashedJobs = computed(() => jobs.value.filter((item) => item.status !== 'trashed'));
const trashedCount = computed(() => jobs.value.filter((item) => item.status === 'trashed').length);
const activePreset = computed(() => presets.value.find((item) => item.id === activePresetId.value));
const selectedPreset = computed(() => presets.value.find((item) => item.id === selectedPresetId.value));
const comparedJobs = computed(() => jobs.value.filter((item) => compareIds.value.has(item.id)));
const selectedJobId = ref('');
const dimensionLabels = { role: '岗位方向', skills: '技能覆盖', experience: '经验要求', education: '学历要求', location: '工作地点', salary: '薪资信息', freshness: '岗位时效' };

function normalizeAddress(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s·,，、;；()（）-]/gu, '').replace(/省|自治区|特别行政区/gu, '');
}

function addressPart(value: string, suffix: '市' | '区' | '县'): string {
  const match = value.match(new RegExp(`([\\u4e00-\\u9fa5]{2,8})${suffix}`, 'u'));
  return match?.[1]?.replace(/^.*?(?:省|市)/u, '') ?? '';
}

function locationAffinity(item: SyncedJob): number {
  const target = normalizeAddress(preferredAddress.value);
  const location = normalizeAddress(item.location);
  if (!target) return 0;
  if (item.remote) return 110;
  if (!location) return 10;
  if ((target.includes(location) || location.includes(target)) && Math.min(target.length, location.length) >= 4) return 100;
  const targetDistrict = addressPart(preferredAddress.value, '区') || addressPart(preferredAddress.value, '县');
  const jobDistrict = addressPart(item.location, '区') || addressPart(item.location, '县');
  if (targetDistrict && jobDistrict && targetDistrict === jobDistrict) return 90;
  const targetCity = addressPart(preferredAddress.value, '市') || preferredAddress.value.split(/[·,，\s]/u)[0].replace(/市$/u, '');
  const jobCity = addressPart(item.location, '市') || item.location.split(/[·,，\s]/u)[0].replace(/市$/u, '');
  if (targetCity.length >= 2 && jobCity.length >= 2 && normalizeAddress(targetCity) === normalizeAddress(jobCity)) return 70;
  if (target.slice(0, 2) && target.slice(0, 2) === location.slice(0, 2)) return 70;
  return 0;
}

function locationAffinityLabel(item: SyncedJob): string {
  const score = locationAffinity(item);
  if (!preferredAddress.value) return '';
  if (score >= 110) return '远程岗位';
  if (score >= 90) return '同区优先';
  if (score >= 70) return '同城';
  if (score === 10) return '地址待补全';
  return '异地';
}

function savePreferredAddress(): void {
  preferredAddress.value = preferredAddress.value.trim();
  window.localStorage.setItem('interview-os:preferred-address', preferredAddress.value);
}

const filtered = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  const results = jobs.value.filter((item) => {
    const matchesKeyword = !keyword || `${item.title} ${item.company} ${item.location} ${item.description} ${item.skills.join(' ')}`.toLocaleLowerCase().includes(keyword);
    const matchesSource = sourceFilter.value === 'all' || item.sourceSite === sourceFilter.value;
    const matchesIndustry = industryFilter.value === 'all' || item.industry === industryFilter.value;
    const matchesStatus = statusFilter.value === 'all'
      ? item.status !== 'trashed'
      : statusFilter.value === 'active'
        ? item.status !== 'ignored' && item.status !== 'trashed'
        : item.status === statusFilter.value;
    const matchesPreset = !activePreset.value || jobMatchesPreset(item, activePreset.value);
    const matchesLocation = !nearestOnly.value || !preferredAddress.value || locationAffinity(item) >= 70;
    return matchesKeyword && matchesSource && matchesIndustry && matchesStatus && matchesPreset && matchesLocation;
  });
  return locationSort.value === 'nearest' && preferredAddress.value
    ? results.sort((left, right) => locationAffinity(right) - locationAffinity(left))
    : results;
});
const bulkSelectableJobs = computed(() => filtered.value);
const allVisibleBulkSelected = computed(() => bulkSelectableJobs.value.length > 0
  && bulkSelectableJobs.value.every((item) => bulkSelection.value.has(item.id)));

const newCount = computed(() => nonTrashedJobs.value.filter((item) => item.status === 'new').length);
const todayCount = computed(() => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return nonTrashedJobs.value.filter((item) => new Date(item.capturedAt).getTime() >= start).length;
});
const highMatchCount = computed(() => nonTrashedJobs.value.filter((item) => item.matchScore >= 75 && item.trustScore >= 70).length);
const riskyCount = computed(() => nonTrashedJobs.value.filter((item) => item.riskFlags.length > 0 || item.trustScore < 60).length);

const industryLabels: Record<JobIndustry, string> = {
  technology: '研发技术', operations: '运维支持', product: '产品', design: '设计创意', sales: '销售商务',
  marketing: '市场运营', finance: '财务金融', 'human-resources': '人力资源', legal: '法务合规',
  healthcare: '医疗健康', education: '教育培训', manufacturing: '制造供应链', general: '综合岗位'
};
const industryOptions = computed(() => Object.entries(industryLabels) as Array<[JobIndustry, string]>);
const sourceOptions = computed(() => {
  const observed = jobs.value.map((job) => job.sourceSite).filter(Boolean);
  return [...new Set(['boss', 'zhaopin', '51job', 'liepin', 'lagou', 'company-careers', 'import', ...observed])];
});
const connectorLabels = {
  'browser-extension': '浏览器扩展', mcp: 'MCP', api: '结构化 API', 'company-careers': '公司官网', scraper: '爬虫适配器', import: '文件导入'
};
const sourceStatusLabels = { ready: '可用', configured: '已配置', planned: '待接入', error: '异常' };
const capabilityLabels = {
  search: '搜索', detail: '详情', 'change-tracking': '变更追踪', 'company-check': '企业核验', 'apply-assist': '投递辅助', push: '推送'
};
const connectorActionLabel = (source: JobSourceConfig): string => {
  if (source.status === 'planned') return '尚未接入';
  if (source.connectorType === 'browser-extension') {
    return source.endpoint.startsWith('browser-extension://') ? '检查页面适配器' : '真实连通测试';
  }
  if (source.connectorType === 'company-careers') return '检查官网监控';
  if (source.connectorType === 'mcp' || source.connectorType === 'api') return '检查连接配置';
  if (source.connectorType === 'scraper') return '探测采集服务';
  return '检查导入配置';
};
const lastRunFor = (sourceId: string) => runs.value.find((run) => run.sourceId === sourceId);

async function writeClipboard(value: string): Promise<boolean> {
  const copied = await copyText(value);
  if (copied?.copied) return true;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const fallbackCopied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return fallbackCopied;
}

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

function presetHitCount(preset: JobFilterPreset): number {
  return jobs.value.filter((job) => jobMatchesPreset(job, preset)).length;
}

function presetSummary(preset: JobFilterPreset): string {
  const industryText = preset.industries.length ? preset.industries.map((industry) => industryLabels[industry]).join(' / ') : '全部行业';
  const sourceText = preset.sources.length ? preset.sources.join(' / ') : '全部来源';
  return `${industryText} · ${sourceText} · 匹配 ≥ ${preset.minMatchScore} · 可信 ≥ ${preset.minTrustScore} · ${preset.freshWithinDays} 天内`;
}

function selectPresetForManagement(preset: JobFilterPreset): void {
  selectedPresetId.value = preset.id;
}

function applyPresetToPool(presetId: string): void {
  activePresetId.value = presetId;
  activeTab.value = 'pool';
}

function clearPoolPreset(): void {
  activePresetId.value = '';
}

function focusRiskFlag(flag: string): void {
  activeTab.value = 'pool';
  search.value = flag;
  selectedJobId.value = '';
}

function loadPresetToDraft(preset: JobFilterPreset): void {
  selectedPresetId.value = preset.id;
  editingPresetId.value = preset.id;
  filterDraft.name = preset.name;
  filterDraft.includeKeywords = preset.includeKeywords.join(', ');
  filterDraft.excludeKeywords = preset.excludeKeywords.join(', ');
  filterDraft.cities = preset.cities.join(', ');
  filterDraft.industries = [...preset.industries];
  filterDraft.sources = [...preset.sources];
  filterDraft.minSalaryK = preset.minSalaryK ?? 0;
  filterDraft.minMatchScore = preset.minMatchScore;
  filterDraft.minTrustScore = preset.minTrustScore;
  filterDraft.freshWithinDays = preset.freshWithinDays;
  filterDraft.remoteOnly = preset.remoteOnly;
}

function startNewPreset(): void {
  selectedPresetId.value = '';
  editingPresetId.value = '';
  filterDraft.name = '高匹配实时岗位';
  filterDraft.includeKeywords = '';
  filterDraft.excludeKeywords = '实习,兼职,外包';
  filterDraft.cities = '';
  filterDraft.industries = [];
  filterDraft.sources = [];
  filterDraft.minSalaryK = 0;
  filterDraft.minMatchScore = 60;
  filterDraft.minTrustScore = 70;
  filterDraft.freshWithinDays = 30;
  filterDraft.remoteOnly = false;
}

async function copyToken(): Promise<void> {
  const token = store.workspace?.settings.jobSyncToken;
  if (!token) return;
  tokenMessage.value = await writeClipboard(token) ? '令牌已复制，可粘贴到 Chrome 扩展' : '复制失败，请选中令牌后按 Ctrl+C';
  window.setTimeout(() => { tokenMessage.value = ''; }, 1800);
}

async function copyExtensionPath(): Promise<void> {
  const value = store.meta?.extensionDirectory;
  if (!value) return;
  pathMessage.value = await writeClipboard(value) ? '扩展目录已复制' : '复制失败，请选中目录后按 Ctrl+C';
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

async function openJobAnalysis(item: SyncedJob): Promise<void> {
  const job = await ensureJob(item);
  if (job) await router.push({ path: '/jobs', query: { jobId: job.id } });
}

async function toggleTargetJob(item: SyncedJob): Promise<void> {
  await updateSyncedJobStatus(item.id, item.status === 'saved' ? 'new' : 'saved');
}

async function addToPipeline(item: SyncedJob): Promise<void> {
  const job = await ensureJob(item);
  if (!job) return;
  const resume = store.workspace?.resumeVariants.find((candidate) => candidate.jobId === job.id);
  const projects = resume ? store.workspace?.projects.filter((project) => resume.projectIds.includes(project.id)) ?? [] : [];
  const skillNames = resume ? store.workspace?.profile.skills.filter((skill) => resume.skillIds.includes(skill.id)).map((skill) => skill.name) ?? [] : [];
  const saved = await saveApplication({
    jobId: job.id, company: item.company, title: item.title, source: item.sourceName, sourceUrl: item.sourceUrl,
    resumeVariantId: resume?.id,
    location: item.location, salaryRange: item.salaryRange, status: 'saved', priority: item.matchScore >= 80 ? 'high' : 'medium',
    nextAction: resume ? '核对定向简历与沟通话术' : '先生成与该岗位关联的定向简历，再制作沟通话术', notes: item.riskFlags.length ? `风险提示：${item.riskFlags.join('；')}` : '',
    greetingDraft: resume ? buildGreetingDraft(store.workspace!.profile, item, { name: resume.name, headline: resume.headline, summary: resume.summary, highlights: resume.highlights, projectNames: projects.map((project) => project.name), skillNames }) : '', submissionMode: 'manual'
  });
  if (saved) await router.push('/applications');
}

function toggleCompare(id: string): void {
  const next = new Set(compareIds.value);
  if (next.has(id)) next.delete(id);
  else if (next.size < 4) next.add(id);
  compareIds.value = next;
}

function toggleBulkMode(): void {
  bulkMode.value = !bulkMode.value;
  bulkSelection.value = new Set();
}

function resetBulkSelection(): void {
  bulkSelection.value = new Set();
}

function toggleBulkSelection(id: string): void {
  const next = new Set(bulkSelection.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  bulkSelection.value = next;
}

function toggleAllVisibleBulkJobs(): void {
  const next = new Set(bulkSelection.value);
  if (allVisibleBulkSelected.value) bulkSelectableJobs.value.forEach((item) => next.delete(item.id));
  else bulkSelectableJobs.value.forEach((item) => next.add(item.id));
  bulkSelection.value = next;
}

async function trashSelectedJobs(): Promise<void> {
  const ids = [...bulkSelection.value];
  if (!ids.length) return;
  if (!window.confirm(`将选中的 ${ids.length} 个岗位移入回收站？之后可在回收站恢复。`)) return;
  const result = await bulkUpdateSyncedJobStatus(ids, 'trashed');
  if (!result?.updated) return;
  compareIds.value = new Set([...compareIds.value].filter((id) => !bulkSelection.value.has(id)));
  if (selectedJobId.value && bulkSelection.value.has(selectedJobId.value)) selectedJobId.value = '';
  bulkSelection.value = new Set();
  bulkMode.value = false;
}

async function restoreSelectedJobs(): Promise<void> {
  const ids = [...bulkSelection.value];
  if (!ids.length) return;
  const result = await bulkRestoreSyncedJobs(ids);
  if (!result?.restored) return;
  if (selectedJobId.value && bulkSelection.value.has(selectedJobId.value)) selectedJobId.value = '';
  bulkSelection.value = new Set();
  bulkMode.value = false;
}

async function deleteSelectedJobsForever(): Promise<void> {
  const ids = [...bulkSelection.value];
  if (!ids.length) return;
  if (!window.confirm(`彻底删除选中的 ${ids.length} 个岗位？此操作无法撤销。`)) return;
  const result = await bulkDeleteSyncedJobsPermanently(ids);
  if (!result?.deleted) return;
  if (selectedJobId.value && bulkSelection.value.has(selectedJobId.value)) selectedJobId.value = '';
  bulkSelection.value = new Set();
  bulkMode.value = false;
}

async function trashSyncedJob(item: SyncedJob): Promise<void> {
  await updateSyncedJobStatus(item.id, 'trashed');
  const next = new Set(compareIds.value);
  next.delete(item.id);
  compareIds.value = next;
  if (selectedJobId.value === item.id) selectedJobId.value = '';
}

async function restoreSyncedJob(item: SyncedJob): Promise<void> {
  await updateSyncedJobStatus(item.id, item.linkedJobId ? 'saved' : 'new');
}

async function deleteSyncedJobForever(item: SyncedJob): Promise<void> {
  if (!window.confirm(`彻底删除岗位「${item.title}」？删除后不能从回收站恢复。`)) return;
  await deleteSyncedJobPermanently(item.id);
  const next = new Set(compareIds.value);
  next.delete(item.id);
  compareIds.value = next;
  if (selectedJobId.value === item.id) selectedJobId.value = '';
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
    id: editingPresetId.value || undefined,
    name: filterDraft.name, includeKeywords: splitTags(filterDraft.includeKeywords), excludeKeywords: splitTags(filterDraft.excludeKeywords),
    cities: splitTags(filterDraft.cities), industries: filterDraft.industries, sources: filterDraft.sources,
    minSalaryK: filterDraft.minSalaryK || undefined,
    minMatchScore: filterDraft.minMatchScore, minTrustScore: filterDraft.minTrustScore,
    remoteOnly: filterDraft.remoteOnly, freshWithinDays: filterDraft.freshWithinDays
  };
  const saved = await saveJobFilterPreset(input);
  if (saved) {
    selectedPresetId.value = saved.id;
    editingPresetId.value = saved.id;
    alertDraft.presetId = saved.id;
  }
}

async function saveAlert(): Promise<void> {
  await saveJobAlertRule(alertDraft);
}

async function removePreset(preset: JobFilterPreset): Promise<void> {
  if (!window.confirm(`删除筛选规则“${preset.name}”？关联提醒会自动改为“全部岗位”。`)) return;
  await deleteJobFilterPreset(preset.id);
  if (selectedPresetId.value === preset.id) selectedPresetId.value = '';
  if (editingPresetId.value === preset.id) startNewPreset();
  if (activePresetId.value === preset.id) activePresetId.value = '';
  rulePage.value = Math.min(rulePage.value, ruleTotalPages.value);
}

async function removeAlert(id: string, name: string): Promise<void> {
  if (!window.confirm(`删除提醒规则“${name}”？`)) return;
  await deleteJobAlertRule(id);
}

onMounted(() => {
  preferredAddress.value = window.localStorage.getItem('interview-os:preferred-address') ?? '';
  void refreshJobSyncStatus();
  statusTimer = window.setInterval(() => { void refreshJobSyncStatus(); }, 5000);
});
onBeforeUnmount(() => { if (statusTimer) window.clearInterval(statusTimer); });
</script>

<template>
  <section>
    <PageHeader eyebrow="JOB CENTER" title="岗位中心" description="统一接入、标准化、筛选和评估岗位，再进入定向简历、沟通准备、投递管理与面试训练。">
      <button class="button secondary" type="button" @click="refreshJobSyncStatus"><RefreshCw :size="15" />刷新状态</button>
    </PageHeader>

    <div class="sync-status-band job-intelligence-metrics">
      <div class="sync-connection" :class="{ online: store.jobSyncStatus?.running }"><Wifi :size="18" /><span><strong>{{ store.jobSyncStatus?.running ? '本机 Bridge 已运行' : 'Bridge 未运行' }}</strong><small>127.0.0.1:{{ store.jobSyncStatus?.port ?? 19426 }}</small></span></div>
      <div><span>岗位总数</span><strong>{{ nonTrashedJobs.length }}</strong></div>
      <div><span>今日新增</span><strong>{{ todayCount }}</strong></div>
      <div><span>高匹配</span><strong>{{ highMatchCount }}</strong></div>
      <div><span>风险待核验</span><strong>{{ riskyCount }}</strong></div>
      <div><span>待处理</span><strong>{{ newCount }}</strong></div>
    </div>

    <div class="job-workspace-tabs" role="tablist" aria-label="岗位工作台视图">
      <button :class="{ active: activeTab === 'pool' }" data-testid="job-sync-tab-pool" type="button" @click="activeTab = 'pool'"><Database :size="15" />职位池</button>
      <button :class="{ active: activeTab === 'sources' }" data-testid="job-sync-tab-sources" type="button" @click="activeTab = 'sources'"><PlugZap :size="15" />数据源</button>
      <button :class="{ active: activeTab === 'filters' }" data-testid="job-sync-tab-filters" type="button" @click="activeTab = 'filters'"><SlidersHorizontal :size="15" />筛选与提醒</button>
      <button :class="{ active: activeTab === 'logs' }" data-testid="job-sync-tab-logs" type="button" @click="activeTab = 'logs'"><Activity :size="15" />采集日志</button>
    </div>

    <template v-if="activeTab === 'pool'">
      <div class="career-toolbar sync-toolbar job-filter-toolbar">
        <label class="search-field"><Search :size="16" /><input v-model="search" aria-label="搜索同步岗位" placeholder="搜索岗位、公司、地点、技能或描述" /></label>
        <select v-model="activePresetId" class="input compact-select" aria-label="应用筛选规则"><option value="">不使用规则</option><option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.name }}</option></select>
        <select v-model="sourceFilter" class="input compact-select" aria-label="筛选招聘来源"><option value="all">全部来源</option><option v-for="source in sourceSites" :key="source" :value="source">{{ source }}</option></select>
        <select v-model="industryFilter" class="input compact-select" aria-label="筛选行业"><option value="all">全部行业</option><option v-for="(label, value) in industryLabels" :key="value" :value="value">{{ label }}</option></select>
        <select v-model="statusFilter" class="input compact-select" aria-label="筛选岗位状态" data-testid="job-status-filter" @change="resetBulkSelection"><option value="active">有效岗位</option><option value="all">全部非回收站</option><option value="ignored">已忽略</option><option value="trashed">回收站（{{ trashedCount }}）</option></select>
        <button class="button secondary compact" type="button" data-testid="job-bulk-toggle" @click="toggleBulkMode"><ListChecks :size="15" />{{ bulkMode ? '取消批量' : '批量管理' }}</button>
      </div>

      <div class="job-location-toolbar">
        <div class="location-address-editor">
          <label class="search-field location-address-field"><MapPin :size="16" /><input v-model="preferredAddress" aria-label="常用地址" placeholder="输入常用地址，例如：成都市武侯区天府三街" @change="savePreferredAddress" /></label>
          <button class="button secondary compact" type="button" @click="savePreferredAddress">保存地址</button>
        </div>
        <select v-model="locationSort" class="input compact-select" aria-label="岗位距离排序"><option value="default">默认排序</option><option value="nearest" :disabled="!preferredAddress">离我最近</option></select>
        <label class="location-nearest-only"><input v-model="nearestOnly" type="checkbox" :disabled="!preferredAddress" />只看同区/同城</label>
        <small>岗位未提供经纬度时，按远程、同区、同城、异地排序，不显示虚假公里数。</small>
      </div>

      <div v-if="bulkMode && filtered.length" class="job-bulk-toolbar" data-testid="job-bulk-toolbar">
        <label><input type="checkbox" data-testid="job-bulk-select-visible" :checked="allVisibleBulkSelected" @change="toggleAllVisibleBulkJobs" />选择当前结果</label>
        <span>已选择 {{ bulkSelection.size }} 个岗位</span>
        <template v-if="statusFilter === 'trashed'">
          <button class="button secondary compact" type="button" data-testid="job-bulk-restore" :disabled="!bulkSelection.size" @click="restoreSelectedJobs"><RotateCcw :size="15" />批量恢复</button>
          <button class="button danger compact" type="button" data-testid="job-bulk-delete-forever" :disabled="!bulkSelection.size" @click="deleteSelectedJobsForever"><Trash2 :size="15" />批量彻底删除</button>
        </template>
        <button v-else class="button danger compact" type="button" :disabled="!bulkSelection.size" @click="trashSelectedJobs"><Trash2 :size="15" />批量删除</button>
      </div>

      <div v-if="activePreset" class="active-filter-banner">
        <div>
          <span>职位池当前应用规则</span>
          <strong>{{ activePreset.name }}</strong>
          <small>当前结果 {{ filtered.length }} / 全部非回收站岗位 {{ nonTrashedJobs.length }}。规则管理不会自动改变这里，需手动应用。</small>
        </div>
        <div>
          <button class="button ghost compact" type="button" @click="activeTab = 'filters'; selectedPresetId = activePreset.id">管理规则</button>
          <button class="button secondary compact" type="button" @click="clearPoolPreset">清除规则</button>
        </div>
      </div>

      <section v-if="comparedJobs.length" class="job-compare-panel">
        <header><div><span class="eyebrow">COMPARE</span><h3>岗位对比 · {{ comparedJobs.length }}/4</h3></div><button class="icon-command" type="button" title="清空对比" @click="compareIds = new Set()"><X :size="15" /></button></header>
        <div class="job-compare-grid">
          <div class="compare-labels"><span>岗位</span><span>薪资</span><span>匹配</span><span>可信度</span><span>技能</span><span>风险</span></div>
          <article v-for="item in comparedJobs" :key="item.id"><strong>{{ item.title }}</strong><small>{{ item.company }}</small><span>{{ item.salaryRange || '未披露' }}</span><b>{{ item.matchScore }}</b><b>{{ item.trustScore }}</b><span>{{ item.skills.slice(0, 3).join('、') || '待提取' }}</span><span>{{ item.riskFlags.join('、') || '未发现明显风险' }}</span></article>
        </div>
      </section>

      <div v-if="filtered.length" class="synced-job-list" data-testid="synced-job-list">
        <template v-for="item in filtered" :key="item.id">
          <article class="synced-job-row intelligence-job-row" :class="{ expanded: selectedJobId === item.id, trashed: item.status === 'trashed' }">
            <label v-if="bulkMode" class="job-compare-check" :title="item.status === 'trashed' ? '选择用于批量恢复或彻底删除' : '选择用于批量删除'"><input type="checkbox" :checked="bulkSelection.has(item.id)" @change="toggleBulkSelection(item.id)" /></label>
            <label v-else class="job-compare-check" :title="compareIds.size >= 4 && !compareIds.has(item.id) ? '最多对比 4 个岗位' : '加入对比'"><input type="checkbox" :checked="compareIds.has(item.id)" :disabled="item.status === 'trashed' || (compareIds.size >= 4 && !compareIds.has(item.id))" @change="toggleCompare(item.id)" /></label>
            <div class="synced-job-source"><span>{{ item.sourceName }}</span><small>{{ displayDate(item.lastSeenAt) }}</small><b>{{ industryLabels[item.industry] }} · {{ item.employmentType }}</b></div>
            <div class="synced-job-main">
              <div><span class="status-badge" :class="item.status">{{ item.status === 'new' ? '新岗位' : item.status === 'saved' ? '已保存' : item.status === 'ignored' ? '已忽略' : '回收站' }}</span><h3>{{ item.title }}</h3></div>
              <p>{{ item.company || '未识别公司' }}<span v-if="item.location"> · {{ item.location }}</span><span v-if="item.salaryRange"> · {{ item.salaryRange }}</span><span v-if="item.remote"> · 远程</span><span v-if="preferredAddress" class="location-affinity" :class="{ near: locationAffinity(item) >= 70 }">{{ locationAffinityLabel(item) }}</span></p>
              <div class="job-skill-strip"><span v-for="skill in item.skills.slice(0, 5)" :key="skill">{{ skill }}</span><small v-if="!item.skills.length">技能待提取</small></div>
              <small>{{ item.matchReasons[0] || item.description.slice(0, 120) || '打开岗位详情后可补全岗位描述。' }}</small>
            </div>
            <div class="job-score-stack"><div :class="scoreClass(item.matchScore)"><span>匹配</span><strong>{{ item.matchScore }}</strong></div><div :class="scoreClass(item.trustScore)"><span>可信</span><strong>{{ item.trustScore }}</strong></div><small v-if="item.riskFlags.length">{{ item.riskFlags[0] }}</small></div>
            <div class="synced-job-actions">
              <a class="icon-command" :href="item.sourceUrl" target="_blank" rel="noreferrer" title="查看原职位"><ExternalLink :size="15" /></a>
              <button class="icon-command" type="button" :title="selectedJobId === item.id ? '收起岗位详情' : '查看岗位详情'" @click="selectedJobId = selectedJobId === item.id ? '' : item.id"><PanelRightOpen :size="16" /></button>
              <template v-if="item.status !== 'trashed'">
                <button class="icon-command" type="button" :title="item.status === 'saved' ? '取消目标岗位' : '设为目标岗位'" @click="toggleTargetJob(item)"><Star :size="16" :fill="item.status === 'saved' ? 'currentColor' : 'none'" /></button>
                <button class="icon-command" type="button" title="进入岗位分析" @click="openJobAnalysis(item)"><FileSearch :size="16" /></button>
                <button class="icon-command" type="button" title="加入求职管道" @click="addToPipeline(item)"><SquareKanban :size="16" /></button>
                <button class="icon-command" type="button" title="制作定向简历" @click="openResume(item)"><FileUser :size="16" /></button>
                <button class="icon-command" type="button" title="开始岗位面试训练" @click="openTraining(item)"><MicVocal :size="16" /></button>
                <button v-if="item.status !== 'ignored'" class="icon-command muted" type="button" title="忽略岗位" @click="updateSyncedJobStatus(item.id, 'ignored')"><EyeOff :size="16" /></button>
                <button v-else class="icon-command" type="button" title="恢复为新岗位" @click="restoreSyncedJob(item)"><RotateCcw :size="16" /></button>
                <button class="icon-command danger" type="button" title="移入回收站" @click="trashSyncedJob(item)"><Trash2 :size="16" /></button>
              </template>
              <template v-else>
                <button class="icon-command" type="button" title="从回收站恢复" @click="restoreSyncedJob(item)"><RotateCcw :size="16" /></button>
                <button class="icon-command danger" type="button" title="彻底删除" @click="deleteSyncedJobForever(item)"><Trash2 :size="16" /></button>
              </template>
            </div>
          </article>

          <section v-if="selectedJobId === item.id" class="job-detail-review inline-job-detail">
            <header><div><span class="eyebrow">JOB REVIEW</span><h2>{{ item.title }}</h2><p>{{ item.company || '未识别公司' }} · {{ item.location || '地点未识别' }} · {{ item.salaryRange || '薪资未披露' }}</p></div><button class="icon-command" type="button" title="关闭详情" @click="selectedJobId = ''"><X :size="16" /></button></header>
            <div class="job-detail-grid">
              <main><div class="job-detail-section"><h3>职位描述</h3><p>{{ item.description || '当前来源未提供完整岗位描述。' }}</p></div><div class="job-detail-section"><h3>标准化字段</h3><dl><div><dt>行业</dt><dd>{{ industryLabels[item.industry] }}</dd></div><div><dt>类型</dt><dd>{{ item.employmentType }}</dd></div><div><dt>学历</dt><dd>{{ item.education || '未识别' }}</dd></div><div><dt>经验</dt><dd>{{ item.experience || '未识别' }}</dd></div><div><dt>远程</dt><dd>{{ item.remote ? '支持' : '未标明' }}</dd></div><div><dt>状态</dt><dd>{{ item.lifecycleStatus }}</dd></div></dl></div><div class="job-detail-section"><h3>技能要求</h3><div class="job-skill-strip"><span v-for="skill in item.skills" :key="skill">{{ skill }}</span><small v-if="!item.skills.length">待补充完整岗位描述后提取</small></div></div></main>
              <aside><div class="detail-score-row"><span title="综合匹配：岗位方向、技能、经验、学历、地点、薪资和时效的加权分"><strong>{{ item.matchScore }}</strong><small>综合匹配</small></span><span title="可信度：公司、描述、地点、薪资、来源链接和风险词的完整性评分"><strong>{{ item.trustScore }}</strong><small>可信度</small></span><span title="数据质量：标题、公司、地点、薪资、岗位描述和发布时间的字段完整度"><strong>{{ item.qualityScore }}</strong><small>数据质量</small></span></div><div class="dimension-bars"><div v-for="(value, key) in item.matchDimensions" :key="key"><span>{{ dimensionLabels[key] }}</span><i><b :style="{ width: `${value}%` }"></b></i><strong>{{ value }}</strong></div></div><div class="detail-reasons"><strong>推荐依据</strong><span v-for="reason in item.matchReasons" :key="reason">{{ reason }}</span></div><div class="audit-flags"><button v-for="flag in item.riskFlags" :key="flag" type="button" class="risk" title="点击筛选相同风险岗位" @click="focusRiskFlag(flag)">{{ flag }}</button><button v-for="flag in item.biasFlags" :key="flag" type="button" class="bias" title="点击筛选相同风险岗位" @click="focusRiskFlag(flag)">{{ flag }}</button></div><div v-if="item.status !== 'trashed'" class="job-detail-actions"><button class="button secondary" type="button" @click="openJobAnalysis(item)"><FileSearch :size="15" />岗位分析</button><button class="button secondary" type="button" @click="openResume(item)"><FileUser :size="15" />定向简历</button><button class="button primary" type="button" @click="openTraining(item)"><MicVocal :size="15" />面试准备</button></div><div v-else class="job-detail-actions"><button class="button secondary" type="button" @click="restoreSyncedJob(item)"><RotateCcw :size="15" />恢复岗位</button><button class="button danger" type="button" @click="deleteSyncedJobForever(item)"><Trash2 :size="15" />彻底删除</button></div></aside>
            </div>
          </section>
        </template>
      </div>
      <div v-else class="empty-state career-empty"><div class="empty-icon"><Radar :size="22" /></div><h3>{{ jobs.length ? '没有符合当前规则的岗位' : '等待岗位数据进入职位池' }}</h3><p>{{ jobs.length ? '调整搜索条件、可信度、状态或筛选规则后重试。' : '可先配置数据源框架，真实同步连接器后续逐个启用。' }}</p></div>
    </template>

    <template v-else-if="activeTab === 'sources'">
      <section class="panel sync-setup">
        <div><span class="eyebrow">LOCAL CONNECTOR</span><h3>浏览器岗位同步</h3><p>Chrome 扩展支持“当前页同步”和“列表岗位 + 后台详情补全”：先识别列表页岗位链接，再逐个打开详情页读取完整岗位描述，经本机 Bridge 增量去重后写入职位池。</p><div class="extension-path"><input class="copyable-field" data-testid="job-sync-extension-path" readonly :value="store.meta?.extensionDirectory || 'browser-extension'" @focus="($event.target as HTMLInputElement).select()" /><button class="icon-command" data-testid="job-sync-copy-extension-path" type="button" title="复制扩展目录" aria-label="复制扩展目录" @click="copyExtensionPath"><Copy :size="15" /></button></div><small>{{ pathMessage || '可使用浏览器当前登录态；不读取密码、不导出 Cookie，也不在后台绕过验证码。' }}</small></div>
        <div class="sync-token"><label for="job-sync-token">同步令牌</label><div><input id="job-sync-token" class="copyable-field" data-testid="job-sync-token" readonly :value="store.workspace?.settings.jobSyncToken" @focus="($event.target as HTMLInputElement).select()" /><button class="icon-command" data-testid="job-sync-copy-token" type="button" title="复制同步令牌" aria-label="复制同步令牌" @click="copyToken"><Copy :size="15" /></button></div><small>{{ tokenMessage || `最近接收：${displayDate(store.jobSyncStatus?.lastBatchAt)}` }}</small></div>
      </section>

      <div class="connector-verification-legend"><strong>验证口径</strong><span><i class="real"></i>真实连通：实际访问健康检查或端点</span><span><i class="config"></i>配置检查：未抓取岗位</span><span><i class="planned"></i>待接入：没有可运行适配器</span></div>
      <div class="source-registry">
        <article v-for="source in sources" :key="source.id" class="source-row">
          <div class="source-state"><span class="connector-icon"><PlugZap :size="17" /></span><span><strong>{{ source.name }}</strong><small>{{ connectorLabels[source.connectorType] }} · {{ source.platform }}</small></span></div>
          <div class="source-capabilities"><span v-for="capability in source.capabilities" :key="capability">{{ capabilityLabels[capability] }}</span></div>
          <div class="source-endpoint"><code>{{ source.endpoint || '待配置端点 / 适配器' }}</code><small>{{ source.notes }}</small><small v-if="lastRunFor(source.id)" class="last-verification">最近验证：{{ lastRunFor(source.id)?.message }}</small></div>
          <span class="source-status" :class="source.status">{{ sourceStatusLabels[source.status] }}</span>
          <label class="switch compact-switch" :title="source.status === 'planned' ? '尚未接入，不能启用' : source.enabled ? '停用数据源' : '启用数据源'"><input type="checkbox" :checked="source.enabled" :disabled="source.status === 'planned'" @change="toggleSource(source)" /><span></span></label>
          <button class="button ghost compact" type="button" :disabled="source.status === 'planned'" @click="validateJobSource(source.id)"><Play :size="14" />{{ connectorActionLabel(source) }}</button>
        </article>
      </div>
    </template>

    <template v-else-if="activeTab === 'filters'">
      <div class="filter-builder-layout">
        <form class="panel filter-builder" @submit.prevent="savePreset">
          <div class="panel-heading">
            <div><span class="eyebrow">FILTER SPEC</span><h3>{{ editingPresetId ? '编辑岗位筛选规则' : '新建岗位筛选规则' }}</h3></div>
            <button class="button ghost compact" type="button" @click="startNewPreset"><Filter :size="14" />新建规则</button>
          </div>
          <p v-if="selectedPreset && !editingPresetId" class="form-helper">当前查看：{{ selectedPreset.name }}。点“编辑”才会加载到表单，点“应用到职位池”才会影响职位池列表。</p>
          <label>规则名称<input v-model="filterDraft.name" class="input" required /></label>
          <div class="form-grid two"><label>包含关键词<input v-model="filterDraft.includeKeywords" class="input" placeholder="Kubernetes, SRE, 云原生" /></label><label>排除关键词<input v-model="filterDraft.excludeKeywords" class="input" placeholder="外包, 兼职, 销售" /></label></div>
          <label>目标城市<input v-model="filterDraft.cities" class="input" placeholder="杭州, 上海, 远程；留空表示不限" /></label>
          <div class="filter-check-group"><span>目标行业</span><label v-for="[value, label] in industryOptions" :key="value"><input v-model="filterDraft.industries" type="checkbox" :value="value" />{{ label }}</label></div>
          <div class="filter-check-group"><span>数据来源</span><label v-for="source in sourceOptions" :key="source"><input v-model="filterDraft.sources" type="checkbox" :value="source" />{{ source }}</label></div>
          <div class="form-grid three"><label>最低月薪 K<input v-model.number="filterDraft.minSalaryK" class="input" type="number" min="0" /></label><label>最低匹配度<input v-model.number="filterDraft.minMatchScore" class="input" type="number" min="0" max="100" /></label><label>最低可信度<input v-model.number="filterDraft.minTrustScore" class="input" type="number" min="0" max="100" /></label></div>
          <div class="form-grid two"><label>岗位新鲜度（天）<input v-model.number="filterDraft.freshWithinDays" class="input" type="number" min="0" max="365" /></label><label class="binary-field"><input v-model="filterDraft.remoteOnly" type="checkbox" />只保留远程岗位</label></div>
          <div class="form-actions"><span></span><button class="button primary" type="submit"><ListChecks :size="15" />{{ editingPresetId ? '保存规则' : '保存为新规则' }}</button></div>
        </form>

        <section class="filter-rule-list">
          <header><div><span class="eyebrow">SAVED SPECS</span><h3>已保存规则</h3></div><strong>{{ presets.length }}</strong></header>
          <article v-for="preset in pagedPresets" :key="preset.id" :class="{ selected: selectedPresetId === preset.id, applied: activePresetId === preset.id }">
            <button class="rule-card-button" type="button" @click="selectPresetForManagement(preset)">
              <span>
                <strong>{{ preset.name }}</strong>
                <small>{{ presetSummary(preset) }}</small>
                <i><em v-if="selectedPresetId === preset.id">当前查看</em><em v-if="activePresetId === preset.id">职位池已应用</em></i>
              </span>
              <b>{{ presetHitCount(preset) }}</b>
            </button>
            <div class="rule-actions">
              <button class="button ghost compact" type="button" @click="loadPresetToDraft(preset)">编辑</button>
              <button class="button secondary compact" type="button" @click="applyPresetToPool(preset.id)">应用到职位池</button>
              <button class="button danger compact" type="button" @click="removePreset(preset)">删除</button>
            </div>
          </article>
          <div v-if="presets.length > pageSize" class="pager">
            <button class="button ghost compact" type="button" :disabled="rulePage <= 1" @click="rulePage -= 1">上一页</button>
            <span>{{ rulePage }} / {{ ruleTotalPages }}</span>
            <button class="button ghost compact" type="button" :disabled="rulePage >= ruleTotalPages" @click="rulePage += 1">下一页</button>
          </div>
          <p v-if="!presets.length">还没有规则。先保存一条规则，再点“应用到职位池”过滤职位池。</p>
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

      <div v-if="alerts.length" class="alert-rule-strip">
        <span v-for="alert in alerts" :key="alert.id">
          <Bell :size="13" />{{ alert.name }} · {{ alert.channel === 'in-app' ? '应用内' : `${alert.channel} 框架` }} · {{ alert.enabled ? '已启用' : '已停用' }}
          <button class="inline-danger" type="button" @click="removeAlert(alert.id, alert.name)">删除</button>
        </span>
      </div>
    </template>

    <template v-else>
      <div class="sync-log-table">
        <header><span>执行时间</span><span>数据源</span><span>状态</span><span>抓取</span><span>新增</span><span>更新</span><span>说明</span></header>
        <div v-for="run in pagedRuns" :key="run.id"><span>{{ displayDate(run.createdAt) }}</span><strong>{{ run.sourceName }}</strong><span class="run-status" :class="run.status"><CheckCircle2 v-if="run.status !== 'failed'" :size="14" /><ShieldCheck v-else :size="14" />{{ run.status === 'dry-run' ? '配置检查' : run.status === 'success' ? '真实连通' : run.status === 'warning' ? '未接入/部分可达' : '失败' }}</span><span>{{ run.fetched }}</span><span>{{ run.added }}</span><span>{{ run.updated }}</span><small>{{ run.message }}</small></div>
      </div>
      <div v-if="runs.length > pageSize" class="pager">
        <button class="button ghost compact" type="button" :disabled="logPage <= 1" @click="logPage -= 1">上一页</button>
        <span>{{ logPage }} / {{ logTotalPages }}</span>
        <button class="button ghost compact" type="button" :disabled="logPage >= logTotalPages" @click="logPage += 1">下一页</button>
      </div>
      <div v-if="!runs.length" class="empty-state career-empty"><div class="empty-icon"><TableProperties :size="22" /></div><h3>暂无采集日志</h3><p>在数据源页执行真实连通测试或导入配置检查，或者由浏览器扩展同步一批岗位后，这里会记录结果。</p></div>
    </template>
  </section>
</template>
