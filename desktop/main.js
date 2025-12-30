const path = require('path');
const fs = require('fs');
const http = require('http');
const { app, BrowserWindow } = require('electron');

// Reuse the proxy implementation packaged under desktop/app/tools/.
// (We copy the whole repo `tools/` into `desktop/app/tools/` as part of the build.)
// eslint-disable-next-line import/no-dynamic-require
const { createProxyServer } = require(path.join(__dirname, 'app', 'tools', 'syncapp-erp-api-proxy-lib.js'));

let proxyServer = null;
let proxyPort = null;
let staticServer = null;
let staticPort = null;

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

function contentTypeFor(filePath) {
  const ext = String(path.extname(filePath || '')).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

function safeJoin(rootDir, urlPath) {
  const rel = String(urlPath || '').replace(/^\//, '');
  const full = path.resolve(rootDir, rel);
  const root = path.resolve(rootDir) + path.sep;
  if (!full.startsWith(root)) return null;
  return full;
}

async function startStaticServer() {
  const rootDir = path.resolve(__dirname, 'app');
  staticServer = http.createServer((req, res) => {
    try {
      const rawUrl = String(req.url || '/');
      const u = new URL(rawUrl, 'http://127.0.0.1');
      let pathname = decodeURIComponent(u.pathname || '/');
      if (pathname === '/') pathname = '/index.html';

      const filePath = safeJoin(rootDir, pathname);
      if (!filePath) {
        res.statusCode = 400;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end('Bad request');
        return;
      }

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.statusCode = 404;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end('Not found');
        return;
      }

      const buf = fs.readFileSync(filePath);
      res.statusCode = 200;
      res.setHeader('content-type', contentTypeFor(filePath));
      // Keep things simple; avoid caching issues during development.
      res.setHeader('cache-control', 'no-store');
      res.end(buf);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(String(err));
    }
  });

  await new Promise((resolve, reject) => {
    staticServer.on('error', reject);
    staticServer.listen(0, '127.0.0.1', () => {
      const addr = staticServer.address();
      staticPort = addr && addr.port;
      resolve();
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'Team Toolbox',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const proxyBaseUrl = `http://127.0.0.1:${proxyPort}`;
  const url = `http://127.0.0.1:${staticPort}/index.html?useProxy=1&proxyBaseUrl=${encodeURIComponent(proxyBaseUrl)}`;

  win.loadURL(url);
}

app.whenReady().then(async () => {
  await startProxy();
  await startStaticServer();
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
    if (staticServer) {
      try { staticServer.close(); } catch {}
      staticServer = null;
    }
    app.quit();
  }
});


