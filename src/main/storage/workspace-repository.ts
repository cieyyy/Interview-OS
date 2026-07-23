import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BackupInfo, ExportInfo, WorkspaceState } from '../../shared/domain';
import { createEmptyState, nowIso } from '../../shared/domain';
import { safeFileName, validateWorkspaceState } from '../../shared/validation';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function markdownFrontmatter(values: Record<string, unknown>): string {
  const rows = Object.entries(values).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `---\n${rows.join('\n')}\n---\n`;
}

export class AtomicWorkspaceRepository {
  private state: WorkspaceState = createEmptyState();
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly databaseDirectory: string;
  private readonly statePath: string;
  private readonly previousPath: string;
  private readonly temporaryPath: string;

  constructor(readonly rootDirectory: string) {
    this.databaseDirectory = path.join(rootDirectory, 'database');
    this.statePath = path.join(this.databaseDirectory, 'state.json');
    this.previousPath = path.join(this.databaseDirectory, 'state.previous.json');
    this.temporaryPath = path.join(this.databaseDirectory, 'state.tmp');
  }

  async initialize(): Promise<WorkspaceState> {
    await Promise.all([
      mkdir(this.databaseDirectory, { recursive: true }),
      mkdir(path.join(this.rootDirectory, 'backups'), { recursive: true }),
      mkdir(path.join(this.rootDirectory, 'exports'), { recursive: true }),
      mkdir(path.join(this.rootDirectory, 'attachments'), { recursive: true }),
      mkdir(path.join(this.rootDirectory, 'secure'), { recursive: true }),
      mkdir(path.join(this.rootDirectory, 'logs'), { recursive: true }),
      mkdir(path.join(this.rootDirectory, 'migrations'), { recursive: true })
    ]);

    const currentVersion = await this.readSchemaVersion(this.statePath);
    const current = await this.readValidState(this.statePath);
    if (current) {
      if (currentVersion !== undefined && currentVersion < current.schemaVersion) {
        await this.recordMigration(this.statePath, currentVersion, current);
        await this.persist(current);
      }
      this.state = current;
      return this.getState();
    }

    const previousVersion = await this.readSchemaVersion(this.previousPath);
    const previous = await this.readValidState(this.previousPath);
    if (previous) {
      if (previousVersion !== undefined && previousVersion < previous.schemaVersion) {
        await this.recordMigration(this.previousPath, previousVersion, previous);
      }
      this.state = previous;
      await this.persist(previous);
      return this.getState();
    }

    this.state = createEmptyState();
    await this.persist(this.state);
    return this.getState();
  }

  getState(): WorkspaceState {
    return clone(this.state);
  }

  async replaceState(next: WorkspaceState): Promise<WorkspaceState> {
    validateWorkspaceState(next);
    return this.enqueue(async () => {
      const normalized = { ...clone(next), updatedAt: nowIso() };
      await this.persist(normalized);
      this.state = normalized;
      return this.getState();
    });
  }

