/**
 * Local HTTP server on 127.0.0.1:3721
 *   • POST /notify            — public local webhook (optional X-Pet-Secret)
 *   • GET  /health
 *   • GET  /                  — Desktop Control Center (also loaded by the native window)
 *   • /api/*                  — Control Center API, requires the per-launch X-Pet-Token
 *   • GET  /api/events        — Server-Sent Events for live dashboard updates
 *
 * Hardening: binds to loopback only, validates the Host header (DNS rebinding),
 * never sends CORS headers on /api (cross-site pages cannot read or preflight),
 * caps body sizes, and resolves static paths inside their roots only.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '../..');
const CONTROL_DIR = path.join(ROOT, 'src/control');
const ASSETS_DIR = path.join(ROOT, 'assets');

const MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

function safeJoin(root, rel) {
  const p = path.resolve(root, '.' + path.sep + decodeURIComponent(rel));
  return p === root || p.startsWith(root + path.sep) ? p : null;
}

function sendJson(res, code, obj, extraHeaders = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Payload too large'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limit = 64 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON payload'), { code: 400 }); }
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function serveFile(res, file, extraHeaders = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { sendJson(res, 404, { error: 'Not found' }); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
      ...extraHeaders
    });
    fs.createReadStream(file).pipe(res);
  });
}

/**
 * @param {object} host  Bridge to the app:
 *   apiToken, port, userPetsDir, getState(), updateSettings(patch), resetSettings(),
 *   ingest(payload, source) , previewClassify(payload), testNotify(body),
 *   adapters: AdapterHub, getWebhookSecret(), webhookEnabled(),
 *   clearHistory(), clearQueue(), onEvent(fn) → unsubscribe
 */
