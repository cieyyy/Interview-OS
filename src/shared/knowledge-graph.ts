import type { EntityId, KnowledgeItem, WorkspaceState } from './domain';

export interface KnowledgeBacklink {
  id: EntityId;
  title: string;
  type: KnowledgeItem['type'];
}

export interface KnowledgeGraphNode {
  id: EntityId;
  label: string;
  kind: 'knowledge' | 'project' | 'job' | 'skill';
}

export interface KnowledgeGraphEdge {
  source: EntityId;
  target: EntityId;
  relation: 'related' | 'wikilink' | 'project' | 'job' | 'skill';
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export function parseWikiLinks(markdown: string): string[] {
  const values = [...String(markdown ?? '').matchAll(/\[\[([^\]|\n]+)(?:\|[^\]\n]+)?\]\]/gu)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return [...new Set(values)];
}

export function knowledgeBacklinks(items: KnowledgeItem[], target: KnowledgeItem): KnowledgeBacklink[] {
  const targetTitle = target.title.trim().toLocaleLowerCase();
  return items
    .filter((item) => item.id !== target.id)
    .filter((item) => item.relatedIds.includes(target.id)
      || parseWikiLinks(item.contentMarkdown).some((title) => title.toLocaleLowerCase() === targetTitle))
    .map((item) => ({ id: item.id, title: item.title, type: item.type }));
}

export function buildKnowledgeGraph(state: WorkspaceState): KnowledgeGraph {
  const nodes = new Map<EntityId, KnowledgeGraphNode>();
  const edges = new Map<string, KnowledgeGraphEdge>();
  const addNode = (node: KnowledgeGraphNode): void => { nodes.set(node.id, node); };
  const addEdge = (edge: KnowledgeGraphEdge): void => { edges.set(`${edge.source}:${edge.target}:${edge.relation}`, edge); };

  const knowledgeByTitle = new Map(state.knowledge.map((item) => [item.title.trim().toLocaleLowerCase(), item]));
  for (const item of state.knowledge) addNode({ id: item.id, label: item.title, kind: 'knowledge' });
  for (const item of state.projects) addNode({ id: item.id, label: item.name, kind: 'project' });
  for (const item of state.jobs) addNode({ id: item.id, label: `${item.company ? `${item.company} · ` : ''}${item.title}`, kind: 'job' });

  for (const item of state.knowledge) {
    for (const target of item.relatedIds) {
      if (nodes.has(target) && !item.projectIds.includes(target) && !item.jobIds.includes(target)) {
        addEdge({ source: item.id, target, relation: 'related' });
      }
    }
    for (const title of parseWikiLinks(item.contentMarkdown)) {
      const target = knowledgeByTitle.get(title.toLocaleLowerCase());
      if (target) addEdge({ source: item.id, target: target.id, relation: 'wikilink' });
    }
    for (const target of item.projectIds) {
      if (nodes.has(target)) addEdge({ source: item.id, target, relation: 'project' });
    }
    for (const target of item.jobIds) {
      if (nodes.has(target)) addEdge({ source: item.id, target, relation: 'job' });
    }
    for (const skill of item.skillNames) {
      const id = `skill:${skill.trim().toLocaleLowerCase()}`;
      addNode({ id, label: skill, kind: 'skill' });
      addEdge({ source: item.id, target: id, relation: 'skill' });
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
