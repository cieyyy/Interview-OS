import { describe, expect, it } from 'vitest';
import { createDemoState } from './domain';
import {
  buildFrontmatter,
  buildObsidianExportEntities,
  extractUserBlock,
  obsidianWikiLink,
  serializeObsidianNote
} from './obsidian-markdown';

describe('Obsidian Markdown serializer', () => {
  it('serializes a project with stable ID, standard frontmatter and managed blocks', () => {
    const state = createDemoState();
    const project = buildObsidianExportEntities(state).find((item) => item.entityType === 'project');
    expect(project).toBeTruthy();
    const markdown = serializeObsidianNote(project!, '2026-07-21T10:00:00.000Z');

    expect(markdown).toContain(`interview_os_id: "${project!.entityId}"`);
    expect(markdown).toContain('interview_os_type: "project"');
    expect(markdown).toContain('schema_version: 1');
    expect(markdown).toContain('<!-- interview-os:managed:start -->');
    expect(markdown).toContain('<!-- interview-os:user:start -->');
    expect(markdown).toContain('## 系统架构');
    expect(markdown).toContain('Kubernetes');
  });

  it('preserves multiline and special-character values as valid quoted YAML scalars', () => {
    const state = createDemoState();
    const project = buildObsidianExportEntities(state).find((item) => item.entityType === 'project')!;
    project.title = '模型: A/B #1 "生产"';
    project.tags = ['K8s', '值:特殊', '中文'];
    const frontmatter = buildFrontmatter(project, '2026-07-21T10:00:00.000Z');

    expect(frontmatter).toContain('title: "模型: A/B #1 \\"生产\\""');
    expect(frontmatter).toContain('  - "值:特殊"');
  });

  it('keeps the user-owned block across managed-content regeneration', () => {
    const state = createDemoState();
    const project = buildObsidianExportEntities(state).find((item) => item.entityType === 'project')!;
    const first = serializeObsidianNote(project, '2026-07-21T10:00:00.000Z', '我的自由笔记\n\n- 不应被覆盖');
    const userContent = extractUserBlock(first);
    project.managedMarkdown += '\n\n## 新增托管字段\n\n新的内容';
    const second = serializeObsidianNote(project, '2026-07-21T11:00:00.000Z', userContent);

    expect(second).toContain('我的自由笔记');
    expect(second).toContain('不应被覆盖');
    expect(second).toContain('新增托管字段');
  });

  it('creates Obsidian WikiLinks without allowing nested brackets', () => {
    expect(obsidianWikiLink('[[Pod 启动失败]]')).toBe('[[Pod 启动失败]]');
    expect(obsidianWikiLink('Deployment 滚动更新', '发布策略')).toBe('[[Deployment 滚动更新|发布策略]]');
  });

  it('maps knowledge, JD, training and resume data into the existing knowledge graph', () => {
    const state = createDemoState();
    state.knowledge[0].type = 'technical';
    const now = new Date().toISOString();
    state.jobs.push({
      id: crypto.randomUUID(),
      title: '云原生技术支持',
      company: '示例公司',
      rawText: '要求熟悉 Kubernetes。',
      requirements: [],
      tasks: [],
      createdAt: now,
      updatedAt: now
    });
    const entities = buildObsidianExportEntities(state);
    expect(entities.some((item) => item.entityType === 'technical-knowledge')).toBe(true);
    expect(entities.some((item) => item.entityType === 'project')).toBe(true);
    expect(entities.some((item) => item.entityType === 'jd-analysis')).toBe(true);
  });
});
