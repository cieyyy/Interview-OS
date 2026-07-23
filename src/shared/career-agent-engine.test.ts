import { describe, expect, it } from 'vitest';
import { buildCareerAnswer, buildSkillGraph, matchJobsForPlan, parseCareerGoal } from './career-agent-engine';
import { createDemoState } from './domain';

describe('career agent engine', () => {
  it('turns a natural-language goal into an auditable search plan', () => {
    const state = createDemoState();
    const plan = parseCareerGoal('找杭州 AI Agent 或技术支持岗位，20K 以上，不要外包，远程优先', state);
    expect(plan.cities).toContain('杭州');
    expect(plan.keywords).toEqual(expect.arrayContaining(['AI Agent', '技术支持']));
    expect(plan.excludeKeywords).toContain('外包');
    expect(plan.salaryMinK).toBe(20);
    expect(plan.remotePreference).toBe('preferred');
  });

  it('matches the local job pool and builds explainable capability gaps', () => {
    const state = createDemoState();
    const plan = state.careerSearchPlans[0];
    const matches = matchJobsForPlan(plan, state.syncedJobs);
    expect(matches[0]?.title).toContain('云原生');

    const graph = buildSkillGraph(state, matches[0].id);
    expect(graph.some((item) => item.name === 'Kubernetes' && item.category === 'verified')).toBe(true);
    expect(graph.some((item) => item.name === 'Nginx')).toBe(true);

    const answer = buildCareerAnswer('为什么推荐？', state, matches.map((item) => item.id));
    expect(answer).toContain('匹配度');
  });
  it('builds a target-job-specific capability graph', () => {
    const state = createDemoState();

    const cloudGraph = buildSkillGraph(state, 'demo-job-cloud').map((item) => item.name);
    const designGraph = buildSkillGraph(state, 'demo-job-design').map((item) => item.name);

    expect(cloudGraph).toContain('Kubernetes');
    expect(cloudGraph).not.toContain('Figma');
    expect(designGraph).toContain('Figma');
    expect(designGraph).not.toContain('Kubernetes');
  });
});
