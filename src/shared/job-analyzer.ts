import { randomUUID } from 'node:crypto';
import type {
  JobDescription,
  JobInput,
  JobRequirement,
  MatchStatus,
  PreparationTask,
  RequirementCategory,
  RequirementPriority,
  WorkspaceState
} from './domain';
import { nowIso } from './domain';

const technologyKeywords = [
  'Kubernetes', 'K8s', 'ACK', 'Docker', 'Linux', 'Nginx', 'Redis', 'MySQL', 'PostgreSQL',
  'Prometheus', 'Grafana', 'Python', 'Java', 'Go', 'Git', 'CI/CD', 'Jenkins', 'RAG', 'Embedding',
  '大模型', 'LLM', 'API', '云计算', '阿里云', 'AWS', 'Azure', '微服务', '网络', 'SQL'
];

const businessKeywords = ['客户', '解决方案', '售前', '交付', '业务', '产品', '成本', '稳定性', 'SLA'];
const softSkillKeywords = ['沟通', '协作', '表达', '学习能力', '责任心', '抗压', '推动'];
const mustMarkers = ['必须', '熟练', '精通', '掌握', '负责', '要求'];
const preferredMarkers = ['优先', '加分', '了解', '熟悉', '有经验'];

function includesIgnoreCase(text: string, keyword: string): boolean {
  return text.toLocaleLowerCase().includes(keyword.toLocaleLowerCase());
}

function inferPriority(line: string): RequirementPriority {
  if (mustMarkers.some((marker) => line.includes(marker))) return 'must';
  if (preferredMarkers.some((marker) => line.includes(marker))) return 'preferred';
  return 'context';
}

function inferCategory(keyword: string): RequirementCategory {
  if (technologyKeywords.includes(keyword)) return 'technology';
  if (businessKeywords.includes(keyword)) return 'business';
  if (softSkillKeywords.includes(keyword)) return 'soft-skill';
  return 'experience';
}

function collectEvidence(state: WorkspaceState, keyword: string): { ids: string[]; summary: string; status: MatchStatus } {
  const ids: string[] = [];
  const summaries: string[] = [];
  const skill = state.profile.skills.find((item) => includesIgnoreCase(item.name, keyword));
  if (skill) summaries.push(`技能档案：${skill.name}（${skill.level}）`);

  for (const project of state.projects) {
    const haystack = [
      project.name,
      project.background,
      project.architecture,
      project.responsibilities,
      project.actions,
      project.challenges,
      project.results,
      ...project.techStack
    ].join(' ');
    if (includesIgnoreCase(haystack, keyword)) {
      ids.push(project.id);
      summaries.push(`项目：${project.name}`);
    }
  }

  for (const item of state.knowledge) {
    const haystack = [item.title, item.contentMarkdown, ...item.tags].join(' ');
    if (includesIgnoreCase(haystack, keyword)) {
      ids.push(item.id);
      summaries.push(`知识：${item.title}`);
    }
  }

  const uniqueIds = [...new Set(ids)];
  if (skill && uniqueIds.length > 0) return { ids: uniqueIds, summary: summaries.slice(0, 3).join('；'), status: 'evidenced' };
  if (skill || uniqueIds.length > 0) return { ids: uniqueIds, summary: summaries.slice(0, 3).join('；'), status: 'related' };
  return { ids: [], summary: '职业档案中尚未找到直接证据', status: 'gap' };
}

function linesContaining(text: string, keyword: string): string[] {
  return text
    .split(/[\r\n。；;]/)
    .map((line) => line.trim())
    .filter((line) => line && includesIgnoreCase(line, keyword));
}

export function analyzeJob(input: JobInput, state: WorkspaceState): JobDescription {
  const now = nowIso();
  const allKeywords = [...technologyKeywords, ...businessKeywords, ...softSkillKeywords];
  const found = allKeywords.filter((keyword) => includesIgnoreCase(input.rawText, keyword));

  const requirements: JobRequirement[] = found.slice(0, 24).map((keyword) => {
    const lines = linesContaining(input.rawText, keyword);
    const context = lines[0] ?? keyword;
    const evidence = collectEvidence(state, keyword);
    return {
      id: randomUUID(),
      label: keyword,
      category: inferCategory(keyword),
      priority: inferPriority(context),
      matchStatus: evidence.status,
      evidenceIds: evidence.ids,
      evidenceSummary: evidence.summary
    };
  });

  if (requirements.length === 0) {
    requirements.push({
      id: randomUUID(),
      label: '岗位职责与相关经验',
      category: 'experience',
      priority: 'must',
      matchStatus: state.projects.length ? 'related' : 'missing-evidence',
      evidenceIds: state.projects.map((project) => project.id),
      evidenceSummary: state.projects.length ? '可从已有项目中补充对应证据' : '尚未录入项目经历'
    });
  }

  const tasks: PreparationTask[] = requirements.map((requirement) => ({
    id: randomUUID(),
    title:
      requirement.matchStatus === 'evidenced'
        ? `复习并压缩 ${requirement.label} 的项目表达`
        : requirement.matchStatus === 'related'
          ? `补充 ${requirement.label} 的具体证据和结果`
          : `学习并建立 ${requirement.label} 的基础知识卡片`,
    bucket:
      requirement.priority === 'must' && requirement.matchStatus !== 'evidenced'
        ? 'now'
        : requirement.matchStatus === 'evidenced'
          ? 'before-interview'
          : 'short-term',
    completed: false
  }));

  return {
    id: randomUUID(),
    title: input.title,
    company: input.company ?? '',
    rawText: input.rawText,
    requirements,
    tasks,
    createdAt: now,
    updatedAt: now
  };
}

