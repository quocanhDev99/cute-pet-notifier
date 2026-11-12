/**
 * Local HTTP server on 127.0.0.1 — port 3721 by default, or the next candidate that can be bound
 * (Windows may reserve 3721 for Hyper-V / WSL / Docker → EACCES; another program may hold it).
 *   • POST /notify            — public local webhook (optional X-Pet-Secret)
 *   • GET  /health
 *   • GET  /                  — Desktop Control Center (also loaded by the native window)
 *   • /api/*                  — Control Center API, requires the per-launch X-Pet-Token
 *   • GET  /api/events        — Server-Sent Events for live dashboard updates
 *
 * Hardening: binds to loopback only, validates the Host header (DNS rebinding),
 * never sends CORS headers (cross-site pages cannot read or preflight), refuses browser requests
 * coming from another origin on /notify, caps body sizes, and resolves static paths inside their
 * roots only. The Control Center page (which carries the API token) is only served to a client
 * holding the session cookie, obtained through a single-use launch link minted by the app
 * itself — other local processes cannot simply GET / to read the token.
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
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch { return null; } // malformed %-escape
  if (decoded.includes('\0')) return null;
  const p = path.resolve(root, '.' + path.sep + decoded);
  return p === root || p.startsWith(root + path.sep) ? p : null;
}

const httpError = (code, message) => Object.assign(new Error(message), { status: code });

function sendJson(res, code, obj, extraHeaders = {}) {
  if (res.headersSent || res.destroyed) { if (!res.writableEnded) res.destroy(); return; }
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(obj));
}

/** Read a request body up to `limit` bytes. Over the limit: stop reading and fail with 413; the
 *  response (sent with "Connection: close") is still delivered before the socket goes away. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) { req.pause(); reject(httpError(413, 'Payload too large')); return; }
    const chunks = [];
    let size = 0;
    const onData = (c) => {
      size += c.length;
      if (size > limit) {
        req.removeListener('data', onData);
        req.pause();
        reject(httpError(413, 'Payload too large'));
        return;
      }
      chunks.push(c);
    };
    req.on('data', onData);
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limit = 64 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  let v;
  try { v = JSON.parse(buf.toString('utf8')); } catch { throw httpError(400, 'Invalid JSON payload'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw httpError(400, 'JSON payload must be an object');
  return v;
}

/** Constant-time compare. An empty expected value never matches (no "token unset = open door"). */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return bb.length > 0 && ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function serveFile(res, file, extraHeaders = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { sendJson(res, 404, { error: 'Not found' }); return; }
    const stream = fs.createReadStream(file);
    stream.on('error', () => {
      if (!res.headersSent) sendJson(res, 500, { error: 'Read error' });
      else res.destroy();
    });
    stream.once('open', () => {
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'no-cache',
        ...extraHeaders
      });
      stream.pipe(res);
    });
    res.on('close', () => stream.destroy());
  });
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** A browser request made by a page from another origin (fetch/form from any website). */
function crossOrigin(req, allowedOrigins) {
  const origin = req.headers.origin;
  if (origin && origin !== 'null' && !allowedOrigins.has(String(origin).toLowerCase())) return true;
  if (origin === 'null') return true; // sandboxed iframes / file:// pages
  const site = req.headers['sec-fetch-site'];
  return !!site && site !== 'same-origin' && site !== 'none';
}

/**
 * @param {object} host  Bridge to the app:
 *   apiToken, port | ports (candidates, tried in order; 0 = any free port), userPetsDir, getState(), updateSettings(patch), resetSettings(),
 *   ingest(payload, source) , previewClassify(payload), testNotify(body),
 *   adapters: AdapterHub, getWebhookSecret(), webhookEnabled(),
 *   clearHistory(), clearQueue(), onEvent(fn) → unsubscribe
 */
