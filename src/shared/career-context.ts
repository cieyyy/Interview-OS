import type { CareerContextOverview, WorkspaceState } from './domain';

function unique(values: Array<string | undefined>, limit: number): string[] {
  return [...new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))].slice(0, limit);
}

export function buildCareerContextOverview(
  state: WorkspaceState,
  generatedAt = new Date().toISOString()
): CareerContextOverview {
  const targetRoles = unique(state.profile.targetRoles, 10);
  const profileSkillNames = new Set(state.profile.skills.map((item) => item.name.trim().toLocaleLowerCase()));
  const strengths = unique([
    ...state.profile.skills.map((item) => `${item.name}（${item.level}）`),
    ...state.projects.flatMap((item) => item.techStack).filter((item) => !profileSkillNames.has(item.trim().toLocaleLowerCase())),
    ...state.trainingSessions.flatMap((item) => item.summary?.coreStrengths ?? [])
  ], 12);
  const preferences = unique(
    state.careerMemory
      .filter((item) => item.type === 'preference' || item.type === 'decision')
      .map((item) => item.content),
    10
  );
  const gaps = unique([
    ...state.trainingSessions.flatMap((item) => item.summary?.highRiskGaps ?? []),
    ...state.careerMemory.filter((item) => item.type === 'feedback').map((item) => item.content)
  ], 10);
  const evidence = [
    ...state.projects.slice(0, 6).map((item) => ({
      id: item.id,
      kind: 'project' as const,
      title: item.name,
      summary: unique([item.role, item.results, item.responsibilities], 3).join(' · ').slice(0, 360)
    })),
    ...state.knowledge.slice(0, 6).map((item) => ({
      id: item.id,
      kind: 'knowledge' as const,
      title: item.title,
      summary: item.contentMarkdown.replace(/[#*_`>\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 360)
    })),
    ...state.resumeVariants.slice(0, 3).map((item) => ({
      id: item.id,
      kind: 'resume' as const,
      title: item.name,
      summary: unique([item.headline, item.summary, ...item.highlights], 4).join(' · ').slice(0, 360)
    }))
  ].slice(0, 12);
  const role = state.profile.currentRole || '待完善当前岗位';
  const direction = targetRoles.length ? `目标 ${targetRoles.join(' / ')}` : '目标方向待完善';
  return {
    generatedAt,
    headline: `${role}，${state.profile.yearsExperience || 0} 年经验；${direction}`,
    targetRoles,
    strengths,
    preferences,
    gaps,
    evidence,
    counts: {
      projects: state.projects.length,
      knowledge: state.knowledge.length,
      resumes: state.resumeVariants.length,
      trainingSessions: state.trainingSessions.length,
      memories: state.careerMemory.length
    }
  };
}

function section(title: string, rows: string[], empty: string): string {
  return [`## ${title}`, '', ...(rows.length ? rows.map((item) => `- ${item}`) : [`- ${empty}`]), ''].join('\n');
}

export function renderCareerContextMarkdown(state: WorkspaceState, generatedAt = new Date().toISOString()): string {
  const context = buildCareerContextOverview(state, generatedAt);
  const projects = state.projects.map((item) => [
    `### ${item.name}`,
    '',
    `- 角色：${item.role || '待完善'}`,
    `- 背景：${item.background || '待完善'}`,
    `- 职责：${item.responsibilities || '待完善'}`,
    `- 动作：${item.actions || '待完善'}`,
    `- 结果：${item.results || '待完善'}`,
    `- 技术栈：${item.techStack.join('、') || '待完善'}`,
    ''
  ].join('\n'));
  return [
    '# 我的职业 AI 上下文',
    '',
    `> 生成时间：${context.generatedAt}`,
    '',
    '## 基本信息',
    '',
    `- 当前岗位：${state.profile.currentRole || '待完善'}`,
    `- 工作年限：${state.profile.yearsExperience || 0} 年`,
    `- 教育背景：${state.profile.education || '待完善'}`,
    `- 职业定位：${context.headline}`,
    '',
    section('目标方向', context.targetRoles, '待完善'),
    section('核心能力', context.strengths, '待完善'),
    section('职业偏好与决定', context.preferences, '尚未记录'),
    '## 项目经历',
    '',
    ...(projects.length ? projects : ['- 尚未记录项目经历', '']),
    section('当前能力缺口', context.gaps, '尚未从训练中识别'),
    '## 数据概览',
    '',
    `- 项目：${context.counts.projects}`,
    `- 知识：${context.counts.knowledge}`,
    `- 简历版本：${context.counts.resumes}`,
    `- 面试训练：${context.counts.trainingSessions}`,
    `- 长期记忆：${context.counts.memories}`,
    ''
  ].join('\n');
}
