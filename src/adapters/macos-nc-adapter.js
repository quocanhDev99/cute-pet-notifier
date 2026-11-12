/**
 * macOS Notification Center adapter — lets the pet REPLACE the default macOS banners.
 *
 * Dual-layer architecture:
 * 1. ⚡ Instant layer — native/macos/nc-bridge.swift (Accessibility API, needs the Accessibility permission):
 *    sees each AXNotificationCenterBanner the moment Notification Center shows it, reads
 *    title/subtitle/body by AXIdentifier, hides the native banner (moves its window off-screen,
 *    falling back to the banner's "Close" action) and can later "press" it so the source app
 *    opens the exact conversation — for every app, not only those with deep links.
 * 2. 🗄️ Database layer (fallback, ~5 s later): read-only Notification Center DB; also used to
 *    enrich instant events with deep links. Fingerprints (title + body) prevent duplicates.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn, execFile, execFileSync } = require('child_process');
const { ApplicationAdapter, STATUS } = require('./base-adapter');
const { parseBplist, APPLE_EPOCH_MS } = require('./bplist');
const { deepLinkFor } = require('./nc-deeplink');
const { NcPrefs } = require('./ncprefs');

const SQLITE = '/usr/bin/sqlite3';
const OWN_BUNDLES = ['com.github.electron', 'com.cutepet.companion'];
const OWN_APP_NAMES = ['cute pet companion', 'electron'];

const KNOWN_APPS = [
  [/slack/i, 'slack', 'Slack'], [/zalo/i, 'zalo', 'Zalo'], [/facebook\.(archon|messenger)|messenger/i, 'messenger', 'Messenger'],
  [/microsoft\.teams/i, 'teams', 'Teams'], [/microsoft\.outlook/i, 'outlook', 'Outlook'], [/telegram/i, 'telegram', 'Telegram'],
  [/discord/i, 'discord', 'Discord'], [/whatsapp/i, 'whatsapp', 'WhatsApp'], [/viber/i, 'viber', 'Viber'], [/line/i, 'line', 'LINE'],
  [/^com\.apple\.mail$/i, 'mail', 'Mail'], [/^com\.apple\.ical$/i, 'calendar', 'Lịch'], [/^com\.apple\.mobilesms$/i, 'messages', 'Tin nhắn'],
  [/^com\.apple\.reminders$/i, 'reminders', 'Lời nhắc'], [/^com\.apple\.facetime$/i, 'facetime', 'FaceTime'], [/zoom/i, 'zoom', 'Zoom'],
  [/notion/i, 'notion', 'Notion'], [/spotify/i, 'spotify', 'Spotify'], [/google\.chrome/i, 'chrome', 'Chrome'], [/safari/i, 'safari', 'Safari'],
  [/firefox/i, 'firefox', 'Firefox'], [/edgemac|microsoft\.edge/i, 'edge', 'Edge'], [/github/i, 'github', 'GitHub'], [/jira|atlassian/i, 'jira', 'Jira'],
  [/^com\.apple\./i, 'macos', null]
];

function dbCandidates() {
  const out = [];
  try {
    const dir = execFileSync('/usr/bin/getconf', ['DARWIN_USER_DIR'], { encoding: 'utf8' }).trim();
    if (dir) out.push(path.join(dir, 'com.apple.notificationcenter/db2/db'));
  } catch { /* not macOS */ }
  out.push(path.join(os.homedir(), 'Library/Group Containers/group.com.apple.usernoted/db2/db'));
  return out;
}

function sqlite(db, sql) {
  return new Promise((resolve, reject) => {
    execFile(SQLITE, ['-readonly', '-separator', '\t', `file:${db}?mode=ro`, sql], { maxBuffer: 8 * 1024 * 1024, timeout: 5000 }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; reject(err); return; }
      resolve(stdout);
    });
  });
}

/** Title + start of body only: the AX layer sees display names ("Microsoft Teams") while the DB
 *  sees bundle ids, so the app name must not be part of the duplicate key. */
function makeFingerprint(_appName, title, body) {
  const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return `${norm(title)}|${norm(body).slice(0, 60)}`;
}

