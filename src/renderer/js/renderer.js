/**
 * Overlay renderer — the desktop pet dock + 3D acrylic notification cards.
 * Presentation modes: Billboard Hugger · Peeker · Courier.
 */
import { PetStage } from './pet/pet-stage.js';
import { SoundKit } from './sound.js';
import { EMOTION_SCHEMA } from '../../shared/emotion-constants.js';
import { getSpecies } from './pet/species.js';

const api = window.electronAPI;
const dock = document.getElementById('dock');
const cardSlot = dock.querySelector('.card-slot');
const petSlot = dock.querySelector('.pet-slot');
const stageEl = dock.querySelector('.pet-stage');
const bubbleEl = dock.querySelector('.pet-bubble');
const badgeEl = dock.querySelector('.pet-badge');

const EMO = Object.fromEntries(EMOTION_SCHEMA.map(e => [e.id, e]));
const APP_META = {
  slack: { label: 'Slack', icon: '💬' },
  github: { label: 'GitHub', icon: '🐙' },
  wellbeing: { label: 'Sức khỏe', icon: '💆' },
  bitbucket: { label: 'Bitbucket', icon: '🪣' },
  jira: { label: 'Jira', icon: '🧩' },
  gmail: { label: 'Gmail', icon: '✉️' },
  calendar: { label: 'Lịch', icon: '📅' },
  system: { label: 'Hệ thống', icon: '🖥️' },
  teams: { label: 'Teams', icon: '👥' },
  zalo: { label: 'Zalo', icon: '🔵' },
  messenger: { label: 'Messenger', icon: '💭' },
  mail: { label: 'Mail', icon: '✉️' },
  messages: { label: 'Tin nhắn', icon: '💬' },
  telegram: { label: 'Telegram', icon: '✈️' },
  discord: { label: 'Discord', icon: '🎮' },
  whatsapp: { label: 'WhatsApp', icon: '🟢' },
  outlook: { label: 'Outlook', icon: '📨' },
  zoom: { label: 'Zoom', icon: '🎥' },
  reminders: { label: 'Lời nhắc', icon: '⏰' },
  chrome: { label: 'Chrome', icon: '🌐' },
  safari: { label: 'Safari', icon: '🧭' },
  notion: { label: 'Notion', icon: '📝' },
  macos: { label: 'macOS', icon: '🍎' },
  webhook: { label: 'Webhook', icon: '🪝' },
  test: { label: 'Thử nghiệm', icon: '🧪' },
  default: { label: 'Thông báo', icon: '🔔' }
};

const I18N = {
  vi: {
    close: 'Đóng',
    openUrl: 'Mở ↗',
    openDone: 'Đã xem ✓',
    openChat: 'Mở cuộc chat ↗',
    openApp: 'Mở app ↗',
    kick: '😒 Đá bay!',
    hintAnnoying: '😤 Đang quạu, né ra!',
    hintPet: '🐾 Vuốt đầu bé để cưng nựng',
    dndSleeping: '💤 Đang chế độ không làm phiền…',
    defaultApp: 'Thông báo',
    petLove: ['Purrr~ 💕', 'Hihi nhột quá!', '🥰 Thích ghê!', 'Thêm chút nữa đi~', '✨ Sen giỏi quá!'],
    pickedUp: [
      'Á á buông tui ra!',
      'Sen nhấc tui đi đâu đấy?! 🙀',
      'Thả tui ra mauuu! 🐾',
      'Oái oái lơ lửng rồi!',
      'Bỏ ra cho tui đi tuần tra!'
    ],
    landed: ['Phù, được tiếp đất rồi! 😌', 'Chóng mặt quá sen ơi!', 'Lần sau đừng bế bổng nữa nha!'],
    dizzy: ['Oaaa… quay mòng mòng 😵‍💫', 'Đừng lắc nữa, chóng mặt quá sen ơi!', 'Thế giới đang xoay vòng vòng…'],
    thrown: ['Ui daaa! Ném tui hả?! 😾', 'Wheee~ bay nè!', 'Hạ cánh an toàn… chắc vậy 😅'],
    kickQuip: 'Hứ! Biến đi! 🦶',
    reject: ['😤 Tránh xa ra, đừng có vuốt ve tui!'],
    kickTitle: 'Thú cưng sẽ đá văng thông báo này',
    voiceBreak: ['Bạn ơi, mình nghỉ mắt một chút nha!', 'Nhìn màn hình lâu rồi đó, cho mắt nghỉ xíu nhé!', 'Ê, tới giờ nghỉ mắt rồi nè!'], voiceBreakStart: ['Nhắm mắt thư giãn nào, bé canh giờ cho bạn nhé.', 'Nhìn ra xa một chút, hít thở thật sâu nào.'], voiceBreakDone: ['Xong rồi! Mắt khỏe re, mình làm tiếp thôi!', 'Hết giờ nghỉ rồi, chiến tiếp nào!'], breakStart: '😌 Nghỉ ngay', breakSnooze: '⏰ 10 phút nữa', breakTick: '😌 Nghỉ mắt nào… {t}', breakTip: ['Nhìn ra xa khoảng 6 m nhé 🌳', 'Chớp mắt chậm vài lần 😌', 'Đứng dậy vươn vai một chút 🙆'], breakDone: '🌟 Mắt khỏe rồi! Làm tiếp thôi', snoozed: '⏰ OK, 10 phút nữa bé nhắc lại', moreRows: '+{n} PR khác — bấm Mở để xem tất cả', approve: '✅ Approve', approveConfirm: 'Bấm lần nữa để approve', approving: '⏳ Đang approve…', approved: '✓ Đã approve', approvedSay: '✅ Đã approve PR giúp bạn!', approveFail: '😿 Approve không được: ',
    priority: { critical: '🚨 Khẩn cấp', important: '⭐ Quan trọng', low: '💤 Ít quan trọng' },
    focusLine: { focus: '🎯 Đang tập trung…', meeting: '📅 Đang họp, suỵt…', work: '💼 Làm việc nghiêm túc nào!', relax: '🌿 Thư giãn thôi~', sleep: '💤 Ngủ ngon…' },
    emo: null,
  },
  en: {
    close: 'Close',
    openUrl: 'Open ↗',
    openDone: 'Mark as read ✓',
    openChat: 'Open chat ↗',
    openApp: 'Open app ↗',
    kick: '😒 Kick away!',
    hintAnnoying: '😤 Grumpy, stay back!',
    hintPet: '🐾 Pet head to cuddle',
    dndSleeping: '💤 Do Not Disturb mode active…',
    defaultApp: 'Notification',
    petLove: ['Purrr~ 💕', 'Hehe that tickles!', '🥰 Feels so good!', 'Pet me more~', '✨ Good human!'],
    pickedUp: [
      'Ahhh put me down!',
      'Where are you taking me?! 🙀',
      'Unhand me, human! 🐾',
      "Whoa I'm floating in mid-air!",
      'Put me down right now!'
    ],
    landed: ['Phew, back on solid ground! 😌', "I'm so dizzy!", "Don't pick me up like that!"],
    dizzy: ['Whoaaa… everything is spinning 😵‍💫', 'Stop shaking me, I’m so dizzy!', 'The world is going round and round…'],
    thrown: ['Ouch! Did you just throw me?! 😾', 'Wheee~ I’m flying!', 'Landed safely… I think 😅'],
    kickQuip: 'Hmph! Begone! 🦶',
    reject: ["😤 Stay back, don't touch me!", '😾 Not now, human!', '🙄 Hands off!'],
    kickTitle: 'Your pet will kick this notification away',
    voiceBreak: ['Hey, let’s rest your eyes for a bit!', 'You’ve been staring at the screen for a while. Eye break time!'], voiceBreakStart: ['Close your eyes and relax, I’ll keep time for you.', 'Look far away and take a deep breath.'], voiceBreakDone: ['All done! Fresh eyes, let’s get back to it!'], breakStart: '😌 Break now', breakSnooze: '⏰ In 10 min', breakTick: '😌 Eye break… {t}', breakTip: ['Look about 6 m away 🌳', 'Blink slowly a few times 😌', 'Stand up and stretch 🙆'], breakDone: '🌟 Eyes refreshed! Back to it', snoozed: '⏰ OK, I’ll remind you in 10 min', moreRows: '+{n} more — press Open to see all', approve: '✅ Approve', approveConfirm: 'Click again to approve', approving: '⏳ Approving…', approved: '✓ Approved', approvedSay: '✅ PR approved for you!', approveFail: '😿 Couldn’t approve: ',
    priority: { critical: '🚨 Critical', important: '⭐ Important', low: '💤 Low' },
    focusLine: { focus: '🎯 Deep focus…', meeting: '📅 In a meeting, shh…', work: '💼 Work mode on!', relax: '🌿 Relax time~', sleep: '💤 Sleeping…' },
    emo: { happy: 'Happy', excited: 'Excited', love: 'Love', surprised: 'Surprised', angry: 'Grumpy', sad: 'Sad', thinking: 'Thinking', sleeping: 'Sleeping' },
    apps: { calendar: 'Calendar', system: 'System', test: 'Test', default: 'Notification' }
  }
};

