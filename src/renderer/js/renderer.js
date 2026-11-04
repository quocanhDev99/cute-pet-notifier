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
    kickQuip: 'Hứ! Biến đi! 🦶',
    reject: ['😤 Tránh xa ra, đừng có vuốt ve tui!'],
    kickTitle: 'Thú cưng sẽ đá văng thông báo này',
    voiceBreak: ['Bạn ơi, mình nghỉ mắt một chút nha!', 'Nhìn màn hình lâu rồi đó, cho mắt nghỉ xíu nhé!', 'Ê, tới giờ nghỉ mắt rồi nè!'], voiceBreakStart: ['Nhắm mắt thư giãn nào, bé canh giờ cho bạn nhé.', 'Nhìn ra xa một chút, hít thở thật sâu nào.'], voiceBreakDone: ['Xong rồi! Mắt khỏe re, mình làm tiếp thôi!', 'Hết giờ nghỉ rồi, chiến tiếp nào!'], breakStart: '😌 Nghỉ ngay', breakSnooze: '⏰ 10 phút nữa', breakTick: '😌 Nghỉ mắt nào… {t}', breakTip: ['Nhìn ra xa khoảng 6 m nhé 🌳', 'Chớp mắt chậm vài lần 😌', 'Đứng dậy vươn vai một chút 🙆'], breakDone: '🌟 Mắt khỏe rồi! Làm tiếp thôi', snoozed: '⏰ OK, 10 phút nữa bé nhắc lại', moreRows: '+{n} PR khác — bấm Mở để xem tất cả', approve: '✅ Approve', approving: '⏳ Đang approve…', approved: '✓ Đã approve', approvedSay: '✅ Đã approve PR giúp bạn!', approveFail: '😿 Approve không được: ',
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
    kickQuip: 'Hmph! Begone! 🦶',
    reject: ["😤 Stay back, don't touch me!", '😾 Not now, human!', '🙄 Hands off!'],
    kickTitle: 'Your pet will kick this notification away',
    voiceBreak: ['Hey, let’s rest your eyes for a bit!', 'You’ve been staring at the screen for a while. Eye break time!'], voiceBreakStart: ['Close your eyes and relax, I’ll keep time for you.', 'Look far away and take a deep breath.'], voiceBreakDone: ['All done! Fresh eyes, let’s get back to it!'], breakStart: '😌 Break now', breakSnooze: '⏰ In 10 min', breakTick: '😌 Eye break… {t}', breakTip: ['Look about 6 m away 🌳', 'Blink slowly a few times 😌', 'Stand up and stretch 🙆'], breakDone: '🌟 Eyes refreshed! Back to it', snoozed: '⏰ OK, I’ll remind you in 10 min', moreRows: '+{n} more — press Open to see all', approve: '✅ Approve', approving: '⏳ Approving…', approved: '✓ Approved', approvedSay: '✅ PR approved for you!', approveFail: '😿 Couldn’t approve: ',
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
let current = null; // { item, el, timer, remaining, startedAt }
let mouseCaptured = false;
let dndSleeping = false;
let eff = { presence: 'full', mode: { id: 'none' }, hidden: false, reducedMotion: false };