/** Display-name → app key (AX layer gives the localized app name, not the bundle id). */
const NAME_APPS = [
  [/teams/i, 'teams'], [/zalo/i, 'zalo'], [/messenger/i, 'messenger'], [/slack/i, 'slack'], [/outlook/i, 'outlook'],
  [/telegram/i, 'telegram'], [/discord/i, 'discord'], [/whatsapp/i, 'whatsapp'], [/zoom/i, 'zoom'], [/notion/i, 'notion'],
  [/^mail$/i, 'mail'], [/^(calendar|lịch)$/i, 'calendar'], [/^(messages|tin nhắn)$/i, 'messages'], [/^(reminders|lời nhắc)$/i, 'reminders'],
  [/chrome/i, 'chrome'], [/safari/i, 'safari'], [/spotify/i, 'spotify'], [/facetime/i, 'facetime']
];

/** How long a shown notification suppresses an identical one (AX ↔ DB layers see it ~5 s apart).
 *  Afterwards the same text is a NEW message ("ok", "👍"…) and must be shown again. */
const FINGERPRINT_TTL_MS = 90 * 1000;
const MAX_TRACKED = 500;

/** Apple system apps by display name (AX layer: no bundle id). */
const APPLE_SYSTEM_NAMES = /^(software update|cập nhật phần mềm|screen time|thời gian sử dụng|app store|finder|system settings|cài đặt hệ thống|system preferences|time machine|notification center)$/i;

function setBounded(map, key, value, max = MAX_TRACKED) {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) map.delete(map.keys().next().value);
}

function bridgePath(ctx) {
  if (ctx.ncBridgePath) return fs.existsSync(ctx.ncBridgePath) ? ctx.ncBridgePath : null;
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'nc-bridge'),
    path.resolve(__dirname, '../../build/native/nc-bridge')
  ].filter(Boolean);
  return candidates.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}

class MacNotificationCenterAdapter extends ApplicationAdapter {
  constructor(ctx, platform = process.platform) {
    super(ctx, {
      id: 'macos_nc',
      name: 'macOS Notification Center (thay thế thông báo hệ thống)',
      icon: '🍎',
      description: 'Bắt thông báo của MỌI ứng dụng trên Mac (Zalo, Messenger, Mail, Slack, Lịch…) và để thú cưng mang tới thay cho banner mặc định.',
      help: 'Kết hợp chặn banner tức thì qua Accessibility API và đọc cơ sở dữ liệu Notification Center cục bộ. Khi cấp quyền Trợ năng (Accessibility), app sẽ tự động đóng banner gốc của macOS để không bao giờ bị hiện 2 lần.',
      deliveryMode: 'native_os',
      provider: 'macos',
      fields: [
        { key: 'suppressNativeBanner', label: '⚡ Tức thì: ẩn banner gốc ngay khi nó xuất hiện (cần quyền Trợ năng)', type: 'boolean' },
        { key: 'skipConnectedSlack', label: 'Bỏ qua Slack khi đã kết nối Slack trực tiếp (tránh trùng)', type: 'boolean' },
        { key: 'skipAppleSystem', label: 'Bỏ qua thông báo hệ thống của Apple (cập nhật, Screen Time…)', type: 'boolean' }
      ],
      actions: [
        { id: 'request-accessibility', label: '🔐 Cấp quyền Trợ năng (Accessibility)' },
        { id: 'replace-all', label: '🤫 Thay thế tất cả: tắt banner gốc của mọi app' },
        { id: 'restore-banners', label: '↺ Khôi phục banner gốc' },
        { id: 'open-notification-settings', label: '⚙️ Mở Cài đặt Thông báo của macOS' },
        { id: 'open-full-disk-access', label: '📁 Mở Cài đặt Full Disk Access (macOS 15+)' }
      ]
    });
    this.platform = platform;
    this.lastId = 0;
    this.watcher = null;
    this.poll = null;
    this.busy = false;
    this.pending = false;
    this.names = new Map();
    this.links = new Map(); // sourceEventId → deep link (in memory only)
    this.handledFingerprints = new Map(); // fingerprint → sourceEventId of the event already shown
    this.axLive = new Set();               // AX banner ids still alive (pressable)
    this.axMeta = new Map();               // sourceEventId → { appName, bundleId }
    this.pendingResults = new Map();
    this.ncprefs = new NcPrefs(ctx.dataDir);
    this.interceptorProc = null;
    this.rl = null;
    this.isTrusted = false;

    if (platform !== 'darwin') this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên macOS.');
  }