function startNotificationServer(host) {
  const { apiToken } = host;
  if (!apiToken || String(apiToken).length < 16) throw new Error('startNotificationServer: apiToken must be a random string (≥16 chars)');
  const candidates = [...new Set((host.ports || [host.port]).map(Number))].filter(p => Number.isInteger(p) && p >= 0 && p <= 65535);
  if (!candidates.length) throw new Error('startNotificationServer: no valid port');
  // The real port is only known once bound; everything below reads these live bindings.
  let port, allowedHosts, allowedOrigins;
  const usePort = (p) => {
    port = p;
    allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  };
  usePort(candidates[0]);
  const sseClients = new Set();
  // Control Center session: a single-use launch ticket (minted in-process) is exchanged for an
  // HttpOnly, SameSite=Strict cookie; only a client holding it receives the page with the token.
  const SESSION_COOKIE = 'cpc_session';
  const sessionId = crypto.randomBytes(24).toString('hex');
  const tickets = new Map(); // ticket → expiresAt
  const launchUrl = (hash = '') => {
    const now = Date.now();
    for (const [t, exp] of tickets) if (exp < now) tickets.delete(t);
    const ticket = crypto.randomBytes(18).toString('hex');
    tickets.set(ticket, now + 2 * 60 * 1000);
    const h = hash ? (String(hash).startsWith('#') ? String(hash) : `#${hash}`) : '';
    return `http://127.0.0.1:${port}/?launch=${ticket}${h}`;
  };

  const sseWrite = (res, chunk) => {
    if (res.writableEnded || res.destroyed) { sseClients.delete(res); return; }
    try { res.write(chunk); } catch { sseClients.delete(res); }
  };
  host.onEvent((type, data) => {
    const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) sseWrite(res, frame);
  });

  const server = http.createServer(async (req, res) => {
    if (!allowedHosts.has(String(req.headers.host || '').toLowerCase())) {
      sendJson(res, 421, { error: 'Misdirected request' });
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
      let url;
      try { url = new URL(req.url, `http://127.0.0.1:${port}`); } catch { throw httpError(400, 'Bad request URL'); }
      const p = url.pathname;

      // ---------- Local webhook (scripts, CI, curl — never other websites) ----------
      if (p === '/notify' || p === '/health') {
        if (crossOrigin(req, allowedOrigins)) { sendJson(res, 403, { success: false, error: 'Cross-origin requests are not allowed' }); return; }
        if (p === '/health' && req.method === 'GET') { sendJson(res, 200, { status: 'ok', app: 'Cute Pet Companion' }); return; }
        if (p === '/notify' && req.method === 'POST') {
          if (!host.webhookEnabled()) { sendJson(res, 503, { success: false, error: 'Webhook is disconnected in Control Center' }); return; }
          const secret = host.getWebhookSecret();
          if (secret && !safeEqual(req.headers['x-pet-secret'], secret)) { sendJson(res, 401, { success: false, error: 'Invalid X-Pet-Secret' }); return; }
          const payload = await readJson(req);
          const r = host.ingest(payload, 'webhook');
          sendJson(res, 200, { success: true, accepted: r.accepted, reason: r.reason, suppressed: !!r.suppressed, notificationId: r.item.id, emotion: r.item.emotion, matchedBy: r.item.matchedBy });
          return;
        }
        sendJson(res, 405, { success: false, error: 'Method not allowed' });
        return;
      }

      // ---------- Control Center UI ----------
      if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
        const ticket = url.searchParams.get('launch');
        if (ticket) {
          const exp = tickets.get(ticket);
          tickets.delete(ticket);
          if (exp && exp >= Date.now()) {
            // The browser keeps the #section across this redirect.
            res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Set-Cookie': `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Strict; Path=/` });
            res.end();
            return;
          }
        }
        if (!safeEqual(readCookie(req, SESSION_COOKIE), sessionId)) {
          res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' });
          res.end('<!doctype html><meta charset="utf-8"><title>Cute Pet Companion</title><p style="font:15px system-ui;margin:3em">🐾 Hãy mở Control Center từ menu của Cute Pet Companion (icon dấu chân trên thanh menu / khay hệ thống).<br><small>Open the Control Center from the Cute Pet Companion tray menu.</small></p>');
          return;
        }
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
          sseClients.add(res);
          sseWrite(res, `event: hello\ndata: {}\n\n`);
          const ping = setInterval(() => sseWrite(res, ': ping\n\n'), 25000);
          const done = () => { clearInterval(ping); sseClients.delete(res); };
          req.on('close', done);
          res.on('close', done);
          res.on('error', done);
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
        if (p === '/api/contacts/seen' && host.contactDirectory) {
          if (req.method === 'GET') { sendJson(res, 200, host.contactDirectory.list()); return; }
          if (req.method === 'DELETE') { host.contactDirectory.clear(); sendJson(res, 200, host.contactDirectory.list()); return; }
        }
        if (p === '/api/contacts/apps' && host.messagingApps && req.method === 'GET') { sendJson(res, 200, { apps: await host.messagingApps.detect({ refresh: url.searchParams.get('refresh') === '1' }) }); return; }
        if (p.startsWith('/api/contacts/sources') && host.chatSources && req.method === 'GET') {
          if (p === '/api/contacts/sources') { sendJson(res, 200, { sources: host.chatSources.list() }); return; }
          const m = p.match(/^\/api\/contacts\/sources\/([a-z]+)\/(chats|members)$/);
          if (m && m[2] === 'chats') { sendJson(res, 200, await host.chatSources.chats(m[1], { refresh: url.searchParams.get('refresh') === '1' })); return; }
          if (m && m[2] === 'members') { sendJson(res, 200, await host.chatSources.members(m[1], String(url.searchParams.get('chat') || '').slice(0, 200))); return; }
        }
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

        const pm = p.match(/^\/api\/pets\/([a-z0-9_]{1,40})\/model$/);
        // Only the app's own characters may get a model (no arbitrary folders under userData).
        if (pm && !(host.isKnownPet && host.isKnownPet(pm[1]))) { sendJson(res, 404, { error: 'Unknown pet' }); return; }
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
      const raw = Number.isInteger(err && err.status) ? err.status : Number.isInteger(err && err.code) ? err.code : 500;
      const code = raw >= 400 && raw <= 599 ? raw : 500;
      if (res.headersSent) { res.destroy(); return; }
      sendJson(res, code, { success: false, error: String((err && err.message) || 'Internal error') }, code === 413 ? { Connection: 'close' } : {});
    }
  });
  server.launchUrl = launchUrl;

  // Try each candidate; only "can't bind here" errors move on to the next one.
  const tried = []; // [{ port, code }] — the candidates that could not be bound, in order
  // (One 'listening' handler for all attempts: a listen() callback of a failed attempt would stay
  // registered and fire again on the attempt that succeeds.)
  return new Promise((resolve, reject) => {
    let i = 0;
    const onError = (err) => {
      tried.push({ port: candidates[i], code: err.code });
      if ((err.code === 'EACCES' || err.code === 'EADDRINUSE') && i + 1 < candidates.length) { i += 1; server.listen(candidates[i], '127.0.0.1'); return; }
      server.removeListener('error', onError);
      server.removeListener('listening', onListening);
      err.tried = tried;
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      usePort(server.address().port);
      server.port = port;
      server.tried = tried;
      console.log(`[Server] Listening on http://127.0.0.1:${port}${tried.length ? ` (unavailable: ${tried.map(t => `${t.port} ${t.code}`).join(', ')})` : ''}`);
      resolve(server);
    };
    server.on('error', onError);
    server.once('listening', onListening);
    server.listen(candidates[0], '127.0.0.1');
  });
}

module.exports = { startNotificationServer };
