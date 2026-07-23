import type { LocationQuery } from 'vue-router';

const parentNavigationByPath: Record<string, string> = {
  '/reports': '/coach',
  '/calendar': '/applications'
};

export function resolvePrimaryNavigation(path: string, query: LocationQuery = {}): string {
  if (path === '/profile') return query.tab === 'projects' ? '/projects' : '/profile';
  return parentNavigationByPath[path] ?? path;
}
