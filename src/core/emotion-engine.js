/**
 * Emotion & Personality Engine
 * ----------------------------
 * Character-independent. Classifies a NormalizedNotification into one of the
 * 8 canonical emotions following the blueprint rule hierarchy:
 *
 *   1. User custom rules
 *   2. Application rules
 *   3. Keyword rules
 *   4. Notification metadata (priority / urgency / mood / event)
 *   5. Default emotion (from personality preset)
 *
 * A personality preset then adjusts the outcome (remaps, annoyance, motion).
 */

const { EMOTION_IDS, NOTIFICATION_EVENT_MAPPINGS, isEmotion } = require('../shared/emotion-constants');

const PERSONALITY_PRESETS = Object.freeze({
  sweet_friendly: {
    id: 'sweet_friendly',
    name: 'Sweet & Friendly',
    emoji: '🥰',
    description: 'Luôn chào đón, ưu tiên vui vẻ & yêu thương, rất thích được vuốt ve.',
    defaultEmotion: 'happy',
    remap: { },
    annoyingEmotions: ['angry'],
    motionSpeed: 1.0,
    evasionSensitivity: 0.3,
    rejectLines: ['🥺 Mochi đang hơi bực xíu, lát nha!', '😿 Để Mochi bình tĩnh đã...']
  },
  sarcastic_sassy: {
    id: 'sarcastic_sassy',
    name: 'Sarcastic & Sassy',
    emoji: '😏',
    description: 'Hay cà khịa, lườm liếc xéo xắc với tin phiền phức.',
    defaultEmotion: 'thinking',
    remap: { },
    annoyingEmotions: ['angry', 'sleeping', 'surprised', 'sad'],
    motionSpeed: 1.1,
    evasionSensitivity: 0.8,
    rejectLines: ['😒 Ủa? Ai cho sờ?', '🙄 Tự đọc thông báo đi chứ!', '😏 Hứ, mơ đi nhé!']
  },
  grumpy_dramatic: {
    id: 'grumpy_dramatic',
    name: 'Grumpy & Dramatic',
    emoji: '😾',
    description: 'Dễ nổi quạu, phản ứng cực mạnh với deadline và họp hành.',
    defaultEmotion: 'thinking',
    remap: { sleeping: 'angry' },
    annoyingEmotions: ['angry', 'sleeping', 'surprised', 'sad', 'thinking'],
    motionSpeed: 1.35,
    evasionSensitivity: 1.0,
    rejectLines: ['😤 Tránh xa ra, đừng có vuốt ve tui!', '💢 CẤM SỜ! Đang quạu!', '😾 Đi làm việc đi!']
  },
  calm_gentle: {
    id: 'calm_gentle',
    name: 'Calm & Gentle',
    emoji: '🍵',
    description: 'Điềm đạm, cử động chậm rãi, ưu tiên suy tư và vui vẻ nhẹ nhàng.',
    defaultEmotion: 'happy',
    remap: { surprised: 'thinking', angry: 'thinking' },
    annoyingEmotions: [],
    motionSpeed: 0.65,
    evasionSensitivity: 0.2,
    rejectLines: ['🍵 Từ từ thôi nào...']
  },
  energetic_playful: {
    id: 'energetic_playful',
    name: 'Energetic & Playful',
    emoji: '⚡',
    description: 'Tinh nghịch, nhảy nhót, tai và đuôi chuyển động nhanh nhẹn.',
    defaultEmotion: 'excited',
    remap: { thinking: 'excited', sleeping: 'excited' },
    annoyingEmotions: ['angry'],
    motionSpeed: 1.5,
    evasionSensitivity: 0.5,
    rejectLines: ['😝 Bắt được Mochi thì cho sờ!', '🏃 Hehe né rồi!']
  }
});

/** Default application → emotion rules (level 2). `null` means "no opinion". */
const DEFAULT_APP_RULES = Object.freeze({
  slack: 'excited',
  zalo: 'excited',
  teams: 'excited',
  messenger: 'excited',
  zoom: 'sleeping',
  meet: 'sleeping',
  calendar: 'sleeping',
  jira: 'thinking'
});

/** Default keyword rules (level 3), evaluated top to bottom. */
const DEFAULT_KEYWORD_RULES = Object.freeze([
  { emotion: 'love', keywords: ['lương', 'thưởng', 'ting ting', 'crush', 'yêu', 'kudos', 'cảm ơn', 'thank', 'salary', 'bonus', 'approved', 'đã duyệt'] },
  { emotion: 'angry', keywords: ['deadline', 'gấp', 'cháy', 'sếp', 'overdue', 'quá hạn', 'trễ hạn', 'asap', 'urgent'] },
  { emotion: 'sad', keywords: ['lỗi', 'error', 'fail', 'failed', 'thất bại', '500', 'hỏng', 'crash', 'exception', 'bị từ chối', 'rejected'] },
  { emotion: 'sleeping', keywords: ['họp', 'meeting', 'sprint', 'standup', 'stand-up', 'sync', 'review meeting', 'webinar'] },
  { emotion: 'surprised', keywords: ['cảnh báo', 'warning', 'alert', 'khẩn', 'pin yếu', 'battery low', 'security', 'bảo mật'] },
  { emotion: 'thinking', keywords: ['đang tải', 'processing', 'loading', 'đang build', 'pending', 'in progress', 'đang xử lý', 'review requested'] },
  { emotion: 'happy', keywords: ['xong', 'hoàn thành', 'thành công', 'success', 'passed', 'merged', 'deploy done', 'done', 'resolved'] },
  { emotion: 'excited', keywords: ['tin nhắn', 'message', 'mention', 'nhắc đến', 'invite', 'lời mời'] }
]);

