import { randomUUID } from 'node:crypto';
import type {
  JobDescription,
  JobInput,
  KnowledgeInput,
  KnowledgeItem,
  ProjectExperience,
  ProjectInput,
  ProfileInput,
  CareerProfile,
  TrainingAnswerInput,
  TrainingFinalizeInput,
  TrainingSession,
  TrainingStartInput,
  WorkspaceState
} from '../../shared/domain';
import { createDemoState, nowIso } from '../../shared/domain';
import { analyzeJob } from '../../shared/job-analyzer';
import { generateQuestions, scoreAnswer } from '../../shared/training-engine';
import {
  validateJobInput,
  validateKnowledgeInput,
  validateProjectInput,
  validateTrainingAnswerInput,
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

  async startTraining(input: TrainingStartInput): Promise<TrainingSession> {
    const valid = validateTrainingStartInput(input);
    return this.repository.update((draft) => {
      const job = valid.jobId ? draft.jobs.find((item) => item.id === valid.jobId) : undefined;
      const project = valid.projectId ? draft.projects.find((item) => item.id === valid.projectId) : undefined;
      if (valid.jobId && !job) throw new Error('未找到选择的 JD');
      if (valid.projectId && !project) throw new Error('未找到选择的项目');
      const now = nowIso();
      const session: TrainingSession = {
        id: randomUUID(),
        jobId: job?.id,
        projectId: project?.id,
        title: `${job?.title ?? '综合'}面试训练 · ${new Date().toLocaleDateString('zh-CN')}`,
        status: 'active',
        questions: generateQuestions(valid, draft, job, project),
        attempts: [],
        currentQuestionIndex: 0,
        language: valid.language ?? 'zh-CN',
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
        isFinal: true,
        createdAt: now,
        updatedAt: now
      });
      const questionIndex = session.questions.findIndex((item) => item.id === currentQuestion.id);
      session.currentQuestionIndex = Math.min(questionIndex + 1, session.questions.length - 1);
      if (questionIndex >= session.questions.length - 1) session.status = 'completed';
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
