/**
 * Notification Pipeline
 * ---------------------
 * raw payload → normalize (event contract, untrusted input) → idempotency / dedupe
 * → classify (Emotion Engine) → Attention Gatekeeper → show (priority queue, grouping)
 *                                                    ↘ Inbox (no popup, no sound)
 * Latency: desktopReceivedAt → renderedAt (+ source/gateway timestamps when provided).
 *
 * Electron-independent: emits `display`, `inbox`, `history`, `latency` events.
 */
const { EventEmitter } = require('events');
const crypto = require('crypto');
const { classify } = require('./emotion-engine');
const { AttentionEngine, normalizePriority, PRIORITY_RANK, inQuietHours, derivePriority } = require('./attention-engine');
const { contactPolicy } = require('./contact-rules');
const { LatencyRecorder } = require('./latency');
const { chatDecision } = require('./chat-filter');
const privacy = require('./privacy');
const { PRESENTATION_MODES, isEmotion } = require('../shared/emotion-constants');

const DELIVERY_MODES = ['realtime_push', 'near_realtime_poll', 'scheduled_sync', 'native_os', 'manual'];
/** A card on screen gives way to a newer notification after this long (it used to block for the
 *  whole card duration, ~9 s, which made bursts of chat messages feel badly delayed). */
const MIN_VISIBLE_MS = 2500;

function cleanText(v, max) {
  if (v === undefined || v === null) return '';
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '').trim().slice(0, max);
}

function cleanUrl(v) {
  if (!v || typeof v !== 'string') return null;
  try {
    const u = new URL(v);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString().slice(0, 2000) : null;
  } catch { return null; }
}

function cleanKey(v, fallback) {
  const s = String(v || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40);
  return s || fallback;
}

function cleanTime(v) {
  if (v === undefined || v === null || v === '') return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  if (!Number.isFinite(t)) return null;
  if (t > Date.now() + 864e5 || t < 946684800000) return null; // absurd clocks
  return t;
}

/**
 * Ticket details for Jira / Bitbucket cards — allowlisted, short strings only.
 * { kind, event, key, type, status, statusTone: todo|progress|done|review|danger, priority,
 *   labels[], people: [{ label, value }], repo, branch }
 */
function cleanMeta(m) {
  if (!m || typeof m !== 'object') return null;
  const kind = ['jira', 'bitbucket'].includes(m.kind) ? m.kind : null;
  if (!kind) return null;
  const str = (v, n) => cleanText(v, n) || null;
  return {
    kind,
    event: str(m.event, 60),
    key: str(m.key, 40),
    type: str(m.type, 30),
    status: str(m.status, 40),
    statusTone: ['todo', 'progress', 'done', 'review', 'danger'].includes(m.statusTone) ? m.statusTone : null,
    priority: str(m.priority, 20),
    labels: Array.isArray(m.labels) ? m.labels.map(l => cleanText(l, 30)).filter(Boolean).slice(0, 5) : [],
    people: Array.isArray(m.people) ? m.people.filter(x => x && x.label && x.value).slice(0, 3).map(x => ({ label: cleanText(x.label, 20), value: cleanText(x.value, 60) })) : [],
    repo: str(m.repo, 80),
    branch: str(m.branch, 120)
  };
}

