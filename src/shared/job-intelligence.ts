import type { CareerProfile, JobFilterPreset, JobIndustry, JobMatchDimensions, SyncedJobInput } from './domain';

export interface JobIntelligenceResult {
  industry: JobIndustry;
  employmentType: string;
  education: string;
  experience: string;
  skills: string[];
  salaryMinK?: number;
  salaryMaxK?: number;
  remote: boolean;
  matchScore: number;
  matchDimensions: JobMatchDimensions;
  matchReasons: string[];
  trustScore: number;
  riskFlags: string[];
  biasFlags: string[];
  qualityScore: number;
}

const industryRules: Array<{ industry: JobIndustry; keywords: string[] }> = [
  { industry: 'technology', keywords: ['开发', '软件', '算法', '前端', '后端', '测试', 'Java', 'Python', 'Golang', 'AI', '数据工程', '云原生', '大模型'] },
  { industry: 'operations', keywords: ['运维', 'SRE', 'DevOps', '技术支持', '实施', '交付', '网络工程', '数据库管理员', 'Linux', 'Docker'] },
  { industry: 'product', keywords: ['产品经理', '产品运营', '用户研究', '需求分析', 'SaaS', 'B端'] },
  { industry: 'design', keywords: ['设计', '视觉', 'UI', 'UX', '交互', '剪辑', '动画', 'AIGC'] },
  { industry: 'sales', keywords: ['销售', '客户经理', '商务拓展', '渠道', 'BD', '大客户'] },
  { industry: 'marketing', keywords: ['市场', '品牌', '新媒体', '内容运营', '广告', '增长'] },
  { industry: 'finance', keywords: ['财务', '会计', '审计', '投研', '证券', '风控', '银行'] },
  { industry: 'human-resources', keywords: ['人力资源', '招聘', 'HR', '薪酬', '组织发展'] },
  { industry: 'legal', keywords: ['法务', '律师', '合规', '知识产权'] },
  { industry: 'healthcare', keywords: ['医疗', '医药', '临床', '护理', '生物', '药品'] },
  { industry: 'education', keywords: ['教师', '教研', '教育', '课程顾问', '培训讲师', '幼儿园', '幼师', '保育'] },
  { industry: 'manufacturing', keywords: ['制造', '机械', '电气', '工艺', '供应链', '物流', '质量工程'] }
];

const skillDictionary = [
  'Kubernetes', 'K8s', 'Docker', 'Linux', 'Nginx', 'Redis', 'MySQL', 'PostgreSQL', 'RDS', 'ACK', 'AWS', 'Azure',
  'Java', 'Python', 'JavaScript', 'TypeScript', 'Go', 'Golang', 'C++', 'React', 'Vue', 'Node.js', 'Spring Boot', 'SQL',
  'CI/CD', 'Jenkins', 'Git', 'Prometheus', 'Grafana', 'Shell', 'TCP/IP', 'HTTP', 'Traefik', 'Consul',
  'Figma', 'Photoshop', 'Illustrator', 'After Effects', 'Premiere', 'AIGC',
  'Excel', 'Power BI', 'Tableau', 'SEO', 'SEM', 'CRM', 'ERP', 'SAP', 'CAD', 'PLC',
  '课程设计', '教研', '幼儿教育', '班级管理', '家校沟通', '活动策划'
];

const riskRules: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /押金|保证金|入职费|培训费|服装费|先交费/u, label: '疑似要求付费' },
  { pattern: /轻松月入|日结高薪|无需经验.*高薪|躺赚|稳赚/u, label: '夸大收益表述' },
  { pattern: /加微信|私人微信|qq联系|联系个人手机/u, label: '要求转至私人联系方式' },
  { pattern: /不限学历.*不限经验.*高薪/u, label: '岗位门槛与薪资描述异常' },
  { pattern: /刷单|代购返利|资金盘/u, label: '高风险业务关键词' }
];

