import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ObsidianEntityType,
  ObsidianIntegrationSettings,
  ObsidianIntegrationSettingsInput,
  ObsidianIntegrationStatus,
  ObsidianNoteLocation,
  ObsidianSyncConflict,
  ObsidianSyncIndexEntry,
  ObsidianSyncPreview,
  ObsidianSyncPreviewItem,
  ObsidianSyncRequest,
  ObsidianSyncRun,
  ObsidianVaultCheck
} from '../../shared/domain';
import { nowIso } from '../../shared/domain';
import {
  buildObsidianExportEntities,
  extractUserBlock,
  obsidianWikiLink,
  serializeObsidianNote,
  type ObsidianExportEntity
} from '../../shared/obsidian-markdown';
import { safeFileName, validateObsidianSettingsInput, ValidationError } from '../../shared/validation';
import type { AtomicWorkspaceRepository } from '../storage/workspace-repository';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST');
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function encodeObsidianUri(vaultName: string, relativePath: string): string {
  const query = new URLSearchParams({ vault: vaultName, file: relativePath.replace(/\\/g, '/') });
  return `obsidian://open?${query.toString()}`;
}

const TEMPLATE_FILES: Record<string, string> = {
  '技术知识模板.md': 'technical-knowledge',
  '项目经历模板.md': 'project',
  '故障案例模板.md': 'incident',
  '面试问题模板.md': 'interview-question',
  '表达训练模板.md': 'interview-answer',
  'JD分析模板.md': 'jd-analysis',
  '学习计划模板.md': 'learning-plan',
  '求职复盘模板.md': 'retrospective'
};

export class ObsidianVaultService {
  constructor(private readonly repository: AtomicWorkspaceRepository) {}

  getSettings(): ObsidianIntegrationSettings {
    return structuredClone(this.repository.getState().settings.obsidian);
  }

  async updateSettings(input: ObsidianIntegrationSettingsInput): Promise<ObsidianIntegrationSettings> {
    return this.repository.update((draft) => {
      draft.settings.obsidian = validateObsidianSettingsInput(input, draft.settings.obsidian);
      return draft.settings.obsidian;
    });
  }

  async connectExistingVault(vaultPath: string): Promise<ObsidianVaultCheck> {
    const resolved = path.resolve(vaultPath);
    const current = this.getSettings();
    const next = validateObsidianSettingsInput({
      ...current,
      enabled: true,
      mode: 'existing-vault',
      syncDirection: 'export-only',
      vaultPath: resolved
    }, current);
    const check = await this.testVault(next);
    if (!check.ok) throw new ValidationError(check.message);
    await this.updateSettings(next);
    return check;
  }

  async createDedicatedVault(parentDirectory: string): Promise<ObsidianVaultCheck> {
    const root = path.join(path.resolve(parentDirectory), 'Interview-OS-Vault');
    await mkdir(root, { recursive: true });
    const current = this.getSettings();
    const next = validateObsidianSettingsInput({
      ...current,
      enabled: true,
      mode: 'dedicated-vault',
      syncDirection: 'export-only',
      vaultPath: root
    }, current);
    await this.initializeVault(next);
    await this.updateSettings(next);
    return this.testVault(next);
  }

  async testVault(settings = this.getSettings()): Promise<ObsidianVaultCheck> {
    if (!settings.vaultPath) {
      return {
        ok: false,
        vaultPath: '',
        workspacePath: '',
        hasObsidianDirectory: false,
        readable: false,
        writable: false,
        message: '尚未选择 Obsidian Vault'
      };
    }
    const vaultRoot = path.resolve(settings.vaultPath);
    const workspaceRoot = this.workspaceRoot(settings);
    let readable = false;
    let writable = false;
    try {
      await access(vaultRoot, constants.R_OK);
      readable = true;
      await access(vaultRoot, constants.W_OK);
      writable = true;
    } catch {
      // Report the exact capability flags below.
    }
    let hasObsidianDirectory = false;
    try {
      const value = await stat(path.join(vaultRoot, '.obsidian'));
      hasObsidianDirectory = value.isDirectory();
    } catch {
      hasObsidianDirectory = false;
    }
    return {
      ok: readable && writable,
      vaultPath: vaultRoot,
      workspacePath: workspaceRoot,
      hasObsidianDirectory,
      readable,
      writable,
      message: readable && writable ? 'Vault 目录可读写' : 'Vault 目录不可读写，请检查路径和权限'
    };
  }