/** Normalize any payload into the app's NormalizedNotification contract (guide §B9). */
function normalize(raw = {}, source = 'webhook', defaults = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const app = cleanKey(r.sourceApplication || r.app, cleanKey(source, 'default'));
  const sourceEventId = cleanText(r.sourceEventId || r.externalId, 200) || null;
  const provider = cleanKey(r.provider || defaults.provider, cleanKey(source, 'webhook'));
  const title = cleanText(r.title, 140) || 'Thông báo mới';
  const message = cleanText(r.bodyPreview || r.message, 600);
  const deliveryMode = DELIVERY_MODES.includes(r.deliveryMode) ? r.deliveryMode : (defaults.deliveryMode || 'manual');
  const dedupBase = sourceEventId ? `${provider}:${sourceEventId}` : `${cleanKey(source, 'webhook')}|${title}|${message}`;
  const now = Date.now();
  return {
    id: 'n_' + crypto.randomBytes(6).toString('hex'),
    source: cleanKey(source, 'webhook'),
    provider,
    app,
    sourceApplication: app,
    appName: cleanText(r.appName, 60) || null,
    openLabel: ['chat', 'link', 'app'].includes(r.openLabel) ? r.openLabel : null,
    connectedAccountId: cleanText(r.connectedAccountId, 120) || null,
    sourceEventId,
    externalId: sourceEventId,
    title,
    message,
    sender: cleanText(r.sender || r.senderName, 80) || null,
    category: cleanKey(r.category, '') || null,
    url: cleanUrl(r.sourceUrl || r.url),
    actions: Array.isArray(r.actions) ? r.actions.filter(a => ['approve', 'break-start', 'break-snooze'].includes(a)) : [], // allowlisted inline actions
    // Optional rows (e.g. several PRs in one card), each with its own allowlisted actions.
    items: Array.isArray(r.items) ? r.items.slice(0, 8).map(it => ({
      key: cleanText(it && it.key, 120),
      title: cleanText(it && it.title, 160),
      subtitle: cleanText(it && it.subtitle, 120),
      url: cleanUrl(it && it.url),
      actions: Array.isArray(it && it.actions) ? it.actions.filter(a => ['approve'].includes(a)) : []
    })).filter(it => it.key && it.title) : [],
    meta: cleanMeta(r.meta), // structured ticket info (Jira / Bitbucket) for a readable card
    chatDirect: typeof r.chatDirect === 'boolean' ? r.chatDirect : null, // known only for some sources (Slack)
    chatMention: typeof r.chatMention === 'boolean' ? r.chatMention : null,
    moreCount: Number.isInteger(r.moreCount) && r.moreCount > 0 ? Math.min(r.moreCount, 999) : 0,
    mood: isEmotion(r.mood) ? r.mood : null,
    forceEmotion: isEmotion(r.forceEmotion) ? r.forceEmotion : null,
    priority: normalizePriority(r.priority || r.urgency),
    event: cleanText(r.event, 30) || null,
    pet: cleanKey(r.pet, '') || null,
    presentationMode: PRESENTATION_MODES.includes(r.presentationMode) ? r.presentationMode : null,
    duration: r.duration !== undefined && r.duration !== null && r.duration !== '' && Number.isFinite(Number(r.duration))
      ? Math.min(60000, Math.max(3000, Number(r.duration))) : null,
    deliveryMode,
    sourceCreatedAt: cleanTime(r.sourceCreatedAt),
    providerReceivedAt: cleanTime(r.providerReceivedAt),
    gatewayReceivedAt: cleanTime(r.gatewayReceivedAt),
    desktopReceivedAt: now,
    receivedAt: now,
    deduplicationKey: crypto.createHash('sha1').update(dedupBase).digest('hex')
  };
}

class NotificationPipeline extends EventEmitter {
  /** @param {{getSettings: () => object, inbox?: import('./inbox-store').InboxStore, directory?: import('./contact-directory').ContactDirectory}} opts */
  constructor({ getSettings, inbox = null, directory = null }) {
    super();
    this.getSettings = getSettings;
    this.inbox = inbox;
    this.directory = directory; // ContactDirectory — learns chat/sender names for the "Người quen" picker
    this.attention = new AttentionEngine({ getSettings });
    this.latency = new LatencyRecorder();
    this.queue = [];
    this.history = [];
    this.recentKeys = new Map();   // content dedupe window
    this.seenEventIds = new Map(); // idempotency for provider event IDs
    this.current = null;
    this.safetyTimer = null;
    this.stats = { received: 0, displayed: 0, deduped: 0, inboxed: 0, dropped: 0, grouped: 0, byEmotion: {}, bySource: {}, byPriority: {}, byReason: {} };
    this.lastEmotion = null;
  }

  isDnd() { return this.attention.mode().id !== 'none'; }

  /** Classify + attention preview without queueing or touching cooldown state. */
  preview(raw) {
    const n = normalize(raw, raw && raw.app || 'test');
    const classification = classify(n, this.getSettings());
    const probe = new AttentionEngine({ getSettings: this.getSettings });
    const policy = contactPolicy(n, this.getSettings(), { directory: this.directory });
    const attention = probe.decide({ ...n, emotion: classification.emotion, contentEmotion: classification.baseEmotion, contactGroup: classification.contactGroup, contactPolicy: policy });
    if (policy) classification.contactLayer = policy.layer;
    return { notification: n, classification, attention };
  }