/** Resting state when no card is shown: depends on presence + focus mode. */
function residentEmotion() {
  if (!cfg) return 'idle';
  if (eff.presence === 'minimal' || cfg.settings.dnd.enabled || eff.mode.petEmotion === 'sleeping') return 'sleeping';
  if (eff.mode.petEmotion === 'thinking') return 'thinking';
  return 'idle';
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
let rectsUntil = 0;
let rectsRaf = 0;
function measureRects() {
  rectsRaf = 0;
  const els = [current && current.el].filter(Boolean);
  const hidden = dock.classList.contains('hidden');
  const rects = hidden ? [] : els.map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left - 8), y: Math.round(r.top - 8), w: Math.round(r.width + 16), h: Math.round(r.height + 16) }; }).filter(r => r.w > 16 && r.h > 16);
  const key = JSON.stringify(rects);
  if (key !== lastRectsKey) { lastRectsKey = key; if (api && api.setHitRects) api.setHitRects(rects); }
  if (performance.now() < rectsUntil) rectsRaf = requestAnimationFrame(measureRects);
}
function refreshHitRects(ms = 600) {
  rectsUntil = Math.max(rectsUntil, performance.now() + ms);
  if (!rectsRaf) rectsRaf = requestAnimationFrame(measureRects);
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
  // Clamp: a tall card near the top edge must not leave the screen.
  requestAnimationFrame(() => {
    const r = dock.getBoundingClientRect();
    if (r.top < 0) dock.style.bottom = `${Math.max(0, parseFloat(dock.style.bottom) + r.top)}px`;
    if (r.left < 0 && dock.style.right !== 'auto') dock.style.right = `${Math.max(0, parseFloat(dock.style.right) + r.left)}px`;
    if (r.right > window.innerWidth && dock.style.left !== 'auto') dock.style.left = `${Math.max(0, parseFloat(dock.style.left) - (r.right - window.innerWidth))}px`;
  });
}

function say(text, kind = '') {
  bubbleEl.textContent = text;
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

  if (!isDraggingPet) placeDock();

  const prevMode = eff.mode && eff.mode.id;
  eff = payload.effective || eff;
  sound.configure({ enabled: s.sounds.enabled && eff.mode.sound !== false, volume: s.sounds.volume });

  if (!stage) {
    stage = new PetStage(stageEl, {
      species: s.activePet,
      assetBase: payload.assetBase,
      onEvent: onStageEvent,
      onFrame: onStageFrame,
      measure: true // real frame-time stats for docs/reports (bounded buffer, negligible cost)
    });
    window.__cpcDiagnostics = { frameStats: () => stage.frameStats(), transitions: () => stage.anim.lastProfile };
  } else if (prevPet !== s.activePet) {
    stage.setSpecies(s.activePet);
  }
  stage.setPreset(preset);
  stage.setIntensity(s.sounds.animationIntensity);
  stage.setPetSensitivity(s.sounds.petSensitivity);

  applyPresence();
  if (!current) {
    stage.setAnnoying(false);
    stage.setEmotion(residentEmotion());
    dndSleeping = residentEmotion() === 'sleeping';
    const line = t('focusLine')[eff.mode.id];
    if (prevMode !== undefined && prevMode !== eff.mode.id && line && !eff.hidden) say(line);
  }
}

/* ------------------------------------------------------------------ stage events */

function onStageEvent(type) {
  if (type === 'petted') {
    say(randomQuote('petLove'), 'love');
    if (speciesVoice() === 'meow') sound.purr(); else sound.voice(speciesVoice(), 'happy');
  } else if (type === 'rejected') {
    const lines = getLang() === 'en' ? t('reject') : ((preset && preset.rejectLines && preset.rejectLines.length) ? preset.rejectLines : t('reject'));
    say(lines[Math.floor(Math.random() * lines.length)], 'angry');
    sound.hmph();
  } else if (type === 'kick-impact') {
    if (current && current.el) {
      current.el.classList.add('kicked');
      sound.whoosh();
    }
  }
}

let lastBreathSet = 0;
function onStageFrame({ breath, t: frameTime }) {
  // Card "breathes" with the pet in Billboard Hugger mode (cheap: one CSS var per ~2 frames).
  if (!current || current.item.presentationMode !== 'billboard') return;
  if (frameTime - lastBreathSet < 0.03) return;
  lastBreathSet = frameTime;
  current.el.style.setProperty('--breath', ((breath - 1) * 40).toFixed(3));
}

/* ------------------------------------------------------------------ notifications */

