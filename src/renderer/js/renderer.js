/**
 * Overlay renderer — the desktop pet dock + 3D acrylic notification cards.
 * Presentation modes: Billboard Hugger · Peeker · Courier.
 */
import { PetStage } from './pet/pet-stage.js';
import { AudioController } from './audio-controller.js';
import { EMOTION_SCHEMA } from '../../shared/emotion-constants.js';
import { getSpecies } from './pet/species.js';

const api = window.electronAPI;
const dock = document.getElementById('dock');
const cardSlot = dock.querySelector('.card-slot');
const petSlot = dock.querySelector('.pet-slot');
const stageEl = dock.querySelector('.pet-stage');
const bubbleEl = dock.querySelector('.pet-bubble');
const badgeEl = dock.querySelector('.pet-badge');
const pomoEl = dock.querySelector('.pomo-chip');

/* Pomodoro countdown chip (state comes from main with every overlay config; the clock is shared). */
let pomo = null, pomoTimer = null;
function renderPomo() {
  if (!pomoEl) return;
  const run = pomo && pomo.phase && pomo.phase !== 'idle';
  pomoEl.hidden = !run;
  if (!run) { clearInterval(pomoTimer); pomoTimer = null; return; }
  const left = pomo.paused ? pomo.remainingMs : Math.max(0, pomo.endsAt - Date.now());
  const mm = Math.floor(left / 60000), ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
  const isBreak = pomo.phase !== 'focus';
  pomoEl.textContent = `${isBreak ? '☕' : (pomo.preset === 'study' ? '📚' : '🍅')} ${mm}:${ss}${pomo.paused ? ' ⏸' : ''}`;
  pomoEl.className = `pomo-chip${isBreak ? ' break' : ''}${pomo.paused ? ' paused' : ''}`;
  if (!pomoTimer && !pomo.paused) pomoTimer = setInterval(renderPomo, 1000);
  if (pomo.paused) { clearInterval(pomoTimer); pomoTimer = null; }
}

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
    markRead: '✓ Đã đọc',
    close: 'Đóng',
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
    markRead: '✓ Read',
    close: 'Close',
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

const audio = new AudioController(); // every sound of the overlay goes through it (CP-05)
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

/**
 * Ask main to take (on) or release the mouse. Main can reset the window to click-through on its own
 * (display change, sleep/resume): a capture is therefore re-sent at most once a second while the
 * cursor stays over a card / the pet, so the two sides can never stay out of sync (cards that
 * ignore every click).
 */
let lastCaptureSent = 0;
function setCapture(on) {
  const now = performance.now();
  if (on === mouseCaptured && !(on && now - lastCaptureSent > 1000)) return;
  mouseCaptured = on;
  lastCaptureSent = now;
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
  cardSlot.style.translate = '';
  const c = customPos();
  dock.classList.toggle('custom-pos', !!c);
  if (!c) { dock.style.left = dock.style.top = dock.style.right = dock.style.bottom = ''; requestAnimationFrame(keepCardOffBottom); return; }
  const pw = petSlot.offsetWidth || 160, ph = petSlot.offsetHeight || 170;
  const x = Math.max(0, Math.min(window.innerWidth - pw, c.x));
  const y = Math.max(0, Math.min(window.innerHeight - ph, c.y));
  dock.style.top = 'auto';
  dock.style.bottom = `${Math.max(0, window.innerHeight - (y + ph))}px`;
  if (side() === 'left') { dock.style.left = 'auto'; dock.style.right = `${Math.max(0, window.innerWidth - (x + pw))}px`; }
  else { dock.style.right = 'auto'; dock.style.left = `${x}px`; }
  requestAnimationFrame(() => {
    if (isDraggingPet) return;
    // Keep the PET at the saved point: in Peeker mode it is centred under a card wider than itself,
    // so anchoring the dock edge alone would slide the pet sideways.
    // Layout position, NOT getBoundingClientRect(): the pet may be mid-animation (Courier runs in
    // from off-screen with a transform) and that offset must never be baked into the dock position.
    const petLeft = dock.getBoundingClientRect().left + petSlot.offsetLeft;
    const shift = Math.round(petLeft - x);
    if (Math.abs(shift) > 1) {
      if (dock.style.right !== 'auto') dock.style.right = `${parseFloat(dock.style.right) + shift}px`;
      else dock.style.left = `${parseFloat(dock.style.left) - shift}px`;
    }
    // Clamp: a tall/wide card near an edge must not leave the screen.
    const r = dock.getBoundingClientRect();
    if (r.top < 0) dock.style.bottom = `${Math.max(0, parseFloat(dock.style.bottom) + r.top)}px`;
    // Card UNDER the pet (peeker / cling / resting): a card wider than the pet slides inward on its
    // own, so the pet stays exactly where the user put it.
    // (Two queued placements can run back to back: measure the card WITHOUT the slide already applied,
    // and never fall through to the whole-dock clamp below, which would move the pet.)
    if (['mode-peeker', 'mode-cling', 'mode-resting'].some(c => dock.classList.contains(c))) {
      const c = cardSlot.getBoundingClientRect();
      const applied = parseFloat(cardSlot.style.translate) || 0;
      const left = c.left - applied, right = c.right - applied;
      // Never glued to the screen's side edges: keep EDGE_GAP px of air around the card.
      const slide = left < EDGE_GAP ? EDGE_GAP - left : right > window.innerWidth - EDGE_GAP ? window.innerWidth - EDGE_GAP - right : 0;
      cardSlot.style.translate = slide ? `${Math.round(slide)}px 0` : '';
      keepCardOffBottom();
      updateClingClip();
      return;
    }
    if (r.left < 0) {
      if (dock.style.right !== 'auto') dock.style.right = `${parseFloat(dock.style.right) + r.left}px`;
      else dock.style.left = `${parseFloat(dock.style.left) - r.left}px`;
    } else if (r.right > window.innerWidth) {
      const over = r.right - window.innerWidth;
      if (dock.style.left !== 'auto') dock.style.left = `${parseFloat(dock.style.left) - over}px`;
      else dock.style.right = `${parseFloat(dock.style.right) + over}px`;
    }
    keepCardOffBottom();
  });
}

