/**
 * Desktop Control Center — user-friendly tabs + an optional "Theo dõi" (monitoring) tab.
 *
 *   🏠 Trang chủ   🐱 Thú cưng   🔔 Thông báo (Hiển thị · Tập trung · Ưu tiên)   📥 Hộp thư
 *   🔌 Kết nối (system replacement wizard · my apps · dynamic catalog)   ⚙️ Cài đặt
 *   📊 Theo dõi — only when Settings → "Chế độ nâng cao" is on: stats, latency, technical
 *      adapter cards, emotion rules, test tools.
 *
 * Served at http://127.0.0.1:3721 and loaded by the native Electron settings window.
 */
import { PetStage } from '../renderer/js/pet/pet-stage.js';
import { SoundKit } from '../renderer/js/sound.js';
import { setLanguage, tr } from './i18n.js';

const TOKEN = document.querySelector('meta[name="pet-api-token"]').content;
const main = document.getElementById('main');
const nav = document.getElementById('nav');
const stageHome = document.getElementById('stage-home');
const previewEl = document.getElementById('preview-stage');
const toastEl = document.getElementById('toast');
const modalEl = document.getElementById('modal');
const sound = new SoundKit();

let S = null; // full app state from /api/state
let route = 'home';
let sub = '';
let stage = null;
let previewEmotion = null; // null/'idle' → the chosen attitude's resting pose
const thumbs = {};
const catalogState = { q: '', category: '', items: null, loading: false, error: '' };

/* ================================================================== utils */

async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'X-Pet-Token': TOKEN, ...(raw ? { 'Content-Type': 'application/octet-stream' } : body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: raw || (body !== undefined ? JSON.stringify(body) : undefined)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function patchOf(path, value) {
  const keys = path.split('.');
  const out = {};
  let cur = out;
  keys.forEach((k, i) => { cur[k] = i === keys.length - 1 ? value : {}; cur = cur[k]; });
  return out;
}

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = tr(msg);
  toastEl.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

/** "5 phút trước · 14:32 04/11/2026" — relative + the exact arrival date/time. */
function arrivedAt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const loc = S && S.settings.appearance.language === 'en' ? 'en-GB' : 'vi-VN';
  const abs = `${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  return Date.now() - ts < 86400000 ? `${timeAgo(ts)} · ${abs}` : abs;
}

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return new Date(ts).toLocaleString(S && S.settings.appearance.language === 'en' ? 'en-US' : 'vi-VN');
}

const emo = (id) => (S.emotions.find(e => e.id === id) || { emoji: '🐾', label: id, assetKey: id });
const emotionOptions = (sel) => S.emotions.map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${e.emoji} ${e.label} (${e.id})</option>`).join('');
const advanced = () => !!(S && S.settings.system.advancedMode);
const adapter = (id) => S.adapters.find(a => a.id === id);
const isOn = (a) => a && (a.status === 'Connected' || a.status === 'Permission Limited');

/* ================================================================== settings binding */

let saveTimer = null;
let pendingPatch = {};
function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) a[k] = deepMerge(a[k] && typeof a[k] === 'object' ? a[k] : {}, v);
    else a[k] = v;
  }
  return a;
}

function queueSave(patch, immediate = false) {
  if (patch.appearance && patch.appearance.language) setLanguage(patch.appearance.language);
  if (patch.appearance && patch.appearance.uiTheme) applyTheme(patch.appearance.uiTheme);
  pendingPatch = deepMerge(pendingPatch, patch);
  deepMerge(S.settings, patch);
  applyPreviewSettings();
  if (patch.mood && 'followAttitude' in patch.mood) setTimeout(() => render(), 0);
  if (patch.personality && stage) { setPreviewEmotion('idle'); stage.play('wave'); } // show the new attitude (the desktop pet follows via settings)
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, immediate ? 0 : 280);
}

async function flushSave() {
  const p = pendingPatch;
  pendingPatch = {};
  const navChanged = p.system && 'advancedMode' in p.system;
  try {
    S.settings = await api('/api/settings', { method: 'PUT', body: p });
    syncInputs();
    flashSaved();
    if (navChanged) { renderNav(); if (route === 'monitor' && !advanced()) location.hash = '#settings'; }
  } catch (err) { toast(`Lưu thất bại: ${err.message}`, 'error'); }
}

function flashSaved() {
  const b = document.getElementById('saved-badge');
  if (!b) return;
  b.classList.add('show');
  clearTimeout(flashSaved.t);
  flashSaved.t = setTimeout(() => b.classList.remove('show'), 1200);
}

function syncInputs(root = document) {
  root.querySelectorAll('[data-setting]').forEach(el => {
    const v = get(S.settings, el.dataset.setting);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'radio') el.checked = String(v) === el.value;
    else if (document.activeElement !== el) el.value = v ?? '';
  });
  root.querySelectorAll('[data-out]').forEach(el => {
    const v = get(S.settings, el.dataset.out);
    const fmt = el.dataset.fmt;
    el.textContent = fmt === 'sec' ? `${Math.round(v / 1000)}s` : fmt === 'pct' ? `${Math.round(v * 100)}%` : fmt === 'x' ? `×${Number(v).toFixed(2)}` : fmt === 'px' ? `${v}px` : v;
  });
  root.querySelectorAll('[data-choice]').forEach(el => {
    el.classList.toggle('selected', String(get(S.settings, el.dataset.choice)) === el.dataset.value);
  });
}

// App logos load from Composio's CDN; offline or blocked → show a neutral icon instead of a broken image.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || img.dataset.fallback) return;
  img.dataset.fallback = '1';
  const span = document.createElement('span');
  span.textContent = '🧩';
  img.replaceWith(span);
}, true);

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-setting]');
  if (!el || el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') return;
  let v = el.value;
  if (el.type === 'range' || el.type === 'number') v = Number(v);
  if (el.type === 'time' && !/^\d{2}:\d{2}$/.test(v)) return;
  queueSave(patchOf(el.dataset.setting, v));
  const out = document.querySelector(`[data-out="${el.dataset.setting}"]`);
  if (out) syncInputs(out.parentElement);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-setting]');
  if (!el) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type === 'number') v = Number(v);
  // <select> of numbers (poll interval, break length…) → keep the setting's numeric type
  if (el.tagName === 'SELECT' && typeof get(S.settings, el.dataset.setting) === 'number' && /^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
  queueSave(patchOf(el.dataset.setting, v), true);
});

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-choice]');
  if (c) {
    queueSave(patchOf(c.dataset.choice, c.dataset.value), true); syncInputs();
    if (c.dataset.choice === 'chat.mode') { const m = document.querySelector('.chat-mentions'); if (m) m.hidden = c.dataset.value !== 'mentions'; }
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'chat-names') return;
  const names = e.target.value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean).slice(0, 10);
  queueSave({ chat: { names } }, true);
});

/* ================================================================== theme */

const UI_THEMES = [
  ['peach', 'Đào hồng', ['#FF8E9C', '#FFB36B']],
  ['mint', 'Bạc hà', ['#4CC9A0', '#7FD6B0']],
  ['lavender', 'Oải hương', ['#A28BF6', '#C49BFA']],
  ['ocean', 'Đại dương', ['#5B9BF8', '#5EC8F2']],
  ['sunset', 'Hoàng hôn', ['#F7A04B', '#F7C548']],
  ['midnight', 'Đêm (tối)', ['#24212F', '#FF8E9C']]
];
function applyTheme(id) {
  document.documentElement.dataset.theme = id || 'peach';
}

/* ================================================================== 3D preview */

/** 👥 Relationship groups (Blueprint §5.3): the user names people; the pet never guesses. */
function contactsPanel() {
  const groups = S.contactGroups || {};
  const list = S.settings.contacts || [];
  const groupOpts = Object.entries(groups).map(([id, g]) => `<option value="${id}">${g.emoji} ${esc(g.label)}</option>`).join('');
  const effect = (g, c) => {
    const e = c && c.emotion ? c.emotion : g.emotion;
    return [e ? `${emo(e).emoji} ${emo(e).label}` : '', g.priority === 'important' ? '⭐ ưu tiên' : '', g.bypassCooldown ? 'không giới hạn tin' : '', g.inbox ? '📥 vào Hộp thư' : ''].filter(Boolean).join(' · ');
  };
  return `
      <section class="panel contacts-panel">
        <h3>👥 Người quen <small class="muted">bé nhận ra người gửi theo đúng tên bạn nhập — không tự đoán</small></h3>
        <div class="contact-add">
          <input id="ct-name" type="text" maxlength="80" autocomplete="off" placeholder="Tên hiện trong thông báo, vd: Mai Phạm">
          <select id="ct-group">${groupOpts}</select>
          <select id="ct-emo"><option value="">Cảm xúc theo nhóm</option>${emotionOptions('')}</select>
          <button class="btn btn-primary small" data-action="contact-add">＋ Thêm</button>
        </div>
        ${list.length ? `<ul class="contact-list">${list.map((c, i) => { const g = groups[c.group] || { emoji: '👤', label: c.group }; return `
          <li><span class="ct-emoji">${g.emoji}</span><div><b>${esc(c.name)}</b><small>${esc(g.label)} · ${esc(effect(g, c))}</small></div>
          <button class="icon-btn" data-action="contact-remove" data-arg="${i}" title="Xóa">✕</button></li>`; }).join('')}</ul>`
        : '<p class="muted">Chưa có ai. Ví dụ: thêm người yêu vào 💞 để bé luôn bắn tim khi họ nhắn, hay thêm sếp vào 👔 để tin của sếp luôn được ưu tiên.</p>'}
        <p class="muted small">Tên người quen thắng cả thái độ đã chọn. Bé so khớp với người gửi, dòng "Tên: …" trong tin nhóm, hoặc tiêu đề cuộc chat.</p>
      </section>`;
}

function presetFor(id) { return S.presets[id] || S.presets.sweet_friendly; }

function ensureStage() {
  if (stage) return stage;
  stage = new PetStage(previewEl, {
    species: S.settings.activePet,
    assetBase: '/assets/',
    ambient: true,
    onEvent: (type) => {
      if (type === 'petted') { sound.purr(); bubble('Purrr~ 💕'); }
      if (type === 'rejected') { const l = presetFor(S.settings.personality).rejectLines; bubble(l[Math.floor(Math.random() * l.length)]); sound.hmph(); }
      if (type === 'kick-impact') sound.whoosh();
    }
  });
  applyPreviewSettings();
  return stage;
}

function applyPreviewSettings() {
  if (!stage) return;
  stage.setPreset(presetFor(S.settings.personality));
  stage.setIntensity(S.settings.sounds.animationIntensity);
  stage.setPetSensitivity(S.settings.sounds.petSensitivity);
  sound.configure({ enabled: S.settings.sounds.enabled, volume: S.settings.sounds.volume });
}

function setPreviewEmotion(id, kind = 'try') {
  previewEmotion = id;
  ensureStage();
  // "Waiting" previews the personality's resting pose, exactly as the desktop pet shows it.
  const preset = presetFor(S.settings.personality);
  const shown = id === 'idle' ? (preset.restEmotion || 'idle') : id;
  stage.setEmotion(shown);
  if (shown !== 'idle') stage.hold('mood'); else stage.release('mood'); // keep the pose animating
  stage.setAnnoying(preset.annoyingEmotions.includes(shown));
  document.querySelectorAll('[data-preview-emotion]').forEach(b => b.classList.toggle('active', b.dataset.previewEmotion === id));
  const label = document.getElementById('preview-label');
  if (label) label.textContent = id === 'idle' ? `${preset.emoji} ${preset.name} · lúc rảnh` : `${kind === 'notif' ? 'Vừa nhận thông báo' : 'Thử phản ứng'}: ${emo(id).emoji} ${emo(id).label}`;
}

function bubble(text) {
  const b = document.querySelector('.preview-bubble');
  if (!b) return;
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bubble.t);
  bubble.t = setTimeout(() => b.classList.remove('show'), 1600);
}

function mountPreview(hostId) {
  const host = document.getElementById(hostId);
  if (!host) { stageHome.appendChild(previewEl); return; }
  host.appendChild(previewEl);
  ensureStage();
  stage.resize();
  stage.wake(1500);
}

const previewControls = ({ emotions = true } = {}) => `
  <div class="preview-wrap">
    <div class="preview-host" id="preview-host"><div class="preview-bubble"></div><div class="preview-floor"></div></div>
    <div class="preview-label" id="preview-label"></div>
    ${emotions ? `<h4 class="pad-title">🎭 Thử phản ứng <small>chỉ xem trước bé phản ứng thế nào khi có thông báo — không đổi cấu hình</small></h4>
    <div class="emotion-pad">
      ${S.emotions.map(e => `<button class="emo-btn" data-preview-emotion="${e.id}" title="${esc(e.meaning)}"><span>${e.emoji}</span><small>${e.label}</small></button>`).join('')}
    </div>` : ''}
    <div class="action-row">
      <button class="chip-btn" data-action="stage-play" data-arg="wave">👋 Vẫy tay</button>
      <button class="chip-btn" data-action="stage-play" data-arg="pet">💕 Vuốt ve</button>
      <button class="chip-btn" data-action="stage-play" data-arg="kick">🦶 Đá</button>
    </div>
  </div>`;

async function makeThumbnails() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:260px;height:280px';
  document.body.appendChild(host);
  const tmp = new PetStage(host, { species: 'cat_mochi', ambient: false, interactive: false, assetBase: '/assets/' });
  for (const c of S.characters) {
    tmp.setSpecies(c.id);
    tmp.setEmotion('happy');
    for (let i = 0; i < 40; i++) tmp.update(0.03);
    thumbs[c.id] = tmp.snapshot();
  }
  tmp.dispose();
  host.remove();
}

/* ================================================================== building blocks */

const H = {
  head(title, subtitle, right = '') {
    return `<header class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="head-right">${right}<span id="saved-badge" class="saved-badge">✓ Đã lưu</span></div></header>`;
  },
  toggle(path, label, desc = '') {
    return `<label class="toggle-row"><div><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</div><input type="checkbox" data-setting="${path}"><span class="switch"></span></label>`;
  },
  slider(path, label, min, max, step, fmt = '') {
    return `<label class="slider-row"><div class="slider-top"><b>${label}</b><span class="val" data-out="${path}" data-fmt="${fmt}"></span></div><input type="range" data-setting="${path}" min="${min}" max="${max}" step="${step}"></label>`;
  },
  number(path, label, min, max, desc = '') {
    return `<label class="field"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}<input type="number" data-setting="${path}" min="${min}" max="${max}"></label>`;
  },
  tabs(base, list) {
    return `<div class="subtabs">${list.map(([id, label]) => `<a href="#${base}/${id}" class="${sub === id ? 'active' : ''}">${label}</a>`).join('')}</div>`;
  }
};

