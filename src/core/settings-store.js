/**
 * Settings Store — persistent JSON settings in the OS user-data directory.
 * Unknown keys are dropped and every value is type-checked against defaults,
 * so the HTTP/IPC layers can pass user input straight to `update()`.
 */
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { POSITIONS, PRESENTATION_MODES, isEmotion } = require('../shared/emotion-constants');
const { PERSONALITY_PRESETS } = require('./emotion-engine');

const DEFAULT_SETTINGS = Object.freeze({
  activePet: 'cat_mochi',
  personality: 'sweet_friendly',
  customRules: [],
  appRules: {},
  keywordRules: [],
  notifications: {
    presentationMode: 'billboard',
    theme: 'pastel',
    size: 'md',
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
    language: 'vi'
  },
  sounds: {
    enabled: true,
    volume: 0.45,
    petSensitivity: 1,
    animationIntensity: 1,
    reducedMotion: 'system'
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
    historyLimit: 100
  },
  system: {
    autoLaunch: false,
    focusMode: 'none',
    presence: 'full'
  },
  adapters: {
    webhook: { enabled: true },
    gateway: { enabled: false, url: '' },
    macos_nc: { enabled: true, suppressNativeBanner: true, skipConnectedSlack: true, skipAppleSystem: true }, // the app's purpose on macOS: replace system banners
    github: { enabled: false, pollSeconds: 60, participatingOnly: true },
    calendar: { enabled: false, leadMinutes: 5, pollMinutes: 10 },
    slack: { enabled: false, notifyOn: 'mentions' },
    system: { enabled: true, battery: true, lockScreen: true, thermal: true }
  }
});

const ENUMS = {
  'notifications.presentationMode': PRESENTATION_MODES,
  'notifications.theme': ['pastel', 'minimal', 'dark', 'glass', 'acrylic'],
  'notifications.size': ['sm', 'md', 'lg'],
  'appearance.position': POSITIONS,
  'appearance.language': ['vi', 'en'],
  'system.focusMode': ['none', 'work', 'focus', 'meeting', 'gaming', 'relax', 'sleep'],
  'system.presence': ['full', 'minimal', 'hidden'],
  'sounds.reducedMotion': ['system', 'on', 'off'],
  'adapters.slack.notifyOn': ['mentions', 'dm', 'all'],
  personality: Object.keys(PERSONALITY_PRESETS),
  activePet: ['cat_mochi', 'dog_boba', 'bunny_cloud', 'penguin_pip']
};

const RANGES = {
  'notifications.duration': [3000, 60000],
  'notifications.maxQueue': [1, 100],
  'notifications.dedupeSeconds': [0, 600],
  'notifications.groupThreshold': [2, 50],
  'appearance.margin': [0, 200],
  'appearance.displayId': [0, Number.MAX_SAFE_INTEGER],
  'appearance.petScale': [0.6, 1.6],
  'sounds.volume': [0, 1],
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

class SettingsStore extends EventEmitter {
  constructor(dir) {
    super();
    this.file = path.join(dir, 'settings.json');
    this.data = clone(DEFAULT_SETTINGS);
    try {
      if (fs.existsSync(this.file)) {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.data = mergeValidated(DEFAULT_SETTINGS, raw, DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.warn('[Settings] Could not read settings, using defaults:', err.message);
    }
  }

  get() { return clone(this.data); }

  update(patch) {
    this.data = mergeValidated(this.data, patch, DEFAULT_SETTINGS);
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

module.exports = { SettingsStore, DEFAULT_SETTINGS, mergeValidated };
