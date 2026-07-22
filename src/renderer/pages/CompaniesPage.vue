<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Building2, CalendarClock, ExternalLink, Globe2, Pause, Play, Plus, Radar, RefreshCw, Search } from '@lucide/vue';
import type { CompanyPriority, CompanyWatch, CompanyWatchInput } from '../../shared/domain';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, saveCompanyWatch, validateCompanyWatch } = useWorkspace();
const search = ref('');
const showForm = ref(false);
const form = reactive<CompanyWatchInput>({ name: '', industry: '', careerUrl: '', priority: 'normal', status: 'watching', recruitmentType: '校招/社招', tags: [], notes: '', nextRecruitmentAt: '' });
const tagsText = ref('');

const siteDirectory = [
  { name: '腾讯', industry: '互联网', url: 'https://careers.tencent.com/' },
  { name: '阿里巴巴', industry: '互联网', url: 'https://talent.alibaba.com/' },
  { name: '字节跳动', industry: '互联网', url: 'https://jobs.bytedance.com/' },
  { name: '美团', industry: '互联网', url: 'https://zhaopin.meituan.com/' },
  { name: '百度', industry: '人工智能', url: 'https://talent.baidu.com/' },
  { name: '华为', industry: '通信硬件', url: 'https://career.huawei.com/' },
  { name: '小米', industry: '智能硬件', url: 'https://hr.xiaomi.com/' },
  { name: '网易', industry: '互联网/游戏', url: 'https://hr.163.com/' },
  { name: '京东', industry: '电商物流', url: 'https://zhaopin.jd.com/' },
  { name: '国家电网', industry: '能源电力', url: 'https://zhaopin.sgcc.com.cn/' },
  { name: '中国移动', industry: '电信运营', url: 'https://job.10086.cn/' },
  { name: '国聘网', industry: '国央企聚合', url: 'https://www.iguopin.com/' }
];

const companies = computed(() => store.workspace?.companyWatches ?? []);
const filteredCompanies = computed(() => {
  const value = search.value.trim().toLocaleLowerCase();
  return companies.value.filter((item) => !value || `${item.name} ${item.industry} ${item.tags.join(' ')}`.toLocaleLowerCase().includes(value));
});
const focusedCount = computed(() => companies.value.filter((item) => item.priority === 'focus').length);
const newJobs = computed(() => companies.value.reduce((sum, item) => sum + item.newJobs, 0));
const changedJobs = computed(() => companies.value.reduce((sum, item) => sum + item.changedJobs, 0));
const upcoming = computed(() => [...companies.value].filter((item) => item.nextRecruitmentAt).sort((a, b) => new Date(a.nextRecruitmentAt!).getTime() - new Date(b.nextRecruitmentAt!).getTime()));
const priorityLabels: Record<CompanyPriority, string> = { focus: '重点', normal: '常规', backup: '备选' };

function editCompany(item?: CompanyWatch): void {
  Object.assign(form, item ? { ...item } : { id: undefined, name: '', industry: '', careerUrl: '', priority: 'normal', status: 'watching', recruitmentType: '校招/社招', tags: [], notes: '', nextRecruitmentAt: '' });
  tagsText.value = item?.tags.join(', ') ?? '';
  showForm.value = true;
}

async function submit(): Promise<void> {
  const saved = await saveCompanyWatch({ ...form, tags: tagsText.value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean) });
  if (saved) showForm.value = false;
}

async function addDirectorySite(site: { name: string; industry: string; url: string }): Promise<void> {
  await saveCompanyWatch({ name: site.name, industry: site.industry, careerUrl: site.url, priority: 'normal', status: 'watching', recruitmentType: '校招/社招', tags: ['招聘官网'] });
}

async function toggleCompany(item: CompanyWatch): Promise<void> {
  await saveCompanyWatch({ ...item, status: item.status === 'watching' ? 'paused' : 'watching' });
}

function displayDate(value?: string): string {
  return value ? new Date(value).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未设置';
}
</script>

