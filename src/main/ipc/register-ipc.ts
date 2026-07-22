import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import type { OpenDialogOptions } from 'electron';
import path from 'node:path';
import type { ErrorCode, Result } from '../../shared/domain';
import { IPC } from '../../shared/ipc';
import { ValidationError } from '../../shared/validation';
import { ProviderHttpError } from '../connectors/ai-provider';
import type { ProviderService } from '../services/provider-service';
import type { DocumentImportService } from '../services/document-import-service';
import type { JobSyncService } from '../services/job-sync-service';
import type { ObsidianVaultService } from '../services/obsidian-vault-service';
import type { WorkspaceService } from '../services/workspace-service';
import type { AtomicWorkspaceRepository } from '../storage/workspace-repository';

function errorCode(error: unknown): ErrorCode {
  if (error instanceof ValidationError) return 'VALIDATION_ERROR';
  if (error instanceof ProviderHttpError) {
    if (error.status === 401 || error.status === 403) return 'AUTH_ERROR';
    if (error.status === 429) return 'RATE_LIMITED';
    return 'NETWORK_ERROR';
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return 'NETWORK_ERROR';
  if (error instanceof Error && /未找到/.test(error.message)) return 'NOT_FOUND';
  return 'INTERNAL_ERROR';
}

async function safe<T>(operation: () => T | Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const message = error instanceof Error ? error.message : '发生未知错误';
    return { ok: false, error: { code: errorCode(error), message } };
  }
}