/**
 * Mode B (Blueprint V4.1 §2): the OS shows its own banner for events from the system notification
 * listeners. While such a card is up, move the dock out of the area where the OS draws banners
 * (cfg.bannerZone, from main) so pet and card don't cover it; back in place when the card closes.
 * Uses the layout box (offset*), which the `translate` lift itself doesn't change.
 */
const NATIVE_BANNER_SOURCES = new Set(['windows_nc', 'macos_nc']);
const dockOffset = { x: 0, y: 0 };
/** Move the whole dock by (x, y) px with the CSS `translate` transition (layout stays put). */
function setDockOffset(x, y) {
  x = Math.round(x); y = Math.round(y);
  if (x === dockOffset.x && y === dockOffset.y) return;
  dockOffset.x = x; dockOffset.y = y;
  dock.style.translate = x || y ? `${x}px ${y}px` : '';
  refreshHitRects(1200);
}
function setBannerLift(px) { setDockOffset(0, px); }
/** Layout box of the dock / pet without our translate (offset* ignore it), incl. static CSS transforms. */
function layoutBox(el) {
  let m = null;
  try { m = new DOMMatrixReadOnly(getComputedStyle(dock).transform); } catch { /* 'none' */ }
  const left = dock.offsetLeft + (m ? m.m41 : 0) + (el === dock ? 0 : el.offsetLeft);
  const top = dock.offsetTop + (m ? m.m42 : 0) + (el === dock ? 0 : el.offsetTop);
  return { left, top, w: el.offsetWidth, h: el.offsetHeight };
}

/**
 * Mode 1 "pet only" companion (docs/product/notifications/NOTIFICATION_MODE_REDESIGN_SPEC.md §2): the OS shows the banner,
 * the pet runs next to where banners appear (Approach), stands just above that area (Attach), reacts
 * (React), stays a moment (Cling) and walks back (Release). No card — the banner has the content.
 * With Reduced Motion, or when the OS banner area is unknown, the pet reacts where it is.
 */
const TRAVEL_MS = 700;
/** How far the pet's paws reach over an edge it clings to (px); everything lower is clipped away. */
const PAW_OVER = 14;
/**
 * Clip the pet slot `cut` px from its bottom (0 = no clip). Sides/top stay unclipped (negative
 * insets) so the bubble and the badge are never cut. The pet is drawn IN FRONT of what it clings to,
 * but only its head and paws remain — never the body over text or buttons.
 */