<template>
  <section>
    <PageHeader eyebrow="COMPANY RADAR" title="公司关注" description="集中管理目标公司招聘官网、校招时间线和岗位新增/变更状态，形成长期关注清单。">
      <button class="button primary" data-testid="company-add" type="button" @click="editCompany()"><Plus :size="15" />关注公司</button>
    </PageHeader>

    <div class="career-metrics company-metrics"><div><span>关注公司</span><strong>{{ companies.length }}</strong></div><div><span>重点目标</span><strong>{{ focusedCount }}</strong></div><div><span>新增岗位</span><strong>{{ newJobs }}</strong></div><div><span>发生变更</span><strong>{{ changedJobs }}</strong></div></div>

    <form v-if="showForm" class="panel company-form" data-testid="company-form" @submit.prevent="submit">
      <div class="panel-heading"><div><span class="eyebrow">WATCH TARGET</span><h3>{{ form.id ? '编辑关注公司' : '新增关注公司' }}</h3></div></div>
      <div class="form-grid three"><label>公司名称<input v-model="form.name" class="input" required /></label><label>行业<input v-model="form.industry" class="input" placeholder="互联网 / 能源电力 / 医疗……" /></label><label>招聘类型<input v-model="form.recruitmentType" class="input" /></label></div>
      <label>招聘官网<input v-model="form.careerUrl" class="input" type="url" placeholder="https://" /></label>
      <div class="form-grid three"><label>优先级<select v-model="form.priority" class="input"><option value="focus">重点</option><option value="normal">常规</option><option value="backup">备选</option></select></label><label>状态<select v-model="form.status" class="input"><option value="watching">关注中</option><option value="paused">已暂停</option></select></label><label>预计招聘时间<input v-model="form.nextRecruitmentAt" class="input" type="datetime-local" /></label></div>
      <label>标签<input v-model="tagsText" class="input" placeholder="国央企, 云计算, 校招" /></label><label>备注<textarea v-model="form.notes" class="input compact-textarea"></textarea></label>
      <div class="form-actions"><button class="button ghost" type="button" @click="showForm = false">取消</button><span></span><button class="button primary" type="submit">保存公司</button></div>
    </form>

    <div class="company-layout">
      <main>
        <label class="search-field company-search"><Search :size="16" /><input v-model="search" placeholder="搜索公司、行业或标签" /></label>
        <div class="company-watch-list">
          <article v-for="item in filteredCompanies" :key="item.id" class="company-watch-row">
            <button class="company-main" type="button" @click="editCompany(item)"><span class="company-logo"><Building2 :size="19" /></span><span><strong>{{ item.name }}</strong><small>{{ item.industry || '行业未填写' }} · {{ item.recruitmentType || '招聘类型未填写' }}</small></span></button>
            <span class="company-priority" :class="item.priority">{{ priorityLabels[item.priority] }}</span>
            <div class="company-job-counts"><span><strong>{{ item.openJobs }}</strong><small>在招</small></span><span><strong>{{ item.newJobs }}</strong><small>新增</small></span><span><strong>{{ item.changedJobs }}</strong><small>变更</small></span></div>
            <div class="company-last-check"><small>最近检查</small><strong>{{ displayDate(item.lastCheckedAt) }}</strong></div>
            <div class="company-actions"><a v-if="item.careerUrl" class="icon-command" :href="item.careerUrl" target="_blank" rel="noreferrer" title="打开招聘官网"><ExternalLink :size="15" /></a><button class="icon-command" type="button" title="验证监控框架" @click="validateCompanyWatch(item.id)"><RefreshCw :size="15" /></button><button class="icon-command" type="button" :title="item.status === 'watching' ? '暂停关注' : '恢复关注'" @click="toggleCompany(item)"><Pause v-if="item.status === 'watching'" :size="15" /><Play v-else :size="15" /></button></div>
          </article>
          <div v-if="!filteredCompanies.length" class="empty-state"><Radar :size="24" /><h3>还没有关注公司</h3><p>从右侧招聘官网目录加入，或手动建立一个目标公司。</p></div>
        </div>
      </main>

      <aside class="company-side">
        <section class="recruitment-calendar"><header><CalendarClock :size="17" /><div><span class="eyebrow">TIMELINE</span><h3>招聘时间线</h3></div></header><button v-for="item in upcoming.slice(0, 6)" :key="item.id" type="button" @click="editCompany(item)"><span>{{ displayDate(item.nextRecruitmentAt) }}</span><strong>{{ item.name }}</strong><small>{{ item.recruitmentType }}</small></button><p v-if="!upcoming.length">为关注公司设置校招或社招时间。</p></section>
        <section class="site-directory"><header><Globe2 :size="17" /><div><span class="eyebrow">SITE HUB</span><h3>招聘官网目录</h3></div></header><div><article v-for="site in siteDirectory" :key="site.name"><span><strong>{{ site.name }}</strong><small>{{ site.industry }}</small></span><a :href="site.url" target="_blank" rel="noreferrer" title="打开官网"><ExternalLink :size="14" /></a><button type="button" title="加入关注" @click="addDirectorySite(site)"><Plus :size="14" /></button></article></div></section>
      </aside>
    </div>
  </section>
</template>