  async initializeVault(settings = this.getSettings()): Promise<void> {
    const check = await this.testVault(settings);
    if (!check.ok) throw new ValidationError(check.message);
    const root = check.workspacePath;
    const directories = new Set(Object.values(settings.folderMapping));
    directories.add(settings.attachmentDirectory);
    await mkdir(root, { recursive: true });
    await Promise.all([...directories].map((directory) => mkdir(this.resolveInside(root, directory), { recursive: true })));
    await this.writeIfAbsent(path.join(root, 'README.md'), this.readmeContent(settings));
    await this.writeIfAbsent(path.join(root, 'Interview OS 首页.md'), this.homeContent());
    const templateRoot = this.resolveInside(root, settings.folderMapping.templates);
    await Promise.all(Object.entries(TEMPLATE_FILES).map(([fileName, entityType]) =>
      this.writeIfAbsent(path.join(templateRoot, fileName), this.templateContent(entityType as ObsidianEntityType))
    ));
  }

  async previewInitialSync(request: ObsidianSyncRequest = {}): Promise<ObsidianSyncPreview> {
    const state = this.repository.getState();
    const settings = state.settings.obsidian;
    const check = await this.requireAvailableVault(settings);
    const indexByEntity = new Map(state.obsidianSyncIndex.map((entry) => [entry.entityId, entry]));
    const entities = this.selectedEntities(request.entityId);
    const items: ObsidianSyncPreviewItem[] = [];
    for (const entity of entities) {
      const existing = indexByEntity.get(entity.entityId);
      const target = await this.targetPath(check.workspacePath, settings, entity, existing);
      const relativePath = path.relative(check.workspacePath, target);
      if (!settings.enabledEntityTypes.includes(entity.entityType)) {
        items.push({ entityId: entity.entityId, entityType: entity.entityType, title: entity.title, filePath: relativePath, action: 'skip', reason: '该对象类型未启用同步' });
        continue;
      }
      const existingText = await this.readOptional(target);
      if (!existingText) {
        items.push({ entityId: entity.entityId, entityType: entity.entityType, title: entity.title, filePath: relativePath, action: 'create', reason: 'Vault 中尚无对应笔记' });
        continue;
      }
      if (existing && sha256(existingText) !== existing.fileHash) {
        items.push({ entityId: entity.entityId, entityType: entity.entityType, title: entity.title, filePath: relativePath, action: 'conflict', reason: 'Vault 文件在上次同步后已被修改' });
        continue;
      }
      items.push({ entityId: entity.entityId, entityType: entity.entityType, title: entity.title, filePath: relativePath, action: 'update', reason: '将重建 Interview OS 托管区块' });
    }
    return { vaultPath: check.workspacePath, items };
  }