let clipOffTimer = null;
function clipPet(cut) {
  // The cut glides (CSS transition on clip-path) instead of snapping in one frame: the body used to
  // vanish / pop back instantly while the pose was still blending = a visible jolt. Clearing goes
  // through a zero cut first (`none` can't be interpolated), then drops the clip once it settled.
  clearTimeout(clipOffTimer);
  const on = cut > 0;
  if (on || petSlot.style.clipPath) petSlot.style.clipPath = `inset(-80% -80% ${on ? Math.round(cut) : 0}px -80%)`;
  if (!on && petSlot.style.clipPath) clipOffTimer = setTimeout(() => { if (!petSlot.dataset.clip) petSlot.style.clipPath = ''; }, 400);
  petSlot.dataset.clip = on ? String(Math.round(cut)) : '';
}
/**
 * Cling / resting on a card: the pet is in front of the card with its paws over the top edge; the
 * rest of it is clipped away so it never covers the title, text or buttons. Works for every dock
 * position (measured on screen, after layout).
 */
/**
 * The overlay covers the work area, so its bottom edge is the top of the taskbar. A card must never
 * sit flush on it: in every attachment style and dock position, its bottom stays EDGE_GAP px above.
 * When the card would go lower (pet parked at the very bottom, small margin), the whole dock is
 * raised just enough. Layout geometry, so the card's entrance transform doesn't skew it. The dock's
 * normal position comes back with placeDock() when the card closes.
 */
const EDGE_GAP = 16;
function keepCardOffBottom() {
  const card = current && !current.companion && current.el;
  if (!card || !card.isConnected) return;
  const cs = getComputedStyle(dock);
  if (cs.bottom === 'auto') return; // top / middle anchored docks grow downward only within the screen
  const zoom = Number(getComputedStyle(cardSlot).zoom) || 1;
  const dockTop = dock.getBoundingClientRect().top - dockOffset.y;
  const cardBottom = dockTop + cardSlot.offsetTop + (card.offsetTop + card.offsetHeight) * zoom;
  const over = Math.ceil(cardBottom - (window.innerHeight - EDGE_GAP));
  if (over > 0) dock.style.bottom = `${parseFloat(cs.bottom) + over}px`;
}

function updateClingClip() {
  if (current && current.companion) return; // the banner trip clips by itself
  const on = ['mode-cling', 'mode-resting'].some(c => dock.classList.contains(c));
  const card = on && current && current.el;
  if (!card) { clipPet(0); return; }
  // Layout geometry (not getBoundingClientRect): the card's entrance transform must not move the cut.
  const zoom = Number(getComputedStyle(cardSlot).zoom) || 1;
  const petBottom = petSlot.offsetTop + petSlot.offsetHeight;
  const cardTop = cardSlot.offsetTop + card.offsetTop * zoom;
  clipPet(petBottom - cardTop - (dock.classList.contains('mode-resting') ? 8 : PAW_OVER));
}
/** Bottom-edge clinging puts the slot this far below the edge (peek framing: head + paws above). */
const clingSink = (pet) => Math.round(pet.w * 0.3);

function companionApproach() {
  const z = cfg && cfg.bannerZone;
  if (!z) return false;
  const pet = layoutBox(petSlot);
  // Reduced Motion: react in place (no run across the screen) — unless "in place" is under the OS
  // banner, which is drawn above every app window and would hide the pet completely. Then it moves
  // straight to the banner edge (short fade-like move, no running).
  if (eff.reducedMotion) {
    const covered = pet.left < z.x + z.w && pet.left + pet.w > z.x && pet.top < z.y + z.h && pet.top + pet.h > z.y;
    if (!covered) return false;
  }
  const gap = 6;
  const tx = Math.max(0, Math.min(window.innerWidth - pet.w, z.x + z.w * 0.72 - pet.w / 2));
  // Windows: paws on the toast's top edge (concept v2). macOS: the banner sits under the menu bar,
  // so the pet stands just below it.
  const ty = z.edge === 'top' ? Math.min(window.innerHeight - pet.h, z.y + z.h + gap) : Math.max(0, z.y - pet.h + clingSink(pet));
  const dx = tx - pet.left, dy = ty - pet.top;
  if (Math.hypot(dx, dy) < 4) return false;
  if (eff.reducedMotion) { setDockOffset(dx, dy); return false; }
  dock.classList.add('traveling');
  if (Math.abs(dx) > 120) stage.setHold('courierRun', dx < 0 ? 'left' : 'right');
  setDockOffset(dx, dy);
  return Math.abs(dx) > 120;
}
function companionRelease(done) {
  clipPet(0);
  stage.setHold(null);
  const moved = dockOffset.x || dockOffset.y;
  if (!moved) { done(); return; }
  dock.classList.add('traveling');
  if (Math.abs(dockOffset.x) > 120 && !eff.reducedMotion) stage.setHold('courierRun', dockOffset.x > 0 ? 'left' : 'right');
  setDockOffset(0, 0);
  setTimeout(() => { dock.classList.remove('traveling'); done(); }, eff.reducedMotion ? 0 : TRAVEL_MS);
}