function getLang() {
  return (cfg && cfg.settings && cfg.settings.appearance && cfg.settings.appearance.language) || 'vi';
}

function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key]) || I18N.vi[key] || '';
}

function randomQuote(key) {
  const list = t(key);
  if (Array.isArray(list) && list.length) return list[Math.floor(Math.random() * list.length)];
  return '';
}

const sound = new SoundKit();
let cfg = null;
let preset = null;
let stage = null;
let current = null; // { item, el, timer, remaining, startedAt, timers, busy }
let pendingCleanup = null; // the previous card's exit animation: { timer, run }
let petOverride = null; // species temporarily shown for a card (item.pet)

/** setTimeout bound to the current card: cancelled when that card finishes or is replaced. */
function cardLater(fn, ms) {
  const c = current;
  if (!c) return;
  const id = setTimeout(() => { if (current === c) fn(); }, ms);
  c.timers.push(id);
}

/** A new card is coming: finish the old card's exit right now so its late cleanup can't clobber it. */
function flushPendingCleanup() {
  if (!pendingCleanup) return;
  const p = pendingCleanup;
  pendingCleanup = null;
  clearTimeout(p.timer);
  p.run(true);
}
let mouseCaptured = false;
let lastCardPress = -1e9;
let dndSleeping = false;
let eff = { presence: 'full', mode: { id: 'none' }, hidden: false, reducedMotion: false };

/** Resting state when no card is shown: depends on presence + focus mode. */
function residentEmotion() {
  if (!cfg) return 'idle';
  if (eff.presence === 'minimal' || cfg.settings.dnd.enabled || eff.mode.petEmotion === 'sleeping') return 'sleeping';
  if (eff.mode.petEmotion === 'thinking') return 'thinking';
  return (preset && preset.restEmotion) || 'idle'; // the personality shows even when nothing is happening
}

/** Non-idle resting poses (angry puffs, sparkles…) must keep animating, otherwise the pet looks frozen. */
function syncMoodHold() {
  if (!stage) return;
  if (residentEmotion() !== 'idle') stage.hold('mood'); else stage.release('mood');
}

/** A grumpy pet resting in an "annoyed" pose should also refuse petting. */
function residentAnnoying() {
  const e = residentEmotion();
  return !!(preset && preset.annoyingEmotions && preset.annoyingEmotions.includes(e));
}

function applyPresence() {
  const hide = (eff.hidden && !(current && current.item.priority === 'critical')) || (!cfg.settings.appearance.residentPet && !current);
  dock.classList.toggle('hidden', hide);
  refreshHitRects();
  dock.classList.toggle('presence-minimal', eff.presence === 'minimal');
  if (!stage) return;
  stage.setReducedMotion(eff.reducedMotion);
  document.body.classList.toggle('reduced-motion', !!eff.reducedMotion);
  if (eff.hidden) { stage.pause(); setCapture(false); } else stage.resume();
}

/* ------------------------------------------------------------------ helpers */

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

/* Report interactive rectangles to the main process (it hit-tests the real cursor). Cheap: only
   sent when they change; re-measured each frame for a moment after layout changes/animations. */
let lastRectsKey = '';
let lastDockKey = '';
let rectsUntil = 0;
let rectsRaf = 0;
let rectsFallbackTimer = null;
function measureRects() {
  rectsRaf = 0;
  if (rectsFallbackTimer) { clearTimeout(rectsFallbackTimer); rectsFallbackTimer = null; }
  const els = [current && current.el, !badgeEl.hidden && badgeEl].filter(Boolean);
  const hidden = dock.classList.contains('hidden');
  const rects = hidden ? [] : els.map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left - 8), y: Math.round(r.top - 8), w: Math.round(r.width + 16), h: Math.round(r.height + 16) }; }).filter(r => r.w > 8 && r.h > 8);
  const key = JSON.stringify(rects);
  if (key !== lastRectsKey) { lastRectsKey = key; if (api && api.setHitRects) api.setHitRects(rects); }
  // The whole pet + card area: main uses it to tell "a click on the pet/card activated the app"
  // from "the user re-opened the app from Finder/Launchpad" (only the latter opens the Control Center).
  const d = hidden ? null : dock.getBoundingClientRect();
  const dockKey = d ? `${Math.round(d.left)},${Math.round(d.top)},${Math.round(d.width)},${Math.round(d.height)}` : '';
  if (dockKey !== lastDockKey) {
    lastDockKey = dockKey;
    if (api && api.setDockRect) api.setDockRect(d ? { x: Math.round(d.left), y: Math.round(d.top), w: Math.round(d.width), h: Math.round(d.height) } : null);
  }
  if (performance.now() < rectsUntil) {
    rectsRaf = requestAnimationFrame(measureRects);
    rectsFallbackTimer = setTimeout(measureRects, 40);
  }
}
function refreshHitRects(ms = 600) {
  rectsUntil = Math.max(rectsUntil, performance.now() + ms);
  if (!rectsRaf) {
    rectsRaf = requestAnimationFrame(measureRects);
    if (!rectsFallbackTimer) rectsFallbackTimer = setTimeout(measureRects, 40);
  }
}
setInterval(() => { if (current || lastRectsKey !== '[]') refreshHitRects(50); }, 500); // safety net

