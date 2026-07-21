import { describe, expect, it } from 'vitest';
import { analyzeJob } from './job-analyzer';
import { buildResumeDraft, calculateResumeMatch } from './career-engine';
import { createDemoState } from './domain';

describe('career engine', () => {
  it('builds a targeted resume draft from verified profile and project evidence', () => {
    const state = createDemoState();
    const job = analyzeJob({
      title: '云原生技术支持工程师',
      company: '目标公司',
      rawText: '负责 Kubernetes、Docker、Nginx 故障排查和客户技术支持。'
    }, state);
    state.jobs.push(job);

    const draft = buildResumeDraft(state, job.id);
    const match = calculateResumeMatch(state, draft);

    expect(draft.name).toContain('云原生技术支持工程师');
    expect(draft.projectIds).toContain(state.projects[0].id);
    expect(draft.highlights?.join('')).toContain(state.projects[0].name);
    expect(match.targetKeywords.length).toBeGreaterThan(0);
    expect(match.score).toBeGreaterThan(0);
  });
});