function showCompanion(item) {
  // A hidden placeholder keeps the one-card lifecycle (timer, finished/rendered actions, preemption)
  // without drawing anything: it lives in the card slot, which stays collapsed (no .has-card).
  const el = document.createElement('div');
  el.className = 'companion-ghost';
  el.hidden = true;
  el.innerHTML = '<div class="progress"><i></i></div>';
  // The pet stays exactly as long as the OS banner (main reads the system setting: Windows
  // "dismiss notifications after", default 5 s) — it leaves together with the banner, not later.
  const duration = (cfg && cfg.bannerMs) || Math.min(item.duration || 6000, 6500);
  const shownAt = performance.now();
  current = { item: { ...item, duration }, el, remaining: duration, startedAt: 0, timer: null, timers: [], busy: 0, companion: true };
  cardSlot.innerHTML = '';
  cardSlot.appendChild(el);
  dock.classList.remove('hidden', 'leaving');
  placeDock();
  stage.hold('card');
  stage.setAnnoying(false);
  stage.setReducedMotion(eff.reducedMotion || item.motion === 'reduced');
  const before = `${dockOffset.x},${dockOffset.y}`;
  const ran = companionApproach();
  const moved = before !== `${dockOffset.x},${dockOffset.y}`;
  const z = cfg && cfg.bannerZone;
  const clings = moved && z && z.edge !== 'top';
  const react = () => {
    if (!current || current.el !== el) return;
    stage.setHold(clings ? 'cling' : null, 'left');
    if (clings) clipPet(clingSink(layoutBox(petSlot)) - PAW_OVER);
    dock.classList.remove('traveling');
    stage.setEmotion(item.emotion);
    stage.play('pop');
    audio.play('reaction', { emotion: item.emotion, silent: !!item.silent });
    // The banner's time started when it appeared, not when the pet arrived: don't overstay it.
    current.remaining = Math.max(1200, duration - (performance.now() - shownAt));
    startTimer();
  };
  requestAnimationFrame(() => requestAnimationFrame(() => { if (api) api.onAction('rendered', { id: item.id, renderedAt: Date.now() }); }));
  if (ran || moved) cardLater(react, eff.reducedMotion ? 200 : TRAVEL_MS); else requestAnimationFrame(react);
}
function avoidBannerZone(item) {
  // A Mode 1 companion trip owns the dock offset (Approach / Release); a late frame must not undo it.
  if (current && current.companion) return;
  const z = cfg && cfg.bannerZone;
  if (!z || !item || !NATIVE_BANNER_SOURCES.has(item.source) || dock.classList.contains('hidden')) { setBannerLift(0); return; }
  let m = null;
  try { m = new DOMMatrixReadOnly(getComputedStyle(dock).transform); } catch { /* 'none' */ }
  const left = dock.offsetLeft + (m ? m.m41 : 0), top = dock.offsetTop + (m ? m.m42 : 0);
  const w = dock.offsetWidth, h = dock.offsetHeight;
  const overlaps = left < z.x + z.w && left + w > z.x && top < z.y + z.h && top + h > z.y;
  if (!overlaps) { setBannerLift(0); return; }
  const gap = 8;
  if (z.edge === 'top') setBannerLift(Math.min(z.y + z.h + gap - top, Math.max(0, window.innerHeight - (top + h))));
  else setBannerLift(Math.max(z.y - gap - (top + h), -top));
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

/** Point the AudioController at the character on screen (its voice bank, procedural voice, bell). */
function audioCharacter(id) {
  const sp = getSpecies(id);
  audio.setCharacter(sp.id, { kind: sp.sound, bell: sp.accessory === 'collar_bell' });
}

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
  stageEl.style.opacity = String(Math.max(0.3, Math.min(1, Number(a.petOpacity) || 1))); // the pet only: bubble, badge and cards stay opaque
  dock.style.setProperty('--card-scale', Number(n.cardScale) || 1);

  if (!isDraggingPet) placeDock();
  requestAnimationFrame(() => avoidBannerZone(current && current.item)); // bannerMode may have changed
  pomo = payload.pomodoro || null;
  renderPomo();

  const prevMode = eff.mode && eff.mode.id;
  eff = payload.effective || eff;
  audio.configure({
    enabled: s.sounds.enabled && eff.mode.sound !== false && !eff.hidden,
    volume: s.sounds.volume,
    channels: s.sounds.channels,
    recorded: s.sounds.recordedVoices !== false,
    assetBase: payload.assetBase
  });
  if (!petOverride) audioCharacter(s.activePet);

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
    window.__cpcDiagnostics = { frameStats: () => stage.frameStats(), transitions: () => stage.anim.lastProfile, bodyBox: () => stage.bodyBox(), headBox: () => stage.headBox(), programs: () => (stage.renderer.info.programs || []).map(p => p.name) };
    (window.requestIdleCallback || ((fn) => setTimeout(fn, 500)))(warmOverlay, { timeout: 3000 });
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
    audio.play('pet');
  } else if (type === 'rejected') {
    const lines = getLang() === 'en' ? t('reject') : ((preset && preset.rejectLines && preset.rejectLines.length) ? preset.rejectLines : t('reject'));
    say(lines[Math.floor(Math.random() * lines.length)], 'angry');
    audio.play('reject');
  } else if (type === 'landed') {
    audio.play('land');
    if (data && data.impact > 1.2) dustPuff(Math.min(1, data.impact / 3));
  } else if (type === 'body-double') {
    // Only a real double tap on the pet itself — never a quick double click on a card button
    // (e.g. Approve's "click again to confirm") that ended up next to the pet's body.
    if (performance.now() - lastCardPress < 800) return;
    if (api) api.openControlCenter();
  } else if (type === 'kick-impact') {
    const el = cardSlot.querySelector('.card:not(.kicked)');
    if (el && !(current && current.el === el)) { el.classList.add('kicked'); audio.play('kick'); }
  }
}

