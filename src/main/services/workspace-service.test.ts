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

  it('keeps an English pressure session English-only when source evidence is Chinese', async () => {
    const cjkPattern = /[\u3400-\u9fff]/u;
    const project = await service.saveProject({
      name: '中文项目', role: '平台运维', background: '业务运行在 Kubernetes 集群',
      responsibilities: '负责部署和故障排查', actions: '查看日志并更新 Deployment',
      results: '服务恢复并完成验证', techStack: ['Kubernetes', 'Docker']
    });
    const job = await service.analyzeJob({ title: '云原生技术支持', company: '目标公司', rawText: '要求 Kubernetes 和故障排查能力。' });
    let session = await service.startTraining({
      projectId: project.id, jobId: job.id, mode: 'pressure', maxRounds: 2, language: 'en-US'
    });

    expect(session.title).not.toMatch(cjkPattern);
    expect(JSON.stringify(session.questions)).not.toMatch(cjkPattern);

    for (let round = 0; round < 2; round += 1) {
      const current = session.questions[session.currentQuestionIndex];
      session = await service.finalizeTraining({
        sessionId: session.id,
        questionId: current.id,
        answer: 'I checked the logs, corrected the configuration, and verified service recovery with an API test record.'
      });
    }

    expect(session.status).toBe('completed');
    expect(JSON.stringify(session.summary)).not.toMatch(cjkPattern);
  });

  it('deduplicates browser-synced jobs and promotes one into the JD center', async () => {
    const token = service.getState().settings.jobSyncToken;
    const batch = {
      token,
      sourceSite: 'boss',
      sourceName: 'BOSS 直聘',
      pageUrl: 'https://www.zhipin.com/web/geek/job?query=Kubernetes',
      jobs: [{
        externalId: 'job-001',
        sourceUrl: 'https://www.zhipin.com/job_detail/job-001.html',
        title: 'Kubernetes 运维工程师',
        company: '示例科技',
        location: '杭州',
        salaryRange: '20K-30K',
        description: '负责 Kubernetes、Docker、Nginx 和生产故障排查。'
      }]
    };

    const first = await service.ingestSyncedJobs(batch);
    const second = await service.ingestSyncedJobs(batch);
    expect(first.added).toBe(1);
    expect(second.updated).toBe(1);
    expect(service.getState().syncedJobs).toHaveLength(1);
    expect(service.getState().syncedJobs[0].seenCount).toBe(2);

    const job = await service.promoteSyncedJob(service.getState().syncedJobs[0].id);
    expect(job.title).toBe('Kubernetes 运维工程师');
    expect(service.getState().syncedJobs[0].linkedJobId).toBe(job.id);
    expect(service.getState().syncedJobs[0].status).toBe('saved');
  });

  it('rejects a browser sync batch with the wrong local token', async () => {
    await expect(service.ingestSyncedJobs({
      token: 'wrong-token',
      sourceSite: 'boss',
      pageUrl: 'https://www.zhipin.com/web/geek/job',
      jobs: [{ sourceUrl: 'https://www.zhipin.com/job_detail/test.html', title: '测试岗位' }]
    })).rejects.toThrow('岗位同步令牌无效');
  });

  it('persists connector, filter and alert framework configuration with auditable dry runs', async () => {
    const source = await service.saveJobSource({
      name: '目标公司官网', platform: '官网', connectorType: 'company-careers', status: 'planned', enabled: false,
      endpoint: 'https://careers.example.com', intervalMinutes: 60, capabilities: ['search', 'detail', 'change-tracking'],
      notes: '测试连接器契约'
    });
    const preset = await service.saveJobFilterPreset({
      name: '高匹配岗位', includeKeywords: ['Kubernetes'], excludeKeywords: ['外包'], cities: ['杭州'],
      minSalaryK: 15, minMatchScore: 70, minTrustScore: 75, freshWithinDays: 30
    });
    const alert = await service.saveJobAlertRule({ name: '应用内提醒', presetId: preset.id, channel: 'in-app', enabled: true });
    const run = await service.validateJobSource(source.id);

    expect(alert.presetId).toBe(preset.id);
    expect(run.status).toBe('dry-run');
    expect(service.getState().jobSyncRuns[0].sourceId).toBe(source.id);
  });

  it('runs the local career agent and persists company watch and career memory', async () => {
    const token = service.getState().settings.jobSyncToken;
    await service.ingestSyncedJobs({
      token, sourceSite: 'company-careers', sourceName: '官网', pageUrl: 'https://careers.example.com',
      jobs: [{ sourceUrl: 'https://careers.example.com/jobs/1', title: '云原生技术支持工程师', company: '示例云科技', location: '杭州', salaryRange: '20K-30K', description: '负责 Kubernetes、Docker 和客户技术支持。' }]
    });
    const plan = await service.saveCareerSearchPlan({ title: '杭州云原生', goal: '找杭州云原生技术支持', cities: ['杭州'], keywords: ['云原生'], excludeKeywords: [], platforms: [], jobTypes: [], remotePreference: 'any', hardConstraints: [], softPreferences: [] });
    const run = await service.runCareerSearchPlan(plan.id);
    const memory = await service.saveCareerMemory({ type: 'preference', content: '优先考虑技术支持岗位', tags: ['偏好'] });
    const company = await service.saveCompanyWatch({ name: '示例云科技', careerUrl: 'https://careers.example.com', priority: 'focus' });
    const checked = await service.validateCompanyWatch(company.id);

    expect(run.matchedJobIds).toHaveLength(1);
    expect(memory.tags).toContain('偏好');
    expect(checked.openJobs).toBe(1);
    expect(checked.lastCheckedAt).toBeTruthy();
  });
});
