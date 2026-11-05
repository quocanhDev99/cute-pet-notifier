/**
 * Contact Directory — the chats and people the pet has SEEN in notifications, so the user can pick
 * them in "👥 Người quen" instead of typing names (app → conversation → member), get "Hay nhắn nhất"
 * suggestions, and (opt-out) let the pet adapt to someone's habits.
 *
 * What is kept (metadata only): app, conversation title, 1-1 or group, sender NAMES seen in that
 * conversation, message counts per day (last 14 days), how many were important, last-seen time.
 * Never the message text. Nothing is learned when content is hidden (privacy mode ≠ full_content
 * for that item) or when the user turned it off (privacy.learnContacts = false).
 * Persisted to userData/contact-directory.json; "Quên danh sách đã gặp" wipes it.
 */
const fs = require('fs');
const path = require('path');
const { isChat, isDirect, fold, senderPrefix, parseActionTitle, CONTACT_GROUPS } = require('./chat-filter');
const privacy = require('./privacy');

const MAX_CHATS = 400;
const MAX_MEMBERS = 40;
const KEEP_DAYS = 14;
const GENERIC_TITLES = new Set(['thong bao moi', 'new notification', 'tin nhan moi', 'new message']);
// Adaptive memory thresholds (metadata only).
const IMPORTANT_MIN = 5; // at least this many messages before judging someone
const IMPORTANT_RATIO = 0.5; // ≥ half of them were important by content → "thường gửi tin quan trọng"
const BUSY_PER_DAY = 40; // a group chat with this many messages today is "rất sôi nổi"

const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** "Nhóm Dự Án — Bạn A" (macOS NC) → { chat: 'Nhóm Dự Án', sender: 'Bạn A' }. */
function splitTitle(title) {
  const t = String(title || '').trim();
  const i = t.indexOf(' — ');
  if (i > 0) return { chat: t.slice(0, i).trim(), sender: t.slice(i + 3).trim() || null };
  return { chat: t, sender: null };
}

/** The conversation a notification belongs to + who sent it. Null when it can't be told. */
function conversationOf(item) {
  // "X @mentioned you" / "X forwarded a message": the chat is the body's "Chat: …" prefix, or X (1-1).
  const act = parseActionTitle(item);
  if (act) return act.chat ? { chat: act.chat, direct: false, sender: act.sender } : { chat: act.sender, direct: true, sender: act.sender };
  const { chat, sender: titleSender } = splitTitle(item.title);
  if (!chat || GENERIC_TITLES.has(fold(chat))) return null;
  const direct = !titleSender && isDirect(item);
  const sender = item.sender || titleSender || (direct ? chat : senderPrefix(item.message)) || null;
  return { chat, direct, sender };
}

function bump(rec, at, important) {
  rec.count = (rec.count || 0) + 1;
  rec.important = (rec.important || 0) + (important ? 1 : 0);
  rec.lastSeen = Math.max(rec.lastSeen || 0, at);
  const days = rec.days || (rec.days = {});
  const k = dayKey(at);
  days[k] = (days[k] || 0) + 1;
  const keys = Object.keys(days).sort();
  while (keys.length > KEEP_DAYS) delete days[keys.shift()];
}

function recent(rec, now, n = 7) {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (rec.days && rec.days[dayKey(now - i * 864e5)]) || 0;
  return sum;
}

const contactKey = (app, kind, name) => `${app || '*'}|${kind}|${fold(name).trim()}`;

class ContactDirectory {
  constructor(dir, { getSettings, now = () => Date.now() }) {
    this.file = dir ? path.join(dir, 'contact-directory.json') : null;
    this.getSettings = getSettings;
    this.now = now;
    this.chats = [];
    if (this.file) {
      try { if (fs.existsSync(this.file)) this.chats = JSON.parse(fs.readFileSync(this.file, 'utf8')) || []; } catch { this.chats = []; }
    }
    this.saveTimer = null;
    if (this.migrateActionTitles()) this.persist();
  }