let lastBreathSet = 0;
/** Keep the unread badge beside the pet's head (it used to be pinned to a fixed corner of the pet's
 *  box and covered the ear / face whenever the head moved: hops, stretch while held, other pets). */
let badgeXY = null;
function placeBadge() {
  if (badgeEl.hidden || !stage) return;
  const hb = stage.headBox();
  if (!hb) return;
  const sr = stageEl.getBoundingClientRect(), pr = petSlot.getBoundingClientRect();
  const bw = badgeEl.offsetWidth || 26, bh = badgeEl.offsetHeight || 26;
  // Centred on the head box's top-right corner: the head is round, so that corner lies clear of it
  // (ears included) for every pet, model and size. Kept inside the pet's box.
  const x = Math.max(0, Math.min(pr.width - bw, sr.left - pr.left + hb.r - bw / 2));
  const y = Math.max(0, Math.min(pr.height - bh, sr.top - pr.top + hb.t - bh / 2));
  if (badgeXY && Math.abs(badgeXY[0] - x) < 0.5 && Math.abs(badgeXY[1] - y) < 0.5) return;
  badgeXY = [x, y];
  badgeEl.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
}

function onStageFrame({ breath, t: frameTime }) {
  placeBadge();
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

/**
 * Compact card (UI/UX JSON v2 components.notificationCard.compact): ≈340 px; header = app icon +
 * name + emotion + time + close; 1-line title; 2-line body; at most 2 actions. Kick stays as an
 * icon in the header (existing feature), the pet tip line is dropped.
 */
function compactCardHtml(item, app, emo, emoLabel, arrival) {
  const acts = item.actions || [];
  const openTxt = item.openLabel === 'chat' ? t('openChat') : item.openLabel === 'app' ? t('openApp') : item.url || item.openLabel === 'link' ? t('openUrl') : t('openDone');
  const canRead = !!(item.url || item.openLabel === 'chat' || item.openLabel === 'app');
  const approve = acts.includes('approve') && item.source === 'composio' && !(item.items || []).length;
  let footer;
  if (acts.includes('break-start')) footer = `<button class="btn primary brk" data-brk="break-start">${esc(t('breakStart'))}</button><button class="btn brk ghost" data-brk="break-snooze">${esc(t('breakSnooze'))}</button><button class="btn open" hidden></button>`;
  else if (approve) footer = `<button class="btn primary open">${esc(openTxt)}</button><button class="btn approve">${esc(t('approve'))}</button>`;
  else if (canRead) footer = `<button class="btn primary open">${esc(openTxt)}</button><button class="btn ghost read">${esc(t('markRead'))}</button>`;
  else footer = `<button class="btn primary open">${esc(openTxt)}</button>`;
  const prio = item.priority === 'critical' || item.priority === 'important' ? `<i class="prio-dot prio-${esc(item.priority)}" title="${esc(t('priority')[item.priority] || '')}"></i>` : '';
  return `
    <div class="card-inner">
      <div class="card-shine"></div>
      <header>
        <span class="app-ico" aria-hidden="true">${esc(app.icon)}</span><b class="app-name">${esc(app.label)}</b>${prio}
        <span class="chip emo">${emo.emoji} ${esc(emoLabel)}</span>
        <time class="card-time" datetime="${arrival.iso}" title="${esc(arrival.text)}">${esc(String(arrival.text).split(' · ')[0])}</time>
        <button class="icon-btn kick-ico kick" title="${esc(t('kickTitle'))}" aria-label="${esc(t('kickTitle'))}">🦶</button>
        <button class="icon-btn close" aria-label="${esc(t('close'))}" title="${esc(t('close'))}">✕</button>
      </header>
      ${item.meta ? ticketHtml(item) : `<h3 class="title">${esc(item.title)}</h3>${item.message ? `<p class="message">${esc(item.message).replace(/\n/g, ' ')}</p>` : ''}`}
      ${(item.items || []).length ? `<ul class="rows">${item.items.map(r => `
        <li class="row" data-key="${esc(r.key)}">
          <div class="row-main"><b>${esc(r.title)}</b>${r.subtitle ? `<small>${esc(r.subtitle)}</small>` : ''}</div>
          <div class="row-btns">
            ${r.url ? `<button class="btn row-open" data-url="${esc(r.url)}" title="${esc(t('openUrl'))}">↗</button>` : ''}
            ${(r.actions || []).includes('approve') && item.source === 'composio' ? `<button class="btn approve row-approve">${esc(t('approve'))}</button>` : ''}
          </div>
        </li>`).join('')}</ul>${item.moreCount ? `<p class="rows-more">${esc(t('moreRows').replace('{n}', item.moreCount))}</p>` : ''}` : ''}
      <footer>${footer}</footer>
      <div class="progress"><i></i></div>
    </div>`;
}

/**
 * First-notification hitch (measured): the GPU compiled the shaders for the card's look (big soft
 * shadows, gradients, 3D entrance) in the very frame the first card appeared, ~80 ms twice, and the
 * first sound created the AudioContext (~50 ms). Pay both once while the overlay is idle: play the
 * real entrance of a sample card at 1 % opacity (imperceptible, never hit-tested: it isn't a hit
 * rect and has pointer-events: none). A real card arriving meanwhile removes it at once.
 */
let warmBox = null;
function cancelWarm() { if (warmBox) { warmBox.remove(); warmBox = null; } }
function warmOverlay() {
  try { audio.synth.ensure(); } catch { /* no audio */ }
  if (current || warmBox) return; // a real card already paid the cost
  try {
    const box = dock.cloneNode(false);
    box.removeAttribute('id');
    [...box.classList].forEach((c) => { if (/^mode-|^(hidden|leaving|traveling|custom-pos|courier-enter)$/.test(c)) box.classList.remove(c); });
    box.classList.add('mode-billboard', 'has-card', 'warm-card');
    box.style.cssText = 'position:fixed;right:24px;bottom:24px;left:auto;top:auto;opacity:.01;pointer-events:none;translate:none;z-index:-1';
    box.setAttribute('aria-hidden', 'true');
    const slot = document.createElement('div');
    slot.className = 'card-slot';
    const el = buildCard({ id: 'warm', app: 'github', title: '✅ Tác vụ hoàn thành · Tin nhắn mới 💬', message: 'Đã xem ✓ — Ừ, mình gửi bản cập nhật rồi nhé! 🎉🐾', emotion: 'happy', priority: 'important', receivedAt: Date.now(), url: 'x', openLabel: 'link' });
    slot.appendChild(el);
    box.appendChild(slot);
    document.body.appendChild(box);
    warmBox = box;
    void box.offsetHeight; // fonts + text shaping
    requestAnimationFrame(() => requestAnimationFrame(() => { if (warmBox === box) el.classList.add('in'); }));
    setTimeout(() => { if (warmBox === box) cancelWarm(); }, 1200);
  } catch { /* warm-up is an optimisation only */ }
}

function buildCard(item) {
  const base = APP_META[item.app] || { label: item.app && item.app !== 'default' ? item.app : t('defaultApp'), icon: '🔔' };
  const app = { ...base, label: item.appName || (getLang() === 'en' && I18N.en.apps[item.app]) || base.label };
  const emo = EMO[item.emotion] || EMO.happy;
  const emoLabel = (getLang() === 'en' && I18N.en.emo[item.emotion]) || emo.label;
  const prio = t('priority')[item.priority];
  const arrival = formatArrival(item.sourceCreatedAt || item.desktopReceivedAt || item.receivedAt);
  const el = document.createElement('div');
  const compact = !cfg || cfg.settings.notifications.cardLayout !== 'expanded';
  el.className = `card emo-${item.emotion}${item.annoying ? ' annoying' : ''} prio-${item.priority || 'normal'}${compact ? ' compact' : ''}`;
  if (compact) { el.innerHTML = compactCardHtml(item, app, emo, emoLabel, arrival); return el; }
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
        ${item.url || item.openLabel === 'chat' || item.openLabel === 'app' ? `<button class="btn ghost read">${esc(t('markRead'))}</button>` : ''}
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
  cancelWarm();
  if (current) finishCard('replace');
  flushPendingCleanup();
  dndSleeping = false;
  if (item.companion) { showCompanion(item); return; }
  if (dockOffset.x || dockOffset.y) { dock.classList.remove('traveling'); setDockOffset(0, 0); } // a companion trip was cut short by this card
  clipPet(0);
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
  requestAnimationFrame(() => { if (current && current.el === el) { keepCardOffBottom(); avoidBannerZone(item); updateClingClip(); } }); // after placeDock's own frame
  cardLater(() => { keepCardOffBottom(); updateClingClip(); }, 450); // again once the card's entrance (scale) has settled
  stage.hold('card');
  stage.setAnnoying(item.annoying);
  const wantPet = item.pet && item.pet !== cfg.settings.activePet ? item.pet : null;
  if (wantPet !== petOverride) { stage.setSpecies(wantPet || cfg.settings.activePet); audioCharacter(wantPet || cfg.settings.activePet); petOverride = wantPet; }

  const reveal = () => {
    if (!current || current.el !== el) return; // replaced before it was revealed
    el.classList.add('in');
    stage.setHold(mode === 'courier' ? null : mode, side());
    stage.setReducedMotion(eff.reducedMotion || item.motion === 'reduced');
    stage.setEmotion(item.emotion);
    audio.play('reaction', { emotion: item.emotion, silent: !!item.silent });
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
  const readBtn = el.querySelector('.read');
  if (readBtn) readBtn.addEventListener('click', (e) => { e.stopPropagation(); finishCard('read'); });
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
  const closeBtn = el.querySelector('header .icon-btn.close');
  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); finishCard('close'); });
}

