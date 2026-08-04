import { createRouter, createWebHashHistory } from 'vue-router';
import DashboardPage from './pages/DashboardPage.vue';
import ProfilePage from './pages/ProfilePage.vue';
import JobsPage from './pages/JobsPage.vue';
import TrainingPage from './pages/TrainingPage.vue';
import ReportsPage from './pages/ReportsPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import ApplicationsPage from './pages/ApplicationsPage.vue';
import ResumeStudioPage from './pages/ResumeStudioPage.vue';
import CareerCalendarPage from './pages/CareerCalendarPage.vue';
import JobSyncPage from './pages/JobSyncPage.vue';
import CareerAgentPage from './pages/CareerAgentPage.vue';
import CompaniesPage from './pages/CompaniesPage.vue';
import SkillGraphPage from './pages/SkillGraphPage.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardPage },
    { path: '/career-agent', name: 'career-agent', component: CareerAgentPage },
    { path: '/knowledge', redirect: '/profile' },
    { path: '/profile', name: 'profile', component: ProfilePage },
    { path: '/jobs', name: 'jobs', component: JobsPage },
    { path: '/job-sync', name: 'job-sync', component: JobSyncPage },
    { path: '/job-insights', redirect: '/job-sync' },
    { path: '/companies', name: 'companies', component: CompaniesPage },
    { path: '/skill-graph', name: 'skill-graph', component: SkillGraphPage },
    { path: '/data-center', redirect: '/' },
    { path: '/applications', name: 'applications', component: ApplicationsPage },
    { path: '/resumes', name: 'resumes', component: ResumeStudioPage },
    { path: '/calendar', name: 'calendar', component: CareerCalendarPage },
    { path: '/coach', name: 'coach', component: TrainingPage },
    { path: '/training', redirect: '/coach' },
    { path: '/reports', name: 'reports', component: ReportsPage },
    { path: '/assistant', redirect: '/coach' },
    { path: '/projects', redirect: { path: '/profile', query: { tab: 'projects' } } },
    { path: '/settings', name: 'settings', component: SettingsPage }
  ]
});

router.afterEach(() => {
  requestAnimationFrame(() => {
    const main = document.querySelector<HTMLElement>('#main-content');
    main?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    main?.focus({ preventScroll: true });
  });
});

export default router;
