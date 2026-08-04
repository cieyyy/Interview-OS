<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  BrainCircuit,
  Building2,
  Database,
  FileSearch,
  FileUser,
  GitBranch,
  House,
  Radar,
  Settings,
  SquareKanban,
  UserRound,
  BriefcaseBusiness,
  X
} from '@lucide/vue';
import { useWorkspace } from './composables/useWorkspace';
import { useUiPreferences } from './composables/useUiPreferences';
import { resolvePrimaryNavigation } from './navigation';

const route = useRoute();
const { store, clearMessages } = useWorkspace();
const { preferences } = useUiPreferences();
const navItems = computed(() => {
  const english = preferences.language === 'en-US';
  return [
    { to: '/', label: english ? 'Workspace' : '工作台', icon: House },
    { to: '/career-agent', label: english ? 'Job Agent' : '求职 Agent', icon: BriefcaseBusiness },
    { to: '/profile', label: english ? 'Career Profile' : '职业档案', icon: UserRound },
    { to: '/job-sync', label: english ? 'Job Center' : '岗位中心', icon: Radar },
    { to: '/jobs', label: english ? 'Job Analysis' : '岗位分析', icon: FileSearch },
    { to: '/skill-graph', label: english ? 'Capability Growth' : '能力成长', icon: GitBranch },
    { to: '/resumes', label: english ? 'Resume Studio' : '简历工坊', icon: FileUser },
    { to: '/coach', label: english ? 'AI Career Coach' : 'AI 职业教练', icon: BrainCircuit },
    { to: '/applications', label: english ? 'Applications' : '求职管道', icon: SquareKanban },
    { to: '/companies', label: english ? 'Companies' : '公司关注', icon: Building2 },
    { to: '/settings', label: english ? 'Settings' : '设置', icon: Settings }
  ];
});
const active = computed(() => resolvePrimaryNavigation(route.path, route.query));
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">跳到主内容</a>
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">IO</div>
        <div><strong>Interview OS</strong><span>{{ preferences.language === 'en-US' ? 'Personal career operating system' : '个人职业 AI 操作系统' }}</span></div>
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
    </aside>

    <main class="main-shell">
      <div class="topbar">
        <div class="workspace-pill"><Database :size="15" :stroke-width="1.8" aria-hidden="true" />{{ store.workspace?.settings.workspaceName ?? (preferences.language === 'en-US' ? 'Loading workspace…' : '加载工作区…') }}</div>
      </div>
      <div id="main-content" class="content-area" tabindex="-1">
        <RouterView />
      </div>
    </main>

    <button v-if="store.error" class="toast error" type="button" role="alert" aria-label="关闭错误消息" @click="clearMessages">
      <span class="toast-copy"><strong>操作失败</strong><span>{{ store.error }}</span></span><X :size="16" aria-hidden="true" />
    </button>
    <button v-if="store.notice" class="toast" :class="store.noticeTone" type="button" role="status" aria-label="关闭完成消息" @click="clearMessages">
      <span class="toast-copy"><strong>{{ store.noticeTone === 'success' ? '已完成' : store.noticeTone === 'warning' ? '验证失败' : '检查结果' }}</strong><span>{{ store.notice }}</span></span><X :size="16" aria-hidden="true" />
    </button>
    <div v-if="store.loading" class="loading-bar" role="progressbar" aria-label="正在处理"></div>
  </div>
</template>
