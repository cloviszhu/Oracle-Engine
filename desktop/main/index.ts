import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, nativeImage, session, Tray } from 'electron';
import { launcherContentSecurityPolicy, secureWebPreferences } from './window-manager.js';

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let explicitQuit = false;

function registerBootstrapHandlers() {
  ipcMain.handle('launcher:get-setup-status', () => ({ configured: false }));
}

function createWindow() {
  window = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#101622',
    show: false,
    webPreferences: secureWebPreferences(join(__dirname, '../preload/bootstrap.mjs')),
  });
  window.once('ready-to-show', () => window?.show());
  window.on('close', (event) => {
    if (!explicitQuit) { event.preventDefault(); window?.hide(); }
  });
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(__dirname, '../renderer/index.html'));
}

void app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({
    responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [launcherContentSecurityPolicy] },
  }));
  registerBootstrapHandlers();
  createWindow();
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('Serenity 家庭启动器');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开启动器', click: () => window?.show() },
    { type: 'separator' },
    { label: '停止 Serenity 并退出', click: () => { explicitQuit = true; app.quit(); } },
  ]));
  tray.on('double-click', () => window?.show());
});

app.on('window-all-closed', () => undefined);
