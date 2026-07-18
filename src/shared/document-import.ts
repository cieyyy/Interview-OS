import path from 'node:path';
import type {
  DocumentImportResult,
  DocumentImportTarget,
  DocumentRecognitionMode,
  KnowledgeType,
  SkillLevel
} from './domain';

const MAX_EXTRACTED_TEXT = 100_000;
const TECHNOLOGIES = [
  'Kubernetes', 'Docker', 'Linux', 'ACK', 'ACR', 'ECS', 'RDS', 'OSS', 'Nginx',
  'Redis', 'MySQL', 'PostgreSQL', 'Prometheus', 'Grafana', 'Jenkins', 'GitHub',
  'Python', 'Java', 'Go', 'RAG', 'Embedding', '大模型 API', 'AI'
];

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\0/g, '').trim();
}

function firstMatch(text: string, labels: string[]): string {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${escaped})\\s*[:：]\\s*([^\\n]{1,160})`, 'i'));
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
  return value.split(/[，,、;；|/]/).map((item) => item.trim()).filter(Boolean);
}

function detectTags(text: string): string[] {
  const lower = text.toLocaleLowerCase();
  return TECHNOLOGIES.filter((technology) => lower.includes(technology.toLocaleLowerCase())).slice(0, 12);
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
    result.profile = {
      nickname: firstMatch(extractedText, ['姓名', '昵称']),
      currentRole: firstMatch(extractedText, ['当前岗位', '当前职位', '现任职位', '职位']),
      yearsExperience: years ? Number(years) : undefined,
      education: firstMatch(extractedText, ['最高学历', '学历']),
      targetRoles: splitValues(firstMatch(extractedText, ['目标岗位', '求职意向', '期望职位'])),
      skills: mapSkills(extractedText)
    };
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
