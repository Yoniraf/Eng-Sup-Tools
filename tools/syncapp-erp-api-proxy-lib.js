/**
 * SyncApp ERP API proxy library (reusable).
 *
 * Used by:
 * - the desktop wrapper app (Electron) to auto-start a local proxy
 *
 * Security:
 * - Only allows proxying to https://*.tipalti.com
 * - Supports optional Origin allowlist for browser clients
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

function sanitizeHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    const key = String(k || '').toLowerCase().trim();
    if (!key) continue;
    // allowlist only a few headers we need
    if (!['authorization', 'accept', 'content-type'].includes(key)) continue;
    if (v === undefined || v === null) continue;
    out[key] = String(v);
  }
  if (!out['accept']) out['accept'] = 'application/json';
  return out;
}

function validateTarget(rawUrl) {
  let u;
  try {
    u = new URL(String(rawUrl));
  } catch {
    return { ok: false, error: 'Invalid url' };
  }
  if (u.protocol !== 'https:') return { ok: false, error: 'Only https:// targets are allowed' };
  // Restrict to Tipalti domains to avoid creating an open proxy.
  if (!u.hostname.endsWith('.tipalti.com')) return { ok: false, error: 'Target hostname must end with .tipalti.com' };
  return { ok: true, url: u };
}

function doRequest({ url, method, headers, timeoutMs, body }) {
  return new Promise((resolve) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
      },
      (resp) => {
        let body = '';
        resp.setEncoding('utf8');
        resp.on('data', (chunk) => (body += chunk));
        resp.on('end', () => {
          const respHeaders = {};
          for (const [k, v] of Object.entries(resp.headers || {})) {
            respHeaders[String(k).toLowerCase()] = Array.isArray(v) ? v.join(', ') : (v === undefined || v === null ? '' : v);
          }
          resolve({
            ok: resp.statusCode >= 200 && resp.statusCode < 300,
            status: resp.statusCode || 0,
            headers: respHeaders,
            bodyText: body,
          });
        });
      }
    );

    req.on('error', (err) => {
      resolve({ ok: false, status: 0, headers: {}, bodyText: '', error: String(err) });
    });

    if (timeoutMs && Number(timeoutMs) > 0) {
      req.setTimeout(Number(timeoutMs), () => {
        req.destroy(new Error(`Timeout after ${timeoutMs}ms`));
      });
    }

    const m = String(method || 'GET').toUpperCase();
    if (body !== undefined && body !== null && !['GET', 'HEAD'].includes(m)) {
      const bodyStr = String(body);
      try {
        // Content-Length helps some upstreams; safe to compute for UTF-8 strings.
        req.setHeader('Content-Length', Buffer.byteLength(bodyStr, 'utf8'));
      } catch {}
      req.write(bodyStr);
    }
    req.end();
  });
}

function parseAllowedOrigins(raw) {
  const ALLOWED_ORIGINS = String(raw || '').trim();
  return new Set(
    ALLOWED_ORIGINS
      ? ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
      : []
  );
}

function originAllowed(origin, allowedOrigins) {
  if (!origin) return true; // non-browser clients
  if (!allowedOrigins || !allowedOrigins.size) return true; // dev mode
  return allowedOrigins.has(origin);
}

function setCors(req, res, allowedOrigins) {
  const origin = String(req.headers.origin || '');
  if (allowedOrigins && allowedOrigins.size) {
    if (originAllowed(origin, allowedOrigins)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function createProxyServer({ allowedOrigins, enableHealth = true } = {}) {
  const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      if (!originAllowed(String(req.headers.origin || ''), allowedOrigins)) {
        res.statusCode = 403;
        res.end();
        return;
      }
      setCors(req, res, allowedOrigins);
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!originAllowed(String(req.headers.origin || ''), allowedOrigins)) {
      setCors(req, res, allowedOrigins);
      res.statusCode = 403;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, status: 0, error: 'Origin not allowed' }));
      return;
    }

    setCors(req, res, allowedOrigins);

    if (enableHealth && req.url === '/health') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        ok: true,
        service: 'syncapp-erp-api-proxy',
        originAllowlistEnabled: Boolean(allowedOrigins && allowedOrigins.size),
        allowedOrigins: (allowedOrigins && allowedOrigins.size) ? [...allowedOrigins] : undefined,
      }));
      return;
    }

    if (req.url !== '/proxy') {
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Not found', routes: ['/proxy', '/health'] }));
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
      return;
    }

    // Read body
    let buf = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > 2_000_000) {
        res.statusCode = 413;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, status: 0, error: 'Request body too large' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(buf || '{}');

        const method = String(payload.method || 'GET').toUpperCase();
        const headers = sanitizeHeaders(payload.headers || {});
        const timeoutMs = payload.timeoutMs;
        const body = payload.body;

        const v = validateTarget(payload.url);
        if (!v.ok) {
          res.statusCode = 400;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, status: 0, error: v.error }));
          return;
        }

        const result = await doRequest({ url: v.url, method, headers, timeoutMs, body });
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(result));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, status: 0, error: String(err) }));
      }
    });
  });

  return server;
}

module.exports = {
  createProxyServer,
  parseAllowedOrigins,
};


