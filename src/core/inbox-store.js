/**
 * Inbox — durable store for notifications that were not shown as popups
 * (low priority, focus/meeting/hidden, cooldown, muted apps). Nothing is lost
 * because the pet was hidden. Persisted to userData/inbox.json when allowed by
 * the user's privacy settings; otherwise kept in memory only.
 */
const fs = require('fs');
const { EventEmitter } = require('events');
const path = require('path');

const KEEP_FIELDS = ['id', 'source', 'app', 'appName', 'sender', 'privacy', 'meta', 'title', 'message', 'url', 'emotion', 'priority', 'category', 'deliveryMode', 'reason', 'receivedAt', 'sourceEventId', 'read'];

class InboxStore extends EventEmitter {
  constructor(dir, { getSettings }) {
    super();
    this.file = dir ? path.join(dir, 'inbox.json') : null;
    this.getSettings = getSettings;
    this.items = [];
    if (this.file && this.persistEnabled()) {
      try { if (fs.existsSync(this.file)) this.items = JSON.parse(fs.readFileSync(this.file, 'utf8')) || []; } catch { this.items = []; }
    }
  }

  persistEnabled() {
    const s = this.getSettings();
    return !!(s.attention && s.attention.persistInbox !== false);
  }

  limit() {
    const s = this.getSettings();
    return Math.max(0, (s.attention && s.attention.inboxLimit) ?? 200);
  }

  add(item) {
    const clean = {};
    for (const k of KEEP_FIELDS) if (item[k] !== undefined && item[k] !== null) clean[k] = item[k];
    clean.read = false;
    this.items.unshift(clean);
    if (this.items.length > this.limit()) this.items.length = this.limit();
    this.persist();
    return clean;
  }

  markRead(id) {
    for (const it of this.items) if (!id || it.id === id) it.read = true;
    this.persist();
  }

  /**
   * Opening a notification = the user is looking at that conversation now: earlier unread items of
   * the same app (and same title/chat, when known) count as read. Returns how many changed.
   */
  markConversationRead(app, title) {
    if (!app) return 0;
    let n = 0;
    for (const it of this.items) {
      if (it.read || it.app !== app) continue;
      if (title && it.title && it.title !== title) continue;
      it.read = true;
      n++;
    }
    if (n) this.persist();
    return n;
  }

  remove(id) { this.items = this.items.filter(i => i.id !== id); this.persist(); }
  clear() { this.items = []; this.persist(); }
  /** Unread items, optionally only those matching `filter(item)`. */
  unreadCount(filter = null) { return this.items.filter(i => !i.read && (!filter || filter(i))).length; }
  list(n = 100) { return this.items.slice(0, n); }

  /** Digest: grouped summary of unread items. */
  digest() {
    const unread = this.items.filter(i => !i.read);
    const byApp = {};
    const byPriority = { critical: 0, important: 0, normal: 0, low: 0 };
    for (const i of unread) {
      byApp[i.app] = (byApp[i.app] || 0) + 1;
      if (byPriority[i.priority] !== undefined) byPriority[i.priority]++;
    }
    const apps = Object.entries(byApp).sort((a, b) => b[1] - a[1]);
    return {
      total: unread.length,
      byApp: apps,
      byPriority,
      top: unread.filter(i => i.priority === 'critical' || i.priority === 'important').slice(0, 5)
    };
  }

  /** Every mutation goes through persist(): tell listeners (unread badge) the inbox changed. */
  persist() {
    this.emit('change', this.unreadCount());
    if (!this.file) return;
    try {
      if (!this.persistEnabled()) { if (fs.existsSync(this.file)) fs.rmSync(this.file, { force: true }); return; }
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.items), { mode: 0o600 });
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.warn('[Inbox] persist failed:', err.message);
    }
  }
}

/**
 * What the pet's unread badge counts, following the chat mode:
 *   all       → every unread message sent to you;
 *   mentions  → only 1-1 messages and mentions — group chatter the filter set aside
 *               (reason 'not_mentioned') stays readable in the Inbox but isn't counted.
 */
function badgeFilter(settings) {
  const onlyForMe = !!(settings && settings.chat && settings.chat.mode === 'mentions');
  return onlyForMe ? (it) => it.reason !== 'not_mentioned' : null;
}

module.exports = { InboxStore, badgeFilter };
