import { app, BrowserWindow, Menu, shell } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { registerIpc } from './ipc/register-ipc';
import { ProviderService } from './services/provider-service';
import { DocumentImportService } from './services/document-import-service';
import { WorkspaceService } from './services/workspace-service';
import { ElectronSecretStore } from './storage/secret-store';
import { AtomicWorkspaceRepository } from './storage/workspace-repository';

// Keep the desktop client usable on older Windows installations and virtual
// machines whose GPU process cannot load. The product UI does not depend on
// hardware acceleration, so software rendering is the safer default.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');

let mainWindow: BrowserWindow | undefined;

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
  registerIpc(workspace, repository, provider, documentImport);
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
