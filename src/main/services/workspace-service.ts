import { createHash, randomUUID } from 'node:crypto';
import type {
  CareerAgentRun,
  CareerMemoryInput,
  CareerMemoryItem,
  CareerSearchPlan,
  CareerSearchPlanInput,
  CompanyWatch,
  CompanyWatchInput,
  CoachSession,
  JobAlertRule,
  JobAlertRuleInput,
  JobApplication,
  JobApplicationInput,
  JobDescription,
  JobFilterPreset,
  JobFilterPresetInput,
  JobInput,
  JobSourceConfig,
  JobSourceInput,
  JobSyncBatchInput,
  JobSyncRun,
  KnowledgeInput,
  KnowledgeItem,
  ProjectExperience,
  ProjectInput,
  ProfileInput,
  CareerProfile,
  ResumeVariant,
  ResumeVariantInput,
  SyncedJob,
  SyncedJobStatus,
  TrainingAnswerInput,
  TrainingFinalizeInput,
  TrainingSession,
  TrainingStartInput,
  WorkspaceState
} from '../../shared/domain';
import { createDemoState, nowIso } from '../../shared/domain';
import { calculateResumeMatch } from '../../shared/career-engine';
import { matchJobsForPlan } from '../../shared/career-agent-engine';
import { analyzeJob } from '../../shared/job-analyzer';
import { analyzeSyncedJob } from '../../shared/job-intelligence';
import { buildPressureSummary, createPressureFollowUp, diagnosePressureAnswer, generateQuestions, scoreAnswer } from '../../shared/training-engine';
import {
  validateJobInput,
  validateJobApplicationInput,
  validateJobAlertRuleInput,
  validateJobFilterPresetInput,
  validateJobSyncBatchInput,
  validateJobSourceInput,
  validateCareerMemoryInput,
  validateCareerSearchPlanInput,
  validateCompanyWatchInput,
  validateKnowledgeInput,
  validateProjectInput,
  validateResumeVariantInput,
  validateTrainingAnswerInput,
  validateTrainingFinalizeInput,
  validateTrainingStartInput
} from '../../shared/validation';
import type { AtomicWorkspaceRepository } from '../storage/workspace-repository';

function upsertCoachSession(
  draft: WorkspaceState,
  session: TrainingSession,
  context?: Pick<CoachSession, 'mode' | 'resumeId' | 'projectIds'>
): void {
  const existingIndex = draft.coachSessions.findIndex((item) => item.linkedTrainingSessionId === session.id);
  const existing = existingIndex >= 0 ? draft.coachSessions[existingIndex] : undefined;
  const messages: CoachSession['messages'] = [];
  for (const question of session.questions) {
    messages.push({ id: `coach-question-${question.id}`, role: 'coach', content: question.text, createdAt: session.createdAt });
    for (const attempt of session.attempts.filter((item) => item.questionId === question.id)) {
      messages.push({ id: `coach-answer-${attempt.id}`, role: 'user', content: attempt.answer, createdAt: attempt.createdAt });
    }
  }
  const entity: CoachSession = {
    id: existing?.id ?? randomUUID(),
    mode: context?.mode ?? existing?.mode ?? (session.language === 'en-US' ? 'english-interview' : 'mock-interview'),
    title: session.title,
    status: session.status,
    targetJobId: session.jobId,
    resumeId: context?.resumeId ?? existing?.resumeId,
    projectIds: context?.projectIds ?? existing?.projectIds ?? (session.projectId ? [session.projectId] : []),
    messages,
    answers: session.attempts,
    report: session.summary,
    linkedTrainingSessionId: session.id,
    createdAt: existing?.createdAt ?? session.createdAt,
    updatedAt: session.updatedAt
  };
  if (existingIndex >= 0) draft.coachSessions[existingIndex] = entity;
  else draft.coachSessions.unshift(entity);
}

function upsertGeneratedKnowledge(draft: WorkspaceState, entity: KnowledgeItem): void {
  const index = draft.knowledge.findIndex((item) => item.id === entity.id);
  if (index >= 0) draft.knowledge[index] = { ...entity, createdAt: draft.knowledge[index].createdAt };
  else draft.knowledge.unshift(entity);
}

function flattenJsonLd(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const record = value as Record<string, unknown>;
  const nested = [
    ...flattenJsonLd(record['@graph']),
    ...flattenJsonLd(record.itemListElement)
  ];
  return [record, ...nested];
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function locationValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(locationValue).filter(Boolean).join(' / ');
  if (!value || typeof value !== 'object') return '';
  const address = (value as Record<string, unknown>).address;
  if (!address || typeof address !== 'object') return '';
  const record = address as Record<string, unknown>;
  return [record.addressLocality, record.addressRegion, record.addressCountry].map(textValue).filter(Boolean).join(' ');
}

function salaryValue(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const amount = record.value;
  if (amount && typeof amount === 'object') {
    const nested = amount as Record<string, unknown>;
    const min = textValue(nested.minValue);
    const max = textValue(nested.maxValue);
    const unit = textValue(nested.unitText);
    if (min || max) return [min && max ? `${min}-${max}` : min || max, unit].filter(Boolean).join(' ');
    return textValue(nested.value);
  }
  return textValue(amount);
}

function extractStructuredCompanyJobs(html: string, pageUrl: string, fallbackCompany: string): JobSyncBatchInput['jobs'] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)];
  const jobs: JobSyncBatchInput['jobs'] = [];
  for (const [, content] of scripts) {
    try {
      const parsed = JSON.parse(content.trim());
      for (const item of flattenJsonLd(parsed)) {
        const type = item['@type'];
        const types = Array.isArray(type) ? type.map(String) : [String(type ?? '')];
        if (!types.some((entry) => entry.toLocaleLowerCase() === 'jobposting')) continue;
        const sourceUrl = new URL(textValue(item.url) || pageUrl, pageUrl).toString();
        const company = item.hiringOrganization && typeof item.hiringOrganization === 'object'
          ? textValue((item.hiringOrganization as Record<string, unknown>).name)
          : fallbackCompany;
        jobs.push({
          externalId: textValue((item.identifier as Record<string, unknown> | undefined)?.value) || sourceUrl,
          sourceUrl,
          title: textValue(item.title),
          company: company || fallbackCompany,
          location: locationValue(item.jobLocation),
          salaryRange: salaryValue(item.baseSalary),
          description: textValue(item.description),
          postedAt: textValue(item.datePosted) || undefined
        });
      }
    } catch {
      // Ignore invalid third-party JSON-LD blocks.
    }
  }
  return jobs.filter((item) => item.title && item.sourceUrl).slice(0, 100);
}

