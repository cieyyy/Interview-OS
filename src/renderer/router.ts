import { createRouter, createWebHashHistory } from 'vue-router';
import DashboardPage from './pages/DashboardPage.vue';
import KnowledgePage from './pages/KnowledgePage.vue';
import ProfilePage from './pages/ProfilePage.vue';
import JobsPage from './pages/JobsPage.vue';
import TrainingPage from './pages/TrainingPage.vue';
import ReportsPage from './pages/ReportsPage.vue';
import AssistantPage from './pages/AssistantPage.vue';
import SettingsPage from './pages/SettingsPage.vue';

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardPage },
    { path: '/knowledge', name: 'knowledge', component: KnowledgePage },
    { path: '/profile', name: 'profile', component: ProfilePage },
    { path: '/jobs', name: 'jobs', component: JobsPage },
    { path: '/training', name: 'training', component: TrainingPage },
    { path: '/reports', name: 'reports', component: ReportsPage },
    { path: '/assistant', name: 'assistant', component: AssistantPage },
    { path: '/settings', name: 'settings', component: SettingsPage }
  ]
});

