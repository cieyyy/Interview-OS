import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceService } from './workspace-service';
import { AtomicWorkspaceRepository } from '../storage/workspace-repository';
import { createDefaultJobSources, createEmptyState } from '../../shared/domain';
import { validateWorkspaceState } from '../../shared/validation';

let root = '';
let service: WorkspaceService;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'interview-service-'));
  const repository = new AtomicWorkspaceRepository(root);
  await repository.initialize();
  service = new WorkspaceService(repository);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(root, { recursive: true, force: true });
});

describe('WorkspaceService', () => {
  it('backs up and clears user data while preserving connector settings', async () => {
    const token = service.getState().settings.jobSyncToken;
    await service.saveProfile({
      nickname: 'Cleanup Candidate', currentRole: 'Engineer', yearsExperience: 3, education: 'Bachelor',
      targetRoles: ['Platform Engineer'], skills: [{ name: 'Kubernetes', level: '熟悉' }]
    });
    await service.saveProject({
      name: 'Cleanup Project', role: 'Engineer', background: 'Production platform',
      responsibilities: 'Operations', results: 'Stable release', techStack: ['Kubernetes']
    });
    await service.analyzeJob({ title: 'Platform Engineer', company: 'Example', rawText: 'Kubernetes and Docker' });

    const result = await service.clearWorkspaceData();
    const backup = JSON.parse(await readFile(result.backup.path, 'utf8')) as ReturnType<WorkspaceService['getState']>;

    expect(backup.profile.nickname).toBe('Cleanup Candidate');
    expect(backup.projects).toHaveLength(1);
    expect(backup.jobs).toHaveLength(1);
    expect(result.state.profile.nickname).toBe('');
    expect(result.state.projects).toHaveLength(0);
    expect(result.state.jobs).toHaveLength(0);
    expect(result.state.settings.jobSyncToken).toBe(token);
    expect(result.state.jobSources.map((item) => item.id)).toEqual(service.getState().jobSources.map((item) => item.id));
  });

  it('recomputes saved job analysis when the career profile or project evidence changes', async () => {
    await service.saveProfile({
      nickname: 'Candidate', currentRole: 'Operations', yearsExperience: 2, education: 'Bachelor',
      targetRoles: ['Platform Engineer'], skills: []
    });
    const job = await service.analyzeJob({
      title: 'Platform Engineer', company: 'Example', rawText: 'Must be familiar with Kubernetes and Docker.'
    });
    expect(job.requirements.find((item) => item.label === 'Kubernetes')?.matchStatus).toBe('gap');

    await service.saveProfile({
      nickname: 'Candidate', currentRole: 'Operations', yearsExperience: 2, education: 'Bachelor',
      targetRoles: ['Platform Engineer'], skills: [{ name: 'Kubernetes', level: '熟悉' }]
    });
    const afterProfile = service.getState().jobs.find((item) => item.id === job.id)!;
    expect(afterProfile.requirements.find((item) => item.label === 'Kubernetes')?.matchStatus).toBe('related');
    const skillId = service.getState().profile.skills[0].id;

    await service.saveProject({
      name: 'Cluster Platform', role: 'Engineer', background: 'Kubernetes production platform',
      responsibilities: 'Operated Kubernetes clusters', results: 'Improved deployment reliability', techStack: ['Kubernetes']
    });
    const afterProject = service.getState().jobs.find((item) => item.id === job.id)!;
    expect(afterProject.requirements.find((item) => item.label === 'Kubernetes')?.matchStatus).toBe('evidenced');
    expect(afterProject.createdAt).toBe(job.createdAt);
    expect(service.getState().knowledge.find((item) => item.id === `job-knowledge-${job.id}`)?.updatedAt).toBe(afterProject.updatedAt);

    await service.saveProfile({
      nickname: 'Candidate', currentRole: 'Operations', yearsExperience: 3, education: 'Bachelor',
      targetRoles: ['Platform Engineer'], skills: [{ name: 'Kubernetes', level: '掌握' }]
    });
    expect(service.getState().profile.skills[0].id).toBe(skillId);
  });

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
    const answerKnowledge = service.getState().knowledge.find((item) => item.type === 'answer');
    expect(answerKnowledge?.contentMarkdown).toContain('## 优化回答');
    expect(answerKnowledge?.contentMarkdown).toContain('## 不足');
    expect(answerKnowledge?.contentMarkdown).toContain('## 复习任务');
    expect(answerKnowledge?.reviewAt).toBeTruthy();
    expect(service.getState().coachSessions[0].linkedTrainingSessionId).toBe(session.id);
    expect(service.getState().knowledge.filter((item) => item.projectIds.includes(project.id))).toHaveLength(1);
    expect(service.getState().knowledge.some((item) => item.jobIds.includes(job.id) && item.type === 'jd')).toBe(true);
  });

  it('does not create knowledge as a hidden side effect of saving a project', async () => {
    const project = await service.saveProject({
      name: '可编辑项目', role: '运维', background: '本地项目', responsibilities: '负责发布', results: '完成上线', techStack: ['Docker']
    });
    expect(project.relatedKnowledgeIds).toHaveLength(0);
    expect(service.getState().knowledge).toHaveLength(0);
    const saved = await service.saveProject({ ...project, results: '完成上线并通过接口验证' });
    expect(saved.results).toBe('完成上线并通过接口验证');
    expect(saved.relatedKnowledgeIds).toHaveLength(0);
    expect(service.getState().knowledge).toHaveLength(0);
    expect(service.getState().projects.find((item) => item.id === project.id)?.results).toContain('接口验证');
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

  it('moves synced jobs to trash, restores them and deletes them permanently', async () => {
    const token = service.getState().settings.jobSyncToken;
    await service.ingestSyncedJobs({
      token,
      sourceSite: 'boss',
      sourceName: 'BOSS 直聘',
      pageUrl: 'https://www.zhipin.com/web/geek/job?query=Linux',
      jobs: [{
        externalId: 'trash-001',
        sourceUrl: 'https://www.zhipin.com/job_detail/trash-001.html',
        title: 'Linux 运维工程师',
        company: '示例科技',
        location: '成都高新区',
        salaryRange: '8K-12K',
        description: '负责 Linux 服务器运维、监控告警和现场交付支持。'
      }]
    });

    const id = service.getState().syncedJobs[0].id;
    expect((await service.updateSyncedJobStatus(id, 'trashed')).status).toBe('trashed');
    expect((await service.updateSyncedJobStatus(id, 'new')).status).toBe('new');
    expect((await service.bulkUpdateSyncedJobStatus([id], 'trashed')).updated).toBe(1);
    expect(service.getState().syncedJobs[0].status).toBe('trashed');
    expect((await service.bulkUpdateSyncedJobStatus([id], 'trashed')).updated).toBe(0);
    expect((await service.deleteSyncedJobPermanently(id)).deleted).toBe(true);
    expect(service.getState().syncedJobs.some((job) => job.id === id)).toBe(false);
  });

  it('restores and permanently deletes multiple trashed jobs in one operation', async () => {
    const token = service.getState().settings.jobSyncToken;
    await service.ingestSyncedJobs({
      token,
      sourceSite: 'boss',
      sourceName: 'BOSS 直聘',
      pageUrl: 'https://www.zhipin.com/web/geek/job?query=Linux',
      jobs: [
        { sourceUrl: 'https://www.zhipin.com/job_detail/bulk-1.html', title: 'Linux 运维工程师', company: '示例一', description: '负责 Linux 和 Docker 运维。' },
        { sourceUrl: 'https://www.zhipin.com/job_detail/bulk-2.html', title: '云平台工程师', company: '示例二', description: '负责 Kubernetes 平台运维。' },
        { sourceUrl: 'https://www.zhipin.com/job_detail/bulk-3.html', title: '数据库工程师', company: '示例三', description: '负责数据库日常运维。' }
      ]
    });

    const [first, second, active] = service.getState().syncedJobs;
    await service.promoteSyncedJob(first.id);
    expect((await service.bulkUpdateSyncedJobStatus([first.id, second.id], 'trashed')).updated).toBe(2);
    expect((await service.bulkRestoreSyncedJobs([first.id, second.id])).restored).toBe(2);
    expect(service.getState().syncedJobs.find((job) => job.id === first.id)?.status).toBe('saved');
    expect(service.getState().syncedJobs.find((job) => job.id === second.id)?.status).toBe('new');

    await service.bulkUpdateSyncedJobStatus([first.id, second.id], 'trashed');
    expect((await service.bulkDeleteSyncedJobsPermanently([first.id, second.id, active.id])).deleted).toBe(2);
    expect(service.getState().syncedJobs.map((job) => job.id)).toEqual([active.id]);
  });

  it('rejects a browser sync batch with the wrong local token', async () => {
    await expect(service.ingestSyncedJobs({
      token: 'wrong-token',
      sourceSite: 'boss',
      pageUrl: 'https://www.zhipin.com/web/geek/job',
      jobs: [{ sourceUrl: 'https://www.zhipin.com/job_detail/test.html', title: '测试岗位' }]
    })).rejects.toThrow('岗位同步令牌无效');
  });

  it('marks planned connectors as not connected instead of claiming validation', async () => {
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
    expect(run.status).toBe('warning');
    expect(run.message).toContain('尚未接入');
    expect(service.getState().jobSyncRuns[0].sourceId).toBe(source.id);
  });

  it('performs a real health request for the local browser bridge', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, service: 'Interview OS Job Sync Bridge'
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const source = service.getState().jobSources.find((item) => item.connectorType === 'browser-extension');
    expect(source).toBeTruthy();
    const run = await service.validateJobSource(source!.id);
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:19426/health', expect.objectContaining({ method: 'GET' }));
    expect(run.status).toBe('success');
    expect(run.message).toContain('真实连通');
    expect(run.message).toContain('不代表招聘网站抓取已成功');
  });

  it('ships configured source entries for visible-site adapters and reserved connectors', async () => {
    const sources = createDefaultJobSources('2026-07-22T00:00:00.000Z');
    const ids = sources.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining([
      'source-browser-extension',
      'source-boss-visible',
      'source-zhaopin-visible',
      'source-51job-visible',
      'source-lagou-visible',
      'source-liepin-visible',
      'source-liepin-mcp',
      'source-boss-mcp',
      'source-company-careers',
      'source-google-jobs-api',
      'source-linkedin-api',
      'source-custom-scraper',
      'source-generic-import'
    ]));
    expect(sources.filter((item) => item.status === 'planned')).toHaveLength(0);
  });

  it('merges new default source entries into an older workspace without dropping custom sources', async () => {
    const oldState = createEmptyState();
    oldState.jobSources = [
      {
        id: 'source-liepin-mcp', name: '猎聘官方 MCP', platform: '猎聘', connectorType: 'mcp',
        status: 'planned', enabled: false, endpoint: '', intervalMinutes: 30, capabilities: ['search'],
        notes: '', createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z'
      },
      {
        id: 'custom-source', name: '自定义源', platform: '内部', connectorType: 'scraper',
        status: 'configured', enabled: false, endpoint: 'http://127.0.0.1:19000/jobs', intervalMinutes: 30,
        capabilities: ['search'], notes: '用户自定义', createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z'
      }
    ];

    const migrated = validateWorkspaceState(oldState);

    expect(migrated.jobSources.some((item) => item.id === 'source-zhaopin-visible')).toBe(true);
    expect(migrated.jobSources.find((item) => item.id === 'source-liepin-mcp')?.status).toBe('configured');
    expect(migrated.jobSources.find((item) => item.id === 'custom-source')?.notes).toBe('用户自定义');
    expect(migrated.jobFilterPresets.some((item) => item.id === 'preset-product-ai-saas')).toBe(true);
    expect(migrated.jobAlertRules.some((item) => item.presetId === 'preset-product-ai-saas' && item.channel === 'in-app')).toBe(true);
  });

  it('validates a visible recruitment-site adapter without pretending to scrape in the background', async () => {
    const source = service.getState().jobSources.find((item) => item.id === 'source-zhaopin-visible');
    expect(source).toBeTruthy();

    const run = await service.validateJobSource(source!.id);

    expect(run.status).toBe('dry-run');
    expect(run.message).toContain('页面适配器配置已就绪');
    expect(run.message).toContain('不会绕过登录、验证码或平台风控');
  });

  it('binds an application to the resume made for the same JD', async () => {
    const job = await service.analyzeJob({ title: '平台工程师', rawText: 'Kubernetes' });
    const otherJob = await service.analyzeJob({ title: '数据工程师', rawText: 'SQL' });
    const resume = await service.saveResumeVariant({ name: '平台定向版', jobId: job.id, headline: '平台工程师', summary: '平台经验', highlights: [], projectIds: [], skillIds: [] });
    const saved = await service.saveApplication({ jobId: job.id, resumeVariantId: resume.id, title: job.title });
    expect(saved.resumeVariantId).toBe(resume.id);
    await expect(service.saveApplication({ jobId: otherJob.id, resumeVariantId: resume.id, title: otherJob.title })).rejects.toThrow('投递简历与目标 JD 不匹配');
  });

  it('backs up and deletes one job analysis without deleting linked user records', async () => {
    const job = await service.analyzeJob({ title: 'Platform Engineer', company: 'Example', rawText: 'Kubernetes and Docker' });
    const retainedJob = await service.analyzeJob({ title: 'Database Engineer', company: 'Example', rawText: 'MySQL and SQL' });
    const resume = await service.saveResumeVariant({
      name: 'Platform Resume', jobId: job.id, headline: 'Platform Engineer', summary: 'Platform experience',
      highlights: [], projectIds: [], skillIds: []
    });
    const application = await service.saveApplication({ jobId: job.id, resumeVariantId: resume.id, title: job.title });

    const result = await service.deleteJobAnalysis(job.id);
    const backup = JSON.parse(await readFile(result.backup!.path, 'utf8')) as ReturnType<WorkspaceService['getState']>;

    expect(result.deleted).toBe(true);
    expect(result.unlinkedRecords).toBeGreaterThanOrEqual(2);
    expect(backup.jobs.some((item) => item.id === job.id)).toBe(true);
    expect(service.getState().jobs.map((item) => item.id)).toEqual([retainedJob.id]);
    expect(service.getState().knowledge.some((item) => item.id === `job-knowledge-${job.id}`)).toBe(false);
    expect(service.getState().resumeVariants.find((item) => item.id === resume.id)?.jobId).toBeUndefined();
    expect(service.getState().applications.find((item) => item.id === application.id)?.jobId).toBeUndefined();
  });

  it('deletes selected or all custom job analyses in one backed-up operation', async () => {
    const first = await service.analyzeJob({ title: 'Platform Engineer', rawText: 'Kubernetes and Docker' });
    const second = await service.analyzeJob({ title: 'Database Engineer', rawText: 'MySQL and SQL' });
    const retained = await service.analyzeJob({ title: 'Network Engineer', rawText: 'Nginx and TCP/IP' });

    const selectedResult = await service.deleteJobAnalyses([first.id, second.id, 'missing-id', first.id]);
    const selectedBackup = JSON.parse(await readFile(selectedResult.backup!.path, 'utf8')) as ReturnType<WorkspaceService['getState']>;

    expect(selectedResult).toMatchObject({ deleted: 2, requested: 3 });
    expect(selectedBackup.jobs).toHaveLength(3);
    expect(service.getState().jobs.map((item) => item.id)).toEqual([retained.id]);

    const allResult = await service.deleteJobAnalyses(service.getState().jobs.map((job) => job.id));
    expect(allResult).toMatchObject({ deleted: 1, requested: 1 });
    expect(service.getState().jobs).toHaveLength(0);
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

  it('checks watched company career pages on startup and imports matching structured jobs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`
      <html><head><script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Kubernetes 技术支持工程师",
        "url": "https://careers.example.com/jobs/k8s-support",
        "datePosted": "2026-07-22",
        "description": "负责 Kubernetes、Docker、Linux 和客户技术支持。",
        "hiringOrganization": { "@type": "Organization", "name": "示例云科技" },
        "jobLocation": { "@type": "Place", "address": { "addressLocality": "杭州" } },
        "baseSalary": { "@type": "MonetaryAmount", "value": { "minValue": 20, "maxValue": 30, "unitText": "K" } }
      }
      </script></head></html>
    `, { status: 200, headers: { 'content-type': 'text/html' } })));
    await service.saveCompanyWatch({ name: '示例云科技', careerUrl: 'https://careers.example.com', priority: 'focus' });

    const runs = await service.checkCompanyWatchesOnStartup();
    const state = service.getState();

    expect(runs).toHaveLength(1);
    expect(runs[0].added).toBe(1);
    expect(state.syncedJobs[0].title).toBe('Kubernetes 技术支持工程师');
    expect(state.syncedJobs[0].sourceSite).toBe('company-careers');
    expect(state.companyWatches[0].openJobs).toBe(1);
    expect(state.jobSyncRuns[0].message).toContain('启动自动检测完成');
  });
});