function setCapture(on) {
  if (on === mouseCaptured) return;
  mouseCaptured = on;
  if (api) api.setIgnoreMouseEvents(!on);
}

function customPos() {
  const c = cfg && cfg.settings.appearance.customPosition;
  return c && Number.isFinite(c.x) && Number.isFinite(c.y) ? c : null;
}

function side() {
  // Where the card goes relative to the pet: always toward the middle of the screen.
  const c = customPos();
  if (c) return c.x + (petSlot.offsetWidth || 160) / 2 > window.innerWidth / 2 ? 'left' : 'right';
  const pos = cfg ? cfg.settings.appearance.position : 'bottom-right';
  return pos.endsWith('left') ? 'right' : 'left';
}

/**
 * Free-drag placement: the saved point is the PET's top-left. Anchor the dock on the pet's
 * side so a card grows toward the screen centre, then clamp everything inside the viewport.
 */
function placeDock() {
  refreshHitRects();
  const c = customPos();
  dock.classList.toggle('custom-pos', !!c);
  if (!c) { dock.style.left = dock.style.top = dock.style.right = dock.style.bottom = ''; return; }
  const pw = petSlot.offsetWidth || 160, ph = petSlot.offsetHeight || 170;
  const x = Math.max(0, Math.min(window.innerWidth - pw, c.x));
  const y = Math.max(0, Math.min(window.innerHeight - ph, c.y));
  dock.style.top = 'auto';
  dock.style.bottom = `${Math.max(0, window.innerHeight - (y + ph))}px`;
  if (side() === 'left') { dock.style.left = 'auto'; dock.style.right = `${Math.max(0, window.innerWidth - (x + pw))}px`; }
  else { dock.style.right = 'auto'; dock.style.left = `${x}px`; }
  requestAnimationFrame(() => {
    if (isDraggingPet || isThrowing) return;
    // Keep the PET at the saved point: in Peeker mode it is centred under a card wider than itself,
    // so anchoring the dock edge alone would slide the pet sideways.
    const pr = petSlot.getBoundingClientRect();
    const shift = Math.round(pr.left - x);
    if (Math.abs(shift) > 1) {
      if (dock.style.right !== 'auto') dock.style.right = `${parseFloat(dock.style.right) + shift}px`;
      else dock.style.left = `${parseFloat(dock.style.left) - shift}px`;
    }
    // Clamp: a tall/wide card near an edge must not leave the screen.
    const r = dock.getBoundingClientRect();
    if (r.top < 0) dock.style.bottom = `${Math.max(0, parseFloat(dock.style.bottom) + r.top)}px`;
    if (r.left < 0) {
      if (dock.style.right !== 'auto') dock.style.right = `${parseFloat(dock.style.right) + r.left}px`;
      else dock.style.left = `${parseFloat(dock.style.left) - r.left}px`;
    } else if (r.right > window.innerWidth) {
      const over = r.right - window.innerWidth;
      if (dock.style.left !== 'auto') dock.style.left = `${parseFloat(dock.style.left) - over}px`;
      else dock.style.right = `${parseFloat(dock.style.right) + over}px`;
    }
  });
}

/** Nudge the bubble sideways so it never spills past the screen edge (e.g. pet parked next to the
 *  Dock). The tail keeps pointing at the pet. Uses layout width, so the scale animation doesn't matter. */
function fitBubble() {
  const pad = 8;
  const w = bubbleEl.offsetWidth;
  const r = petSlot.getBoundingClientRect();
  const center = r.left + r.width / 2;
  let bx = 0;
  if (center + w / 2 > window.innerWidth - pad) bx = window.innerWidth - pad - (center + w / 2);
  if (center + bx - w / 2 < pad) bx = pad - (center - w / 2);
  // Don't let the tail slide off the bubble's rounded corners.
  const maxShift = Math.max(0, w / 2 - 18);
  bx = Math.max(-maxShift, Math.min(maxShift, bx));
  bubbleEl.style.setProperty('--bx', `${Math.round(bx)}px`);
}

function say(text, kind = '') {
  bubbleEl.textContent = text;
  fitBubble();
  bubbleEl.className = `pet-bubble show ${kind}`;
  clearTimeout(say.t);
  say.t = setTimeout(() => { bubbleEl.className = 'pet-bubble'; }, 1800);
}

/* ------------------------------------------------------------------ Pet voice (TTS) */
// System voices (macOS: "Linh" vi-VN, "Samantha" en-US), on-device. The pet only ever speaks its
// own fixed lines — never notification content (privacy).
let voices = [];
const loadVoices = () => { try { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch { voices = []; } };
if (window.speechSynthesis) { loadVoices(); speechSynthesis.addEventListener('voiceschanged', loadVoices); }
function voiceOn() {
  return !!(window.speechSynthesis && cfg && cfg.settings.sounds.enabled && cfg.settings.sounds.voice !== false && eff.mode.sound !== false && !eff.hidden);
}
function speak(text, { interrupt = true } = {}) {
  if (!voiceOn() || !text) return;
  if (!interrupt && speechSynthesis.speaking) return;
  const lang = getLang() === 'en' ? 'en' : 'vi';
  const clean = String(text).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang === 'en' ? 'en-US' : 'vi-VN';
  u.voice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang)) || null;
  u.pitch = 1.55; // small, cute
  u.rate = lang === 'en' ? 1.05 : 1.0;
  u.volume = Math.max(0, Math.min(1, (cfg.settings.sounds.volume || 0.45) * 1.6));
  if (interrupt) speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
const pickLine = (key) => { const l = t(key); return Array.isArray(l) ? l[Math.floor(Math.random() * l.length)] : l; };

function speciesVoice() { return getSpecies(cfg ? cfg.settings.activePet : 'cat_mochi').sound; }

/* ------------------------------------------------------------------ config */