  async update<T>(mutator: (draft: WorkspaceState) => T | Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      const draft = this.getState();
      const result = await mutator(draft);
      draft.updatedAt = nowIso();
      validateWorkspaceState(draft);
      await this.persist(draft);
      this.state = draft;
      return clone(result);
    });
  }

  async createBackup(): Promise<BackupInfo> {
    const createdAt = nowIso();
    const serialized = JSON.stringify(this.state, null, 2);
    const sha256 = createHash('sha256').update(serialized).digest('hex');
    const backupPath = path.join(this.rootDirectory, 'backups', `workspace-${stamp()}.json`);
    await writeFile(backupPath, serialized, { encoding: 'utf8', flag: 'wx' });
    return { path: backupPath, createdAt, sha256 };
  }

  async exportMarkdown(): Promise<ExportInfo> {
    const createdAt = nowIso();
    const exportRoot = path.join(this.rootDirectory, 'exports', `export-${stamp()}`);
    await mkdir(exportRoot, { recursive: true });
    let files = 0;

    const writeMarkdown = async (directory: string, fileName: string, content: string): Promise<void> => {
      const targetDirectory = path.join(exportRoot, directory);
      await mkdir(targetDirectory, { recursive: true });
      await writeFile(path.join(targetDirectory, `${safeFileName(fileName)}.md`), content, 'utf8');
      files += 1;
    };

    for (const item of this.state.knowledge) {
      const frontmatter = markdownFrontmatter({
        id: item.id,
        type: item.type,
        status: item.status,
        tags: item.tags,
        source: item.source,
        visibility: item.visibility,
        reviewAt: item.reviewAt,
        jobIds: item.jobIds,
        projectIds: item.projectIds,
        skillNames: item.skillNames,
        updatedAt: item.updatedAt
      });
      await writeMarkdown('knowledge', item.title, `${frontmatter}\n# ${item.title}\n\n${item.contentMarkdown}\n`);
    }

    for (const project of this.state.projects) {
      const body = `${markdownFrontmatter({ id: project.id, type: 'project', techStack: project.techStack })}\n` +
        `# ${project.name}\n\n## 背景\n\n${project.background}\n\n## 目标\n\n${project.objective}\n\n` +
        `## 架构\n\n${project.architecture}\n\n## 我的职责\n\n${project.responsibilities}\n\n` +
        `## 行动\n\n${project.actions}\n\n## 难点\n\n${project.challenges}\n\n## 结果\n\n${project.results}\n`;
      await writeMarkdown('projects', project.name, body);
    }

    for (const job of this.state.jobs) {
      const requirements = job.requirements
        .map((item) => `- ${item.label}｜${item.priority}｜${item.matchStatus}｜${item.evidenceSummary}`)
        .join('\n');
      await writeMarkdown('jobs', `${job.company}-${job.title}`, `# ${job.title}\n\n## 原始 JD\n\n${job.rawText}\n\n## 要求与证据\n\n${requirements}\n`);
    }

    for (const application of this.state.applications) {
      const history = application.statusHistory
        .map((item) => `- ${item.occurredAt}｜${item.status}｜${item.note}`)
        .join('\n');
      const body = `${markdownFrontmatter({ id: application.id, type: 'application', status: application.status, priority: application.priority })}\n` +
        `# ${application.company ? `${application.company} · ` : ''}${application.title}\n\n` +
        `## 机会信息\n\n- 来源：${application.source}\n- 地点：${application.location}\n- 薪资：${application.salaryRange}\n- 链接：${application.sourceUrl}\n\n` +
        `## 下一步\n\n${application.nextAction || '未设置'}\n\n## 备注\n\n${application.notes}\n\n## 状态历史\n\n${history}\n`;
      await writeMarkdown('applications', `${application.company}-${application.title}`, body);
    }

    for (const synced of this.state.syncedJobs) {
      const body = `${markdownFrontmatter({ id: synced.id, type: 'synced-job', source: synced.sourceSite, status: synced.status, seenCount: synced.seenCount })}\n` +
        `# ${synced.company ? `${synced.company} · ` : ''}${synced.title}\n\n` +
        `- 来源：${synced.sourceName}\n- 地点：${synced.location}\n- 薪资：${synced.salaryRange}\n- 原职位：${synced.sourceUrl}\n- 首次发现：${synced.capturedAt}\n- 最后发现：${synced.lastSeenAt}\n\n` +
        `## 职位内容\n\n${synced.description}\n`;
      await writeMarkdown('synced-jobs', `${synced.company}-${synced.title}`, body);
    }

    for (const resume of this.state.resumeVariants) {
      const projects = this.state.projects.filter((item) => resume.projectIds.includes(item.id));
      const skills = this.state.profile.skills.filter((item) => resume.skillIds.includes(item.id));
      const body = `${markdownFrontmatter({ id: resume.id, type: 'resume', status: resume.status, version: resume.version, matchScore: resume.matchScore })}\n` +
        `# ${resume.name}\n\n## 求职标题\n\n${resume.headline}\n\n## 个人摘要\n\n${resume.summary}\n\n` +
        `## 核心技能\n\n${skills.map((item) => `- ${item.name}｜${item.level}`).join('\n')}\n\n` +
        `## 亮点\n\n${resume.highlights.map((item) => `- ${item}`).join('\n')}\n\n` +
        `## 项目经历\n\n${projects.map((item) => `### ${item.name}\n\n${item.responsibilities}\n\n${item.actions}\n\n${item.results}`).join('\n\n')}\n`;
      await writeMarkdown('resumes', resume.name, body);
    }

    for (const session of this.state.trainingSessions) {
      const rows = session.questions.map((question) => {
        const attempts = session.attempts.filter((attempt) => attempt.questionId === question.id);
        return `## ${question.text}\n\n${attempts.map((attempt, index) => `### 回答 ${index + 1}（${attempt.totalScore} 分）\n\n${attempt.answer}`).join('\n\n')}`;
      });
      await writeMarkdown('interviews', session.title, `# ${session.title}\n\n${rows.join('\n\n')}\n`);
    }

    for (const session of this.state.coachSessions) {
      const messages = session.messages.map((message) => `## ${message.role}\n\n${message.content}`).join('\n\n');
      const report = session.report
        ? `\n\n## Report\n\n### Core strengths\n${session.report.coreStrengths.map((item) => `- ${item}`).join('\n')}\n\n### High-risk gaps\n${session.report.highRiskGaps.map((item) => `- ${item}`).join('\n')}`
        : '';
      await writeMarkdown('coach-sessions', session.title, `${markdownFrontmatter({ id: session.id, type: 'coach-session', mode: session.mode, status: session.status, targetJobId: session.targetJobId, resumeId: session.resumeId, projectIds: session.projectIds })}\n# ${session.title}\n\n${messages}${report}\n`);
    }

    await writeFile(
      path.join(exportRoot, 'manifest.json'),
      JSON.stringify({ schemaVersion: 1, createdAt, files }, null, 2),
      'utf8'
    );
    files += 1;
    return { path: exportRoot, files, createdAt };
  }

  async exportJobData(kind: 'csv' | 'json' | 'report'): Promise<ExportInfo> {
    const createdAt = nowIso();
    const exportRoot = path.join(this.rootDirectory, 'exports');
    await mkdir(exportRoot, { recursive: true });
    const baseName = `job-data-${stamp()}`;
    const csvEscape = (value: unknown): string => {
      const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };
    const buildCsv = (): string => {
      const headers = ['title', 'company', 'work_address', 'salary', 'education', 'experience', 'skills', 'source', 'publish_time', 'detail_url', 'match_score', 'trust_score', 'quality_score'];
      const rows = this.state.syncedJobs.map((item) => [
        item.title, item.company, item.location, item.salaryRange, item.education, item.experience, item.skills,
        item.sourceName, item.postedAt ?? '', item.sourceUrl, item.matchScore, item.trustScore, item.qualityScore
      ]);
      return [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
    };
    const buildReport = (): string => {
      const jobs = this.state.syncedJobs;
      const averageQuality = jobs.length ? Math.round(jobs.reduce((sum, item) => sum + item.qualityScore, 0) / jobs.length) : 0;
      const risks = jobs.filter((item) => item.riskFlags.length || item.biasFlags.length).length;
      const topSkills = new Map<string, number>();
      for (const skill of jobs.flatMap((item) => item.skills)) topSkills.set(skill, (topSkills.get(skill) ?? 0) + 1);
      return [
        '# Interview OS 岗位数据报告',
        '',
        `- 岗位总数：${jobs.length}`,
        `- 平均数据质量：${averageQuality}`,
        `- 风险待核验：${risks}`,
        '',
        '## 热门技能',
        ...[...topSkills.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([skill, count]) => `- ${skill}: ${count}`),
        '',
        '## 来源统计',
        ...this.state.jobSources.map((source) => {
          const count = jobs.filter((job) => job.sourceSite === source.platform || job.sourceName.includes(source.platform) || source.platform.includes(job.sourceName)).length;
          return `- ${source.name}: ${count}`;
        })
      ].join('\n');
    };

    const content = kind === 'csv'
      ? `\ufeff${buildCsv()}`
      : kind === 'json'
        ? JSON.stringify(this.state.syncedJobs, null, 2)
        : buildReport();
    const extension = kind === 'csv' ? 'csv' : kind === 'json' ? 'json' : 'md';
    const target = path.join(exportRoot, `${baseName}.${extension}`);
    await writeFile(target, content, 'utf8');
    return { path: target, files: 1, createdAt };
  }

  private async readValidState(filePath: string): Promise<WorkspaceState | undefined> {
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
      return validateWorkspaceState(parsed);
    } catch {
      return undefined;
    }
  }

  private async readSchemaVersion(filePath: string): Promise<number | undefined> {
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as { schemaVersion?: unknown };
      const version = Number(parsed.schemaVersion ?? 1);
      return Number.isFinite(version) ? version : undefined;
    } catch {
      return undefined;
    }
  }

  private async recordMigration(sourcePath: string, fromVersion: number, state: WorkspaceState): Promise<void> {
    const migrationStamp = stamp();
    const backupPath = path.join(this.rootDirectory, 'backups', `workspace-before-v${fromVersion}-to-v${state.schemaVersion}-${migrationStamp}.json`);
    const reportPath = path.join(this.rootDirectory, 'migrations', `migration-v${fromVersion}-to-v${state.schemaVersion}-${migrationStamp}.json`);
    await copyFile(sourcePath, backupPath);
    await writeFile(reportPath, JSON.stringify({
      fromVersion,
      toVersion: state.schemaVersion,
      migratedAt: nowIso(),
      backupPath,
      counts: {
        projects: state.projects.length,
        knowledge: state.knowledge.length,
        jobs: state.jobs.length,
        resumes: state.resumeVariants.length,
        applications: state.applications.length,
        trainingSessions: state.trainingSessions.length,
        coachSessions: state.coachSessions.length
      }
    }, null, 2), 'utf8');
  }

  private async persist(value: WorkspaceState): Promise<void> {
    const serialized = JSON.stringify(value, null, 2);
    await writeFile(this.temporaryPath, serialized, 'utf8');
    await rm(this.previousPath, { force: true });
    try {
      await rename(this.statePath, this.previousPath);
    } catch {
      // The first save has no current state yet.
    }
    try {
      await rename(this.temporaryPath, this.statePath);
    } catch (error) {
      if (await this.readValidState(this.previousPath)) {
        await copyFile(this.previousPath, this.statePath);
      }
      throw error;
    }
  }

  private async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const scheduled = this.writeQueue.catch(() => undefined).then(operation);
    this.writeQueue = scheduled.then(() => undefined, () => undefined);
    return scheduled;
  }
}