function startNotificationServer(host) {
  const { port, apiToken } = host;
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const sseClients = new Set();

  host.onEvent((type, data) => {
    const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) res.write(frame);
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;

    if (!allowedHosts.has(String(req.headers.host || '').toLowerCase())) {
      sendJson(res, 421, { error: 'Misdirected request' });
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
      // ---------- Public local webhook ----------
      if (p === '/notify' || p === '/health') {
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Pet-Secret' };
        if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
        if (p === '/health' && req.method === 'GET') { sendJson(res, 200, { status: 'ok', app: 'Cute Pet Companion' }, cors); return; }
        if (p === '/notify' && req.method === 'POST') {
          if (!host.webhookEnabled()) { sendJson(res, 503, { success: false, error: 'Webhook is disconnected in Control Center' }, cors); return; }
          const secret = host.getWebhookSecret();
          if (secret && !safeEqual(req.headers['x-pet-secret'], secret)) { sendJson(res, 401, { success: false, error: 'Invalid X-Pet-Secret' }, cors); return; }
          const payload = await readJson(req);
          const r = host.ingest(payload, 'webhook');
          sendJson(res, 200, { success: true, accepted: r.accepted, reason: r.reason, suppressed: !!r.suppressed, notificationId: r.item.id, emotion: r.item.emotion, matchedBy: r.item.matchedBy }, cors);
          return;
        }
      }

      // ---------- Control Center UI ----------
      if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
        const html = fs.readFileSync(path.join(CONTROL_DIR, 'index.html'), 'utf8').replace('__PET_API_TOKEN__', apiToken);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"
        });
        res.end(html);
        return;
      }
      if (req.method === 'GET' && p.startsWith('/control/')) {
        const f = safeJoin(CONTROL_DIR, p.slice('/control/'.length));
        if (f) { serveFile(res, f); return; }
      }
      if (req.method === 'GET' && p.startsWith('/assets/')) {
        const rel = p.slice('/assets/'.length);
        // User-imported models override bundled ones.
        const m = rel.match(/^pets\/([a-z0-9_]+)\/model\.glb$/);
        const override = m && path.join(host.userPetsDir, m[1], 'model.glb');
        const f = override && fs.existsSync(override) ? override : safeJoin(ASSETS_DIR, rel);
        if (f) { serveFile(res, f, { 'Access-Control-Allow-Origin': '*' }); return; }
      }

      // ---------- Authenticated API ----------
      if (p.startsWith('/api/')) {
        const token = req.headers['x-pet-token'] || (p === '/api/events' ? url.searchParams.get('token') : null);
        if (!safeEqual(token, apiToken)) { sendJson(res, 401, { error: 'Unauthorized' }); return; }

        if (p === '/api/events' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
          res.write(`event: hello\ndata: {}\n\n`);
          sseClients.add(res);
          const ping = setInterval(() => res.write(': ping\n\n'), 25000);
          req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
          return;
        }
        if (p === '/api/state' && req.method === 'GET') { sendJson(res, 200, host.getState()); return; }
        if (p === '/api/settings' && req.method === 'PUT') { sendJson(res, 200, host.updateSettings(await readJson(req, 512 * 1024))); return; }
        if (p === '/api/settings/reset' && req.method === 'POST') { sendJson(res, 200, host.resetSettings()); return; }
        if (p === '/api/classify' && req.method === 'POST') { sendJson(res, 200, host.previewClassify(await readJson(req))); return; }
        if (p === '/api/test-notification' && req.method === 'POST') { sendJson(res, 200, host.testNotify(await readJson(req))); return; }
        if (p === '/api/history' && req.method === 'DELETE') { host.clearHistory(); sendJson(res, 200, { ok: true }); return; }
        if (p === '/api/queue/clear' && req.method === 'POST') { host.clearQueue(); sendJson(res, 200, { ok: true }); return; }
        if (p === '/api/app/quit' && req.method === 'POST') { sendJson(res, 200, host.quit ? host.quit() : { ok: false }); return; }
        if (p === '/api/inbox' && req.method === 'GET') { sendJson(res, 200, host.inbox.list()); return; }
        if (p === '/api/inbox' && req.method === 'DELETE') { host.inbox.clear(); sendJson(res, 200, { ok: true }); return; }
        if (p === '/api/inbox/read' && req.method === 'POST') { const b = await readJson(req); host.inbox.markRead(typeof b.id === 'string' ? b.id : null); sendJson(res, 200, host.inbox.list()); return; }
        const im = p.match(/^\/api\/inbox\/([a-z0-9_]+)$/);
        if (im && req.method === 'DELETE') { host.inbox.remove(im[1]); sendJson(res, 200, host.inbox.list()); return; }

        // ---------- Dynamic integrations (Composio) ----------
        if (p.startsWith('/api/integrations') && host.integrations) {
          const ig = host.integrations;
          if (p === '/api/integrations' && req.method === 'GET') { sendJson(res, 200, ig.status()); return; }
          if (p === '/api/integrations/key' && req.method === 'PUT') { const b = await readJson(req); sendJson(res, 200, await ig.setKey(typeof b.key === 'string' ? b.key : '')); return; }
          if (p === '/api/integrations/catalog' && req.method === 'GET') { sendJson(res, 200, { items: await ig.catalog({ q: url.searchParams.get('q') || '', category: url.searchParams.get('category') || '' }) }); return; }
          if (p === '/api/integrations/connect' && req.method === 'POST') { sendJson(res, 200, await ig.connect(await readJson(req))); return; }
          if (p === '/api/integrations/refresh' && req.method === 'POST') { sendJson(res, 200, await ig.refresh()); return; }
          if (p === '/api/integrations/poll' && req.method === 'POST') { sendJson(res, 200, await ig.pollNow()); return; }
          if (p === '/api/integrations/triggers' && req.method === 'GET') { sendJson(res, 200, { items: await ig.triggerTypes(url.searchParams.get('toolkit') || '') }); return; }
          if (p === '/api/integrations/trigger' && req.method === 'POST') { sendJson(res, 200, await ig.setTrigger(await readJson(req))); return; }
          const ia = p.match(/^\/api\/integrations\/apps\/([a-z0-9_-]+)$/);
          if (ia && req.method === 'DELETE') { sendJson(res, 200, await ig.remove(ia[1])); return; }
        }

        const aa = p.match(/^\/api\/adapters\/([a-z_]+)\/action$/);
        if (aa && req.method === 'POST') { const b = await readJson(req); sendJson(res, 200, await host.adapters.runAction(aa[1], b.action)); return; }
        const am = p.match(/^\/api\/adapters\/([a-z_]+)\/(configure|connect|disconnect)$/);
        if (am && req.method === 'POST') {
          const [, id, op] = am;
          if (op === 'configure') sendJson(res, 200, host.adapters.configure(id, await readJson(req)));
          else sendJson(res, 200, await host.adapters[op](id));
          return;
        }

        const pm = p.match(/^\/api\/pets\/([a-z0-9_]+)\/model$/);
        if (pm) {
          const dir = path.join(host.userPetsDir, pm[1]);
          if (req.method === 'POST') {
            const buf = await readBody(req, 60 * 1024 * 1024);
            if (buf.length < 20 || buf.toString('ascii', 0, 4) !== 'glTF' || buf.readUInt32LE(4) !== 2) {
              sendJson(res, 400, { error: 'File không phải glTF Binary 2.0 (.glb) hợp lệ' });
              return;
            }
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'model.glb'), buf);
            host.onModelChanged(pm[1]);
            sendJson(res, 200, { ok: true, bytes: buf.length });
            return;
          }
          if (req.method === 'DELETE') {
            fs.rmSync(path.join(dir, 'model.glb'), { force: true });
            host.onModelChanged(pm[1]);
            sendJson(res, 200, { ok: true });
            return;
          }
        }
        sendJson(res, 404, { error: 'Endpoint not found' });
        return;
      }

      sendJson(res, 404, { error: 'Endpoint not found' });
    } catch (err) {
      const code = Number.isInteger(err.code) ? err.code : Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
      sendJson(res, code, { success: false, error: err.message });
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      console.log(`[Server] Listening on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

module.exports = { startNotificationServer };