function applyConfig(payload) {
  const prevPet = cfg && cfg.settings.activePet;
  cfg = payload;
  preset = payload.preset;
  const s = payload.settings;
  const a = s.appearance;
  const n = s.notifications;

  dock.className = `dock pos-${a.position} side-${side()} theme-${n.theme} size-${n.size} mode-${current ? current.item.presentationMode : 'resident'}${current ? ' has-card' : ''}`;
  // Card colour follows the app colour unless the user prefers colours by emotion.
  dock.dataset.ui = a.uiTheme || 'peach';
  dock.classList.toggle('accent-ui', a.cardFollowsTheme !== false);
  dock.style.setProperty('--margin', `${a.margin}px`);
  dock.style.setProperty('--pet-scale', a.petScale);
  dock.style.setProperty('--card-scale', Number(n.cardScale) || 1);

  if (!isDraggingPet && !isThrowing) placeDock();

  const prevMode = eff.mode && eff.mode.id;
  eff = payload.effective || eff;
  sound.configure({ enabled: s.sounds.enabled && eff.mode.sound !== false, volume: s.sounds.volume });

  if (!stage) {
    stage = new PetStage(stageEl, {
      species: s.activePet,
      assetBase: payload.assetBase,
      onEvent: onStageEvent,
      onFrame: onStageFrame,
      measure: true, // real frame-time stats for docs/reports (bounded buffer, negligible cost)
      // The pet canvas never takes the mouse (CSS pointer-events: none) so it can't steal clicks
      // from the card it overlaps; the stage listens on the page and ray-casts the pet instead.
      pointerTarget: document,
      ignorePointer: (e) => !!(e.target && e.target.closest && (e.target.closest('.pet-badge') || e.target.closest('.card') || e.target.closest('.card-slot')))
    });
    window.__cpcDiagnostics = { frameStats: () => stage.frameStats(), transitions: () => stage.anim.lastProfile };
  } else if (prevPet !== s.activePet) {
    stage.setSpecies(s.activePet);
  }
  stage.setPreset(preset);
  stage.setIntensity(s.sounds.animationIntensity);
  stage.setPetSensitivity(s.sounds.petSensitivity);

  applyPresence();
  syncMoodHold();
  if (!current) {
    stage.setAnnoying(residentAnnoying());
    stage.setEmotion(residentEmotion());
    dndSleeping = residentEmotion() === 'sleeping';
    const line = t('focusLine')[eff.mode.id];
    if (prevMode !== undefined && prevMode !== eff.mode.id && line && !eff.hidden) say(line);
  }
}

/* ------------------------------------------------------------------ stage events */

function onStageEvent(type, data) {
  if (type === 'petted') {
    say(randomQuote('petLove'), 'love');
    if (speciesVoice() === 'meow') sound.purr(); else sound.voice(speciesVoice(), 'happy');
  } else if (type === 'rejected') {
    const lines = getLang() === 'en' ? t('reject') : ((preset && preset.rejectLines && preset.rejectLines.length) ? preset.rejectLines : t('reject'));
    say(lines[Math.floor(Math.random() * lines.length)], 'angry');
    sound.hmph();
  } else if (type === 'landed') {
    sound.pop();
    if (data && data.impact > 1.2) dustPuff(Math.min(1, data.impact / 3));
  } else if (type === 'body-double') {
    // Only a real double tap on the pet itself — never a quick double click on a card button
    // (e.g. Approve's "click again to confirm") that ended up next to the pet's body.
    if (performance.now() - lastCardPress < 800) return;
    if (api) api.openControlCenter();
  } else if (type === 'kick-impact') {
    const el = cardSlot.querySelector('.card:not(.kicked)');
    if (el && !(current && current.el === el)) { el.classList.add('kicked'); sound.whoosh(); }
  }
}

let lastBreathSet = 0;
/** Keep the unread badge beside the pet's head (it used to be pinned to a fixed corner of the pet's
 *  box and covered the ear / face whenever the head moved: hops, stretch while held, other pets). */
let badgeXY = null;
function placeBadge(head) {
  if (!head || badgeEl.hidden) return;
  const sr = stageEl.getBoundingClientRect(), pr = petSlot.getBoundingClientRect();
  const bw = badgeEl.offsetWidth || 26, bh = badgeEl.offsetHeight || 26;
  // Badge's bottom-left corner at the anchor, kept inside the pet's box.
  const x = Math.max(0, Math.min(pr.width - bw, sr.left - pr.left + head.x - bw * 0.15));
  const y = Math.max(0, Math.min(pr.height - bh, sr.top - pr.top + head.y - bh * 0.85));
  if (badgeXY && Math.abs(badgeXY[0] - x) < 0.5 && Math.abs(badgeXY[1] - y) < 0.5) return;
  badgeXY = [x, y];
  badgeEl.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
}

function onStageFrame({ breath, t: frameTime, head }) {
  placeBadge(head);
  // Card "breathes" with the pet in Billboard Hugger mode (cheap: one CSS var per ~2 frames).
  if (!current || current.item.presentationMode !== 'billboard') return;
  if (frameTime - lastBreathSet < 0.03) return;
  lastBreathSet = frameTime;
  current.el.style.setProperty('--breath', ((breath - 1) * 40).toFixed(3));
}

/* ------------------------------------------------------------------ notifications */

/** "14:32 · 04/11/2026" — when the notification arrived (source time when the app reports one). */
function formatArrival(ts) {
  const d = new Date(Number(ts) || Date.now());
  const loc = getLang() === 'en' ? 'en-GB' : 'vi-VN';
  const time = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return { text: `${time} · ${date}`, iso: d.toISOString() };
}

/**
 * Jira / Bitbucket card body: what happened → key · type · repo → title → status / priority / labels
 * → the comment (quoted) → people and branch. Everything comes from item.meta (already sanitized).
 */
const TONE_DOT = { todo: '○', progress: '◐', review: '◑', done: '●', danger: '■' };
function ticketHtml(item) {
  const m = item.meta;
  const title = m.key && String(item.title).startsWith(`${m.key} `) ? String(item.title).slice(m.key.length + 1) : item.title;
  const prioUp = /highest|critical|blocker/i.test(m.priority || '') ? '⏫' : /high/i.test(m.priority || '') ? '🔺' : /low/i.test(m.priority || '') ? '🔻' : '▪️';
  const tags = [
    m.status ? `<span class="tk-status tone-${esc(m.statusTone || 'todo')}"><i>${TONE_DOT[m.statusTone] || '○'}</i>${esc(m.status)}</span>` : '',
    m.priority && !/^(medium|normal|trung bình)$/i.test(m.priority) ? `<span class="tk-prio">${prioUp} ${esc(m.priority)}</span>` : '',
    ...(m.labels || []).map(l => `<span class="tk-label">#${esc(l)}</span>`)
  ].filter(Boolean).join('');
  return `
      ${m.event ? `<div class="tk-event">${esc(m.event)}</div>` : ''}
      <div class="tk-line">
        ${m.key ? `<span class="tk-key">${esc(m.key)}</span>` : ''}
        ${m.type ? `<span class="tk-type">${esc(m.type)}</span>` : ''}
        ${m.repo ? `<span class="tk-type">📦 ${esc(m.repo)}</span>` : ''}
      </div>
      <h3 class="title">${esc(title)}</h3>
      ${tags ? `<div class="tk-tags">${tags}</div>` : ''}
      ${item.message ? `<p class="message tk-quote">${esc(item.message).replace(/\n/g, '<br>')}</p>` : ''}
      ${(m.people || []).length || m.branch ? `<div class="tk-foot">
        ${(m.people || []).map(p => `<span><small>${esc(p.label)}</small> <b>${esc(p.value)}</b></span>`).join('')}
        ${m.branch ? `<span class="tk-branch">⎇ ${esc(m.branch)}</span>` : ''}
      </div>` : ''}`;
}