const MAX_TEXT = 4000;
const MAX_PATTERN = 200;

function safeRegex(pattern) {
  if (typeof pattern !== 'string' || !pattern || pattern.length > MAX_PATTERN) return null;
  // Reject obviously catastrophic nested quantifiers like (a+)+ / (.*)*
  if (/\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) return null;
  try { return new RegExp(pattern, 'i'); } catch { return null; }
}

function fieldText(notif, field) {
  const title = String(notif.title || '');
  const message = String(notif.message || '');
  const app = String(notif.app || '');
  let text;
  switch (field) {
    case 'title': text = title; break;
    case 'message': text = message; break;
    case 'app': text = app; break;
    default: text = `${title} ${message}`;
  }
  return text.slice(0, MAX_TEXT).toLowerCase();
}

function matchCustomRule(rule, notif) {
  if (!rule || rule.enabled === false || !isEmotion(rule.emotion)) return false;
  const pattern = String(rule.pattern || '').trim();
  if (!pattern) return false;
  const text = fieldText(notif, rule.field || 'any');
  switch (rule.match) {
    case 'equals': return text === pattern.toLowerCase();
    case 'regex': {
      const re = safeRegex(pattern);
      return re ? re.test(text) : false;
    }
    default: return text.includes(pattern.toLowerCase());
  }
}

function matchKeyword(text, keyword) {
  const kw = String(keyword || '').toLowerCase().trim();
  if (!kw) return false;
  // Pure numbers / short ASCII tokens must match as whole words ("500" ≠ "1500").
  if (/^[a-z0-9]{1,4}$/.test(kw)) {
    return new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`).test(text);
  }
  return text.includes(kw);
}

function metadataEmotion(notif) {
  if (notif.event && NOTIFICATION_EVENT_MAPPINGS[String(notif.event).toUpperCase()]) {
    return { emotion: NOTIFICATION_EVENT_MAPPINGS[String(notif.event).toUpperCase()], label: `event=${notif.event}` };
  }
  if (isEmotion(notif.mood)) return { emotion: notif.mood, label: `mood=${notif.mood}` };
  const p = String(notif.priority || notif.urgency || '').toLowerCase();
  if (['urgent', 'critical', 'high'].includes(p)) return { emotion: 'surprised', label: `priority=${p}` };
  if (['low', 'quiet'].includes(p)) return { emotion: 'sleeping', label: `priority=${p}` };
  return null;
}

function getPreset(id) {
  return PERSONALITY_PRESETS[id] || PERSONALITY_PRESETS.sweet_friendly;
}

/**
 * @param {object} notif  Normalized notification {title, message, app, mood, priority, event, forceEmotion}
 * @param {object} cfg    { personality, customRules, appRules, keywordRules }
 * @returns {{emotion:string, matchedBy:string, rule:string, annoying:boolean, personality:string, baseEmotion:string}}
 */
function classify(notif = {}, cfg = {}) {
  const preset = getPreset(cfg.personality);
  const appRules = { ...DEFAULT_APP_RULES, ...(cfg.appRules || {}) };
  const keywordRules = Array.isArray(cfg.keywordRules) && cfg.keywordRules.length ? cfg.keywordRules : DEFAULT_KEYWORD_RULES;

  let result = null;

  // 0. Explicit override from the sender (bypasses all rules and personality).
  if (isEmotion(notif.forceEmotion)) {
    const emotion = notif.forceEmotion;
    return { emotion, baseEmotion: emotion, matchedBy: 'forced', rule: 'forceEmotion', annoying: preset.annoyingEmotions.includes(emotion), personality: preset.id };
  }

  // 1. Custom rules
  for (const rule of cfg.customRules || []) {
    if (matchCustomRule(rule, notif)) {
      result = { emotion: rule.emotion, matchedBy: 'custom', rule: rule.name || `${rule.field || 'any'} ${rule.match || 'contains'} "${rule.pattern}"` };
      break;
    }
  }

  // 2. Application rules
  if (!result) {
    const app = String(notif.app || '').toLowerCase();
    const emo = appRules[app];
    if (isEmotion(emo)) result = { emotion: emo, matchedBy: 'app', rule: `app=${app}` };
  }

  // 3. Keyword rules
  if (!result) {
    const text = fieldText(notif, 'any');
    outer: for (const kr of keywordRules) {
      if (!isEmotion(kr.emotion)) continue;
      for (const kw of kr.keywords || []) {
        if (matchKeyword(text, kw)) {
          result = { emotion: kr.emotion, matchedBy: 'keyword', rule: `keyword "${kw}"` };
          break outer;
        }
      }
    }
  }

  // 4. Metadata
  if (!result) {
    const meta = metadataEmotion(notif);
    if (meta) result = { emotion: meta.emotion, matchedBy: 'metadata', rule: meta.label };
  }

  // 5. Default
  if (!result) result = { emotion: preset.defaultEmotion, matchedBy: 'default', rule: `default (${preset.name})` };

  const baseEmotion = result.emotion;
  // Personality remap never overrides an explicit user custom rule.
  if (result.matchedBy !== 'custom' && preset.remap[baseEmotion]) {
    result.emotion = preset.remap[baseEmotion];
  }

  return {
    ...result,
    baseEmotion,
    annoying: preset.annoyingEmotions.includes(result.emotion),
    personality: preset.id
  };
}

module.exports = {
  PERSONALITY_PRESETS,
  DEFAULT_APP_RULES,
  DEFAULT_KEYWORD_RULES,
  EMOTION_IDS,
  classify,
  getPreset,
  safeRegex
};