const biasRules: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /仅限男性|限男性|男性优先|只招男性/u, label: '性别限制' },
  { pattern: /仅限女性|限女性|女性优先|只招女性/u, label: '性别倾向' },
  { pattern: /年龄.{0,4}(?:以下|以内)|(?:18|20|25|30|35)岁以下/u, label: '年龄限制' },
  { pattern: /未婚|已婚已育|婚育情况/u, label: '婚育要求' },
  { pattern: /形象气质佳|五官端正|身高.{0,6}以上/u, label: '外貌要求' },
  { pattern: /985|211|双一流/u, label: '院校层级偏好' }
];

function normalized(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function detectJobIndustry(text: string): JobIndustry {
  const value = normalized(text);
  let selected: { industry: JobIndustry; score: number } = { industry: 'general', score: 0 };
  for (const rule of industryRules) {
    const score = rule.keywords.filter((keyword) => value.includes(normalized(keyword))).length;
    if (score > selected.score) selected = { industry: rule.industry, score };
  }
  return selected.industry;
}

export function extractJobSkills(text: string): string[] {
  const value = normalized(text);
  return unique(skillDictionary.filter((skill) => value.includes(normalized(skill)))).slice(0, 20);
}

export function parseSalaryRange(value: string): { min?: number; max?: number } {
  const text = normalized(value).replace(/,/g, '');
  const range = text.match(/(\d+(?:\.\d+)?)\s*(k|千|万)?\s*[-~至]\s*(\d+(?:\.\d+)?)\s*(k|千|万)?/u);
  if (!range) return {};
  let min = Number(range[1]);
  let max = Number(range[3]);
  const unit = range[4] ?? range[2] ?? '';
  if (unit === '万') {
    const annual = /年薪|\/年|每年/u.test(text);
    min = annual ? min * 10 / 12 : min * 10;
    max = annual ? max * 10 / 12 : max * 10;
  }
  if (/\/天|每天|元\/日|元\/天/u.test(text)) {
    min = min * 21.75 / 1000;
    max = max * 21.75 / 1000;
  } else if (/元\/月|元每月/u.test(text)) {
    min /= 1000;
    max /= 1000;
  }
  if (!unit && !/元/u.test(text)) return {};
  return { min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 };
}

function detectEducation(text: string): string {
  if (/博士/u.test(text)) return '博士';
  if (/硕士|研究生/u.test(text)) return '硕士';
  if (/本科/u.test(text)) return '本科';
  if (/大专|专科/u.test(text)) return '大专';
  if (/中专|高中/u.test(text)) return '中专/高中';
  if (/学历不限|不限学历/u.test(text)) return '不限';
  return '';
}

function detectExperience(text: string): string {
  const range = text.match(/(\d+)\s*[-~至]\s*(\d+)\s*年/u);
  if (range) return `${range[1]}-${range[2]}年`;
  const single = text.match(/(\d+)\s*年(?:以上)?(?:工作)?经验/u);
  if (single) return `${single[1]}年${text.includes('以上') ? '以上' : ''}`;
  if (/应届|校招|在校生/u.test(text)) return '应届/在校';
  if (/经验不限|不限经验/u.test(text)) return '不限';
  return '';
}

function detectEmploymentType(text: string): string {
  if (/实习/u.test(text)) return '实习';
  if (/兼职/u.test(text)) return '兼职';
  if (/合同工|劳务派遣/u.test(text)) return '合同制';
  if (/校招|应届/u.test(text)) return '校招';
  return '全职';
}

function calculateTrust(input: SyncedJobInput, text: string): { score: number; flags: string[] } {
  let score = 100;
  const flags: string[] = [];
  if (!input.company?.trim()) { score -= 20; flags.push('公司信息缺失'); }
  if (!input.description?.trim() || input.description.trim().length < 60) { score -= 15; flags.push('岗位描述不完整'); }
  if (!input.location?.trim()) { score -= 3; flags.push('工作地址缺失'); }
  if (!input.salaryRange?.trim()) score -= 4;
  if (!input.postedAt) flags.push('发布时间未识别');
  for (const rule of riskRules) {
    if (rule.pattern.test(text)) { score -= 24; flags.push(rule.label); }
  }
  try {
    if (new URL(input.sourceUrl).protocol !== 'https:') { score -= 8; flags.push('来源链接非 HTTPS'); }
  } catch {
    score -= 20;
    flags.push('来源链接异常');
  }
  return { score: Math.max(0, score), flags: unique(flags) };
}

function educationScore(profileEducation: string, requirement: string): number {
  if (!requirement || requirement === '不限') return 80;
  const ranks = ['不限', '中专/高中', '大专', '本科', '硕士', '博士'];
  const profileRank = ranks.findIndex((item) => profileEducation.includes(item));
  const requiredRank = ranks.indexOf(requirement);
  if (profileRank < 0) return 50;
  return profileRank >= requiredRank ? 100 : Math.max(20, 70 - (requiredRank - profileRank) * 25);
}

function experienceScore(years: number, requirement: string): number {
  if (!requirement || requirement === '不限' || requirement === '应届/在校') return 80;
  const minimum = Number(requirement.match(/\d+/u)?.[0] ?? 0);
  if (!minimum) return 60;
  if (years >= minimum) return 100;
  return Math.max(20, Math.round(years / minimum * 100));
}

function calculateProfileMatch(
  profile: CareerProfile,
  title: string,
  text: string,
  skills: string[],
  context: { education: string; experience: string; salaryKnown: boolean; locationKnown: boolean; postedAt?: string }
): { score: number; dimensions: JobMatchDimensions; reasons: string[] } {
  const haystack = normalized(`${title} ${text}`);
  const roleCandidates = unique([profile.currentRole, ...profile.targetRoles]);
  const targetHits = roleCandidates.filter((role) => normalized(role).split(/[\s/·_-]+/u).filter((item) => item.length >= 2).some((token) => haystack.includes(token)));
  const profileSkills = profile.skills.map((item) => item.name);
  const matchedSkills = profileSkills.filter((skill) => haystack.includes(normalized(skill)) || skills.some((item) => normalized(item) === normalized(skill)));
  const freshnessDays = context.postedAt ? Math.max(0, (Date.now() - new Date(context.postedAt).getTime()) / 86_400_000) : 60;
  const dimensions: JobMatchDimensions = {
    role: roleCandidates.length ? (targetHits.length ? 100 : 20) : 60,
    skills: profileSkills.length ? Math.round(matchedSkills.length / profileSkills.length * 100) : 60,
    experience: experienceScore(profile.yearsExperience, context.experience),
    education: educationScore(profile.education, context.education),
    location: context.locationKnown ? 70 : 45,
    salary: context.salaryKnown ? 70 : 45,
    freshness: freshnessDays <= 7 ? 100 : freshnessDays <= 30 ? 80 : freshnessDays <= 90 ? 55 : 25
  };
  const score = Math.round(dimensions.role * 0.25 + dimensions.skills * 0.3 + dimensions.experience * 0.12 + dimensions.education * 0.08 + dimensions.location * 0.08 + dimensions.salary * 0.07 + dimensions.freshness * 0.1);
  const reasons: string[] = [];
  if (targetHits.length) reasons.push(`目标方向命中：${targetHits.slice(0, 2).join('、')}`);
  if (matchedSkills.length) reasons.push(`已有技能命中：${matchedSkills.slice(0, 4).join('、')}`);
  const missing = skills.filter((skill) => !matchedSkills.some((item) => normalized(item) === normalized(skill)));
  if (missing.length) reasons.push(`建议补证据：${missing.slice(0, 3).join('、')}`);
  if (!reasons.length) reasons.push('职业档案信息较少，建议补充目标岗位与技能');
  return { score, dimensions, reasons };
}

export function analyzeSyncedJob(input: SyncedJobInput, profile: CareerProfile): JobIntelligenceResult {
  const text = `${input.title} ${input.company ?? ''} ${input.location ?? ''} ${input.salaryRange ?? ''} ${input.description ?? ''}`;
  const skills = extractJobSkills(text);
  const salary = parseSalaryRange(input.salaryRange ?? '');
  const education = detectEducation(text);
  const experience = detectExperience(text);
  const trust = calculateTrust(input, text);
  const biasFlags = biasRules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.label);
  const match = calculateProfileMatch(profile, input.title, input.description ?? '', skills, {
    education,
    experience,
    salaryKnown: salary.min != null,
    locationKnown: Boolean(input.location?.trim()),
    postedAt: input.postedAt
  });
  const qualitySignals = [input.title, input.company, input.location, input.salaryRange, input.description, input.postedAt];
  return {
    industry: detectJobIndustry(text),
    employmentType: detectEmploymentType(text),
    education,
    experience,
    skills,
    salaryMinK: salary.min,
    salaryMaxK: salary.max,
    remote: /远程|居家办公|remote/u.test(text),
    matchScore: match.score,
    matchDimensions: match.dimensions,
    matchReasons: match.reasons,
    trustScore: Math.max(0, trust.score - Math.min(24, biasFlags.length * 8)),
    riskFlags: trust.flags,
    biasFlags,
    qualityScore: Math.round(qualitySignals.filter(Boolean).length / qualitySignals.length * 100)
  };
}

