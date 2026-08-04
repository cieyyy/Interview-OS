<script setup lang="ts">
import { computed, ref } from 'vue';
import { BookOpenCheck, BrainCircuit, CircleAlert, GitBranch, GraduationCap, Sparkles, Target } from '@lucide/vue';
import { buildSkillGraph } from '../../shared/career-agent-engine';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store } = useWorkspace();
const selectedJobId = ref('');
const selectedJob = computed(() => store.workspace?.syncedJobs.find((item) => item.id === selectedJobId.value));
const nodes = computed(() => store.workspace ? buildSkillGraph(store.workspace, selectedJobId.value || undefined) : []);
const verified = computed(() => nodes.value.filter((item) => item.category === 'verified'));
const related = computed(() => nodes.value.filter((item) => item.category === 'related'));
const gaps = computed(() => nodes.value.filter((item) => item.category === 'gap'));
const readiness = computed(() => nodes.value.length ? Math.round(nodes.value.reduce((sum, item) => sum + item.readiness, 0) / nodes.value.length) : 0);
const roadmap = computed(() => gaps.value.slice(0, 6).map((item, index) => ({
  skill: item.name,
  phase: index < 2 ? '本周' : index < 4 ? '两周内' : '面试前',
  action: index < 2 ? '完成一个可验证练习并记录结果' : index < 4 ? '补充项目案例或知识卡片' : '准备岗位场景题和追问证据'
})));
</script>

<template>
  <section>
    <PageHeader eyebrow="CAPABILITY GROWTH" title="能力成长" description="将职业档案、项目证据和岗位技能要求放到同一张能力地图中，区分已验证能力、相关经验和真实缺口。" />

    <div class="skill-graph-toolbar"><label><Target :size="16" /><select v-model="selectedJobId" class="input"><option value="">综合职位池需求</option><option v-for="job in store.workspace?.syncedJobs" :key="job.id" :value="job.id">{{ job.company }} · {{ job.title }}</option></select></label><div><span>综合准备度</span><strong>{{ readiness }}</strong></div><div><span>已验证</span><strong>{{ verified.length }}</strong></div><div><span>待补能力</span><strong>{{ gaps.length }}</strong></div></div>

    <div class="skill-graph-layout">
      <main class="capability-map">
        <header><div><span class="eyebrow">EVIDENCE MAP</span><h3>{{ selectedJob ? selectedJob.title : '全局能力供需图' }}</h3></div><GitBranch :size="19" /></header>
        <div class="capability-clusters">
          <section class="verified"><header><BookOpenCheck :size="16" /><span><strong>已验证能力</strong><small>档案中存在技能且项目提供证据</small></span></header><div><article v-for="item in verified" :key="item.name"><span><strong>{{ item.name }}</strong><small>{{ item.evidence.join('、') }}</small></span><b :title="item.demandCount ? `${item.demandCount} 个岗位提及` : '当前职位池暂无需求数据'">{{ item.demandCount || '—' }}</b></article><p v-if="!verified.length">在项目经历中补充技术栈后显示。</p></div></section>
          <section class="related"><header><BrainCircuit :size="16" /><span><strong>相关经验</strong><small>具备基础，但证据仍需加强</small></span></header><div><article v-for="item in related" :key="item.name"><span><strong>{{ item.name }}</strong><small>{{ item.evidence.join('、') || '职业档案已记录' }}</small></span><b :title="item.demandCount ? `${item.demandCount} 个岗位提及` : '当前职位池暂无需求数据'">{{ item.demandCount || '—' }}</b></article><p v-if="!related.length">暂无相关能力。</p></div></section>
          <section class="gap"><header><CircleAlert :size="16" /><span><strong>岗位缺口</strong><small>职位池存在需求，档案暂无证据</small></span></header><div><article v-for="item in gaps" :key="item.name"><span><strong>{{ item.name }}</strong><small>{{ item.demandCount }} 个岗位提及</small></span><b>{{ item.readiness }}</b></article><p v-if="!gaps.length">当前没有明显技能缺口。</p></div></section>
        </div>
      </main>

    </div>

    <section class="learning-roadmap"><header><div><span class="eyebrow">ROADMAP</span><h3>能力补强路线</h3></div><GraduationCap :size="19" /></header><div><article v-for="(item, index) in roadmap" :key="item.skill"><span>{{ index + 1 }}</span><div><strong>{{ item.skill }}</strong><small>{{ item.action }}</small></div><b>{{ item.phase }}</b></article><p v-if="!roadmap.length"><Sparkles :size="16" />当前岗位需求已被现有能力覆盖，下一步重点是整理可验证项目证据。</p></div></section>
  </section>
</template>
