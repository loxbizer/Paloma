// Processus principal Electron — XENOSTRIKE
// Sert le jeu via un serveur http local (évite les restrictions file://)
// et ouvre la fenêtre de jeu. Prêt pour un packaging Steam / Epic via electron-builder.
import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createGameServer } from './tools/dev-server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow = null;

async function createWindow() {
  const { port } = await createGameServer(__dirname, 0);

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#05060f',
    autoHideMenuBar: true,
    fullscreenable: true,
    title: 'XENOSTRIKE',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.on('app:quit', () => app.quit());
ipcMain.on('app:fullscreen', () => {
  if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

app.whenReady().then(async () => {
  await createWindow();
  globalShortcut.register('F11', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
