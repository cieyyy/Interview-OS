import { app, ipcMain } from 'electron';
import type { ErrorCode, Result } from '../../shared/domain';
import { IPC } from '../../shared/ipc';
import { ValidationError } from '../../shared/validation';
import { ProviderHttpError } from '../connectors/ai-provider';
import type { ProviderService } from '../services/provider-service';
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
  provider: ProviderService
): void {
  ipcMain.handle(IPC.getState, () => safe(() => workspace.getState()));
  ipcMain.handle(IPC.resetDemo, () => safe(() => workspace.resetDemo()));
  ipcMain.handle(IPC.saveProfile, (_event, input) => safe(() => workspace.saveProfile(input)));
  ipcMain.handle(IPC.saveKnowledge, (_event, input) => safe(() => workspace.saveKnowledge(input)));
  ipcMain.handle(IPC.deleteKnowledge, (_event, id) => safe(() => workspace.deleteKnowledge(String(id))));
  ipcMain.handle(IPC.saveProject, (_event, input) => safe(() => workspace.saveProject(input)));
  ipcMain.handle(IPC.analyzeJob, (_event, input) => safe(() => workspace.analyzeJob(input)));
  ipcMain.handle(IPC.startTraining, (_event, input) => safe(() => workspace.startTraining(input)));
  ipcMain.handle(IPC.submitTraining, (_event, input) => safe(() => workspace.submitTraining(input)));
  ipcMain.handle(IPC.finalizeTraining, (_event, input) => safe(() => workspace.finalizeTraining(input)));
  ipcMain.handle(IPC.createBackup, () => safe(() => repository.createBackup()));
  ipcMain.handle(IPC.exportMarkdown, () => safe(() => repository.exportMarkdown()));
  ipcMain.handle(IPC.saveProvider, (_event, input) => safe(() => provider.save(input)));
  ipcMain.handle(IPC.testProvider, () => safe(() => provider.testConnection()));
  ipcMain.handle(IPC.getMeta, () => safe(() => ({
    version: app.getVersion(),
    dataDirectory: repository.rootDirectory,
    platform: process.platform,
    isPackaged: app.isPackaged
  })));
}
