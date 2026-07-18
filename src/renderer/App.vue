<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useWorkspace } from './composables/useWorkspace';

const route = useRoute();
const { store, clearMessages } = useWorkspace();
const navItems = [
  { to: '/', label: '工作台', icon: '⌂' },
  { to: '/knowledge', label: '知识库', icon: '◇' },
  { to: '/profile', label: '职业档案', icon: '◎' },
  { to: '/jobs', label: 'JD 中心', icon: '▤' },
  { to: '/training', label: '面试训练', icon: '▶' },
  { to: '/reports', label: '训练报告', icon: '↗' },
  { to: '/assistant', label: 'AI 助手', icon: '✦' },
  { to: '/settings', label: '设置', icon: '⚙' }
];
const active = computed(() => route.path);
</script>

<template>
  <div class="app-shell">
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
          <span class="nav-icon">{{ item.icon }}</span><span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <span class="status-dot"></span>
        <div><strong>本地优先</strong><small>核心功能无需 Docker</small></div>
      </div>
    </aside>

    <main class="main-shell">
      <div class="topbar">
        <div class="workspace-pill">{{ store.workspace?.settings.workspaceName ?? '加载工作区…' }}</div>
        <div class="topbar-meta">数据仅保存在本机 · AI 可选</div>
      </div>
      <div class="content-area">
        <RouterView />
      </div>
    </main>

    <button v-if="store.error" class="toast error" type="button" @click="clearMessages">
      <strong>操作失败</strong><span>{{ store.error }}</span>
    </button>
    <button v-if="store.notice" class="toast success" type="button" @click="clearMessages">
      <strong>已完成</strong><span>{{ store.notice }}</span>
    </button>
    <div v-if="store.loading" class="loading-bar" aria-label="正在处理"></div>
  </div>
</template>

