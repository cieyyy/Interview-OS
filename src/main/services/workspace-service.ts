import { createHash, randomUUID } from 'node:crypto';
import type {
  CareerAgentRun,
  CareerMemoryInput,
  CareerMemoryItem,
  CareerSearchPlan,
  CareerSearchPlanInput,
  CompanyWatch,
  CompanyWatchInput,
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
      return entity;
    });
  }

  async saveApplication(input: JobApplicationInput): Promise<JobApplication> {
    const valid = validateJobApplicationInput(input);
    return this.repository.update((draft) => {
      const job = valid.jobId ? draft.jobs.find((item) => item.id === valid.jobId) : undefined;
      if (valid.jobId && !job) throw new Error('未找到关联的 JD');
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

  async validateJobSource(id: string): Promise<JobSyncRun> {
    return this.repository.update((draft) => {
      const source = draft.jobSources.find((item) => item.id === id);
      if (!source) throw new Error('未找到岗位数据源');
      const now = nowIso();
      const contractReady = source.connectorType === 'browser-extension' || source.connectorType === 'import' || Boolean(source.endpoint);
      const run: JobSyncRun = {
        id: randomUUID(), sourceId: source.id, sourceName: source.name, status: 'dry-run', fetched: 0, added: 0, updated: 0,
        durationMs: 0,
        message: contractReady
          ? '连接器配置结构完整；本次仅验证框架，未访问外部招聘平台。'
          : '连接器契约已预留，正式启用前需要配置端点或适配器。',
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
    if (!['new', 'saved', 'ignored'].includes(status)) throw new Error('同步岗位状态无效');
    return this.repository.update((draft) => {
      const item = draft.syncedJobs.find((job) => job.id === id);
      if (!item) throw new Error('未找到同步岗位');
      item.status = status;
      item.updatedAt = nowIso();
      return item;
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
      const project = valid.projectId ? draft.projects.find((item) => item.id === valid.projectId) : undefined;
      if (valid.jobId && !job) throw new Error('未找到选择的 JD');
      if (valid.projectId && !project) throw new Error('未找到选择的项目');
      const now = nowIso();
      const english = valid.language === 'en-US';
      const englishJobTitle = job?.title && !/[\u3400-\u9fff]/u.test(job.title) ? job.title : 'Target Role';
      const session: TrainingSession = {
        id: randomUUID(),
        jobId: job?.id,
        projectId: project?.id,
        title: english
          ? `${englishJobTitle} Interview Practice · ${new Date().toLocaleDateString('en-US')}`
          : `${job?.title ?? '综合'}面试训练 · ${new Date().toLocaleDateString('zh-CN')}`,
        status: 'active',
        questions: generateQuestions(valid, draft, job, project),
        attempts: [],
        currentQuestionIndex: 0,
        language: valid.language ?? 'zh-CN',
        mode: valid.mode ?? 'standard',
        maxRounds: valid.mode === 'pressure' ? (valid.maxRounds ?? 8) : undefined,
        createdAt: now,
        updatedAt: now
      };
      draft.trainingSessions.unshift(session);
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

      draft.knowledge.unshift({
        id: randomUUID(),
        type: 'answer',
        title: currentQuestion.text.slice(0, 80),
        contentMarkdown: valid.answer,
        tags: ['面试回答', currentQuestion.type],
        status: 'review',
        source: '面试训练',
        relatedIds: [session.id, ...currentQuestion.relatedIds],
        createdAt: now,
        updatedAt: now
      });
      return session;
    });
  }
}
