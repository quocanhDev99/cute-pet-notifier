/**
 * Settings Store — persistent JSON settings in the OS user-data directory.
 * Unknown keys are dropped and every value is type-checked against defaults,
 * so the HTTP/IPC layers can pass user input straight to `update()`.
 */
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { POSITIONS, PRESENTATION_MODES, COMPANION_MODE_AVAILABLE, isEmotion } = require('../shared/emotion-constants');
const { PERSONALITY_PRESETS } = require('./emotion-engine');

const DEFAULT_SETTINGS = Object.freeze({
  activePet: 'cat_mochi',
  personality: 'sweet_friendly',
  customRules: [],
  // Familiar contacts — set by the user, never guessed:
  // [{ id, name, kind: person|chat, app|null, targetId|null, group, label|null, emotion|null,
  //    attention: auto|important|normal|silent|inbox, enabled, createdAt, updatedAt }]
  contacts: [],
  // Per-relationship policy: { [group]: { quietEnabled, quietStart, quietEnd, afterHours, digest } }
  relationships: {},
  appRules: {},
  keywordRules: [],
  notifications: {
    // Mode A/B (Blueprint V4.1 §0/§2) — source of truth for the adapters' suppress flags:
    //   replace   = Mode A: the pet replaces the system banners (they are switched off);
    //   companion = Mode B: system banners stay untouched, the pet keeps them company.
    // Not to be confused with presentationMode (the card style).
    bannerMode: COMPANION_MODE_AVAILABLE ? 'companion' : 'replace', // Mode 1 is "coming soon" while the flag is off
    companionSound: false, // Mode B: the system banner already made a sound — the pet stays quiet
    // Mode B: an event that already has a system banner gets the pet only (no duplicate card).
    // true = also show the pet's card (the 3.6.0 behaviour). docs/product/notifications/NOTIFICATION_MODE_REDESIGN_SPEC.md
    companionCard: false,
    presentationMode: 'cling', // "Ôm bảng (Cling)" — Concept v2 default (existing settings files keep theirs)
    cardLayout: 'compact',     // compact (≈340 px, 1-line title, 2-line body, ≤ 2 actions) | expanded
    theme: 'pastel',
    size: 'md',
    cardScale: 1,
    duration: 9000,
    maxQueue: 20,
    dedupeSeconds: 30,
    groupThreshold: 3
  },
  appearance: {
    position: 'bottom-right',
    margin: 24,
    displayId: 0,
    residentPet: true,
    petScale: 1,
    dragEnabled: true,
    customPosition: { x: null, y: null },
    language: 'vi',
    uiTheme: 'lavender', // UI/UX v2.0 pastel-glass default (existing settings files keep their colour)
    cardFollowsTheme: true,
    showBadge: true, // unread counter bubble on the pet
    petOpacity: 1,          // the pet only — cards always stay fully opaque
    petClickThrough: false  // the pet ignores the mouse (no petting / dragging); cards stay clickable
  },
  sounds: {
    enabled: true,
    volume: 0.7, // MASTER_UIUX_SPEC_V2 §4.5 (existing settings files keep theirs)
    petSensitivity: 1,
    animationIntensity: 1,
    reducedMotion: 'system',
    // Fixed spoken lines (break reminder, pick-up/drop) through the OS speech voice. Opt-in
    // (Blueprint V4.1 §8.5): the pet's identity is its own non-verbal sounds, not a TTS voice.
    // Settings files that already saved `true` keep it.
    voice: false,
    // The pet's recorded voice (assets/pets/{id}/sounds, CC0) instead of the synthesized one.
    recordedVoices: true,
    // Per-channel volume on top of `volume` (docs/character-production/08).
    channels: { vocal: 1, interaction: 1, notification: 1 }
  },
  attention: {
    criticalBypass: true,
    lowToInbox: true,
    cooldownCount: 3,
    cooldownWindowSec: 10,
    mutedApps: [],
    persistInbox: true,
    inboxLimit: 200
  },
  dnd: {
    enabled: false,
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00'
  },
  privacy: {
    keepHistory: true,
    historyLimit: 100,
    displayMode: 'full_content',
    hiddenApps: [],
    learnContacts: true, // remember chat/sender NAMES seen in notifications for the "Người quen" picker
    adaptiveMemory: true // the pet adapts to someone's habits (metadata only: frequency, importance)
  },
  system: {
    autoLaunch: false,
    focusMode: 'none',
    advancedMode: false,
    presence: 'full'
  },
  mood: {
    followAttitude: true, // every notification is answered in the chosen attitude's emotion
    enabled: true,
    sensitivity: 'medium'
  },
  chat: {
    mode: 'all',
    names: [],
    includeDirect: true
  },
  wellbeing: {
    breakReminder: true,
    breakEveryMinutes: 60,
    breakMinutes: 5
  },
  // Opt-in Pomodoro timer (src/core/pomodoro.js). Runtime state is not persisted.
  pomodoro: {
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLong: 4,
    quietDuringFocus: true, // focus phase = "Tập trung sâu" attention (critical only)
    autoContinue: true      // start the next phase by itself
  },
  integrations: {
    composioUserId: '',
    pollSeconds: 120,
    apps: []
  },
  adapters: {
    webhook: { enabled: true },
    gateway: { enabled: false, url: '' },
    // suppressNativeBanner / suppressNativeToast are DERIVED from notifications.bannerMode (see
    // syncBannerMode) — kept because the adapters and older settings files use them.
    macos_nc: { enabled: true, suppressNativeBanner: false, skipConnectedSlack: true, skipAppleSystem: true },
    windows_nc: { enabled: true, suppressNativeToast: false, skipSystemUpdates: false },
    github: { enabled: false, pollSeconds: 60, participatingOnly: true },
    calendar: { enabled: false, leadMinutes: 5, pollMinutes: 10 },
    slack: { enabled: false, notifyOn: 'mentions' },
    system: { enabled: true, battery: true, lockScreen: true, thermal: true }
  }
});

