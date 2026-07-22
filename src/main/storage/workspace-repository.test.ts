import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDemoState } from '../../shared/domain';
import { AtomicWorkspaceRepository } from './workspace-repository';

const directories: string[] = [];

async function tempDirectory(): Promise<string> {
  const value = await mkdtemp(path.join(os.tmpdir(), 'interview-os-'));
  directories.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('AtomicWorkspaceRepository', () => {
  it('persists and reloads workspace state', async () => {
    const root = await tempDirectory();
    const first = new AtomicWorkspaceRepository(root);
    await first.initialize();
    await first.replaceState(createDemoState());

    const second = new AtomicWorkspaceRepository(root);
    await second.initialize();
    expect(second.getState().projects[0].name).toBe('AI 漫剧算力平台');
  });

  it('recovers from a corrupt current state using previous state', async () => {
    const root = await tempDirectory();
    const repository = new AtomicWorkspaceRepository(root);
    await repository.initialize();
    await repository.replaceState(createDemoState());
    await repository.update((draft) => { draft.settings.workspaceName = '第二版'; });
    await writeFile(path.join(root, 'database', 'state.json'), '{corrupt', 'utf8');

    const recovered = new AtomicWorkspaceRepository(root);
    await recovered.initialize();
    expect(recovered.getState().projects.length).toBeGreaterThan(0);
  });

  it('creates credential-free backup and markdown export', async () => {
    const root = await tempDirectory();
    const repository = new AtomicWorkspaceRepository(root);
    await repository.initialize();
    const state = createDemoState();
    state.settings.provider = {
      kind: 'openai-compatible', name: 'Test', baseUrl: 'https://example.com/v1', model: 'test', enabled: true, hasSecret: true
    };
    await repository.replaceState(state);
    const backup = await repository.createBackup();
    const backupText = await readFile(backup.path, 'utf8');
    expect(backupText).not.toContain('sk-');
    const exported = await repository.exportMarkdown();
    expect(exported.files).toBeGreaterThan(1);
  });

  it('backs up and migrates a v0.5 schema without losing career data', async () => {
    const root = await tempDirectory();
    const legacy = createDemoState() as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    delete legacy.coachSessions;
    delete legacy.migrationHistory;
    const now = new Date().toISOString();
    legacy.trainingSessions = [{
      id: 'legacy-training', title: 'v0.5 历史训练', status: 'completed', currentQuestionIndex: 0,
      language: 'zh-CN', mode: 'standard', createdAt: now, updatedAt: now,
      questions: [{ id: 'legacy-question', text: '请介绍项目', type: 'project', difficulty: 'medium', rationale: '', targetKeywords: [], relatedIds: [] }],
      attempts: [{ id: 'legacy-answer', questionId: 'legacy-question', answer: '真实历史回答', dimensions: [], totalScore: 80, feedback: [], clarifyingQuestions: [], isFinal: true, createdAt: now, updatedAt: now }]
    }];
    for (const item of legacy.knowledge as Array<Record<string, unknown>>) {
      delete item.jobIds;
      delete item.projectIds;
      delete item.skillNames;
      delete item.visibility;
    }
    await mkdir(path.join(root, 'database'), { recursive: true });
    await writeFile(path.join(root, 'database', 'state.json'), JSON.stringify(legacy), 'utf8');

    const repository = new AtomicWorkspaceRepository(root);
    const state = await repository.initialize();
    expect(state.schemaVersion).toBe(3);
    expect(state.projects).toHaveLength(1);
    expect(state.knowledge).toHaveLength(1);
    expect(state.knowledge[0].visibility).toBe('private');
    expect(state.trainingSessions).toHaveLength(1);
    expect(state.coachSessions).toHaveLength(1);
    expect(state.coachSessions[0]).toMatchObject({ linkedTrainingSessionId: 'legacy-training', title: 'v0.5 历史训练' });
    expect(state.coachSessions[0].messages.some((item) => item.content === '真实历史回答')).toBe(true);
    expect(state.migrationHistory[0]).toMatchObject({ fromVersion: 2, toVersion: 3 });
    expect((await readdir(path.join(root, 'backups'))).some((name) => name.includes('before-v2-to-v3'))).toBe(true);
    expect((await readdir(path.join(root, 'migrations'))).some((name) => name.includes('migration-v2-to-v3'))).toBe(true);
  });
});