  async connect() {
    if (this.platform !== 'darwin') { this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên macOS.'); return false; }
    this.stoppedByUser = false;

    // 1. Start Instant Native Interceptor (if available)
    this.startNativeInterceptor();

    // 2. Start SQLite DB Watcher (fallback & background queue)
    let lastErr = null;
    for (const db of (this.ctx.ncDbPath ? [this.ctx.ncDbPath] : dbCandidates())) {
      if (!fs.existsSync(db)) {
        try { fs.accessSync(path.dirname(path.dirname(db))); } catch (e) { if (e.code === 'EPERM' || e.code === 'EACCES') lastErr = e; }
        continue;
      }
      try {
        const out = await sqlite(db, 'SELECT ifnull(max(rec_id),0) FROM record;');
        this.db = db;
        this.lastId = parseInt(out.trim(), 10) || 0; // only notifications from now on
        this.startWatching();
        
        this.setStatus(STATUS.CONNECTED, this.statusLine());
        return true;
      } catch (err) {
        lastErr = err;
      }
    }

    if (this.interceptorProc) {
      // Even if SQLite is blocked by Full Disk Access, instant interceptor is active!
      this.setStatus(STATUS.CONNECTED, this.statusLine());
      return true;
    }

    if (lastErr && /EPERM|EACCES|authorization|unable to open/i.test(`${lastErr.code} ${lastErr.stderr || lastErr.message}`)) {
      this.setStatus(STATUS.LIMITED, 'macOS chặn quyền đọc. Cấp "Full Disk Access" hoặc "Trợ năng (Accessibility)" cho Cute Pet Companion rồi kết nối lại.');
    } else {
      this.setStatus(STATUS.ERROR, `Không tìm thấy/không đọc được cơ sở dữ liệu thông báo${lastErr ? `: ${String(lastErr.stderr || lastErr.message).trim().slice(0, 120)}` : ''}`);
    }
    return false;
  }

  restartInterceptor() {
    const p = this.interceptorProc;
    if (!p || this.isTrusted || this.stoppedByUser) return;
    this.interceptorProc = null;
    this.axLive.clear();
    if (this.rl) { this.rl.close(); this.rl = null; }
    this.failPending('bridge-restarted');
    try { p.kill(); } catch { /* ignore */ }
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => { this.restartTimer = null; if (!this.stoppedByUser) this.startNativeInterceptor(); }, 300);
    if (this.restartTimer.unref) this.restartTimer.unref();
  }

  failPending(detail) {
    for (const list of this.pendingResults.values()) for (const r of list) r({ ok: false, detail });
    this.pendingResults.clear();
  }

  startNativeInterceptor() {
    if (this.interceptorProc) return;
    const bin = bridgePath(this.ctx);
    if (!bin) { this.ctx.log('[macos_nc] nc-bridge not found (run scripts/build-native.sh) — database layer only.'); return; }
    const args = this.config.suppressNativeBanner === false ? [] : ['--autohide'];
    try {
      const proc = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      this.interceptorProc = proc;
      if (this.rl) this.rl.close();
      this.rl = readline.createInterface({ input: proc.stdout });
      proc.on('error', (err) => this.ctx.log(`[macos_nc] nc-bridge error: ${err.message}`));
      proc.stdin.on('error', () => { /* helper gone: send() reports it */ });
      this.rl.on('line', (line) => {
        const t = line.trim();
        if (!t.startsWith('{')) return;
        try { this.handleInterceptorEvent(JSON.parse(t)); } catch { /* ignore */ }
      });
      proc.stderr.on('data', () => {}); // compiler/runtime noise only — never notification content
      proc.on('close', (code) => {
        if (this.interceptorProc === proc) { this.interceptorProc = null; this.axLive.clear(); this.failPending('bridge-exited'); }
        this.ctx.log(`[macos_nc] nc-bridge exited (${code})`);
      });
    } catch (err) {
      this.ctx.log(`[macos_nc] failed to start nc-bridge: ${err.message}`);
    }
  }