export class WorkspaceService {
  constructor(private readonly repository: AtomicWorkspaceRepository) {}

  getState(): WorkspaceState {
    return this.repository.getState();
  }

  async resetDemo(): Promise<WorkspaceState> {
    return this.repository.replaceState(createDemoState());
  }

  async saveProfile(input: ProfileInput): Promise<CareerProfile> {
    if (!input || typeof input !== 'object') throw new Error('职业档案不能为空');
    const nickname = String(input.nickname ?? '').trim().slice(0, 80);
    const currentRole = String(input.currentRole ?? '').trim().slice(0, 120);
    const education = String(input.education ?? '').trim().slice(0, 120);
    const yearsExperience = Math.max(0, Math.min(60, Number(input.yearsExperience) || 0));
    const targetRoles = [...new Set((input.targetRoles ?? []).map((item) => String(item).trim()).filter(Boolean))].slice(0, 10);
    const skills = (input.skills ?? []).slice(0, 100).map((item) => ({
      id: randomUUID(),
      name: String(item.name ?? '').trim().slice(0, 80),
      level: item.level
    })).filter((item) => item.name);
    return this.repository.update((draft) => {
      draft.profile = { nickname, currentRole, education, yearsExperience, targetRoles, skills, updatedAt: nowIso() };
      return draft.profile;
    });
  }

