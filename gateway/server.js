#!/usr/bin/env node
/**
 * Cute Pet Companion — Public Integration Gateway (Blueprint V3.2 §6.4, Guide §B8–B10)
 * ==================================================================================
 * Runs on a server you control, behind HTTPS (Cloud Run / Fly.io / Render / a VPS + Caddy,
 * or `cloudflared tunnel` for development). The desktop app NEVER exposes 127.0.0.1:3721;
 * instead it opens an authenticated outbound SSE stream to this gateway.
 *
 *   Composio / Slack / any HMAC webhook ──► POST /webhooks/*  (verify signature, replay window,
 *                                              idempotency) ──► durable JSONL queue
 *   Desktop ◄── GET /events (Bearer DESKTOP_TOKEN, SSE, Last-Event-ID resume) ◄── queue
 *
 * Zero dependencies (Node ≥ 18). Secrets come from environment variables only:
 *   DESKTOP_TOKEN            (required) bearer token the desktop app uses for /events
 *   COMPOSIO_WEBHOOK_SECRET  Composio project webhook secret  → enables /webhooks/composio
 *   SLACK_SIGNING_SECRET     Slack app signing secret          → enables /webhooks/slack
 *   GENERIC_WEBHOOK_SECRET   shared HMAC secret                 → enables /webhooks/generic
 *   PORT (8787) · HOST (0.0.0.0) · DATA_DIR (./data) · TOLERANCE_SEC (300) · RETENTION (5000)
 *   COMPOSIO_REALTIME_PREFIXES (SLACK_,NOTION_,OUTLOOK_) · COMPOSIO_POLLING_PREFIXES (GMAIL_,GOOGLECALENDAR_)
 *
 * Payload contents are never logged — only event IDs and outcomes.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const posInt = (v, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : d; };
const nonNegNum = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);

function createGateway(options = {}) {
  const cfg = {
    desktopToken: options.desktopToken ?? env('DESKTOP_TOKEN'),
    composioSecret: options.composioSecret ?? env('COMPOSIO_WEBHOOK_SECRET'),
    slackSecret: options.slackSecret ?? env('SLACK_SIGNING_SECRET'),
    genericSecret: options.genericSecret ?? env('GENERIC_WEBHOOK_SECRET'),
    dataDir: options.dataDir ?? env('DATA_DIR', path.join(__dirname, 'data')),
    // Bad values (NaN, ≤ 0) fall back to the defaults instead of breaking compaction / verification.
    toleranceSec: nonNegNum(options.toleranceSec ?? env('TOLERANCE_SEC', 300), 300),
    retention: posInt(options.retention ?? env('RETENTION', 5000), 5000),
    realtimePrefixes: (options.realtimePrefixes ?? env('COMPOSIO_REALTIME_PREFIXES', 'SLACK_,NOTION_,OUTLOOK_')).split(',').filter(Boolean),
    pollingPrefixes: (options.pollingPrefixes ?? env('COMPOSIO_POLLING_PREFIXES', 'GMAIL_,GOOGLECALENDAR_')).split(',').filter(Boolean),
    now: options.now || (() => Date.now()),
    log: options.log || ((...a) => console.log('[gateway]', ...a))
  };
  if (!cfg.desktopToken || cfg.desktopToken.length < 24) throw new Error('DESKTOP_TOKEN (≥ 24 chars) is required');

  /* ------------------------------------------------------------ durable queue */
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  const logFile = path.join(cfg.dataDir, 'events.jsonl');
  const deadFile = path.join(cfg.dataDir, 'dead-letter.jsonl');
  let events = [];          // [{seq, idem, receivedAt, event}]
  // Idempotency keys seen recently (insertion-ordered, bounded): covers provider retries for far
  // longer than the event log keeps events, without growing forever.
  const idemKeys = new Set();
  const idemLimit = Math.max(cfg.retention * 4, 20000);
  const rememberIdem = (k) => {
    idemKeys.delete(k);
    idemKeys.add(k);
    while (idemKeys.size > idemLimit) idemKeys.delete(idemKeys.values().next().value);
  };
  let seq = 0;
  if (fs.existsSync(logFile)) {
    for (const line of fs.readFileSync(logFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (!isObj(e) || !Number.isFinite(e.seq)) continue;
        events.push(e); rememberIdem(e.idem); seq = Math.max(seq, e.seq);
      } catch { /* skip torn line */ }
    }
  }
  const subscribers = new Set();

  function compact() {
    if (events.length <= cfg.retention) return;
    events = events.slice(-cfg.retention);
    const tmp = logFile + '.tmp';
    fs.writeFileSync(tmp, events.map(e => JSON.stringify(e)).join('\n') + '\n', { mode: 0o600 });
    fs.renameSync(tmp, logFile);
  }

  /** Append durably, THEN acknowledge the provider (guide B3 step 6). */
  function enqueue(idem, event) {
    if (idemKeys.has(idem)) return { duplicate: true };
    const rec = { seq: ++seq, idem, receivedAt: cfg.now(), event };
    fs.appendFileSync(logFile, JSON.stringify(rec) + '\n', { mode: 0o600 });
    rememberIdem(idem);
    events.push(rec);
    compact();
    for (const res of subscribers) writeSse(res, rec);
    return { duplicate: false, seq: rec.seq };
  }

  function deadLetter(source, idem, reason) {
    fs.appendFileSync(deadFile, JSON.stringify({ at: cfg.now(), source, idem, reason }) + '\n', { mode: 0o600 });
  }

  function sseWrite(res, chunk) {
    if (res.writableEnded || res.destroyed) { subscribers.delete(res); return; }
    try { res.write(chunk); } catch { subscribers.delete(res); }
  }

  function writeSse(res, rec) {
    sseWrite(res, `id: ${rec.seq}\nevent: notification\ndata: ${JSON.stringify(rec.event)}\n\n`);
  }

  /* ------------------------------------------------------------ signatures */
  const safeEq = (a, b) => {
    const A = Buffer.from(String(a || '')), B = Buffer.from(String(b || ''));
    return A.length === B.length && crypto.timingSafeEqual(A, B);
  };

  function withinTolerance(tsSec) {
    const t = Number(tsSec);
    if (!Number.isFinite(t)) return false;
    return cfg.toleranceSec <= 0 || Math.abs(cfg.now() / 1000 - t) <= cfg.toleranceSec;
  }

  /** Composio: HMAC-SHA256(secret, `${webhook-id}.${webhook-timestamp}.${rawBody}`) base64, header "v1,<sig>" (may hold several, space-separated). */
  function verifyComposio(headers, raw) {
    const id = headers['webhook-id'], ts = headers['webhook-timestamp'], sig = headers['webhook-signature'];
    if (!id || !ts || !sig) return { ok: false, reason: 'missing_headers' };
    if (!withinTolerance(ts)) return { ok: false, reason: 'timestamp_out_of_tolerance' };
    const expected = crypto.createHmac('sha256', cfg.composioSecret).update(`${id}.${ts}.${raw}`).digest('base64');
    const candidates = String(sig).split(' ').map(s => (s.includes(',') ? s.split(',')[1] : s));
    return candidates.some(c => safeEq(c, expected)) ? { ok: true, id } : { ok: false, reason: 'bad_signature' };
  }

  /** Slack: v0=HMAC-SHA256(secret, `v0:${ts}:${rawBody}`) hex. */
  function verifySlack(headers, raw) {
    const ts = headers['x-slack-request-timestamp'], sig = headers['x-slack-signature'];
    if (!ts || !sig) return { ok: false, reason: 'missing_headers' };
    if (!withinTolerance(ts)) return { ok: false, reason: 'timestamp_out_of_tolerance' };
    const expected = 'v0=' + crypto.createHmac('sha256', cfg.slackSecret).update(`v0:${ts}:${raw}`).digest('hex');
    return safeEq(sig, expected) ? { ok: true } : { ok: false, reason: 'bad_signature' };
  }

  /** Generic: X-Signature: sha256=HMAC(secret, `${X-Timestamp}.${rawBody}`) hex. */
  function verifyGeneric(headers, raw) {
    const ts = headers['x-timestamp'], sig = headers['x-signature'];
    if (!ts || !sig) return { ok: false, reason: 'missing_headers' };
    if (!withinTolerance(ts)) return { ok: false, reason: 'timestamp_out_of_tolerance' };
    const expected = 'sha256=' + crypto.createHmac('sha256', cfg.genericSecret).update(`${ts}.${raw}`).digest('hex');
    return safeEq(sig, expected) ? { ok: true } : { ok: false, reason: 'bad_signature' };
  }

  /* ------------------------------------------------------------ normalizers */
  const pick = (obj, keys) => { for (const k of keys) { const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), obj); if (v !== undefined && v !== null && v !== '') return v; } return undefined; };
  const trim = (v, n) => (v === undefined || v === null ? undefined : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
  const humanize = (slug) => String(slug || 'event').toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

  function composioDelivery(slug) {
    if (cfg.pollingPrefixes.some(p => slug.startsWith(p))) return 'near_realtime_poll';
    if (cfg.realtimePrefixes.some(p => slug.startsWith(p))) return 'realtime_push';
    return 'near_realtime_poll'; // conservative: unverified triggers are never labelled realtime
  }

  function normalizeComposio(p, webhookId) {
    // V3: {id,type,metadata:{trigger_slug,connected_account_id,...},data,timestamp}
    // V2: {type:"slack_receive_message", data:{...,trigger_slug?}} · V1: {trigger_name, connection_id, payload}
    const meta = p.metadata || {};
    const data = p.data || p.payload || {};
    const slug = String(meta.trigger_slug || data.trigger_slug || p.trigger_name || p.type || 'COMPOSIO_EVENT').toUpperCase();
    if (/^COMPOSIO\.(CONNECTED_ACCOUNT|CONNECTION)/.test(String(p.type || '').toUpperCase())) return null; // project events, not notifications
    const app = slug.split('_')[0].toLowerCase().replace('googlecalendar', 'calendar');
    const title = trim(pick(data, ['subject', 'title', 'name', 'summary', 'message.subject', 'event.summary']), 140)
      || `${humanize(slug)}`;
    const sender = trim(pick(data, ['sender', 'from', 'user_name', 'author', 'user', 'event.user', 'message.from']), 80);
    const body = trim(pick(data, ['text', 'message_text', 'snippet', 'preview', 'body_preview', 'message', 'description', 'commit_message', 'event.text']), 300);
    const created = pick(data, ['ts', 'created_at', 'timestamp', 'messageTimestamp', 'event.ts']);
    let sourceCreatedAt;
    if (created !== undefined) sourceCreatedAt = /^\d+(\.\d+)?$/.test(String(created)) ? Math.round(Number(created) * (Number(created) < 1e12 ? 1000 : 1)) : Date.parse(created);
    return {
      provider: 'composio',
      sourceApplication: app,
      connectedAccountId: meta.connected_account_id || p.connection_id || undefined,
      sourceEventId: String(p.id || webhookId),
      title: sender && !title.includes(sender) ? `${sender}: ${title}`.slice(0, 140) : title,
      bodyPreview: typeof body === 'string' && body !== title ? body : undefined,
      sourceUrl: trim(pick(data, ['url', 'html_url', 'permalink', 'link', 'web_link']), 2000),
      category: app === 'gmail' || app === 'outlook' ? 'mail' : app === 'slack' ? 'chat' : undefined,
      deliveryMode: composioDelivery(slug),
      sourceCreatedAt: Number.isFinite(sourceCreatedAt) ? sourceCreatedAt : undefined,
      providerReceivedAt: p.timestamp ? Date.parse(p.timestamp) || undefined : undefined,
      gatewayReceivedAt: cfg.now(),
      metadata: { triggerSlug: slug, triggerId: meta.trigger_id }
    };
  }

  function normalizeSlack(body) {
    const ev = body.event || {};
    if (ev.bot_id || ev.subtype) return null;
    if (!['message', 'app_mention'].includes(ev.type)) return null;
    const isDm = ev.channel_type === 'im';
    return {
      provider: 'slack',
      sourceApplication: 'slack',
      connectedAccountId: body.team_id,
      sourceEventId: `${ev.channel}:${ev.ts}`,
      title: isDm ? '💬 Tin nhắn riêng trên Slack' : (ev.type === 'app_mention' ? '📣 Bạn được nhắc đến trên Slack' : '💬 Tin nhắn Slack mới'),
      bodyPreview: trim(String(ev.text || '').replace(/<@[A-Z0-9]+>/g, '@user'), 300),
      sourceUrl: ev.channel ? `https://slack.com/app_redirect?channel=${encodeURIComponent(ev.channel)}` : undefined,
      priority: isDm || ev.type === 'app_mention' ? 'important' : 'normal',
      category: 'chat',
      deliveryMode: 'realtime_push',
      sourceCreatedAt: ev.ts ? Math.round(Number(ev.ts) * 1000) : undefined,
      providerReceivedAt: body.event_time ? body.event_time * 1000 : undefined,
      gatewayReceivedAt: cfg.now()
    };
  }

  function normalizeGeneric(p) {
    return {
      provider: 'generic',
      sourceApplication: trim(p.sourceApplication || p.app, 40) || 'webhook',
      sourceEventId: trim(p.sourceEventId || p.id, 200),
      title: trim(p.title, 140) || 'Thông báo mới',
      bodyPreview: trim(p.bodyPreview || p.message, 300),
      sourceUrl: trim(p.sourceUrl || p.url, 2000),
      priority: trim(p.priority, 20),
      category: trim(p.category, 40),
      deliveryMode: 'realtime_push',
      sourceCreatedAt: p.sourceCreatedAt,
      gatewayReceivedAt: cfg.now()
    };
  }

  /* ------------------------------------------------------------ http */
  /** Over the limit: stop reading and fail with 413 — the reply still goes out ("Connection: close"). */
  const readRaw = (req, limit = 1024 * 1024) => new Promise((resolve, reject) => {
    const tooLarge = () => Object.assign(new Error('too large'), { code: 413 });
    if (Number(req.headers['content-length']) > limit) { req.pause(); reject(tooLarge()); return; }
    const chunks = []; let size = 0;
    const onData = (c) => {
      size += c.length;
      if (size > limit) { req.removeListener('data', onData); req.pause(); reject(tooLarge()); } else chunks.push(c);
    };
    req.on('data', onData);
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
  const json = (res, code, obj, headers = {}) => {
    if (res.headersSent || res.destroyed) { if (!res.writableEnded) res.destroy(); return; }
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(obj));
  };
  const parseObject = (raw) => { try { const v = JSON.parse(raw); return isObj(v) ? v : null; } catch { return null; } };

  const server = http.createServer(async (req, res) => {
    try {
      let url;
      try { url = new URL(req.url, 'http://gateway'); } catch { json(res, 400, { error: 'bad request' }); return; }
      if (req.method === 'GET' && url.pathname === '/health') {
        json(res, 200, { ok: true, lastSeq: seq, stored: events.length, subscribers: subscribers.size, providers: { composio: !!cfg.composioSecret, slack: !!cfg.slackSecret, generic: !!cfg.genericSecret } });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/events') {
        const auth = String(req.headers.authorization || '');
        if (!safeEq(auth, `Bearer ${cfg.desktopToken}`)) { json(res, 401, { error: 'unauthorized' }); return; }
        // Garbage / negative resume points replay from the start of what is retained (never "nothing").
        const rawLast = Number(req.headers['last-event-id'] || url.searchParams.get('since') || 0);
        const last = Number.isFinite(rawLast) && rawLast > 0 ? rawLast : 0;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        subscribers.add(res);
        sseWrite(res, `event: hello\ndata: ${JSON.stringify({ lastSeq: seq })}\n\n`);
        // Replay anything the desktop missed while offline/hidden (reconnect & resume).
        for (const rec of events) if (rec.seq > last) writeSse(res, rec);
        const hb = setInterval(() => sseWrite(res, ': hb\n\n'), 20000);
        const done = () => { clearInterval(hb); subscribers.delete(res); };
        req.on('close', done);
        res.on('close', done);
        res.on('error', done);
        return;
      }

      if (req.method === 'POST' && url.pathname.startsWith('/webhooks/')) {
        const raw = await readRaw(req);
        const kind = url.pathname.slice('/webhooks/'.length);

        if (kind === 'composio') {
          if (!cfg.composioSecret) { json(res, 404, { error: 'composio disabled' }); return; }
          const v = verifyComposio(req.headers, raw);
          if (!v.ok) { cfg.log(`composio rejected: ${v.reason}`); json(res, 401, { error: v.reason }); return; }
          const body = parseObject(raw);
          if (!body) { deadLetter('composio', v.id, 'invalid_json'); json(res, 200, { ok: true, deadLetter: true }); return; }
          const event = normalizeComposio(body, v.id);
          if (!event) { json(res, 200, { ok: true, ignored: true }); return; }
          const r = enqueue(`composio:${v.id}`, event);
          cfg.log(`composio ${v.id} → ${r.duplicate ? 'duplicate' : 'seq ' + r.seq}`);
          json(res, 200, { ok: true, duplicate: r.duplicate, seq: r.seq });
          return;
        }

        if (kind === 'slack') {
          if (!cfg.slackSecret) { json(res, 404, { error: 'slack disabled' }); return; }
          const v = verifySlack(req.headers, raw);
          if (!v.ok) { cfg.log(`slack rejected: ${v.reason}`); json(res, 401, { error: v.reason }); return; }
          const body = parseObject(raw);
          if (!body) { deadLetter('slack', null, 'invalid_json'); json(res, 400, { error: 'invalid json' }); return; }
          if (body.type === 'url_verification') { json(res, 200, { challenge: body.challenge }); return; }
          if (body.type !== 'event_callback') { json(res, 200, { ok: true, ignored: true }); return; }
          const event = normalizeSlack(body);
          if (!event) { json(res, 200, { ok: true, ignored: true }); return; }
          const r = enqueue(`slack:${body.event_id || event.sourceEventId}`, event);
          json(res, 200, { ok: true, duplicate: r.duplicate, seq: r.seq });
          return;
        }

        if (kind === 'generic') {
          if (!cfg.genericSecret) { json(res, 404, { error: 'generic disabled' }); return; }
          const v = verifyGeneric(req.headers, raw);
          if (!v.ok) { json(res, 401, { error: v.reason }); return; }
          const body = parseObject(raw);
          if (!body) { json(res, 400, { error: 'invalid json' }); return; }
          const event = normalizeGeneric(body);
          const idem = req.headers['x-event-id'] || event.sourceEventId || crypto.createHash('sha256').update(raw).digest('hex');
          const r = enqueue(`generic:${idem}`, event);
          json(res, 200, { ok: true, duplicate: r.duplicate, seq: r.seq });
          return;
        }
      }
      json(res, 404, { error: 'not found' });
    } catch (err) {
      const big = err && err.code === 413;
      if (!big) cfg.log(`internal error: ${err && err.message}`);
      json(res, big ? 413 : 500, { error: big ? 'payload too large' : 'internal error' }, big ? { Connection: 'close' } : {});
    }
  });

  return {
    server,
    listen: (port = Number(env('PORT', 8787)), host = env('HOST', '0.0.0.0')) => new Promise(r => server.listen(port, host, () => r(server.address().port))),
    close: () => { for (const s of subscribers) s.end(); server.closeAllConnections && server.closeAllConnections(); return new Promise(r => server.close(r)); },
    stats: () => ({ seq, stored: events.length, subscribers: subscribers.size })
  };
}

module.exports = { createGateway };

if (require.main === module) {
  const gw = createGateway();
  gw.listen().then(port => console.log(`[gateway] listening on :${port} — put HTTPS in front of it (never expose the desktop's 127.0.0.1:3721)`));
}
