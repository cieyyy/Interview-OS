import { randomUUID } from 'node:crypto';
import type {
  InterviewQuestion,
  JobDescription,
  ProjectExperience,
  ScoreDimension,
  TrainingStartInput,
  WorkspaceState
} from './domain';

const fillers = ['然后', '就是', '那个', '可能', '大概', '的话', '其实'];

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function countMatches(text: string, terms: string[]): number {
  return terms.filter((term) => text.toLocaleLowerCase().includes(term.toLocaleLowerCase())).length;
}

function question(
  text: string,
  rationale: string,
  targetKeywords: string[],
  relatedIds: string[],
  type: InterviewQuestion['type'],
  difficulty: InterviewQuestion['difficulty']
): InterviewQuestion {
  return { id: randomUUID(), text, rationale, targetKeywords, relatedIds, type, difficulty };
}

export function generateQuestions(
  input: TrainingStartInput,
  state: WorkspaceState,
  job?: JobDescription,
  project?: ProjectExperience
): InterviewQuestion[] {
  const difficulty = input.difficulty ?? 'medium';
  const candidates: InterviewQuestion[] = [];

  if (project) {
    candidates.push(
      question(
        `请介绍一下“${project.name}”项目，以及你在其中承担的职责。`,
        '验证项目整体表达和个人贡献',
        ['背景', '职责', '方案', '结果'],
        [project.id],
        'project',
        difficulty
      ),
      question(
        `在“${project.name}”中，你遇到过最典型的问题是什么？你如何定位并解决？`,
        '把真实故障转化为结构化案例',
        ['现象', '排查', '根因', '解决', '验证'],
        [project.id],
        'project',
        difficulty
      )
    );
  }

  if (job) {
    for (const requirement of job.requirements.slice(0, 5)) {
      candidates.push(
        question(
          `目标岗位要求${requirement.label}。请结合你的实际经历说明你如何使用或理解这项能力。`,
          `来自 ${job.title} 的${requirement.priority === 'must' ? '必须' : '相关'}要求`,
          [requirement.label, '场景', '职责', '结果'],
          [job.id, ...requirement.evidenceIds],
          requirement.category === 'soft-skill' ? 'behavioral' : 'technical',
          difficulty
        )
      );
    }
  }

  candidates.push(
    question(
      '如果线上服务突然不可用，你会如何确定故障范围并组织排查？',
      '通用故障排查与沟通能力',
      ['影响范围', '监控', '日志', '依赖', '恢复', '复盘'],
      [],
      'technical',
      difficulty
    ),
    question(
      '为什么你想应聘这个方向？你的已有经验可以带来什么价值？',
      '验证职业动机与岗位价值表达',
      ['动机', '经验', '岗位', '价值'],
      [],
      'hr',
      difficulty
    )
  );

  const filtered = input.type && input.type !== 'mixed'
    ? candidates.filter((item) => item.type === input.type)
    : candidates;
  const selected = filtered.length ? filtered : candidates;
  return selected.slice(0, input.questionCount ?? 5);
}

export interface ScoringResult {
  dimensions: ScoreDimension[];
  totalScore: number;
  feedback: string[];
  clarifyingQuestions: string[];
}

export function scoreAnswer(answer: string, currentQuestion: InterviewQuestion): ScoringResult {
  const normalized = answer.trim();
  const length = normalized.length;
  const keywordMatches = countMatches(normalized, currentQuestion.targetKeywords);
  const structureTerms = ['背景', '首先', '其次', '排查', '原因', '方案', '最终', '结果', '验证'];
  const contributionTerms = ['我负责', '我主要', '我会', '我通过', '我发现', '我推动', '我协调'];
  const engineeringTerms = ['日志', '监控', '状态', '接口', '配置', '部署', '验证', '回滚', '指标'];
  const structureMatches = countMatches(normalized, structureTerms);
  const contributionMatches = countMatches(normalized, contributionTerms);
  const engineeringMatches = countMatches(normalized, engineeringTerms);
  const fillerCount = fillers.reduce((sum, term) => sum + (normalized.split(term).length - 1), 0);
  const unsupportedNumbers = (normalized.match(/\b\d{2,}(?:\.\d+)?%?\b/g) ?? []).length;

  const dimensions: ScoreDimension[] = [
    {
      key: 'accuracy',
      label: '内容准确性',
      score: clamp(38 + Math.min(35, engineeringMatches * 8) + Math.min(27, length / 10)),
      evidence: engineeringMatches ? `包含 ${engineeringMatches} 个工程排查或验证要素` : '缺少可验证的工程细节'
    },
    {
      key: 'structure',
      label: '结构完整性',
      score: clamp(30 + structureMatches * 12 + Math.min(20, length / 15)),
      evidence: structureMatches ? `识别到 ${structureMatches} 个结构提示词` : '尚未形成背景—行动—结果结构'
    },
    {
      key: 'contribution',
      label: '个人贡献',
      score: clamp(25 + contributionMatches * 18 + Math.min(20, length / 20)),
      evidence: contributionMatches ? `出现 ${contributionMatches} 处个人行动表达` : '个人具体动作不清楚'
    },
    {
      key: 'jobMatch',
      label: '岗位匹配',
      score: clamp(30 + keywordMatches * 16 + Math.min(20, engineeringMatches * 4)),
      evidence: `命中问题目标关键词 ${keywordMatches}/${currentQuestion.targetKeywords.length}`
    },
    {
      key: 'naturalness',
      label: '语言自然度',
      score: clamp(82 - fillerCount * 5 - (length < 40 ? 20 : 0)),
      evidence: fillerCount ? `检测到 ${fillerCount} 处高频口头语` : '未发现明显高频口头语'
    },
    {
      key: 'authenticity',
      label: '真实性风险',
      score: clamp(94 - unsupportedNumbers * 8),
      evidence: unsupportedNumbers ? '回答包含数字结果，保存前应确认来源' : '未发现明显未经证明的量化内容'
    }
  ];

  const totalScore = clamp(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const feedback: string[] = [];
  const clarifyingQuestions: string[] = [];

  if (length < 80) feedback.push('回答偏短，建议补充具体场景、个人动作和验证结果。');
  if (structureMatches < 2) {
    feedback.push('结构不够清晰，可以按“背景—职责—行动—结果”重新组织。');
    clarifyingQuestions.push('这件事发生时的业务背景和影响是什么？');
  }
  if (contributionMatches === 0) {
    feedback.push('没有明确说明你本人做了什么。');
    clarifyingQuestions.push('其中哪几步是你亲自完成或推动的？');
  }
  if (keywordMatches < Math.min(2, currentQuestion.targetKeywords.length)) {
    feedback.push('与问题目标的连接较弱，建议补充关键技术或岗位能力。');
  }
  if (!/结果|最终|恢复|上线|完成|提升|降低|解决/.test(normalized)) {
    clarifyingQuestions.push('最终结果如何，你用什么方式确认问题已经解决？');
  }
  if (fillerCount > 2) feedback.push('口头语较多，可以先给结论，再分点说明。');
  if (!feedback.length) feedback.push('回答结构较完整，可以继续压缩冗余并增加可验证细节。');

  return { dimensions, totalScore, feedback, clarifyingQuestions: clarifyingQuestions.slice(0, 3) };
}