  send(cmd) {
    if (!this.interceptorProc) return Promise.resolve({ ok: false, detail: 'bridge-not-running' });
    return new Promise((resolve) => {
      // The helper answers by cmd+id: several identical commands in flight share one answer
      // (a second "close 42" must not orphan the first caller's promise).
      const key = `${cmd.cmd}:${cmd.id || ''}`;
      let done = false;
      const finish = (r) => { if (done) return; done = true; clearTimeout(timer); resolve(r); };
      const list = this.pendingResults.get(key) || [];
      list.push(finish);
      this.pendingResults.set(key, list);
      const drop = () => {
        const l = this.pendingResults.get(key);
        if (!l) return;
        const i = l.indexOf(finish);
        if (i >= 0) l.splice(i, 1);
        if (!l.length) this.pendingResults.delete(key);
      };
      const timer = setTimeout(() => { drop(); finish({ ok: false, detail: 'timeout' }); }, 1500);
      if (timer.unref) timer.unref();
      try { this.interceptorProc.stdin.write(JSON.stringify(cmd) + '\n'); } catch { drop(); finish({ ok: false, detail: 'write-failed' }); }
    });
  }

  /** Friendly flags for the simple (non-technical) Control Center UI. */
  describe() {
    const d = super.describe();
    let replaced = false;
    try { replaced = !!this.ncprefs.changes().active; } catch { /* ignore */ }
    d.extra = { trusted: !!this.isTrusted, replaced, helperPath: bridgePath(this.ctx) || '' };
    return d;
  }

  statusLine() {
    if (!this.interceptorProc) return `Đọc kho thông báo (trễ ~5 s) · #${this.lastId}`;
    if (!this.isTrusted) return 'Chưa có quyền Trợ năng → đang đọc kho thông báo (trễ ~5 s). Bấm "Cấp quyền Trợ năng" để thay thế tức thì.';
    return this.config.suppressNativeBanner === false ? '⚡ Bắt banner tức thì (banner gốc vẫn hiện)' : '⚡ Tức thì: bắt & ẩn banner gốc ngay khi xuất hiện';
  }

  handleInterceptorEvent(ev) {
    if (ev.type === 'ready' || ev.type === 'trust') {
      this.isTrusted = !!ev.trusted;
      if (this.status === STATUS.CONNECTED) this.setStatus(STATUS.CONNECTED, this.statusLine());
      // macOS only applies a newly granted Accessibility permission to processes started AFTER the
      // grant — a running helper keeps answering "not trusted". So while untrusted, relaunch the
      // helper every few seconds; it picks the permission up as soon as the user turns it on.
      clearTimeout(this.trustRetry);
      if (this.isTrusted) this.trustAttempts = 0;
      else if (this.interceptorProc) {
        this.trustAttempts = (this.trustAttempts || 0) + 1;
        const wait = this.trustAttempts <= 20 ? 6000 : 60000; // ~2 min fast, then once a minute
        this.trustRetry = setTimeout(() => this.restartInterceptor(), wait);
        if (this.trustRetry.unref) this.trustRetry.unref();
      }
      return;
    }
    if (ev.type === 'result') {
      const key = `${ev.cmd}:${ev.id || ''}`;
      const list = this.pendingResults.get(key);
      if (list) { this.pendingResults.delete(key); list.forEach(r => r(ev)); }
      return;
    }
    if (ev.type === 'gone') { this.axLive.delete(String(ev.id)); return; }
    if (ev.type !== 'banner') return;
    const id = String(ev.id);
    this.axLive.add(id);
    const appName = String(ev.app || '').trim() || 'Thông báo';
    if (OWN_APP_NAMES.includes(appName.toLowerCase())) return;
    const fp = makeFingerprint(appName, ev.title, ev.body);
    if (this.recentFingerprint(fp)) return;
    const sourceEventId = `ax:${id}`;
    this.rememberFingerprint(fp, sourceEventId);
    const key = (NAME_APPS.find(([re]) => re.test(appName)) || [])[1];
    if (this.shouldSkipApp({ appKey: key, appName })) return;
    setBounded(this.axMeta, sourceEventId, { appName });
    this.publish({ instant: true, appName, appKey: key, title: ev.title, subtitle: ev.subtitle, body: ev.body, deliveredMs: Number(ev.t) || Date.now(), sourceEventId });
  }

