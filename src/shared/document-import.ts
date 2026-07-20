import path from 'node:path';
import type {
  DocumentImportResult,
  DocumentImportTarget,
  DocumentRecognitionMode,
  KnowledgeType,
  ProjectInput,
  SkillLevel
} from './domain';

const MAX_EXTRACTED_TEXT = 100_000;
const TECHNOLOGIES = [
  'Kubernetes', 'Docker', 'Linux', 'ACK', 'ACR', 'ECS', 'RDS', 'OSS', 'Nginx',
  'Redis', 'MySQL', 'PostgreSQL', 'Prometheus', 'Grafana', 'Jenkins', 'GitHub',
  'Python', 'Java', 'JavaScript', 'Go', 'Spring', 'Spring Boot', 'MyBatis', 'Maven',
  'Hadoop', 'Tomcat', 'Vue', 'React', 'Node.js', 'RAG',
  'Embedding', '大模型 API', 'OpenAI', 'Dify', 'Postman', 'Fiddler', 'Pytest',
  'Requests', 'Shell', 'Git', 'ADB', 'SQL', 'K8s', 'AI', 'Eclipse', 'MyEclipse',
  'IntelliJ IDEA', 'Android Studio', 'Visual Studio', 'Xcode', 'SVN'
];

const PROJECT_SECTION = /^(?:#{1,6}\s*)?(?:(?:[\u3400-\u9fffA-Za-z]{0,8})项目(?:经历|经验)|代表项目|PROJECT EXPERIENCE|PROJECTS)\s*[:：]?\s*$/i;
const PROJECT_SECTION_WITH_REMAINDER = /^(?:#{1,6}\s*)?(?:(?:[\u3400-\u9fffA-Za-z]{0,8})项目(?:经历|经验)|代表项目|PROJECT EXPERIENCE|PROJECTS)\s*[:：]?\s*(.*)$/i;
const RESUME_SECTION = /^(?:#{1,6}\s*)?(?:基本信息|个人信息|求职意向|工作经历|工作经验|实习经历|校园经历|社团组织经历|社会实践|教育背景|教育经历|学习经历|专业技能|技能清单|个人技能|资质证书|证书|证书资质|自我介绍|个人评价|BASIC INFORMATION|PROFILE|WORK EXPERIENCE|INTERNSHIPS?|EDUCATION|SKILLS|CERTIFICATIONS?|SUMMARY)\s*[:：]?\s*$/i;
const FIELD_SEPARATOR = '(?:[:：][\\t \\u3000]*|[\\t\\u3000]+| {2,})';
const PROJECT_START = new RegExp(`^(?:[-*•]\\s*)?(?:项目名称|Project Name|项目[一二三四五六七八九十\\d]+)\\s*${FIELD_SEPARATOR}(.+)$`, 'i');
const DATED_ENTRY = /^(?:[-*•]\s*)?(?:(?:19|20)\d{2}[./年-]\d{1,2})\s*[-~～–—至到]+\s*(?:(?:19|20)\d{2}[./年-]\d{1,2}|至今|现在)\s+(.{2,120})$/i;
const ENGLISH_DATED_ENTRY = /^(?:[-*•]\s*)?(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:19|20)\d{2}\s*[-–—~]\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:19|20)\d{2}|Present|Current)\s+(.{2,120})$/i;
const FIELD_LINE = new RegExp(`^(?:[-*•]\\s*|\\d+[.、)）]\\s*)?(项目角色|担任角色|我的角色|角色|Role|项目背景|项目描述|项目简介|项目概述|项目介绍|项目内容|业务描述|背景|Description|项目目标|目标|Objective|技术架构|系统架构|项目架构|架构|技术描述|Architecture|我的职责|个人职责|项目职责|工作职责|主要职责|责任描述|职责|Responsibilities?|主要工作|具体工作|实施内容|行动|Actions?|难点|问题难点|项目难点|技术难点|挑战|Challenges?|工作成果|项目成果|项目结果|项目业绩|成果描述|成果|结果|Results?|技术栈|技术环境|开发环境|运行环境|开发工具|Technologies|Tech Stack)\\s*${FIELD_SEPARATOR}(.*)$`, 'i');
const FIELD_LABEL_ONLY = /^(?:项目角色|担任角色|我的角色|角色|Role|项目背景|项目描述|项目简介|项目概述|项目介绍|项目内容|业务描述|背景|Description|项目目标|目标|Objective|技术架构|系统架构|项目架构|架构|技术描述|Architecture|我的职责|个人职责|项目职责|工作职责|主要职责|责任描述|职责|Responsibilities?|主要工作|具体工作|实施内容|行动|Actions?|难点|问题难点|项目难点|技术难点|挑战|Challenges?|工作成果|项目成果|项目结果|项目业绩|成果描述|成果|结果|Results?|技术栈|技术环境|开发环境|运行环境|开发工具|Technologies|Tech Stack)\s*$/i;
const PROJECT_DETAIL_START = new RegExp(`^(?:[-*•]\\s*)?(?:项目背景|项目描述|项目简介|项目概述|项目介绍|Project Description|Project Background)\\s*${FIELD_SEPARATOR}`, 'i');
const STANDALONE_PROJECT_ENVIRONMENT = /^(?=.{2,100}$)(?=.*(?:Eclipse|MyEclipse|IntelliJ IDEA|IDEA|Android Studio|Visual Studio(?: Code)?|Xcode|HBuilder|Unity|MATLAB|开发工具|开发环境))(?!.*[。；;])(?:[\w.+#-]+|[\u3400-\u9fff]+)(?:\s*[,，、/+｜|]\s*(?:[\w.+#-]+|[\u3400-\u9fff]+))*$/i;
const INLINE_LABELS = [
  '姓名', '昵称', '工作年限', '经验年限', '学历', '最高学历', '专业', '意向岗位', '目标岗位',
  '求职意向', '求职目标', '期望职位', '目标职能', '到岗时间', '当前状态', '当前岗位', '当前职位', '现任职位', '职位名称', '职位',
  '公司名称', '招聘公司', '岗位名称', '项目名称', '项目角色', '担任角色', '我的角色', '项目背景',
  '项目描述', '项目简介', '项目概述', '项目介绍', '项目内容', '项目目标', '技术架构', '系统架构',
  '项目架构', '技术描述', '我的职责', '个人职责', '项目职责', '工作职责', '主要职责', '责任描述',
  '主要工作', '具体工作', '问题难点', '项目难点', '技术难点', '工作成果', '项目成果', '项目结果',
  '项目业绩', '成果描述', '技术栈', '技术环境', '开发环境', '运行环境', '开发工具'
];

function normalizeText(value: string): string {
  let normalized = value.replace(/\r\n/g, '\n').replace(/\0/g, '');
  for (const label of INLINE_LABELS) {
    const flexible = [...label]
      .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\t \\u3000]*');
    normalized = normalized.replace(new RegExp(`${flexible}[\\t \\u3000]*[:：]`, 'gi'), `${label}：`);
    normalized = normalized.replace(new RegExp(`${flexible}(?:[\\u3000]*\\t+|\\u3000+| {2,})`, 'gi'), `${label}：`);
  }
  const compactLabels = INLINE_LABELS
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((left, right) => right.length - left.length)
    .join('|');
  normalized = normalized.split('\n').map((line) => {
    return line.replace(new RegExp(`[\\t \\u3000]+(?=(?:${compactLabels})[:：])`, 'gi'), '\n');
  }).join('\n');
  return normalized.trim();
}

function projectSectionRemainder(line: string): string | null {
  const match = line.trim().match(PROJECT_SECTION_WITH_REMAINDER);
  return match ? match[1].trim() : null;
}

function firstMatch(text: string, labels: string[]): string {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = text.match(new RegExp(`(?:^|\\n)[\\t \\u3000]*(?:${escaped})[\\t \\u3000]*[:：][\\t \\u3000]*([^\\n]{1,160})`, 'i'));
  return match?.[1]?.trim() ?? '';
}

function fileTitle(fileName: string): string {
  return path.basename(fileName, path.extname(fileName)).replace(/[_-]+/g, ' ').trim() || '导入内容';
}

function firstMeaningfulLine(text: string): string {
  return text.split('\n').map((line) => line.replace(/^#+\s*/, '').trim()).find((line) => {
    return line.length >= 2 && line.length <= 80 && !/^(岗位职责|任职要求|职位描述|工作内容|关于我们)$/i.test(line);
  }) ?? '';
}

function splitValues(value: string): string[] {
  return value.split(/[，、,；;/]/).map((item) => item.trim()).filter(Boolean);
}

function detectTags(text: string): string[] {
  const lower = text.toLocaleLowerCase();
  return TECHNOLOGIES.filter((technology) => lower.includes(technology.toLocaleLowerCase())).slice(0, 20);
}

function inferCurrentRole(text: string): string {
  const explicit = firstMatch(text, ['当前岗位', '当前职位', '现任职位', '职位名称', '职位']);
  if (explicit) return explicit;
  const workLine = text.split('\n').find((line) => {
    return /(?:19|20)\d{2}[./年-]\d{1,2}/.test(line)
      && /(工程师|专员|经理|主管|顾问|设计师|开发|测试|运维)/.test(line);
  });
  const role = workLine?.match(/([\u3400-\u9fffA-Za-z/.+#-]{2,30}(?:工程师|专员|经理|主管|顾问|设计师|开发|测试|运维))/)?.[1];
  return role?.trim() ?? '';
}

function inferNickname(text: string): string {
  const explicit = firstMatch(text, ['姓名', '昵称', 'Name']);
  if (explicit) return explicit;
  const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  const candidate = firstLine.match(/^([\u3400-\u9fff]{2,4})(?:\s|$)/)?.[1] ?? '';
  return /^(个人简历|求职简历|简历)$/.test(candidate) ? '' : candidate;
}

function inferEducation(text: string): string {
  const explicit = firstMatch(text, ['最高学历', '学历', 'Education']);
  if (explicit) return explicit;
  if (/博士|Ph\.?D/i.test(text)) return '博士';
  if (/硕士|研究生|Master/i.test(text)) return '硕士';
  if (/本科|学士|Bachelor/i.test(text)) return '本科';
  if (/大专|专科/.test(text)) return '大专';
  return '';
}

function detectKnowledgeType(fileName: string, text: string): KnowledgeType {
  const combined = `${fileName}\n${text.slice(0, 1_000)}`;
  if (/故障|异常|报错|排查|incident/i.test(combined)) return 'incident';
  if (/面试|问题|question/i.test(combined)) return 'question';
  if (/项目|project/i.test(combined)) return 'project';
  return 'technical';
}

function mapSkills(text: string): Array<{ name: string; level: SkillLevel }> {
  const explicit = firstMatch(text, ['技能与程度', '专业技能', '技能', '技术栈']);
  const levels: SkillLevel[] = ['了解', '熟悉', '掌握', '精通'];
  const parsed = splitValues(explicit).map((entry) => {
    const [name, rawLevel] = entry.split(/[:：]/).map((item) => item.trim());
    const level = levels.includes(rawLevel as SkillLevel) ? rawLevel as SkillLevel : '熟悉';
    return { name, level };
  }).filter((item) => item.name);
  if (parsed.length) return parsed.slice(0, 30);
  return detectTags(text).map((name) => ({ name, level: '熟悉' as const }));
}

function extractProjectSection(text: string): string[] {
  const lines = text.split('\n');
  const headingIndex = lines.findIndex((line) => projectSectionRemainder(line) !== null);
  if (headingIndex < 0) {
    const firstProjectIndex = lines.findIndex((line) => {
      return PROJECT_START.test(line.trim()) || PROJECT_DETAIL_START.test(line.trim());
    });
    return firstProjectIndex >= 0 ? lines.slice(firstProjectIndex) : [];
  }
  const remainder = projectSectionRemainder(lines[headingIndex]);
  const section: string[] = remainder ? [remainder] : [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (section.some((item) => item.trim()) && RESUME_SECTION.test(line.trim())) break;
    section.push(line);
  }
  return section;
}

function isLikelyProjectHeading(line: string): boolean {
  const value = line.replace(/^#{1,6}\s*/, '').trim();
  if (!value || value.length > 120 || FIELD_LINE.test(value) || RESUME_SECTION.test(value)) return false;
  if (/^(?:[-*•]\s*)?(?:\d{4}[./年-]\d{1,2}|\d{4}\s*[-–—至到]\s*\d{4})/.test(value)) return false;
  if (/参与|负责|使用|实现|完成|进行|开发环境|技术描述|责任描述/.test(value)) return false;
  return /^#{2,6}\s+/.test(line.trim()) || (/项目|平台|系统|网站|应用|Project/i.test(value) && value.length <= 70 && !/[，,。；;]$/.test(value));
}

function splitProjectBlocks(lines: string[]): Array<{ name: string; lines: string[] }> {
  const blocks: Array<{ name: string; lines: string[] }> = [];
  const hasExplicitProjectStarts = lines.some((line) => PROJECT_START.test(line.trim()));
  let current: { name: string; lines: string[] } | undefined;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const explicit = line.match(PROJECT_START);
    const dated = explicit ? null : (line.match(DATED_ENTRY) ?? line.match(ENGLISH_DATED_ENTRY));
    const heading = !explicit && !dated && !hasExplicitProjectStarts && isLikelyProjectHeading(rawLine) ? rawLine.replace(/^#{1,6}\s*/, '').trim() : '';
    if (explicit || dated || heading) {
      if (current && (current.name || current.lines.some((item) => item.trim()))) blocks.push(current);
      current = { name: (explicit?.[1] ?? dated?.[1] ?? heading).trim(), lines: [] };
      continue;
    }
    if (!current && line) current = { name: '', lines: [] };
    if (current) current.lines.push(rawLine);
  }
  if (current && (current.name || current.lines.some((item) => item.trim()))) blocks.push(current);
  return blocks.filter((block) => block.name || block.lines.join('').trim());
}

function splitAnonymousProjectBlocks(lines: string[]): Array<{ name: string; lines: string[] }> {
  const markerIndexes = lines.flatMap((rawLine, index) => {
    return STANDALONE_PROJECT_ENVIRONMENT.test(rawLine.trim()) ? [index] : [];
  });
  if (markerIndexes.length < 2) return [];

  return markerIndexes.map((start, index) => {
    const end = markerIndexes[index + 1] ?? lines.length;
    return {
      name: `简历项目 ${index + 1}（待命名）`,
      lines: lines.slice(start, end)
    };
  }).filter((block) => block.lines.some((line) => line.trim()));
}

function cleanProjectName(value: string): string {
  return value
    .replace(/^[-*•\d.、)）\s]+/, '')
    .replace(/^(?:(?:19|20)\d{2}[./年-]\d{1,2})\s*[-~～–—至到]+\s*(?:(?:19|20)\d{2}[./年-]\d{1,2}|至今|现在)\s+/, '')
    .replace(/[（(]\s*(?:19|20)\d{2}[./年\s-].*?[）)]\s*$/, '')
    .replace(/\s*[|｜]\s*(?:19|20)\d{2}.*$/, '')
    .trim();
}

function extractProjectNames(lines: string[]): string[] {
  const names: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/^#{1,6}\s*/, '').trim();
    const explicit = line.match(PROJECT_START);
    const dated = line.match(DATED_ENTRY) ?? line.match(ENGLISH_DATED_ENTRY);
    const candidate = explicit?.[1] ?? dated?.[1] ?? (isLikelyProjectHeading(rawLine) ? line : '');
    const cleaned = cleanProjectName(candidate);
    if (cleaned && !names.some((name) => name.toLocaleLowerCase() === cleaned.toLocaleLowerCase())) names.push(cleaned);
  }
  return names.slice(0, 20);
}

function splitDetailedProjectBlocks(text: string, names: string[]): Array<{ name: string; lines: string[] }> {
  const blocks: Array<{ name: string; lines: string[] }> = [];
  let current: string[] | undefined;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (PROJECT_DETAIL_START.test(line)) {
      if (current?.length) blocks.push({ name: names[blocks.length] ?? '', lines: current });
      current = [rawLine];
      continue;
    }
    if (!current) continue;
    if (RESUME_SECTION.test(line) || PROJECT_SECTION.test(line)) {
      if (current.length) blocks.push({ name: names[blocks.length] ?? '', lines: current });
      current = undefined;
      continue;
    }
    current.push(rawLine);
  }
  if (current?.length) blocks.push({ name: names[blocks.length] ?? '', lines: current });
  return blocks;
}

function canonicalField(label: string): keyof ProjectInput | 'techStack' {
  if (/角色|Role/i.test(label)) return 'role';
  if (/项目背景|项目描述|项目简介|项目概述|项目介绍|项目内容|业务描述|^背景$|Description/i.test(label)) return 'background';
  if (/目标|Objective/i.test(label)) return 'objective';
  if (/架构|技术描述|Architecture/i.test(label)) return 'architecture';
  if (/职责|责任描述|Responsibilities/i.test(label)) return 'responsibilities';
  if (/主要工作|具体工作|实施内容|行动|Actions/i.test(label)) return 'actions';
  if (/难点|挑战|Challenges/i.test(label)) return 'challenges';
  if (/成果|结果|Results/i.test(label)) return 'results';
  return 'techStack';
}

function parseProjectBlock(block: { name: string; lines: string[] }, index: number): ProjectInput {
  const fields: Partial<Record<keyof ProjectInput | 'techStack', string>> = {};
  let activeField: keyof ProjectInput | 'techStack' | undefined;
  const unlabelled: string[] = [];
  for (const rawLine of block.lines) {
    const line = rawLine.trim().replace(/^[-*•]\s*/, '');
    if (!line) continue;
    const match = line.match(FIELD_LINE);
    if (match) {
      activeField = canonicalField(match[1]);
      fields[activeField] = match[2].trim();
      continue;
    }
    if (FIELD_LABEL_ONLY.test(line)) {
      activeField = canonicalField(line);
      fields[activeField] ??= '';
      continue;
    }
    if (activeField) fields[activeField] = [fields[activeField], line].filter(Boolean).join('\n');
    else unlabelled.push(line);
  }

  const source = block.lines.join('\n').trim();
  const fallbackName = unlabelled.shift() || `简历项目 ${index + 1}（待命名）`;
  const summary = unlabelled.join('\n');
  const techSource = source;
  const explicitTech = fields.techStack ? splitValues(fields.techStack) : [];
  const derivedResults = source.split(/\n|(?<=[。；;])/)
    .map((line) => line.replace(/^\d+[.、)）]\s*/, '').trim())
    .filter((line) => /(上线|交付|完成|解决|恢复|提升|降低|减少|节省|稳定|故障|准确率|覆盖|效率|按时|成果)/.test(line))
    .slice(-3)
    .join('\n');
  const cleanProjectText = (value: string): string => value
    .split('\n')
    .filter((line) => !/^(?:CET[-\s]?\d|.*(?:资格|技能|职业)证书)/i.test(line.trim()))
    .join('\n')
    .replace(/(?<=[\u3400-\u9fffA-Za-z])\n(?=[\u3400-\u9fff，。；])/g, '')
    .trim();
  return {
    name: cleanProjectName(block.name || fallbackName),
    role: fields.role || '简历未单独列出角色，待补充',
    background: cleanProjectText(fields.background || fields.objective || fields.architecture || summary) || '简历未单独列出项目背景，待补充',
    objective: cleanProjectText(fields.objective || ''),
    architecture: cleanProjectText(fields.architecture || ''),
    responsibilities: cleanProjectText(fields.responsibilities || fields.actions || summary) || '简历未单独列出个人职责，待补充',
    actions: cleanProjectText(fields.actions || ''),
    challenges: cleanProjectText(fields.challenges || ''),
    results: cleanProjectText(fields.results || derivedResults) || '简历未单独列出项目结果，待补充',
    techStack: [...new Set([...explicitTech, ...detectTags(techSource)])].slice(0, 30)
  };
}

export function extractResumeProjects(text: string): ProjectInput[] {
  const normalized = normalizeText(text);
  const section = extractProjectSection(normalized);
  if (!section.length) return [];
  const names = extractProjectNames(section);
  const regular = splitProjectBlocks(section).map(parseProjectBlock);
  const detailed = splitDetailedProjectBlocks(normalized, names).map(parseProjectBlock);
  const anonymous = splitAnonymousProjectBlocks(section).map(parseProjectBlock);
  const meaningfulRegular = regular.filter((project) => {
    return !project.background.startsWith('简历未单独列出')
      && !project.responsibilities.startsWith('简历未单独列出');
  });
  const selected = anonymous.length > Math.max(1, detailed.length, meaningfulRegular.length)
    ? anonymous
    : (detailed.length > Math.max(1, meaningfulRegular.length)
        ? detailed
        : (meaningfulRegular.length >= Math.max(1, names.length) ? regular : (detailed.length ? detailed : regular)));
  return selected.filter((project) => project.name).slice(0, 20);
}

export function mapImportedDocument(
  target: DocumentImportTarget,
  fileName: string,
  rawText: string,
  mode: DocumentRecognitionMode,
  initialWarnings: string[] = []
): DocumentImportResult {
  const normalized = normalizeText(rawText);
  const warnings = [...initialWarnings];
  const extractedText = normalized.length > MAX_EXTRACTED_TEXT
    ? normalized.slice(0, MAX_EXTRACTED_TEXT)
    : normalized;
  if (normalized.length > MAX_EXTRACTED_TEXT) warnings.push('内容超过 100000 字，已截取前半部分。');

  const result: DocumentImportResult = { target, fileName, mode, extractedText, warnings };
  if (target === 'job') {
    result.job = {
      title: firstMatch(extractedText, ['岗位名称', '职位名称', '应聘职位', '岗位', '职位'])
        || firstMeaningfulLine(extractedText)
        || fileTitle(fileName),
      company: firstMatch(extractedText, ['公司名称', '招聘公司', '公司']),
      rawText: extractedText
    };
  } else if (target === 'profile') {
    const yearsValue = firstMatch(extractedText, ['工作年限', '工作经验', '经验年限']);
    const years = yearsValue.match(/\d+(?:\.\d+)?/)?.[0];
    const currentRole = inferCurrentRole(extractedText);
    const targetRoles = splitValues(firstMatch(extractedText, ['目标岗位', '意向岗位', '求职意向', '求职目标', '期望职位', '目标职能']));
    result.profile = {
      nickname: inferNickname(extractedText),
      currentRole,
      yearsExperience: years ? Number(years) : undefined,
      education: inferEducation(extractedText),
      targetRoles,
      skills: mapSkills(extractedText)
    };
    result.projects = extractResumeProjects(extractedText).map((project) => ({
      ...project,
      role: project.role.startsWith('简历未单独列出') ? (currentRole || targetRoles[0] || project.role) : project.role
    }));
    if (!result.projects.length) warnings.push('未识别到明确的项目经历段落，可在“项目经历”中手动补充。');
  } else {
    result.knowledge = {
      type: detectKnowledgeType(fileName, extractedText),
      title: firstMeaningfulLine(extractedText) || fileTitle(fileName),
      contentMarkdown: extractedText,
      tags: detectTags(extractedText),
      status: 'draft',
      source: `${mode === 'ai-vision' ? '图片识别' : '文件导入'}：${fileName}`
    };
  }
  return result;
}
