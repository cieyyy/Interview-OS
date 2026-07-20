import { describe, expect, it } from 'vitest';
import { createDemoState, nowIso } from './domain';
import { createPressureFollowUp, diagnosePressureAnswer, generateQuestions, generateRecommendedAnswer, scoreAnswer } from './training-engine';

describe('training engine', () => {
  it('generates project-specific questions offline', () => {
    const state = createDemoState();
    const questions = generateQuestions(
      { projectId: state.projects[0].id, questionCount: 3, difficulty: 'medium' },
      state,
      undefined,
      state.projects[0]
    );
    expect(questions).toHaveLength(3);
    expect(questions[0].text).toContain(state.projects[0].name);
  });

  it('scores structured answers higher than vague answers', () => {
    const state = createDemoState();
    const question = generateQuestions({ projectId: state.projects[0].id, questionCount: 1 }, state, undefined, state.projects[0])[0];
    const weak = scoreAnswer('就是我做过，后来解决了。', question);
    const strong = scoreAnswer(
      '背景是画布调用算力平台失败。我负责接口联调和日志排查。我通过平台日志、接口测试和配置对比发现模型映射不一致，协调开发修复后重新部署，并通过接口和业务页面验证最终恢复。',
      question
    );
    expect(strong.totalScore).toBeGreaterThan(weak.totalScore);
    expect(strong.dimensions).toHaveLength(6);
  });

  it('flags unsupported numeric claims for confirmation', () => {
    const state = createDemoState();
    const question = generateQuestions({ questionCount: 1 }, state)[0];
    const result = scoreAnswer('我优化后性能提升 99%，客户增长 1000。', question);
    expect(result.dimensions.find((item) => item.key === 'authenticity')?.score).toBeLessThan(94);
  });

  it('generates English questions, feedback and a project-grounded recommended answer', () => {
    const state = createDemoState();
    const project = state.projects[0];
    const question = generateQuestions(
      { projectId: project.id, questionCount: 1, language: 'en-US' },
      state,
      undefined,
      project
    )[0];
    expect(question.text).toContain('Please introduce');
    const result = scoreAnswer(
      'The background was a failed API request. I was responsible for diagnosis. I checked logs, found the configuration issue, coordinated the fix, and verified the restored service.',
      question,
      'en-US'
    );
    expect(result.dimensions[0].label).toBe('Accuracy');
    expect(generateRecommendedAnswer(question, project, 'en-US')).toContain(project.name);
  });

  it('starts pressure mode with one hard question and diagnoses evidence gaps', () => {
    const state = createDemoState();
    const project = state.projects[0];
    const question = generateQuestions(
      { projectId: project.id, mode: 'pressure', maxRounds: 8, questionCount: 1 },
      state,
      undefined,
      project
    )[0];
    const diagnosis = diagnosePressureAnswer('我负责运维，性能提升了 90%。', question, project);

    expect(question.type).toBe('pressure');
    expect(question.difficulty).toBe('hard');
    expect(diagnosis.evidenceGaps.join('')).toContain('数据从哪里得出');
    expect(diagnosis.resumeUpdateNeeded).toBe(true);
  });

  it('replaces a repeated follow-up with a new pressure question', () => {
    const state = createDemoState();
    const project = state.projects[0];
    const first = generateQuestions({ projectId: project.id, mode: 'pressure' }, state, undefined, project)[0];
    const next = createPressureFollowUp({
      id: 'session', title: '压力面试', status: 'active', questions: [first], attempts: [],
      currentQuestionIndex: 0, language: 'zh-CN', mode: 'pressure', maxRounds: 8,
      createdAt: nowIso(), updatedAt: nowIso()
    }, first.text, undefined, project);

    expect(next.text).not.toBe(first.text);
    expect(next.type).toBe('pressure');
  });
});