  /**
   * Older builds stored activity titles ("X @mentioned you") as if they were chats, with the real
   * chat (body prefix) as a "member". Fold those back into the right chat with X as the member.
   */
  migrateActionTitles() {
    let changed = false;
    for (const bad of this.chats.filter(c => parseActionTitle({ title: c.title }))) {
      const { sender } = parseActionTitle({ title: bad.title });
      this.chats = this.chats.filter(c => c !== bad);
      changed = true;
      const targets = bad.members.length ? bad.members.map(m => ({ chat: m.name, direct: false, n: m })) : [{ chat: sender, direct: true, n: bad }];
      for (const t of targets) {
        let c = this.find(bad.app, t.chat);
        if (!c) { c = { app: bad.app, appName: bad.appName, title: t.chat, direct: t.direct, count: 0, important: 0, firstSeen: bad.firstSeen, lastSeen: 0, days: {}, members: [] }; this.chats.push(c); }
        c.count += t.n.count || 0;
        c.important = (c.important || 0) + (t.n.important || 0);
        c.lastSeen = Math.max(c.lastSeen || 0, t.n.lastSeen || 0);
        for (const [k, v] of Object.entries(t.n.days || {})) c.days[k] = (c.days[k] || 0) + v;
        if (!t.direct) {
          c.direct = false;
          let m = c.members.find(x => fold(x.name) === fold(sender));
          if (!m) { m = { name: sender, count: 0, important: 0, lastSeen: 0, days: {} }; c.members.push(m); }
          m.count += t.n.count || 0;
          m.lastSeen = Math.max(m.lastSeen || 0, t.n.lastSeen || 0);
          for (const [k, v] of Object.entries(t.n.days || {})) m.days[k] = (m.days[k] || 0) + v;
        }
      }
    }
    return changed;
  }

  enabled() {
    const s = this.getSettings();
    return !(s.privacy && s.privacy.learnContacts === false);
  }

  find(app, title) {
    const key = fold(title);
    return this.chats.find(x => x.app === app && fold(x.title) === key) || null;
  }

  /** Learn from one (full, un-projected) notification. Returns true when something changed. */
  learn(item, at = this.now(), { important = false } = {}) {
    if (!item || !this.enabled() || !isChat(item)) return false;
    if (privacy.effectiveMode(item, this.getSettings()) !== 'full_content') return false;
    const conv = conversationOf(item);
    if (!conv) return false;
    const app = String(item.app || '').toLowerCase();
    let c = this.find(app, conv.chat);
    if (!c) {
      c = { app, appName: item.appName || null, title: conv.chat, direct: conv.direct, count: 0, important: 0, firstSeen: at, lastSeen: at, days: {}, members: [] };
      this.chats.push(c);
    }
    bump(c, at, important);
    if (item.appName) c.appName = item.appName;
    // Once any message shows a "Name: …" prefix / several senders, it's a group for good.
    if (!conv.direct) c.direct = false;
    if (conv.sender && !c.direct && fold(conv.sender) !== fold(c.title)) {
      let m = c.members.find(x => fold(x.name) === fold(conv.sender));
      if (!m) { m = { name: conv.sender, count: 0, important: 0, lastSeen: at, days: {} }; c.members.push(m); }
      bump(m, at, important);
      if (c.members.length > MAX_MEMBERS) { c.members.sort((a, b) => b.lastSeen - a.lastSeen); c.members.length = MAX_MEMBERS; }
    }
    if (this.chats.length > MAX_CHATS) { this.chats.sort((a, b) => b.lastSeen - a.lastSeen); this.chats.length = MAX_CHATS; }
    this.persistSoon();
    return true;
  }

  /** 'group' | 'direct' | null — what the pet learned about this notification's chat. */
  knownKind(item) {
    if (!item || !isChat(item)) return null;
    const conv = conversationOf(item);
    if (!conv) return null;
    const c = this.find(String(item.app || '').toLowerCase(), conv.chat);
    return c ? (c.direct ? 'direct' : 'group') : null;
  }

  /** Adaptive memory for one notification — metadata only, from what was seen BEFORE it. */
  insight(item) {
    if (!item || !isChat(item)) return null;
    const conv = conversationOf(item);
    if (!conv) return null;
    const c = this.find(String(item.app || '').toLowerCase(), conv.chat);
    if (!c) return null;
    const who = c.direct ? c : conv.sender && c.members.find(m => fold(m.name) === fold(conv.sender));
    const importantSender = !!(who && who.count >= IMPORTANT_MIN && who.important / who.count >= IMPORTANT_RATIO);
    const busyChat = !c.direct && ((c.days && c.days[dayKey(this.now())]) || 0) >= BUSY_PER_DAY;
    return importantSender || busyChat ? { importantSender, busyChat } : null;
  }

