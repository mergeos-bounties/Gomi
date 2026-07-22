const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const { resolveRendererEntry } = require('./resolveRendererEntry.cjs');
const { createAutoUpdaterStub, shouldCheckForUpdates } = require('./autoUpdater.js');

const isDev = !app.isPackaged;
const rendererEntry = path.join(__dirname, '..', 'dist', 'index.html');

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b0b12',
    title: 'Gomi IDE',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  const entry = resolveRendererEntry({
    isPackaged: app.isPackaged,
    env: process.env,
    distIndexHtml: rendererEntry
  });

  if (entry.kind === 'url') {
    void window.loadURL(entry.target);
  } else {
    void window.loadFile(entry.target);
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\\/\\//i.test(url)) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    const allowDevServer =
      entry.kind === 'url' &&
      (url === entry.target || url.startsWith(entry.target.replace(/\\/$/, '') + '/'));

    if (allowDevServer) {
      return;
    }

    if (!url.startsWith('file://')) {
      event.preventDefault();

      if (/^https?:\\/\\//i.test(url)) {
        void shell.openExternal(url);
      }
    }
  });
}

app.whenReady().then(() => {
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  createWindow();

  // Setup auto-update stub (optional, off by default)
  if (!isDev) {
    const autoUpdateEnabled = process.env.GOMI_AUTO_UPDATE === 'true';
    const autoUpdateProvider = process.env.GOMI_AUTO_UPDATE_PROVIDER || 'github';
    const autoUpdateRepo = process.env.GOMI_AUTO_UPDATE_REPO || 'Gomi/Gomi-IDE'; // default
    const autoUpdateUrl = process.env.GOMI_AUTO_UPDATE_URL;
    const autoUpdateChannel = process.env.GOMI_AUTO_UPDATE_CHANNEL || 'latest';

    const config = {
      enabled: autoUpdateEnabled,
      provider: autoUpdateProvider,
      repo: autoUpdateRepo,
      url: autoUpdateUrl,
      channel: autoUpdateChannel
    };

    const updater = createAutoUpdaterStub(config);
    if (updater && shouldCheckForUpdates(config)) {
      // In a real implementation would call updater.checkForUpdates();
      console.log('Auto-update stub initialized (checks disabled by default for safety)');
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
