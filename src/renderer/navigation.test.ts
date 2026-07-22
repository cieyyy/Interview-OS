import { describe, expect, it } from 'vitest';
import { resolvePrimaryNavigation } from './navigation';

describe('primary navigation state', () => {
  it.each([
    ['/', {}, '/'],
    ['/coach', {}, '/coach'],
    ['/career-agent', {}, '/coach'],
    ['/reports', {}, '/coach'],
    ['/profile', {}, '/resumes'],
    ['/profile', { tab: 'projects' }, '/projects'],
    ['/job-insights', {}, '/job-sync'],
    ['/calendar', {}, '/applications']
  ])('maps %s to its visible parent module', (path, query, expected) => {
    expect(resolvePrimaryNavigation(path, query)).toBe(expected);
  });
});
