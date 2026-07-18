<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';
const { store } = useWorkspace();
</script>

<template>
  <section>
    <PageHeader eyebrow="OPTIONAL AI" title="AI 助手" description="核心功能离线可用；连接模型后，再进行总结、追问和回答优化。" />
    <div class="assistant-grid">
      <article class="assistant-card featured"><span class="chip accent">推荐流程</span><h2>先建立真实上下文</h2><p>目前已有 {{ store.workspace?.projects.length ?? 0 }} 个项目、{{ store.workspace?.knowledge.length ?? 0 }} 条知识和 {{ store.workspace?.jobs.length ?? 0 }} 份 JD。AI 只会在你选择的范围内工作。</p><RouterLink class="button primary" to="/training">进入训练</RouterLink></article>
      <article class="assistant-card"><span class="assistant-icon">◎</span><h3>OpenAI 兼容接口</h3><p>支持配置自有 Base URL、模型和 Key。密钥由 Windows 安全存储保护。</p><RouterLink to="/settings">配置连接器 →</RouterLink></article>
      <article class="assistant-card"><span class="assistant-icon">◇</span><h3>远程 Dify</h3><p>本机无需 Docker。将来部署到云服务器后，只需填写远程 API 地址。</p><RouterLink to="/settings">配置连接器 →</RouterLink></article>
      <article class="assistant-card"><span class="assistant-icon">□</span><h3>离线模式</h3><p>JD 分析、问题生成、基础评分、知识编辑、导出和备份均可离线调试。</p><span class="text-link">当前已可用</span></article>
    </div>
  </section>
</template>

