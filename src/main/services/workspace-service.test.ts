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
});

