import { access, appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDemoState, createEmptyState } from '../../shared/domain';
import { AtomicWorkspaceRepository } from '../storage/workspace-repository';
import { ObsidianVaultService } from './obsidian-vault-service';

const directories: string[] = [];

async function tempDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'interview-os-obsidian-'));
  directories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createService(): Promise<{ root: string; repository: AtomicWorkspaceRepository; service: ObsidianVaultService }> {
  const root = await tempDirectory();
  const repository = new AtomicWorkspaceRepository(path.join(root, 'workspace'));
  await repository.initialize();
  await repository.replaceState(createDemoState());
  return { root, repository, service: new ObsidianVaultService(repository) };
}

describe('ObsidianVaultService Phase 1', () => {
  it('creates a dedicated Vault without modifying .obsidian', async () => {
    const { root, service } = await createService();
    const check = await service.createDedicatedVault(root);

    expect(check.ok).toBe(true);
    expect(check.workspacePath).toBe(path.join(root, 'Interview-OS-Vault'));
    await expect(access(path.join(check.workspacePath, '03-项目经历'))).resolves.toBeUndefined();
    await expect(access(path.join(check.workspacePath, '99-模板', '项目经历模板.md'))).resolves.toBeUndefined();
    await expect(access(path.join(check.workspacePath, 'Interview OS 首页.md'))).resolves.toBeUndefined();
    await expect(access(path.join(check.workspacePath, '.obsidian'))).rejects.toThrow();
  });

  it('exports enabled entities and records stable sync index entries', async () => {
    const { root, repository, service } = await createService();
    const check = await service.createDedicatedVault(root);
    const run = await service.runSync();

    expect(run.created).toBeGreaterThan(0);
    expect(run.failed).toBe(0);
    const state = repository.getState();
    const project = state.projects[0];
    const entry = state.obsidianSyncIndex.find((item) => item.entityId === project.id);
    expect(entry?.syncStatus).toBe('synced');
    const markdown = await readFile(path.join(check.workspacePath, entry!.filePath), 'utf8');
    expect(markdown).toContain(`interview_os_id: "${project.id}"`);
    expect(markdown).toContain('<!-- interview-os:user:start -->');
  });

  it('updates an unchanged managed note atomically', async () => {
    const { root, repository, service } = await createService();
    const check = await service.createDedicatedVault(root);
    await service.runSync();
    const projectId = repository.getState().projects[0].id;
    await repository.update((draft) => {
      draft.projects[0].results = '完成灰度发布并验证核心接口。';
      draft.projects[0].updatedAt = new Date().toISOString();
    });

    const run = await service.runSync({ entityId: projectId });
    expect(run.updated).toBe(1);
    expect(run.failed).toBe(0);
    const entry = repository.getState().obsidianSyncIndex.find((item) => item.entityId === projectId)!;
    const markdown = await readFile(path.join(check.workspacePath, entry.filePath), 'utf8');
    expect(markdown).toContain('完成灰度发布并验证核心接口。');
  });

  it('does not overwrite a Vault file changed outside Interview OS', async () => {
    const { root, repository, service } = await createService();
    const check = await service.createDedicatedVault(root);
    await service.runSync();
    const projectId = repository.getState().projects[0].id;
    const entry = repository.getState().obsidianSyncIndex.find((item) => item.entityId === projectId)!;
    const filePath = path.join(check.workspacePath, entry.filePath);
    await appendFile(filePath, '\n用户在 Obsidian 中修改的内容\n', 'utf8');

    const run = await service.runSync({ entityId: projectId });
    expect(run.conflicts).toBe(1);
    expect(run.updated).toBe(0);
    expect(await readFile(filePath, 'utf8')).toContain('用户在 Obsidian 中修改的内容');
    expect(repository.getState().obsidianSyncConflicts).toHaveLength(1);
  });

  it('migrates a v0.4.0 workspace with Obsidian disabled by default', async () => {
    const root = await tempDirectory();
    const workspaceRoot = path.join(root, 'legacy-workspace');
    const legacy = createEmptyState() as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.obsidianSyncIndex;
    delete legacy.obsidianSyncConflicts;
    delete legacy.obsidianSyncRuns;
    delete legacy.coachSessions;
    delete legacy.migrationHistory;
    delete (legacy.settings as Record<string, unknown>).obsidian;
    await mkdir(path.join(workspaceRoot, 'database'), { recursive: true });
    await writeFile(path.join(workspaceRoot, 'database', 'state.json'), JSON.stringify(legacy), 'utf8');

    const repository = new AtomicWorkspaceRepository(workspaceRoot);
    const state = await repository.initialize();
    expect(state.schemaVersion).toBe(3);
    expect(state.settings.obsidian.enabled).toBe(false);
    expect(state.settings.obsidian.mode).toBe('disabled');
    expect(state.obsidianSyncIndex).toEqual([]);
  });

  it('rejects directory mappings that escape the authorized Vault', async () => {
    const { root, service } = await createService();
    await service.createDedicatedVault(root);
    await expect(service.updateSettings({ folderMapping: { projects: '../outside' } })).rejects.toThrow('包含不允许的目录');
  });
});