const PRIORITY_LABEL = { critical: '🚨 Khẩn cấp', important: '⭐ Quan trọng', normal: '• Bình thường', low: '💤 Ít quan trọng' };
const FRIENDLY_REASON = {
  low_priority: 'Ít quan trọng', cooldown: 'Nhiều tin liên tiếp', app_muted: 'Ứng dụng đã tắt tiếng', contact_ignored: 'Người quen đang để Bỏ qua', presence_hidden: 'Lúc thú cưng đang ẩn',
  presence_minimal: 'Chế độ tối giản', queue_overflow: 'Quá nhiều tin cùng lúc', manual_test: 'Thử nghiệm', not_mentioned: 'Tin nhóm không nhắc tên bạn'
};
const friendlyReason = (r) => FRIENDLY_REASON[r] || (/^mode_/.test(r || '') ? 'Đang ở chế độ tập trung' : '');
const STATUS_CLASS = { 'Connected': 'ok', 'Disconnected': 'off', 'Requires Authorization': 'warn', 'Permission Limited': 'warn', 'Unsupported': 'na', 'Error': 'err' };
const STATUS_VI = { 'Connected': 'Đã kết nối', 'Disconnected': 'Chưa kết nối', 'Requires Authorization': 'Cần xác thực', 'Permission Limited': 'Quyền hạn chế', 'Unsupported': 'Không hỗ trợ', 'Error': 'Lỗi' };
const FRIENDLY_STATUS = { 'Connected': ['ok', 'Đang hoạt động'], 'Permission Limited': ['warn', 'Cần cấp quyền'], 'Requires Authorization': ['warn', 'Cần đăng nhập lại'], 'Error': ['err', 'Có lỗi'], 'Disconnected': ['off', 'Đã tắt'] };
const APP_STATUS = { active: ['ok', 'Đang hoạt động'], pending: ['warn', 'Chờ đăng nhập'], expired: ['warn', 'Cần đăng nhập lại'], error: ['err', 'Có lỗi'] };

/** Built-in connectors shown in the catalog next to Composio's (simple setup, no third party). */
const LOCAL_APPS = [
  { id: 'github', name: 'GitHub', icon: '🐙', desc: 'Pull request, issue, nhắc tên bạn.', keywords: 'github git code pr' },
  { id: 'calendar', name: 'Lịch (Google / Outlook / iCloud)', icon: '📅', desc: 'Nhắc trước cuộc họp qua link lịch iCal.', keywords: 'calendar lich google outlook icloud ical meeting' },
  { id: 'slack', name: 'Slack', icon: '💬', desc: 'Tin nhắn riêng và @mention, tức thì.', keywords: 'slack chat' },
  { id: 'system', name: 'Pin & hệ thống', icon: '🔋', desc: 'Pin yếu, cắm sạc, máy quá nóng.', keywords: 'battery pin system he thong' }
];
const SIMPLE_FIELDS = {
  github: { token: 'Mã truy cập GitHub (Personal Access Token)' },
  calendar: { icsUrl: 'Link lịch bí mật (iCal)', leadMinutes: 'Nhắc trước (phút)' },
  slack: { appToken: 'App Token (xapp-…)', botToken: 'Bot Token (xoxb-…)', notifyOn: 'Báo khi' },
  system: { battery: 'Báo pin yếu & sạc', lockScreen: 'Chào khi mở khóa máy', thermal: 'Báo máy quá nóng' }
};
const SETUP_HELP = {
  github: ['Mở github.com → Settings → Developer settings → Personal access tokens (classic).', 'Tạo token với quyền "notifications", dán vào ô bên dưới.'],
  calendar: ['Google Lịch: Cài đặt → chọn lịch → "Địa chỉ bí mật ở định dạng iCal".', 'Outlook: Cài đặt → Lịch → Lịch được chia sẻ → Xuất bản lịch → ICS.'],
  slack: ['Tạo Slack app (api.slack.com/apps), bật Socket Mode để có App Token.', 'Cài app vào workspace để lấy Bot Token, dán cả hai vào đây.'],
  system: ['Không cần đăng nhập — chỉ chọn những gì bạn muốn được báo.']
};

/* ================================================================== navigation */

const NAV = [
  ['home', '🏠', 'Trang chủ'],
  ['pet', '🐱', 'Thú cưng'],
  ['notify', '🔔', 'Thông báo'],
  ['inbox', '📥', 'Hộp thư'],
  ['connect', '🔌', 'Kết nối'],
  ['settings', '⚙️', 'Cài đặt'],
  ['monitor', '📊', 'Theo dõi', true]
];
const LEGACY = { dashboard: 'home', pets: 'pet', emotions: 'monitor/rules', notifications: 'notify/style', attention: 'inbox', focus: 'notify/focus', connections: 'connect', appearance: 'notify/style', sounds: 'pet' };
const SUBS = { notify: ['style', 'chat', 'focus', 'priority'], monitor: ['stats', 'tech', 'rules', 'tools'] };

function renderNav() {
  nav.innerHTML = NAV.filter(([, , , adv]) => !adv || advanced()).map(([id, icon, label, adv]) =>
    `<a href="#${id}" data-route="${id}" class="${route === id ? 'active' : ''} ${adv ? 'nav-adv' : ''}"><span>${icon}</span>${label}${id === 'inbox' ? '<i class="nav-badge" id="inbox-badge" hidden></i>' : ''}</a>`).join('');
  updateBadges();
}

/* ================================================================== pages */

function replacementState() {
  if (S.platform === 'darwin') {
    const a = adapter('macos_nc');
    if (!a) return { ok: false, label: '' };
    const trusted = a.extra && a.extra.trusted;
    if (!isOn(a)) return { ok: false, label: 'Thú cưng chưa nhận thông báo của máy', cta: 'Bật ngay' };
    if (!trusted && S.appAxTrusted === true) return { ok: false, label: 'Còn 1 bước nhỏ: bật thêm trợ lý nc-bridge trong Trợ năng', cta: 'Hướng dẫn' };
    if (!trusted) return { ok: false, label: 'Còn 1 bước: cho phép thú cưng thay thế thông báo của máy', cta: 'Hoàn tất' };
    return { ok: true, label: 'Thú cưng đang thay thế thông báo của máy' };
  }
  if (S.platform === 'win32') {
    const a = adapter('windows_nc');
    if (a && a.status === 'Connected') return { ok: true, label: 'Thú cưng đang thay thế thông báo của Windows' };
    return { ok: false, label: 'Thú cưng chưa nhận thông báo của Windows', cta: 'Bật ngay' };
  }
  return { ok: true, label: '' };
}

function myApps() {
  const local = LOCAL_APPS.filter(l => isOn(adapter(l.id)) || (adapter(l.id) && adapter(l.id).enabled)).map(l => {
    const a = adapter(l.id);
    const [cls, label] = FRIENDLY_STATUS[a.status] || ['off', STATUS_VI[a.status] || a.status];
    return { kind: 'local', id: l.id, name: l.name, icon: l.icon, cls, label };
  });
  const remote = ((S.integrations && S.integrations.apps) || []).map(a => {
    const [cls, label] = APP_STATUS[a.status] || APP_STATUS.pending;
    return { kind: 'composio', id: a.toolkit, name: a.name, logo: a.logo, cls, label, triggers: a.triggers.length, status: a.status, hasEvents: COMPOSIO_EVENT_APPS.includes(a.toolkit) };
  });
  return [...local, ...remote];
}