function buildCard(item) {
  const base = APP_META[item.app] || { label: item.app && item.app !== 'default' ? item.app : t('defaultApp'), icon: '🔔' };
  const app = { ...base, label: item.appName || (getLang() === 'en' && I18N.en.apps[item.app]) || base.label };
  const emo = EMO[item.emotion] || EMO.happy;
  const emoLabel = (getLang() === 'en' && I18N.en.emo[item.emotion]) || emo.label;
  const prio = t('priority')[item.priority];
  const arrival = formatArrival(item.sourceCreatedAt || item.desktopReceivedAt || item.receivedAt);
  const el = document.createElement('div');
  el.className = `card emo-${item.emotion}${item.annoying ? ' annoying' : ''} prio-${item.priority || 'normal'}`;
  el.innerHTML = `
    <div class="card-inner">
      <div class="card-shine"></div>
      <header>
        <span class="chip app">${esc(app.icon)} ${esc(app.label)}</span>
        <span class="chip emo">${emo.emoji} ${esc(emoLabel)}</span>
        ${prio ? `<span class="chip prio prio-${esc(item.priority)}">${esc(prio)}</span>` : ''}
      </header>
      <time class="card-time" datetime="${arrival.iso}">🕒 ${esc(arrival.text)}</time>
      ${item.meta ? ticketHtml(item) : `<h3 class="title">${esc(item.title)}</h3>
      ${item.message ? `<p class="message">${esc(item.message).replace(/\n/g, '<br>')}</p>` : ''}`}
      ${(item.items || []).length ? `<ul class="rows">${item.items.map(r => `
        <li class="row" data-key="${esc(r.key)}">
          <div class="row-main"><b>${esc(r.title)}</b>${r.subtitle ? `<small>${esc(r.subtitle)}</small>` : ''}</div>
          <div class="row-btns">
            ${r.url ? `<button class="btn row-open" data-url="${esc(r.url)}" title="${esc(t('openUrl'))}">↗</button>` : ''}
            ${(r.actions || []).includes('approve') && item.source === 'composio' ? `<button class="btn approve row-approve">${esc(t('approve'))}</button>` : ''}
          </div>
        </li>`).join('')}</ul>${item.moreCount ? `<p class="rows-more">${esc(t('moreRows').replace('{n}', item.moreCount))}</p>` : ''}` : ''}
      <footer>
        <button class="btn primary open">${esc(item.openLabel === 'chat' ? t('openChat') : item.openLabel === 'app' ? t('openApp') : item.url || item.openLabel === 'link' ? t('openUrl') : t('openDone'))}</button>
        ${(item.actions || []).includes('break-start') ? `<button class="btn primary brk" data-brk="break-start">${esc(t('breakStart'))}</button><button class="btn brk ghost" data-brk="break-snooze">${esc(t('breakSnooze'))}</button>` : ''}
        ${(item.actions || []).includes('approve') && item.source === 'composio' && !(item.items || []).length ? `<button class="btn approve">${esc(t('approve'))}</button>` : ''}
        <button class="btn kick" title="${esc(t('kickTitle'))}">${esc(t('kick'))}</button>
      </footer>
      <p class="hint">${item.annoying ? esc(t('hintAnnoying')) : esc(t('hintPet'))}</p>
      <div class="progress"><i></i></div>
    </div>`;
  return el;
}

function showNotification(item) {
  if (eff.hidden && item.priority !== 'critical') { if (api) api.onAction('finished', { id: item.id }); return; }
  if (eff.hidden) {
    // Critical events bypass Hidden/Gaming (Blueprint §7.1): show briefly, then hide again.
    dock.classList.remove('hidden');
    if (stage) stage.resume();
  }
  if (current) finishCard('replace');
  flushPendingCleanup();
  dndSleeping = false;
  const mode = item.presentationMode || 'billboard';
  const el = buildCard(item);
  current = { item, el, remaining: item.duration, startedAt: 0, timer: null, timers: [], busy: 0 };
  measureRects();
  refreshHitRects(1600);

  dock.classList.remove('hidden', 'leaving');
  dock.className = dock.className.replace(/mode-\S+/, `mode-${mode}`);
  dock.classList.add('has-card');
  cardSlot.innerHTML = '';
  cardSlot.appendChild(el);
  placeDock();
  stage.hold('card');
  stage.setAnnoying(item.annoying);
  const wantPet = item.pet && item.pet !== cfg.settings.activePet ? item.pet : null;
  if (wantPet !== petOverride) { stage.setSpecies(wantPet || cfg.settings.activePet); petOverride = wantPet; }

  const reveal = () => {
    if (!current || current.el !== el) return; // replaced before it was revealed
    el.classList.add('in');
    stage.setHold(mode === 'courier' ? null : mode, side());
    stage.setReducedMotion(eff.reducedMotion || item.motion === 'reduced');
    stage.setEmotion(item.emotion);
    if (!item.silent) {
      sound.emotion(item.emotion, speciesVoice());
      if (speciesVoice() === 'meow' && ['happy', 'excited', 'love'].includes(item.emotion)) cardLater(() => sound.bell(), 450);
    }
    startTimer();
    if (item.app === 'wellbeing' && (item.actions || []).includes('break-start')) cardLater(() => speak(pickLine('voiceBreak')), 500);
  };

  // Latency mark: the first painted frame of the presentation (pet reaction / courier run-in).
  requestAnimationFrame(() => requestAnimationFrame(() => { if (api) api.onAction('rendered', { id: item.id, renderedAt: Date.now() }); }));

  if (mode === 'courier') {
    // Pet runs in carrying an envelope, presents it, then the card unfolds (≈0.65 s: it used to be
    // 1.42 s, which read as notification lag).
    dock.classList.add('courier-enter');
    stage.setEmotion('excited');
    stage.setHold('courierRun', side());
    cardLater(() => {
      dock.classList.remove('courier-enter');
      stage.setHold('courierPresent', side());
      cardLater(reveal, 200);
    }, 450);
  } else {
    requestAnimationFrame(reveal);
  }

  // Interactions
  el.addEventListener('mouseenter', pauseTimer);
  el.addEventListener('mouseleave', () => { resumeTimer(); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
  // Only a soft light spot follows the cursor (the card itself never tilts: a click made while it
  // moved used to land on a shifted button). One transform per animation frame, no repaint.
  const shine = el.querySelector('.card-shine');
  let shineXY = null, shineRaf = 0;
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    shineXY = [e.clientX - r.left, e.clientY - r.top];
    if (shineRaf || !shine) return;
    shineRaf = requestAnimationFrame(() => {
      shineRaf = 0;
      if (shineXY) shine.style.transform = `translate3d(${shineXY[0].toFixed(1)}px, ${shineXY[1].toFixed(1)}px, 0)`;
    });
  });
  el.querySelector('.open').addEventListener('click', (e) => { e.stopPropagation(); finishCard('click'); });
  // Approve buttons — the card's own (single PR) and one per row (several PRs). One click approves.
  el.querySelectorAll('.approve').forEach((approve) => approve.addEventListener('click', (e) => {
    e.stopPropagation();
    if (approve.disabled) return;
    pauseTimer();
    // Approving is a real action on someone's PR: the first click asks, the second one approves.
    if (!approve.classList.contains('confirm')) {
      approve.classList.add('confirm');
      approve.dataset.label = approve.textContent;
      approve.textContent = t('approveConfirm');
      clearTimeout(approve._t);
      approve._t = setTimeout(() => { approve.classList.remove('confirm'); approve.textContent = approve.dataset.label; }, 4000);
      return;
    }
    clearTimeout(approve._t);
    approve.classList.remove('confirm');
    approve.disabled = true;
    approve.textContent = t('approving');
    if (current && current.el === el) current.busy++; // the card stays until the result comes back
    const row = approve.closest('.row');
    if (api) api.onAction('approve', { id: item.id, source: item.source, externalId: row ? row.dataset.key : item.externalId });
  }));
  el.querySelectorAll('[data-brk]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (api) api.onAction(b.dataset.brk, { id: item.id });
    if (b.dataset.brk === 'break-snooze') say(t('snoozed'));
    finishCard('replace-quiet');
  }));
  el.querySelectorAll('.row-open').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (api) api.onAction('open-url', { id: item.id, url: b.dataset.url });
  }));
  el.addEventListener('mouseenter', () => { if (el.querySelector('.rows')) pauseTimer(); });
  const kick = el.querySelector('.kick');
  if (kick) kick.addEventListener('click', (e) => { e.stopPropagation(); finishCard('kick'); });
}