  async saveKnowledge(input: KnowledgeInput): Promise<KnowledgeItem> {
    const valid = validateKnowledgeInput(input);
    return this.repository.update((draft) => {
      const now = nowIso();
      const existingIndex = valid.id ? draft.knowledge.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.knowledge[existingIndex] : undefined;
      const entity: KnowledgeItem = {
        id: existing?.id ?? randomUUID(),
        type: valid.type,
        title: valid.title,
        contentMarkdown: valid.contentMarkdown,
        tags: valid.tags ?? [],
        status: valid.status ?? 'draft',
        source: valid.source ?? '',
        relatedIds: valid.relatedIds ?? [],
        jobIds: valid.jobIds ?? [],
        projectIds: valid.projectIds ?? [],
        skillNames: valid.skillNames ?? [],
        visibility: valid.visibility ?? 'private',
        reviewAt: valid.reviewAt,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      if (existingIndex >= 0) draft.knowledge[existingIndex] = entity;
      else draft.knowledge.unshift(entity);
      return entity;
    });
  }

  async deleteKnowledge(id: string): Promise<{ deleted: boolean }> {
    return this.repository.update((draft) => {
      const before = draft.knowledge.length;
      draft.knowledge = draft.knowledge.filter((item) => item.id !== id);
      for (const item of draft.knowledge) item.relatedIds = item.relatedIds.filter((related) => related !== id);
      for (const project of draft.projects) {
        project.relatedKnowledgeIds = project.relatedKnowledgeIds.filter((related) => related !== id);
      }
      return { deleted: draft.knowledge.length < before };
    });
  }

  async saveProject(input: ProjectInput): Promise<ProjectExperience> {
    const valid = validateProjectInput(input);
    return this.repository.update((draft) => {
      const now = nowIso();
      const existingIndex = valid.id ? draft.projects.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.projects[existingIndex] : undefined;
      const entity: ProjectExperience = {
        id: existing?.id ?? randomUUID(),
        name: valid.name,
        role: valid.role,
        background: valid.background,
        objective: valid.objective ?? '',
        architecture: valid.architecture ?? '',
        responsibilities: valid.responsibilities,
        actions: valid.actions ?? '',
        challenges: valid.challenges ?? '',
        results: valid.results,
        techStack: valid.techStack ?? [],
        relatedKnowledgeIds: valid.relatedKnowledgeIds ?? [],
        pitch30: valid.pitch30 ?? '',
        pitch90: valid.pitch90 ?? '',
        deepDive: valid.deepDive ?? '',
        interviewRevisionNotes: valid.interviewRevisionNotes ?? '',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      if (existingIndex >= 0) draft.projects[existingIndex] = entity;
      else draft.projects.unshift(entity);
      return entity;
    });
  }

  async analyzeJob(input: JobInput): Promise<JobDescription> {
    const valid = validateJobInput(input);
    return this.repository.update((draft) => {
      const entity = analyzeJob(valid, draft);
      draft.jobs.unshift(entity);
      upsertGeneratedKnowledge(draft, {
        id: `job-knowledge-${entity.id}`,
        type: 'jd',
        title: `${entity.company ? `${entity.company} · ` : ''}${entity.title}｜JD 分析`,
        contentMarkdown: `# ${entity.title}\n\n## 技能与能力要求\n\n${entity.requirements.map((item) => `- **${item.label}**：${item.priority} / ${item.matchStatus}${item.evidenceSummary ? ` / ${item.evidenceSummary}` : ''}`).join('\n')}\n\n## 面试重点与准备任务\n\n${entity.tasks.map((item) => `- [${item.completed ? 'x' : ' '}] ${item.title}`).join('\n')}`,
        tags: ['JD 分析', entity.title],
        status: 'review',
        source: '自动生成 · JD 分析',
        relatedIds: [entity.id],
        jobIds: [entity.id],
        projectIds: [],
        skillNames: entity.requirements.filter((item) => item.category === 'technology').map((item) => item.label),
        visibility: 'private',
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      });
      return entity;
    });
  }

  async saveApplication(input: JobApplicationInput): Promise<JobApplication> {
    const valid = validateJobApplicationInput(input);
    return this.repository.update((draft) => {
      const job = valid.jobId ? draft.jobs.find((item) => item.id === valid.jobId) : undefined;
      if (valid.jobId && !job) throw new Error('未找到关联的 JD');
      const resume = valid.resumeVariantId ? draft.resumeVariants.find((item) => item.id === valid.resumeVariantId) : undefined;
      if (valid.resumeVariantId && !resume) throw new Error('未找到投递使用的简历版本');
      if (job && resume?.jobId && resume.jobId !== job.id) throw new Error('投递简历与目标 JD 不匹配');
      const now = nowIso();
      const existingIndex = valid.id ? draft.applications.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.applications[existingIndex] : undefined;
      const company = valid.company || job?.company || '';
      const title = valid.title || job?.title || '';
      if (!title) throw new Error('岗位名称不能为空');
      const status = valid.status ?? existing?.status ?? 'saved';
      const history = existing?.statusHistory ?? [];
      if (!existing || existing.status !== status) {
        history.push({
          id: randomUUID(),
          status,
          note: existing ? `状态从 ${existing.status} 更新为 ${status}` : '创建求职机会',
          occurredAt: now
        });
      }
      const entity: JobApplication = {
        id: existing?.id ?? randomUUID(),
        jobId: job?.id,
        resumeVariantId: resume?.id,
        company,
        title,
        source: valid.source ?? '',
        sourceUrl: valid.sourceUrl ?? '',
        location: valid.location ?? '',
        salaryRange: valid.salaryRange ?? '',
        status,
        priority: valid.priority ?? 'medium',
        deadline: valid.deadline,
        appliedAt: valid.appliedAt ?? (status === 'applied' && !existing?.appliedAt ? now : existing?.appliedAt),
        nextAction: valid.nextAction ?? '',
        nextActionAt: valid.nextActionAt,
        notes: valid.notes ?? '',
        greetingDraft: valid.greetingDraft ?? '',
        submissionMode: valid.submissionMode ?? 'manual',
        statusHistory: history,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      if (existingIndex >= 0) draft.applications[existingIndex] = entity;
      else draft.applications.unshift(entity);
      return entity;
    });
  }

  async saveResumeVariant(input: ResumeVariantInput): Promise<ResumeVariant> {
    const valid = validateResumeVariantInput(input);
    return this.repository.update((draft) => {
      const job = valid.jobId ? draft.jobs.find((item) => item.id === valid.jobId) : undefined;
      if (valid.jobId && !job) throw new Error('未找到关联的 JD');
      const projectIds = valid.projectIds ?? [];
      const skillIds = valid.skillIds ?? [];
      if (projectIds.some((id) => !draft.projects.some((item) => item.id === id))) throw new Error('简历包含不存在的项目经历');
      if (skillIds.some((id) => !draft.profile.skills.some((item) => item.id === id))) throw new Error('简历包含不存在的技能');
      const now = nowIso();
      const existingIndex = valid.id ? draft.resumeVariants.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.resumeVariants[existingIndex] : undefined;
      const match = calculateResumeMatch(draft, valid);
      const entity: ResumeVariant = {
        id: existing?.id ?? randomUUID(),
        name: valid.name,
        jobId: job?.id,
        headline: valid.headline,
        summary: valid.summary,
        highlights: valid.highlights ?? [],
        projectIds,
        skillIds,
        targetKeywords: match.targetKeywords,
        matchScore: match.score,
        status: valid.status ?? 'draft',
        version: existing ? existing.version + 1 : 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      if (existingIndex >= 0) draft.resumeVariants[existingIndex] = entity;
      else draft.resumeVariants.unshift(entity);
      return entity;
    });
  }

  async saveJobSource(input: JobSourceInput): Promise<JobSourceConfig> {
    const valid = validateJobSourceInput(input);
    return this.repository.update((draft) => {
      const now = nowIso();
      const existingIndex = valid.id ? draft.jobSources.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.jobSources[existingIndex] : undefined;
      const entity: JobSourceConfig = {
        id: existing?.id ?? randomUUID(),
        name: valid.name,
        platform: valid.platform,
        connectorType: valid.connectorType,
        status: valid.status ?? existing?.status ?? 'planned',
        enabled: valid.enabled ?? existing?.enabled ?? false,
        endpoint: valid.endpoint ?? '',
        intervalMinutes: valid.intervalMinutes ?? 30,
        capabilities: valid.capabilities ?? [],
        notes: valid.notes ?? '',
        lastSyncAt: existing?.lastSyncAt,
        lastError: existing?.lastError,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      if (existingIndex >= 0) draft.jobSources[existingIndex] = entity;
      else draft.jobSources.push(entity);
      return entity;
    });
  }

  async saveJobFilterPreset(input: JobFilterPresetInput): Promise<JobFilterPreset> {
    const valid = validateJobFilterPresetInput(input);
    return this.repository.update((draft) => {
      const now = nowIso();
      const existingIndex = valid.id ? draft.jobFilterPresets.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.jobFilterPresets[existingIndex] : undefined;
      const entity: JobFilterPreset = {
        id: existing?.id ?? randomUUID(), name: valid.name,
        includeKeywords: valid.includeKeywords ?? [], excludeKeywords: valid.excludeKeywords ?? [], cities: valid.cities ?? [],
        industries: valid.industries ?? [], sources: valid.sources ?? [], minSalaryK: valid.minSalaryK,
        minMatchScore: valid.minMatchScore ?? 60, minTrustScore: valid.minTrustScore ?? 70,
        remoteOnly: valid.remoteOnly ?? false, freshWithinDays: valid.freshWithinDays ?? 30,
        createdAt: existing?.createdAt ?? now, updatedAt: now
      };
      if (existingIndex >= 0) draft.jobFilterPresets[existingIndex] = entity;
      else draft.jobFilterPresets.unshift(entity);
      return entity;
    });
  }

  async deleteJobFilterPreset(id: string): Promise<{ deleted: boolean }> {
    return this.repository.update((draft) => {
      const before = draft.jobFilterPresets.length;
      draft.jobFilterPresets = draft.jobFilterPresets.filter((item) => item.id !== id);
      for (const alert of draft.jobAlertRules) {
        if (alert.presetId === id) {
          alert.presetId = undefined;
          alert.updatedAt = nowIso();
        }
      }
      return { deleted: draft.jobFilterPresets.length < before };
    });
  }

  async saveJobAlertRule(input: JobAlertRuleInput): Promise<JobAlertRule> {
    const valid = validateJobAlertRuleInput(input);
    return this.repository.update((draft) => {
      if (valid.presetId && !draft.jobFilterPresets.some((item) => item.id === valid.presetId)) throw new Error('未找到关联的筛选规则');
      const now = nowIso();
      const existingIndex = valid.id ? draft.jobAlertRules.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.jobAlertRules[existingIndex] : undefined;
      const entity: JobAlertRule = {
        id: existing?.id ?? randomUUID(), name: valid.name, presetId: valid.presetId,
        channel: valid.channel ?? 'in-app', enabled: valid.enabled ?? false, threshold: valid.threshold ?? 1,
        target: valid.target ?? '', createdAt: existing?.createdAt ?? now, updatedAt: now
      };
      if (existingIndex >= 0) draft.jobAlertRules[existingIndex] = entity;
      else draft.jobAlertRules.unshift(entity);
      return entity;
    });
  }

  async deleteJobAlertRule(id: string): Promise<{ deleted: boolean }> {
    return this.repository.update((draft) => {
      const before = draft.jobAlertRules.length;
      draft.jobAlertRules = draft.jobAlertRules.filter((item) => item.id !== id);
      return { deleted: draft.jobAlertRules.length < before };
    });
  }

  async validateJobSource(id: string): Promise<JobSyncRun> {
    const sourceSnapshot = this.repository.getState().jobSources.find((item) => item.id === id);
    if (!sourceSnapshot) throw new Error('未找到岗位数据源');
    const startedAt = Date.now();
    let status: JobSyncRun['status'] = 'warning';
    let message = '尚未接入可运行适配器，未发起网络请求。';

    if (sourceSnapshot.connectorType === 'import') {
      status = 'dry-run';
      message = '导入字段与配置结构已检查；尚未选择或解析实际文件。';
    } else if (sourceSnapshot.status === 'planned') {
      status = 'warning';
      message = '尚未接入可运行适配器，未发起网络请求。';
    } else if (sourceSnapshot.connectorType === 'browser-extension' && sourceSnapshot.endpoint.startsWith('browser-extension://')) {
      status = 'dry-run';
      message = '页面适配器配置已就绪；请在对应招聘站点打开已登录且可见的岗位页后，通过浏览器扩展同步。不会绕过登录、验证码或平台风控。';
    } else if (sourceSnapshot.connectorType === 'company-careers') {
      status = 'dry-run';
      message = '公司官网监控框架已配置；会基于公司关注清单检测公开招聘页和 JobPosting 结构化数据，匹配求职意向后进入岗位中心。';
    } else if (sourceSnapshot.connectorType === 'api' && !sourceSnapshot.enabled) {
      status = 'dry-run';
      message = '结构化 API 入口已配置；启用前需填写合法 API Key 或聚合服务授权，当前未发起真实请求。';
    } else if (sourceSnapshot.connectorType === 'mcp' && sourceSnapshot.endpoint.startsWith('https://')) {
      status = 'dry-run';
      message = '官方 MCP 端点契约已配置；正式调用需要用户授权 Key，并遵守平台频率限制。当前未携带凭据请求。';
    } else if (sourceSnapshot.endpoint) {
      const endpoint = sourceSnapshot.connectorType === 'browser-extension'
        ? `${sourceSnapshot.endpoint.replace(/\/$/u, '')}/health`
        : sourceSnapshot.endpoint;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      try {
        const response = await fetch(endpoint, { method: 'GET', signal: controller.signal });
        if (sourceSnapshot.connectorType === 'browser-extension' && response.ok) {
          const body = await response.json().catch(() => ({})) as { ok?: boolean; service?: string };
          if (body.ok && body.service === 'Interview OS Job Sync Bridge') {
            status = 'success';
            message = '真实连通：本机 Bridge /health 返回有效响应。仅证明桥接服务可用，不代表招聘网站抓取已成功。';
          } else {
            message = '端点可以访问，但响应不是 Interview OS Bridge；未验证岗位同步能力。';
          }
        } else if (response.ok) {
          status = 'success';
          message = `真实网络请求返回 HTTP ${response.status}；端点可访问，但尚未执行登录、搜索或岗位抓取。`;
        } else {
          message = `端点已响应 HTTP ${response.status}；网络可达，但鉴权或功能尚未通过。`;
        }
      } catch (error) {
        status = 'failed';
        message = `真实连通失败：${error instanceof Error && error.name === 'AbortError' ? '请求 3 秒超时' : error instanceof Error ? error.message : '未知网络错误'}。`;
      } finally {
        clearTimeout(timeout);
      }
    }

    return this.repository.update((draft) => {
      const source = draft.jobSources.find((item) => item.id === id);
      if (!source) throw new Error('未找到岗位数据源');
      const now = nowIso();
      const run: JobSyncRun = {
        id: randomUUID(), sourceId: source.id, sourceName: source.name, status, fetched: 0, added: 0, updated: 0,
        durationMs: Date.now() - startedAt,
        message,
        createdAt: now, updatedAt: now
      };
      draft.jobSyncRuns.unshift(run);
      draft.jobSyncRuns = draft.jobSyncRuns.slice(0, 200);
      source.updatedAt = now;
      return run;
    });
  }

  async saveCareerSearchPlan(input: CareerSearchPlanInput): Promise<CareerSearchPlan> {
    const valid = validateCareerSearchPlanInput(input);
    return this.repository.update((draft) => {
      const now = nowIso();
      const existingIndex = valid.id ? draft.careerSearchPlans.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.careerSearchPlans[existingIndex] : undefined;
      const entity: CareerSearchPlan = {
        id: existing?.id ?? randomUUID(), title: valid.title || valid.keywords?.[0] || '求职搜索计划', goal: valid.goal,
        cities: valid.cities ?? [], keywords: valid.keywords ?? [], excludeKeywords: valid.excludeKeywords ?? [],
        platforms: valid.platforms ?? [], jobTypes: valid.jobTypes ?? [], salaryMinK: valid.salaryMinK, salaryMaxK: valid.salaryMaxK,
        remotePreference: valid.remotePreference ?? 'any', hardConstraints: valid.hardConstraints ?? [],
        softPreferences: valid.softPreferences ?? [], createdAt: existing?.createdAt ?? now, updatedAt: now
      };
      if (existingIndex >= 0) draft.careerSearchPlans[existingIndex] = entity;
      else draft.careerSearchPlans.unshift(entity);
      return entity;
    });
  }

  async runCareerSearchPlan(id: string): Promise<CareerAgentRun> {
    return this.repository.update((draft) => {
      const plan = draft.careerSearchPlans.find((item) => item.id === id);
      if (!plan) throw new Error('未找到求职搜索计划');
      const now = nowIso();
      const matches = matchJobsForPlan(plan, draft.syncedJobs);
      const entity: CareerAgentRun = {
        id: randomUUID(), planId: plan.id, title: plan.title, status: 'completed', matchedJobIds: matches.map((item) => item.id),
        steps: [
          { id: randomUUID(), label: '读取职业档案与求职记忆', status: 'completed', message: `已读取 ${draft.profile.skills.length} 项技能和 ${draft.careerMemory.length} 条记忆。` },
          { id: randomUUID(), label: '生成搜索与筛选计划', status: 'completed', message: `${plan.keywords.length} 个关键词，${plan.hardConstraints.length} 条硬性条件。` },
          { id: randomUUID(), label: '查询本地统一职位池', status: matches.length ? 'completed' : 'warning', message: `当前本地职位池命中 ${matches.length} 条；尚未调用外部连接器。` },
          { id: randomUUID(), label: '匹配排序与风险检查', status: 'completed', message: '按匹配度、可信度和岗位状态完成排序。' },
          { id: randomUUID(), label: '生成下一步动作', status: 'completed', message: matches.length ? '可进入定向简历、沟通话术和面试准备。' : '建议调整条件或启用真实数据源。' }
        ],
        summary: matches.length
          ? `命中 ${matches.length} 个本地岗位，优先查看 ${matches.slice(0, 3).map((item) => item.title).join('、')}。`
          : '当前本地职位池没有符合条件的岗位。',
        createdAt: now, updatedAt: now
      };
      draft.careerAgentRuns.unshift(entity);
      draft.careerAgentRuns = draft.careerAgentRuns.slice(0, 100);
      return entity;
    });
  }

  async saveCareerMemory(input: CareerMemoryInput): Promise<CareerMemoryItem> {
    const valid = validateCareerMemoryInput(input);
    return this.repository.update((draft) => {
      const now = nowIso();
      const existingIndex = valid.id ? draft.careerMemory.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.careerMemory[existingIndex] : undefined;
      const entity: CareerMemoryItem = {
        id: existing?.id ?? randomUUID(), type: valid.type ?? 'note', content: valid.content, tags: valid.tags ?? [],
        createdAt: existing?.createdAt ?? now, updatedAt: now
      };
      if (existingIndex >= 0) draft.careerMemory[existingIndex] = entity;
      else draft.careerMemory.unshift(entity);
      return entity;
    });
  }

  async saveCompanyWatch(input: CompanyWatchInput): Promise<CompanyWatch> {
    const valid = validateCompanyWatchInput(input);
    return this.repository.update((draft) => {
      const now = nowIso();
      const existingIndex = valid.id ? draft.companyWatches.findIndex((item) => item.id === valid.id) : -1;
      const existing = existingIndex >= 0 ? draft.companyWatches[existingIndex] : undefined;
      const relatedJobs = draft.syncedJobs.filter((item) => item.company.includes(valid.name) || valid.name.includes(item.company)).filter((item) => item.company);
      const entity: CompanyWatch = {
        id: existing?.id ?? randomUUID(), name: valid.name, industry: valid.industry ?? '', careerUrl: valid.careerUrl ?? '',
        priority: valid.priority ?? 'normal', status: valid.status ?? 'watching', recruitmentType: valid.recruitmentType ?? '',
        tags: valid.tags ?? [], notes: valid.notes ?? '', nextRecruitmentAt: valid.nextRecruitmentAt,
        lastCheckedAt: existing?.lastCheckedAt, openJobs: relatedJobs.filter((item) => item.lifecycleStatus !== 'closed').length,
        newJobs: relatedJobs.filter((item) => item.lifecycleStatus === 'new').length,
        changedJobs: relatedJobs.filter((item) => item.lifecycleStatus === 'changed').length,
        createdAt: existing?.createdAt ?? now, updatedAt: now
      };
      if (existingIndex >= 0) draft.companyWatches[existingIndex] = entity;
      else draft.companyWatches.unshift(entity);
      return entity;
    });
  }

  async validateCompanyWatch(id: string): Promise<CompanyWatch> {
    return this.repository.update((draft) => {
      const company = draft.companyWatches.find((item) => item.id === id);
      if (!company) throw new Error('未找到关注公司');
      const now = nowIso();
      const relatedJobs = draft.syncedJobs.filter((item) => item.company && (item.company.includes(company.name) || company.name.includes(item.company)));
      company.lastCheckedAt = now;
      company.openJobs = relatedJobs.filter((item) => item.lifecycleStatus !== 'closed').length;
      company.newJobs = relatedJobs.filter((item) => item.lifecycleStatus === 'new').length;
      company.changedJobs = relatedJobs.filter((item) => item.lifecycleStatus === 'changed').length;
      company.updatedAt = now;
      draft.jobSyncRuns.unshift({
        id: randomUUID(), sourceId: company.id, sourceName: `${company.name} 招聘官网`, status: 'dry-run', fetched: relatedJobs.length,
        added: 0, updated: 0, durationMs: 0,
        message: company.careerUrl ? '官网监控契约验证完成；本次未发起外部网络请求。' : '公司关注已建立，正式监控前需要补充招聘官网。',
        createdAt: now, updatedAt: now
      });
      return company;
    });
  }

  async checkCompanyWatchesOnStartup(): Promise<JobSyncRun[]> {
    const companies = this.repository.getState().companyWatches
      .filter((item) => item.status === 'watching' && item.careerUrl);
    const runs: JobSyncRun[] = [];
    for (const company of companies) {
      const started = Date.now();
      const now = nowIso();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(company.careerUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: { accept: 'text/html,application/xhtml+xml,application/ld+json;q=0.9,*/*;q=0.8' }
        }).finally(() => clearTimeout(timeout));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const parsedJobs = extractStructuredCompanyJobs(html, company.careerUrl, company.name);
        const run = await this.repository.update((draft) => {
          const current = draft.companyWatches.find((item) => item.id === company.id);
          if (!current) throw new Error('未找到关注公司');
          let added = 0;
          let updated = 0;
          let accepted = 0;
          for (const item of parsedJobs) {
            const intelligence = analyzeSyncedJob(item, draft.profile);
            if (intelligence.matchScore < 60) continue;
            accepted += 1;
            const fingerprint = createHash('sha256')
              .update(`company-careers|${current.id}|${item.externalId || item.sourceUrl}`)
              .digest('hex');
            const existingIndex = draft.syncedJobs.findIndex((job) => job.fingerprint === fingerprint);
            if (existingIndex >= 0) {
              const existing = draft.syncedJobs[existingIndex];
              const changed = Boolean(item.description && item.description !== existing.description)
                || item.title !== existing.title
                || (item.salaryRange ?? '') !== existing.salaryRange;
              draft.syncedJobs[existingIndex] = {
                ...existing,
                sourceUrl: item.sourceUrl,
                title: item.title,
                company: item.company || current.name,
                location: item.location ?? existing.location,
                salaryRange: item.salaryRange ?? existing.salaryRange,
                description: item.description || existing.description,
                ...intelligence,
                lifecycleStatus: changed ? 'changed' : 'active',
                postedAt: item.postedAt ?? existing.postedAt,
                lastSeenAt: now,
                seenCount: existing.seenCount + 1,
                updatedAt: now
              };
              updated += 1;
              continue;
            }
            draft.syncedJobs.unshift({
              id: randomUUID(),
              externalId: item.externalId || fingerprint.slice(0, 20),
              fingerprint,
              sourceSite: 'company-careers',
              sourceName: `${current.name} 招聘官网`,
              sourceUrl: item.sourceUrl,
              title: item.title,
              company: item.company || current.name,
              location: item.location ?? '',
              salaryRange: item.salaryRange ?? '',
              description: item.description ?? '',
              ...intelligence,
              lifecycleStatus: 'new',
              postedAt: item.postedAt,
              capturedAt: now,
              lastSeenAt: now,
              seenCount: 1,
              status: 'new',
              createdAt: now,
              updatedAt: now
            });
            added += 1;
          }
          const relatedJobs = draft.syncedJobs.filter((item) => item.company && (item.company.includes(current.name) || current.name.includes(item.company)));
          current.lastCheckedAt = now;
          current.openJobs = relatedJobs.filter((item) => item.lifecycleStatus !== 'closed').length;
          current.newJobs = relatedJobs.filter((item) => item.lifecycleStatus === 'new').length;
          current.changedJobs = relatedJobs.filter((item) => item.lifecycleStatus === 'changed').length;
          current.updatedAt = now;
          const run: JobSyncRun = {
            id: randomUUID(),
            sourceId: current.id,
            sourceName: `${current.name} 招聘官网`,
            status: parsedJobs.length ? 'success' : 'warning',
            fetched: parsedJobs.length,
            added,
            updated,
            durationMs: Date.now() - started,
            message: parsedJobs.length
              ? `启动自动检测完成：发现 ${parsedJobs.length} 个结构化岗位，${accepted} 个匹配求职意向，新增 ${added} 个，更新 ${updated} 个。`
              : '启动自动检测完成：页面未发现标准 JobPosting 结构化岗位。',
            createdAt: now,
            updatedAt: now
          };
          draft.jobSyncRuns.unshift(run);
          draft.jobSyncRuns = draft.jobSyncRuns.slice(0, 200);
          return run;
        });
        runs.push(run);
      } catch (error) {
        const run = await this.repository.update((draft) => {
          const current = draft.companyWatches.find((item) => item.id === company.id);
          if (current) {
            current.lastCheckedAt = now;
            current.updatedAt = now;
          }
          const run: JobSyncRun = {
            id: randomUUID(),
            sourceId: company.id,
            sourceName: `${company.name} 招聘官网`,
            status: 'failed',
            fetched: 0,
            added: 0,
            updated: 0,
            durationMs: Date.now() - started,
            message: `启动自动检测失败：${error instanceof Error ? error.message : '未知错误'}`,
            createdAt: now,
            updatedAt: now
          };
          draft.jobSyncRuns.unshift(run);
          draft.jobSyncRuns = draft.jobSyncRuns.slice(0, 200);
          return run;
        });
        runs.push(run);
      }
    }
    return runs;
  }

  async ingestSyncedJobs(input: JobSyncBatchInput): Promise<{ added: number; updated: number; total: number }> {
    const valid = validateJobSyncBatchInput(input);
    const state = this.repository.getState();
    if (valid.token !== state.settings.jobSyncToken) throw new Error('岗位同步令牌无效');
    return this.repository.update((draft) => {
      const now = nowIso();
      let added = 0;
      let updated = 0;
      for (const item of valid.jobs) {
        const intelligence = analyzeSyncedJob(item, draft.profile);
        const fingerprint = createHash('sha256')
          .update(`${valid.sourceSite}|${item.externalId || item.sourceUrl}`)
          .digest('hex');
        const existingIndex = draft.syncedJobs.findIndex((job) => job.fingerprint === fingerprint);
        if (existingIndex >= 0) {
          const existing = draft.syncedJobs[existingIndex];
          const mergedIntelligence = analyzeSyncedJob({
            ...item,
            company: item.company || existing.company,
            location: item.location || existing.location,
            salaryRange: item.salaryRange || existing.salaryRange,
            description: item.description || existing.description,
            postedAt: item.postedAt ?? existing.postedAt
          }, draft.profile);
          const changed = Boolean(item.description && item.description !== existing.description)
            || item.title !== existing.title
            || (item.salaryRange ?? '') !== existing.salaryRange;
          draft.syncedJobs[existingIndex] = {
            ...existing,
            externalId: item.externalId || existing.externalId,
            sourceUrl: item.sourceUrl,
            title: item.title,
            company: item.company ?? existing.company,
            location: item.location ?? existing.location,
            salaryRange: item.salaryRange ?? existing.salaryRange,
            description: item.description || existing.description,
            ...mergedIntelligence,
            lifecycleStatus: changed ? 'changed' : 'active',
            postedAt: item.postedAt ?? existing.postedAt,
            lastSeenAt: now,
            seenCount: existing.seenCount + 1,
            updatedAt: now
          };
          updated += 1;
          continue;
        }
        const entity: SyncedJob = {
          id: randomUUID(),
          externalId: item.externalId || fingerprint.slice(0, 20),
          fingerprint,
          sourceSite: valid.sourceSite,
          sourceName: valid.sourceName ?? valid.sourceSite,
          sourceUrl: item.sourceUrl,
          title: item.title,
          company: item.company ?? '',
          location: item.location ?? '',
          salaryRange: item.salaryRange ?? '',
          description: item.description ?? '',
          ...intelligence,
          lifecycleStatus: 'new',
          postedAt: item.postedAt,
          capturedAt: now,
          lastSeenAt: now,
          seenCount: 1,
          status: 'new',
          createdAt: now,
          updatedAt: now
        };
        draft.syncedJobs.unshift(entity);
        added += 1;
      }
      draft.jobSyncRuns.unshift({
        id: randomUUID(), sourceId: `bridge-${valid.sourceSite}`, sourceName: valid.sourceName ?? valid.sourceSite,
        status: 'success', fetched: valid.jobs.length, added, updated, durationMs: 0,
        message: `接收 ${valid.jobs.length} 条可见岗位，新增 ${added} 条，更新 ${updated} 条。`,
        createdAt: now, updatedAt: now
      });
      draft.jobSyncRuns = draft.jobSyncRuns.slice(0, 200);
      return { added, updated, total: draft.syncedJobs.length };
    });
  }

  async updateSyncedJobStatus(id: string, status: SyncedJobStatus): Promise<SyncedJob> {
    if (!['new', 'saved', 'ignored', 'trashed'].includes(status)) throw new Error('同步岗位状态无效');
    return this.repository.update((draft) => {
      const item = draft.syncedJobs.find((job) => job.id === id);
      if (!item) throw new Error('未找到同步岗位');
      item.status = status;
      item.updatedAt = nowIso();
      return item;
    });
  }

  async bulkUpdateSyncedJobStatus(ids: string[], status: SyncedJobStatus): Promise<{ updated: number }> {
    if (!['new', 'saved', 'ignored', 'trashed'].includes(status)) throw new Error('同步岗位状态无效');
    const selectedIds = new Set(ids.filter(Boolean));
    return this.repository.update((draft) => {
      let updated = 0;
      const updatedAt = nowIso();
      for (const item of draft.syncedJobs) {
        if (!selectedIds.has(item.id) || item.status === status) continue;
        item.status = status;
        item.updatedAt = updatedAt;
        updated += 1;
      }
      return { updated };
    });
  }

  async bulkRestoreSyncedJobs(ids: string[]): Promise<{ restored: number }> {
    const selectedIds = new Set(ids.filter(Boolean));
    return this.repository.update((draft) => {
      let restored = 0;
      const updatedAt = nowIso();
      for (const item of draft.syncedJobs) {
        if (!selectedIds.has(item.id) || item.status !== 'trashed') continue;
        item.status = item.linkedJobId ? 'saved' : 'new';
        item.updatedAt = updatedAt;
        restored += 1;
      }
      return { restored };
    });
  }

  async deleteSyncedJobPermanently(id: string): Promise<{ deleted: boolean }> {
    return this.repository.update((draft) => {
      const before = draft.syncedJobs.length;
      draft.syncedJobs = draft.syncedJobs.filter((job) => job.id !== id);
      return { deleted: draft.syncedJobs.length < before };
    });
  }

  async bulkDeleteSyncedJobsPermanently(ids: string[]): Promise<{ deleted: number }> {
    const selectedIds = new Set(ids.filter(Boolean));
    return this.repository.update((draft) => {
      const before = draft.syncedJobs.length;
      draft.syncedJobs = draft.syncedJobs.filter((job) => !selectedIds.has(job.id) || job.status !== 'trashed');
      return { deleted: before - draft.syncedJobs.length };
    });
  }

  async promoteSyncedJob(id: string): Promise<JobDescription> {
    const synced = this.repository.getState().syncedJobs.find((item) => item.id === id);
    if (!synced) throw new Error('未找到同步岗位');
    if (synced.linkedJobId) {
      const existing = this.repository.getState().jobs.find((item) => item.id === synced.linkedJobId);
      if (existing) return existing;
    }
    const rawText = synced.description || [synced.title, synced.company, synced.location, synced.salaryRange].filter(Boolean).join('\n');
    const job = await this.analyzeJob({ title: synced.title, company: synced.company, rawText });
    await this.repository.update((draft) => {
      const item = draft.syncedJobs.find((row) => row.id === id);
      if (item) {
        item.linkedJobId = job.id;
        item.status = 'saved';
        item.updatedAt = nowIso();
      }
    });
    return job;
  }

  async startTraining(input: TrainingStartInput): Promise<TrainingSession> {
    const valid = validateTrainingStartInput(input);
    return this.repository.update((draft) => {
      const job = valid.jobId ? draft.jobs.find((item) => item.id === valid.jobId) : undefined;
      const selectedProjectId = valid.projectId ?? valid.projectIds?.[0];
      const project = selectedProjectId ? draft.projects.find((item) => item.id === selectedProjectId) : undefined;
      const resume = valid.resumeId ? draft.resumeVariants.find((item) => item.id === valid.resumeId) : undefined;
      if (valid.jobId && !job) throw new Error('未找到选择的 JD');
      if (selectedProjectId && !project) throw new Error('未找到选择的项目');
      if (valid.resumeId && !resume) throw new Error('未找到选择的简历版本');
      const now = nowIso();
      const english = valid.language === 'en-US';
      const englishJobTitle = job?.title && !/[\u3400-\u9fff]/u.test(job.title) ? job.title : 'Target Role';
      const questions = generateQuestions(valid, draft, job, project);
      if (valid.coachMode === 'resume-follow-up' && resume && questions.length) {
        const safeHeadline = english && /[\u3400-\u9fff]/u.test(resume.headline) ? 'the selected resume statement' : (resume.headline || resume.name);
        questions[0] = {
          ...questions[0],
          type: 'behavioral',
          text: english
            ? `Your resume positions you around "${safeHeadline}". Which specific experience proves this claim, and what did you personally deliver?`
            : `你的简历将“${resume.headline || resume.name}”作为核心定位。哪段具体经历能证明这一点？请说明你本人完成的动作和可验证结果。`,
          rationale: english ? 'Verify that a resume claim is supported by truthful, interview-ready evidence.' : '验证简历核心表述是否有真实、可追问的证据。',
          targetKeywords: resume.skillIds.map((id) => draft.profile.skills.find((item) => item.id === id)?.name).filter((item): item is string => Boolean(item)),
          relatedIds: [...new Set([...questions[0].relatedIds, resume.id])]
        };
      }
      const session: TrainingSession = {
        id: randomUUID(),
        jobId: job?.id,
        projectId: project?.id,
        title: english
          ? `${englishJobTitle} Interview Practice · ${new Date().toLocaleDateString('en-US')}`
          : `${job?.title ?? '综合'}面试训练 · ${new Date().toLocaleDateString('zh-CN')}`,
        status: 'active',
        questions,
        attempts: [],
        currentQuestionIndex: 0,
        language: valid.language ?? 'zh-CN',
        mode: valid.mode ?? 'standard',
        maxRounds: valid.mode === 'pressure' ? (valid.maxRounds ?? 8) : undefined,
        createdAt: now,
        updatedAt: now
      };
      draft.trainingSessions.unshift(session);
      upsertCoachSession(draft, session, {
        mode: valid.coachMode ?? (valid.language === 'en-US' ? 'english-interview' : 'mock-interview'),
        resumeId: valid.resumeId,
        projectIds: valid.projectIds?.length ? valid.projectIds : (project ? [project.id] : [])
      });
      return session;
    });
  }

  async submitTraining(input: TrainingAnswerInput): Promise<TrainingSession> {
    const valid = validateTrainingAnswerInput(input);
    return this.repository.update((draft) => {
      const session = draft.trainingSessions.find((item) => item.id === valid.sessionId);
      if (!session) throw new Error('未找到训练会话');
      const currentQuestion = session.questions.find((item) => item.id === valid.questionId);
      if (!currentQuestion) throw new Error('未找到训练问题');
      const scored = scoreAnswer(valid.answer, currentQuestion, session.language ?? 'zh-CN');
      const now = nowIso();
      session.attempts.push({
        id: randomUUID(),
        questionId: valid.questionId,
        answer: valid.answer,
        ...scored,
        isFinal: false,
        createdAt: now,
        updatedAt: now
      });
      session.updatedAt = now;
      upsertCoachSession(draft, session);
      return session;
    });
  }

  async finalizeTraining(input: TrainingFinalizeInput): Promise<TrainingSession> {
    const valid = validateTrainingFinalizeInput(input);
    return this.repository.update((draft) => {
      const session = draft.trainingSessions.find((item) => item.id === valid.sessionId);
      if (!session) throw new Error('未找到训练会话');
      const currentQuestion = session.questions.find((item) => item.id === valid.questionId);
      if (!currentQuestion) throw new Error('未找到训练问题');
      const scored = scoreAnswer(valid.answer, currentQuestion, session.language ?? 'zh-CN');
      const project = session.projectId ? draft.projects.find((item) => item.id === session.projectId) : undefined;
      const job = session.jobId ? draft.jobs.find((item) => item.id === session.jobId) : undefined;
      const diagnosis = valid.coach?.diagnosis
        ?? diagnosePressureAnswer(valid.answer, currentQuestion, project, session.language ?? 'zh-CN');
      const now = nowIso();
      session.attempts.push({
        id: randomUUID(),
        questionId: valid.questionId,
        answer: valid.answer,
        ...scored,
        isFinal: true,
        diagnosis,
        createdAt: now,
        updatedAt: now
      });
      const questionIndex = session.questions.findIndex((item) => item.id === currentQuestion.id);
      if (session.mode === 'pressure') {
        const completedRounds = session.attempts.filter((item) => item.isFinal).length;
        const maxRounds = session.maxRounds ?? 8;
        if (completedRounds >= maxRounds) {
          session.status = 'completed';
          session.summary = buildPressureSummary(session, project, valid.coach?.sessionSummary);
        } else {
          const nextQuestion = createPressureFollowUp(session, valid.coach?.followUpQuestion ?? '', job, project);
          session.questions.push(nextQuestion);
          session.currentQuestionIndex = session.questions.length - 1;
        }
      } else {
        session.currentQuestionIndex = Math.min(questionIndex + 1, session.questions.length - 1);
        if (questionIndex >= session.questions.length - 1) session.status = 'completed';
      }
      session.updatedAt = now;

      const english = session.language === 'en-US';
      const reviewAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const optimizedAnswer = valid.coach?.diagnosis.starAnswer || valid.coach?.recommendedAnswer || valid.answer;
      const gaps = diagnosis.evidenceGaps.length ? diagnosis.evidenceGaps : scored.feedback;
      const improvements = [
        ...diagnosis.logicIssues,
        diagnosis.resumeSuggestion,
        ...(valid.coach?.feedback ? [valid.coach.feedback] : [])
      ].filter(Boolean);
      const contentMarkdown = english
        ? `# Original answer\n\n${valid.answer}\n\n## Improved answer\n\n${optimizedAnswer}\n\n## Gaps\n\n${gaps.map((item) => `- ${item}`).join('\n')}\n\n## Improvement plan\n\n${improvements.map((item) => `- [ ] ${item}`).join('\n')}\n\n## Review task\n\n- [ ] Answer this question again with truthful evidence: ${currentQuestion.text}`
        : `# 原回答\n\n${valid.answer}\n\n## 优化回答\n\n${optimizedAnswer}\n\n## 不足\n\n${gaps.map((item) => `- ${item}`).join('\n')}\n\n## 改进方案\n\n${improvements.map((item) => `- [ ] ${item}`).join('\n')}\n\n## 复习任务\n\n- [ ] 使用真实证据重新回答：${currentQuestion.text}`;
      draft.knowledge.unshift({
        id: randomUUID(),
        type: 'answer',
        title: currentQuestion.text.slice(0, 80),
        contentMarkdown,
        tags: ['面试回答', currentQuestion.type],
        status: 'review',
        source: '面试训练',
        relatedIds: [session.id, ...currentQuestion.relatedIds],
        jobIds: session.jobId ? [session.jobId] : [],
        projectIds: session.projectId ? [session.projectId] : [],
        skillNames: currentQuestion.targetKeywords,
        visibility: 'private',
        reviewAt,
        createdAt: now,
        updatedAt: now
      });
      upsertCoachSession(draft, session);
      return session;
    });
  }
}