const BANNER_MODES = Object.freeze(['replace', 'companion']);

const ENUMS = {
  'notifications.bannerMode': BANNER_MODES,
  'notifications.presentationMode': PRESENTATION_MODES,
  'notifications.cardLayout': ['compact', 'expanded'],
  'notifications.theme': ['pastel', 'minimal', 'dark', 'glass', 'acrylic'],
  'notifications.size': ['sm', 'md', 'lg'],
  'appearance.position': POSITIONS,
  'appearance.language': ['vi', 'en'],
  'chat.mode': ['all', 'mentions'],
  'privacy.displayMode': ['full_content', 'masked', 'source_only', 'anonymous_source_only'],
  'mood.sensitivity': ['low', 'medium', 'high'],
  'appearance.uiTheme': ['peach', 'mint', 'lavender', 'ocean', 'sunset', 'midnight'],
  'system.focusMode': ['none', 'work', 'focus', 'meeting', 'gaming', 'relax', 'sleep'],
  'system.presence': ['full', 'minimal', 'hidden'],
  'sounds.reducedMotion': ['system', 'on', 'off'],
  'adapters.slack.notifyOn': ['mentions', 'dm', 'all'],
  personality: Object.keys(PERSONALITY_PRESETS),
  activePet: ['cat_mochi', 'dog_boba', 'bunny_cloud', 'penguin_pip']
};