const connectMode = () => !!(S.integrations && S.integrations.mode === 'connect');
const COMPOSIO_EVENT_APPS = ['gmail', 'outlook', 'github', 'googlecalendar', 'jira', 'bitbucket'];
const appIcon = (x) => x.logo ? `<img src="${esc(x.logo)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : `<span>${x.icon || '🧩'}</span>`;

const pages = {
  home() {
    const pet = S.characters.find(c => c.id === S.settings.activePet) || {};
    const preset = presetFor(S.settings.personality);
    const rep = replacementState();
    const ib = S.pipeline.inbox || { unread: 0, items: [] };
    const apps = myApps();
    return `
      ${H.head('Xin chào! 👋', 'Thú cưng đang trông thông báo giúp bạn.')}
      ${S.install && S.install.rosetta ? `<div class="warn-box" style="margin:0 0 16px"><b>🐢 Bạn đang dùng bản cho Mac Intel trên máy chip Apple</b><span>Hoạt họa sẽ chậm và giật vì macOS phải dịch app qua Rosetta. Hãy cài file có đuôi <b style="display:inline">-arm64.dmg</b> rồi xoá bản này.</span></div>` : ''}
      <section class="hero panel">
        <div class="hero-stage">${previewControls({ emotions: false })}</div>
        <div class="hero-info">
          <div class="eyebrow">Bạn đồng hành của bạn</div>
          <h2>${esc(pet.name || 'Mèo Mochi')}</h2>
          <div class="pill-row">
            <span class="pill">${preset.emoji} ${esc(preset.name)}</span>
            <a class="pill" href="#notify/chat" title="Đổi cách báo tin nhắn chat">${S.settings.chat.mode === 'mentions' ? '📣 Chat: chỉ khi nhắc tới bạn' : '🔔 Chat: báo tất cả tin nhắn'}</a>
            <span class="pill ${S.effective && S.effective.mode.id !== 'none' ? 'pill-night' : ''}">${S.effective && S.effective.mode.id !== 'none' ? '🌙 Đang tập trung — tin ít gấp sẽ vào Hộp thư' : '☀️ Sẵn sàng nhận tin'}</span>
          </div>
          ${rep.label ? `<div class="setup-banner ${rep.ok ? 'ok' : 'todo'}"><span>${rep.ok ? '✅' : '✨'}</span><b>${rep.label}</b>${rep.ok ? '' : `<a class="btn btn-primary small" href="#connect">${rep.cta}</a>`}</div>` : ''}
          <b class="sub-title">Thú cưng xuất hiện thế nào?</b>
          ${appearSizeHtml()}
          <div class="cta-row">
            <button class="btn btn-primary" data-action="test" data-arg="happy">🚀 Gửi thử 1 thông báo</button>
            <a class="btn btn-ghost" href="#pet">🐱 Đổi thú cưng</a>
          </div>
        </div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h3>🕘 Thông báo gần đây</h3></div>
          <div class="history" id="history">${historyRows(S.pipeline.history, { simple: true })}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>📥 Hộp thư</h3><a class="link" href="#inbox">Xem tất cả</a></div>
          <p class="muted">Những tin được giữ lại khi bạn đang tập trung — không có gì bị mất.</p>
          <div class="digest-total big"><b id="dash-inbox">${ib.unread}</b><span>tin chưa đọc</span></div>
          <div class="panel-head" style="margin-top:18px"><h3>🔌 Ứng dụng đã kết nối</h3><a class="link" href="#connect">Quản lý</a></div>
          <div class="app-chips">${apps.length ? apps.map(x => `<span class="app-chip">${appIcon(x)}${esc(x.name)}<i class="dot ${x.cls}"></i></span>`).join('') : '<span class="muted">Chưa kết nối ứng dụng nào — thông báo của máy vẫn được thú cưng mang tới.</span>'}</div>
        </section>
      </div>`;
  },

  pet() {
    return `
      ${H.head('Thú cưng', 'Chọn người bạn đồng hành và tính cách của bé.')}
      <div class="grid-pets">
        ${S.characters.map(c => `
          <article class="pet-card ${S.settings.activePet === c.id ? 'active' : ''}" data-action="pick-pet" data-arg="${c.id}">
            <div class="pet-thumb">${thumbs[c.id] ? `<img src="${thumbs[c.id]}" alt="">` : '<div class="thumb-loading">…</div>'}</div>
            <div class="pet-meta">
              <h3>${esc(c.name)}</h3>
              ${S.settings.activePet === c.id ? '<span class="btn btn-done small">✓ Đang dùng</span>' : '<span class="btn btn-primary small">Chọn</span>'}
            </div>
          </article>`).join('')}
      </div>
      <div class="grid-2 wide-left">
        <section class="panel">${previewControls({ emotions: false })}</section>
        <section class="panel">
          <h3>💖 Thái độ <small class="muted">chọn là bé ngoài màn hình đổi ngay</small></h3>
          <div class="preset-list">
            ${Object.values(S.presets).map(p => `
              <button class="preset row ${S.settings.personality === p.id ? 'selected' : ''}" data-choice="personality" data-value="${p.id}">
                <span class="preset-emoji">${p.emoji}</span>
                <span><b>${esc(p.name)} <i class="muted">${esc(p.nameEn || '')}</i></b><small>${esc(p.description)}</small><small class="rest">Lúc rảnh: ${p.restEmotion && p.restEmotion !== 'idle' ? `${emo(p.restEmotion).emoji} ${emo(p.restEmotion).label}` : '🐾 đứng yên nhẹ nhàng'}</small>${S.settings.mood.followAttitude !== false && p.reactEmotion ? `<small class="rest">Khi có thông báo: ${emo(p.reactEmotion).emoji} ${emo(p.reactEmotion).label}</small>` : ''}</span>
              </button>`).join('')}
          </div>
          ${H.toggle('mood.followAttitude', 'Bé luôn phản ứng theo thái độ đã chọn', 'Mọi thông báo đều được bé đón bằng đúng cảm xúc của thái độ. Tắt đi nếu muốn bé tự đoán cảm xúc từ nội dung tin nhắn.')}
        </section>
      </div>
      ${contactsPanel()}
      <section class="panel mood-panel ${S.settings.mood.followAttitude !== false ? 'is-off' : ''}">
        <h3>🎭 Bé đọc cảm xúc tin nhắn</h3>
        ${S.settings.mood.followAttitude !== false ? '<p class="notice">Đang tắt vì bé phản ứng theo thái độ đã chọn. Tắt công tắc "Bé luôn phản ứng theo thái độ đã chọn" ở trên để dùng.</p>' : ''}
        <div class="grid-2 flat">
          <div>
            ${H.toggle('mood.enabled', 'Bé đoán cảm xúc từ nội dung', 'Dựa vào emoji và câu chữ (tiếng Việt có hoặc không dấu, tiếng Anh). Xử lý ngay trên máy, không gửi đi đâu.')}
            <b class="sub-title">Bé phản ứng</b>
            <div class="seg seg-3">${[['low', '🐢 Ít'], ['medium', '🐾 Vừa'], ['high', '⚡ Nhạy']].map(([v, l]) => `<button data-choice="mood.sensitivity" data-value="${v}">${l}</button>`).join('')}</div>
            <p class="muted">Ít: chỉ khi tin nhắn thể hiện rõ cảm xúc. Nhạy: phản ứng cả với một từ hay một emoji.</p>
          </div>
          <div>
            <b class="sub-title">Gõ thử một tin nhắn</b>
            <input id="mood-try" type="text" autocomplete="off" placeholder="vd: Đồng nghiệp: app gãy rồi 😭">
            <div class="mood-examples">${['Đồng nghiệp: 😁', 'Bạn: cảm ơn nhiều nha 🙏', 'Trưởng nhóm: task quá hạn rồi, gấp lên!!', 'Nhóm dev: server toang rồi', 'Đồng nghiệp: xem giúp PR này được không?'].map(x => `<button class="chip-btn" data-mood-example="${esc(x)}">${esc(x)}</button>`).join('')}</div>
            <div class="mood-result" id="mood-result"><span class="muted">Bé sẽ phản ứng trong khung xem trước ở trên 👆</span></div>
          </div>
        </div>
      </section>
      <section class="panel">
        <h3>🎵 Âm thanh & chuyển động</h3>
        <div class="grid-2 flat">
          <div>
            ${H.toggle('sounds.enabled', 'Tiếng kêu dễ thương')}
            ${H.toggle('sounds.voice', '🗣️ Bé nói chuyện', 'Bé nói khi nhắc nghỉ mắt và khi bị bạn nhấc bổng, kéo thả. Bé không bao giờ đọc nội dung thông báo.')}
            ${H.slider('sounds.volume', 'Âm lượng', 0, 1, 0.05, 'pct')}
            <div class="btn-row"><button class="chip-btn" data-action="voice" data-arg="meow">🔊 Nghe thử</button><button class="chip-btn" data-action="speak-test">🗣️ Nghe bé nói</button></div>
          </div>
          <div>
            ${H.slider('sounds.animationIntensity', 'Độ sinh động', 0.3, 2, 0.05, 'x')}
            <label class="field"><b>🐢 Giảm chuyển động</b>
              <select data-setting="sounds.reducedMotion">
                <option value="system">Theo cài đặt của máy</option>
                <option value="on">Luôn giảm</option>
                <option value="off">Không giảm</option>
              </select>
            </label>
          </div>
        </div>
      </section>`;
  },

  notify() {
    return `
      ${H.head('Thông báo', 'Thẻ thông báo trông ra sao, khi nào được làm phiền và tin nào quan trọng.')}
      ${H.tabs('notify', [['style', '🎨 Hiển thị'], ['chat', '💬 Tin nhắn'], ['focus', '🎯 Tập trung'], ['priority', '⭐ Ưu tiên']])}
      ${notifySubs[sub]()}`;
  },

  inbox() {
    const ib = S.pipeline.inbox || { unread: 0, items: [], digest: { total: 0, byApp: [], byPriority: {} } };
    return `
      ${H.head('Hộp thư', 'Tin được giữ lại khi bạn đang tập trung hoặc ít quan trọng. Không có gì bị mất.', `
        <button class="btn btn-ghost small" data-action="inbox-read-all">✓ Đánh dấu đã đọc</button>
        <button class="btn btn-ghost small danger" data-action="inbox-clear">🗑️ Xóa hết</button>`)}
      <section class="panel">
        <div class="digest">
          <div class="digest-total"><b id="inbox-count">${ib.unread}</b><span>chưa đọc</span></div>
          <div class="pill-row">${(ib.digest.byApp || []).slice(0, 10).map(([app, n]) => `<span class="pill small">${esc(app)} · ${n}</span>`).join('') || '<span class="muted">Không có tin nào đang chờ 🎉</span>'}</div>
        </div>
        <div class="history inbox-list" id="inbox-list">${inboxRows(ib.items)}</div>
      </section>`;
  },

  connect() {
    const ig = S.integrations || { keySet: false, apps: [] };
    const apps = myApps();
    return `
      ${H.head('Kết nối', 'Để thú cưng mang tới thông báo từ máy tính và các ứng dụng bạn dùng.')}
      ${replacementWizard()}
      ${ig.keySet && ig.polling && ig.polling.lastError ? `<div class="alert">⚠️ Lần kiểm tra gần nhất có lỗi: ${esc(ig.polling.lastError)}</div>` : ''}
      <section class="panel">
        <div class="panel-head"><h3>📱 Ứng dụng của tôi</h3>${ig.keySet ? `<div class="btn-row tight">${connectMode() ? `<label class="field inline-select"><select data-setting="integrations.pollSeconds">${[[60, 'Kiểm tra mỗi 1 phút'], [120, 'Kiểm tra mỗi 2 phút'], [300, 'Kiểm tra mỗi 5 phút'], [900, 'Kiểm tra mỗi 15 phút']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label><button class="btn btn-ghost small" data-action="ig-poll">🔔 Kiểm tra ngay</button>` : ''}<button class="btn btn-ghost small" data-action="ig-refresh">↻ Cập nhật</button></div>` : ''}</div>
        ${apps.length ? `<div class="my-apps">${apps.map(x => `
          <div class="my-app">
            <div class="app-logo">${appIcon(x)}</div>
            <div class="my-app-main"><b>${esc(x.name)}</b><span class="status ${x.cls}">${x.label}</span>${x.kind === 'composio' && x.status === 'active' ? `<small>${x.triggers ? (connectMode() ? `🔔 Kiểm tra mỗi ${Math.round(S.settings.integrations.pollSeconds / 60)} phút` : `${x.triggers} loại sự kiện đang bật`) : connectMode() && !x.hasEvents ? 'Đã kết nối — chưa có sự kiện tự động cho app này' : 'Chưa chọn sự kiện nào'}</small>` : ''}</div>
            <div class="btn-row tight">
              ${x.kind === 'composio' ? (x.status === 'active' ? (connectMode() && !x.hasEvents ? '' :
                `<button class="btn btn-primary small" data-action="ig-events" data-arg="${esc(x.id)}">🔔 Chọn sự kiện</button>`)
                : `<button class="btn btn-primary small" data-action="ig-connect" data-arg="${esc(x.id)}">🔑 Đăng nhập</button>`)
                : `<button class="btn btn-ghost small" data-action="local-setup" data-arg="${x.id}">⚙️ Thiết lập</button>`}
              <button class="icon-btn" title="Gỡ" data-action="${x.kind === 'composio' ? 'ig-remove' : 'local-remove'}" data-arg="${esc(x.id)}">✕</button>
            </div>
          </div>`).join('')}</div>` : '<div class="empty">Chưa có ứng dụng nào. Tìm và thêm ở bên dưới nhé 👇</div>'}
      </section>
      <section class="panel">
        <div class="panel-head"><h3>➕ Thêm ứng dụng</h3>${ig.keySet ? `<span class="pill small pill-ok">🌐 Đã kết nối Composio${connectMode() ? ' Connect' : ''}</span>` : ''}</div>
        <div class="search-row">
          <input id="catalog-q" type="search" placeholder="Tìm ứng dụng: Gmail, Notion, Jira, Teams…" value="${esc(catalogState.q)}" autocomplete="off" spellcheck="false">
        </div>
        <div class="catalog" id="catalog">${catalogHtml()}</div>
        ${ig.keySet ? '' : composioSetupCard()}
      </section>`;
  },

  settings() {
    const lang = S.settings.appearance.language || 'vi';
    return `
      ${H.head('Cài đặt', 'Giao diện, ngôn ngữ và quyền riêng tư.')}
      <section class="panel">
        <h3>🎨 Màu giao diện</h3>
        <div class="ui-theme-grid">
          ${UI_THEMES.map(([id, name, [a, b]]) => `<button class="ui-theme" data-choice="appearance.uiTheme" data-value="${id}"><i style="background:linear-gradient(135deg, ${a}, ${b})"></i><b>${name}</b></button>`).join('')}
        </div>
        ${H.toggle('appearance.cardFollowsTheme', 'Thẻ thông báo dùng màu giao diện', 'Tắt để thẻ đổi màu theo cảm xúc của bé (vui = vàng, buồn = xanh…).')}
        <div class="btn-row tight"><button class="btn btn-ghost small" data-action="test" data-arg="happy">👀 Xem thử thẻ thông báo</button></div>
      </section>
      <section class="panel">
        <h3>🙈 Nội dung trên thẻ thông báo</h3>
        <p class="muted">Dùng khi chia sẻ màn hình, trình chiếu hay làm việc nơi đông người. Bật/tắt nhanh: chuột phải vào bé hoặc icon 🐾 trên thanh menu → "Ẩn nội dung thông báo".</p>
        <div class="choice-list four">
          ${[['full_content', '👀 Hiện đầy đủ', 'Ứng dụng, tiêu đề và nội dung.', 'Teams · Họp sprint lúc 3h'],
             ['masked', '✳️ Che bớt', 'Chỉ giữ chữ cái đầu, ẩn nội dung.', 'Teams · H••• s••• l••• 3•••'],
             ['source_only', '🔒 Chỉ tên ứng dụng', 'Không tiêu đề, không nội dung, không nút Approve.', 'Tin nhắn mới từ Teams'],
             ['anonymous_source_only', '🕶️ Ẩn hoàn toàn', 'Không cả tên ứng dụng.', 'Bạn có thông báo mới']]
            .map(([v, n, d, ex]) => `<button class="choice" data-choice="privacy.displayMode" data-value="${v}"><b>${n}</b><small>${d}</small><i class="example">${esc(ex)}</i></button>`).join('')}
        </div>
        <b class="sub-title">Luôn ẩn nội dung của các ứng dụng</b>
        <p class="muted">Các ứng dụng này luôn chỉ hiện "Tin nhắn mới từ …", kể cả khi đang chọn "Hiện đầy đủ".</p>
        <div class="mute-list">
          ${(() => { const hidden = S.settings.privacy.hiddenApps || []; const apps = [...new Set([...Object.keys(S.pipeline.stats.bySource || {}).filter(x => !['test', 'webhook', 'macos_nc', 'windows_nc', 'gateway', 'composio', 'wellbeing'].includes(x)), ...((S.pipeline.inbox && S.pipeline.inbox.items) || []).map(i => String(i.app || '').toLowerCase()).filter(a => a && a !== 'default'), 'teams', 'zalo', 'messenger', 'slack', 'gmail', ...hidden])].sort();
            return apps.map(app => `<button class="mute-chip ${hidden.includes(app) ? 'muted' : ''}" data-action="toggle-private" data-arg="${esc(app)}">${hidden.includes(app) ? '🔒' : '👀'} ${esc(app)}</button>`).join(''); })()}
        </div>
        <p class="muted">Khi nội dung bị ẩn, thẻ không lưu nội dung vào Hộp thư hay lịch sử. Bấm vào thẻ vẫn mở đúng ứng dụng để bạn xem riêng.</p>
      </section>
      <div class="grid-2">
        <section class="panel">
          <h3>🌐 Chung</h3>
          <label class="field"><b>Ngôn ngữ (Language)</b>
            <select data-setting="appearance.language">
              <option value="vi" ${lang === 'vi' ? 'selected' : ''}>🇻🇳 Tiếng Việt</option>
              <option value="en" ${lang === 'en' ? 'selected' : ''}>🇺🇸 English</option>
            </select>
          </label>
          ${S.autoLaunchSupported ? H.toggle('system.autoLaunch', 'Mở cùng máy tính', 'Thú cưng tự xuất hiện khi bạn đăng nhập.') : ''}
          ${S.displays.length > 1 ? `<label class="field"><b>Hiện trên màn hình</b><select data-setting="appearance.displayId">${S.displays.map(d => `<option value="${d.id}">${esc(d.label)}</option>`).join('')}</select></label>` : ''}
        </section>
        <section class="panel">
          <h3>🔒 Quyền riêng tư</h3>
          ${H.toggle('privacy.keepHistory', 'Nhớ thông báo gần đây', 'Chỉ giữ trong bộ nhớ, mất khi tắt app.')}
          ${H.toggle('attention.persistInbox', 'Giữ Hộp thư khi tắt app', 'Lưu trên máy này, không gửi đi đâu.')}
          <div class="btn-row"><button class="btn btn-ghost small" data-action="clear-history">🗑️ Xóa thông báo gần đây</button></div>
        </section>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h3>🧰 Nâng cao</h3>
          ${H.toggle('system.advancedMode', 'Hiện tab "Theo dõi"', 'Dành cho người muốn xem thống kê, độ trễ và chỉnh quy tắc chi tiết.')}
          <div class="btn-row"><button class="btn btn-ghost small danger" data-action="reset-settings">↺ Khôi phục cài đặt gốc</button></div>
        </section>
        <section class="panel">
          <h3>🐾 Cute Pet Companion</h3>
          <p class="muted">Phiên bản ${esc(S.version)}</p>
          <div class="btn-row"><button class="btn btn-ghost small danger" data-action="quit-app">⏻ Thoát ứng dụng</button></div>
        </section>
      </div>`;
  },

  monitor() {
    return `
      ${H.head('Theo dõi', 'Thống kê, độ trễ, chi tiết kỹ thuật của kết nối và công cụ thử nghiệm.')}
      ${H.tabs('monitor', [['stats', '📈 Thống kê'], ['tech', '🔧 Kết nối (kỹ thuật)'], ['rules', '🎭 Quy tắc cảm xúc'], ['tools', '🧪 Công cụ']])}
      ${monitorSubs[sub]()}`;
  }
};

/* ---------------------------------------------------------------- notify sub-pages */

const COOLDOWN_PRESETS = [
  ['relaxed', '😌 Thoải mái', 'Cho hiện nhiều tin liên tiếp', { cooldownCount: 6, cooldownWindowSec: 10 }],
  ['balanced', '⚖️ Vừa phải', 'Tối đa 3 thẻ mỗi 10 giây / ứng dụng', { cooldownCount: 3, cooldownWindowSec: 10 }],
  ['strict', '🤫 Ít làm phiền', '1 thẻ mỗi 30 giây / ứng dụng, phần còn lại vào Hộp thư', { cooldownCount: 1, cooldownWindowSec: 30 }]
];
const cooldownPreset = () => {
  const a = S.settings.attention;
  const hit = COOLDOWN_PRESETS.find(([, , , v]) => v.cooldownCount === a.cooldownCount && v.cooldownWindowSec === a.cooldownWindowSec);
  return hit ? hit[0] : 'custom';
};

const notifySubs = {
  style() {
    const modes = [
      ['billboard', '🪧', 'Ôm bảng', 'Bé đứng cạnh, giữ mép thẻ thông báo.'],
      ['peeker', '👀', 'Ló đầu', 'Bé ló đầu từ sau thẻ, mắt dõi theo chuột.'],
      ['courier', '✉️', 'Đưa thư', 'Bé chạy vào mang phong bì rồi mở thẻ.']
    ];
    const themes = [['pastel', 'Pastel'], ['minimal', 'Trắng tối giản'], ['dark', 'Tối'], ['glass', 'Kính mờ'], ['acrylic', 'Trong suốt']];
    const pos = ['top-left', 'top-center', 'top-right', 'middle-left', null, 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
    const hasCustomPos = S.settings.appearance.customPosition && Number.isFinite(S.settings.appearance.customPosition.x);
    return `
      <section class="panel">
        <h3>🪧 Cách bé mang thông báo tới</h3>
        <div class="mode-grid">
          ${modes.map(([id, icon, name, desc]) => `
            <button class="mode-card" data-choice="notifications.presentationMode" data-value="${id}">
              <div class="mode-illus mode-${id}"><span class="mi-card"></span><span class="mi-pet">${icon}</span></div>
              <b>${name}</b><small>${desc}</small>
            </button>`).join('')}
        </div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <h3>🎨 Kiểu thẻ</h3>
          <div class="theme-grid">
            ${themes.map(([id, name]) => `<button class="theme-card" data-choice="notifications.theme" data-value="${id}"><div class="theme-swatch t-${id}"><i></i><i></i><i></i></div><b>${name}</b></button>`).join('')}
          </div>
          <div class="seg">${[['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn']].map(([v, l]) => `<button data-choice="notifications.size" data-value="${v}">${l}</button>`).join('')}</div>
          ${H.slider('notifications.cardScale', '📐 Kích thước khung thông báo', 0.8, 1.5, 0.05, 'x')}
          ${H.slider('notifications.duration', '⏱️ Thẻ hiện trong', 3000, 30000, 500, 'sec')}
        </section>
        <section class="panel">
          <h3>📍 Vị trí của bé</h3>
          <div class="pos-picker">
            ${pos.map(p => p ? `<button data-choice="appearance.position" data-value="${p}" title="${p}"><i></i></button>` : '<div class="pos-screen">🖥️</div>').join('')}
          </div>
          ${H.slider('appearance.petScale', '🔍 Kích thước bé', 0.6, 1.6, 0.05, 'x')}
          ${H.toggle('appearance.dragEnabled', 'Cho phép kéo bé đi chỗ khác', 'Nhấn giữ vào bé rồi thả ở bất kỳ đâu.')}
          ${H.toggle('appearance.showBadge', 'Hiện số thông báo chưa xem trên bé', 'Chấm đỏ có số như icon ứng dụng — bấm vào để mở Hộp thư.')}
          ${hasCustomPos ? '<div class="btn-row"><button class="btn btn-ghost small" data-action="reset-position">↺ Đưa bé về góc đã chọn</button></div>' : ''}
        </section>
      </div>`;
  },

  focus() {
    const modes = [
      ['none', 'Bình thường', 'Mọi tin đều được báo.'],
      ['work', 'Làm việc', 'Bớt tin mạng xã hội, giải trí, khuyến mãi.'],
      ['focus', 'Tập trung sâu', 'Chỉ tin khẩn cấp, không âm thanh.'],
      ['meeting', 'Đang họp', 'Bé ngủ, chỉ tin quan trọng, không âm thanh.'],
      ['gaming', 'Chơi game', 'Ẩn bé, chỉ tin khẩn cấp.'],
      ['relax', 'Thư giãn', 'Báo tất cả, kể cả tin nhỏ.'],
      ['sleep', 'Đi ngủ', 'Im lặng, chỉ tin khẩn cấp.']
    ];
    return `
      <section class="panel">
        <h3>🎯 Bạn đang làm gì?</h3>
        <div class="focus-grid">
          ${modes.map(([id, name, desc]) => `<button class="mode-card" data-choice="system.focusMode" data-value="${id}"><span class="big-emoji">${(S.focusModes[id] || {}).emoji || '🐾'}</span><b>${name}</b><small>${desc}</small></button>`).join('')}
        </div>
      </section>
      <section class="panel">
        <h3>👁️ Bé xuất hiện thế nào?</h3>
        <div>
        </div>
        ${appearSizeHtml({ cards: true })}
      </section>
      <section class="panel">
        <h3>💆 Nhắc nghỉ mắt</h3>
        ${H.toggle('wellbeing.breakReminder', 'Bé nhắc bạn cho mắt nghỉ', 'Chỉ tính lúc bạn đang dùng máy — rời máy ≥ 5 phút hay khóa màn hình thì đếm lại. Hoãn khi đang họp / tập trung sâu.')}
        <div class="grid-2 flat">
          <label class="field"><b>Nhắc sau mỗi</b><select data-setting="wellbeing.breakEveryMinutes">${[30, 45, 60, 90].map(v => `<option value="${v}">${v} phút</option>`).join('')}</select></label>
          <label class="field"><b>Nghỉ trong</b><select data-setting="wellbeing.breakMinutes">${[3, 5, 10].map(v => `<option value="${v}">${v} phút</option>`).join('')}</select></label>
        </div>
      </section>
      <section class="panel">
        <h3>🌙 Không làm phiền</h3>
        <div class="grid-2 flat">
          <div>${H.toggle('dnd.enabled', 'Bật Không làm phiền ngay')}</div>
          <div>
            ${H.toggle('dnd.quietHoursEnabled', 'Tự im lặng mỗi ngày')}
            <div class="time-row"><label>Từ <input type="time" data-setting="dnd.quietStart"></label><label>đến <input type="time" data-setting="dnd.quietEnd"></label></div>
          </div>
        </div>
      </section>`;
  },

  chat() {
    return `
      <section class="panel">
        <h3>💬 Tin nhắn chat</h3>
        <p class="muted">Áp dụng cho Teams, Slack, Zalo, Messenger, Tin nhắn, Telegram, Discord, WhatsApp…</p>
        <div class="choice-list two-col">
          <button class="choice" data-choice="chat.mode" data-value="all"><b>🔔 Báo tất cả tin nhắn</b><small>Mọi tin nhắn được gửi tới đều hiện thẻ.</small></button>
          <button class="choice" data-choice="chat.mode" data-value="mentions"><b>📣 Chỉ tin dành cho tôi</b><small>Hiện khi có người nhắn riêng (1-1) với bạn, nhắc tên bạn, @all / @everyone, hoặc app báo "nhắc đến bạn". Tin nhóm khác vào Hộp thư.</small></button>
        </div>
        <div class="chat-mentions" ${S.settings.chat.mode === 'mentions' ? '' : 'hidden'}>
          <label class="field"><b>Tên của bạn trong chat</b>
            <small>Cách nhau bằng dấu phẩy. Tên 2 chữ trở lên (vd: Mai Pham) nhận cả khi không có @; tên 1 chữ phải có @ (vd: @Mai) để tránh nhầm với từ thường ngày ("mai" = ngày mai, "anh", "em"…).</small>
            <input id="chat-names" type="text" autocomplete="off" spellcheck="false" value="${esc((S.settings.chat.names || []).join(', '))}" placeholder="${esc(S.chatNameSuggestion ? `${S.chatNameSuggestion}, @${S.chatNameSuggestion.split(' ')[0]}` : 'Tên Của Bạn, @Ten')}">
          </label>
          ${S.chatNameSuggestion && !(S.settings.chat.names || []).length ? `<div class="btn-row tight"><button class="btn btn-ghost small" data-action="chat-suggest">＋ Dùng "${esc(S.chatNameSuggestion)}"</button></div>` : ''}
          ${H.toggle('chat.includeDirect', '💬 Báo khi có người nhắn riêng (1-1)', 'Bé nhận ra tin 1-1 khi tiêu đề là tên người gửi và nội dung không có dạng "Người gửi: …" (dạng của tin nhóm). Slack thì biết chính xác. Tin 1-1 được ưu tiên như khi nhắc tên bạn.')}
        </div>
      </section>
`;
  },

  priority() {
    const a = S.settings.attention;
    const seen = Object.keys(S.pipeline.stats.bySource || {}).filter(x => !['test', 'webhook', 'macos_nc', 'windows_nc', 'gateway'].includes(x));
    const fromInbox = ((S.pipeline.inbox && S.pipeline.inbox.items) || []).map(i => String(i.app || '').toLowerCase()).filter(Boolean);
    const apps = [...new Set([...seen, ...fromInbox, ...(a.mutedApps || [])])].sort();
    const cur = cooldownPreset();
    return `
      <div class="grid-2">
        <section class="panel">
          <h3>⭐ Tin nào được làm phiền bạn?</h3>
          ${H.toggle('attention.criticalBypass', 'Tin khẩn cấp luôn được báo', 'Ví dụ: pin sắp hết, máy quá nóng — kể cả khi đang tập trung.')}
          ${H.toggle('attention.lowToInbox', 'Tin ít quan trọng vào thẳng Hộp thư', 'Khuyến mãi, bản tin… không bật thẻ.')}
        </section>
        <section class="panel">
          <h3>🚦 Khi nhiều tin tới cùng lúc</h3>
          <div class="choice-list">
            ${COOLDOWN_PRESETS.map(([id, name, desc]) => `<button class="choice ${cur === id ? 'selected' : ''}" data-action="cooldown-preset" data-arg="${id}"><b>${name}</b><small>${desc}</small></button>`).join('')}
          </div>
        </section>
      </div>
      <section class="panel">
        <h3>🔕 Tắt tiếng ứng dụng</h3>
        <p class="muted">Tin từ ứng dụng bị tắt tiếng sẽ vào Hộp thư, không bật thẻ. Bấm để bật/tắt.</p>
        <div class="mute-list">
          ${apps.length ? apps.map(app => `<button class="mute-chip ${(a.mutedApps || []).includes(app) ? 'muted' : ''}" data-action="toggle-mute" data-arg="${esc(app)}">${(a.mutedApps || []).includes(app) ? '🔕' : '🔔'} ${esc(app)}</button>`).join('') : '<span class="muted">Danh sách sẽ hiện các ứng dụng đã gửi thông báo cho bạn.</span>'}
        </div>
        <div class="inline-add"><input id="mute-app" placeholder="Thêm tên ứng dụng, vd: zalo"><button class="btn btn-ghost small" data-action="mute-add">🔕 Tắt tiếng</button></div>
      </section>`;
  }
};

/* ---------------------------------------------------------------- connect helpers */

function replacementWizard() {
  if (S.platform === 'darwin') {
    const a = adapter('macos_nc');
    if (!a) return '';
    const on = isOn(a);
    const trusted = !!(a.extra && a.extra.trusted);
    const replaced = !!(a.extra && a.extra.replaced);
    // The app itself is allowed but its helper (nc-bridge, which reads & hides banners) is not.
    const helperOnly = !trusted && S.appAxTrusted === true;
    return `
      <section class="panel wizard">
        <div class="panel-head"><h3>🍎 Thay thế thông báo của máy Mac</h3>
          <label class="toggle-row inline"><span>${on ? 'Đang bật' : 'Đang tắt'}</span><input type="checkbox" data-action-toggle="system-replace" ${on ? 'checked' : ''}><span class="switch"></span></label></div>
        <p class="muted">Thông báo của mọi ứng dụng (Zalo, Messenger, Mail, Teams…) sẽ được thú cưng mang tới thay cho banner của macOS. Bấm vào thẻ để mở đúng cuộc trò chuyện.</p>
        <ol class="steps">
          <li class="${trusted ? 'done' : on ? 'current' : ''}">
            <i>${trusted ? '✓' : '1'}</i>
            <div><b>Cho phép thú cưng đọc thông báo</b><small>${trusted ? 'Đã xong — thông báo tới ngay lập tức.' : helperOnly ? '✅ Cute Pet Companion đã được bật. Còn thêm trợ lý <b>nc-bridge</b> (phần đọc và ẩn banner): bấm nút bên phải → Finder mở sẵn file nc-bridge → <b>kéo file đó vào danh sách Trợ năng</b> → bật công tắc của nó.' : 'Mở Cài đặt → Quyền riêng tư & Bảo mật → Trợ năng, bật "Cute Pet Companion".'}</small>
              ${trusted || helperOnly ? '' : `<div class="warn-box">
                <b>⚠️ Công tắc đã bật mà vẫn thấy bước này?</b>
                <span>Đó là mục quyền của bản app cũ (macOS giữ lại dù app đã được cập nhật). Bấm <strong>🔄 Đặt lại quyền</strong>: app xóa mục cũ và hỏi quyền lại cho bản hiện tại — bạn chỉ cần bật <strong>Cute Pet Companion</strong> (nếu còn mục <strong>nc-bridge</strong> cũ, chọn nó và bấm <strong>–</strong>).</span>
              </div>`}</div>
            ${trusted ? '' : helperOnly
              ? `<div class="btn-col"><button class="btn btn-primary small" data-action="adapter-run" data-arg="macos_nc|reveal-helper">📂 Mở Cài đặt + chỉ file</button><button class="btn btn-ghost small" data-action="copy-text" data-arg="${esc((a.extra && a.extra.helperPath) || '')}">📋 Copy đường dẫn</button></div>`
              : `<div class="btn-col"><button class="btn btn-primary small" data-action="adapter-run" data-arg="macos_nc|request-accessibility" ${on ? '' : 'disabled'}>Mở Cài đặt</button><button class="btn btn-ghost small" data-action="adapter-run" data-arg="macos_nc|reset-accessibility" ${on ? '' : 'disabled'}>🔄 Đặt lại quyền</button></div>`}
          </li>
          <li class="${replaced ? 'done' : ''}">
            <i>${replaced ? '✓' : '2'}</i>
            <div><b>Không bao giờ thấy banner gốc (tùy chọn)</b><small>${replaced ? 'Đã tắt banner của macOS cho mọi ứng dụng. Thông báo chỉ hiện qua thú cưng.' : 'Tắt hẳn banner của macOS để không còn chớp lên. Có thể hoàn tác bất cứ lúc nào.'}</small></div>
            ${replaced ? '<button class="btn btn-ghost small" data-action="adapter-run" data-arg="macos_nc|restore-banners">↺ Hoàn tác</button>' : `<button class="btn btn-ghost small" data-action="adapter-run" data-arg="macos_nc|replace-all" ${on ? '' : 'disabled'}>🤫 Bật</button>`}
          </li>
        </ol>
      </section>`;
  }
  if (S.platform === 'win32') {
    const a = adapter('windows_nc');
    if (!a) return '';
    const ok = a.status === 'Connected';
    return `
      <section class="panel wizard">
        <div class="panel-head"><h3>🪟 Thay thế thông báo của Windows</h3>
          <label class="toggle-row inline"><span>${isOn(a) ? 'Đang bật' : 'Đang tắt'}</span><input type="checkbox" data-action-toggle="system-replace" ${isOn(a) ? 'checked' : ''}><span class="switch"></span></label></div>
        <ol class="steps">
          <li class="${ok ? 'done' : 'current'}"><i>${ok ? '✓' : '1'}</i>
            <div><b>Cho phép đọc thông báo</b><small>${ok ? 'Đã xong — bé đang đọc thông báo.' : esc(a.detail || 'Bật "Truy cập thông báo" trong Cài đặt → Quyền riêng tư & bảo mật → Thông báo.')}</small></div>
            ${ok ? '' : `<div class="btn-col"><button class="btn btn-primary small" data-action="adapter-run" data-arg="windows_nc|open-privacy-settings">Mở Cài đặt quyền</button><button class="btn btn-ghost small" data-action="adapter-run" data-arg="windows_nc|open-logs">📄 Mở thư mục log</button></div>`}
          </li>
        </ol>
        ${winDiagHtml(a)}
      </section>`;
  }
  return '';
}

/* ---------------------------------------------------------------- appearance & size */
// 3 clear choices instead of presence (full/minimal/hidden) + a separate "resident pet" toggle.
const APPEAR = [
  ['always', '🐱', 'Luôn ở bên', 'Bé ngồi ở góc màn hình, dõi theo chuột, đón mọi thông báo.'],
  ['notify', '🔔', 'Chỉ khi có thông báo', 'Bé ẩn đi, chỉ chạy ra mang thông báo tới rồi đi.'],
  ['hidden', '🙈', 'Ẩn đi', 'Không hiện gì. Tin vào Hộp thư, trừ tin khẩn cấp.']
];
const APPEAR_PATCH = {
  always: { system: { presence: 'full' }, appearance: { residentPet: true } },
  notify: { system: { presence: 'full' }, appearance: { residentPet: false } },
  hidden: { system: { presence: 'hidden' } }
};
function appearMode() {
  if (S.settings.system.presence === 'hidden') return 'hidden';
  return S.settings.appearance.residentPet === false ? 'notify' : 'always';
}
// Pet + card sizes that look right together (fine-tune in Thông báo → Hiển thị).
const SIZE_PRESETS = [
  ['sm', 'Nhỏ', 'Màn hình laptop', { petScale: 0.8, size: 'sm', cardScale: 0.95 }],
  ['md', 'Vừa', 'Khuyên dùng', { petScale: 1, size: 'md', cardScale: 1 }],
  ['lg', 'Lớn', 'Màn hình to, 2K/4K', { petScale: 1.25, size: 'lg', cardScale: 1.1 }]
];
function sizePreset() {
  const a = S.settings.appearance, n = S.settings.notifications;
  const hit = SIZE_PRESETS.find(([, , , v]) => Math.abs(a.petScale - v.petScale) < 0.01 && n.size === v.size && Math.abs((n.cardScale || 1) - v.cardScale) < 0.01);
  return hit ? hit[0] : 'custom';
}
function appearSizeHtml({ cards = false } = {}) {
  const mode = appearMode(), size = sizePreset();
  const appear = cards
    ? `<div class="mode-grid">${APPEAR.map(([id, icon, name, desc]) => `<button class="mode-card ${mode === id ? 'selected' : ''}" data-action="appear" data-arg="${id}"><span class="big-emoji">${icon}</span><b>${name}</b><small>${desc}</small></button>`).join('')}</div>`
    : `<div class="seg seg-3">${APPEAR.map(([id, icon, name, desc]) => `<button class="${mode === id ? 'selected' : ''}" data-action="appear" data-arg="${id}" title="${esc(desc)}">${icon} ${name}</button>`).join('')}</div>`;
  return `${appear}
          <b class="sub-title">Kích thước bé & khung thông báo</b>
          <div class="seg seg-3 size-presets">${SIZE_PRESETS.map(([id, name, hint]) => `<button class="${size === id ? 'selected' : ''}" data-action="size-preset" data-arg="${id}"><b>${name}</b><small>${hint}</small></button>`).join('')}</div>
          <small class="muted">${size === 'custom' ? '✏️ Đang dùng kích thước tùy chỉnh. ' : ''}<a href="#notify/style">Chỉnh chi tiết →</a></small>`;
}

/** 🩺 Windows self-diagnostics: tells "the pet can't read" apart from "the app never used Windows notifications". */
function winDiagHtml(a) {
  const x = a.extra || {};
  const access = x.access === 'Allowed' ? '✅ Đã cho phép' : x.access ? `⚠️ ${esc(x.access)} — ${esc(x.accessHint || '')}` : '⏳ Đang kiểm tra…';
  const center = x.inCenter == null ? '—' : `${x.inCenter} thông báo`;
  const last = x.lastAt ? ` · gần nhất: ${esc(x.lastApp || '')} lúc ${new Date(x.lastAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : '';
  return `
        <details class="win-diag" ${a.status === 'Connected' && (x.captured || 0) > 0 ? '' : 'open'}>
          <summary><b>🩺 Kiểm tra nhanh</b><span class="muted small">${a.status === 'Connected' ? `bé đã bắt ${x.captured || 0} thông báo` : 'cần xem'}</span></summary>
          <ul>
            <li><span>Hệ điều hành</span><b>${esc(x.os || '—')}</b></li>
            <li><span>Quyền đọc thông báo</span><b>${access}</b></li>
            <li><span>Trung tâm thông báo đang giữ</span><b>${center}</b></li>
            <li><span>Bé đã bắt được</span><b>${x.captured || 0} thông báo${last}</b></li>
          </ul>
          <div class="diag-actions">
            <button class="btn btn-primary small" data-action="win-test-toast">🧪 Gửi thông báo thử</button>
            <button class="btn btn-ghost small" data-action="win-probe-popups" title="Ghi lại trong 60 giây các cửa sổ popup riêng của ứng dụng (nội dung được che bớt)">🔍 Dò popup (60 giây)</button>
            <button class="btn btn-ghost small" data-action="adapter-run" data-arg="windows_nc|open-logs">📄 Log</button>
          </div>
          <details class="diag-help">
            <summary>Thông báo thử hiện được mà Zalo (hoặc app khác) vẫn không hiện?</summary>
            <ol>
              <li>App đó đang dùng <b>cửa sổ thông báo riêng</b>, không qua Windows nên bé không thấy.</li>
              <li>Kiểm tra: khi có tin, mở Trung tâm thông báo (<b>Win + A</b> trên Windows 10, <b>Win + N</b> trên Windows 11). Không thấy tin ở đó → bé cũng không thấy.</li>
              <li>Sửa: bật thông báo của Windows trong cài đặt của app, và trong <b>Cài đặt Windows → Hệ thống → Thông báo → (tên app)</b>, bật cả <i>Hiện trong trung tâm thông báo</i>.</li>
            </ol>
          </details>
        </details>`;
}

function catalogHtml() {
  const q = catalogState.q.trim().toLowerCase();
  const added = new Set(myApps().map(x => x.id));
  const keySet = !!(S.integrations && S.integrations.keySet);
  const local = LOCAL_APPS.filter(l => !keySet || l.id === 'system' || added.has(l.id)).filter(l => !q || `${l.name} ${l.keywords}`.toLowerCase().includes(q)).map(l => ({ ...l, kind: 'local', added: added.has(l.id) }));
  const remote = (catalogState.items || []).filter(t => !local.some(l => l.id === t.toolkit)).map(t => ({ id: t.toolkit, name: t.name, logo: t.logo, desc: t.description, kind: 'composio', added: added.has(t.toolkit) }));
  const cards = [...local, ...remote].map(x => `
    <div class="cat-card">
      <div class="app-logo">${appIcon(x)}</div>
      <div class="cat-main"><b>${esc(x.name)}</b><small>${esc(x.desc || '')}</small></div>
      ${x.added ? '<span class="pill small pill-ok">✓ Đã thêm</span>'
        : x.kind === 'local' ? `<button class="btn btn-primary small" data-action="local-setup" data-arg="${x.id}">＋ Thêm</button>`
        : `<button class="btn btn-primary small" data-action="ig-connect" data-arg="${esc(x.id)}" data-name="${esc(x.name)}" data-logo="${esc(x.logo || '')}">＋ Kết nối</button>`}
    </div>`).join('');
  const status = catalogState.loading ? '<div class="muted center">⏳ Đang tìm…</div>' : catalogState.error ? `<div class="alert">${esc(catalogState.error)}</div>` : '';
  return `${cards || (q ? '<div class="empty">Không tìm thấy ứng dụng phù hợp.</div>' : '')}${status}`;
}

function composioSetupCard() {
  return `
    <div class="unlock-card">
      <div class="unlock-head"><span>🌐</span><div><b>Mở khóa hơn 1000 ứng dụng</b><small>Gmail, Outlook, Teams, Notion, Jira, Trello, Discord, HubSpot… qua dịch vụ kết nối Composio. Bạn tự đăng nhập từng ứng dụng trên trang của họ — app không bao giờ thấy mật khẩu.</small></div></div>
      <ol class="steps compact">
        <li><i>1</i><div><b>Lấy khóa Composio</b><small>Trên dashboard.composio.dev mở <b>Connect → Settings → Sessions &amp; API Key</b> và copy khóa <b>ck_…</b> (hoặc khóa dự án <b>ak_…</b> nếu bạn dùng Project).</small></div><a class="btn btn-ghost small" href="https://dashboard.composio.dev" target="_blank" rel="noopener">Mở composio.dev ↗</a></li>
        <li><i>2</i><div><b>Dán khóa vào đây</b><small>Khóa được mã hóa bằng Keychain của máy, không rời khỏi máy bạn.</small></div>
          <div class="inline-add"><input id="composio-key" type="password" autocomplete="off" placeholder="ck_… hoặc ak_…"><button class="btn btn-primary small" data-action="ig-save-key">Lưu</button></div></li>
      </ol>
    </div>`;
}

let catalogTimer = null;
async function loadCatalog() {
  const ig = S.integrations || {};
  if (!ig.keySet) { catalogState.items = null; paintCatalog(); return; }
  catalogState.loading = true; catalogState.error = ''; paintCatalog();
  try {
    const r = await api(`/api/integrations/catalog?q=${encodeURIComponent(catalogState.q)}`);
    catalogState.items = r.items;
  } catch (err) { catalogState.error = `Không tải được danh sách ứng dụng: ${err.message}`; }
  catalogState.loading = false;
  paintCatalog();
}
function paintCatalog() { const el = document.getElementById('catalog'); if (el) el.innerHTML = catalogHtml(); }

function bindConnect() {
  const q = document.getElementById('catalog-q');
  if (q) q.addEventListener('input', () => { catalogState.q = q.value; paintCatalog(); clearTimeout(catalogTimer); catalogTimer = setTimeout(loadCatalog, 350); });
  if (catalogState.items === null && (S.integrations || {}).keySet) loadCatalog();
}

/* ---------------------------------------------------------------- modal */

function openModal(html) {
  modalEl.innerHTML = `<div class="modal-card">${html}</div>`;
  modalEl.hidden = false;
  modalEl.onclick = (e) => { if (e.target === modalEl) closeModal(); };
}
function closeModal() { modalEl.hidden = true; modalEl.innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalEl.hidden) closeModal(); });

function localSetupModal(id) {
  const a = adapter(id);
  const l = LOCAL_APPS.find(x => x.id === id);
  if (!a || !l) return;
  const labels = SIMPLE_FIELDS[id] || {};
  const fields = a.fields.filter(f => labels[f.key]).map(f => {
    const label = labels[f.key];
    if (f.type === 'secret') return `<label class="field"><b>${label} ${f.isSet ? '<span class="lock">🔒 đã lưu</span>' : ''}</b><input type="password" autocomplete="off" data-af="${f.key}" placeholder="${f.isSet ? '•••••••• (để trống để giữ nguyên)' : esc(f.placeholder || '')}"></label>`;
    if (f.type === 'boolean') return `<label class="toggle-row"><div><b>${label}</b></div><input type="checkbox" data-af="${f.key}" ${f.value ? 'checked' : ''}><span class="switch"></span></label>`;
    if (f.type === 'number') return `<label class="field"><b>${label}</b><input type="number" data-af="${f.key}" value="${f.value ?? ''}"></label>`;
    if (f.type === 'select') return `<label class="field"><b>${label}</b><select data-af="${f.key}">${f.options.map(o => `<option value="${o.value}" ${o.value === f.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    return `<label class="field"><b>${label}</b><input type="text" data-af="${f.key}" value="${esc(f.value ?? '')}"></label>`;
  }).join('');
  openModal(`
    <header class="modal-head"><div class="app-logo"><span>${l.icon}</span></div><div><h3>${esc(l.name)}</h3><small>${esc(l.desc)}</small></div><button class="icon-btn" data-action="modal-close">✕</button></header>
    <ol class="steps compact">${(SETUP_HELP[id] || []).map((t, i) => `<li><i>${i + 1}</i><div><small>${esc(t)}</small></div></li>`).join('')}</ol>
    <div class="modal-fields" data-adapter="${id}">${fields}</div>
    <div class="btn-row"><button class="btn btn-primary" data-action="adapter-connect" data-arg="${id}">${isOn(a) ? '💾 Lưu' : '🔗 Kết nối'}</button><button class="btn btn-ghost" data-action="modal-close">Để sau</button></div>`);
}

async function eventsModal(toolkit) {
  const app = ((S.integrations && S.integrations.apps) || []).find(a => a.toolkit === toolkit);
  if (!app) return;
  openModal(`<header class="modal-head"><div class="app-logo">${appIcon(app)}</div><div><h3>${esc(app.name)}</h3><small>Chọn những sự kiện bạn muốn thú cưng báo.</small></div><button class="icon-btn" data-action="modal-close">✕</button></header><div id="ev-list" class="ev-list"><div class="muted center">⏳ Đang tải…</div></div>`);
  const gw = adapter('gateway');
  try {
    const { items } = await api(`/api/integrations/triggers?toolkit=${encodeURIComponent(toolkit)}`);
    const on = new Set(app.triggers.map(t => t.slug));
    const list = document.getElementById('ev-list');
    if (!list) return;
    list.innerHTML = `${isOn(gw) || connectMode() ? '' : '<div class="alert soft">ℹ️ Để sự kiện tới được máy này cần bật "Cổng nhận sự kiện" (một lần, do người cài đặt thiết lập). Bật tab Theo dõi trong Cài đặt → Kết nối (kỹ thuật) → Gateway.</div>'}
      ${items.length ? items.map(t => `<label class="toggle-row"><div><b>${esc(t.name)}</b><small>${esc(t.description)}</small></div><input type="checkbox" data-ev="${esc(t.slug)}" data-ev-name="${esc(t.name)}" ${on.has(t.slug) ? 'checked' : ''}><span class="switch"></span></label>`).join('') : '<div class="empty">Ứng dụng này chưa có sự kiện nào để báo.</div>'}`;
    list.querySelectorAll('[data-ev]').forEach(inp => inp.addEventListener('change', async () => {
      inp.disabled = true;
      try {
        await api('/api/integrations/trigger', { method: 'POST', body: { toolkit, slug: inp.dataset.ev, name: inp.dataset.evName, enabled: inp.checked } });
        S.integrations = await api('/api/integrations');
        toast(inp.checked ? 'Đã bật sự kiện' : 'Đã tắt sự kiện', 'ok');
      } catch (err) { inp.checked = !inp.checked; toast(err.message, 'error'); }
      inp.disabled = false;
    }));
  } catch (err) {
    const list = document.getElementById('ev-list');
    if (list) list.innerHTML = `<div class="alert">${esc(err.message)}</div>`;
  }
}

/* ---------------------------------------------------------------- monitor (advanced) */

const DELIVERY_LABEL = { realtime_push: '⚡ Realtime push', near_realtime_poll: '⏱️ Near real-time (poll)', scheduled_sync: '🗓️ Scheduled sync', native_os: '🖥️ System event', manual: '✋ Manual' };
const REASON_LABEL = {
  allowed: 'Hiển thị', low_priority: 'Ít quan trọng → Inbox', cooldown: 'Quá nhiều tin cùng app (cooldown)', app_muted: 'App đã tắt tiếng', contact_ignored: 'Người quen: Bỏ qua',
  presence_hidden: 'Đang ẩn thú cưng', presence_minimal: 'Hiện tối giản', critical_bypass: 'Khẩn cấp — vượt rào', queue_overflow: 'Hàng đợi đầy', manual_test: 'Thử nghiệm', not_mentioned: 'Chat không nhắc tên → Inbox'
};
const reasonLabel = (r) => REASON_LABEL[r] || (r || '').replace(/^mode_(\w+)_min_(\w+)$/, 'Chế độ $1 chỉ cho mức ≥ $2').replace(/^mode_(\w+)_blocks_(\w+)$/, 'Chế độ $1 chặn nhóm $2').replace(/^mode_(\w+)$/, 'Chế độ $1');
function deliveryText(a) {
  if (!a.deliveryMode) return '';
  let t = DELIVERY_LABEL[a.deliveryMode] || a.deliveryMode;
  if (a.intervalSeconds) t += a.intervalSeconds >= 120 ? ` · mỗi ${Math.round(a.intervalSeconds / 60)} phút` : ` · mỗi ${a.intervalSeconds}s`;
  return t;
}
function latencyText(source) {
  const L = (S.pipeline.latency || {});
  const parts = [];
  const e2e = L[`${source}:end_to_end`], d2r = L[`${source}:desktop_to_render`], g2d = L[`${source}:gateway_to_desktop`];
  if (e2e && e2e.count) parts.push(`nguồn→hiển thị p50 ${e2e.p50}ms · p95 ${e2e.p95}ms`);
  if (g2d && g2d.count) parts.push(`gateway→desktop p50 ${g2d.p50}ms`);
  if (d2r && d2r.count) parts.push(`desktop→render p50 ${d2r.p50}ms · p95 ${d2r.p95}ms`);
  const n = (d2r && d2r.count) || (e2e && e2e.count) || 0;
  return parts.length ? `${parts.join(' · ')} (n=${n})` : '';
}

const monitorSubs = {
  stats() {
    const st = S.pipeline.stats;
    const total = Object.values(st.byEmotion).reduce((a, b) => a + b, 0) || 0;
    const prioTotal = Object.values(st.byPriority || {}).reduce((a, b) => a + b, 0) || 0;
    return `
      <div class="stat-grid">
        <div class="stat"><b id="st-received">${st.received || 0}</b><span>Đã nhận</span></div>
        <div class="stat"><b>${st.displayed || 0}</b><span>Đã hiển thị</span></div>
        <div class="stat"><b>${(st.deduped || 0) + (st.grouped || 0)}</b><span>Gộp / trùng lặp</span></div>
        <div class="stat"><b>${st.inboxed || 0}</b><span>Vào Hộp thư</span></div>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h3>🎭 Phân bố cảm xúc</h3>
          <div class="bars">
            ${S.emotions.map(e => { const n = st.byEmotion[e.id] || 0; return `<div class="bar-row"><span class="bar-label">${e.emoji} ${e.label}</span><div class="bar"><i class="emo-bg-${e.id}" style="width:${total ? (n / total) * 100 : 0}%"></i></div><b>${n}</b></div>`; }).join('')}
          </div>
          <h3 style="margin-top:18px">🚦 Theo mức ưu tiên</h3>
          <div class="bars">
            ${['critical', 'important', 'normal', 'low'].map(p => { const n = (st.byPriority || {})[p] || 0; return `<div class="bar-row"><span class="bar-label">${PRIORITY_LABEL[p]}</span><div class="bar"><i class="prio-bar-${p}" style="width:${prioTotal ? (n / prioTotal) * 100 : 0}%"></i></div><b>${n}</b></div>`; }).join('')}
          </div>
        </section>
        <section class="panel">
          <h3>📈 Độ trễ đo thực tế</h3>
          <div class="adapter-mini">${Object.entries(S.pipeline.latency || {}).filter(([, v]) => v.count).map(([k, v]) => `<div class="mini-row"><span>${esc(k.replace(':', ' · ').replace(/_/g, ' '))}</span><span>p50 <b>${v.p50}</b>ms · p95 <b>${v.p95}</b>ms <small class="muted">n=${v.count}</small></span></div>`).join('') || '<div class="empty">Chưa có mẫu đo — gửi vài thông báo nhé.</div>'}</div>
          <h3 style="margin-top:18px">🧭 Lý do vào Hộp thư</h3>
          <div class="adapter-mini">${Object.entries(st.byReason || {}).filter(([r]) => r !== 'allowed').map(([r, n]) => `<div class="mini-row"><span>${esc(reasonLabel(r))}</span><b>${n}</b></div>`).join('') || '<div class="muted">—</div>'}</div>
          <div class="mini-row" style="margin-top:12px"><span>Hàng đợi hiện tại</span><b>${S.pipeline.queueLength}</b></div>
        </section>
      </div>
      <section class="panel">
        <h3>🕘 Lịch sử (chi tiết)</h3>
        <div class="history" id="history">${historyRows(S.pipeline.history)}</div>
      </section>`;
  },

  tech() {
    return `
      ${S.secureStorage ? '' : '<div class="alert">⚠️ Bộ lưu trữ bảo mật của hệ điều hành không khả dụng — không thể lưu token.</div>'}
      <div class="adapter-grid">${S.adapters.map(adapterCard).join('')}</div>
      <section class="panel prose">
        <h3>🛡️ Bảo mật</h3>
        <ul>
          <li>Lưu trữ token: <b>${S.secureStorage ? (S.platform === 'darwin' ? 'macOS Keychain ✓' : S.platform === 'win32' ? 'Windows DPAPI ✓' : 'OS keyring ✓') : 'không khả dụng ✗'}</b> · Khóa Composio: <b>${S.integrations && S.integrations.keySet ? 'đã lưu 🔒' : 'chưa có'}</b> ${S.integrations && S.integrations.keySet ? '<button class="btn btn-ghost small danger" data-action="ig-forget-key">Xóa khóa</button>' : ''}</li>
          <li>Máy chủ chỉ lắng nghe <code>127.0.0.1:${S.port}</code>, kiểm tra Host header; API cần token ngẫu nhiên mỗi lần khởi động.</li>
          <li>Sự kiện từ Composio đi qua Gateway HTTPS của bạn (SSE ra ngoài) — máy này không mở cổng ra Internet.</li>
        </ul>
      </section>`;
  },

  rules() {
    const s = S.settings;
    const kw = (s.keywordRules && s.keywordRules.length ? s.keywordRules : S.defaults.keywordRules);
    const appRules = { ...S.defaults.appRules, ...s.appRules };
    return `
      <div class="grid-2 wide-left">
        <section class="panel">
          <h3>🧪 Thử bộ phân loại</h3>
          <p class="muted">Gõ thử một thông báo để xem Emotion Engine chọn cảm xúc nào và vì sao.</p>
          <div class="form-stack">
            <input id="cls-title" placeholder="Tiêu đề (vd: Sếp nhắc deadline 17h)">
            <input id="cls-message" placeholder="Nội dung">
            <input id="cls-app" placeholder="Ứng dụng (slack, github, calendar…)">
          </div>
          <div class="cls-result" id="cls-result"><span class="muted">Kết quả sẽ hiện ở đây</span></div>
          <ol class="hierarchy">
            <li><b>1</b> Quy tắc tùy chỉnh</li><li><b>1b</b> Bé đọc nội dung (emoji, câu chữ)</li><li><b>2</b> Theo ứng dụng</li><li><b>3</b> Từ khóa</li><li><b>4</b> Metadata (priority, mood, event)</li><li><b>5</b> Mặc định theo tính cách</li>
          </ol>
        </section>
        <section class="panel">${previewControls()}</section>
      </div>
      <section class="panel">
        <div class="panel-head"><h3>① Quy tắc tùy chỉnh</h3><button class="btn btn-primary small" data-action="add-rule">＋ Thêm quy tắc</button></div>
        <div class="rules" id="rules">${rulesTable()}</div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h3>② Theo ứng dụng</h3><div class="inline-add"><input id="new-app" placeholder="vd: jira, discord"><button class="btn btn-ghost small" data-action="add-app-rule">＋ Thêm</button></div></div>
          <div class="app-rules">
            ${Object.entries(appRules).map(([app, e]) => `<div class="app-rule"><code>${esc(app)}</code><select data-app-rule="${esc(app)}"><option value="">— không áp dụng —</option>${emotionOptions(e)}</select></div>`).join('')}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>③ Từ khóa</h3><button class="btn btn-ghost small" data-action="reset-keywords">↺ Mặc định</button></div>
          <div class="kw-list">
            ${kw.map((r, i) => `<label class="kw-row"><span>${emo(r.emotion).emoji} ${emo(r.emotion).label}</span><textarea rows="2" data-kw-index="${i}" data-kw-emotion="${r.emotion}">${esc(r.keywords.join(', '))}</textarea></label>`).join('')}
          </div>
        </section>
      </div>`;
  },

  tools() {
    const labels = { planned: 'Kế hoạch', pilot: 'Pilot', runtime_integrated: 'Runtime procedural', production_ready: 'Production' };
    return `
      <section class="panel">
        <h3>🚀 Gửi thông báo thử theo cảm xúc</h3>
        <div class="test-grid">
          ${S.emotions.map(e => `<button class="test-btn emo-border-${e.id}" data-action="test" data-arg="${e.id}"><span>${e.emoji}</span><b>${e.assetKey}</b><small>${esc(e.meaning)}</small></button>`).join('')}
        </div>
        <div class="btn-row">
          ${['critical', 'important', 'normal', 'low'].map(p => `<button class="chip-btn" data-action="test-priority" data-arg="${p}">${PRIORITY_LABEL[p]}</button>`).join('')}
          <span class="muted">← thử qua Attention Engine thật</span>
        </div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <h3>🚦 Hàng đợi & cooldown</h3>
          <div class="form-grid two">
            ${H.number('notifications.maxQueue', 'Tối đa trong hàng đợi', 1, 100)}
            ${H.number('notifications.dedupeSeconds', 'Bỏ trùng trong (giây)', 0, 600)}
            ${H.number('notifications.groupThreshold', 'Gộp khi ≥ N tin cùng app', 2, 50)}
            ${H.number('attention.cooldownCount', 'Cooldown: số thẻ / app', 1, 50)}
            ${H.number('attention.cooldownWindowSec', 'Cooldown: trong (giây)', 0, 600, '0 = tắt')}
            ${H.number('privacy.historyLimit', 'Lịch sử tối đa', 0, 1000)}
          </div>
          <div class="btn-row"><button class="btn btn-ghost small" data-action="clear-queue">🧹 Xóa hàng đợi</button></div>
        </section>
        <section class="panel">
          <h3>✨ Hiển thị chi tiết</h3>
          ${H.slider('appearance.margin', '↔️ Khoảng cách viền', 0, 120, 2, 'px')}
          ${H.slider('sounds.petSensitivity', 'Độ nhạy vuốt ve', 0.3, 3, 0.05, 'x')}
          <div class="btn-row wrap">
            ${[['meow', '🐱'], ['woof', '🐶'], ['squeak', '🐰'], ['chirp', '🐧']].map(([v, l]) => `<button class="chip-btn" data-action="voice" data-arg="${v}">${l}</button>`).join('')}
            <button class="chip-btn" data-action="bell">🔔</button>
            ${S.emotions.map(e => `<button class="chip-btn" data-action="emo-sound" data-arg="${e.id}">${e.emoji}</button>`).join('')}
          </div>
        </section>
      </div>
      <section class="panel">
        <h3>📦 Mô hình 3D (.glb)</h3>
        <p class="muted">Nhập mô hình glTF Binary 2.0 xuất từ Blender để thay rig procedural (xem docs/BLENDER_GUIDE.md).</p>
        <div class="glb-list">
          ${S.characters.map(c => `<div class="mini-row"><span>${esc(c.name)} <small class="muted">${esc(labels[c.status] || c.status)} · ${c.customModel ? 'GLB tùy chỉnh' : c.bundledModel ? 'GLB đi kèm' : 'Rig procedural'}</small></span>
            <span class="btn-row tight"><label class="btn btn-ghost small">⬆️ Nhập .glb<input type="file" accept=".glb,model/gltf-binary" data-upload="${c.id}" hidden></label>${c.customModel ? `<button class="btn btn-ghost small danger" data-action="remove-glb" data-arg="${c.id}">Xóa GLB</button>` : ''}</span></div>`).join('')}
        </div>
      </section>`;
  }
};

/* ---------------------------------------------------------------- rows */

function historyRows(list, { simple = false } = {}) {
  if (!list || !list.length) return '<div class="empty">Chưa có thông báo nào. Thử gửi một cái nhé! 🐾</div>';
  return list.slice(0, simple ? 8 : 30).map(h => `
    <div class="h-row">
      <span class="h-emo emo-bg-${h.emotion}">${emo(h.emotion).emoji}</span>
      <div class="h-main"><b>${esc(h.title)}</b><small>${esc(h.message || '')}</small></div>
      <div class="h-meta"><span class="pill small">${esc(h.app)}</span><small>${simple ? '' : `${esc(h.matchedBy)} · `}<time title="${esc(new Date(h.receivedAt).toLocaleString())}">${arrivedAt(h.receivedAt)}</time></small></div>
    </div>`).join('');
}

function inboxRows(list) {
  if (!list || !list.length) return '<div class="empty">Hộp thư trống 🐾</div>';
  return list.slice(0, 100).map(h => `
    <div class="h-row ${h.read ? 'read' : ''}">
      <span class="h-emo emo-bg-${h.emotion}">${emo(h.emotion).emoji}</span>
      <div class="h-main"><b>${esc(h.title)}</b><small>${esc(h.message || '')}</small></div>
      <div class="h-meta">
        <small>${esc(h.app)} · ${arrivedAt(h.receivedAt)}${friendlyReason(h.reason) ? ` · ${esc(friendlyReason(h.reason))}` : ''}</small>
        <span class="row-actions">${h.url ? `<a class="link" href="${esc(h.url)}" target="_blank" rel="noopener">Mở ↗</a>` : ''}<button class="icon-btn" data-action="inbox-del" data-arg="${esc(h.id)}" title="Xóa">✕</button></span>
      </div>
    </div>`).join('');
}

function applyInbox(ib) {
  S.pipeline.inbox = ib;
  const el = document.getElementById('inbox-list');
  if (el) el.innerHTML = inboxRows(ib.items);
  updateBadges();
}

async function refreshInbox() { try { applyInbox(await api('/api/inbox')); } catch { /* ignore */ } }

function updateBadges() {
  const n = S.pipeline.inbox ? S.pipeline.inbox.unread : 0;
  const b = document.getElementById('inbox-badge');
  if (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }
  const c = document.getElementById('inbox-count'); if (c) c.textContent = n;
  const d = document.getElementById('dash-inbox'); if (d) d.textContent = n;
  const pill = document.getElementById('mode-pill');
  if (pill && S.effective) {
    const m = S.focusModes[S.effective.mode.id] || {};
    const names = { none: 'Bình thường', work: 'Làm việc', focus: 'Tập trung sâu', meeting: 'Đang họp', gaming: 'Chơi game', relax: 'Thư giãn', sleep: 'Đi ngủ' };
    pill.innerHTML = `${m.emoji || '🐾'} <b>${esc(names[S.effective.mode.id] || S.effective.mode.id)}</b>`;
    pill.onclick = () => { location.hash = '#notify/focus'; };
  }
}

function rulesTable() {
  const rules = S.settings.customRules || [];
  if (!rules.length) return '<div class="empty">Chưa có quy tắc nào. Ví dụ: nếu tiêu đề chứa "sếp" → angry.</div>';
  return rules.map((r, i) => `
    <div class="rule-row" data-rule-index="${i}">
      <label class="mini-toggle"><input type="checkbox" data-rule-field="enabled" ${r.enabled ? 'checked' : ''}><span class="switch"></span></label>
      <select data-rule-field="field">${[['any', 'Tiêu đề + nội dung'], ['title', 'Tiêu đề'], ['message', 'Nội dung'], ['app', 'Ứng dụng']].map(([v, l]) => `<option value="${v}" ${r.field === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select data-rule-field="match">${[['contains', 'chứa'], ['equals', 'bằng'], ['regex', 'regex']].map(([v, l]) => `<option value="${v}" ${r.match === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input data-rule-field="pattern" value="${esc(r.pattern)}" placeholder="từ khóa / mẫu">
      <span class="arrow">→</span>
      <select data-rule-field="emotion">${emotionOptions(r.emotion)}</select>
      <button class="icon-btn" data-action="del-rule" data-arg="${i}" title="Xóa">🗑️</button>
    </div>`).join('');
}

function adapterCard(a) {
  const unsupported = a.status === 'Unsupported';
  const fields = a.fields.map(f => {
    if (f.type === 'secret') return `<label class="field"><b>${esc(f.label)} ${f.isSet ? '<span class="lock">🔒 đã lưu</span>' : ''}</b><input type="password" autocomplete="off" data-af="${f.key}" placeholder="${f.isSet ? '•••••••• (để trống để giữ nguyên)' : esc(f.placeholder || '')}"></label>`;
    if (f.type === 'boolean') return `<label class="toggle-row compact"><div><b>${esc(f.label)}</b></div><input type="checkbox" data-af="${f.key}" ${f.value ? 'checked' : ''}><span class="switch"></span></label>`;
    if (f.type === 'number') return `<label class="field"><b>${esc(f.label)}</b><input type="number" data-af="${f.key}" value="${f.value ?? ''}"></label>`;
    if (f.type === 'text') return `<label class="field"><b>${esc(f.label)}</b><input type="text" autocomplete="off" spellcheck="false" data-af="${f.key}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}"></label>`;
    if (f.type === 'select') return `<label class="field"><b>${esc(f.label)}</b><select data-af="${f.key}">${f.options.map(o => `<option value="${o.value}" ${o.value === f.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    return '';
  }).join('');
  const on = isOn(a);
  const webhookExtra = a.id === 'webhook' ? `
    <div class="code-block"><button class="copy" data-action="copy" data-arg="curl-sample">Copy</button><pre id="curl-sample">curl -X POST http://127.0.0.1:${S.port}/notify \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Build xong!","message":"CI passed ✅","app":"github"}'</pre></div>` : '';
  return `
    <article class="adapter ${unsupported ? 'unsupported' : ''}" data-adapter="${a.id}">
      <header>
        <span class="adapter-icon">${a.icon}</span>
        <div><h3>${esc(a.name)}</h3><small>${esc(a.description)}</small></div>
        <span class="status ${STATUS_CLASS[a.status]}" data-adapter-status="${a.id}">${STATUS_VI[a.status]}</span>
      </header>
      ${a.deliveryMode ? `<div class="pill-row"><span class="pill small delivery-${a.deliveryMode}">${esc(deliveryText(a))}</span><span class="pill small">${a.processing === 'cloud' ? '☁️ Qua Gateway đám mây của bạn' : '💻 Xử lý cục bộ'}</span></div>` : ''}
      ${latencyText(a.id) ? `<div class="latency-line">📈 ${esc(latencyText(a.id))}</div>` : ''}
      <div class="adapter-detail" data-adapter-detail="${a.id}">${esc(a.detail || '')}${a.lastEventAt ? ` · sự kiện gần nhất ${timeAgo(a.lastEventAt)} (${a.eventCount})` : ''}</div>
      ${unsupported ? '' : `
        ${a.help ? `<details class="help"><summary>Hướng dẫn thiết lập</summary><p>${esc(a.help)}</p></details>` : ''}
        ${fields ? `<div class="adapter-fields">${fields}</div>` : ''}
        ${webhookExtra}
        <div class="btn-row">
          <button class="btn btn-primary small" data-action="adapter-connect" data-arg="${a.id}">${on ? '↻ Lưu & kết nối lại' : '🔗 Lưu & kết nối'}</button>
          ${on ? `<button class="btn btn-ghost small" data-action="adapter-disconnect" data-arg="${a.id}">Ngắt kết nối</button>` : ''}
          ${(a.actions || []).map(x => `<button class="btn btn-ghost small" data-action="adapter-run" data-arg="${a.id}|${x.id}">${esc(x.label)}</button>`).join('')}
          ${a.fields.some(f => f.type === 'secret' && f.isSet) ? `<button class="btn btn-ghost small danger" data-action="adapter-forget" data-arg="${a.id}">Xóa token</button>` : ''}
        </div>`}
    </article>`;
}

/* ================================================================== routing */

function parseHash() {
  let h = (location.hash || '#home').slice(1);
  if (LEGACY[h]) h = LEGACY[h];
  let [r, s = ''] = h.split('/');
  if (!pages[r] || (r === 'monitor' && !advanced())) r = 'home';
  if (SUBS[r] && !SUBS[r].includes(s)) s = SUBS[r][0];
  return [r, s];
}

function render() {
  [route, sub] = parseHash();
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  stageHome.appendChild(previewEl);
  main.innerHTML = `<div class="page page-${route}">${pages[route]()}</div>`;
  main.scrollTop = 0;
  syncInputs();
  if (document.getElementById('preview-host')) {
    mountPreview('preview-host');
    setPreviewEmotion(previewEmotion ?? 'idle');
  }
  updateBadges();
  if (route === 'monitor' && sub === 'rules') bindRules();
  if (route === 'monitor' && sub === 'tools') bindUploads();
  if (route === 'connect') bindConnect();
  if (route === 'pet') bindMoodTry();
  if (route === 'inbox') refreshInbox();
}

window.addEventListener('hashchange', render);

/* ================================================================== section behaviours */

function bindUploads() {
  main.querySelectorAll('[data-upload]').forEach(inp => inp.addEventListener('change', async () => {
    const file = inp.files[0];
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) { toast('File quá lớn (tối đa 60MB)', 'error'); return; }
    try {
      await api(`/api/pets/${inp.dataset.upload}/model`, { method: 'POST', raw: await file.arrayBuffer() });
      toast('Đã nhập mô hình .glb 🎉', 'ok');
      await refreshState();
      if (inp.dataset.upload === S.settings.activePet && stage) stage.reloadModel();
      render();
    } catch (err) { toast(err.message, 'error'); }
  }));
}

const MOOD_BY = { contact: 'Theo người quen', attitude: 'Theo thái độ đã chọn', mood: 'Bé đọc từ nội dung', app: 'Theo ứng dụng', keyword: 'Theo từ khóa', custom: 'Theo quy tắc của bạn', metadata: 'Theo mức ưu tiên', default: 'Cảm xúc mặc định của bé', forced: 'Ứng dụng chỉ định' };
let moodTimer = null;
function bindMoodTry() {
  const inp = document.getElementById('mood-try');
  if (!inp) return;
  const run = async () => {
    const out = document.getElementById('mood-result');
    const message = inp.value.trim();
    if (!message) { out.innerHTML = '<span class="muted">Bé sẽ phản ứng trong khung xem trước ở trên 👆</span>'; return; }
    try {
      const r = await api('/api/classify', { method: 'POST', body: { title: 'Chat', message, app: 'chat' } });
      const c = r.classification;
      const why = c.matchedBy === 'mood' && c.reasons && c.reasons.length ? ` · vì: ${c.reasons.join(', ')}` : '';
      out.innerHTML = `<span class="mood-emo emo-bg-${c.emotion}">${emo(c.emotion).emoji}</span><div><b>${esc(emo(c.emotion).label)}</b><small>${esc(MOOD_BY[c.matchedBy] || c.matchedBy)}${esc(why)}</small></div>`;
      setPreviewEmotion(c.emotion);
      if (stage) stage.wake(2500);
    } catch (err) { out.textContent = err.message; }
  };
  inp.addEventListener('input', () => { clearTimeout(moodTimer); moodTimer = setTimeout(run, 250); });
  main.querySelectorAll('[data-mood-example]').forEach(b => b.addEventListener('click', () => { inp.value = b.dataset.moodExample; run(); }));
}

let clsTimer = null;
function bindRules() {
  const run = async () => {
    const title = document.getElementById('cls-title').value;
    const message = document.getElementById('cls-message').value;
    const app = document.getElementById('cls-app').value;
    const out = document.getElementById('cls-result');
    if (!title && !message && !app) { out.innerHTML = '<span class="muted">Kết quả sẽ hiện ở đây</span>'; return; }
    try {
      const r = await api('/api/classify', { method: 'POST', body: { title, message, app } });
      const c = r.classification;
      const labels = { contact: '👥 Người quen', attitude: '🎭 Theo thái độ', custom: '① Quy tắc tùy chỉnh', mood: '①ᵇ Bé đọc nội dung', app: '② Theo ứng dụng', keyword: '③ Từ khóa', metadata: '④ Metadata', default: '⑤ Mặc định', forced: 'Ép buộc' };
      out.innerHTML = `<div class="cls-emo emo-bg-${c.emotion}">${emo(c.emotion).emoji}</div>
        <div><b>${emo(c.emotion).label} <code>${c.emotion}</code></b><small>${labels[c.matchedBy]} · ${esc(c.rule)}${c.baseEmotion !== c.emotion ? ` · tính cách đổi từ ${c.baseEmotion}` : ''}${c.annoying ? ' · 😤 né tránh vuốt ve' : ''}</small>
        <small>${r.attention ? `${PRIORITY_LABEL[r.attention.priority]} · ${r.attention.action === 'show' ? '🪧 Hiện thẻ' : '📥 Vào Inbox'} — ${esc(reasonLabel(r.attention.reason))}` : ''}</small></div>`;
      setPreviewEmotion(c.emotion);
    } catch (err) { out.textContent = err.message; }
  };
  ['cls-title', 'cls-message', 'cls-app'].forEach(id => document.getElementById(id).addEventListener('input', () => { clearTimeout(clsTimer); clsTimer = setTimeout(run, 250); }));
  main.querySelector('#rules').addEventListener('change', onRuleEdit);
  main.querySelector('#rules').addEventListener('input', (e) => { if (e.target.dataset.ruleField === 'pattern') onRuleEdit(e); });
  main.querySelectorAll('[data-app-rule]').forEach(sel => sel.addEventListener('change', () => {
    queueSave({ appRules: { ...S.settings.appRules, [sel.dataset.appRule]: sel.value || null } }, true);
  }));
  main.querySelectorAll('[data-kw-index]').forEach(ta => ta.addEventListener('change', () => {
    const rules = [...main.querySelectorAll('[data-kw-index]')].map(t => ({ emotion: t.dataset.kwEmotion, keywords: t.value.split(',').map(s => s.trim()).filter(Boolean) }));
    queueSave({ keywordRules: rules }, true);
  }));
}

function onRuleEdit(e) {
  const row = e.target.closest('[data-rule-index]');
  if (!row) return;
  const i = Number(row.dataset.ruleIndex);
  const rules = S.settings.customRules.map(r => ({ ...r }));
  const f = e.target.dataset.ruleField;
  rules[i][f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  queueSave({ customRules: rules }, f !== 'pattern');
}

async function refreshIntegrations({ remote = false } = {}) {
  try {
    S.integrations = remote ? await api('/api/integrations/refresh', { method: 'POST' }) : await api('/api/integrations');
  } catch (err) { if (remote) toast(err.message, 'error'); }
}

const actions = {
  async test(arg) {
    try {
      const r = await api('/api/test-notification', { method: 'POST', body: { emotion: arg } });
      toast(r.inboxed ? '📥 Đang tập trung — tin thử đã vào Hộp thư' : `Đã gửi ${emo(arg).emoji} ra desktop!`, 'ok');
    } catch (err) { toast(err.message, 'error'); }
  },
  'stage-play'(arg) { ensureStage(); stage.play(arg); if (arg === 'pet') { sound.purr(); bubble('Purrr~ 💕'); } if (arg === 'kick') setTimeout(() => sound.whoosh(), 300); },
  'pick-pet'(arg) {
    if (arg === S.settings.activePet) return;
    queueSave({ activePet: arg }, true);
    if (stage) stage.setSpecies(arg);
    render();
  },
  async 'remove-glb'(arg) {
    await api(`/api/pets/${arg}/model`, { method: 'DELETE' });
    toast('Đã xóa GLB tùy chỉnh, quay lại rig procedural');
    await refreshState();
    if (stage && arg === S.settings.activePet) stage.reloadModel();
    render();
  },
  'add-rule'() {
    const rules = [...(S.settings.customRules || []), { id: `rule_${Date.now()}`, name: '', enabled: true, field: 'any', match: 'contains', pattern: 'sếp', emotion: 'angry' }];
    S.settings.customRules = rules;
    queueSave({ customRules: rules }, true);
    document.getElementById('rules').innerHTML = rulesTable();
  },
  'del-rule'(arg) {
    const rules = S.settings.customRules.filter((_, i) => i !== Number(arg));
    S.settings.customRules = rules;
    queueSave({ customRules: rules }, true);
    document.getElementById('rules').innerHTML = rulesTable();
  },
  'add-app-rule'() {
    const input = document.getElementById('new-app');
    const name = (input ? input.value : '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!name) { toast('Nhập tên ứng dụng trước nhé', 'error'); return; }
    queueSave({ appRules: { ...S.settings.appRules, [name]: 'excited' } }, true);
    setTimeout(render, 350);
  },
  'reset-keywords'() { queueSave({ keywordRules: S.defaults.keywordRules }, true); setTimeout(render, 350); },
  async 'clear-queue'() { await api('/api/queue/clear', { method: 'POST' }); toast('Đã xóa hàng đợi'); },
  async 'clear-history'() { await api('/api/history', { method: 'DELETE' }); S.pipeline.history = []; toast('Đã xóa thông báo gần đây'); },
  async 'reset-settings'() {
    if (!confirm(tr('Khôi phục toàn bộ cài đặt về mặc định? (Token kết nối được giữ nguyên)'))) return;
    S.settings = await api('/api/settings/reset', { method: 'POST' });
    applyTheme(S.settings.appearance.uiTheme);
    toast('Đã khôi phục cài đặt gốc');
    renderNav();
    render();
  },
  'cooldown-preset'(id) {
    const p = COOLDOWN_PRESETS.find(([k]) => k === id);
    if (!p) return;
    queueSave({ attention: p[3] }, true);
    main.querySelectorAll('.choice').forEach(b => b.classList.toggle('selected', b.dataset.arg === id));
  },
  async 'adapter-connect'(id) {
    const card = document.querySelector(`[data-adapter="${id}"]`);
    const values = {};
    card.querySelectorAll('[data-af]').forEach(el => {
      if (el.type === 'password') { if (el.value.trim()) values[el.dataset.af] = el.value.trim(); }
      else if (el.type === 'checkbox') values[el.dataset.af] = el.checked;
      else if (el.type === 'number') values[el.dataset.af] = Number(el.value);
      else values[el.dataset.af] = el.value;
    });
    const btn = document.querySelector(`[data-action="adapter-connect"][data-arg="${id}"]`);
    if (btn) { btn.disabled = true; btn.textContent = tr('⏳ Đang kết nối…'); }
    try {
      await api(`/api/adapters/${id}/configure`, { method: 'POST', body: values });
      const d = await api(`/api/adapters/${id}/connect`, { method: 'POST' });
      updateAdapter(d, true);
      const ok = d.status === 'Connected';
      toast(ok ? `${d.icon} ${d.name}: đã kết nối!` : `${d.name}: ${STATUS_VI[d.status]} — ${d.detail}`, ok ? 'ok' : 'error');
      if (ok && !modalEl.hidden) { closeModal(); if (route === 'connect') render(); }
      else if (btn) { btn.disabled = false; btn.textContent = tr('🔗 Kết nối'); }
    } catch (err) { toast(err.message, 'error'); if (btn) btn.disabled = false; }
  },
  async 'adapter-disconnect'(id) { updateAdapter(await api(`/api/adapters/${id}/disconnect`, { method: 'POST' }), true); },
  async 'adapter-forget'(id) {
    const a = adapter(id);
    const body = Object.fromEntries(a.fields.filter(f => f.type === 'secret').map(f => [f.key, null]));
    await api(`/api/adapters/${id}/disconnect`, { method: 'POST' });
    updateAdapter(await api(`/api/adapters/${id}/configure`, { method: 'POST', body }), true);
    toast('Đã xóa token khỏi Keychain');
  },
  'local-setup'(id) { localSetupModal(id); },
  async 'local-remove'(id) {
    if (!confirm(tr('Gỡ ứng dụng này? Bạn có thể thêm lại bất cứ lúc nào.'))) return;
    updateAdapter(await api(`/api/adapters/${id}/disconnect`, { method: 'POST' }));
    await refreshState();
    render();
  },
  'modal-close'() { closeModal(); },
  'chat-suggest'() {
    const full = S.chatNameSuggestion || '';
    if (!full) return;
    const given = full.split(/\s+/)[0]; // macOS full name is "Given Family" → the name people @ you with
    queueSave({ chat: { names: [full, `@${given}`] } }, true);
    setTimeout(render, 350);
  },
  async 'ig-save-key'() {
    const inp = document.getElementById('composio-key');
    const key = inp ? inp.value.trim() : '';
    if (!key) { toast('Dán khóa Composio trước nhé', 'error'); return; }
    try {
      S.integrations = await api('/api/integrations/key', { method: 'PUT', body: { key } });
      toast(S.integrations.mode === 'connect' ? '🎉 Đã kết nối Composio Connect!' : '🎉 Đã mở khóa hơn 1000 ứng dụng!', 'ok');
      catalogState.items = null;
      render();
    } catch (err) { toast(err.message, 'error'); }
  },
  async 'ig-forget-key'() {
    if (!confirm(tr('Xóa khóa Composio khỏi máy này?'))) return;
    S.integrations = await api('/api/integrations/key', { method: 'PUT', body: { key: '' } });
    catalogState.items = null;
    render();
  },
  async 'ig-connect'(toolkit, el) {
    try {
      await api('/api/integrations/connect', { method: 'POST', body: { toolkit, name: el && el.dataset.name, logo: el && el.dataset.logo } });
      await refreshIntegrations();
      toast('Đã mở trang đăng nhập trong trình duyệt. Đăng nhập xong quay lại đây nhé!', 'ok');
      render();
    } catch (err) { toast(err.message, 'error'); }
  },
  async 'ig-poll'(_, el) {
    if (el) el.disabled = true;
    try {
      const r = await api('/api/integrations/poll', { method: 'POST' });
      if (r.status) S.integrations = r.status;
      toast(r.status && r.status.polling.lastError ? r.status.polling.lastError : r.emitted ? `🔔 Có ${r.emitted} tin mới` : 'Chưa có tin mới', r.status && r.status.polling.lastError ? 'error' : 'ok');
      render();
    } catch (err) { toast(err.message, 'error'); }
    if (el) el.disabled = false;
  },
  async 'ig-refresh'() { await refreshIntegrations({ remote: true }); render(); },
  'ig-events'(toolkit) { eventsModal(toolkit); },
  async 'ig-remove'(toolkit) {
    if (!confirm(tr('Gỡ ứng dụng này và ngắt kết nối với Composio?'))) return;
    try { S.integrations = await api(`/api/integrations/apps/${encodeURIComponent(toolkit)}`, { method: 'DELETE' }); render(); } catch (err) { toast(err.message, 'error'); }
  },
  'copy-text'(arg) { navigator.clipboard.writeText(arg || '').then(() => toast('Đã copy đường dẫn — trong cửa sổ chọn file bấm ⌘⇧G rồi dán', 'ok')); },
  copy(arg) { navigator.clipboard.writeText(document.getElementById(arg).textContent).then(() => toast('Đã copy')); },
  voice(arg) { sound.voice(arg, 'happy'); },
  'speak-test'() {
    if (!window.speechSynthesis) { toast('Máy này không có giọng đọc', 'error'); return; }
    const en = S.settings.appearance.language === 'en';
    const u = new SpeechSynthesisUtterance(en ? 'Hi! Time to rest your eyes for a bit!' : 'Chào bạn! Mình nghỉ mắt một chút nha!');
    u.lang = en ? 'en-US' : 'vi-VN';
    u.voice = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(en ? 'en' : 'vi')) || null;
    u.pitch = 1.55; u.volume = Math.min(1, (S.settings.sounds.volume || 0.45) * 1.6);
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  },
  bell() { sound.bell(); },
  'emo-sound'(arg) { sound.emotion(arg, 'meow'); },
  async 'test-priority'(arg) {
    try {
      const r = await api('/api/test-notification', { method: 'POST', body: { emotion: arg === 'critical' ? 'surprised' : arg === 'low' ? 'thinking' : 'happy', priority: arg } });
      toast(r.inboxed ? `📥 ${PRIORITY_LABEL[arg]} → Inbox (${reasonLabel(r.reason)})` : `🪧 ${PRIORITY_LABEL[arg]} → hiện trên desktop`, r.inboxed ? '' : 'ok');
      refreshInbox();
    } catch (err) { toast(err.message, 'error'); }
  },
  'toggle-private'(app) {
    const cur = new Set(S.settings.privacy.hiddenApps || []);
    if (cur.has(app)) cur.delete(app); else cur.add(app);
    queueSave({ privacy: { hiddenApps: [...cur] } }, true);
    setTimeout(render, 300);
  },
  appear(id) {
    if (!APPEAR_PATCH[id]) return;
    queueSave(APPEAR_PATCH[id], true);
    setTimeout(render, 150);
  },
  'size-preset'(id) {
    const p = SIZE_PRESETS.find(x => x[0] === id);
    if (!p) return;
    const v = p[3];
    queueSave({ appearance: { petScale: v.petScale }, notifications: { size: v.size, cardScale: v.cardScale } }, true);
    setTimeout(render, 150);
  },
  'contact-add'() {
    const name = (document.getElementById('ct-name').value || '').trim();
    const group = document.getElementById('ct-group').value;
    const emotion = document.getElementById('ct-emo').value || null;
    if (!name) { toast('Nhập tên người gửi trước nhé', 'error'); return; }
    const list = (S.settings.contacts || []).filter(c => c.name.toLowerCase() !== name.toLowerCase());
    queueSave({ contacts: [...list, { name, group, emotion }] }, true);
    toast(`Đã thêm ${name}`, 'ok');
    setTimeout(render, 300);
  },
  'contact-remove'(i) {
    const list = [...(S.settings.contacts || [])];
    list.splice(Number(i), 1);
    queueSave({ contacts: list }, true);
    setTimeout(render, 300);
  },
  async 'win-probe-popups'() {
    try {
      const r = await api('/api/adapters/windows_nc/action', { method: 'POST', body: { action: 'probe-popups' } });
      if (!r.ok) { toast(r.error || 'Không dò được', 'error'); return; }
      toast('🔍 Đang dò 60 giây — hãy nhờ ai nhắn Zalo (hoặc app khác) cho bạn ngay bây giờ. Xong sẽ tự mở file kết quả.', 'ok');
    } catch (err) { toast(err.message, 'error'); }
  },
  async 'win-test-toast'() {
    try {
      const r = await api('/api/adapters/windows_nc/action', { method: 'POST', body: { action: 'test-toast' } });
      toast('Đã gửi thông báo thử — chờ vài giây…');
      setTimeout(async () => {
        await refreshState();
        const a = adapter('windows_nc');
        const got = a && a.extra && a.extra.captured > (r.before || 0);
        toast(got ? '✅ Bé đã đọc được thông báo của Windows' : '❌ Bé chưa thấy thông báo thử. Xem dòng "Quyền đọc thông báo" và mở thư mục log.', got ? 'ok' : 'error');
        render();
      }, 5000);
    } catch (err) { toast(err.message, 'error'); }
  },
  'toggle-mute'(app) {
    const cur = new Set(S.settings.attention.mutedApps || []);
    if (cur.has(app)) cur.delete(app); else cur.add(app);
    queueSave({ attention: { mutedApps: [...cur] } }, true);
    setTimeout(render, 300);
  },
  'mute-add'() {
    const inp = document.getElementById('mute-app');
    const name = (inp ? inp.value : '').trim().toLowerCase();
    if (!name) return;
    actions['toggle-mute'](name);
  },
  async 'inbox-read-all'() { applyInbox(await api('/api/inbox/read', { method: 'POST', body: {} })); },
  async 'inbox-clear'() {
    if (!confirm(tr('Xóa toàn bộ tin trong Hộp thư?'))) return;
    await api('/api/inbox', { method: 'DELETE' }); applyInbox({ unread: 0, items: [], digest: { total: 0, byApp: [], byPriority: {} } });
  },
  async 'inbox-del'(id) { applyInbox(await api(`/api/inbox/${id}`, { method: 'DELETE' })); },
  async 'quit-app'() {
    if (!confirm(tr('Tắt hẳn Cute Pet Companion? Thú cưng sẽ biến mất cho tới khi bạn mở lại app.'))) return;
    await api('/api/app/quit', { method: 'POST' }).catch(() => {});
    document.body.innerHTML = `<div class="loading">👋 ${tr('Đã tắt Cute Pet Companion. Bạn có thể đóng cửa sổ này.')}</div>`;
  },
  async 'adapter-run'(arg) {
    const [id, action] = String(arg).split('|');
    const confirmText = {
      'replace-all': 'Tắt banner gốc của TẤT CẢ ứng dụng trên Mac để chỉ thú cưng hiện thông báo?\n\nThông báo vẫn được lưu trong Trung tâm thông báo. Cài đặt gốc được sao lưu — bấm "Hoàn tác" để trả lại bất cứ lúc nào.',
      'restore-banners': 'Bật lại banner gốc của macOS cho các ứng dụng đã bị tắt?'
    }[action];
    if (confirmText && !confirm(tr(confirmText))) return;
    try {
      const r = await api(`/api/adapters/${id}/action`, { method: 'POST', body: { action } });
      if (action === 'replace-all') toast(r.stubborn && r.stubborn.length ? `🤫 Đã tắt banner gốc của ${r.changed} ứng dụng (một số app đang mở cần tắt thủ công)` : `🤫 Đã tắt banner gốc của ${r.changed} ứng dụng`, 'ok');
      else if (action === 'restore-banners') toast(`↺ Đã khôi phục banner gốc cho ${r.restored} ứng dụng`, 'ok');
      else if (action === 'reset-accessibility') toast('Đã xóa mục quyền cũ. Bật "Cute Pet Companion" trong danh sách Trợ năng vừa mở nhé', 'ok');
      else if (action === 'reveal-helper') toast('Kéo file nc-bridge (Finder vừa mở) vào danh sách Trợ năng rồi bật công tắc', 'ok');
      else if (action === 'request-accessibility') toast(r.trusted ? '✅ Đã có quyền' : 'Hãy bật Cute Pet Companion trong danh sách rồi quay lại đây', r.trusted ? 'ok' : '');
      else toast('Đã mở Cài đặt Hệ thống', 'ok');
      await refreshState(); if (route === 'connect' || route === 'monitor') render();
    } catch (err) { toast(err.message, 'error'); }
  },
  'reset-position'() {
    queueSave({ appearance: { customPosition: { x: null, y: null } } }, true);
    toast('Đã đưa bé về góc đã chọn', 'ok');
    setTimeout(() => render(), 350);
  }
};

document.addEventListener('click', (e) => {
  const p = e.target.closest('[data-preview-emotion]');
  if (p) {
    const id = p.dataset.previewEmotion;
    setPreviewEmotion(id);
    if (id !== 'idle') sound.emotion(id, 'meow');
    // Preview only: after a moment the pet goes back to its attitude's resting pose.
    clearTimeout(setPreviewEmotion.back);
    if (id !== 'idle') setPreviewEmotion.back = setTimeout(() => { if (previewEmotion === id) setPreviewEmotion('idle'); }, 3500);
    return;
  }
  const a = e.target.closest('[data-action]');
  if (a && actions[a.dataset.action]) {
    if (a.tagName === 'LABEL' || e.target.closest('input[type=file]')) return; // file pickers
    e.preventDefault();
    if (a.disabled) return;
    actions[a.dataset.action](a.dataset.arg, a);
  }
});

// System replacement master switch (wizard header)
document.addEventListener('change', async (e) => {
  const t = e.target.closest('[data-action-toggle="system-replace"]');
  if (!t) return;
  const id = S.platform === 'win32' ? 'windows_nc' : 'macos_nc';
  t.disabled = true;
  try {
    if (t.checked) { updateAdapter(await api(`/api/adapters/${id}/connect`, { method: 'POST' })); }
    else updateAdapter(await api(`/api/adapters/${id}/disconnect`, { method: 'POST' }));
  } catch (err) { toast(err.message, 'error'); }
  await refreshState();
  render();
});

function updateAdapter(d, rerenderCard = false) {
  const i = S.adapters.findIndex(a => a.id === d.id);
  if (i >= 0) S.adapters[i] = d;
  document.querySelectorAll(`[data-adapter-status="${d.id}"]`).forEach(el => { el.className = `status ${STATUS_CLASS[d.status]}`; el.textContent = STATUS_VI[d.status]; });
  const det = document.querySelector(`[data-adapter-detail="${d.id}"]`);
  if (det) det.textContent = d.detail || '';
  if (rerenderCard && route === 'monitor' && sub === 'tech') {
    const card = main.querySelector(`[data-adapter="${d.id}"]`);
    if (card) card.outerHTML = adapterCard(d);
  }
}

/* ================================================================== live updates */

async function refreshState() { S = await api('/api/state'); }

function connectEvents() {
  const dot = document.getElementById('live-dot');
  const es = new EventSource(`/api/events?token=${encodeURIComponent(TOKEN)}`);
  es.addEventListener('hello', () => { dot.className = 'live-dot on'; dot.querySelector('span').textContent = tr('Đang chạy'); });
  es.onerror = () => { dot.className = 'live-dot'; dot.querySelector('span').textContent = tr('Mất kết nối với app…'); };
  es.addEventListener('adapter', (e) => {
    const d = JSON.parse(e.data);
    const prev = adapter(d.id);
    const changed = !prev || prev.status !== d.status || JSON.stringify(prev.extra) !== JSON.stringify(d.extra);
    updateAdapter(d);
    if (changed && (route === 'connect' || route === 'home') && modalEl.hidden) render();
  });
  es.addEventListener('settings', (e) => {
    if (Object.keys(pendingPatch).length) return;
    const prevAdv = advanced();
    S.settings = JSON.parse(e.data);
    setLanguage(S.settings.appearance.language);
    applyTheme(S.settings.appearance.uiTheme);
    syncInputs();
    applyPreviewSettings();
    if (prevAdv !== advanced()) renderNav();
  });
  es.addEventListener('history', (e) => {
    const h = JSON.parse(e.data);
    S.pipeline.history.unshift(h);
    S.pipeline.stats.received++;
    const el = document.getElementById('history');
    if (el) el.innerHTML = historyRows(S.pipeline.history, { simple: route === 'home' });
    const r = document.getElementById('st-received');
    if (r) r.textContent = S.pipeline.stats.received;
  });
  es.addEventListener('display', (e) => {
    const d = JSON.parse(e.data);
    S.pipeline.lastEmotion = d.emotion;
    S.pipeline.stats.byEmotion[d.emotion] = (S.pipeline.stats.byEmotion[d.emotion] || 0) + 1;
    if (route === 'home') setPreviewEmotion(d.emotion, 'notif'); // mirror the desktop pet
  });
  es.addEventListener('characters', (e) => { S.characters = JSON.parse(e.data); });
  es.addEventListener('inbox', (e) => {
    const d = JSON.parse(e.data);
    if (S.pipeline.inbox) S.pipeline.inbox.unread = d.unread;
    updateBadges();
    if (route === 'inbox') refreshInbox();
  });
  es.addEventListener('mode', (e) => {
    S.effective = JSON.parse(e.data);
    updateBadges();
  });
  es.addEventListener('latency', () => {
    if (route === 'monitor' && sub === 'stats') refreshState().then(render);
  });
}

// Coming back from the browser after signing in to an app → pick up the new connection.
window.addEventListener('focus', () => {
  if (S && route === 'connect' && (S.integrations || {}).keySet && (S.integrations.apps || []).some(a => a.status === 'pending')) {
    refreshIntegrations({ remote: true }).then(() => { if (modalEl.hidden) render(); });
  }
});

/* ================================================================== boot */

(async function boot() {
  try {
    await refreshState();
  } catch (err) {
    main.innerHTML = `<div class="loading">Không kết nối được với Cute Pet Companion (${esc(err.message)}). Hãy mở lại từ menu khay hệ thống.</div>`;
    return;
  }
  setLanguage(S.settings.appearance.language);
  applyTheme(S.settings.appearance.uiTheme);
  [route, sub] = parseHash();
  renderNav();
  render();
  connectEvents();
  makeThumbnails().then(() => { if (route === 'pet') render(); }).catch(() => {});
  // While waiting for the Accessibility permission, re-check every 4 s and flip to ✓ by itself.
  setInterval(async () => {
    if (S.platform !== 'darwin' || !(route === 'connect' || route === 'home') || !modalEl.hidden) return;
    const a = adapter('macos_nc');
    if (!a || (a.extra && a.extra.trusted)) return;
    const before = JSON.stringify([a.extra, S.appAxTrusted]);
    try { await refreshState(); } catch { return; }
    const b = adapter('macos_nc');
    if (JSON.stringify([b && b.extra, S.appAxTrusted]) !== before) render();
  }, 4000);
  setInterval(() => {
    if (route === 'monitor' || route === 'home') refreshState().then(() => S.adapters.forEach(a => updateAdapter(a)));
  }, 30000);
})();
