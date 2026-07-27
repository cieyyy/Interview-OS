import { describe, expect, it } from 'vitest';
import { createDemoState } from './domain';
import { buildCareerContextOverview, renderCareerContextMarkdown } from './career-context';

describe('career context', () => {
  it('builds a compact overview from structured workspace evidence', () => {
    const state = createDemoState();
    const overview = buildCareerContextOverview(state, '2026-07-28T00:00:00.000Z');

    expect(overview.headline).toContain('运维工程师');
    expect(overview.targetRoles).toContain('AI 大模型技术支持工程师');
    expect(overview.strengths.some((item) => item.includes('Kubernetes'))).toBe(true);
    expect(overview.preferences[0]).toContain('云原生');
    expect(overview.evidence.some((item) => item.kind === 'project')).toBe(true);
  });

  it('renders a portable AI_CONTEXT markdown document', () => {
    const markdown = renderCareerContextMarkdown(createDemoState(), '2026-07-28T00:00:00.000Z');

    expect(markdown).toContain('# 我的职业 AI 上下文');
    expect(markdown).toContain('## 项目经历');
    expect(markdown).toContain('AI 漫剧算力平台');
    expect(markdown).toContain('## 职业偏好与决定');
  });
});