const RANGES = {
  'notifications.duration': [3000, 60000],
  'notifications.cardScale': [0.8, 1.5],
  'integrations.pollSeconds': [60, 900],
  'wellbeing.breakEveryMinutes': [20, 240],
  'wellbeing.breakMinutes': [1, 30],
  'appearance.petOpacity': [0.3, 1],
  'pomodoro.focusMinutes': [5, 120],
  'pomodoro.breakMinutes': [1, 60],
  'pomodoro.longBreakMinutes': [5, 90],
  'pomodoro.cyclesBeforeLong': [2, 8],
  'notifications.maxQueue': [1, 100],
  'notifications.dedupeSeconds': [0, 600],
  'notifications.groupThreshold': [2, 50],
  'appearance.margin': [0, 200],
  'appearance.displayId': [0, Number.MAX_SAFE_INTEGER],
  'appearance.petScale': [0.6, 1.6],
  'sounds.volume': [0, 1],
  'sounds.channels.vocal': [0, 1],
  'sounds.channels.interaction': [0, 1],
  'sounds.channels.notification': [0, 1],
  'sounds.petSensitivity': [0.3, 3],
  'sounds.animationIntensity': [0.3, 2],
  'privacy.historyLimit': [0, 1000],
  'attention.cooldownCount': [1, 50],
  'attention.cooldownWindowSec': [0, 600],
  'attention.inboxLimit': [10, 2000],
  'adapters.github.pollSeconds': [60, 3600],
  'adapters.calendar.leadMinutes': [0, 120],
  'adapters.calendar.pollMinutes': [5, 240]
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function sanitizeCustomRules(list) {
  if (!Array.isArray(list)) return undefined;
  return list.slice(0, 200).map((r, i) => ({
    id: String(r && r.id || `rule_${Date.now()}_${i}`).slice(0, 64),
    name: String(r && r.name || '').slice(0, 80),
    enabled: r && r.enabled !== false,
    field: ['any', 'title', 'message', 'app'].includes(r && r.field) ? r.field : 'any',
    match: ['contains', 'equals', 'regex'].includes(r && r.match) ? r.match : 'contains',
    pattern: String(r && r.pattern || '').slice(0, 200),
    emotion: isEmotion(r && r.emotion) ? r.emotion : 'happy'
  })).filter(r => r.pattern);
}

function sanitizeAppRules(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(obj).slice(0, 100)) {
    const key = String(k).toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40);
    if (key && (isEmotion(v) || v === null)) out[key] = v;
  }
  return out;
}

function sanitizeKeywordRules(list) {
  if (!Array.isArray(list)) return undefined;
  return list.slice(0, 20).filter(r => r && isEmotion(r.emotion)).map(r => ({
    emotion: r.emotion,
    keywords: (Array.isArray(r.keywords) ? r.keywords : [])
      .map(k => String(k).trim().toLowerCase().slice(0, 60)).filter(Boolean).slice(0, 100)
  }));
}

