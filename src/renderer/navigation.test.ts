import { describe, expect, it } from 'vitest';
import { resolvePrimaryNavigation } from './navigation';

describe('primary navigation state', () => {
  it.each([
    ['/', {}, '/'],
    ['/coach', {}, '/coach'],
    ['/career-agent', {}, '/career-agent'],
    ['/career-memory', {}, '/career-memory'],
    ['/reports', {}, '/coach'],
    ['/profile', {}, '/profile'],
    ['/profile', { tab: 'projects' }, '/projects'],
    ['/job-insights', {}, '/job-insights'],
    ['/calendar', {}, '/applications']
  ])('maps %s to its visible parent module', (path, query, expected) => {
    expect(resolvePrimaryNavigation(path, query)).toBe(expected);
  });
});