function startTimer() {
  if (!current) return;
  current.startedAt = performance.now();
  const bar = current.el.querySelector('.progress i');
  bar.style.transition = 'none';
  bar.style.transform = `scaleX(${current.remaining / current.item.duration})`;
  requestAnimationFrame(() => {
    bar.style.transition = `transform ${current.remaining}ms linear`;
    bar.style.transform = 'scaleX(0)';
  });
  current.timer = setTimeout(() => finishCard('timeout'), current.remaining);
}

function pauseTimer() {
  if (!current || !current.timer) return;
  clearTimeout(current.timer);
  current.timer = null;
  current.remaining = Math.max(1500, current.remaining - (performance.now() - current.startedAt));
  const bar = current.el.querySelector('.progress i');
  const shown = getComputedStyle(bar).transform;
  bar.style.transition = 'none';
  bar.style.transform = shown;
}

function resumeTimer() {
  if (!current || current.timer || current.busy > 0) return;
  current.remaining = Math.max(current.remaining, 2500);
  startTimer();
}

function finishCard(how) {
  if (!current) return;
  refreshHitRects(900);
  const { item, el } = current;
  clearTimeout(current.timer);
  current.timers.forEach(clearTimeout);
  current = null;
  dock.classList.remove('courier-enter');

  if (how === 'close' && api) api.onAction('close', { id: item.id });
  if (how === 'click' && api) api.onAction('click', { id: item.id, url: item.url, source: item.source, externalId: item.externalId });

  const cleanup = (superseded = false) => {
    if (pendingCleanup && pendingCleanup.run === cleanup) pendingCleanup = null;
    el.remove();
    if (superseded) {
      // A new card already took the dock: only release what this card held.
      stage.release('card');
      if (api) api.onAction('finished', { id: item.id });
      return;
    }
    dock.classList.remove('has-card');
    dock.className = dock.className.replace(/mode-\S+/, 'mode-resident');
    placeDock();
    if (eff.hidden) applyPresence();
    stage.setHold(null);
    stage.setAnnoying(residentAnnoying());
    stage.release('card');
    if (petOverride) { stage.setSpecies(cfg.settings.activePet); petOverride = null; }
    stage.setReducedMotion(eff.reducedMotion);
    stage.setEmotion(residentEmotion());
    if (!cfg.settings.appearance.residentPet || eff.hidden) {
      dock.classList.add('leaving');
      setTimeout(() => { if (!current) { dock.classList.add('hidden'); dock.classList.remove('leaving'); setCapture(false); } }, 450);
    }
    if (api) api.onAction('finished', { id: item.id });
  };

  const schedule = (ms) => { pendingCleanup = { run: cleanup, timer: setTimeout(cleanup, ms) }; };
  if (how === 'replace-quiet') { el.classList.add('out'); schedule(380); return; }
  if (how === 'replace') { el.remove(); if (api) api.onAction('finished', { id: item.id }); return; }

  if (how === 'kick') {
    if (api) api.onAction('close', { id: item.id }); // kicking the card away = closing it
    stage.play('kick');
    say(t('kickQuip'), 'angry');
    setTimeout(() => el.classList.add('kicked'), 380); // fallback if no impact event (GLB)
    schedule(1100);
    return;
  }
  el.classList.add(how === 'click' ? 'out-zoom' : 'out');
  if (how === 'close' && !item.annoying) stage.play('wave');
  schedule(420);
}

/* ------------------------------------------------------------------ Eye-break countdown */
let breakTimer = null;
function startBreak(minutes) {
  clearInterval(breakTimer);
  const end = Date.now() + Math.max(1, Number(minutes) || 5) * 60000;
  if (stage) { stage.setEmotion('sleeping'); stage.wake(1500); }
  speak(pickLine('voiceBreakStart'));
  let n = 0;
  const show = () => {
    const left = Math.max(0, end - Date.now());
    if (!left) {
      clearInterval(breakTimer); breakTimer = null;
      bubbleEl.className = 'pet-bubble';
      if (stage) { stage.setEmotion(current ? current.item.emotion : residentEmotion() === 'sleeping' ? 'happy' : residentEmotion()); stage.play('wave'); }
      say(t('breakDone'), 'love'); sound.bell();
      setTimeout(() => speak(pickLine('voiceBreakDone')), 400);
      return;
    }
    const mm = Math.floor(left / 60000), ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
    const tips = t('breakTip');
    bubbleEl.textContent = `${t('breakTick').replace('{t}', `${mm}:${ss}`)}${n % 20 < 10 ? '' : `  ·  ${tips[Math.floor(n / 20) % tips.length]}`}`;
    fitBubble();
    bubbleEl.className = 'pet-bubble show';
    clearTimeout(say.t);
    n++;
  };
  show();
  breakTimer = setInterval(show, 1000);
}

/* ------------------------------------------------------------------ pointer / click-through */