function buildCard(item) {
  const base = APP_META[item.app] || { label: item.app && item.app !== 'default' ? item.app : t('defaultApp'), icon: '🔔' };
  const app = { ...base, label: item.appName || (getLang() === 'en' && I18N.en.apps[item.app]) || base.label };
  const emo = EMO[item.emotion] || EMO.happy;
  const emoLabel = (getLang() === 'en' && I18N.en.emo[item.emotion]) || emo.label;
  const prio = t('priority')[item.priority];
  const el = document.createElement('div');
  el.className = `card emo-${item.emotion}${item.annoying ? ' annoying' : ''} prio-${item.priority || 'normal'}`;
  el.innerHTML = `
    <div class="card-inner">
      <div class="card-shine"></div>
      <header>
        <span class="chip app">${esc(app.icon)} ${esc(app.label)}</span>
        <span class="chip emo">${emo.emoji} ${esc(emoLabel)}</span>
        ${prio ? `<span class="chip prio prio-${esc(item.priority)}">${esc(prio)}</span>` : ''}
        <button class="icon-btn close" title="${esc(t('close'))}">✕</button>
      </header>
      <h3 class="title">${esc(item.title)}</h3>
      ${item.message ? `<p class="message">${esc(item.message).replace(/\n/g, '<br>')}</p>` : ''}
      ${(item.items || []).length ? `<ul class="rows">${item.items.map(r => `
        <li class="row" data-key="${esc(r.key)}">
          <div class="row-main"><b>${esc(r.title)}</b>${r.subtitle ? `<small>${esc(r.subtitle)}</small>` : ''}</div>
          <div class="row-btns">
            ${r.url ? `<button class="btn row-open" data-url="${esc(r.url)}" title="${esc(t('openUrl'))}">↗</button>` : ''}
            ${r.actions.includes('approve') && item.source === 'composio' ? `<button class="btn approve row-approve">${esc(t('approve'))}</button>` : ''}
          </div>
        </li>`).join('')}</ul>${item.moreCount ? `<p class="rows-more">${esc(t('moreRows').replace('{n}', item.moreCount))}</p>` : ''}` : ''}
      <footer>
        <button class="btn primary open">${esc(item.openLabel === 'chat' ? t('openChat') : item.openLabel === 'app' ? t('openApp') : item.url || item.openLabel === 'link' ? t('openUrl') : t('openDone'))}</button>
        ${(item.actions || []).includes('break-start') ? `<button class="btn primary brk" data-brk="break-start">${esc(t('breakStart'))}</button><button class="btn brk ghost" data-brk="break-snooze">${esc(t('breakSnooze'))}</button>` : ''}
        ${(item.actions || []).includes('approve') && item.source === 'composio' && !(item.items || []).length ? `<button class="btn approve">${esc(t('approve'))}</button>` : ''}
        ${item.annoying ? `<button class="btn kick" title="${esc(t('kickTitle'))}">${esc(t('kick'))}</button>` : ''}
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
  dndSleeping = false;
  const mode = item.presentationMode || 'billboard';
  const el = buildCard(item);
  current = { item, el, remaining: item.duration, startedAt: 0, timer: null };
  refreshHitRects(1600);

  dock.classList.remove('hidden', 'leaving');
  dock.className = dock.className.replace(/mode-\S+/, `mode-${mode}`);
  dock.classList.add('has-card');
  cardSlot.innerHTML = '';
  cardSlot.appendChild(el);
  placeDock();
  stage.hold('card');
  stage.setAnnoying(item.annoying);
  if (item.pet && item.pet !== cfg.settings.activePet) stage.setSpecies(item.pet);

  const reveal = () => {
    el.classList.add('in');
    stage.setHold(mode === 'courier' ? null : mode, side());
    stage.setReducedMotion(eff.reducedMotion || item.motion === 'reduced');
    stage.setEmotion(item.emotion);
    if (!item.silent) {
      sound.emotion(item.emotion, speciesVoice());
      if (speciesVoice() === 'meow' && ['happy', 'excited', 'love'].includes(item.emotion)) setTimeout(() => sound.bell(), 450);
    }
    startTimer();
    if (item.app === 'wellbeing' && (item.actions || []).includes('break-start')) setTimeout(() => speak(pickLine('voiceBreak')), 500);
  };

  // Latency mark: the first painted frame of the presentation (pet reaction / courier run-in).
  requestAnimationFrame(() => requestAnimationFrame(() => { if (api) api.onAction('rendered', { id: item.id, renderedAt: Date.now() }); }));

  if (mode === 'courier') {
    // Pet runs in carrying an envelope, presents it, then the card unfolds (≈1.42 s choreography).
    dock.classList.add('courier-enter');
    stage.setEmotion('excited');
    stage.setHold('courierRun', side());
    setTimeout(() => {
      dock.classList.remove('courier-enter');
      stage.setHold('courierPresent', side());
      setTimeout(reveal, 520);
    }, 900);
  } else {
    requestAnimationFrame(reveal);
  }

  // Interactions
  el.addEventListener('mouseenter', pauseTimer);
  el.addEventListener('mouseleave', () => { resumeTimer(); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${px * 10}deg`);
    el.style.setProperty('--rx', `${-py * 8}deg`);
    el.style.setProperty('--mx', `${(px + 0.5) * 100}%`);
    el.style.setProperty('--my', `${(py + 0.5) * 100}%`);
  });
  el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); finishCard('close'); });
  el.querySelector('.open').addEventListener('click', (e) => { e.stopPropagation(); finishCard('click'); });
  // Approve buttons — the card's own (single PR) and one per row (several PRs). One click approves.
  el.querySelectorAll('.approve').forEach((approve) => approve.addEventListener('click', (e) => {
    e.stopPropagation();
    if (approve.disabled) return;
    pauseTimer();
    approve.disabled = true;
    approve.textContent = t('approving');
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
  if (!current || current.timer) return;
  current.remaining = Math.max(current.remaining, 2500);
  startTimer();
}

function finishCard(how) {
  if (!current) return;
  refreshHitRects(900);
  const { item, el } = current;
  clearTimeout(current.timer);
  current = null;

  if (how === 'close' && api) api.onAction('close', { id: item.id });
  if (how === 'click' && api) api.onAction('click', { id: item.id, url: item.url, source: item.source, externalId: item.externalId });

  const cleanup = () => {
    el.remove();
    dock.classList.remove('has-card');
    dock.className = dock.className.replace(/mode-\S+/, 'mode-resident');
    placeDock();
    if (eff.hidden) applyPresence();
    stage.setHold(null);
    stage.setAnnoying(false);
    stage.release('card');
    if (item.pet && item.pet !== cfg.settings.activePet) stage.setSpecies(cfg.settings.activePet);
    stage.setReducedMotion(eff.reducedMotion);
    stage.setEmotion(residentEmotion());
    if (!cfg.settings.appearance.residentPet || eff.hidden) {
      dock.classList.add('leaving');
      setTimeout(() => { if (!current) { dock.classList.add('hidden'); dock.classList.remove('leaving'); setCapture(false); } }, 450);
    }
    if (api) api.onAction('finished', { id: item.id });
  };

  if (how === 'replace-quiet') { el.classList.add('out'); setTimeout(cleanup, 380); return; }
  if (how === 'replace') { el.remove(); if (api) api.onAction('finished', { id: item.id }); return; }

  if (how === 'kick') {
    stage.play('kick');
    say(t('kickQuip'), 'angry');
    setTimeout(() => el.classList.add('kicked'), 380); // fallback if no impact event (GLB)
    setTimeout(cleanup, 1100);
    return;
  }
  el.classList.add(how === 'click' ? 'out-zoom' : 'out');
  if (how === 'close' && !item.annoying) stage.play('wave');
  setTimeout(cleanup, 420);
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
  if (dock.classList.contains('hidden') || isDraggingPet) return;
  const now = performance.now();
  if (now - lastMoveAt < 33) return;
  lastMoveAt = now;
  const dr = dock.getBoundingClientRect();
  const near = e.clientX > dr.left - 40 && e.clientX < dr.right + 40 && e.clientY > dr.top - 40 && e.clientY < dr.bottom + 40;
  if (!near) {
    if (mouseCaptured) setCapture(false);
  } else {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const overCard = (current && current.el.contains(under));
    let overPet = false;
    const r = stageEl.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (inside && stage && stage.hitTest) overPet = stage.hitTest(e).over;
    setCapture(!!(overCard || overPet));
  }
  // Proximity: the pet notices a nearby cursor (wakes from hibernation only when close).
  if (stage) {
    const cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2;
    if (current || Math.hypot(e.clientX - cx, e.clientY - cy) < 420) stage.lookAtScreenPoint(e.clientX, e.clientY);
  }
});

petSlot.addEventListener('contextmenu', (e) => { e.preventDefault(); if (api && api.showContextMenu) api.showContextMenu(); });
petSlot.addEventListener('dblclick', () => { if (api && !current) api.openControlCenter(); });

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

petSlot.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return; // Left mouse button only
  const hit = stage && stage.hitTest ? stage.hitTest(e) : { over: true };
  if (!hit.over) return;
  beginPetPress(e);
});

