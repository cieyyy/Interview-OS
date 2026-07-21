import { app, BrowserWindow, Menu, shell } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { registerIpc } from './ipc/register-ipc';
import { ProviderService } from './services/provider-service';
import { DocumentImportService } from './services/document-import-service';
import { JobSyncService } from './services/job-sync-service';
import { ObsidianVaultService } from './services/obsidian-vault-service';
import { WorkspaceService } from './services/workspace-service';
import { ElectronSecretStore } from './storage/secret-store';
import { AtomicWorkspaceRepository } from './storage/workspace-repository';

if (process.env.INTERVIEW_OS_DATA_DIR) {
  const isolatedUserData = path.join(path.resolve(process.env.INTERVIEW_OS_DATA_DIR), '.electron-user-data');
  mkdirSync(isolatedUserData, { recursive: true });
  app.setPath('userData', isolatedUserData);
}

// Keep the desktop client usable on older Windows installations and virtual
// machines whose GPU process cannot load. The product UI does not depend on
// hardware acceleration, so software rendering is the safer default.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');

let mainWindow: BrowserWindow | undefined;
let jobSyncService: JobSyncService | undefined;

function resolveDataDirectory(): string {
  if (process.env.INTERVIEW_OS_DATA_DIR) return path.resolve(process.env.INTERVIEW_OS_DATA_DIR);
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(path.resolve(process.env.PORTABLE_EXECUTABLE_DIR), 'Interview OS Data');
  }
  if (!app.isPackaged) return path.resolve(process.cwd(), '.runtime', 'workspace');
  return path.join(app.getPath('documents'), 'Interview OS');
}

async function createWindow(): Promise<void> {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#f4f5f7',
    show: false,
    title: 'Interview OS',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.removeMenu();

  // Speech recognition needs microphone access. Only the current application
  // window may request audio; camera, display capture and all unrelated
  // permission requests remain denied.
  const appSession = mainWindow.webContents.session;
  appSession.setPermissionCheckHandler((webContents, permission, _origin, details) => {
    return permission === 'media'
      && webContents?.id === mainWindow?.webContents.id
      && details.mediaType !== 'video';
  });
  appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes ?? [] : [];
    const allowAudio = permission === 'media'
      && webContents.id === mainWindow?.webContents.id
      && mediaTypes.includes('audio')
      && !mediaTypes.includes('video');
    callback(allowAudio);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (!allowed && !url.startsWith('file://')) event.preventDefault();
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process ended:', JSON.stringify(details));
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('Renderer failed to load:', JSON.stringify({ code, description, url }));
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const renderer = path.join(__dirname, '..', '..', 'dist', 'index.html');
    if (!existsSync(renderer)) throw new Error(`Renderer bundle not found: ${renderer}`);
    await mainWindow.loadFile(renderer);
  }
}

app.whenReady().then(async () => {
  const repository = new AtomicWorkspaceRepository(resolveDataDirectory());
  await repository.initialize();
  const workspace = new WorkspaceService(repository);
  const provider = new ProviderService(repository, new ElectronSecretStore(repository.rootDirectory));
  const documentImport = new DocumentImportService(provider);
  const obsidian = new ObsidianVaultService(repository);
  jobSyncService = new JobSyncService(workspace);
  await jobSyncService.start();
  registerIpc(workspace, repository, provider, documentImport, jobSyncService, obsidian);
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error) => {
  console.error('Failed to start Interview OS:', error instanceof Error ? error.message : error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void jobSyncService?.stop();
});
