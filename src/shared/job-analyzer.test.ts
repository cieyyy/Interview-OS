import { describe, expect, it } from 'vitest';
import { createDemoState } from './domain';
import { analyzeJob } from './job-analyzer';

describe('analyzeJob', () => {
  it('extracts requirements and connects real evidence', () => {
    const result = analyzeJob({
      title: 'AI 技术支持工程师',
      company: '示例公司',
      rawText: '要求熟悉 Kubernetes、Docker 和 Linux，具备大模型 API 故障排查及客户沟通能力。'
    }, createDemoState());

    expect(result.requirements.some((item) => item.label === 'Kubernetes')).toBe(true);
    const kubernetes = result.requirements.find((item) => item.label === 'Kubernetes');
    expect(kubernetes?.matchStatus).toMatch(/evidenced|related/);
    expect(kubernetes?.evidenceIds.length).toBeGreaterThan(0);
    expect(result.tasks.length).toBe(result.requirements.length);
  });

  it('falls back to a generic requirement for unknown text', () => {
    const result = analyzeJob({ title: '特殊岗位', rawText: '负责一种尚未收录的专业工作。' }, createDemoState());
    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].label).toBe('岗位职责与相关经验');
  });
});

