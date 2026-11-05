/**
 * Contact rules — how a notification from a familiar person / chat is treated (Blueprint §5.3).
 *
 * Priority (highest first):
 *   1. a rule for that PERSON            (contacts[kind=person])
 *   2. a rule for that GROUP CHAT        (contacts[kind=chat])
 *   3. the RELATIONSHIP's policy         (settings.relationships[group]: own hours, digest, after-hours)
 *   4. app rules  5. general rules  6. defaults   — handled by the emotion / attention engines
 * plus, when the user allows it, the pet's ADAPTIVE MEMORY (metadata only: how often someone writes
 * and how often their messages were important) — it never overrides an explicit setting.
 *
 * The pet never guesses who someone is: every rule here was created by the user.
 */
const { contactOf, CONTACT_GROUPS } = require('./chat-filter');

/** What the user can pick as "Hành vi" for one person/chat. */
const CONTACT_ATTENTION = Object.freeze({
  auto: { label: 'Theo mối quan hệ' },
  important: { label: 'Ưu tiên thông báo', priority: 'important' },
  normal: { label: 'Bình thường', priority: 'normal' },
  silent: { label: 'Hiện nhẹ nhàng, không kêu', silent: true },
  inbox: { label: 'Im lặng, chỉ lưu vào Hộp thư', inbox: true }
});

/** Default per-relationship policies (all opt-in except what the group itself implies). */
const DEFAULT_RELATIONSHIP_POLICY = Object.freeze({
  quietEnabled: false, // own hours: outside them → Inbox
  quietStart: '18:00',
  quietEnd: '08:00',
  afterHours: false, // show even during the global quiet hours / DND schedule
  digest: false // always collect into the Inbox digest instead of a popup
});

const mins = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
function inWindow(start, end, date) {
  const now = date.getHours() * 60 + date.getMinutes();
  const s = mins(start), e = mins(end);
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

function relationshipPolicy(settings, group) {
  const r = (settings && settings.relationships && settings.relationships[group]) || {};
  return { ...DEFAULT_RELATIONSHIP_POLICY, ...r };
}

/**
 * @param {object} item     normalized notification (full content, before privacy projection)
 * @param {object} settings
 * @param {{directory?: import('./contact-directory').ContactDirectory, date?: Date}} [opts]
 * @returns {null | {
 *   contact: object|null, group: string|null, layer: 'person'|'chat'|'memory',
 *   priority?: string, inbox?: boolean, silent?: boolean, bypassCooldown?: boolean,
 *   afterHours?: boolean, reason?: string, note?: string }}
 */
function contactPolicy(item, settings = {}, { directory = null, date = new Date() } = {}) {
  const contact = contactOf(item, settings.contacts);
  if (contact) {
    const rel = CONTACT_GROUPS[contact.group] || {};
    const pol = relationshipPolicy(settings, contact.group);
    const att = CONTACT_ATTENTION[contact.attention] ? contact.attention : 'auto';
    const out = { contact, group: contact.group, layer: contact.kind === 'chat' ? 'chat' : 'person', afterHours: !!pol.afterHours, bypassCooldown: !!rel.bypassCooldown };
    if (rel.inbox) return { ...out, inbox: true, reason: 'contact_ignored' };
    if (att !== 'auto') {
      // The user's choice for THIS person/chat beats the relationship's own hours/digest.
      const a = CONTACT_ATTENTION[att];
      if (a.inbox) return { ...out, inbox: true, reason: 'contact_inbox' };
      if (a.priority) out.priority = a.priority;
      if (a.silent) out.silent = true;
      if (att === 'important') { out.afterHours = true; out.bypassCooldown = true; }
      return out;
    }
    if (rel.priority) out.priority = rel.priority;
    if (pol.digest) return { ...out, inbox: true, reason: 'relationship_digest' };
    if (pol.quietEnabled && inWindow(pol.quietStart, pol.quietEnd, date)) return { ...out, inbox: true, reason: 'relationship_hours' };
    return out;
  }
  // No explicit rule: adaptive memory (metadata only, opt-out in Settings).
  const memoryOn = !(settings.privacy && settings.privacy.adaptiveMemory === false);
  if (memoryOn && directory) {
    const hint = directory.insight(item);
    if (hint && hint.importantSender) return { contact: null, group: null, layer: 'memory', priority: 'important', note: 'important_sender' };
    if (hint && hint.busyChat) return { contact: null, group: null, layer: 'memory', silent: true, note: 'busy_chat' };
  }
  return null;
}

module.exports = { contactPolicy, relationshipPolicy, inWindow, CONTACT_ATTENTION, DEFAULT_RELATIONSHIP_POLICY };
