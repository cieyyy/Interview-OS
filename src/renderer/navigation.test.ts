import { describe, expect, it } from 'vitest';
import { resolvePrimaryNavigation } from './navigation';

describe('primary navigation state', () => {
  it.each([
    ['/', {}, '/'],
    ['/coach', {}, '/coach'],
    ['/career-agent', {}, '/career-agent'],
    ['/reports', {}, '/coach'],
    ['/profile', {}, '/profile'],
    ['/profile', { tab: 'projects' }, '/profile'],
    ['/job-insights', {}, '/job-sync'],
    ['/projects', {}, '/profile'],
    ['/knowledge', {}, '/profile'],
    ['/data-center', {}, '/'],
    ['/calendar', {}, '/applications']
  ])('maps %s to its visible parent module', (path, query, expected) => {
    expect(resolvePrimaryNavigation(path, query)).toBe(expected);
  });
});
