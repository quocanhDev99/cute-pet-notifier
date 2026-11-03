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
const { AttentionEngine, normalizePriority, PRIORITY_RANK, inQuietHours } = require('./attention-engine');
const { LatencyRecorder } = require('./latency');
const { PRESENTATION_MODES, isEmotion } = require('../shared/emotion-constants');

const DELIVERY_MODES = ['realtime_push', 'near_realtime_poll', 'scheduled_sync', 'native_os', 'manual'];

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
    category: cleanKey(r.category, '') || null,
    url: cleanUrl(r.sourceUrl || r.url),
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
  /** @param {{getSettings: () => object, inbox?: import('./inbox-store').InboxStore}} opts */
  constructor({ getSettings, inbox = null }) {
    super();
    this.getSettings = getSettings;
    this.inbox = inbox;
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
    const attention = probe.decide({ ...n, emotion: classification.emotion });
    return { notification: n, classification, attention };
  }

  ingest(raw, source = 'webhook', opts = {}) {
    const s = this.getSettings();
    const n = normalize(raw, source, opts.defaults || {});
    const c = classify(n, s);
    const item = {
      ...n,
      emotion: c.emotion,
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

    // Attention Gatekeeper
    const decision = opts.bypassAttention
      ? { action: 'show', reason: 'manual_test', priority: item.priority || 'normal', category: 'test', silent: false, motion: 'full', mode: 'none' }
      : this.attention.decide(item);
    item.priority = decision.priority;
    item.category = decision.category;
    item.silent = decision.silent;
    item.motion = decision.motion;
    item.attentionReason = decision.reason;
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
    // Burst grouping from the same app into one summary card.
    const sameApp = this.queue.filter(q => q.app === item.app && !q.group);
    if (sameApp.length + 1 >= s.notifications.groupThreshold) {
      const members = [...sameApp.flatMap(q => q.members || [q]), item];
      this.queue = this.queue.filter(q => !(q.app === item.app && !q.group));
      const existing = this.queue.find(q => q.group && q.app === item.app);
      if (existing) {
        existing.members.push(item);
        existing.title = `${existing.members.length} thông báo mới từ ${item.app}`;
        existing.message = existing.members.slice(-3).map(m => `• ${m.title}`).join('\n');
      } else {
        this.queue.push({
          ...item,
          id: 'g_' + item.id,
          group: true,
          members,
          title: `${members.length} thông báo mới từ ${item.app}`,
          message: members.slice(-3).map(m => `• ${m.title}`).join('\n')
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
    if (this.current || this.queue.length === 0) return;
    const item = this.queue.shift();
    this.current = item;
    this.lastEmotion = item.emotion;
    this.stats.displayed++;
    this.stats.byEmotion[item.emotion] = (this.stats.byEmotion[item.emotion] || 0) + 1;
    this.emit('display', item);
    clearTimeout(this.safetyTimer);
    this.safetyTimer = setTimeout(() => this.finished(item.id), item.duration + 60000);
    if (this.safetyTimer.unref) this.safetyTimer.unref();
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