function startTimer() {
  if (!current) return;
  const cur = current;
  cur.startedAt = performance.now();
  const bar = cur.el.querySelector('.progress i');
  bar.style.transition = 'none';
  bar.style.transform = `scaleX(${cur.remaining / cur.item.duration})`;
  requestAnimationFrame(() => {
    // The card may have finished (current = null) before this frame runs.
    if (current !== cur || !cur.timer) return;
    bar.style.transition = `transform ${cur.remaining}ms linear`;
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
  const { item, el, companion } = current;
  clearTimeout(current.timer);
  current.timers.forEach(clearTimeout);
  current = null;
  dock.classList.remove('courier-enter');

  if (companion) {
    el.remove();
    const done = () => {
      if (current) return; // the next event already took over the pet
      stage.setHold(null);
      stage.release('card');
      stage.setReducedMotion(eff.reducedMotion);
      stage.setEmotion(residentEmotion());
      if (!cfg.settings.appearance.residentPet || eff.hidden) {
        dock.classList.add('leaving');
        setTimeout(() => { if (!current) { dock.classList.add('hidden'); dock.classList.remove('leaving'); setCapture(false); } }, 450);
      }
    };
    if (how === 'replace') { stage.release('card'); if (api) api.onAction('finished', { id: item.id }); return; }
    if (api) api.onAction('finished', { id: item.id });
    companionRelease(done);
    return;
  }

  if (how === 'close' && api) api.onAction('close', { id: item.id });
  if (how === 'click' && api) api.onAction('click', { id: item.id, url: item.url, source: item.source, externalId: item.externalId });
  if (how === 'read' && api) api.onAction('read', { id: item.id });

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
    setBannerLift(0);
    clipPet(0);
    placeDock();
    if (eff.hidden) applyPresence();
    stage.setHold(null);
    stage.setAnnoying(residentAnnoying());
    stage.release('card');
    if (petOverride) { stage.setSpecies(cfg.settings.activePet); audioCharacter(cfg.settings.activePet); petOverride = null; }
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
  el.classList.add(how === 'click' || how === 'read' ? 'out-zoom' : 'out');
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
      say(t('breakDone'), 'love'); audio.play('bell');
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
const LOOK_RANGE = 350; // px from the pet's head (CP-13)
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
    let overPet = false;
    const r = stageEl.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    // "Cho phép click xuyên": the pet never takes the mouse (clicks reach the app below); cards still do.
    const petPassThrough = !!(cfg && cfg.settings.appearance.petClickThrough);
    if (inside && stage && stage.hitTest && !petPassThrough) overPet = stage.hitTest(e).over;
    // The pet slot has pointer-events: none (CSS), so the element under the cursor is the card when
    // there is one — even where the pet is drawn over the card's edge.
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const overCard = !!(under && ((current && current.el.contains(under)) || (!badgeEl.hidden && badgeEl.contains(under))));
    setCapture(!!(overCard || overPet));
  }
  // Proximity: the pet notices a nearby cursor (wakes from hibernation only when close).
  // CP-13: glance at a cursor within LOOK_RANGE of the pet; look ahead again when it leaves. Paused
  // while a card is up (except "Ló đầu", whose eyes follow the cursor by design).
  if (stage) {
    const pr = petSlot.getBoundingClientRect();
    const cx = pr.left + pr.width / 2, cy = pr.top + pr.height * 0.4;
    const cardBusy = current && !current.companion && current.item.presentationMode !== 'peeker';
    if (!cardBusy && Math.hypot(e.clientX - cx, e.clientY - cy) < LOOK_RANGE) stage.lookAtScreenPoint(e.clientX, e.clientY);
    else stage.lookCenter();
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
let shakeTurns = [];    // times the drag direction flipped at speed → "shaken" → dizzy
let lastDirX = 0;

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


/* ------------------------------------------------------------------ Unread badge */
let badgeCount = 0;
function renderBadge() {
  const on = !!(cfg && cfg.settings.appearance.showBadge !== false) && badgeCount > 0;
  const prev = badgeEl.textContent;
  badgeEl.hidden = !on;
  badgeEl.textContent = badgeCount > 99 ? '99+' : String(badgeCount);
  badgeEl.classList.toggle('wide', badgeCount > 9);
  if (on && prev !== badgeEl.textContent) { badgeEl.classList.remove('bump'); void badgeEl.offsetWidth; badgeEl.classList.add('bump'); }
  if (on && stage) { badgeXY = null; placeBadge(); }
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
    audio.play('grab');
    { const line = randomQuote('pickedUp'); say(line, 'angry'); speak(line); }
    dragSayInterval = setInterval(() => {
      if (isDraggingPet) {
        audio.play('grab'); // cooldown keeps this from becoming a constant jingle
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

    // Direction flips at speed = shaking (→ dizzy after landing).
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
    if (stage) { stage.setGrabbed(false); stage.suppressClick = performance.now(); }
    const shaken = shakeTurns.length >= 4;
    if (shaken && stage) stage.setDizzy();
    { const line = randomQuote(shaken ? 'dizzy' : 'landed'); say(line, shaken ? 'angry' : 'happy'); speak(line); }
    // The pet stays exactly where it was let go (it drops to the floor there, in place).
    savePetPosition();
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
    // Main just made the window click-through again: forget our capture so the next hover re-asks.
    mouseCaptured = false;
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