/** Start a press that becomes a drag of the whole dock (pet + held card/video) after 6 px. */
function beginPetPress(e) {
  try { if (e.target && e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId); } catch { /* ignore */ } // release can't get lost in the iframe
  isPointerDownOnPet = true;
  isDraggingPet = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  lastDragTime = performance.now();

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

    if (stage) stage.setGrabbed(true, { x: vx, y: vy });

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const pw = petSlot.offsetWidth, ph = petSlot.offsetHeight;
    // Keep the pet itself on screen while dragging.
    const newLeft = Math.max(-petOffsetX, Math.min(window.innerWidth - pw - petOffsetX, dockStartLeft + dx));
    // Leave room above the pet for the speech bubble ("Á á buông tui ra!") at the screen top.
    const bubbleRoom = 44;
    const newTop = Math.max(bubbleRoom - petOffsetY, Math.min(window.innerHeight - ph - petOffsetY, dockStartTop + dy));

    dock.style.left = `${newLeft}px`;
    dock.style.top = `${newTop}px`;
    refreshHitRects(200);
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
  }
});

document.addEventListener('pointerup', () => {
  if (!isPointerDownOnPet) return;
  isPointerDownOnPet = false;
  clearInterval(dragSayInterval);
  dragSayInterval = null;

  if (isDraggingPet) {
    isDraggingPet = false;
    document.body.classList.remove('is-dragging');
    if (stage) { stage.setGrabbed(false); stage.suppressClick = true; }
    { const line = randomQuote('landed'); say(line, 'happy'); speak(line); }
    sound.pop();

    const rect = petSlot.getBoundingClientRect();
    const pos = { x: Math.round(rect.left), y: Math.round(rect.top) };
    if (api && api.savePosition) api.savePosition(pos);
  }
});

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
  api.onConfig(applyConfig);
  api.onNotification(showNotification);
  api.onEmotion(({ emotion }) => {
    if (!current && stage) { stage.setEmotion(emotion); dndSleeping = emotion === 'sleeping'; if (dndSleeping) say(t('dndSleeping')); }
  });
  api.onDismiss(() => { if (current) finishCard('close'); });
  api.onResumed(() => { if (stage) { stage.lastFrame = performance.now(); stage.wake(800); } });
  api.onActionResult && api.onActionResult((r) => {
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
    }
  });
  api.onBreakStart && api.onBreakStart(({ minutes }) => startBreak(minutes));
  api.onModelChanged(({ id }) => { if (stage && cfg && cfg.settings.activePet === id) stage.reloadModel(); });
}
