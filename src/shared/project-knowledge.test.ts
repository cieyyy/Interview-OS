import { describe, expect, it } from 'vitest';
import { createDemoState } from './domain';
import { buildProjectKnowledgeInputs } from './project-knowledge';

describe('project knowledge', () => {
  it('builds deterministic knowledge only when explicitly requested', () => {
    const project = createDemoState().projects[0];
    const inputs = buildProjectKnowledgeInputs(project);
    expect(inputs).toHaveLength(4);
    expect(inputs.every((item) => item.projectIds?.includes(project.id))).toBe(true);
    expect(inputs.every((item) => !item.relatedIds?.includes(project.id))).toBe(true);
    expect(new Set(inputs.map((item) => item.id)).size).toBe(4);
  });
});
