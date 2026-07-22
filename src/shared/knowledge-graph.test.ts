import { describe, expect, it } from 'vitest';
import { createDemoState } from './domain';
import { buildKnowledgeGraph, knowledgeBacklinks, parseWikiLinks } from './knowledge-graph';

describe('knowledge graph', () => {
  it('parses unique WikiLinks and ignores aliases', () => {
    expect(parseWikiLinks('[[Kubernetes]] and [[Kubernetes|K8s]] and [[Docker]]')).toEqual(['Kubernetes', 'Docker']);
  });

  it('builds backlinks from explicit relations and WikiLinks', () => {
    const state = createDemoState();
    const target = state.knowledge[0];
    state.knowledge.push({
      ...target,
      id: 'linked-note',
      title: '关联笔记',
      contentMarkdown: `参考 [[${target.title}]]`,
      relatedIds: []
    });
    expect(knowledgeBacklinks(state.knowledge, target).map((item) => item.id)).toContain('linked-note');
    expect(buildKnowledgeGraph(state).edges.some((edge) => edge.relation === 'wikilink')).toBe(true);
  });

  it('does not duplicate a project link as both related and project', () => {
    const state = createDemoState();
    const project = state.projects[0];
    state.knowledge[0].relatedIds = [project.id];
    state.knowledge[0].projectIds = [project.id];
    const edges = buildKnowledgeGraph(state).edges.filter((edge) => edge.source === state.knowledge[0].id && edge.target === project.id);
    expect(edges).toEqual([expect.objectContaining({ relation: 'project' })]);
  });
});