  ingest(raw, source = 'webhook', opts = {}) {
    const s = this.getSettings();
    const n = normalize(raw, source, opts.defaults || {});
    const c = classify(n, s);
    const item = {
      ...n,
      emotion: c.emotion,
      // What the CONTENT says (before attitude/personality): drives priority, so the chosen attitude
      // changes how the pet reacts but never how urgent a notification is.
      contentEmotion: c.baseEmotion,
      contactGroup: c.contactGroup,
      annoying: c.annoying,
      matchedBy: c.matchedBy,
      rule: c.rule,
      pet: n.pet || s.activePet,
      presentationMode: n.presentationMode || s.notifications.presentationMode,
      duration: n.duration || s.notifications.duration
    };

    this.stats.received++;
    this.stats.bySource[item.source] = (this.stats.bySource[item.source] || 0) + 1;
    if (item.gatewayReceivedAt) this.latency.add(`${item.source}:gateway_to_desktop`, item.desktopReceivedAt - item.gatewayReceivedAt);

    const now = Date.now();
    // Idempotency — at-least-once providers & retries never create a second card.
    if (item.sourceEventId && !opts.bypassDedupe) {
      if (this.seenEventIds.has(item.deduplicationKey)) {
        this.stats.deduped++;
        return { accepted: false, reason: 'duplicate_event', item };
      }
      this.seenEventIds.set(item.deduplicationKey, now);
      if (this.seenEventIds.size > 5000) this.seenEventIds = new Map([...this.seenEventIds].slice(-3000));
    }

    // Content dedupe window (events without a provider ID).
    const windowMs = s.notifications.dedupeSeconds * 1000;
    for (const [k, t] of this.recentKeys) if (now - t > Math.max(windowMs, 1000)) this.recentKeys.delete(k);
    const seen = this.recentKeys.get(item.deduplicationKey);
    if (!opts.bypassDedupe && !item.sourceEventId && windowMs > 0 && seen && now - seen < windowMs) {
      this.stats.deduped++;
      return { accepted: false, reason: 'duplicate', item };
    }
    this.recentKeys.set(item.deduplicationKey, now);

    // What the CONTENT alone says (no contact rule / memory) — what the adaptive memory learns from,
    // so it can never feed on its own decisions.
    const contentPriority = derivePriority({ ...item, contactGroup: null, contactPolicy: null });
    // Familiar contacts: person > group chat > relationship > adaptive memory (contact-rules.js).
    item.contactPolicy = opts.bypassAttention ? null : contactPolicy(item, s, { directory: this.directory });
    if (item.contactPolicy) item.contactLayer = item.contactPolicy.layer;

    // Chat mode: "only when it's about me" sends other chat messages to the Inbox.
    // A chat the pet already knows is a GROUP stays a group even when this message has no
    // "Name: …" prefix (photos, stickers…) — otherwise it would pass as a 1-1 message.
    if (this.directory && item.chatDirect == null) {
      const known = this.directory.knownKind(item);
      if (known === 'group') item.chatDirect = false;
    }
    const chat = opts.bypassAttention ? null : chatDecision(item, s);
    // "Only when it's about me" stays strict: a familiar contact passes it only when the user made
    // them important (⭐ "Luôn báo ngay", or the Sếp / Quan trọng relationship) — not every group
    // chat that merely has a relationship set.
    const cpol = item.contactPolicy;
    if (chat && !chat.show && cpol && cpol.contact && !cpol.inbox && cpol.priority === 'important') { chat.show = true; chat.reason = null; }
    if (chat && chat.chat && (chat.mentioned || (chat.show && chat.direct && s.chat && s.chat.mode === 'mentions'))) item.priority = 'important';
    // Attention Gatekeeper
    const decision = opts.bypassAttention
      ? { action: 'show', reason: 'manual_test', priority: item.priority || 'normal', category: 'test', silent: false, motion: 'full', mode: 'none' }
      : chat && !chat.show
        ? { ...this.attention.decide(item), action: 'inbox', reason: 'not_mentioned' }
        : this.attention.decide(item);
    item.priority = decision.priority;
    item.category = decision.category;
    item.silent = decision.silent;
    item.motion = decision.motion;
    item.attentionReason = decision.reason;
    delete item.contactPolicy; // names inside: never sent to the overlay / Control Center / Inbox
    // Learn who/which chat this was (names only) BEFORE privacy projection masks the title.
    if (this.directory && item.source !== 'test') {
      this.directory.learn(item, now, { important: (PRIORITY_RANK[contentPriority] || 2) >= PRIORITY_RANK.important });
    }
    // Privacy projection — before the card, Control Center, history and the persisted Inbox ever
    // see the item (emotion/priority were decided above, on-device, from the full content).
    const pmode = privacy.effectiveMode(item, s);
    if (pmode !== 'full_content') Object.assign(item, privacy.project(item, pmode, s.appearance && s.appearance.language));
    this.stats.byPriority[item.priority] = (this.stats.byPriority[item.priority] || 0) + 1;
    this.stats.byReason[decision.reason] = (this.stats.byReason[decision.reason] || 0) + 1;

    if (decision.action === 'inbox') {
      this.stats.inboxed++;
      if (this.inbox) this.inbox.add({ ...item, reason: decision.reason });
      this.record({ ...item, status: 'inbox' });
      this.emit('inbox', item, decision);
      return { accepted: true, suppressed: true, inboxed: true, reason: decision.reason, item };
    }

    this.enqueue(item, s);
    this.record({ ...item, status: 'queued' });
    this.pump();
    return { accepted: true, item, reason: decision.reason };
  }

