import { contextBridge, ipcRenderer } from 'electron';
import type { InterviewOSApi } from '../shared/ipc';

// Keep preload self-contained. Sandboxed Electron preload scripts may only
// load a restricted set of modules, so runtime imports from application code
// are deliberately avoided here.
const IPC = {
  getState: 'workspace:get-state',
  resetDemo: 'workspace:reset-demo',
  saveProfile: 'profile:save',
  saveKnowledge: 'knowledge:save',
  deleteKnowledge: 'knowledge:delete',
  saveProject: 'project:save',
  analyzeJob: 'job:analyze',
  startTraining: 'training:start',
  submitTraining: 'training:submit',
  finalizeTraining: 'training:finalize',
  createBackup: 'backup:create',
  exportMarkdown: 'export:markdown',
  saveProvider: 'provider:save',
  testProvider: 'provider:test',
  getMeta: 'app:get-meta',
  importDocument: 'document:import'
} as const;

const api: InterviewOSApi = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  resetDemo: () => ipcRenderer.invoke(IPC.resetDemo),
  saveProfile: (input) => ipcRenderer.invoke(IPC.saveProfile, input),
  saveKnowledge: (input) => ipcRenderer.invoke(IPC.saveKnowledge, input),
  deleteKnowledge: (id) => ipcRenderer.invoke(IPC.deleteKnowledge, id),
  saveProject: (input) => ipcRenderer.invoke(IPC.saveProject, input),
  analyzeJob: (input) => ipcRenderer.invoke(IPC.analyzeJob, input),
  startTraining: (input) => ipcRenderer.invoke(IPC.startTraining, input),
  submitTraining: (input) => ipcRenderer.invoke(IPC.submitTraining, input),
  finalizeTraining: (input) => ipcRenderer.invoke(IPC.finalizeTraining, input),
  createBackup: () => ipcRenderer.invoke(IPC.createBackup),
  exportMarkdown: () => ipcRenderer.invoke(IPC.exportMarkdown),
  saveProvider: (input) => ipcRenderer.invoke(IPC.saveProvider, input),
  testProvider: () => ipcRenderer.invoke(IPC.testProvider),
  getMeta: () => ipcRenderer.invoke(IPC.getMeta),
  importDocument: (target) => ipcRenderer.invoke(IPC.importDocument, target)
};

contextBridge.exposeInMainWorld('interviewOS', api);