  /** What the memory currently concludes — shown to the user ("Bé nhận thấy…") so it can be reviewed. */
  insights() {
    const out = [];
    const now = this.now();
    for (const c of this.chats) {
      const label = c.direct ? c.title : null;
      if (c.direct && c.count >= IMPORTANT_MIN && c.important / c.count >= IMPORTANT_RATIO) out.push({ app: c.app, kind: 'person', name: label, note: 'important_sender', count: c.count });
      for (const m of c.members) if (m.count >= IMPORTANT_MIN && m.important / m.count >= IMPORTANT_RATIO) out.push({ app: c.app, kind: 'person', name: m.name, chat: c.title, note: 'important_sender', count: m.count });
      if (!c.direct && ((c.days && c.days[dayKey(now)]) || 0) >= BUSY_PER_DAY) out.push({ app: c.app, kind: 'chat', name: c.title, note: 'busy_chat', count: c.days[dayKey(now)] });
    }
    return out.slice(0, 20);
  }

  /**
   * "Hay nhắn nhất": people / group chats who wrote most in the last 7 days and have no rule yet.
   * Only a suggestion — the user decides whether and how to classify them.
   */
  suggestions(contacts = [], limit = 6) {
    const now = this.now();
    const known = new Set();
    for (const c of contacts || []) {
      if (!c || !CONTACT_GROUPS[c.group]) continue;
      const kind = c.kind === 'chat' ? 'chat' : 'person';
      known.add(contactKey(c.app, kind, c.name));
      if (!c.app) known.add(`*any|${kind}|${fold(c.name).trim()}`);
    }
    const isKnown = (app, kind, name) => known.has(contactKey(app, kind, name)) || known.has(`*any|${kind}|${fold(name).trim()}`);
    const out = [];
    for (const c of this.chats) {
      const kind = c.direct ? 'person' : 'chat';
      const score = recent(c, now);
      if (score > 0 && !isKnown(c.app, kind, c.title)) out.push({ app: c.app, appName: c.appName, kind, name: c.title, score, lastSeen: c.lastSeen });
      if (!c.direct) {
        for (const m of c.members) {
          const ms = recent(m, now);
          if (ms > 0 && !isKnown(c.app, 'person', m.name)) out.push({ app: c.app, appName: c.appName, kind: 'person', name: m.name, chat: c.title, score: ms, lastSeen: m.lastSeen });
        }
      }
    }
    // One entry per person per app (someone active in several groups is summed).
    const merged = new Map();
    for (const s of out) {
      const k = contactKey(s.app, s.kind, s.name);
      const prev = merged.get(k);
      if (prev) { prev.score += s.score; prev.lastSeen = Math.max(prev.lastSeen, s.lastSeen); } else merged.set(k, { ...s });
    }
    return [...merged.values()].sort((a, b) => b.score - a.score || b.lastSeen - a.lastSeen).slice(0, limit);
  }

  /** Grouped for the picker: apps (most recent first) → chats (most recent first). */
  list(contacts) {
    const now = this.now();
    const byApp = new Map();
    for (const c of this.chats) {
      if (!byApp.has(c.app)) byApp.set(c.app, { app: c.app, appName: c.appName || null, count: 0, lastSeen: 0, chats: [] });
      const a = byApp.get(c.app);
      a.count += c.count;
      a.lastSeen = Math.max(a.lastSeen, c.lastSeen);
      if (c.appName) a.appName = c.appName;
      a.chats.push({
        app: c.app, title: c.title, direct: c.direct, count: c.count, lastSeen: c.lastSeen, week: recent(c, now),
        members: c.members.map(m => ({ name: m.name, count: m.count, lastSeen: m.lastSeen })).sort((x, y) => y.count - x.count)
      });
    }
    const apps = [...byApp.values()].sort((a, b) => b.lastSeen - a.lastSeen);
    for (const a of apps) a.chats.sort((x, y) => y.lastSeen - x.lastSeen);
    const s = this.getSettings();
    return {
      enabled: this.enabled(),
      memory: !(s.privacy && s.privacy.adaptiveMemory === false),
      apps,
      suggestions: this.suggestions(contacts || s.contacts),
      insights: this.insights()
    };
  }

  clear() { this.chats = []; this.persist(); }

  persistSoon() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.persist(); }, 1500);
    if (this.saveTimer.unref) this.saveTimer.unref();
  }

  persist() {
    if (!this.file) return;
    try { fs.writeFileSync(this.file, JSON.stringify(this.chats)); } catch { /* disk full / read-only: keep in memory */ }
  }
}

module.exports = { ContactDirectory, conversationOf, splitTitle };
