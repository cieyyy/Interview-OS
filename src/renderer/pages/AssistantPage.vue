<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';
const { store } = useWorkspace();
</script>

<template>
  <section>
    <PageHeader eyebrow="AI COACH" title="AI 助手" description="从真实档案、项目经历和目标 JD 进入专属面试训练。" />
    <div class="assistant-entry">
      <article class="assistant-card featured assistant-entry-card"><span class="chip accent">推荐流程</span><h2>开始 1V1 面试训练</h2><p>目前已有 {{ store.workspace?.projects.length ?? 0 }} 个项目、{{ store.workspace?.knowledge.length ?? 0 }} 条知识和 {{ store.workspace?.jobs.length ?? 0 }} 份 JD。训练支持中英文、语音作答、AI 陪练、推荐回答和历史回看。</p><RouterLink class="button primary" data-testid="assistant-enter-training" to="/training">进入训练</RouterLink></article>
    </div>
  </section>
</template>
