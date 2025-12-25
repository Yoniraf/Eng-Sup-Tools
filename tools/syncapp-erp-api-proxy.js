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
 *   PORT=8787
 *   HOST=127.0.0.1
 *   ALLOWED_ORIGINS="http://127.0.0.1:5500,https://yoniraf.github.io"
 */

const { createProxyServer, parseAllowedOrigins } = require('./syncapp-erp-api-proxy-lib');

const PORT = Number(process.env.PORT || 8787);
const HOST = String(process.env.HOST || '127.0.0.1');
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

const server = createProxyServer({ allowedOrigins });

server.on('error', (err) => {
  console.error('[syncapp-erp-api-proxy] failed to start:', err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`[syncapp-erp-api-proxy] listening on http://${HOST}:${PORT}`);
  console.log(`[syncapp-erp-api-proxy] POST http://${HOST}:${PORT}/proxy`);
  console.log(`[syncapp-erp-api-proxy] health: http://${HOST}:${PORT}/health`);
  if (allowedOrigins && allowedOrigins.size) {
    console.log(`[syncapp-erp-api-proxy] allowed origins: ${[...allowedOrigins].join(', ')}`);
  } else {
    console.log('[syncapp-erp-api-proxy] allowed origins: * (dev mode)');
  }
});