  enqueue(item, s) {
    // Burst grouping from the same app into one summary card. Anonymous items (their app was
    // replaced by 'default') only group with each other, never with real 'default' notifications.
    const groupKey = (q) => (q.privacy === 'anonymous_source_only' ? '\u0000anonymous' : `app:${q.app}`);
    const key = groupKey(item);
    const en = !!(s.appearance && s.appearance.language === 'en');
    const groupTitle = (n) => item.privacy === 'anonymous_source_only'
      ? (en ? `${n} new notifications` : `${n} thông báo mới`)
      : (en ? `${n} new notifications from ${item.appName || item.app}` : `${n} thông báo mới từ ${item.appName || item.app}`);
    const groupMessage = (list) => (item.privacy && item.privacy !== 'full_content' && item.privacy !== 'masked' ? '' : list.slice(-3).map(m => `• ${m.title}`).join('\n'));
    const sameApp = this.queue.filter(q => groupKey(q) === key && !q.group);
    if (sameApp.length + 1 >= s.notifications.groupThreshold) {
      const members = [...sameApp.flatMap(q => q.members || [q]), item];
      this.queue = this.queue.filter(q => !(groupKey(q) === key && !q.group));
      const existing = this.queue.find(q => q.group && groupKey(q) === key);
      if (existing) {
        existing.members.push(...members);
        existing.title = groupTitle(existing.members.length);
        existing.message = groupMessage(existing.members);
      } else {
        this.queue.push({
          ...item,
          id: 'g_' + item.id,
          group: true,
          members,
          title: groupTitle(members.length),
          message: groupMessage(members)
        });
      }
      this.stats.grouped++;
      return;
    }

    // Priority ordering: higher priority first, FIFO within a level.
    const rank = PRIORITY_RANK[item.priority] || 2;
    const idx = this.queue.findIndex(q => (PRIORITY_RANK[q.priority] || 2) < rank);
    if (idx === -1) this.queue.push(item); else this.queue.splice(idx, 0, item);

    while (this.queue.length > s.notifications.maxQueue) {
      // Overflow moves the oldest lowest-priority item to the Inbox — never silently lost.
      let worst = 0;
      for (let i = 1; i < this.queue.length; i++) {
        if ((PRIORITY_RANK[this.queue[i].priority] || 2) < (PRIORITY_RANK[this.queue[worst].priority] || 2)) worst = i;
      }
      const [dropped] = this.queue.splice(worst, 1);
      this.stats.dropped++;
      if (this.inbox) this.inbox.add({ ...dropped, reason: 'queue_overflow' });
    }
  }

