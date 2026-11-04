/**
 * Attention Management Engine (Blueprint V3.2 §7–8)
 * -------------------------------------------------
 * Decides, for every normalized + classified notification, whether it may
 * interrupt the user right now:
 *
 *   show   → card + pet reaction (optionally silent / reduced motion)
 *   inbox  → stored in the Inbox, no popup, no sound
 *
 * Inputs: 4 priority levels, presence (full / minimal / hidden), focus modes
 * (work / focus / meeting / gaming / relax / sleep), quiet hours, DND, per-app
 * mute and per-app cooldown (rate limit). Explicit user modes always win.
 */

const PRIORITIES = Object.freeze(['critical', 'important', 'normal', 'low']);
const PRIORITY_RANK = Object.freeze({ critical: 4, important: 3, normal: 2, low: 1 });

const FOCUS_MODES = Object.freeze({
  none:    { id: 'none',    emoji: '🐾', minPriority: 'normal',    sound: true,  motion: 'full',    petEmotion: null,       blockCategories: [] },
  work:    { id: 'work',    emoji: '💼', minPriority: 'normal',    sound: true,  motion: 'full',    petEmotion: null,       blockCategories: ['social', 'entertainment', 'promotion'] },
  focus:   { id: 'focus',   emoji: '🎯', minPriority: 'critical',  sound: false, motion: 'reduced', petEmotion: 'thinking', blockCategories: [] },
  meeting: { id: 'meeting', emoji: '📅', minPriority: 'important', sound: false, motion: 'reduced', petEmotion: 'sleeping', blockCategories: ['social', 'entertainment', 'promotion'] },
  gaming:  { id: 'gaming',  emoji: '🎮', minPriority: 'critical',  sound: false, motion: 'reduced', petEmotion: null,       blockCategories: [], hidePet: true },
  relax:   { id: 'relax',   emoji: '🌿', minPriority: 'low',       sound: true,  motion: 'full',    petEmotion: null,       blockCategories: [] },
  sleep:   { id: 'sleep',   emoji: '🌙', minPriority: 'critical',  sound: false, motion: 'reduced', petEmotion: 'sleeping', blockCategories: [] }
});

const CATEGORY_BY_APP = Object.freeze({
  slack: 'chat', teams: 'chat', zalo: 'social', messenger: 'social', discord: 'social',
  facebook: 'social', instagram: 'social', youtube: 'entertainment', spotify: 'entertainment',
  netflix: 'entertainment', steam: 'entertainment', github: 'dev', gitlab: 'dev', jira: 'dev',
  calendar: 'calendar', outlook: 'mail', gmail: 'mail', notion: 'docs', system: 'system'
});

const LOW_KEYWORDS = ['khuyến mãi', 'giảm giá', 'promo', 'promotion', 'newsletter', 'bản tin', 'sale', 'voucher', 'unsubscribe', 'digest'];

function normalizePriority(v) {
  const p = String(v || '').toLowerCase();
  if (PRIORITY_RANK[p]) return p;
  if (['urgent', 'emergency', 'p0', 'sev1'].includes(p)) return 'critical';
  if (['high', 'p1'].includes(p)) return 'important';
  if (['medium', 'default', 'p2'].includes(p)) return 'normal';
  if (['quiet', 'p3', 'p4'].includes(p)) return 'low';
  return null;
}

/** Derive the priority of a notification when the sender did not provide one. */
function derivePriority(n) {
  const explicit = normalizePriority(n.priority);
  if (explicit) return explicit;
  if (n.contactGroup === 'manager' || n.contactGroup === 'important') return 'important';
  const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
  if (LOW_KEYWORDS.some(k => text.includes(k))) return 'low';
  const emotion = n.contentEmotion || n.emotion; // content, not the attitude's display emotion
  if (emotion === 'surprised' && n.app === 'system') return 'critical';
  if (n.app === 'calendar' || emotion === 'angry') return 'important';
  if (n.app === 'slack' && /nhắn riêng|direct|📣|@/.test(n.title || '')) return 'important';
  return 'normal';
}

function categoryOf(n) {
  if (n.category) return String(n.category).toLowerCase();
  const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
  if (LOW_KEYWORDS.some(k => text.includes(k))) return 'promotion';
  return CATEGORY_BY_APP[n.app] || 'other';
}