export function jobMatchesPreset(job: {
  title: string; company: string; description: string; location: string; sourceSite: string; industry: JobIndustry;
  salaryMinK?: number; matchScore: number; trustScore: number; remote: boolean; postedAt?: string; capturedAt: string;
}, preset: JobFilterPreset): boolean {
  const text = normalized(`${job.title} ${job.company} ${job.description}`);
  if (preset.includeKeywords.length && !preset.includeKeywords.some((item) => text.includes(normalized(item)))) return false;
  if (preset.excludeKeywords.some((item) => text.includes(normalized(item)))) return false;
  if (preset.cities.length && !preset.cities.some((item) => normalized(job.location).includes(normalized(item)))) return false;
  if (preset.industries.length && !preset.industries.includes(job.industry)) return false;
  if (preset.sources.length && !preset.sources.includes(job.sourceSite)) return false;
  if (preset.minSalaryK != null && (job.salaryMinK ?? 0) < preset.minSalaryK) return false;
  if (job.matchScore < preset.minMatchScore || job.trustScore < preset.minTrustScore) return false;
  if (preset.remoteOnly && !job.remote) return false;
  const reference = new Date(job.postedAt ?? job.capturedAt).getTime();
  if (preset.freshWithinDays > 0 && Date.now() - reference > preset.freshWithinDays * 86_400_000) return false;
  return true;
}

