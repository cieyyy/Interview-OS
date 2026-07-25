import type { CareerSearchPlan, CareerSearchPlanInput, SyncedJob, WorkspaceState } from './domain';
import { extractJobSkills } from './job-intelligence';

const knownCities = ['北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉', '苏州', '西安', '重庆', '天津', '长沙', '厦门', '青岛'];
const knownPlatforms = ['BOSS直聘', '猎聘', '智联招聘', '前程无忧', '拉勾', '牛客', '应届生', '国聘网', '公司官网'];
const knownKeywords = [
  'AI Agent', 'RAG', '大模型', '算法', '前端', '后端', '测试', '运维', 'SRE', 'DevOps', '技术支持',
  '产品经理', '产品运营', '用户运营', '内容运营', '新媒体', '市场', '销售', '设计', 'UI', 'UX',
  '财务', '会计', '审计', '人力资源', '招聘', '法务', '供应链', '物流', '教师', '医疗'
];

function unique(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function includesLoose(text: string, value: string): boolean {
  return text.toLocaleLowerCase().includes(value.toLocaleLowerCase());
}

function sameSkill(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

export function parseCareerGoal(goal: string, state: WorkspaceState): CareerSearchPlanInput {
  const cities = knownCities.filter((city) => goal.includes(city));
  const keywords = knownKeywords.filter((keyword) => includesLoose(goal, keyword));
  if (!keywords.length) keywords.push(...state.profile.targetRoles.slice(0, 3));
  const excludeKeywords = [...goal.matchAll(/(?:不要|排除|避开)([^，。；,;]{1,16})/gu)].map((item) => item[1].trim());
  const platforms = knownPlatforms.filter((platform) => includesLoose(goal, platform.replace('招聘', '')));
  const jobTypes = ['社招', '校招', '实习', '兼职'].filter((item) => goal.includes(item));
  const range = goal.match(/(\d+)\s*[kK]\s*[-~至]\s*(\d+)\s*[kK]/u);
  const minimum = goal.match(/(\d+)\s*[kK]\s*(?:以上|起)/u);
  const maximum = goal.match(/(\d+)\s*[kK]\s*(?:以内|以下|封顶)/u);
  const hardConstraints = unique([
    ...[...goal.matchAll(/(?:必须|只看|仅看)([^，。；,;]{1,20})/gu)].map((item) => item[1]),
    ...excludeKeywords.map((item) => `排除 ${item}`)
  ]);
  const softPreferences = unique([...goal.matchAll(/(?:优先|倾向|最好)([^，。；,;]{1,20})/gu)].map((item) => item[1]));
  const primaryKeyword = keywords[0] || '目标岗位';
  return {
    title: `${cities[0] ? `${cities[0]} · ` : ''}${primaryKeyword}`,
    goal,
    cities,
    keywords: unique(keywords),
    excludeKeywords: unique(excludeKeywords),
    platforms,
    jobTypes,
    salaryMinK: range ? Number(range[1]) : minimum ? Number(minimum[1]) : undefined,
    salaryMaxK: range ? Number(range[2]) : maximum ? Number(maximum[1]) : undefined,
    remotePreference: /只看远程|必须远程/u.test(goal) ? 'required' : /远程优先|可以远程/u.test(goal) ? 'preferred' : 'any',
    hardConstraints,
    softPreferences
  };
}

export function matchJobsForPlan(plan: CareerSearchPlan, jobs: SyncedJob[]): SyncedJob[] {
  return jobs.filter((job) => {
    const text = `${job.title} ${job.company} ${job.description} ${job.skills.join(' ')}`.toLocaleLowerCase();
    if (plan.keywords.length && !plan.keywords.some((item) => text.includes(item.toLocaleLowerCase()))) return false;
    if (plan.excludeKeywords.some((item) => text.includes(item.toLocaleLowerCase()))) return false;
    if (plan.cities.length && !plan.cities.some((item) => job.location.includes(item))) return false;
    if (plan.jobTypes.length && !plan.jobTypes.some((item) => {
      if (item === '社招') return ['全职', '合同制'].includes(job.employmentType);
      if (item === '校招') return ['校招', '全职'].includes(job.employmentType);
      return job.employmentType.includes(item);
    })) return false;
    if (plan.salaryMinK != null && (job.salaryMaxK ?? 0) < plan.salaryMinK) return false;
    if (plan.salaryMaxK != null && (job.salaryMinK ?? Number.POSITIVE_INFINITY) > plan.salaryMaxK) return false;
    if (plan.remotePreference === 'required' && !job.remote) return false;
    return job.status !== 'ignored' && job.lifecycleStatus !== 'closed';
  }).sort((a, b) => b.matchScore - a.matchScore || b.trustScore - a.trustScore);
}

export interface SkillGraphNode {
  name: string;
  category: 'verified' | 'related' | 'gap';
  evidence: string[];
  demandCount: number;
  readiness: number;
}

export function buildSkillGraph(state: WorkspaceState, targetJobId?: string): SkillGraphNode[] {
  const target = targetJobId ? state.syncedJobs.find((item) => item.id === targetJobId) : undefined;
  const demandJobs = target ? [target] : state.syncedJobs.filter((item) => item.status !== 'ignored' && item.status !== 'trashed' && item.lifecycleStatus !== 'closed');
  const demandedSkills = unique(target
    ? [...target.skills, ...extractJobSkills(`${target.title} ${target.description} ${target.skills.join(' ')}`)]
    : demandJobs.flatMap((item) => item.skills));
  const profileSkills = state.profile.skills.map((item) => item.name);
  const projectSkills = unique(state.projects.flatMap((item) => item.techStack));
  const graphSkills = target ? demandedSkills : unique([...profileSkills, ...projectSkills, ...demandedSkills]);
  return graphSkills.map((name) => {
    const inProfile = profileSkills.some((item) => sameSkill(item, name));
    const evidenceProjects = state.projects.filter((item) => item.techStack.some((skill) => sameSkill(skill, name))).map((item) => item.name);
    const demandCount = target
      ? (demandedSkills.some((skill) => sameSkill(skill, name)) ? 1 : 0)
      : demandJobs.filter((item) => item.skills.some((skill) => sameSkill(skill, name))).length;
    const category: SkillGraphNode['category'] = inProfile && evidenceProjects.length ? 'verified' : inProfile || evidenceProjects.length ? 'related' : 'gap';
    return {
      name,
      category,
      evidence: evidenceProjects,
      demandCount,
      readiness: category === 'verified' ? 100 : category === 'related' ? 65 : 15
    };
  }).sort((a, b) => b.demandCount - a.demandCount || b.readiness - a.readiness);
}

export function buildCareerAnswer(question: string, state: WorkspaceState, runJobIds: string[]): string {
  const jobs = state.syncedJobs.filter((item) => runJobIds.includes(item.id));
  if (!jobs.length) return '当前计划没有命中本地职位。建议先放宽硬性条件，或接入一个真实数据源后重新执行。';
  const top = jobs[0];
  if (/为什么|原因/u.test(question)) return `当前优先推荐 ${top.company || '目标公司'} 的 ${top.title}：匹配度 ${top.matchScore}，可信度 ${top.trustScore}。主要依据是 ${top.matchReasons.slice(0, 2).join('；')}。`;
  if (/下一步|怎么做|准备/u.test(question)) return `建议先为 ${top.title} 生成定向简历，再围绕 ${top.skills.slice(0, 3).join('、') || '核心岗位要求'} 准备项目证据，最后进入岗位面试训练。`;
  if (/优先|哪个|推荐/u.test(question)) return `优先处理 ${top.company || '目标公司'} · ${top.title}，然后依次查看 ${jobs.slice(1, 3).map((item) => item.title).join('、') || '其余匹配岗位'}。`;
  return `本次计划命中 ${jobs.length} 个本地岗位，最高匹配岗位是 ${top.title}。你可以继续询问“为什么推荐”“优先投哪个”或“下一步怎么做”。`;
}
