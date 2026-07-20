import { randomUUID } from 'node:crypto';
import type {
  InterviewDiagnosis,
  InterviewQuestion,
  JobDescription,
  PressureSessionSummary,
  ProjectExperience,
  ScoreDimension,
  TrainingLanguage,
  TrainingSession,
  TrainingStartInput,
  WorkspaceState
} from './domain';

const zhFillers = ['然后', '就是', '那个', '可能', '大概', '的话', '其实'];
const enFillers = ['you know', 'like', 'basically', 'maybe', 'kind of', 'sort of'];

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
  void state;
  const difficulty = input.difficulty ?? 'medium';
  const language = input.language ?? 'zh-CN';
  const english = language === 'en-US';
  const candidates: InterviewQuestion[] = [];

  if (project) {
    candidates.push(
      question(
        english
          ? `Please introduce the “${project.name}” project and explain your responsibilities.`
          : `请介绍一下“${project.name}”项目，以及你在其中承担的职责。`,
        english ? 'Evaluates project communication and individual contribution' : '验证项目整体表达和个人贡献',
        english ? ['background', 'responsibility', 'action', 'result'] : ['背景', '职责', '方案', '结果'],
        [project.id],
        'project',
        difficulty
      ),
      question(
        english
          ? `What was the most representative problem you encountered in “${project.name}”, and how did you diagnose and solve it?`
          : `在“${project.name}”中，你遇到过最典型的问题是什么？你如何定位并解决？`,
        english ? 'Turns a real incident into a structured engineering story' : '把真实故障转化为结构化案例',
        english ? ['symptom', 'diagnosis', 'root cause', 'solution', 'verification'] : ['现象', '排查', '根因', '解决', '验证'],
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
          english
            ? `This role requires “${requirement.label}”. Explain how you have used or understood this capability in a real situation.`
            : `目标岗位要求${requirement.label}。请结合你的实际经历说明你如何使用或理解这项能力。`,
          english
            ? `Based on a ${requirement.priority === 'must' ? 'required' : 'related'} requirement for ${job.title}`
            : `来自 ${job.title} 的${requirement.priority === 'must' ? '必须' : '相关'}要求`,
          english ? [requirement.label, 'context', 'responsibility', 'result'] : [requirement.label, '场景', '职责', '结果'],
          [job.id, ...requirement.evidenceIds],
          requirement.category === 'soft-skill' ? 'behavioral' : 'technical',
          difficulty
        )
      );
    }
  }

  candidates.push(
    question(
      english
        ? 'If a production service suddenly became unavailable, how would you identify the impact and organize the investigation?'
        : '如果线上服务突然不可用，你会如何确定故障范围并组织排查？',
      english ? 'Evaluates incident diagnosis and communication' : '通用故障排查与沟通能力',
      english ? ['impact', 'metrics', 'logs', 'dependencies', 'recovery', 'review'] : ['影响范围', '监控', '日志', '依赖', '恢复', '复盘'],
      [],
      'technical',
      difficulty
    ),
    question(
      english
        ? 'Why are you applying for this career direction, and what value can your existing experience bring?'
        : '为什么你想应聘这个方向？你的已有经验可以带来什么价值？',
      english ? 'Evaluates motivation and role-value communication' : '验证职业动机与岗位价值表达',
      english ? ['motivation', 'experience', 'role', 'value'] : ['动机', '经验', '岗位', '价值'],
      [],
      'hr',
      difficulty
    )
  );

  const filtered = input.type && input.type !== 'mixed'
    ? candidates.filter((item) => item.type === input.type)
    : candidates;
  const selected = filtered.length ? filtered : candidates;
  if (input.mode === 'pressure') {
    const first = selected[0] ?? candidates[0];
    return first ? [{
      ...first,
      type: 'pressure',
      difficulty: 'hard',
      rationale: english
        ? `Pressure round 1: verify whether this resume claim can withstand follow-up questions. ${first.rationale}`
        : `压力面试第 1 轮：验证这条简历经历能否经得起连续追问。${first.rationale}`
    }] : [];
  }
  return selected.slice(0, input.questionCount ?? 5);
}

