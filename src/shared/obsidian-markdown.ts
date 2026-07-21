import type {
  EntityId,
  KnowledgeItem,
  ObsidianEntityType,
  ObsidianFolderMapping,
  WorkspaceState
} from './domain';

export const MANAGED_START = '<!-- interview-os:managed:start -->';
export const MANAGED_END = '<!-- interview-os:managed:end -->';
export const USER_START = '<!-- interview-os:user:start -->';
export const USER_END = '<!-- interview-os:user:end -->';

export interface ObsidianExportEntity {
  entityId: EntityId;
  entityType: ObsidianEntityType;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  relatedJobs: EntityId[];
  relatedProjects: EntityId[];
  relatedKnowledge: EntityId[];
  relatedInterviews: EntityId[];
  folder: keyof ObsidianFolderMapping;
  managedMarkdown: string;
}

function yamlScalar(value: string | number | boolean | null): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function yamlArray(key: string, values: string[]): string[] {
  if (!values.length) return [`${key}: []`];
  return [`${key}:`, ...values.map((value) => `  - ${yamlScalar(value)}`)];
}

export function buildFrontmatter(entity: ObsidianExportEntity, lastSyncedAt: string): string {
  const rows = [
    '---',
    `interview_os_id: ${yamlScalar(entity.entityId)}`,
    `interview_os_type: ${yamlScalar(entity.entityType)}`,
    'schema_version: 1',
    `title: ${yamlScalar(entity.title)}`,
    `status: ${yamlScalar(entity.status)}`,
    `created_at: ${yamlScalar(entity.createdAt)}`,
    `updated_at: ${yamlScalar(entity.updatedAt)}`,
    `last_synced_at: ${yamlScalar(lastSyncedAt)}`,
    `source: ${yamlScalar('interview-os')}`,
    'sync_enabled: true',
    ...yamlArray('tags', entity.tags),
    ...yamlArray('related_jobs', entity.relatedJobs),
    ...yamlArray('related_projects', entity.relatedProjects),
    ...yamlArray('related_knowledge', entity.relatedKnowledge),
    ...yamlArray('related_interviews', entity.relatedInterviews),
    '---'
  ];
  return rows.join('\n');
}

export function extractUserBlock(markdown: string): string {
  const start = markdown.indexOf(USER_START);
  const end = markdown.indexOf(USER_END);
  if (start < 0 || end < 0 || end < start) return '';
  return markdown.slice(start + USER_START.length, end).trim();
}

export function serializeObsidianNote(
  entity: ObsidianExportEntity,
  lastSyncedAt: string,
  userContent = ''
): string {
  return `${buildFrontmatter(entity, lastSyncedAt)}\n\n# ${entity.title}\n\n` +
    `${MANAGED_START}\n${entity.managedMarkdown.trim()}\n${MANAGED_END}\n\n` +
    `${USER_START}\n${userContent.trim()}\n${USER_END}\n`;
}

export function obsidianWikiLink(title: string, displayName?: string): string {
  const target = title.replace(/[\[\]]/g, '').trim();
  const display = displayName?.replace(/[\[\]]/g, '').trim();
  return display && display !== target ? `[[${target}|${display}]]` : `[[${target}]]`;
}

function bulletList(values: string[], emptyText = '暂无'): string {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : emptyText;
}

function section(title: string, content: string): string {
  return `## ${title}\n\n${content.trim() || '暂无'}`;
}

function knowledgeEntityType(item: KnowledgeItem): ObsidianEntityType | undefined {
  const mapping: Partial<Record<KnowledgeItem['type'], ObsidianEntityType>> = {
    technical: 'technical-knowledge',
    project: 'technical-knowledge',
    incident: 'incident',
    question: 'interview-question',
    answer: 'interview-answer',
    jd: 'jd-analysis',
    'learning-plan': 'learning-plan',
    'company-research': 'company-research',
    retrospective: 'retrospective'
  };
  return mapping[item.type];
}

function folderForEntity(type: ObsidianEntityType): keyof ObsidianFolderMapping {
  const mapping: Record<ObsidianEntityType, keyof ObsidianFolderMapping> = {
    project: 'projects',
    incident: 'incidents',
    'technical-knowledge': 'technicalKnowledge',
    'interview-question': 'interviewQuestions',
    'interview-answer': 'expressionTraining',
    'jd-analysis': 'jdAnalysis',
    'learning-plan': 'learningPlans',
    'company-research': 'companyResearch',
    retrospective: 'retrospectives',
    'resume-metadata': 'resumes'
  };
  return mapping[type];
}

