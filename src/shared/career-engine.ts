import type { JobDescription, ResumeVariantInput, WorkspaceState } from './domain';

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function relatedToRequirement(value: string, requirement: string): boolean {
  const left = normalized(value);
  const right = normalized(requirement);
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

export function calculateResumeMatch(
  state: WorkspaceState,
  input: Pick<ResumeVariantInput, 'jobId' | 'projectIds' | 'skillIds' | 'highlights'>
): { score: number; targetKeywords: string[] } {
  const job = input.jobId ? state.jobs.find((item) => item.id === input.jobId) : undefined;
  if (!job) return { score: 0, targetKeywords: [] };
  const projectIds = new Set(input.projectIds ?? []);
  const skillIds = new Set(input.skillIds ?? []);
  const selectedProjects = state.projects.filter((item) => projectIds.has(item.id));
  const selectedSkills = state.profile.skills.filter((item) => skillIds.has(item.id));
  const evidenceText = [
    ...selectedProjects.flatMap((item) => [item.name, item.responsibilities, item.actions, item.results, ...item.techStack]),
    ...selectedSkills.map((item) => item.name),
    ...(input.highlights ?? [])
  ].join(' ');
  const requirements = job.requirements.filter((item) => item.priority !== 'context');
  const covered = requirements.filter((requirement) =>
    requirement.evidenceIds.some((id) => projectIds.has(id))
    || requirement.matchStatus === 'evidenced'
    || relatedToRequirement(evidenceText, requirement.label)
  );
  const requirementScore = requirements.length ? covered.length / requirements.length * 80 : 40;
  const evidenceScore = Math.min(20, selectedProjects.length * 6 + selectedSkills.length * 2 + Math.min(6, (input.highlights ?? []).length * 2));
  return {
    score: Math.min(100, Math.round(requirementScore + evidenceScore)),
    targetKeywords: job.requirements.map((item) => item.label).slice(0, 20)
  };
}

function relevantProjects(state: WorkspaceState, job?: JobDescription): string[] {
  if (!job) return state.projects.slice(0, 3).map((item) => item.id);
  const evidenceIds = new Set(job.requirements.flatMap((item) => item.evidenceIds));
  const ranked = [...state.projects].sort((left, right) => {
    const rightScore = Number(evidenceIds.has(right.id)) + right.techStack.filter((tech) => job.rawText.toLocaleLowerCase().includes(tech.toLocaleLowerCase())).length;
    const leftScore = Number(evidenceIds.has(left.id)) + left.techStack.filter((tech) => job.rawText.toLocaleLowerCase().includes(tech.toLocaleLowerCase())).length;
    return rightScore - leftScore;
  });
  return ranked.slice(0, 3).map((item) => item.id);
}

export function buildResumeDraft(state: WorkspaceState, jobId?: string): ResumeVariantInput {
  const job = jobId ? state.jobs.find((item) => item.id === jobId) : undefined;
  const profile = state.profile;
  const projectIds = relevantProjects(state, job);
  const selectedProjects = state.projects.filter((item) => projectIds.includes(item.id));
  const matchingSkills = profile.skills.filter((skill) => !job || job.rawText.toLocaleLowerCase().includes(skill.name.toLocaleLowerCase()));
  const skillIds = (matchingSkills.length ? matchingSkills : (!job ? profile.skills : [])).slice(0, 10).map((item) => item.id);
  const requirementKeywords = job?.requirements.map((item) => item.label).slice(0, 8) ?? [];
  const target = job?.title || profile.targetRoles[0] || profile.currentRole || '目标岗位';
  const company = job?.company?.trim();
  const highlights = selectedProjects.map((project) => {
    const action = project.actions || project.responsibilities;
    return `${project.name}：${action}${project.results ? `；${project.results}` : ''}`;
  }).slice(0, 6);
  if (!highlights.length && requirementKeywords.length) {
    highlights.push(`围绕岗位要求补充真实经历：${requirementKeywords.slice(0, 4).join('、')}。`);
  }
  const years = profile.yearsExperience > 0 ? `${profile.yearsExperience} 年` : '';
  const skillNames = profile.skills.filter((item) => skillIds.includes(item.id)).map((item) => item.name).slice(0, 6);
  const headlineKeywords = skillNames.length ? skillNames : requirementKeywords.slice(0, 6);
  const requirementText = requirementKeywords.length ? `，重点回应 ${requirementKeywords.slice(0, 5).join('、')} 等岗位要求` : '';
  return {
    name: `${company ? `${company} · ` : ''}${target} 定向简历`,
    jobId: job?.id,
    headline: `${target}${headlineKeywords.length ? ` · ${headlineKeywords.join(' / ')}` : ''}`,
    summary: `具备${years || '实际'}${profile.currentRole || '相关岗位'}经验，能够围绕${target}要求${requirementText}，使用真实项目证据说明个人职责、关键行动和验证结果。`,
    highlights,
    projectIds,
    skillIds,
    status: 'draft'
  };
}