export function registerIpc(
  workspace: WorkspaceService,
  repository: AtomicWorkspaceRepository,
  provider: ProviderService,
  documentImport: DocumentImportService,
  jobSync: JobSyncService,
  obsidian: ObsidianVaultService
): void {
  ipcMain.handle(IPC.getState, () => safe(() => workspace.getState()));
  ipcMain.handle(IPC.resetDemo, () => safe(() => workspace.resetDemo()));
  ipcMain.handle(IPC.saveProfile, (_event, input) => safe(() => workspace.saveProfile(input)));
  ipcMain.handle(IPC.saveKnowledge, (_event, input) => safe(() => workspace.saveKnowledge(input)));
  ipcMain.handle(IPC.deleteKnowledge, (_event, id) => safe(() => workspace.deleteKnowledge(String(id))));
  ipcMain.handle(IPC.saveProject, (_event, input) => safe(() => workspace.saveProject(input)));
  ipcMain.handle(IPC.analyzeJob, (_event, input) => safe(() => workspace.analyzeJob(input)));
  ipcMain.handle(IPC.saveApplication, (_event, input) => safe(() => workspace.saveApplication(input)));
  ipcMain.handle(IPC.saveResumeVariant, (_event, input) => safe(() => workspace.saveResumeVariant(input)));
  ipcMain.handle(IPC.saveJobSource, (_event, input) => safe(() => workspace.saveJobSource(input)));
  ipcMain.handle(IPC.saveJobFilterPreset, (_event, input) => safe(() => workspace.saveJobFilterPreset(input)));
  ipcMain.handle(IPC.saveJobAlertRule, (_event, input) => safe(() => workspace.saveJobAlertRule(input)));
  ipcMain.handle(IPC.validateJobSource, (_event, id) => safe(() => workspace.validateJobSource(String(id))));
  ipcMain.handle(IPC.saveCareerSearchPlan, (_event, input) => safe(() => workspace.saveCareerSearchPlan(input)));
  ipcMain.handle(IPC.runCareerSearchPlan, (_event, id) => safe(() => workspace.runCareerSearchPlan(String(id))));
  ipcMain.handle(IPC.saveCareerMemory, (_event, input) => safe(() => workspace.saveCareerMemory(input)));
  ipcMain.handle(IPC.saveCompanyWatch, (_event, input) => safe(() => workspace.saveCompanyWatch(input)));
  ipcMain.handle(IPC.validateCompanyWatch, (_event, id) => safe(() => workspace.validateCompanyWatch(String(id))));
  ipcMain.handle(IPC.checkCompanyWatchesOnStartup, () => safe(() => workspace.checkCompanyWatchesOnStartup()));
  ipcMain.handle(IPC.getJobSyncStatus, () => safe(() => jobSync.getStatus()));
  ipcMain.handle(IPC.promoteSyncedJob, (_event, id) => safe(() => workspace.promoteSyncedJob(String(id))));
  ipcMain.handle(IPC.updateSyncedJobStatus, (_event, id, status) => safe(() => workspace.updateSyncedJobStatus(String(id), status)));
  ipcMain.handle(IPC.deleteSyncedJobPermanently, (_event, id) => safe(() => workspace.deleteSyncedJobPermanently(String(id))));
  ipcMain.handle(IPC.startTraining, (_event, input) => safe(() => workspace.startTraining(input)));
  ipcMain.handle(IPC.submitTraining, (_event, input) => safe(() => workspace.submitTraining(input)));
  ipcMain.handle(IPC.finalizeTraining, (_event, input) => safe(() => workspace.finalizeTraining(input)));
  ipcMain.handle(IPC.coachTraining, (_event, input) => safe(() => provider.coach(input)));
  ipcMain.handle(IPC.createBackup, () => safe(() => repository.createBackup()));
  ipcMain.handle(IPC.exportMarkdown, () => safe(() => repository.exportMarkdown()));
  ipcMain.handle(IPC.saveProvider, (_event, input) => safe(() => provider.save(input)));
  ipcMain.handle(IPC.testProvider, () => safe(() => provider.testConnection()));
  ipcMain.handle(IPC.copyText, (_event, value) => safe(() => {
    clipboard.writeText(String(value ?? ''));
    return { copied: true };
  }));
  ipcMain.handle(IPC.importDocument, (event, target) => safe(() => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    return documentImport.selectAndImport(parent, String(target) as 'job' | 'profile' | 'knowledge');
  }));
  ipcMain.handle(IPC.selectObsidianVault, (event) => safe(async () => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = parent
      ? await dialog.showOpenDialog(parent, { title: '选择 Obsidian Vault', properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ title: '选择 Obsidian Vault', properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    return obsidian.connectExistingVault(result.filePaths[0]);
  }));
  ipcMain.handle(IPC.createObsidianVault, (event) => safe(async () => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const options: OpenDialogOptions = {
      title: '选择专属职业知识 Vault 的保存位置',
      properties: ['openDirectory', 'createDirectory']
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    return obsidian.createDedicatedVault(result.filePaths[0]);
  }));
  ipcMain.handle(IPC.testObsidianVault, () => safe(() => obsidian.testVault()));
  ipcMain.handle(IPC.getObsidianSettings, () => safe(() => obsidian.getSettings()));
  ipcMain.handle(IPC.updateObsidianSettings, (_event, input) => safe(() => obsidian.updateSettings(input)));
  ipcMain.handle(IPC.previewObsidianSync, (_event, input) => safe(() => obsidian.previewInitialSync(input ?? {})));
  ipcMain.handle(IPC.runObsidianSync, (_event, input) => safe(() => obsidian.runSync(input ?? {})));
  ipcMain.handle(IPC.getObsidianStatus, () => safe(() => obsidian.getStatus()));
  ipcMain.handle(IPC.openObsidianNote, (_event, entityId) => safe(async () => {
    const location = obsidian.getNoteLocation(String(entityId));
    await shell.openExternal(location.obsidianUri);
    return location;
  }));
  ipcMain.handle(IPC.openObsidianFolder, () => safe(async () => {
    const status = await obsidian.getStatus();
    if (!status.workspacePath) throw new Error('尚未选择 Obsidian Vault');
    const message = await shell.openPath(status.workspacePath);
    return { opened: !message, message };
  }));
  ipcMain.handle(IPC.copyObsidianWikiLink, (_event, entityId) => safe(() => {
    const location = obsidian.getNoteLocation(String(entityId));
    clipboard.writeText(location.wikiLink);
    return { wikiLink: location.wikiLink };
  }));
  ipcMain.handle(IPC.disconnectObsidian, () => safe(() => obsidian.disconnect()));
  ipcMain.handle(IPC.getMeta, () => safe(() => ({
    version: app.getVersion(),
    dataDirectory: repository.rootDirectory,
    extensionDirectory: app.isPackaged
      ? path.join(process.resourcesPath, 'browser-extension')
      : path.resolve(process.cwd(), 'browser-extension'),
    platform: process.platform,
    isPackaged: app.isPackaged
  })));
}
