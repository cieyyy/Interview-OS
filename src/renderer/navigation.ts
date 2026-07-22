import type { LocationQuery } from 'vue-router';

const parentNavigationByPath: Record<string, string> = {
  '/career-agent': '/coach',
  '/reports': '/coach',
  '/job-insights': '/job-sync',
  '/calendar': '/applications'
};

export function resolvePrimaryNavigation(path: string, query: LocationQuery = {}): string {
  if (path === '/profile') return query.tab === 'projects' ? '/projects' : '/resumes';
  return parentNavigationByPath[path] ?? path;
}