export function buildObsidianExportEntities(state: WorkspaceState): ObsidianExportEntity[] {
  const knowledgeTitles = new Map(state.knowledge.map((item) => [item.id, item.title]));
  const projectTitles = new Map(state.projects.map((item) => [item.id, item.name]));
  const jobTitles = new Map(state.jobs.map((item) => [item.id, `${item.company ? `${item.company} · ` : ''}${item.title}`]));
  const entities: ObsidianExportEntity[] = [];

  for (const project of state.projects) {
    const relatedKnowledge = project.relatedKnowledgeIds
      .map((id) => knowledgeTitles.get(id))
      .filter((value): value is string => Boolean(value))
      .map((title) => obsidianWikiLink(title));
    entities.push({
      entityId: project.id,
      entityType: 'project',
      title: project.name,
      status: 'active',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      tags: ['项目经历', ...project.techStack],
      relatedJobs: [],
      relatedProjects: [],
      relatedKnowledge: project.relatedKnowledgeIds,
      relatedInterviews: [],
      folder: 'projects',
      managedMarkdown: [
        section('项目角色', project.role),
        section('项目背景', project.background),
        section('项目目标', project.objective),
        section('系统架构', project.architecture),
        section('技术栈', bulletList(project.techStack)),
        section('个人职责', project.responsibilities),
        section('关键行动', project.actions),
        section('遇到的问题', project.challenges),
        section('结果', project.results),
        section('30 秒面试版本', project.pitch30),
        section('90 秒面试版本', project.pitch90),
        section('深入追问版本', project.deepDive),
        section('面试校准记录', project.interviewRevisionNotes ?? ''),
        section('关联知识', bulletList(relatedKnowledge))
      ].join('\n\n')
    });
  }

  for (const item of state.knowledge) {
    const entityType = knowledgeEntityType(item);
    if (!entityType) continue;
    const relatedKnowledge = item.relatedIds
      .map((id) => knowledgeTitles.get(id))
      .filter((value): value is string => Boolean(value))
      .map((title) => obsidianWikiLink(title));
    const relatedProjects = item.relatedIds
      .map((id) => projectTitles.get(id))
      .filter((value): value is string => Boolean(value))
      .map((title) => obsidianWikiLink(title));
    const relatedJobs = item.relatedIds
      .map((id) => jobTitles.get(id))
      .filter((value): value is string => Boolean(value))
      .map((title) => obsidianWikiLink(title));
    entities.push({
      entityId: item.id,
      entityType,
      title: item.title,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      tags: item.tags,
      relatedJobs: item.relatedIds.filter((id) => jobTitles.has(id)),
      relatedProjects: item.relatedIds.filter((id) => projectTitles.has(id)),
      relatedKnowledge: item.relatedIds.filter((id) => knowledgeTitles.has(id)),
      relatedInterviews: [],
      folder: folderForEntity(entityType),
      managedMarkdown: [
        item.contentMarkdown,
        section('来源', item.source),
        section('关联项目', bulletList(relatedProjects)),
        section('关联岗位', bulletList(relatedJobs)),
        section('关联知识', bulletList(relatedKnowledge))
      ].join('\n\n')
    });
  }

  for (const job of state.jobs) {
    const requirements = job.requirements.map((requirement) =>
      `- ${requirement.label} | ${requirement.priority} | ${requirement.matchStatus}` +
      `${requirement.evidenceSummary ? ` | ${requirement.evidenceSummary}` : ''}`
    );
    const tasks = job.tasks.map((task) => `- [${task.completed ? 'x' : ' '}] ${task.title} (${task.bucket})`);
    entities.push({
      entityId: job.id,
      entityType: 'jd-analysis',
      title: `${job.company ? `${job.company} · ` : ''}${job.title}`,
      status: 'active',
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      tags: ['JD分析', job.company, job.title].filter(Boolean),
      relatedJobs: [job.id],
      relatedProjects: [],
      relatedKnowledge: job.requirements.flatMap((item) => item.evidenceIds),
      relatedInterviews: [],
      folder: 'jdAnalysis',
      managedMarkdown: [
        section('公司', job.company),
        section('岗位', job.title),
        section('原始 JD', job.rawText),
        section('要求与证据匹配', bulletList(requirements)),
        section('准备任务', bulletList(tasks))
      ].join('\n\n')
    });
  }

  for (const session of state.trainingSessions) {
    const answers = session.questions.map((question) => {
      const attempts = session.attempts.filter((attempt) => attempt.questionId === question.id);
      const attemptText = attempts.map((attempt, index) =>
        `### 回答 ${index + 1} (${attempt.totalScore} 分)\n\n${attempt.answer}\n\n` +
        `#### 改进建议\n\n${bulletList(attempt.feedback)}`
      ).join('\n\n');
      return `## ${question.text}\n\n${attemptText || '暂无回答'}`;
    }).join('\n\n');
    entities.push({
      entityId: session.id,
      entityType: 'interview-answer',
      title: session.title,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      tags: ['表达训练', session.language ?? 'zh-CN', session.mode ?? 'standard'],
      relatedJobs: session.jobId ? [session.jobId] : [],
      relatedProjects: session.projectId ? [session.projectId] : [],
      relatedKnowledge: [],
      relatedInterviews: [session.id],
      folder: 'expressionTraining',
      managedMarkdown: answers
    });
  }

  for (const resume of state.resumeVariants) {
    const targetJob = resume.jobId ? jobTitles.get(resume.jobId) : undefined;
    entities.push({
      entityId: resume.id,
      entityType: 'resume-metadata',
      title: resume.name,
      status: resume.status,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
      tags: ['简历版本', ...resume.targetKeywords],
      relatedJobs: resume.jobId ? [resume.jobId] : [],
      relatedProjects: resume.projectIds,
      relatedKnowledge: [],
      relatedInterviews: [],
      folder: 'resumes',
      managedMarkdown: [
        section('目标岗位', targetJob ?? resume.headline),
        section('版本', String(resume.version)),
        section('修改摘要', resume.summary),
        section('关键词', bulletList(resume.targetKeywords)),
        section('证据项目', bulletList(resume.projectIds.map((id) => {
          const title = projectTitles.get(id);
          return title ? obsidianWikiLink(title) : id;
        }))),
        section('匹配分', String(resume.matchScore))
      ].join('\n\n')
    });
  }

  return entities;
}
