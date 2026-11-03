/**
 * macOS Notification Center adapter — lets the pet REPLACE the default macOS banners.
 *
 * Dual-layer Architecture:
 * 1. ⚡ Instant Native AX Interceptor (src/native/macos/NotificationInterceptor.m -> bin/macos-interceptor):
 *    Uses Accessibility API (AXObserver) to intercept incoming banners from
 *    com.apple.notificationcenterui in < 50ms, dismisses the native banner immediately
 *    to avoid duplicate popups, and emits JSON events.
 * 2. 🗄️ SQLite Database Watcher (fallback & background history):
 *    Reads local record store with deduplication fingerprints so events are never duplicated.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn, execFile, execFileSync } = require('child_process');
const { ApplicationAdapter, STATUS } = require('./base-adapter');
const { parseBplist, APPLE_EPOCH_MS } = require('./bplist');
const { deepLinkFor } = require('./nc-deeplink');

const SQLITE = '/usr/bin/sqlite3';
const OWN_BUNDLES = ['com.github.electron', 'com.cutepet.companion'];

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

function makeFingerprint(appName, title, body) {
  const a = String(appName || '').trim().toLowerCase();
  const t = String(title || '').trim().toLowerCase();
  const b = String(body || '').trim().slice(0, 40).toLowerCase();
  return `${a}|${t}|${b}`;
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
        { key: 'suppressNativeBanner', label: 'Tự động đóng banner gốc macOS (yêu cầu quyền Trợ năng)', type: 'boolean', default: true },
        { key: 'skipConnectedSlack', label: 'Bỏ qua Slack khi đã kết nối Slack trực tiếp (tránh trùng)', type: 'boolean' },
        { key: 'skipAppleSystem', label: 'Bỏ qua thông báo hệ thống của Apple (cập nhật, Screen Time…)', type: 'boolean' }
      ],
      actions: [
        { id: 'open-accessibility-settings', label: '🔐 Mở Cài đặt Trợ năng (Accessibility - để tự đóng banner gốc)' },
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
    this.handledFingerprints = new Set();
    this.interceptorProc = null;
    this.rl = null;
    this.isTrusted = false;

    if (platform !== 'darwin') this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên macOS.');
  }

  async connect() {
    if (this.platform !== 'darwin') { this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên macOS.'); return false; }
    
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
        
        const modeLabel = this.isTrusted ? '⚡ Chặn & thay thế banner tức thì (<50ms)' : `Đang theo dõi Notification Center · #${this.lastId}`;
        this.setStatus(STATUS.CONNECTED, modeLabel);
        return true;
      } catch (err) {
        lastErr = err;
      }
    }

    if (this.interceptorProc) {
      // Even if SQLite is blocked by Full Disk Access, instant interceptor is active!
      this.setStatus(STATUS.CONNECTED, this.isTrusted ? '⚡ Đang chặn & thay thế banner tức thì qua Accessibility' : 'Đang chạy qua Accessibility (Cần cấp quyền Trợ năng)');
      return true;
    }

    if (lastErr && /EPERM|EACCES|authorization|unable to open/i.test(`${lastErr.code} ${lastErr.stderr || lastErr.message}`)) {
      this.setStatus(STATUS.LIMITED, 'macOS chặn quyền đọc. Cấp "Full Disk Access" hoặc "Trợ năng (Accessibility)" cho Cute Pet Companion rồi kết nối lại.');
    } else {
      this.setStatus(STATUS.ERROR, `Không tìm thấy/không đọc được cơ sở dữ liệu thông báo${lastErr ? `: ${String(lastErr.stderr || lastErr.message).trim().slice(0, 120)}` : ''}`);
    }
    return false;
  }

  startNativeInterceptor() {
    if (this.interceptorProc) return;
    const rootDir = path.resolve(__dirname, '../..');
    const binPath = path.join(rootDir, 'bin', 'macos-interceptor');

    if (!fs.existsSync(binPath)) {
      this.ctx.log('[macos_nc] Interceptor binary not found at bin/macos-interceptor, skipping instant hook.');
      return;
    }

    try {
      this.interceptorProc = spawn(binPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      this.rl = readline.createInterface({ input: this.interceptorProc.stdout });

      this.rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) return;
        try {
          const ev = JSON.parse(trimmed);
          this.handleInterceptorEvent(ev);
        } catch { /* ignore invalid json */ }
      });

      this.interceptorProc.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg) this.ctx.log(`[macos_nc] interceptor stderr: ${msg}`);
      });

      this.interceptorProc.on('close', (code) => {
        this.ctx.log(`[macos_nc] interceptor exited with code ${code}`);
        this.interceptorProc = null;
      });
    } catch (err) {
      this.ctx.log(`[macos_nc] failed to spawn interceptor: ${err.message}`);
    }
  }

  handleInterceptorEvent(ev) {
    if (ev.type === 'status') {
      this.isTrusted = !!ev.trusted;
      if (this.status === STATUS.CONNECTED) {
        if (this.isTrusted) {
          this.setStatus(STATUS.CONNECTED, '⚡ Đang chặn & thay thế banner macOS tức thì (<50ms)');
        } else {
          this.setStatus(STATUS.CONNECTED, 'Đang đọc thông báo · Cần cấp quyền Trợ năng để tự động đóng banner gốc');
        }
      }
    } else if (ev.type === 'notification') {
      const appName = ev.appName || 'Notification';
      const title = ev.title || appName;
      const body = ev.body || '';

      const fp = makeFingerprint(appName, title, body);
      if (this.handledFingerprints.has(fp)) return;
      this.rememberFingerprint(fp);

      const app = this.appInfo(appName.toLowerCase());
      if (this.shouldSkip(app.key)) return;

      this.publish({
        instant: true,
        dismissedNative: !!ev.dismissedNative,
        bundleId: app.key,
        appName,
        title,
        body,
        deliveredMs: ev.timestamp || Date.now(),
        sourceEventId: ev.id
      });
    }
  }

  rememberFingerprint(fp) {
    this.handledFingerprints.add(fp);
    if (this.handledFingerprints.size > 500) {
      const oldest = this.handledFingerprints.keys().next().value;
      this.handledFingerprints.delete(oldest);
    }
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
      const sql = `SELECT r.rec_id, a.identifier, r.delivered_date, hex(r.data) FROM record r JOIN app a ON a.app_id = r.app_id WHERE r.rec_id > ${Number(this.lastId) | 0} ORDER BY r.rec_id LIMIT 50;`;
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

        const app = this.appInfo(bundleId);
        const fp = makeFingerprint(app.label, req.titl, req.body);
        if (this.handledFingerprints.has(fp)) {
          // Already intercepted and shown instantly by AX interceptor!
          continue;
        }
        this.rememberFingerprint(fp);

        const deliveredMs = Number(delivered) ? APPLE_EPOCH_MS + Number(delivered) * 1000 : (typeof rec.date === 'number' ? APPLE_EPOCH_MS + rec.date * 1000 : Date.now());
        let link = null;
        try { link = deepLinkFor(bundleId, req); } catch { link = null; }
        this.publish({ recId, bundleId, title: req.titl, subtitle: req.subt, body: req.body, deliveredMs, link: link && link.url, linkKind: link && link.kind });
      }
      if (!this.isTrusted) {
        this.detail = `Đang theo dõi Notification Center · #${this.lastId}`;
      }
    } catch (err) {
      this.detail = `Lỗi đọc: ${String(err.stderr || err.message).trim().slice(0, 100)}`;
    } finally {
      this.busy = false;
      if (this.pending) { this.pending = false; this.schedule(); }
    }
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

  lookupName(bundleId) {
    if (this.names.has(bundleId)) return this.names.get(bundleId);
    let name = null;
    try {
      const out = execFileSync('/usr/bin/mdfind', [`kMDItemCFBundleIdentifier == '${bundleId.replace(/'/g, '')}'c`], { encoding: 'utf8', timeout: 800 });
      const first = out.split('\n').find(Boolean);
      if (first) name = path.basename(first).replace(/\.app$/, '');
    } catch { /* ignore */ }
    if (!name) name = bundleId.split('.').pop();
    this.names.set(bundleId, name);
    return name;
  }

  normalizeNotification(n) {
    const app = this.appInfo(n.bundleId || n.appName);
    const title = n.subtitle ? `${n.title || app.label} — ${n.subtitle}` : (n.title || app.label);
    const sourceEventId = n.sourceEventId || `nc:${n.recId}:${n.bundleId}`;
    if (n.link) {
      this.links.set(sourceEventId, n.link);
      if (this.links.size > 500) this.links.delete(this.links.keys().next().value);
    }
    return {
      app: app.key,
      appName: app.label || n.appName,
      title,
      message: n.body || '',
      category: app.key === 'macos' ? 'system' : undefined,
      deliveryMode: 'native_os',
      provider: 'macos',
      sourceEventId,
      openLabel: n.link ? (n.linkKind === 'message' ? 'chat' : 'link') : 'app',
      sourceCreatedAt: n.deliveredMs
    };
  }

  async handleNotificationAction(action, externalId) {
    if (action !== 'open' || !externalId) return;
    const parts = String(externalId).split(':');
    const bundleId = parts.length > 2 ? parts.slice(2).join(':') : parts[0];
    if (!/^[a-z0-9._-]+$/i.test(bundleId)) return;
    const link = this.links.get(String(externalId));
    if (link) execFile('/usr/bin/open', ['-b', bundleId, link], (err) => { if (err) execFile('/usr/bin/open', ['-b', bundleId], () => {}); });
    else execFile('/usr/bin/open', ['-b', bundleId], () => {});
  }

  async runAction(id) {
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
    this.stopWatching();
    if (this.interceptorProc) {
      try {
        this.interceptorProc.stdin.write(JSON.stringify({ action: 'quit' }) + '\n');
      } catch {}
      setTimeout(() => {
        if (this.interceptorProc) this.interceptorProc.kill();
        this.interceptorProc = null;
      }, 300);
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