// Forwarded mouse moves arrive for the whole screen. Keep this handler cheap:
// time-based throttle (no compositor frame requested), and only hit-test near the dock.
let lastMoveAt = 0;
document.addEventListener('mousemove', (e) => {
  if (dock.classList.contains('hidden') || isDraggingPet || isThrowing) return;
  const now = performance.now();
  if (now - lastMoveAt < 33) return;
  lastMoveAt = now;
  const dr = dock.getBoundingClientRect();
  const near = e.clientX > dr.left - 40 && e.clientX < dr.right + 40 && e.clientY > dr.top - 40 && e.clientY < dr.bottom + 40;
  if (!near) {
    if (mouseCaptured) setCapture(false);
  } else {
    let overPet = false;
    const r = stageEl.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (inside && stage && stage.hitTest) overPet = stage.hitTest(e).over;
    // The pet slot has pointer-events: none (CSS), so the element under the cursor is the card when
    // there is one — even where the pet is drawn over the card's edge.
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const overCard = !!(under && ((current && current.el.contains(under)) || (!badgeEl.hidden && badgeEl.contains(under))));
    setCapture(!!(overCard || overPet));
  }
  // Proximity: the pet notices a nearby cursor (wakes from hibernation only when close).
  if (stage) {
    const cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2;
    if (current || Math.hypot(e.clientX - cx, e.clientY - cy) < 420) stage.lookAtScreenPoint(e.clientX, e.clientY);
  }
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // the overlay never shows Chromium's own menu
  if (!api || !api.showContextMenu) return;
  // Right-click a card → "Xếp nhóm nhanh" for its sender / chat (main builds the menu).
  if (current && current.el && current.el.contains(e.target)) { api.showContextMenu({ cardId: current.item.id }); return; }
  if (onPetBody(e)) api.showContextMenu();
});
// Opening the Control Center from the pet = a double tap on its BODY (PetStage 'body-double').
// The head is for petting only, and clicks on card buttons never open it.

/* ------------------------------------------------------------------ Drag & Drop Desktop Positioning */

let isPointerDownOnPet = false;
let isDraggingPet = false;
let dragStartX = 0;
let dragStartY = 0;
let dockStartLeft = 0;
let dockStartTop = 0;
let lastDragX = 0;
let lastDragY = 0;
let lastDragTime = 0;
let dragSayInterval = null;
let petOffsetX = 0;
let petOffsetY = 0;
let dragSamples = [];   // recent pointer samples → release velocity (throw)
let shakeTurns = [];    // times the drag direction flipped at speed → "shaken" → dizzy
let lastDirX = 0;
let isThrowing = false;
let throwRaf = 0;

/** Move the dock so the pet stays fully on screen (and leaves room for the bubble at the top). */
function moveDock(left, top) {
  const pw = petSlot.offsetWidth, ph = petSlot.offsetHeight;
  const minL = -petOffsetX, maxL = window.innerWidth - pw - petOffsetX;
  const minT = 44 - petOffsetY, maxT = window.innerHeight - ph - petOffsetY;
  const l = Math.max(minL, Math.min(maxL, left));
  const t = Math.max(minT, Math.min(maxT, top));
  dock.style.left = `${l}px`;
  dock.style.top = `${t}px`;
  dock.style.right = 'auto';
  dock.style.bottom = 'auto';
  refreshHitRects(200);
  if (bubbleEl.classList.contains('show')) fitBubble();
  return { l, t, hitX: l !== left ? Math.sign(left - l) : 0, hitY: t !== top ? Math.sign(top - t) : 0 };
}

function savePetPosition() {
  const rect = petSlot.getBoundingClientRect();
  if (api && api.savePosition) api.savePosition({ x: Math.round(rect.left), y: Math.round(rect.top) });
}

/** Little dust cloud at the pet's feet when it lands hard. */
function dustPuff(strength) {
  if (eff.reducedMotion) return;
  const el = document.createElement('span');
  el.className = 'dust-puff';
  el.style.setProperty('--s', (0.6 + strength * 0.6).toFixed(2));
  petSlot.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

/**
 * Released while moving fast → the pet keeps flying with its momentum, slows down with friction
 * and bounces off the screen edges. Grabbing it again catches it mid-air.
 */
function throwPet(vx, vy) {
  isThrowing = true;
  const r = dock.getBoundingClientRect();
  let x = r.left, y = r.top, last = performance.now();
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const f = Math.exp(-dt * 4.2); // friction
    vx *= f; vy *= f;
    const m = moveDock(x + vx * dt, y + vy * dt);
    x = m.l; y = m.t;
    if (m.hitX) { vx = -vx * 0.45; sound.pop(); }
    if (m.hitY) { vy = -vy * 0.45; sound.pop(); }
    if (stage) { const pr = petSlot.getBoundingClientRect(); stage.dragPointer(pr.left + pr.width / 2, pr.top); }
    if (Math.hypot(vx, vy) < 40) { stopThrow(true); return; }
    throwRaf = requestAnimationFrame(step);
  };
  throwRaf = requestAnimationFrame(step);
}

function stopThrow(save) {
  if (!isThrowing) return;
  cancelAnimationFrame(throwRaf);
  isThrowing = false;
  if (save) savePetPosition();
}

/* ------------------------------------------------------------------ Unread badge */
let badgeCount = 0;
function renderBadge() {
  const on = !!(cfg && cfg.settings.appearance.showBadge !== false) && badgeCount > 0;
  const prev = badgeEl.textContent;
  badgeEl.hidden = !on;
  badgeEl.textContent = badgeCount > 99 ? '99+' : String(badgeCount);
  badgeEl.classList.toggle('wide', badgeCount > 9);
  if (on && prev !== badgeEl.textContent) { badgeEl.classList.remove('bump'); void badgeEl.offsetWidth; badgeEl.classList.add('bump'); }
  if (on && stage) { badgeXY = null; placeBadge(stage.headAnchor()); }
}
badgeEl.addEventListener('pointerdown', (e) => e.stopPropagation()); // not a drag of the pet
badgeEl.addEventListener('click', (e) => { e.stopPropagation(); if (api) api.openControlCenter('inbox'); });

// Pet presses are detected on the page by ray-casting the pet (the slot itself ignores the mouse).
const onPetBody = (e) => !!(stage && stage.hitTest && !(e.target && e.target.closest && (e.target.closest('.pet-badge') || e.target.closest('.card') || e.target.closest('.card-slot'))) && stage.hitTest(e).over);
document.addEventListener('pointerdown', (e) => {
  const onCard = !!(e.target && e.target.closest && e.target.closest('.card'));
  if (onCard) lastCardPress = performance.now();
  if (api && api.markInteraction) api.markInteraction(onCard); // guards in main (macOS 'activate', open-control)
  if (e.button !== 0 || !onPetBody(e)) return; // left button, on the pet's body only
  beginPetPress(e);
}, true);