  async runSync(request: ObsidianSyncRequest = {}): Promise<ObsidianSyncRun> {
    const startedAt = nowIso();
    const state = this.repository.getState();
    const settings = state.settings.obsidian;
    const check = await this.requireAvailableVault(settings);
    await this.initializeVault(settings);
    const run: ObsidianSyncRun = {
      id: crypto.randomUUID(),
      startedAt,
      completedAt: null,
      trigger: request.trigger ?? 'manual',
      scanned: 0,
      created: 0,
      updated: 0,
      imported: 0,
      conflicts: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };
    const indexByEntity = new Map(state.obsidianSyncIndex.map((entry) => [entry.entityId, entry]));
    const nextEntries = new Map(indexByEntity);
    const newConflicts: ObsidianSyncConflict[] = [];

    for (const entity of this.selectedEntities(request.entityId)) {
      run.scanned += 1;
      if (!settings.enabledEntityTypes.includes(entity.entityType)) {
        run.skipped += 1;
        continue;
      }
      const existing = indexByEntity.get(entity.entityId);
      try {
        const target = await this.targetPath(check.workspacePath, settings, entity, existing);
        const currentText = await this.readOptional(target);
        if (currentText && existing && sha256(currentText) !== existing.fileHash) {
          const workspaceText = serializeObsidianNote(entity, startedAt, extractUserBlock(currentText));
          run.conflicts += 1;
          run.errors.push({ code: 'VAULT_MODIFIED', message: 'Vault 文件已修改，未覆盖', entityId: entity.entityId, filePath: target });
          nextEntries.set(entity.entityId, { ...existing, syncStatus: 'conflict', lastVaultModifiedAt: (await stat(target)).mtime.toISOString() });
          newConflicts.push({
            id: crypto.randomUUID(),
            entityId: entity.entityId,
            entityType: entity.entityType,
            filePath: path.relative(check.workspacePath, target),
            workspaceContent: workspaceText,
            vaultContent: currentText,
            detectedAt: nowIso(),
            resolution: 'pending'
          });
          continue;
        }
        const serialized = serializeObsidianNote(entity, startedAt, currentText ? extractUserBlock(currentText) : '');
        await mkdir(path.dirname(target), { recursive: true });
        await this.atomicWrite(target, serialized);
        const targetStat = await stat(target);
        const relativePath = path.relative(check.workspacePath, target);
        nextEntries.set(entity.entityId, {
          entityId: entity.entityId,
          entityType: entity.entityType,
          title: entity.title,
          filePath: relativePath,
          fileHash: sha256(serialized),
          workspaceVersion: (existing?.workspaceVersion ?? 0) + 1,
          vaultVersion: (existing?.vaultVersion ?? 0) + 1,
          lastWorkspaceModifiedAt: entity.updatedAt,
          lastVaultModifiedAt: targetStat.mtime.toISOString(),
          lastSyncedAt: startedAt,
          syncStatus: 'synced'
        });
        if (currentText) run.updated += 1;
        else run.created += 1;
      } catch (error) {
        run.failed += 1;
        run.errors.push({
          code: 'WRITE_FAILED',
          message: error instanceof Error ? error.message : '写入 Vault 失败',
          entityId: entity.entityId
        });
      }
    }

    run.completedAt = nowIso();
    await this.repository.update((draft) => {
      draft.obsidianSyncIndex = [...nextEntries.values()];
      if (newConflicts.length) {
        const conflictKeys = new Set(newConflicts.map((item) => `${item.entityId}:${item.filePath}`));
        draft.obsidianSyncConflicts = [
          ...draft.obsidianSyncConflicts.filter((item) => !conflictKeys.has(`${item.entityId}:${item.filePath}`)),
          ...newConflicts
        ];
      }
      draft.obsidianSyncRuns = [run, ...draft.obsidianSyncRuns].slice(0, 100);
      return run;
    });
    return structuredClone(run);
  }

  async getStatus(): Promise<ObsidianIntegrationStatus> {
    const state = this.repository.getState();
    const settings = state.settings.obsidian;
    const check = settings.vaultPath ? await this.testVault(settings) : undefined;
    const statusCounts = (status: ObsidianSyncIndexEntry['syncStatus']) =>
      state.obsidianSyncIndex.filter((entry) => entry.syncStatus === status).length;
    const lastRun = state.obsidianSyncRuns[0];
    return {
      enabled: settings.enabled,
      mode: settings.mode,
      vaultPath: settings.vaultPath,
      workspacePath: check?.workspacePath ?? null,
      available: Boolean(check?.ok),
      watcherActive: false,
      synced: statusCounts('synced'),
      pending: statusCounts('workspace-newer') + statusCounts('vault-newer') + statusCounts('missing'),
      conflicts: statusCounts('conflict'),
      failed: statusCounts('error'),
      ignored: statusCounts('ignored'),
      lastSyncAt: lastRun?.completedAt ?? undefined,
      lastRun
    };
  }

  getNoteLocation(entityId: string): ObsidianNoteLocation {
    const state = this.repository.getState();
    const settings = state.settings.obsidian;
    if (!settings.vaultPath) throw new ValidationError('尚未选择 Obsidian Vault');
    const entry = state.obsidianSyncIndex.find((item) => item.entityId === entityId);
    if (!entry) throw new ValidationError('该内容尚未同步到 Obsidian');
    const workspaceRoot = this.workspaceRoot(settings);
    const filePath = this.resolveInside(workspaceRoot, entry.filePath);
    const relativeFromVault = path.relative(path.resolve(settings.vaultPath), filePath).replace(/\\/g, '/').replace(/\.md$/i, '');
    return {
      entityId,
      entityType: entry.entityType,
      title: entry.title,
      filePath,
      relativePath: relativeFromVault,
      wikiLink: obsidianWikiLink(entry.title),
      obsidianUri: encodeObsidianUri(path.basename(path.resolve(settings.vaultPath)), relativeFromVault)
    };
  }