export interface ScoringResult {
  dimensions: ScoreDimension[];
  totalScore: number;
  feedback: string[];
  clarifyingQuestions: string[];
}

export function scoreAnswer(
  answer: string,
  currentQuestion: InterviewQuestion,
  language: TrainingLanguage = 'zh-CN'
): ScoringResult {
  const english = language === 'en-US';
  const normalized = answer.trim();
  const length = normalized.length;
  const keywordMatches = countMatches(normalized, currentQuestion.targetKeywords);
  const structureTerms = english
    ? ['background', 'first', 'then', 'diagnosed', 'cause', 'solution', 'finally', 'result', 'verified']
    : ['背景', '首先', '其次', '排查', '原因', '方案', '最终', '结果', '验证'];
  const contributionTerms = english
    ? ['I was responsible', 'I led', 'I checked', 'I diagnosed', 'I found', 'I coordinated', 'I implemented']
    : ['我负责', '我主要', '我会', '我通过', '我发现', '我推动', '我协调'];
  const engineeringTerms = english
    ? ['log', 'metric', 'status', 'api', 'configuration', 'deploy', 'verify', 'rollback', 'monitor']
    : ['日志', '监控', '状态', '接口', '配置', '部署', '验证', '回滚', '指标'];
  const structureMatches = countMatches(normalized, structureTerms);
  const contributionMatches = countMatches(normalized, contributionTerms);
  const engineeringMatches = countMatches(normalized, engineeringTerms);
  const fillerCount = (english ? enFillers : zhFillers).reduce((sum, term) => sum + (normalized.toLocaleLowerCase().split(term.toLocaleLowerCase()).length - 1), 0);
  const unsupportedNumbers = (normalized.match(/\b\d{2,}(?:\.\d+)?%?\b/g) ?? []).length;
  const labels = english
    ? ['Accuracy', 'Structure', 'Contribution', 'Role match', 'Naturalness', 'Authenticity']
    : ['内容准确性', '结构完整性', '个人贡献', '岗位匹配', '语言自然度', '真实性风险'];

  const dimensions: ScoreDimension[] = [
    {
      key: 'accuracy', label: labels[0],
      score: clamp(38 + Math.min(35, engineeringMatches * 8) + Math.min(27, length / 10)),
      evidence: english
        ? (engineeringMatches ? `${engineeringMatches} engineering or verification elements found` : 'Verifiable engineering detail is limited')
        : (engineeringMatches ? `包含 ${engineeringMatches} 个工程排查或验证要素` : '缺少可验证的工程细节')
    },
    {
      key: 'structure', label: labels[1],
      score: clamp(30 + structureMatches * 12 + Math.min(20, length / 15)),
      evidence: english
        ? (structureMatches ? `${structureMatches} structure cues found` : 'Context-action-result structure is not clear yet')
        : (structureMatches ? `识别到 ${structureMatches} 个结构提示词` : '尚未形成背景—行动—结果结构')
    },
    {
      key: 'contribution', label: labels[2],
      score: clamp(25 + contributionMatches * 18 + Math.min(20, length / 20)),
      evidence: english
        ? (contributionMatches ? `${contributionMatches} personal-action statements found` : 'Your own actions are not specific enough')
        : (contributionMatches ? `出现 ${contributionMatches} 处个人行动表达` : '个人具体动作不清楚')
    },
    {
      key: 'jobMatch', label: labels[3],
      score: clamp(30 + keywordMatches * 16 + Math.min(20, engineeringMatches * 4)),
      evidence: english
        ? `Matched ${keywordMatches}/${currentQuestion.targetKeywords.length} target keywords`
        : `命中问题目标关键词 ${keywordMatches}/${currentQuestion.targetKeywords.length}`
    },
    {
      key: 'naturalness', label: labels[4],
      score: clamp(82 - fillerCount * 5 - (length < 40 ? 20 : 0)),
      evidence: english
        ? (fillerCount ? `${fillerCount} filler expressions found` : 'No obvious repeated filler expressions')
        : (fillerCount ? `检测到 ${fillerCount} 处高频口头语` : '未发现明显高频口头语')
    },
    {
      key: 'authenticity', label: labels[5],
      score: clamp(94 - unsupportedNumbers * 8),
      evidence: english
        ? (unsupportedNumbers ? 'Verify the source of numeric claims before saving' : 'No obvious unsupported quantified claims')
        : (unsupportedNumbers ? '回答包含数字结果，保存前应确认来源' : '未发现明显未经证明的量化内容')
    }
  ];

  const totalScore = clamp(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const feedback: string[] = [];
  const clarifyingQuestions: string[] = [];
  if (length < 80) feedback.push(english ? 'The answer is short. Add the situation, your actions, and how you verified the result.' : '回答偏短，建议补充具体场景、个人动作和验证结果。');
  if (structureMatches < 2) {
    feedback.push(english ? 'Use a clearer context-responsibility-action-result structure.' : '结构不够清晰，可以按“背景—职责—行动—结果”重新组织。');
    clarifyingQuestions.push(english ? 'What was the business context and impact?' : '这件事发生时的业务背景和影响是什么？');
  }
  if (contributionMatches === 0) {
    feedback.push(english ? 'State exactly what you personally did or drove.' : '没有明确说明你本人做了什么。');
    clarifyingQuestions.push(english ? 'Which steps did you personally complete or coordinate?' : '其中哪几步是你亲自完成或推动的？');
  }
  if (keywordMatches < Math.min(2, currentQuestion.targetKeywords.length)) {
    feedback.push(english ? 'Connect the answer more directly to the target capability and technical keywords.' : '与问题目标的连接较弱，建议补充关键技术或岗位能力。');
  }
  const hasResult = english ? /result|finally|restored|released|completed|improved|reduced|resolved/i.test(normalized) : /结果|最终|恢复|上线|完成|提升|降低|解决/.test(normalized);
  if (!hasResult) clarifyingQuestions.push(english ? 'What was the result, and how did you verify the issue was resolved?' : '最终结果如何，你用什么方式确认问题已经解决？');
  if (fillerCount > 2) feedback.push(english ? 'Reduce filler words: lead with the conclusion, then explain in steps.' : '口头语较多，可以先给结论，再分点说明。');
  if (!feedback.length) feedback.push(english ? 'The structure is solid. Tighten repetition and add only verifiable detail.' : '回答结构较完整，可以继续压缩冗余并增加可验证细节。');

  return { dimensions, totalScore, feedback, clarifyingQuestions: clarifyingQuestions.slice(0, 3) };
}

export function generateRecommendedAnswer(
  currentQuestion: InterviewQuestion,
  project?: ProjectExperience,
  language: TrainingLanguage = 'zh-CN'
): string {
  if (language === 'en-US') {
    if (!project) {
      return `A strong answer can follow this structure: start with the specific context, state your responsibility, explain two or three actions you personally took, and close with the verified result. Use only facts from your own experience and connect them to: ${currentQuestion.targetKeywords.join(', ')}.`;
    }
    return `The project was ${project.name}. ${project.background} My role was ${project.role}, and I was mainly responsible for ${project.responsibilities} ${project.challenges ? `A key challenge was ${project.challenges}` : ''} ${project.actions ? `I addressed it by ${project.actions}` : ''} The result was ${project.results} This experience strengthened my practical ability in ${project.techStack.join(', ') || 'system operations and troubleshooting'}.`;
  }
  if (!project) {
    return `建议按“具体背景—个人职责—关键行动—验证结果”回答，并围绕“${currentQuestion.targetKeywords.join('、')}”补充真实细节。只使用自己确实做过、能够被追问验证的内容。`;
  }
  return `这个项目是${project.name}。当时的背景是：${project.background}。我在项目中担任${project.role}，主要负责${project.responsibilities}。${project.challenges ? `其中一个关键难点是${project.challenges}。` : ''}${project.actions ? `我采取的主要行动是${project.actions}。` : ''}最终${project.results}。这段经历让我积累了${project.techStack.join('、') || '平台运维与故障排查'}方面的真实经验。`;
}

function hasAny(text: string, terms: RegExp): boolean {
  return terms.test(text);
}

function safeEvidence(value: string | undefined, language: TrainingLanguage): string {
  if (!value || /待补充|待命名|未单独列出/.test(value)) {
    return language === 'en-US' ? '[CANDIDATE MUST ADD EVIDENCE]' : '【需要本人补充】';
  }
  return value;
}

export function diagnosePressureAnswer(
  answer: string,
  currentQuestion: InterviewQuestion,
  project?: ProjectExperience,
  language: TrainingLanguage = 'zh-CN'
): InterviewDiagnosis {
  const english = language === 'en-US';
  const scored = scoreAnswer(answer, currentQuestion, language);
  const contribution = scored.dimensions.find((item) => item.key === 'contribution')?.score ?? 0;
  const structure = scored.dimensions.find((item) => item.key === 'structure')?.score ?? 0;
  const accuracy = scored.dimensions.find((item) => item.key === 'accuracy')?.score ?? 0;
  const authenticity = scored.dimensions.find((item) => item.key === 'authenticity')?.score ?? 0;
  const evidenceGaps: string[] = [];
  const logicIssues: string[] = [];
  const hasNumber = /\b\d+(?:\.\d+)?%?\b/.test(answer);
  const hasEvidenceSource = hasAny(answer, english
    ? /log|metric|monitor|ticket|report|test|query|dashboard|record|verified|measured/i
    : /日志|监控|指标|工单|报告|测试|查询|看板|记录|验证|统计|测量/);
  const hasResult = hasAny(answer, english
    ? /result|restored|released|completed|improved|reduced|resolved|verified/i
    : /结果|恢复|上线|完成|提升|降低|解决|验证/);

  if (answer.trim().length < (english ? 140 : 80)) {
    evidenceGaps.push(english ? 'The answer is too short to verify the full context, action, and result.' : '回答过短，无法验证完整的背景、行动和结果。');
  }
  if (contribution < 65) {
    evidenceGaps.push(english ? 'Your personal actions and ownership are not specific enough.' : '个人动作和责任边界不够具体。');
  }
  if (!hasResult) {
    evidenceGaps.push(english ? 'No verified result or acceptance criterion was provided.' : '没有说明可验证的结果或验收方式。');
  }
  if (hasNumber && !hasEvidenceSource) {
    evidenceGaps.push(english ? 'A numeric claim is present, but its data source is missing.' : '出现了量化结果，但没有说明数据从哪里得出。');
  } else if (!hasNumber && !hasEvidenceSource) {
    evidenceGaps.push(english ? 'Add either a measured result or a concrete verification method.' : '缺少量化结果或具体的验证依据。');
  }
  if (accuracy < 70) logicIssues.push(english ? 'Technical diagnosis and verification details are incomplete.' : '技术排查与验证细节不完整。');
  if (structure < 70) logicIssues.push(english ? 'The context, responsibility, action, and result are mixed together.' : '背景、职责、行动和结果混在一起，主线不清楚。');
  if (authenticity < 80) logicIssues.push(english ? 'Some claims may be challenged because the evidence source is unclear.' : '部分表述可能被质疑，证据来源需要补充。');
  if (!logicIssues.length) logicIssues.push(english ? 'The structure is mostly clear; remove repetition and keep only verifiable facts.' : '结构基本清楚，下一步应压缩重复表达，只保留可验证事实。');

  const starAnswer = project
    ? (english
        ? `Situation: ${safeEvidence(project.background, language)}\nTask: I was responsible for ${safeEvidence(project.responsibilities, language)}\nAction: ${safeEvidence(project.actions || project.challenges, language)}\nResult: ${safeEvidence(project.results, language)}\nEvidence source: ${hasEvidenceSource ? 'Use the logs, metrics, tickets, or test records mentioned in your answer.' : '[CANDIDATE MUST ADD EVIDENCE]'}`
        : `背景：${safeEvidence(project.background, language)}\n任务：我主要负责${safeEvidence(project.responsibilities, language)}\n行动：${safeEvidence(project.actions || project.challenges, language)}\n结果：${safeEvidence(project.results, language)}\n证据来源：${hasEvidenceSource ? '使用回答中提到的日志、监控、工单或测试记录进行证明。' : '【需要本人补充】'}`)
    : (english
        ? 'Situation: [CANDIDATE MUST ADD EVIDENCE]\nTask: [CANDIDATE MUST ADD EVIDENCE]\nAction: [CANDIDATE MUST ADD EVIDENCE]\nResult: [CANDIDATE MUST ADD EVIDENCE]'
        : '背景：【需要本人补充】\n任务：【需要本人补充】\n行动：【需要本人补充】\n结果：【需要本人补充】');
  const interviewerChallenge = scored.clarifyingQuestions[0]
    ?? (english ? 'How can you prove that this result was caused by your actions?' : '你如何证明这个结果确实由你的行动带来？');
  const resumeUpdateNeeded = evidenceGaps.length > 0 || structure < 75 || contribution < 75;
  const resumeSuggestion = resumeUpdateNeeded
    ? (english
        ? `For the “${project?.name ?? 'selected'}” resume entry, add your ownership boundary, one key action, the verification method, and the source of any numeric result. Unknown facts must remain marked for completion.`
        : `建议在“${project?.name ?? '当前'}”项目经历中补充：个人责任边界、一个关键动作、结果验证方式，以及量化数据的来源；无法确认的信息保留“【需要本人补充】”。`)
    : (english ? 'The resume entry is consistent with this answer; only tighten wording.' : '当前回答与项目经历基本一致，仅需压缩措辞。');

  return {
    evidenceGaps: [...new Set(evidenceGaps)].slice(0, 6),
    logicIssues: [...new Set(logicIssues)].slice(0, 6),
    interviewerChallenge,
    starAnswer,
    resumeUpdateNeeded,
    resumeSuggestion
  };
}

function normalizeQuestionText(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function isRepeatedQuestion(candidate: string, questions: InterviewQuestion[]): boolean {
  const normalized = normalizeQuestionText(candidate);
  if (!normalized) return true;
  return questions.some((item) => {
    const existing = normalizeQuestionText(item.text);
    return existing === normalized || existing.includes(normalized) || normalized.includes(existing);
  });
}

export function createPressureFollowUp(
  session: TrainingSession,
  requestedQuestion: string,
  job?: JobDescription,
  project?: ProjectExperience
): InterviewQuestion {
  const english = session.language === 'en-US';
  const round = session.attempts.filter((item) => item.isFinal).length + 1;
  const fallbacks = english ? [
    `Which actions in “${project?.name ?? 'this experience'}” were completed by you personally, and which were completed by others?`,
    'Describe the hardest failure or setback. What did you do when your first approach did not work?',
    'You mentioned a result. What evidence, measurement window, or record proves it?',
    `How does this experience demonstrate a required capability for ${job?.title ?? 'the target role'}?`,
    'Walk me through one technical decision in enough detail that an engineer could challenge it.',
    'What risk did you miss at the time, and what would you change if you repeated the work?',
    'Give me the strongest claim on your resume and prove it without using vague adjectives.'
  ] : [
    `在“${project?.name ?? '这段经历'}”里，哪些动作是你亲自完成的，哪些是其他人完成的？`,
    '请讲一次最困难的失败或受阻经历。第一种方案无效时，你具体怎么处理？',
    '你刚才提到了结果。这个结果的统计口径、验证周期和数据记录分别是什么？',
    `这段经历如何证明你符合“${job?.title ?? '目标岗位'}”的一项核心要求？`,
    '请把其中一个技术决策讲到工程师可以继续质疑的深度。',
    '当时你漏掉了什么风险？如果重做一次，你会修改哪一步？',
    '选择简历上最强的一句话，不使用模糊形容词，直接证明它。'
  ];
  let text = requestedQuestion.trim();
  if (!text || isRepeatedQuestion(text, session.questions)) {
    text = fallbacks.find((item) => !isRepeatedQuestion(item, session.questions))
      ?? fallbacks[(Math.max(2, round) - 2) % fallbacks.length];
  }
  return question(
    text,
    english ? `Dynamic pressure follow-up for round ${round}` : `根据上一轮回答生成的第 ${round} 轮动态追问`,
    english ? ['evidence', 'ownership', 'action', 'result', 'role match'] : ['证据', '个人贡献', '行动', '结果', '岗位匹配'],
    [job?.id, project?.id].filter(Boolean) as string[],
    'pressure',
    'hard'
  );
}

export function buildPressureSummary(
  session: TrainingSession,
  project?: ProjectExperience,
  supplied?: PressureSessionSummary
): PressureSessionSummary {
  if (supplied?.coreStrengths?.length && supplied.highRiskGaps?.length) return supplied;
  const finals = session.attempts.filter((item) => item.isFinal);
  const dimensionRows = finals.flatMap((attempt) => attempt.dimensions);
  const dimensionAverage = (key: ScoreDimension['key']): number => {
    const rows = dimensionRows.filter((item) => item.key === key);
    return rows.length ? Math.round(rows.reduce((sum, item) => sum + item.score, 0) / rows.length) : 0;
  };
  const ranked = (['accuracy', 'structure', 'contribution', 'jobMatch', 'naturalness', 'authenticity'] as const)
    .map((key) => ({ key, score: dimensionAverage(key), label: dimensionRows.find((item) => item.key === key)?.label ?? key }))
    .sort((left, right) => right.score - left.score);
  const challenges = finals.map((item) => item.diagnosis?.interviewerChallenge).filter(Boolean) as string[];
  const resumeSuggestions = finals.map((item) => item.diagnosis?.resumeSuggestion).filter(Boolean) as string[];
  const evidenceGaps = finals.flatMap((item) => item.diagnosis?.evidenceGaps ?? []);
  const defaultQuestions = [
    '这个结果的证据和统计口径是什么？',
    '其中哪些动作由你本人完成？',
    '第一次方案失败时你如何调整？',
    '这段经历与目标岗位的核心要求有什么关系？',
    '如果重做一次，你会修改哪个技术或协作决策？'
  ];
  return {
    coreStrengths: ranked.slice(0, 3).map((item) => `${item.label}：平均 ${item.score} 分`).filter((item) => !item.endsWith('0 分')),
    highRiskGaps: [...new Set([...evidenceGaps, ...ranked.slice(-3).map((item) => `${item.label}仍是高风险项，当前平均 ${item.score} 分`)])].slice(0, 3),
    practiceQuestions: [...new Set([...challenges, ...defaultQuestions])].slice(0, 5),
    resumeSuggestions: [...new Set(resumeSuggestions.length ? resumeSuggestions : [`重新核对“${project?.name ?? '核心项目'}”中的个人贡献、数据来源和验证结果。`])].slice(0, 5),
    checklist: [
      '目标公司、目标岗位和 JD 已核对',
      '简历每个数字都有来源或验证方式',
      '项目中的个人职责与团队职责已分开',
      '至少准备一个失败、冲突或回滚案例',
      '每个核心项目都有 30 秒、90 秒和深入追问版本',
      '无法确认的信息保留“【需要本人补充】”，不编造'
    ]
  };
}
