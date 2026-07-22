<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, BookOpenText, Boxes, MessageSquareText, PencilLine, Plus } from '@lucide/vue';
import { buildProjectKnowledgeInputs } from '../../shared/project-knowledge';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';
import { useWorkspace } from '../composables/useWorkspace';

const router = useRouter();
const { store, saveKnowledge } = useWorkspace();
const projects = computed(() => store.workspace?.projects ?? []);
const relatedKnowledgeCount = (id: string): number => store.workspace?.knowledge.filter((item) => item.projectIds.includes(id) || item.relatedIds.includes(id)).length ?? 0;

async function generateKnowledge(project: (typeof projects.value)[number]): Promise<void> {
  for (const input of buildProjectKnowledgeInputs(project)) await saveKnowledge(input);
}
</script>

<template>
  <section>
    <PageHeader eyebrow="PROJECT ASSETS" title="项目资产库" description="把真实项目整理为项目介绍、技术栈、故障案例、面试问题和学习知识，并在简历与教练训练中复用。">
      <button class="button primary" type="button" @click="router.push('/profile?tab=projects')"><Plus :size="16" />新增项目</button>
    </PageHeader>
    <EmptyState v-if="!projects.length" title="还没有项目资产" description="从简历导入或手动创建项目，系统不会编造缺失经历。"><button class="button primary" type="button" @click="router.push('/profile?tab=projects')">创建项目</button></EmptyState>
    <div v-else class="project-asset-grid">
      <article v-for="project in projects" :key="project.id" class="panel project-asset-card">
        <header><span><Boxes :size="18" /></span><div><h2>{{ project.name }}</h2><p>{{ project.role || '角色待补充' }}</p></div></header>
        <p>{{ project.background || project.objective || '项目背景待补充' }}</p>
        <div class="tag-row"><span v-for="skill in project.techStack.slice(0, 6)" :key="skill">{{ skill }}</span></div>
        <dl><div><dt>知识</dt><dd><BookOpenText :size="15" />{{ relatedKnowledgeCount(project.id) }}</dd></div><div><dt>30 秒表达</dt><dd>{{ project.pitch30 ? '已准备' : '待整理' }}</dd></div><div><dt>训练校准</dt><dd>{{ project.interviewRevisionNotes ? '已沉淀' : '待训练' }}</dd></div></dl>
        <footer><button class="button ghost" type="button" @click="router.push('/profile?tab=projects')"><PencilLine :size="15" />编辑项目</button><button class="button secondary" type="button" @click="generateKnowledge(project)"><BookOpenText :size="15" />{{ relatedKnowledgeCount(project.id) ? '更新知识资产' : '生成知识资产' }}</button><button class="button primary" type="button" @click="router.push({ path: '/coach', query: { mode: 'project-deep-dive', projectId: project.id } })"><MessageSquareText :size="15" />项目深挖<ArrowRight :size="14" /></button></footer>
      </article>
    </div>
  </section>
</template>
