<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  BookOpenText,
  Bot,
  BrainCircuit,
  Building2,
  ChartNoAxesCombined,
  Database,
  CalendarDays,
  FileSearch,
  FileUser,
  GitBranch,
  House,
  MicVocal,
  Radar,
  Settings,
  ShieldCheck,
  SquareKanban,
  UserRound,
  X
} from '@lucide/vue';
import { useWorkspace } from './composables/useWorkspace';

const route = useRoute();
const { store, clearMessages } = useWorkspace();
const navItems = [
  { to: '/', label: '工作台', icon: House },
  { to: '/career-agent', label: '求职 Agent', icon: BrainCircuit },
  { to: '/knowledge', label: '知识库', icon: BookOpenText },
  { to: '/profile', label: '职业档案', icon: UserRound },
  { to: '/jobs', label: 'JD 中心', icon: FileSearch },
  { to: '/job-sync', label: '岗位同步', icon: Radar },
  { to: '/job-insights', label: '岗位洞察', icon: ChartNoAxesCombined },
  { to: '/companies', label: '公司关注', icon: Building2 },
  { to: '/applications', label: '求职管道', icon: SquareKanban },
  { to: '/resumes', label: '简历工坊', icon: FileUser },
  { to: '/skill-graph', label: '能力图谱', icon: GitBranch },
  { to: '/data-center', label: '数据中心', icon: Database },
  { to: '/calendar', label: '求职日程', icon: CalendarDays },
  { to: '/training', label: '面试训练', icon: MicVocal },
  { to: '/reports', label: '训练报告', icon: ChartNoAxesCombined },
  { to: '/assistant', label: 'AI 助手', icon: Bot },
  { to: '/settings', label: '设置', icon: Settings }
];
const active = computed(() => route.path);
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">跳到主内容</a>
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">IO</div>
        <div><strong>Interview OS</strong><span>个人面试知识系统</span></div>
      </div>
      <nav class="nav-list" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: active === item.to }"
          :data-testid="`nav-${item.to === '/' ? 'dashboard' : item.to.slice(1)}`"
        >
          <component :is="item.icon" class="nav-icon" :size="17" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <ShieldCheck class="sidebar-status-icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
        <div><strong>本地优先</strong><small>核心功能无需 Docker</small></div>
      </div>
    </aside>

    <main class="main-shell">
      <div class="topbar">
        <div class="workspace-pill"><Database :size="15" :stroke-width="1.8" aria-hidden="true" />{{ store.workspace?.settings.workspaceName ?? '加载工作区…' }}</div>
        <div class="topbar-meta" title="档案、项目和训练记录默认保存在本机；只有你主动使用图片识别或 AI 陪练时，相关内容才会发送给已配置的模型服务。"><ShieldCheck :size="14" :stroke-width="1.8" aria-hidden="true" />本地优先 · 仅主动使用 AI 时发送所选内容</div>
      </div>
      <div id="main-content" class="content-area" tabindex="-1">
        <RouterView />
      </div>
    </main>

    <button v-if="store.error" class="toast error" type="button" role="alert" aria-label="关闭错误消息" @click="clearMessages">
      <span class="toast-copy"><strong>操作失败</strong><span>{{ store.error }}</span></span><X :size="16" aria-hidden="true" />
    </button>
    <button v-if="store.notice" class="toast success" type="button" role="status" aria-label="关闭完成消息" @click="clearMessages">
      <span class="toast-copy"><strong>已完成</strong><span>{{ store.notice }}</span></span><X :size="16" aria-hidden="true" />
    </button>
    <div v-if="store.loading" class="loading-bar" role="progressbar" aria-label="正在处理"></div>
  </div>
</template>