/** Start a press that becomes a drag of the whole dock (pet + held card/video) after 6 px. */
function beginPetPress(e) {
  stopThrow(false); // caught mid-air: this drag will save the position
  // Capture on the page root (not on whatever element is under the pet, e.g. the card) so the
  // release can't get lost and can't turn into a click on the card.
  try { document.documentElement.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  isPointerDownOnPet = true;
  isDraggingPet = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  lastDragTime = performance.now();
  dragSamples = [{ t: lastDragTime, x: e.clientX, y: e.clientY }];
  shakeTurns = [];
  lastDirX = 0;

  const dockRect = dock.getBoundingClientRect();
  dockStartLeft = dockRect.left;
  dockStartTop = dockRect.top;
  const pr = petSlot.getBoundingClientRect();
  petOffsetX = pr.left - dockRect.left;
  petOffsetY = pr.top - dockRect.top;
}

document.addEventListener('pointermove', (e) => {
  if (!isPointerDownOnPet) return;
  const dist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
  if (!isDraggingPet && dist > 6) {
    if (cfg && cfg.settings.appearance && cfg.settings.appearance.dragEnabled === false) return;
    isDraggingPet = true;
    document.body.classList.add('is-dragging');
    setCapture(true);
    if (stage) stage.setGrabbed(true);
    sound.bell();
    { const line = randomQuote('pickedUp'); say(line, 'angry'); speak(line); }
    dragSayInterval = setInterval(() => {
      if (isDraggingPet) {
        sound.bell();
        const line = randomQuote('pickedUp');
        say(line, 'angry');
        speak(line, { interrupt: false }); // don't cut the previous line mid-sentence
      }
    }, 2400);
  }

  if (isDraggingPet) {
    const now = performance.now();
    const dt = Math.max(1, now - lastDragTime) / 1000;
    const vx = (e.clientX - lastDragX) / dt;
    const vy = (e.clientY - lastDragY) / dt;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    lastDragTime = now;

    // Release velocity (throw) from the last ~90 ms; direction flips at speed = shaking.
    dragSamples.push({ t: now, x: e.clientX, y: e.clientY });
    while (dragSamples.length > 2 && now - dragSamples[0].t > 90) dragSamples.shift();
    const dir = Math.abs(vx) > 650 ? Math.sign(vx) : 0;
    if (dir && lastDirX && dir !== lastDirX) shakeTurns.push(now);
    if (dir) lastDirX = dir;
    shakeTurns = shakeTurns.filter(t => now - t < 1400);

    if (stage) { stage.setGrabbed(true, { x: vx, y: vy }); stage.dragPointer(e.clientX, e.clientY); }
    moveDock(dockStartLeft + e.clientX - dragStartX, dockStartTop + e.clientY - dragStartY);
  }
});

function endPetPress() {
  if (!isPointerDownOnPet) return;
  isPointerDownOnPet = false;
  clearInterval(dragSayInterval);
  dragSayInterval = null;

  if (isDraggingPet) {
    isDraggingPet = false;
    document.body.classList.remove('is-dragging');
    if (stage) { stage.setGrabbed(false); stage.suppressClick = true; }
    const shaken = shakeTurns.length >= 4;
    // Speed at release: from the oldest sample still in the ~90 ms window (0 if the hand had stopped).
    const now = performance.now();
    const first = dragSamples[0], lastS = dragSamples[dragSamples.length - 1];
    const span = first && lastS ? (lastS.t - first.t) / 1000 : 0;
    const fresh = lastS && now - lastS.t < 60;
    let tvx = span > 0.015 && fresh ? (lastS.x - first.x) / span : 0;
    let tvy = span > 0.015 && fresh ? (lastS.y - first.y) / span : 0;
    const speed = Math.hypot(tvx, tvy);
    if (speed > 2600) { tvx *= 2600 / speed; tvy *= 2600 / speed; }
    const thrown = speed > 900 && !eff.reducedMotion;
    if (shaken && stage) stage.setDizzy();
    { const line = randomQuote(shaken ? 'dizzy' : thrown ? 'thrown' : 'landed'); say(line, shaken ? 'angry' : 'happy'); speak(line); }
    if (thrown) throwPet(tvx, tvy);
    else savePetPosition();
  }
}
document.addEventListener('pointerup', endPetPress);
document.addEventListener('pointercancel', endPetPress);
document.documentElement.addEventListener('lostpointercapture', endPetPress);
window.addEventListener('blur', endPetPress);

/* ------------------------------------------------------------------ battery (System adapter) */

if (navigator.getBattery && api) {
  navigator.getBattery().then((b) => {
    const report = () => api.reportBattery({ level: b.level, charging: b.charging });
    b.addEventListener('levelchange', report);
    b.addEventListener('chargingchange', report);
    report();
  }).catch(() => {});
}

/* ------------------------------------------------------------------ IPC */

if (api) {
  api.onConfig((p) => { applyConfig(p); renderBadge(); });
  if (api.onBadge) api.onBadge(({ count }) => { badgeCount = Math.max(0, Number(count) || 0); renderBadge(); });
  api.onNotification(showNotification);
  api.onEmotion(({ emotion }) => {
    if (!current && stage) { stage.setEmotion(emotion); dndSleeping = emotion === 'sleeping'; if (dndSleeping) say(t('dndSleeping')); }
  });
  api.onDismiss(() => { if (current) finishCard('close'); });
  api.onResumed(() => {
    lastRectsKey = '';
    if (stage) { stage.lastFrame = performance.now(); stage.wake(800); }
    measureRects();
    refreshHitRects(1200);
  });
  api.onActionResult && api.onActionResult((r) => {
    if (current && current.item.id === r.id && current.busy > 0) current.busy--;
    if (!current || current.item.id !== r.id) { if (r.ok) say(t('approvedSay'), 'love'); else say(t('approveFail') + (r.error || ''), 'angry'); return; }
    const row = r.key ? [...current.el.querySelectorAll('.row')].find(x => x.dataset.key === r.key) : null;
    const b = row ? row.querySelector('.approve') : current.el.querySelector('footer .approve');
    if (r.ok) {
      if (b) { b.textContent = t('approved'); b.classList.add('done'); b.disabled = true; }
      if (row) row.classList.add('approved');
      say(t('approvedSay'), 'love');
      if (stage) { stage.setEmotion('happy'); stage.play('wave'); }
      // Single PR → close; list → close once every row is approved.
      const allDone = !row || [...current.el.querySelectorAll('.row-approve')].every(x => x.classList.contains('done'));
      if (allDone) setTimeout(() => { if (current && current.item.id === r.id) finishCard('close'); }, 1800);
    } else {
      if (b) { b.disabled = false; b.textContent = t('approve'); }
      say(t('approveFail') + (r.error || ''), 'angry');
      if (!current.busy && !current.el.matches(':hover')) resumeTimer();
    }
  });
  api.onBreakStart && api.onBreakStart(({ minutes }) => startBreak(minutes));
  api.onModelChanged(({ id }) => { if (stage && cfg && cfg.settings.activePet === id) stage.reloadModel(); });
}