  async disconnect(): Promise<ObsidianIntegrationSettings> {
    return this.updateSettings({ enabled: false, mode: 'disabled', vaultPath: null, autoSync: false, scanOnStartup: false });
  }

  private selectedEntities(entityId?: string): ObsidianExportEntity[] {
    const entities = buildObsidianExportEntities(this.repository.getState());
    return entityId ? entities.filter((entity) => entity.entityId === entityId) : entities;
  }

  private workspaceRoot(settings: ObsidianIntegrationSettings): string {
    if (!settings.vaultPath) throw new ValidationError('尚未选择 Obsidian Vault');
    const vaultRoot = path.resolve(settings.vaultPath);
    return settings.mode === 'dedicated-vault'
      ? vaultRoot
      : this.resolveInside(vaultRoot, settings.workspaceSubdirectory);
  }

  private resolveInside(root: string, relativePath: string): string {
    const candidate = path.resolve(root, relativePath);
    if (!inside(root, candidate)) throw new ValidationError('路径超出已授权的 Vault 目录');
    return candidate;
  }

  private async requireAvailableVault(settings: ObsidianIntegrationSettings): Promise<ObsidianVaultCheck> {
    if (!settings.enabled || settings.mode === 'disabled') throw new ValidationError('Obsidian 集成尚未启用');
    const check = await this.testVault(settings);
    if (!check.ok) throw new ValidationError(check.message);
    return check;
  }

  private async targetPath(
    workspaceRoot: string,
    settings: ObsidianIntegrationSettings,
    entity: ObsidianExportEntity,
    existing?: ObsidianSyncIndexEntry
  ): Promise<string> {
    if (existing) return this.resolveInside(workspaceRoot, existing.filePath);
    const folder = settings.folderMapping[entity.folder];
    const baseName = safeFileName(entity.title);
    const preferred = this.resolveInside(workspaceRoot, path.join(folder, `${baseName}.md`));
    if (!await this.readOptional(preferred)) return preferred;
    return this.resolveInside(workspaceRoot, path.join(folder, `${baseName}--${entity.entityId.slice(0, 8)}.md`));
  }

  private async readOptional(filePath: string): Promise<string | undefined> {
    try {
      return await readFile(filePath, 'utf8');
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const temporaryPath = `${filePath}.interview-os-${crypto.randomUUID()}.tmp`;
    const handle = await open(temporaryPath, 'wx');
    try {
      await handle.writeFile(content, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporaryPath, filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  private async writeIfAbsent(filePath: string, content: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      await writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
    }
  }

  private readmeContent(settings: ObsidianIntegrationSettings): string {
    return `# Interview OS Vault\n\n` +
      `此目录由 Interview OS 管理，并与标准 Markdown 编辑器兼容。\n\n` +
      `- Interview OS 只管理配置的目录，不读取或修改 .obsidian。\n` +
      `- 托管内容位于 interview-os:managed 区块。\n` +
      `- 自由笔记请写在 interview-os:user 区块。\n` +
      `- 附件目录：${settings.attachmentDirectory}\n`;
  }

  private homeContent(): string {
    return '# Interview OS 首页\n\n' +
      '## 职业知识库\n\n' +
      '- [[03-项目经历]]\n- [[04-故障案例]]\n- [[05-技术知识]]\n- [[06-面试题库]]\n' +
      '- [[07-表达训练]]\n- [[08-JD分析]]\n- [[10-学习计划]]\n- [[12-求职复盘]]\n';
  }

  private templateContent(entityType: ObsidianEntityType): string {
    return `---\ninterview_os_id: ""\ninterview_os_type: ${JSON.stringify(entityType)}\n` +
      'schema_version: 1\nstatus: "draft"\nsource: "user"\nsync_enabled: true\n---\n\n' +
      '# 标题\n\n' +
      '<!-- interview-os:managed:start -->\nInterview OS 管理区\n<!-- interview-os:managed:end -->\n\n' +
      '<!-- interview-os:user:start -->\n用户自由补充区\n<!-- interview-os:user:end -->\n';
  }
}