function minutesOfDay(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + m;
}

function inQuietHours(dnd, date = new Date()) {
  if (!dnd || !dnd.quietHoursEnabled) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  const s = minutesOfDay(dnd.quietStart);
  const e = minutesOfDay(dnd.quietEnd);
  return s <= e ? (now >= s && now < e) : (now >= s || now < e);
}

/** The effective operating mode: explicit focus mode > DND toggle > quiet hours > none. */
function effectiveMode(settings, date = new Date()) {
  const sys = settings.system || {};
  if (sys.focusMode && sys.focusMode !== 'none' && FOCUS_MODES[sys.focusMode]) return { ...FOCUS_MODES[sys.focusMode], source: 'manual' };
  if (settings.dnd && settings.dnd.enabled) return { ...FOCUS_MODES.sleep, source: 'dnd' };
  if (inQuietHours(settings.dnd, date)) return { ...FOCUS_MODES.sleep, source: 'quiet_hours' };
  return { ...FOCUS_MODES.none, source: 'default' };
}

class AttentionEngine {
  constructor({ getSettings, now = () => Date.now() }) {
    this.getSettings = getSettings;
    this.now = now;
    this.recentByApp = new Map(); // app -> [timestamps shown]
  }

  mode() { return effectiveMode(this.getSettings(), new Date(this.now())); }

  /**
   * @param {object} n  normalized + classified item ({app, priority, emotion, title, ...})
   * @returns {{action:'show'|'inbox', reason:string, priority:string, category:string, silent:boolean, motion:'full'|'reduced', mode:string}}
   */
  decide(n) {
    const s = this.getSettings();
    const a = s.attention || {};
    const priority = derivePriority(n);
    const category = categoryOf(n);
    const mode = this.mode();
    const presence = (s.system && s.system.presence) || 'full';
    const base = { priority, category, mode: mode.id, modeSource: mode.source, silent: !mode.sound, motion: mode.motion };
    const critical = priority === 'critical' && a.criticalBypass !== false;

    if ((a.mutedApps || []).includes(n.app) && !critical) return { ...base, action: 'inbox', reason: 'app_muted' };
    if (n.contactGroup === 'ignored' && !critical) return { ...base, action: 'inbox', reason: 'contact_ignored' };
    if (presence === 'hidden' && !critical) return { ...base, action: 'inbox', reason: 'presence_hidden' };
    if (mode.hidePet && !critical) return { ...base, action: 'inbox', reason: `mode_${mode.id}` };
    if (mode.blockCategories.includes(category) && !critical) return { ...base, action: 'inbox', reason: `mode_${mode.id}_blocks_${category}` };
    if (PRIORITY_RANK[priority] < PRIORITY_RANK[mode.minPriority] && !critical) return { ...base, action: 'inbox', reason: `mode_${mode.id}_min_${mode.minPriority}` };
    if (priority === 'low' && a.lowToInbox !== false && mode.id !== 'relax') return { ...base, action: 'inbox', reason: 'low_priority' };

    // Per-app cooldown (rate limit), critical bypasses it.
    if (!critical && n.contactGroup !== 'important') {
      const windowMs = (a.cooldownWindowSec ?? 10) * 1000;
      const limit = a.cooldownCount ?? 3;
      const now = this.now();
      const list = (this.recentByApp.get(n.app) || []).filter(t => now - t < windowMs);
      if (windowMs > 0 && list.length >= limit) {
        this.recentByApp.set(n.app, list);
        return { ...base, action: 'inbox', reason: 'cooldown' };
      }
      list.push(now);
      this.recentByApp.set(n.app, list);
    }

    if (presence === 'minimal') return { ...base, action: 'show', reason: 'presence_minimal', motion: 'reduced' };
    if (critical && (mode.id !== 'none')) return { ...base, action: 'show', reason: 'critical_bypass', silent: false };
    return { ...base, action: 'show', reason: 'allowed' };
  }
}

module.exports = { AttentionEngine, FOCUS_MODES, PRIORITIES, PRIORITY_RANK, derivePriority, normalizePriority, categoryOf, effectiveMode, inQuietHours };
