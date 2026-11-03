/**
 * macOS Notification Center adapter — lets the pet REPLACE the default macOS banners.
 *
 * ⚠️ Not a public Apple API (explicit user decision, see docs/reports/KNOWN_LIMITATIONS.md):
 * we read, READ-ONLY, the local Notification Center database that macOS already keeps for the
 * current user. Nothing leaves the machine. The schema/format is undocumented and may change
 * with macOS updates; the adapter reports `Error`/`Permission Limited` instead of failing silently.
 *
 *   macOS ≤ 14: $(getconf DARWIN_USER_DIR)/com.apple.notificationcenter/db2/db
 *   macOS ≥ 15: ~/Library/Group Containers/group.com.apple.usernoted/db2/db  (needs Full Disk Access)
 *
 * Change detection: stat() of db-wal / db every 400 ms (FSEvents does not fire for this file),
 * sqlite is only spawned when the file actually changed; plus a 30 s safety poll.
 * To hide the ORIGINAL banners: System Settings → Notifications → <app> → Alert style "None",
 * keep "Show in Notification Center" ON (the entry is still recorded, the pet shows it).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
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

class MacNotificationCenterAdapter extends ApplicationAdapter {
  constructor(ctx, platform = process.platform) {
    super(ctx, {
      id: 'macos_nc',
      name: 'macOS Notification Center (thay thế thông báo hệ thống)',
      icon: '🍎',
      description: 'Bắt thông báo của MỌI ứng dụng trên Mac (Zalo, Messenger, Mail, Slack, Lịch…) và để thú cưng mang tới thay cho banner mặc định.',
      help: 'Chỉ đọc cơ sở dữ liệu Notification Center có sẵn trên máy bạn, xử lý cục bộ. Đây KHÔNG phải API công khai của Apple: có thể ngừng hoạt động sau khi nâng cấp macOS. Để tắt banner gốc: Cài đặt Hệ thống → Thông báo → chọn từng app → Kiểu thông báo "Không có", vẫn BẬT "Hiển thị trong Trung tâm thông báo".',
      deliveryMode: 'native_os',
      provider: 'macos',
      fields: [
        { key: 'skipConnectedSlack', label: 'Bỏ qua Slack khi đã kết nối Slack trực tiếp (tránh trùng)', type: 'boolean' },
        { key: 'skipAppleSystem', label: 'Bỏ qua thông báo hệ thống của Apple (cập nhật, Screen Time…)', type: 'boolean' }
      ],
      actions: [
        { id: 'open-notification-settings', label: '⚙️ Mở Cài đặt Thông báo của macOS (tắt banner gốc)' },
        { id: 'open-full-disk-access', label: '🔐 Mở cài đặt Full Disk Access (macOS 15+)' }
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
    if (platform !== 'darwin') this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên macOS.');
  }

  async connect() {
    if (this.platform !== 'darwin') { this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên macOS.'); return false; }
    let lastErr = null;
    for (const db of (this.ctx.ncDbPath ? [this.ctx.ncDbPath] : dbCandidates())) {
      if (!fs.existsSync(db)) {
        // On macOS 15 the group container exists but is unreadable without Full Disk Access.
        try { fs.accessSync(path.dirname(path.dirname(db))); } catch (e) { if (e.code === 'EPERM' || e.code === 'EACCES') lastErr = e; }
        continue;
      }
      try {
        const out = await sqlite(db, 'SELECT ifnull(max(rec_id),0) FROM record;');
        this.db = db;
        this.lastId = parseInt(out.trim(), 10) || 0; // only notifications from now on
        this.startWatching();
        this.setStatus(STATUS.CONNECTED, `Đang theo dõi Notification Center · bắt đầu từ #${this.lastId}`);
        return true;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr && /EPERM|EACCES|authorization|unable to open/i.test(`${lastErr.code} ${lastErr.stderr || lastErr.message}`)) {
      this.setStatus(STATUS.LIMITED, 'macOS chặn quyền đọc. Cấp "Full Disk Access" cho Cute Pet Companion (hoặc Terminal khi chạy npm start) rồi kết nối lại.');
    } else {
      this.setStatus(STATUS.ERROR, `Không tìm thấy/không đọc được cơ sở dữ liệu thông báo${lastErr ? `: ${String(lastErr.stderr || lastErr.message).trim().slice(0, 120)}` : ''}`);
    }
    return false;
  }

  startWatching() {
    this.stopWatching();
    // FSEvents/kqueue do not report usernoted's writes to this DB (verified on macOS 14.6),
    // so watch the WAL/DB mtime with a cheap stat (no process spawn) and query only on change.
    this.watched = ['db-wal', 'db'].map(f => path.join(path.dirname(this.db), f)).filter(f => fs.existsSync(f));
    this.onStat = (cur, prev) => { if (cur.mtimeMs !== prev.mtimeMs || cur.size !== prev.size) this.schedule(); };
    for (const f of this.watched) fs.watchFile(f, { interval: 400, persistent: false }, this.onStat);
    // Safety net in case the WAL is checkpointed/replaced.
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
        const deliveredMs = Number(delivered) ? APPLE_EPOCH_MS + Number(delivered) * 1000 : (typeof rec.date === 'number' ? APPLE_EPOCH_MS + rec.date * 1000 : Date.now());
        let link = null;
        try { link = deepLinkFor(bundleId, req); } catch { link = null; }
        this.publish({ recId, bundleId, title: req.titl, subtitle: req.subt, body: req.body, deliveredMs, link: link && link.url, linkKind: link && link.kind });
      }
      this.detail = `Đang theo dõi Notification Center · #${this.lastId}`;
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

  /** Human app name via Spotlight (cached, best-effort, never blocks the pipeline long). */
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
    const app = this.appInfo(n.bundleId);
    const title = n.subtitle ? `${n.title || app.label} — ${n.subtitle}` : (n.title || app.label);
    const sourceEventId = `nc:${n.recId}:${n.bundleId}`;
    if (n.link) {
      this.links.set(sourceEventId, n.link);
      if (this.links.size > 500) this.links.delete(this.links.keys().next().value);
    }
    return {
      app: app.key,
      appName: app.label,
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

  /** Clicking a card brings the original app to the front. */
  async handleNotificationAction(action, externalId) {
    if (action !== 'open' || !externalId) return;
    const bundleId = String(externalId).split(':').slice(2).join(':');
    if (!/^[a-z0-9._-]+$/i.test(bundleId)) return;
    const link = this.links.get(String(externalId));
    // Exact conversation when the app attached enough info; otherwise just bring the app forward.
    if (link) execFile('/usr/bin/open', ['-b', bundleId, link], (err) => { if (err) execFile('/usr/bin/open', ['-b', bundleId], () => {}); });
    else execFile('/usr/bin/open', ['-b', bundleId], () => {});
  }

  async runAction(id) {
    const urls = {
      'open-notification-settings': 'x-apple.systempreferences:com.apple.Notifications-Settings.extension',
      'open-full-disk-access': 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'
    };
    if (!urls[id]) throw new Error('Unknown action');
    execFile('/usr/bin/open', [urls[id]], () => {});
    return { ok: true };
  }

  async disconnect() {
    this.stopWatching();
    this.setStatus(this.platform === 'darwin' ? STATUS.DISCONNECTED : STATUS.UNSUPPORTED, this.platform === 'darwin' ? '' : 'Chỉ có trên macOS.');
    return true;
  }
}

module.exports = { MacNotificationCenterAdapter, dbCandidates };
