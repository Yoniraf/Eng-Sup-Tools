const path = require('path');
const { app, BrowserWindow } = require('electron');

// Reuse the proxy implementation packaged under desktop/app/tools/.
// (We copy the whole repo `tools/` into `desktop/app/tools/` as part of the build.)
// eslint-disable-next-line import/no-dynamic-require
const { createProxyServer } = require(path.join(__dirname, 'app', 'tools', 'syncapp-erp-api-proxy-lib.js'));

let proxyServer = null;
let proxyPort = null;

async function startProxy() {
  // Desktop app is not a browser origin, so no need for allowlist.
  proxyServer = createProxyServer({ allowedOrigins: new Set() });
  await new Promise((resolve, reject) => {
    proxyServer.on('error', reject);
    proxyServer.listen(0, '127.0.0.1', () => {
      const addr = proxyServer.address();
      proxyPort = addr && addr.port;
      resolve();
    });
  });
}

function getToolFilePath() {
  // When packaged, files are in the asar; electron can load file:// paths from app resources.
  // We ship the tool under desktop/app/tools/ so it can reference ../assets/tool.css.
  return path.resolve(__dirname, 'app', 'tools', 'syncapp-erp-api-runner.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'SyncApp ERP API Runner',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const toolFile = getToolFilePath();
  const proxyBaseUrl = `http://127.0.0.1:${proxyPort}`;
  const url = `file://${toolFile}?useProxy=1&proxyBaseUrl=${encodeURIComponent(proxyBaseUrl)}`;

  win.loadURL(url);
}

app.whenReady().then(async () => {
  await startProxy();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (proxyServer) {
      try { proxyServer.close(); } catch {}
      proxyServer = null;
    }
    app.quit();
  }
});


