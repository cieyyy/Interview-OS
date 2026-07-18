import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
});

