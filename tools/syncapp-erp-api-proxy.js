#!/usr/bin/env node
/**
 * SyncApp ERP API proxy (standalone server)
 *
 * Purpose:
 * - Browser-based tools hosted on GitHub Pages cannot call SyncApp ERP directly due to CORP/CORS.
 * - This proxy makes the request server-side and returns it with permissive CORS.
 *
 * Usage:
 *   node tools/syncapp-erp-api-proxy.js
 *
 * Env:
 *   PORT=8787        (or PORT=0 to pick any free port)
 *   HOST=127.0.0.1
 *   ALLOWED_ORIGINS="http://127.0.0.1:5500,https://yoniraf.github.io"
 */

const { createProxyServer, parseAllowedOrigins } = require('./syncapp-erp-api-proxy-lib');

const portEnv = process.env.PORT;
const requestedPort = Number(portEnv === undefined || portEnv === null ? 8787 : portEnv);
const HOST = String(process.env.HOST || '127.0.0.1');
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

const server = createProxyServer({ allowedOrigins });

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    const addr = err.address || HOST;
    const p = err.port || requestedPort;
    console.error(`[syncapp-erp-api-proxy] failed to start: port already in use (${addr}:${p})`);
    console.error('');
    console.error('Fix options:');
    console.error(`- Find the process:   lsof -nP -iTCP:${p} -sTCP:LISTEN`);
    console.error('  Then stop it:       kill <PID>   (or: kill -9 <PID> if needed)');
    console.error(`- Or run on new port: PORT=8788 node tools/syncapp-erp-api-proxy.js`);
    console.error(`- Or auto-pick port:  PORT=0    node tools/syncapp-erp-api-proxy.js`);
    console.error('  If you change the port, also update the tool UI "Proxy base URL" to match.');
  } else {
    console.error('[syncapp-erp-api-proxy] failed to start:', err);
  }
  process.exit(1);
});

server.listen(requestedPort, HOST, () => {
  const addr = server.address();
  const actualPort = (addr && typeof addr === 'object') ? addr.port : requestedPort;
  console.log(`[syncapp-erp-api-proxy] listening on http://${HOST}:${actualPort}`);
  console.log(`[syncapp-erp-api-proxy] POST http://${HOST}:${actualPort}/proxy`);
  console.log(`[syncapp-erp-api-proxy] health: http://${HOST}:${actualPort}/health`);
  if (allowedOrigins && allowedOrigins.size) {
    console.log(`[syncapp-erp-api-proxy] allowed origins: ${[...allowedOrigins].join(', ')}`);
  } else {
    console.log('[syncapp-erp-api-proxy] allowed origins: * (dev mode)');
  }
});



