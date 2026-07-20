import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceService } from './workspace-service';
import { AtomicWorkspaceRepository } from '../storage/workspace-repository';

let root = '';
let service: WorkspaceService;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'interview-service-'));
  const repository = new AtomicWorkspaceRepository(root);
  await repository.initialize();
  service = new WorkspaceService(repository);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('WorkspaceService', () => {
  it('completes the project → JD → training → knowledge loop', async () => {
    const project = await service.saveProject({
      name: '测试项目', role: '运维', background: '运行在 Kubernetes 上',
      responsibilities: '负责部署与日志排查', results: '完成版本上线', techStack: ['Kubernetes', 'Docker']
    });
    const job = await service.analyzeJob({ title: '云原生运维', rawText: '要求熟悉 Kubernetes、Docker 和 Linux。' });
    const session = await service.startTraining({ projectId: project.id, jobId: job.id, questionCount: 2 });
    const question = session.questions[0];
    const analyzed = await service.submitTraining({
      sessionId: session.id,
      questionId: question.id,
      answer: '背景是服务需要更新。我负责构建镜像、更新 Deployment、查看日志并验证接口，最终完成上线。'
    });
    expect(analyzed.attempts).toHaveLength(1);
    await service.finalizeTraining({ sessionId: session.id, questionId: question.id, answer: analyzed.attempts[0].answer });
    expect(service.getState().knowledge.some((item) => item.type === 'answer')).toBe(true);
  });

  it('runs a dynamic pressure interview and produces a final risk summary', async () => {
    const project = await service.saveProject({
      name: '压力测试项目', role: '平台运维', background: '业务运行在 Kubernetes 集群',
      responsibilities: '负责部署和故障排查', actions: '查看日志并更新 Deployment',
      results: '服务恢复并完成验证', techStack: ['Kubernetes']
    });
    const job = await service.analyzeJob({ title: '云原生技术支持', company: '目标公司', rawText: '要求 Kubernetes、故障排查和客户沟通。' });
    let session = await service.startTraining({ projectId: project.id, jobId: job.id, mode: 'pressure', maxRounds: 2 });
    expect(session.questions).toHaveLength(1);
    expect(session.mode).toBe('pressure');

    const first = session.questions[0];
    session = await service.finalizeTraining({
      sessionId: session.id,
      questionId: first.id,
      answer: '背景是服务发布失败。我负责排查，通过日志发现配置错误，修复 Deployment 后验证接口恢复。'
    });
    expect(session.questions).toHaveLength(2);
    expect(session.questions[1].text).not.toBe(first.text);
    expect(session.status).toBe('active');

    const second = session.questions[1];
    session = await service.finalizeTraining({
      sessionId: session.id,
      questionId: second.id,
      answer: '我本人完成日志检查和配置修复，通过接口测试记录确认服务恢复。'
    });
    expect(session.status).toBe('completed');
    expect(session.summary?.highRiskGaps.length).toBeGreaterThan(0);
    expect(session.summary?.practiceQuestions).toHaveLength(5);
  });
});
