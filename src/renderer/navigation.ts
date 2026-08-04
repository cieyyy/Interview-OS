import type { LocationQuery } from 'vue-router';

const parentNavigationByPath: Record<string, string> = {
  '/reports': '/coach',
  '/calendar': '/applications',
  '/projects': '/profile',
  '/job-insights': '/job-sync',
  '/knowledge': '/profile',
  '/data-center': '/'
};

export function resolvePrimaryNavigation(path: string, query: LocationQuery = {}): string {
  if (path === '/profile') return '/profile';
  return parentNavigationByPath[path] ?? path;
}