  pump() {
    if (this.queue.length === 0) return;
    if (this.current && !this.mayPreempt()) return;
    if (this.current) {
      // A newer message is waiting: cut the current card short instead of making the new one wait
      // up to a full card duration. The cut card stays readable in the Inbox (nothing is lost).
      const prev = this.current;
      this.stats.preempted = (this.stats.preempted || 0) + 1;
      if (this.inbox) this.inbox.add({ ...prev, reason: 'replaced' });
      this.emit('preempted', prev);
    }
    const item = this.queue.shift();
    item.displayedAt = Date.now();
    this.current = item;
    this.lastEmotion = item.emotion;
    this.stats.displayed++;
    this.stats.byEmotion[item.emotion] = (this.stats.byEmotion[item.emotion] || 0) + 1;
    this.emit('display', item);
    clearTimeout(this.safetyTimer);
    this.safetyTimer = setTimeout(() => this.finished(item.id), item.duration + 60000);
    if (this.safetyTimer.unref) this.safetyTimer.unref();
    if (this.queue.length) this.mayPreempt(); // more waiting → schedule the next hand-over
  }

  /**
   * Can the card on screen give way to the next queued one? Only after it was visible for
   * MIN_VISIBLE_MS (so it can be glanced at), and never for a lower-priority item. If it is too
   * early, re-check once that minimum is reached.
   */
  mayPreempt() {
    const cur = this.current;
    const next = this.queue[0];
    if (!cur || !next) return false;
    if ((PRIORITY_RANK[next.priority] || 2) < (PRIORITY_RANK[cur.priority] || 2)) return false;
    const shownFor = Date.now() - (cur.displayedAt ?? Date.now());
    if (shownFor >= MIN_VISIBLE_MS) return true;
    clearTimeout(this.preemptTimer);
    this.preemptTimer = setTimeout(() => this.pump(), MIN_VISIBLE_MS - shownFor + 10);
    if (this.preemptTimer.unref) this.preemptTimer.unref();
    return false;
  }

  /** Renderer reports the moment the card was actually painted. */
  markRendered(id, renderedAt = Date.now()) {
    const item = this.current && this.current.id === id ? this.current : null;
    if (!item || item.renderedAt) return null;
    item.renderedAt = renderedAt;
    const out = { id, source: item.source, deliveryMode: item.deliveryMode, desktopToRender: renderedAt - item.desktopReceivedAt };
    this.latency.add(`${item.source}:desktop_to_render`, out.desktopToRender);
    if (item.sourceCreatedAt) {
      out.endToEnd = renderedAt - item.sourceCreatedAt;
      this.latency.add(`${item.source}:end_to_end`, out.endToEnd);
    }
    const h = this.history.find(x => x.id === id);
    if (h) { h.renderedAt = renderedAt; h.latencyMs = out.endToEnd ?? out.desktopToRender; }
    this.emit('latency', out);
    return out;
  }

  finished(id) {
    if (!this.current || (id && this.current.id !== id)) return;
    clearTimeout(this.safetyTimer);
    this.current = null;
    const t = setTimeout(() => this.pump(), 250);
    if (t.unref) t.unref();
  }

  /** Hidden / gaming: move everything waiting into the Inbox (nothing is lost). */
  flushQueueToInbox(reason = 'presence_hidden') {
    for (const q of this.queue) if (this.inbox) this.inbox.add({ ...q, reason });
    this.stats.inboxed += this.queue.length;
    this.queue = [];
  }

  clearQueue() { this.queue = []; }

  record(item) {
    const s = this.getSettings();
    if (!s.privacy.keepHistory || s.privacy.historyLimit === 0) return;
    const { members, ...rest } = item;
    this.history.unshift({ ...rest, members: members ? members.length : undefined });
    if (this.history.length > s.privacy.historyLimit) this.history.length = s.privacy.historyLimit;
    this.emit('history', this.history[0]);
  }

  clearHistory() { this.history = []; }

  snapshot() {
    const mode = this.attention.mode();
    return {
      current: this.current ? { id: this.current.id, title: this.current.title, emotion: this.current.emotion, app: this.current.app } : null,
      queueLength: this.queue.length,
      dnd: mode.id !== 'none',
      mode: { id: mode.id, source: mode.source, emoji: mode.emoji },
      lastEmotion: this.lastEmotion,
      stats: this.stats,
      latency: this.latency.all(),
      inbox: this.inbox ? { unread: this.inbox.unreadCount(), items: this.inbox.list(100), digest: this.inbox.digest() } : null,
      history: this.history.slice(0, 50)
    };
  }
}

module.exports = { NotificationPipeline, normalize, inQuietHours, cleanText, cleanUrl, DELIVERY_MODES };
