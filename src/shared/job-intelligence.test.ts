import { describe, expect, it } from 'vitest';
import { analyzeSyncedJob, buildGreetingDraft, jobMatchesPreset, parseSalaryRange } from './job-intelligence';
import { createDemoState } from './domain';
import type { JobFilterPreset } from './domain';

describe('job intelligence', () => {
  it('normalizes salary ranges into monthly K values', () => {
    expect(parseSalaryRange('20K-30K·13薪')).toEqual({ min: 20, max: 30 });
    expect(parseSalaryRange('24-36万/年')).toEqual({ min: 20, max: 30 });
    expect(parseSalaryRange('200-300元/天')).toEqual({ min: 4.4, max: 6.5 });
  });

  it('extracts multi-industry fields, profile match and trust risks deterministically', () => {
    const profile = createDemoState().profile;
    const result = analyzeSyncedJob({
      sourceUrl: 'https://example.com/jobs/1', title: 'Kubernetes 运维工程师', company: '示例科技',
      location: '杭州', salaryRange: '20K-30K', postedAt: new Date().toISOString(),
      description: '负责 Kubernetes、Docker、Nginx 平台运维与生产故障排查，要求本科和 2-4 年经验，需要参与发布验证、监控建设、复盘改进和跨团队技术沟通。'
    }, profile);

    expect(result.industry).toBe('operations');
    expect(result.skills).toEqual(expect.arrayContaining(['Kubernetes', 'Docker', 'Nginx']));
    expect(result.education).toBe('本科');
    expect(result.experience).toBe('2-4年');
    expect(result.matchScore).toBeGreaterThan(50);
    expect(result.trustScore).toBeGreaterThanOrEqual(90);
  });

  it('applies saved filter specifications and drafts evidence-bound greetings', () => {
    const profile = createDemoState().profile;
    const job = {
      title: '云原生运维工程师', company: '示例科技', description: 'Kubernetes Docker', location: '杭州',
      sourceSite: 'boss', industry: 'operations' as const, salaryMinK: 20, matchScore: 85, trustScore: 92,
      remote: false, capturedAt: new Date().toISOString()
    };
    const preset: JobFilterPreset = {
      id: 'preset', name: '云原生', includeKeywords: ['云原生'], excludeKeywords: ['外包'], cities: ['杭州'],
      industries: ['operations'], sources: ['boss'], minSalaryK: 15, minMatchScore: 70, minTrustScore: 80,
      remoteOnly: false, freshWithinDays: 30, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };

    expect(jobMatchesPreset(job, preset)).toBe(true);
    const greeting = buildGreetingDraft(profile, job);
    expect(greeting).toContain('云原生运维工程师');
    expect(greeting).toContain('Kubernetes');
  });
});