  rememberFingerprint(fp, sourceEventId) {
    setBounded(this.handledFingerprints, fp, { id: sourceEventId, at: Date.now() });
  }

  /** sourceEventId of the same notification shown within FINGERPRINT_TTL_MS, else null. */
  recentFingerprint(fp) {
    const hit = this.handledFingerprints.get(fp);
    if (!hit) return null;
    if (Date.now() - hit.at > FINGERPRINT_TTL_MS) { this.handledFingerprints.delete(fp); return null; }
    return hit.id;
  }

  startWatching() {
    this.stopWatching();
    this.watched = ['db-wal', 'db'].map(f => path.join(path.dirname(this.db), f)).filter(f => fs.existsSync(f));
    this.onStat = (cur, prev) => { if (cur.mtimeMs !== prev.mtimeMs || cur.size !== prev.size) this.schedule(); };
    for (const f of this.watched) fs.watchFile(f, { interval: 400, persistent: false }, this.onStat);
    this.poll = setInterval(() => this.schedule(), 30000);
    if (this.poll.unref) this.poll.unref();
  }

  stopWatching() {
    for (const f of this.watched || []) fs.unwatchFile(f, this.onStat);
    this.watched = [];
    clearInterval(this.poll); this.poll = null;
    clearTimeout(this.debounce);
  }

  intervalSeconds() { return null; }