export interface GreetingResumeContext {
  name: string;
  headline?: string;
  summary?: string;
  highlights?: string[];
  projectNames?: string[];
  skillNames?: string[];
}

export function buildGreetingDraft(
  profile: CareerProfile,
  job: { title: string; company?: string; description?: string; skills?: string[] },
  resume?: GreetingResumeContext
): string {
  const jobText = normalized(`${job.title} ${job.description ?? ''}`);
  const availableSkills = unique([...profile.skills.map((item) => item.name), ...(resume?.skillNames ?? [])]);
  const matchedSkills = availableSkills.filter((skill) => jobText.includes(normalized(skill)) || job.skills?.some((item) => normalized(item) === normalized(skill)));
  const direction = profile.currentRole || profile.targetRoles[0] || '相关岗位';
  const skillEvidence = matchedSkills.length ? `，具备 ${matchedSkills.slice(0, 3).join('、')} 的实践基础` : '';
  const company = job.company?.trim() ? `贵司 ${job.company.trim()} 的` : '';
  if (!resume) {
    return `您好，我关注到${company}${job.title}岗位。我目前的职业方向是${direction}${skillEvidence}，希望进一步了解岗位重点和团队情况。`;
  }
  const resumeEvidence = resume.highlights?.find(Boolean)
    || resume.projectNames?.slice(0, 2).join('、')
    || resume.summary?.trim()
    || resume.headline?.trim();
  const evidenceText = resumeEvidence ? `，其中重点呈现了${resumeEvidence.slice(0, 80)}` : '';
  return `您好，我关注到${company}${job.title}岗位。我目前的职业方向是${direction}${skillEvidence}${evidenceText}。如果方便，希望进一步沟通岗位职责、匹配点和团队情况。`;
}