/** Recursively merge `patch` into `base`, keeping only keys/types present in `defaults`. */
function mergeValidated(base, patch, defaults, prefix = '') {
  const out = clone(base);
  if (!patch || typeof patch !== 'object') return out;
  for (const key of Object.keys(defaults)) {
    if (!(key in patch)) continue;
    const dPath = prefix ? `${prefix}.${key}` : key;
    const def = defaults[key];
    const val = patch[key];

    if (dPath === 'customRules') { const v = sanitizeCustomRules(val); if (v) out[key] = v; continue; }
    if (dPath === 'appRules') { const v = sanitizeAppRules(val); if (v) out[key] = v; continue; }
    if (dPath === 'keywordRules') { const v = sanitizeKeywordRules(val); if (v) out[key] = v; continue; }
    if (dPath === 'integrations.apps') {
      if (Array.isArray(val)) {
        out[key] = val.slice(0, 200).filter(a => a && typeof a === 'object' && a.toolkit).map(a => ({
          provider: ['composio'].includes(a.provider) ? a.provider : 'composio',
          toolkit: String(a.toolkit).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60),
          name: String(a.name || a.toolkit).slice(0, 80),
          logo: /^https:\/\//.test(String(a.logo || '')) ? String(a.logo).slice(0, 500) : '',
          connectedAccountId: String(a.connectedAccountId || '').slice(0, 80),
          status: ['pending', 'active', 'expired', 'error'].includes(a.status) ? a.status : 'pending',
          triggers: Array.isArray(a.triggers) ? a.triggers.slice(0, 30).map(t => ({ slug: String(t.slug || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 100), instanceId: String(t.instanceId || '').slice(0, 80), name: String(t.name || '').slice(0, 120) })).filter(t => t.slug) : [],
          addedAt: Number(a.addedAt) || Date.now()
        }));
      }
      continue;
    }
    if (dPath === 'privacy.hiddenApps') {
      if (Array.isArray(val)) out[key] = [...new Set(val.map(v => String(v).toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40)).filter(Boolean))].slice(0, 100);
      continue;
    }
    if (dPath === 'chat.names') {
      if (Array.isArray(val)) out[key] = [...new Set(val.map(v => String(v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40)).filter(Boolean))].slice(0, 10);
      continue;
    }
    if (dPath === 'contacts') {
      const { CONTACT_GROUPS } = require('./chat-filter');
      const { CONTACT_ATTENTION } = require('./contact-rules');
      const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
      if (Array.isArray(val)) {
        const now = Date.now();
        const seen = new Set();
        out[key] = val.slice(0, 300).filter(c => c && CONTACT_GROUPS[c.group]).reverse().map(c => ({
          id: /^[a-z0-9_-]{4,40}$/i.test(String(c.id || '')) ? String(c.id) : `c_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          name: clean(c.name, 80),
          kind: c.kind === 'chat' ? 'chat' : 'person',
          app: c.app ? String(c.app).toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40) || null : null,
          targetId: c.targetId ? clean(c.targetId, 200) : null,
          group: c.group,
          label: c.group === 'other' && c.label ? clean(c.label, 40) : null,
          emotion: isEmotion(c.emotion) ? c.emotion : null,
          attention: CONTACT_ATTENTION[c.attention] ? c.attention : 'auto',
          enabled: c.enabled !== false,
          createdAt: Number(c.createdAt) || now,
          updatedAt: Number(c.updatedAt) || now
        })).filter(c => {
          // One rule per (app, kind, name): the later one wins.
          const k = `${c.app || '*'}|${c.kind}|${c.name.toLowerCase()}`;
          if (!c.name || seen.has(k)) return false;
          seen.add(k);
          return true;
        }).reverse();
      }
      continue;
    }
    if (dPath === 'relationships') {
      const { CONTACT_GROUPS } = require('./chat-filter');
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const hhmm = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : d);
        const next = { ...(out[key] || {}) };
        for (const [g, r] of Object.entries(val)) {
          if (!CONTACT_GROUPS[g] || !r || typeof r !== 'object') continue;
          const prev = next[g] || {};
          next[g] = {
            quietEnabled: 'quietEnabled' in r ? !!r.quietEnabled : !!prev.quietEnabled,
            quietStart: hhmm(r.quietStart, prev.quietStart || '18:00'),
            quietEnd: hhmm(r.quietEnd, prev.quietEnd || '08:00'),
            afterHours: 'afterHours' in r ? !!r.afterHours : !!prev.afterHours,
            digest: 'digest' in r ? !!r.digest : !!prev.digest
          };
        }
        out[key] = next;
      }
      continue;
    }
    if (dPath === 'attention.mutedApps') {
      if (Array.isArray(val)) out[key] = [...new Set(val.map(v => String(v).toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40)).filter(Boolean))].slice(0, 100);
      continue;
    }
    if (dPath === 'appearance.customPosition') {
      if (val && typeof val === 'object') {
        if (val.x === null && val.y === null) out[key] = { x: null, y: null };
        else if (Number.isFinite(val.x) && Number.isFinite(val.y)) out[key] = { x: Math.round(val.x), y: Math.round(val.y) };
      }
      continue;
    }

    if (def && typeof def === 'object' && !Array.isArray(def)) {
      out[key] = mergeValidated(out[key] || def, val, def, dPath);
      continue;
    }
    if (typeof def === 'boolean') { if (typeof val === 'boolean') out[key] = val; continue; }
    if (typeof def === 'number') {
      const n = Number(val);
      if (!Number.isFinite(n)) continue;
      const [min, max] = RANGES[dPath] || [-Infinity, Infinity];
      out[key] = Math.min(max, Math.max(min, n));
      continue;
    }
    if (typeof def === 'string') {
      if (typeof val !== 'string') continue;
      if (ENUMS[dPath] && !ENUMS[dPath].includes(val)) continue;
      if ((dPath === 'dnd.quietStart' || dPath === 'dnd.quietEnd') && !TIME_RE.test(val)) continue;
      out[key] = val.slice(0, 200);
    }
  }
  return out;
}

/**
 * Keep notifications.bannerMode and the adapters' legacy suppress flags in agreement.
 * `patch` tells which side the user just changed: bannerMode wins when it is in the patch; otherwise
 * a suppress flag that was explicitly set (e.g. the adapter's own toggle) switches the mode.
 * Returns a new settings object.
 */
function syncBannerMode(data, patch = null, companionAvailable = COMPANION_MODE_AVAILABLE) {
  const out = clone(data);
  const pn = patch && patch.notifications;
  const pa = patch && patch.adapters;
  if (!(pn && BANNER_MODES.includes(pn.bannerMode)) && pa) {
    const flag = [pa.windows_nc && pa.windows_nc.suppressNativeToast, pa.macos_nc && pa.macos_nc.suppressNativeBanner]
      .find(v => typeof v === 'boolean');
    if (flag !== undefined) out.notifications.bannerMode = flag ? 'replace' : 'companion';
  }
  // Mode 1 switched off ("Sắp ra mắt"): only Mode 2 can be stored or applied.
  if (!companionAvailable && out.notifications.bannerMode === 'companion') out.notifications.bannerMode = 'replace';
  const replace = out.notifications.bannerMode === 'replace';
  out.adapters.windows_nc.suppressNativeToast = replace;
  out.adapters.macos_nc.suppressNativeBanner = replace;
  return out;
}

/**
 * Settings files written before bannerMode existed: keep what the user had. The suppress flag of
 * THIS platform decides (it used to default to true = Mode A), so an update never silently changes
 * how notifications appear. Fresh installs get the new default (companion).
 */
function legacyBannerMode(raw, platform = process.platform) {
  const a = (raw && raw.adapters) || {};
  const flag = platform === 'darwin'
    ? a.macos_nc && a.macos_nc.suppressNativeBanner
    : a.windows_nc && a.windows_nc.suppressNativeToast;
  return flag === false ? 'companion' : 'replace';
}

class SettingsStore extends EventEmitter {
  constructor(dir, { platform = process.platform, companionAvailable = COMPANION_MODE_AVAILABLE } = {}) {
    super();
    this.companionAvailable = companionAvailable;
    this.file = path.join(dir, 'settings.json');
    this.data = clone(DEFAULT_SETTINGS);
    try {
      if (fs.existsSync(this.file)) {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        const migrate = !(raw && raw.notifications && BANNER_MODES.includes(raw.notifications.bannerMode));
        this.data = mergeValidated(DEFAULT_SETTINGS, raw, DEFAULT_SETTINGS);
        if (migrate) {
          this.data.notifications.bannerMode = legacyBannerMode(raw, platform);
          this.data = syncBannerMode(this.data, null, companionAvailable);
          this.save();
        }
      }
    } catch (err) {
      console.warn('[Settings] Could not read settings, using defaults:', err.message);
    }
    if (companionAvailable && !(fs.existsSync(this.file))) this.data.notifications.bannerMode = 'companion';
    this.data = syncBannerMode(this.data, null, companionAvailable);
  }

  get() { return clone(this.data); }

  update(patch) {
    this.data = syncBannerMode(mergeValidated(this.data, patch, DEFAULT_SETTINGS), patch, this.companionAvailable);
    this.save();
    this.emit('change', this.get());
    return this.get();
  }

  reset() {
    this.data = clone(DEFAULT_SETTINGS);
    this.save();
    this.emit('change', this.get());
    return this.get();
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[Settings] Save failed:', err.message);
    }
  }
}

module.exports = { SettingsStore, DEFAULT_SETTINGS, mergeValidated, syncBannerMode, legacyBannerMode, BANNER_MODES };