  schedule() {
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.readNew(), 120);
  }

  async readNew() {
    if (this.status !== STATUS.CONNECTED) return;
    if (this.busy) { this.pending = true; return; }
    this.busy = true;
    try {
      const since = Math.max(0, Math.floor(Number(this.lastId) || 0)); // not `| 0`: rec_id may exceed 2^31
      const sql = `SELECT r.rec_id, a.identifier, r.delivered_date, hex(r.data) FROM record r JOIN app a ON a.app_id = r.app_id WHERE r.rec_id > ${since} ORDER BY r.rec_id LIMIT 50;`;
      const out = await sqlite(this.db, sql);
      for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        const [idStr, bundle, delivered, hex] = line.split('\t');
        const recId = parseInt(idStr, 10);
        if (!Number.isFinite(recId)) continue;
        this.lastId = Math.max(this.lastId, recId);
        let rec;
        try { rec = parseBplist(Buffer.from(hex || '', 'hex')); } catch { continue; }
        const req = (rec && rec.req) || {};
        const bundleId = String(bundle || rec.app || '').toLowerCase();
        if (this.shouldSkip(bundleId)) continue;
        if (!req.titl && !req.body) continue;

        await this.resolveName(bundleId); // async Spotlight lookup, cached (never blocks the main loop)
        const app = this.appInfo(bundleId);
        const fp = makeFingerprint(app.label, req.titl, req.body);
        let link = null;
        try { link = deepLinkFor(bundleId, req); } catch { link = null; }
        const shownAs = this.recentFingerprint(fp);
        if (shownAs) {
          // Already shown instantly by the AX layer → only enrich it (bundle id + deep link for later clicks).
          const meta = this.axMeta.get(shownAs);
          if (meta) meta.bundleId = bundleId;
          if (link && link.url) setBounded(this.links, shownAs, link.url);
          continue;
        }
        this.rememberFingerprint(fp, `nc:${recId}:${bundleId}`);

        const deliveredMs = Number(delivered) ? APPLE_EPOCH_MS + Number(delivered) * 1000 : (typeof rec.date === 'number' ? APPLE_EPOCH_MS + rec.date * 1000 : Date.now());
        this.publish({ recId, bundleId, title: req.titl, subtitle: req.subt, body: req.body, deliveredMs, link: link && link.url, linkKind: link && link.kind });
      }
      this.detail = this.statusLine();
    } catch (err) {
      this.detail = `Lỗi đọc: ${String(err.stderr || err.message).trim().slice(0, 100)}`;
    } finally {
      this.busy = false;
      if (this.pending) { this.pending = false; this.schedule(); }
    }
  }

  /** AX layer: only the display name (and our short key) are known, not the bundle id. */
  shouldSkipApp({ appKey, appName }) {
    const cfg = this.config;
    const s = this.ctx.settings.get();
    if (cfg.skipConnectedSlack !== false && appKey === 'slack' && s.adapters.slack && s.adapters.slack.enabled) return true;
    if (cfg.skipAppleSystem !== false && APPLE_SYSTEM_NAMES.test(String(appName || '').trim())) return true;
    return false;
  }

  shouldSkip(bundleId) {
    const cfg = this.config;
    if (OWN_BUNDLES.some(b => bundleId.startsWith(b))) return true;
    const s = this.ctx.settings.get();
    if (cfg.skipConnectedSlack !== false && /slack/.test(bundleId) && s.adapters.slack && s.adapters.slack.enabled) return true;
    if (cfg.skipAppleSystem !== false && /^com\.apple\.(softwareupdate|screentime|usernotificationcenter|controlcenter|systempreferences|appstore|backup|notificationcenter|finder|ScreenTimeAgent|AMPDevicesAgent)/i.test(bundleId)) return true;
    return false;
  }

  appInfo(bundleId) {
    for (const [re, key, label] of KNOWN_APPS) if (re.test(bundleId)) return { key, label: label || this.lookupName(bundleId) };
    const last = bundleId.split('.').pop() || 'app';
    return { key: last.replace(/[^a-z0-9_.-]/g, '').slice(0, 40) || 'app', label: this.lookupName(bundleId) };
  }

  /** Cached display name; falls back to the bundle id's last part until resolveName() ran. */
  lookupName(bundleId) {
    return this.names.get(bundleId) || bundleId.split('.').pop();
  }

  /** App display name from Spotlight, asynchronously (execFileSync used to stall the main process). */
  resolveName(bundleId) {
    if (!bundleId || this.names.has(bundleId) || KNOWN_APPS.some(([re, , label]) => label && re.test(bundleId))) return Promise.resolve();
    return new Promise((resolve) => {
      execFile('/usr/bin/mdfind', [`kMDItemCFBundleIdentifier == '${bundleId.replace(/'/g, '')}'c`], { encoding: 'utf8', timeout: 800 }, (err, out) => {
        const first = !err && String(out || '').split('\n').find(Boolean);
        setBounded(this.names, bundleId, first ? path.basename(first).replace(/\.app$/, '') : bundleId.split('.').pop(), 300);
        resolve();
      });
    });
  }

  normalizeNotification(n) {
    const app = n.instant
      ? { key: n.appKey || String(n.appName || 'app').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40) || 'app', label: n.appName }
      : this.appInfo(n.bundleId || n.appName);
    const title = n.subtitle ? `${n.title || app.label} — ${n.subtitle}` : (n.title || app.label);
    const sourceEventId = n.sourceEventId || `nc:${n.recId}:${n.bundleId}`;
    if (n.link) setBounded(this.links, sourceEventId, n.link);
    return {
      app: app.key,
      appName: app.label || n.appName,
      title,
      message: n.body || '',
      category: app.key === 'macos' ? 'system' : undefined,
      deliveryMode: 'native_os',
      provider: 'macos',
      sourceEventId,
      openLabel: n.instant ? 'chat' : n.link ? (n.linkKind === 'message' ? 'chat' : 'link') : 'app',
      sourceCreatedAt: n.deliveredMs
    };
  }

  async handleNotificationAction(action, externalId) {
    if (!externalId) return;
    const ext = String(externalId);
    if (ext.startsWith('ax:')) {
      const id = ext.slice(3);
      if (action === 'dismiss') { if (this.axLive.has(id)) this.send({ cmd: 'close', id }); return; }
      if (action !== 'open') return;
      // Best: press the real (hidden) banner → the source app opens the exact conversation.
      if (this.axLive.has(id)) { const r = await this.send({ cmd: 'press', id }); if (r.ok) return; }
      const meta = this.axMeta.get(ext) || {};
      const link = this.links.get(ext);
      if (meta.bundleId && /^[a-z0-9._-]+$/i.test(meta.bundleId)) {
        execFile('/usr/bin/open', link ? ['-b', meta.bundleId, link] : ['-b', meta.bundleId], () => {});
      } else if (meta.appName) {
        execFile('/usr/bin/open', ['-a', meta.appName], () => {});
      }
      return;
    }
    if (action !== 'open') return;
    const parts = ext.split(':');
    const bundleId = parts.length > 2 ? parts.slice(2).join(':') : parts[0];
    if (!/^[a-z0-9._-]+$/i.test(bundleId)) return;
    const link = this.links.get(ext);
    if (link) execFile('/usr/bin/open', ['-b', bundleId, link], (err) => { if (err) execFile('/usr/bin/open', ['-b', bundleId], () => {}); });
    else execFile('/usr/bin/open', ['-b', bundleId], () => {});
  }

  async runAction(id) {
    if (id === 'reveal-helper') {
      this.trustAttempts = 0; // the user is granting it right now → check quickly again
      // macOS evaluates the helper's Accessibility permission on its own when the app launches it,
      // so it must be in the list too: show it in Finder (drag it into the list) + open the pane.
      const bin = bridgePath(this.ctx);
      if (!bin) return { ok: false, error: 'Không tìm thấy nc-bridge' };
      execFile('/usr/bin/open', ['-R', bin], () => {});
      execFile('/usr/bin/open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'], () => {});
      if (this.interceptorProc) this.send({ cmd: 'prompt' }).catch(() => {});
      return { ok: true, path: bin };
    }
    if (id === 'reset-accessibility') {
      // Old entries in the list belong to an older signature of the app; switching them on does
      // nothing for the current build. Remove ours, then register the current identity again.
      await new Promise((resolve) => execFile('/usr/bin/tccutil', ['reset', 'Accessibility', 'com.cutepet.companion'], () => resolve()));
      this.trustAttempts = 0;
      if (this.ctx.promptAccessibility) this.ctx.promptAccessibility();
      execFile('/usr/bin/open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'], () => {});
      return { ok: true };
    }
    if (id === 'request-accessibility') {
      if (!this.interceptorProc) this.startNativeInterceptor();
      this.trustAttempts = 0;
      if (this.ctx.promptAccessibility) this.ctx.promptAccessibility();
      const r = await this.send({ cmd: 'prompt' });
      execFile('/usr/bin/open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'], () => {});
      return { ok: true, trusted: !!r.ok };
    }
    if (id === 'replace-all') {
      const r = await this.ncprefs.replaceAll();
      this.setStatus(this.status, `${this.statusLine()} · 🤫 Đã tắt banner gốc của ${r.changed} app`);
      return { ok: true, ...r };
    }
    if (id === 'restore-banners') {
      const r = await this.ncprefs.restore();
      this.setStatus(this.status, `${this.statusLine()} · ↺ Đã khôi phục banner gốc cho ${r.restored} app`);
      return { ok: true, ...r };
    }
    const urls = {
      'open-accessibility-settings': 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      'open-notification-settings': 'x-apple.systempreferences:com.apple.Notifications-Settings.extension',
      'open-full-disk-access': 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'
    };
    if (!urls[id]) throw new Error('Unknown action');
    execFile('/usr/bin/open', [urls[id]], () => {});
    return { ok: true };
  }

  async disconnect() {
    this.stoppedByUser = true;
    clearTimeout(this.trustRetry);
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.stopWatching();
    this.failPending('disconnected');
    if (this.interceptorProc) {
      const proc = this.interceptorProc;
      this.interceptorProc = null;
      try { proc.stdin.end(); } catch { /* helper exits when stdin closes */ }
      const t = setTimeout(() => { try { proc.kill(); } catch { /* already gone */ } }, 500);
      if (t.unref) t.unref();
      if (this.rl) { this.rl.close(); this.rl = null; }
      this.axLive.clear();
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.setStatus(this.platform === 'darwin' ? STATUS.DISCONNECTED : STATUS.UNSUPPORTED, this.platform === 'darwin' ? '' : 'Chỉ có trên macOS.');
    return true;
  }
}

module.exports = { MacNotificationCenterAdapter, dbCandidates };
