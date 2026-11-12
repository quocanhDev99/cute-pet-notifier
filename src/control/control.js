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

/** Only http(s) links may become an <a href> (an inbox URL comes from notifications). */
const safeUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : ''; } catch { return ''; } };
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
let savesInFlight = 0;
let saveWaiters = [];
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
  // Resolves once this change is stored (callers re-render then, instead of guessing with a timer).
  return new Promise(resolve => saveWaiters.push(resolve));
}

/** Local edits not yet confirmed by the server: queued ones and those whose PUT is still running. */
const savePending = () => savesInFlight > 0 || Object.keys(pendingPatch).length > 0;

async function flushSave() {
  clearTimeout(saveTimer);
  const p = pendingPatch;
  const waiters = saveWaiters;
  pendingPatch = {};
  saveWaiters = [];
  if (!Object.keys(p).length) { waiters.forEach(w => w()); return; }
  const navChanged = p.system && 'advancedMode' in p.system;
  savesInFlight++;
  try {
    const fresh = await api('/api/settings', { method: 'PUT', body: p });
    // Edits made while this request was running are newer than the server's answer: keep them.
    S.settings = deepMerge(fresh, JSON.parse(JSON.stringify(pendingPatch)));
    if (savesInFlight === 1 && !Object.keys(pendingPatch).length) syncInputs();
    flashSaved();
    if (navChanged) { renderNav(); if (route === 'monitor' && !advanced()) location.hash = '#settings'; }
  } catch (err) { toast(`Lưu thất bại: ${err.message}`, 'error'); }
  finally {
    savesInFlight--;
    waiters.forEach(w => w());
  }
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
    if (c.dataset.choice === 'chat.mode') {
      const m = document.querySelector('.chat-mentions'); if (m) m.hidden = c.dataset.value !== 'mentions';
      // "Only when it's about me" needs your name to spot @mentions: fill it from this Mac's account name.
      if (c.dataset.value === 'mentions' && !(S.settings.chat.names || []).length && S.chatNameSuggestion) {
        actions['chat-suggest']();
        toast(`Đã điền tên của bạn: ${S.chatNameSuggestion} — sửa lại nếu mọi người gọi bạn khác`, 'ok');
      }
    }
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

/* ================================================================== 👥 Người quen (Familiar contacts)
 * The user tells the pet who someone is; the pet never guesses.
 *   ✨ Hay nhắn nhất (suggestions, metadata only) → ① app → ② chat / member(s) → ③ relationship +
 *   emotion + behaviour → saved rules (search · sort · edit · on/off · delete) → ⏰ hours per
 *   relationship → 🧠 memory (learn names · adaptive memory · forget).
 * Chat lists come from an app's OFFICIAL API when connected (Teams via Microsoft Graph, Slack Web
 * API), otherwise from names seen in notifications, otherwise manual entry. Rule priority lives in
 * src/core/contact-rules.js (person > group chat > relationship > app > general > default). */
const CT_APPS = {
  zalo: ['Zalo', '🔵'], messenger: ['Messenger', '💭'], slack: ['Slack', '💬'], teams: ['Teams', '👥'], telegram: ['Telegram', '✈️'],
  discord: ['Discord', '🎮'], whatsapp: ['WhatsApp', '🟢'], messages: ['Tin nhắn', '💬'], viber: ['Viber', '🟣'], line: ['LINE', '🟩'],
  skype: ['Skype', '☁️'], signal: ['Signal', '🔷'], wechat: ['WeChat', '🟢'], googlechat: ['Google Chat', '🟢'], lark: ['Lark', '🪶'], larksuite: ['Lark', '🪶']
};
const ctApp = (id, name) => { const m = CT_APPS[id]; return { label: name || (m ? m[0] : id ? id[0].toUpperCase() + id.slice(1) : 'Mọi ứng dụng'), icon: m ? m[1] : '💬' }; };
const ctFold = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
const ctKey = (c) => `${c.app || '*'}|${c.kind === 'chat' ? 'chat' : 'person'}|${ctFold(c.name)}`;
const CT_ATTN_UI = { auto: 'Theo mối quan hệ', important: '⭐ Luôn báo ngay', normal: 'Bình thường', silent: '🤫 Báo nhẹ nhàng, không kêu', inbox: '📥 Chỉ cất vào Hộp thư' };
const CT_NOTE = { important_sender: 'thường gửi tin quan trọng → bé ưu tiên tin của họ', busy_chat: 'rất sôi nổi hôm nay → bé báo nhẹ nhàng, không kêu' };

const ct = {
  app: null, manual: false, q: '', mq: '', open: null,
  picks: [], // [{ kind, name, app, targetId }]
  group: 'partner', label: '', emotion: '', attention: 'auto',
  editId: null, savedQ: '', sort: 'recent', kind: 'chat', limit: 60, cursor: -1, visible: [],
  api: {}, // sourceId → { state: 'loading'|'ready'|..., chats, detail }
  apiMembers: {} // `${source}:${chatId}` → { state, members, detail }
};

const ctDir = () => S.contactDirectory || { enabled: true, memory: true, apps: [], suggestions: [], insights: [] };
const ctSources = () => S.chatSources || [];
const ctSaved = () => new Map((S.settings.contacts || []).map(c => [ctKey(c), c]));
const ctGroups = () => S.contactGroups || {};
const ctAttn = () => S.contactAttention || { auto: { label: 'Theo mối quan hệ' } };
const ctGroupLabel = (c) => { const g = ctGroups()[c.group] || { emoji: '👤', label: c.group }; return { emoji: g.emoji, label: c.group === 'other' && c.label ? c.label : g.label }; };

/** Apps for step ①: chat apps detected on this computer (installed / running) ∪ apps the pet learned
 *  chats from ∪ connected official-API sources. Statuses are real, never faked. */
function ctAppList() {
  const map = new Map();
  const get = (app) => { if (!map.has(app)) map.set(app, { app, label: ctApp(app).label, icon: null, running: false, installed: false, seen: 0, source: null }); return map.get(app); };
  for (const d of S.msgApps || []) Object.assign(get(d.app), { label: d.label, icon: d.icon, running: d.running, installed: d.installed });
  for (const a of ctDir().apps) { const x = get(a.app); x.seen = a.chats.length; if (!x.installed && a.appName) x.label = a.appName; }
  for (const src of ctSources()) { if (map.has(src.app) || src.state === 'ready') get(src.app).source = src; }
  return [...map.values()].sort((x, y) => Number(y.running) - Number(x.running) || y.seen - x.seen);
}

/** Initials avatar ("[SBM] Loyalty Integration" → "LI"), colour from the name. */
function ctAvatar(name, group) {
  const words = String(name || '').replace(/\[[^\]]*\]|[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const ini = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return `<span class="ct-ava" style="--h:${h}" aria-hidden="true">${esc(ini)}${group ? '<i class="ct-ava-badge">👥</i>' : ''}</span>`;
}

const ctAppIcon = (a) => a.icon ? `<img src="${esc(a.icon)}" alt="">` : `<span>${ctApp(a.app).icon}</span>`;

/** Rows for step ②: official API list (merged with what the pet saw) or the learned list. */
/** Merge members by name; a lone first name ("Nhuc") joins the ONE full name that starts with it ("Nhuc Nguyen"). */
function ctMergeMembers(list) {
  const by = new Map();
  for (const m of list || []) {
    const k = ctFold(m.name);
    if (!k) continue;
    const cur = by.get(k);
    if (cur) cur.count = (cur.count || 0) + (m.count || 0); else by.set(k, { ...m });
  }
  for (const [k, m] of [...by]) {
    if (/\s/.test(k)) continue;
    const full = [...by.keys()].filter(x => x !== k && x.startsWith(`${k} `));
    if (full.length === 1) { const f = by.get(full[0]); f.count = (f.count || 0) + (m.count || 0); by.delete(k); }
  }
  return [...by.values()].sort((x, y) => (y.count || 0) - (x.count || 0) || x.name.localeCompare(y.name, 'vi'));
}

/**
 * Rows for step ② of ONE app — its official API list when connected (merged with what the pet saw),
 * else the chats learned from that app's notifications. Duplicates (same kind + same name, accents
 * ignored) are merged: contact rules match by name, so two rows with one name can't be told apart.
 * Memoized per data version, with folded search keys precomputed.
 */
const ctMemo = { key: '', rows: [] };
function ctRows(appId) {
  const seenApp = ctDir().apps.find(a => a.app === appId);
  const seen = seenApp ? seenApp.chats : [];
  const src = ctSources().find(s => s.app === appId && s.state === 'ready');
  const api = src && ct.api[src.id];
  const useApi = !!(src && api && api.state === 'ready');
  const memKeys = useApi ? Object.keys(ct.apiMembers).filter(k => k.startsWith(`${src.id}:`) && ct.apiMembers[k].state === 'ready').length : 0;
  const key = [appId, useApi ? `api${api.cachedAt}:${api.chats.length}:${memKeys}` : 'seen', seen.length, seen.reduce((n, c) => n + c.count, 0)].join('|');
  if (ctMemo.key === key) return ctMemo.rows;

  let raw;
  if (useApi) {
    const byName = new Map(seen.map(c => [ctFold(c.title), c]));
    raw = api.chats.map(c => {
      const s = byName.get(ctFold(c.title));
      const mem = ct.apiMembers[`${src.id}:${c.id}`];
      const members = c.direct ? [] : (c.members || (mem && mem.state === 'ready' ? mem.members : null) || (s ? s.members : null));
      return { source: src.id, chatId: c.id, title: c.title, direct: c.direct, meeting: !!c.meeting, memberCount: c.memberCount || null,
        lastSeen: Math.max((s && s.lastSeen) || 0, c.lastActivity || 0) || null, count: s ? s.count : null, members };
    });
  } else {
    raw = seen.map(c => ({ source: null, title: c.title, direct: c.direct, lastSeen: c.lastSeen, count: c.count, members: c.direct ? [] : c.members.map(m => ({ id: m.name, name: m.name, count: m.count })) }));
  }
  const merged = new Map();
  for (const r of raw) {
    const k = `${r.direct ? 'p' : 'c'}|${ctFold(r.title)}`;
    const cur = merged.get(k);
    if (!cur) { merged.set(k, { ...r, chatIds: r.chatId ? [r.chatId] : [] }); continue; }
    if ((r.lastSeen || 0) > (cur.lastSeen || 0)) { cur.lastSeen = r.lastSeen; cur.title = r.title; }
    if (r.chatId) cur.chatIds.push(r.chatId);
    cur.count = (cur.count || 0) + (r.count || 0) || null;
    cur.meeting = cur.meeting && r.meeting;
    cur.memberCount = Math.max(cur.memberCount || 0, r.memberCount || 0) || null;
    if (Array.isArray(r.members)) cur.members = [...(cur.members || []), ...r.members];
  }
  const rows = [...merged.values()].map(r => {
    const members = Array.isArray(r.members) ? ctMergeMembers(r.members) : null;
    return { ...r, chatId: r.chatIds[0] || null, key: `${r.direct ? 'p' : 'c'}:${ctFold(r.title)}`, members,
      memberCount: r.memberCount || (members && members.length ? members.length + (r.source ? 1 : 0) : null),
      _f: ctFold(r.title), _m: members ? members.map(m => ctFold(m.name)) : [] };
  }).sort((x, y) => (y.lastSeen || 0) - (x.lastSeen || 0));
  ctMemo.key = key;
  ctMemo.rows = rows;
  return rows;
}

/** "Nhóm <mark>Dự</mark> Án": highlight the (accent-insensitive) match. */
function ctHi(text, q) {
  if (!q) return esc(text);
  const f = ctFold(text);
  const i = f.indexOf(q);
  if (i < 0 || f.length !== String(text).length) return esc(text); // folding changed length: no highlight
  return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
}

/** Compact "when" like Teams: 10:52 today · Hôm qua · 4/11 · 23/4/25. */
function ctWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  if (Date.now() - ts < 60000) return 'vừa xong';
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (new Date(now.getTime() - 864e5).toDateString() === d.toDateString()) return 'Hôm qua';
  return d.getFullYear() === now.getFullYear() ? `${d.getDate()}/${d.getMonth() + 1}` : `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

function ctIsPicked(kind, name) { return ct.picks.some(p => p.kind === kind && ctFold(p.name) === ctFold(name)); }

function ctTag(c) { if (!c) return ''; const g = ctGroupLabel(c); return `<span class="ct-tag${c.enabled === false ? ' off' : ''}">${g.emoji} ${esc(g.label)}</span>`; }

/** Rows matching the current kind filter + search (with which members matched). */
function ctFiltered(rows) {
  const q = ctFold(ct.q);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];
    if (!(ct.kind === 'all' || (ct.kind === 'meeting' ? !!c.meeting : !c.meeting))) continue;
    if (!q) { out.push({ c, i, hits: null }); continue; }
    const titleHit = c._f.includes(q);
    const hits = c._m.length ? c._m.filter(m => m.includes(q)) : [];
    if (titleHit || hits.length) out.push({ c, i, hits: hits.length ? hits : null, titleHit });
  }
  // Searching: title matches first, then member matches.
  if (q) out.sort((x, y) => Number(!!y.titleHit) - Number(!!x.titleHit));
  return out;
}

function ctRowHtml({ c, i, hits }, q, saved, active) {
  const appId = ct.app;
  const kind = c.direct ? 'person' : 'chat';
  const mine = saved.get(ctKey({ app: appId, kind, name: c.title }));
  const open = !c.direct && (ct.open === c.key || !!hits);
  const meta = [c.direct ? 'Chat riêng' : c.meeting ? 'Cuộc họp' : 'Nhóm', c.count ? `${c.count} tin bé đã gặp` : '', ctWhen(c.lastSeen)].filter(Boolean).join(' · ');
  const picked = ctIsPicked(kind, c.title);
  const mq = ctFold(ct.mq);
  // While searching, a group opened only because members matched shows just those members.
  const onlyHits = !!hits && ct.open !== c.key;
  const members = Array.isArray(c.members) ? c.members.filter(m => (!mq || ctFold(m.name).includes(mq)) && (!onlyHits || ctFold(m.name).includes(q))) : null;
  const memState = c.source ? ct.apiMembers[`${c.source}:${c.chatId}`] : null;
  const count = c.memberCount || (c.members && c.members.length) || 0;
  return `
      <li class="${picked ? 'sel' : ''} ${active ? 'kb' : ''}" data-ct-row="${i}" role="option" aria-selected="${picked}">
        <button class="ct-row" data-action="ct-pick" data-arg="${i}" aria-pressed="${picked}" tabindex="-1">
          ${ctAvatar(c.title, !c.direct)}
          <span class="ct-main"><b>${ctHi(c.title, q)}</b><small>${esc(meta)}</small></span>
          ${ctTag(mine)}
          ${picked ? '<span class="ct-check" aria-hidden="true">✓</span>' : ''}
        </button>
        ${!c.direct && (count || c.source) ? `<button class="ct-more ${open ? 'on' : ''}" data-action="ct-open" data-arg="${i}" aria-expanded="${open}" title="Chọn người trong nhóm" tabindex="-1">${count ? `${count} người` : 'Thành viên'} <span class="ct-chev">${open ? '▴' : '▾'}</span></button>` : ''}
        ${open ? `<div class="ct-members">
          ${memState && memState.state === 'loading' ? '<span class="muted small"><span class="ct-spin sm"></span> Đang lấy thành viên…</span>'
            : memState && memState.state !== 'ready' ? `<span class="ct-warn">⚠️ ${esc(memState.detail || 'Không lấy được thành viên')}</span>`
            : members === null ? '<span class="muted small"><span class="ct-spin sm"></span> Đang lấy thành viên…</span>'
            : `${!onlyHits && (c.members || []).length > 8 ? `<input class="ct-msearch" id="ct-mq" type="search" placeholder="Tìm trong nhóm…" value="${esc(ct.mq)}" autocomplete="off">` : ''}
               ${members.length ? members.map(m => {
                 const mm = saved.get(ctKey({ app: appId, kind: 'person', name: m.name }));
                 const on = ctIsPicked('person', m.name);
                 return `<button class="ct-member ${on ? 'sel' : ''}" data-action="ct-member" data-arg="${i}|${c.members.indexOf(m)}" aria-pressed="${on}">${on ? '<b class="ct-mcheck">✓</b>' : ''}${ctHi(m.name, q || mq)}${mm ? ` <span>${ctGroupLabel(mm).emoji}</span>` : ''}</button>`;
               }).join('') : '<span class="muted small">Chưa thấy ai trong nhóm này.</span>'}${onlyHits && c.members.length > members.length ? `<button class="link-btn ct-allm" data-action="ct-open" data-arg="${i}">+ ${c.members.length - members.length} người khác</button>` : ''}`}
        </div>` : ''}
      </li>`;
}

function ctChatsHtml() {
  const appId = ct.app;
  const src = ctSources().find(s => s.app === appId);
  const api = src && ct.api[src.id];
  if (src && src.state === 'ready' && (!api || api.state === 'loading') && !ctDir().apps.some(a => a.app === appId)) {
    return `<li class="ct-state ct-loading"><span class="ct-spin"></span><div><b>Đang lấy danh sách chat ${esc(src.api)}…</b><small>Lần đầu có thể mất 1–2 phút, những lần sau mở ra ngay.</small></div></li>`;
  }
  const rows = ctRows(appId);
  if (!rows.length) {
    const a = ctAppList().find(x => x.app === appId);
    return `<li class="ct-empty-state"><div class="ct-empty-icon">${a ? ctAppIcon(a) : '💬'}</div><b>Chưa có tin nhắn nào từ ${esc(a ? a.label : 'ứng dụng này')}</b><small>Khi có tin mới, bé sẽ nhớ tên người gửi và tên nhóm để bạn chọn ở đây. Hoặc nhập tên ngay để đặt thái độ cho họ.</small><button class="btn btn-ghost small" data-action="ct-manual" data-arg="${esc(appId || '')}">✏️ Nhập tên</button></li>`;
  }
  const list = ctFiltered(rows);
  ct.visible = list.map(x => x.i);
  if (!list.length) return `<li class="ct-state muted">Không thấy “${esc(ct.q)}” — thử tên khác, hoặc <button class="link-btn" data-action="ct-manual" data-arg="${esc(appId || '')}">✏️ nhập tên thủ công</button>.</li>`;
  const q = ctFold(ct.q);
  const saved = ctSaved();
  const html = list.slice(0, ct.limit).map((x, n) => ctRowHtml(x, q, saved, n === ct.cursor)).join('');
  // Infinite scroll: a sentinel loads the next page when it scrolls into view.
  return html + (list.length > ct.limit ? `<li class="ct-sentinel" aria-hidden="true"><span class="ct-spin sm"></span> ${list.length - ct.limit} cuộc chat nữa…</li>` : '');
}

/** Teams-style filter: Chat (1-1 + groups) · Cuộc họp · Tất cả — only when the list has meeting chats. */
function ctKindChips() {
  const rows = ctRows(ct.app);
  const meetings = rows.filter(r => r.meeting).length;
  if (!meetings) return '';
  const chats = rows.length - meetings;
  // (counts are for the whole list; the search result count is shown next to the search box)
  const chip = (id, label, n) => `<button class="ct-chip ${ct.kind === id ? 'on' : ''}" data-action="ct-kind" data-arg="${id}" aria-pressed="${ct.kind === id}" title="${n}">${label}</button>`;
  return `<span class="ct-chips" role="group" aria-label="Lọc loại chat">${chip('chat', 'Chat', chats)}${chip('meeting', 'Cuộc họp', meetings)}</span>`;
}

function ctSourceNotice(appId) {
  const src = ctSources().find(s => s.app === appId);
  const api = src && ct.api[src.id];
  const label = ctApp(appId).label;
  if (src && src.state === 'ready') {
    if (api && api.state && !['ready', 'loading'].includes(api.state)) return `<div class="ct-banner warn"><span class="ct-banner-ico">⚠️</span><div><b>Chưa lấy được danh sách chat</b><small>${esc(api.detail || '')}</small></div><button class="btn btn-ghost small" data-action="ct-api-reload">Thử lại</button></div>`;
    return '';
  }
  if (src && src.canConnect) return `<div class="ct-banner"><span class="ct-banner-ico">🔗</span><div><b>Xem đủ danh sách chat ${esc(label)}</b><small>Đăng nhập tài khoản công ty hoặc trường học — bé chỉ xem tên chat, không đọc tin nhắn.</small></div><button class="btn btn-ghost small" data-action="ct-connect" data-arg="${esc(src.toolkit)}" ${ct.connecting ? 'disabled' : ''}>${ct.connecting ? '⏳ Chờ đăng nhập…' : 'Kết nối tài khoản'}</button></div>`;
  return ctManualHint(appId);
}

/** One small line for apps whose chat list can't be fetched: type the name instead. */
function ctManualHint(appId) {
  return `<p class="ct-hint">💡 ${esc(ctApp(appId).label)} chưa cho bé xem danh sách chat — dưới đây là những chat bé đã gặp. Không thấy ai? <button class="link-btn" data-action="ct-manual" data-arg="${esc(appId || '')}">Nhập tên</button> để đặt thái độ cho họ.</p>`;
}

function ctSuggestHtml() {
  const list = (ctDir().suggestions || []).slice(0, 5);
  if (!list.length) return '';
  return `
        <div class="ct-suggest"><span class="ct-suggest-lbl">✨ Hay nhắn</span>${list.map((x, i) => `<button class="ct-sg" data-action="ct-suggest" data-arg="${i}" title="${esc(ctApp(x.app, x.appName).label)} · ${x.score} tin/tuần — bấm để xếp nhóm">${ctAvatar(x.name, x.kind === 'chat')}<span>${esc(x.name)}</span></button>`).join('')}</div>`;
}

function ctSavedHtml() {
  const list = S.settings.contacts || [];
  if (!list.length) return '';
  const q = ctFold(ct.savedQ);
  const attn = ctAttn();
  const rows = list.map((c, i) => ({ c, i })).filter(({ c }) => !q || ctFold(c.name).includes(q) || ctFold(ctGroupLabel(c).label).includes(q));
  rows.sort((a, b) => ct.sort === 'name' ? a.c.name.localeCompare(b.c.name, 'vi') : (b.c.updatedAt || 0) - (a.c.updatedAt || 0));
  const appOf = (id) => (S.msgApps || []).find(x => x.app === id) || { app: id };
  return `
        ${list.length > 6 ? `<input id="ct-saved-q" class="ct-saved-q" type="search" placeholder="Tìm người quen…" value="${esc(ct.savedQ)}" autocomplete="off" aria-label="Tìm người quen">` : ''}
        <ul class="ct-people" id="ct-saved">${rows.map(({ c, i }) => {
          const g = ctGroupLabel(c);
          const extra = [c.emotion ? `${emo(c.emotion).emoji} ${emo(c.emotion).label}` : '', c.attention && c.attention !== 'auto' && attn[c.attention] ? (CT_ATTN_UI[c.attention] || attn[c.attention].label) : ''].filter(Boolean).join(' · ');
          return `
          <li class="${c.enabled === false ? 'off' : ''} ${ct.editId === c.id ? 'editing' : ''}">
            <span class="ct-prel-emo" title="${esc(g.label)}">${g.emoji}</span>
            <div class="ct-pmain"><b title="${esc(c.name)}">${esc(c.name)}</b><small>${c.app ? `<span class="ct-papp">${ctAppIcon(appOf(c.app))}</span>` : ''}${esc(g.label)}${c.kind === 'chat' ? ' · cả nhóm' : ''}${extra ? ` · ${esc(extra)}` : ''}</small></div>
            <label class="ct-switch" title="${c.enabled === false ? 'Đang tắt' : 'Đang bật'}"><input type="checkbox" data-ct-enable="${i}" ${c.enabled === false ? '' : 'checked'} aria-label="Bật quy tắc cho ${esc(c.name)}"><span class="switch"></span></label>
            <button class="icon-btn" data-action="ct-edit" data-arg="${i}" title="Sửa" aria-label="Sửa ${esc(c.name)}">✎</button>
            <button class="icon-btn" data-action="contact-remove" data-arg="${i}" title="Xóa" aria-label="Xóa ${esc(c.name)}">✕</button>
          </li>`; }).join('') || '<li class="muted ct-state">Không thấy ai khớp.</li>'}</ul>`;
}

function ctHoursHtml() {
  const groups = ctGroups();
  const rel = S.settings.relationships || {};
  const sw = (field, on, text) => `<label class="ct-sw"><input type="checkbox" data-rel-field="${field}" ${on ? 'checked' : ''}><span class="switch"></span><span>${text}</span></label>`;
  return `
          <div class="ct-extra-sec">
            <b class="ct-extra-title">⏰ Giờ theo mối quan hệ</b>
            ${Object.entries(groups).filter(([id]) => id !== 'ignored').map(([id, g]) => {
              const r = { quietEnabled: false, quietStart: '18:00', quietEnd: '08:00', afterHours: false, digest: false, ...(rel[id] || {}) };
              return `
            <div class="ct-hour" data-rel="${id}">
              <span class="ct-hour-name">${g.emoji} ${esc(g.label)}</span>
              <div class="ct-hour-opts">
                ${sw('quietEnabled', r.quietEnabled, 'Giờ riêng')}${r.quietEnabled ? `<span class="ct-time">ngoài <input type="time" data-rel-field="quietStart" value="${esc(r.quietStart)}" aria-label="Từ"> – <input type="time" data-rel-field="quietEnd" value="${esc(r.quietEnd)}" aria-label="Đến"> thì cất vào Hộp thư</span>` : ''}
                ${sw('afterHours', r.afterHours, 'Báo cả giờ yên tĩnh')}
                ${sw('digest', r.digest, 'Luôn vào Hộp thư')}
              </div>
            </div>`;
            }).join('')}
          </div>`;
}

function ctMemoryHtml() {
  const d = ctDir();
  const memOff = S.settings.privacy && S.settings.privacy.adaptiveMemory === false;
  const ins = d.insights || [];
  return `
          <div class="ct-extra-sec">
            <b class="ct-extra-title">🧠 Bé ghi nhớ</b>
            ${H.toggle('privacy.learnContacts', 'Nhớ tên người gửi & tên nhóm', 'Chỉ lưu tên trên máy này, không lưu nội dung tin.')}
            ${H.toggle('privacy.adaptiveMemory', 'Quen dần với thói quen nhắn tin', 'Ai hay gửi tin quan trọng thì báo nhanh hơn, nhóm quá ồn thì báo nhẹ nhàng.')}
            ${ins.length ? `<ul class="ct-insights">${ins.map(x => `<li><b>${esc(x.name)}</b> — ${esc(CT_NOTE[x.note] || x.note)}${memOff ? ' <small class="muted">(đang tắt)</small>' : ''}</li>`).join('')}</ul>` : ''}
            ${d.apps.length ? '<button class="link-btn ct-forget" data-action="ct-forget">🧹 Quên danh sách đã gặp</button>' : ''}
          </div>`;
}

/** Everything that isn't needed day-to-day, folded away: hours per relationship + memory. */
function ctMoreHtml() {
  return `
        <details class="ct-extra" id="ct-hours" ${ct.hoursOpen ? 'open' : ''}>
          <summary>⚙️ Tuỳ chọn thêm <small class="muted">giờ theo mối quan hệ · bé ghi nhớ</small></summary>
          ${ctHoursHtml()}
          ${ctMemoryHtml()}
        </details>`;
}

function contactsPanel() {
  const groups = ctGroups();
  const apps = ctAppList();
  if (!ct.manual && !apps.find(a => a.app === ct.app)) { ct.app = apps[0] ? apps[0].app : null; ct.picks = []; }
  const manual = ct.manual || !apps.length;
  const src = ctSources().find(s => s.app === ct.app && s.state === 'ready');
  if (!manual && src && !ct.api[src.id]) setTimeout(() => ctLoadApi(src.id), 0);
  const saved = ctSaved();
  const dup = ct.picks.length === 1 && !ct.editId ? saved.get(ctKey(ct.picks[0])) : null;
  const editing = ct.editId ? (S.settings.contacts || []).find(c => c.id === ct.editId) : null;
  // Who step ③ applies to — one compact line next to the step title (nothing when no one is picked).
  const who = editing ? `${esc(editing.name)} · ${editing.kind === 'chat' ? 'cả nhóm' : 'một người'}`
    : manual ? (ct.manualName ? `${esc(ct.manualName)} · ${ct.manualKind === 'chat' ? 'cả nhóm' : 'một người'}` : '')
    : ct.picks.length === 1 ? `${esc(ct.picks[0].name)} · ${ct.picks[0].kind === 'chat' ? 'cả nhóm' : 'một người'}`
    : ct.picks.length > 1 ? `${ct.picks.length} người` : '';
  const canAdd = editing || (manual ? true : ct.picks.length > 0);
  return `
      <section class="panel contacts-panel" aria-labelledby="ct-title">
        <header class="ct-head"><h3 id="ct-title">👥 Người quen</h3><small class="muted">Chỉ cho bé ai là ai để bé phản ứng đúng</small></header>
        ${editing ? `<div class="ct-editing">✎ Đang sửa <b>${esc(editing.name)}</b><button class="link-btn" data-action="ct-cancel">Huỷ</button></div>` : `
        ${ctSuggestHtml()}
        <div class="ct-step"><span class="ct-num">1</span><b>Ứng dụng</b></div>
        <div class="ct-apps" role="tablist" aria-label="Ứng dụng">
          ${apps.map(a => { const on = !manual && a.app === ct.app; return `<button role="tab" aria-selected="${on}" class="ct-app ${on ? 'on' : ''}" data-action="ct-app" data-arg="${esc(a.app)}" title="${a.running ? 'Đang chạy' : a.installed ? 'Đã cài' : 'Từ thông báo'}"><span class="ct-app-ico">${ctAppIcon(a)}</span>${esc(ctApp(a.app, a.label).label)}${a.running ? '<i class="dot on"></i>' : ''}</button>`; }).join('')}
          <button role="tab" aria-selected="${manual}" class="ct-app ${manual ? 'on' : ''}" data-action="ct-manual"><span class="ct-app-ico"><span>✏️</span></span>Nhập tên</button>
        </div>
        <div class="ct-step"><span class="ct-num">2</span><b>${manual ? 'Nhập tên' : 'Chọn cuộc chat'}</b>${manual ? '' : `${ctKindChips()}<span class="ct-count" id="ct-count" aria-live="polite"></span><input id="ct-q" class="ct-search" type="search" autocomplete="off" placeholder="Tìm…" title="↑ ↓ · Enter để chọn · Esc để xoá" value="${esc(ct.q)}" aria-label="Tìm người hoặc nhóm" aria-controls="ct-chats">${src ? '<button class="icon-btn ct-reload" data-action="ct-api-reload" title="Làm mới danh sách">↻</button>' : ''}`}</div>
        ${manual ? `
        <div class="ct-manual">
          <input id="ct-name" type="text" maxlength="80" autocomplete="off" placeholder="Tên hiện trong thông báo, vd: Mai Phạm" value="${esc(ct.manualName || '')}" aria-label="Tên">
          <select id="ct-kind" aria-label="Là"><option value="person" ${ct.manualKind === 'chat' ? '' : 'selected'}>👤 Một người</option><option value="chat" ${ct.manualKind === 'chat' ? 'selected' : ''}>👥 Cả nhóm</option></select>
          <select id="ct-mapp" aria-label="Trong ứng dụng"><option value="">Mọi ứng dụng</option>${apps.map(a => `<option value="${esc(a.app)}" ${ct.manualApp === a.app ? 'selected' : ''}>${esc(ctApp(a.app, a.label).label)}</option>`).join('')}</select>
        </div>` : `
        ${ctSourceNotice(ct.app)}
        <ul class="ct-chats" id="ct-chats" role="listbox" aria-label="Cuộc trò chuyện">${ctChatsHtml()}</ul>`}`}
        <div class="ct-step"><span class="ct-num">3</span><b>Bé đối xử thế nào?</b>${who ? `<span class="ct-who">${who}</span>` : ''}</div>
        <div class="ct-rels" role="radiogroup" aria-label="Quan hệ">${Object.entries(groups).map(([id, g]) => `<button role="radio" aria-checked="${id === ct.group}" class="ct-rel ${id === ct.group ? 'on' : ''}" data-action="ct-rel" data-arg="${id}"><i>${g.emoji}</i>${esc(g.label.replace(' (vào Hộp thư)', ''))}</button>`).join('')}</div>
        ${ct.group === 'other' ? `<input id="ct-label" class="ct-other" type="text" maxlength="40" placeholder="Tên quan hệ, vd: Hàng xóm" value="${esc(ct.label)}">` : ''}
        <div class="contact-add">
          <select id="ct-emo" aria-label="Cảm xúc của bé"><option value="">✨ Cảm xúc theo quan hệ</option>${emotionOptions(ct.emotion).replace(/ \([a-z]+\)</g, '<')}</select>
          <select id="ct-attn" aria-label="Cách báo">${Object.entries(ctAttn()).map(([id, x]) => `<option value="${id}" ${id === ct.attention ? 'selected' : ''}>${esc(CT_ATTN_UI[id] || x.label)}</option>`).join('')}</select>
          <button class="btn btn-primary ct-add" data-action="contact-add" ${canAdd ? '' : 'disabled'}>${editing ? 'Lưu' : dup ? 'Cập nhật' : '＋ Thêm'}</button>
        </div>
        <p class="ct-valid" id="ct-valid" role="status">${dup ? `${esc(dup.name)} đang là ${esc(ctGroupLabel(dup).label)}.` : ''}</p>
        ${(S.settings.contacts || []).length ? `<div class="ct-sub"><b>Người quen</b> <span class="ct-count-pill">${S.settings.contacts.length}</span></div>` : ''}
        ${ctSavedHtml()}
        ${ctMoreHtml()}
      </section>`;
}

function paintContacts() {
  const el = main.querySelector('.contacts-panel');
  if (!el) return;
  const active = document.activeElement && document.activeElement.id;
  const pos = active && document.activeElement.selectionStart;
  const ul = document.getElementById('ct-chats');
  const scroll = ul ? ul.scrollTop : 0;
  ct.hoursOpen = !!(document.getElementById('ct-hours') || {}).open;
  el.outerHTML = contactsPanel();
  const panel = main.querySelector('.contacts-panel');
  if (panel) syncInputs(panel); // H.toggle switches get their state from settings
  const ul2 = document.getElementById('ct-chats');
  if (ul2) ul2.scrollTop = scroll; // picking a chat must not jump the list back to the top
  ctAfterPaint();
  if (active && /^ct-/.test(active)) { const n = document.getElementById(active); if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch { /* select */ } } }
}

function paintChats({ keepScroll = true } = {}) {
  const ul = document.getElementById('ct-chats');
  if (!ul) return;
  const scroll = ul.scrollTop;
  ul.innerHTML = ctChatsHtml();
  ul.scrollTop = keepScroll ? scroll : 0;
  ctAfterPaint();
}

let ctObserver = null;
function ctAfterPaint() {
  // Result count next to the search box.
  const cnt = document.getElementById('ct-count');
  if (cnt) cnt.textContent = ct.q ? `${(ct.visible || []).length} kết quả` : '';
  // Infinite scroll.
  if (ctObserver) ctObserver.disconnect();
  const ul = document.getElementById('ct-chats');
  const sentinel = ul && ul.querySelector('.ct-sentinel');
  if (!sentinel) return;
  ctObserver = new IntersectionObserver((entries) => {
    if (!entries.some(e => e.isIntersecting)) return;
    ctObserver.disconnect();
    ct.limit += 60;
    requestAnimationFrame(() => paintChats());
  }, { root: ul, rootMargin: '200px' });
  ctObserver.observe(sentinel);
}

async function ctLoadApi(id, refresh = false) {
  ct.api[id] = { ...(ct.api[id] || {}), state: 'loading' };
  paintContacts(); // also clears a previous error banner
  try { ct.api[id] = await api(`/api/contacts/sources/${id}/chats${refresh ? '?refresh=1' : ''}`); }
  catch (err) { ct.api[id] = { state: 'error', detail: err.message, chats: [] }; }
  paintContacts();
  // Served from the on-disk cache while a background refresh runs: pick up the fresh list later.
  if (ct.api[id] && ct.api[id].refreshing) setTimeout(async () => { try { const r = await api(`/api/contacts/sources/${id}/chats`); if (r.state === 'ready') { ct.api[id] = r; paintChats(); } } catch { /* keep */ } }, 90000);
}

async function ctLoadMembers(row) {
  const k = `${row.source}:${row.chatId}`;
  if (ct.apiMembers[k] && ct.apiMembers[k].state !== 'error') return;
  ct.apiMembers[k] = { state: 'loading' };
  paintChats();
  try { ct.apiMembers[k] = await api(`/api/contacts/sources/${row.source}/members?chat=${encodeURIComponent(row.chatId)}`); }
  catch (err) { ct.apiMembers[k] = { state: 'error', detail: err.message, members: [] }; }
  paintChats();
}

let ctSearchTimer = null;
document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'ct-q') {
    ct.q = e.target.value; ct.limit = 60; ct.cursor = -1;
    clearTimeout(ctSearchTimer);
    ctSearchTimer = setTimeout(() => requestAnimationFrame(() => paintChats({ keepScroll: false })), 90);
  }
  if (id === 'ct-mq') { ct.mq = e.target.value; clearTimeout(ctSearchTimer); ctSearchTimer = setTimeout(() => { paintChats(); const n = document.getElementById('ct-mq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 120); }
  if (id === 'ct-saved-q') { ct.savedQ = e.target.value; clearTimeout(ctSearchTimer); ctSearchTimer = setTimeout(paintContacts, 150); }
  if (id === 'ct-name') ct.manualName = e.target.value;
  if (id === 'ct-label') ct.label = e.target.value;
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'ct-group') { ct.group = t.value; paintContacts(); }
  if (t.id === 'ct-emo') ct.emotion = t.value;
  if (t.id === 'ct-attn') ct.attention = t.value;
  if (t.id === 'ct-kind') ct.manualKind = t.value;
  if (t.id === 'ct-mapp') ct.manualApp = t.value;
  if (t.id === 'ct-sort') { ct.sort = t.value; paintContacts(); }
  if (t.dataset && t.dataset.ctEnable !== undefined) {
    const list = [...(S.settings.contacts || [])];
    const c = list[Number(t.dataset.ctEnable)];
    if (!c) return;
    list[Number(t.dataset.ctEnable)] = { ...c, enabled: t.checked, updatedAt: Date.now() };
    queueSave({ contacts: list }, true);
    toast(t.checked ? `Đã bật quy tắc cho ${c.name}` : `Đã tắt quy tắc cho ${c.name}`, 'ok');
    setTimeout(paintContacts, 300);
  }
  if (t.dataset && t.dataset.relField) {
    const rel = t.closest('[data-rel]').dataset.rel;
    const v = t.type === 'checkbox' ? t.checked : t.value;
    if (t.type === 'time' && !/^\d{2}:\d{2}$/.test(v)) return;
    queueSave({ relationships: { [rel]: { [t.dataset.relField]: v } } }, true);
    if (t.dataset.relField === 'quietEnabled') setTimeout(paintContacts, 50); // show / hide the hours
  }
  if (t.dataset && (t.dataset.setting === 'privacy.learnContacts' || t.dataset.setting === 'privacy.adaptiveMemory')) setTimeout(refreshContactDirectory, 400);
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'ct-q') {
    const n = (ct.visible || []).length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      ct.cursor = Math.max(0, Math.min(Math.min(n, ct.limit) - 1, (ct.cursor ?? -1) + (e.key === 'ArrowDown' ? 1 : -1)));
      paintChats();
      const li = document.querySelector('#ct-chats li.kb');
      if (li) li.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter' && n) { e.preventDefault(); actions['ct-pick'](String(ct.visible[Math.max(0, ct.cursor ?? 0)])); return; }
    if (e.key === 'Escape' && ct.q) { e.preventDefault(); e.target.value = ''; ct.q = ''; ct.cursor = -1; paintChats({ keepScroll: false }); return; }
  }
  if (e.key === 'Enter' && (e.target.id === 'ct-name' || e.target.id === 'ct-label')) { e.preventDefault(); actions['contact-add'](); }
  if (e.key === 'Escape' && ct.editId && main.querySelector('.contacts-panel')) actions['ct-cancel']();
});

async function refreshContactDirectory() {
  try {
    const [dir, src, apps] = await Promise.all([api('/api/contacts/seen'), api('/api/contacts/sources'), api('/api/contacts/apps').catch(() => ({ apps: S.msgApps || [] }))]);
    S.contactDirectory = dir;
    S.chatSources = src.sources;
    S.msgApps = apps.apps;
    paintContacts();
  } catch { /* ignore */ }
}

/** One pick that already has a rule → preload its settings so it's easy to change. */
function ctPreload() {
  if (ct.picks.length !== 1) return;
  const prev = ctSaved().get(ctKey(ct.picks[0]));
  if (prev) Object.assign(ct, { group: prev.group, label: prev.label || '', emotion: prev.emotion || '', attention: prev.attention || 'auto' });
}

function moodPanel() {
  return `
      <section class="panel mood-panel">
        <h3>🎭 Bé đọc cảm xúc tin nhắn</h3>
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

/** Pet card thumbnails. Cached per model (a second WebGL scene + GLB parsing on every Control
 *  Center start made the first seconds stutter), built in idle time, one pet per idle slot. */
const THUMB_CACHE = 'cpc-thumbs-v1';
const thumbKey = (c) => `${c.id}|${c.customModel ? 'custom' : c.bundledModel ? 'bundled' : 'proc'}|${S.version || ''}`;
const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 60)));

function paintThumb(id) {
  const el = main.querySelector(`[data-thumb="${id}"]`);
  if (el && thumbs[id]) el.innerHTML = `<img src="${thumbs[id]}" alt="">`;
}

async function makeThumbnails() {
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(THUMB_CACHE) || '{}') || {}; } catch { cache = {}; }
  const todo = [];
  for (const c of S.characters) {
    const hit = cache[thumbKey(c)];
    if (hit) { thumbs[c.id] = hit; paintThumb(c.id); } else todo.push(c);
  }
  if (!todo.length) return;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:260px;height:280px';
  document.body.appendChild(host);
  const tmp = new PetStage(host, { species: todo[0].id, ambient: false, interactive: false, assetBase: '/assets/' });
  try {
    for (const c of todo) {
      await idle(); // never compete with what the user is doing right now
      await tmp.setSpecies(c.id); // the GLB (when there is one) must be in the scene before the snapshot
      tmp.setEmotion('happy');
      for (let i = 0; i < 40; i++) tmp.update(0.03);
      thumbs[c.id] = tmp.snapshot();
      cache[thumbKey(c)] = thumbs[c.id];
      paintThumb(c.id);
    }
    // Keep only current models' entries.
    const keep = new Set(S.characters.map(thumbKey));
    for (const k of Object.keys(cache)) if (!keep.has(k)) delete cache[k];
    try { localStorage.setItem(THUMB_CACHE, JSON.stringify(cache)); } catch { /* quota: just not cached */ }
  } finally {
    tmp.dispose();
    host.remove();
  }
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
  low_priority: 'Ít quan trọng', cooldown: 'Nhiều tin liên tiếp', app_muted: 'Ứng dụng đã tắt tiếng', contact_ignored: 'Người quen đang để Bỏ qua', contact_inbox: 'Người quen: chỉ lưu vào Hộp thư', relationship_hours: 'Ngoài giờ của mối quan hệ', relationship_digest: 'Gom theo mối quan hệ', presence_hidden: 'Lúc thú cưng đang ẩn',
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

const MODE_NAMES = { none: 'Bình thường', work: 'Làm việc', focus: 'Tập trung sâu', meeting: 'Đang họp', gaming: 'Chơi game', relax: 'Thư giãn', sleep: 'Đi ngủ' };
const WORK_APPS = new Set(['jira', 'bitbucket', 'github', 'gitlab']);

/** Four things worth a glance on the home screen — each opens where you act on it. */
function statusCardsHtml(ib, apps) {
  const items = ib.items || [];
  const work = items.filter(i => !i.read && WORK_APPS.has(i.app)).length;
  const connected = apps.filter(a => a.cls === 'ok').length;
  const mode = S.effective ? S.effective.mode.id : 'none';
  const m = (S.focusModes && S.focusModes[mode]) || {};
  const card = (href, icon, value, label, txt) => `<a class="status-card" href="${href}"><span>${icon}</span><div><b class="${txt ? 'txt' : ''}" ${href === '#inbox' && !txt ? 'id="dash-inbox"' : ''}>${value}</b><small>${label}</small></div></a>`;
  return `<div class="status-row">
        ${card('#inbox', '📥', ib.unread, 'tin đang chờ')}
        ${card('#inbox/work', '🧩', work, 'việc Jira / PR cần xem')}
        ${card('#connect', '🔌', `${connected}/${apps.length}`, 'ứng dụng đang hoạt động')}
        ${card('#notify/focus', m.emoji || '☀️', esc(MODE_NAMES[mode] || mode), mode === 'none' ? 'sẵn sàng nhận tin' : 'tin ít gấp vào Hộp thư', true)}
      </div>`;
}

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
      ${H.head(`Chào bạn! ${esc((pet.name || 'Mochi').split(' ').pop())} đang ở đây 🐾`, 'Bạn tập trung làm việc nhé, để bé trông thông báo giúp.')}
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
      ${statusCardsHtml(ib, apps)}
      <section class="panel">
        <div class="panel-head"><h3>🕘 Thông báo gần đây</h3><a class="link" href="#inbox">Mở Hộp thư</a></div>
        <div class="history" id="history">${historyRows(S.pipeline.history, { simple: true })}</div>
      </section>`;
  },

  pet() {
    return `
      ${H.head('Thú cưng', 'Chọn người bạn đồng hành và tính cách của bé.')}
      <div class="grid-pets">
        ${S.characters.map(c => `
          <article class="pet-card ${S.settings.activePet === c.id ? 'active' : ''}" data-action="pick-pet" data-arg="${c.id}">
            <div class="pet-thumb" data-thumb="${c.id}">${thumbs[c.id] ? `<img src="${thumbs[c.id]}" alt="">` : '<div class="thumb-loading">…</div>'}</div>
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
      ${S.settings.mood.followAttitude !== false
        ? `<section class="panel mood-off"><span>🎭</span><div><b>Bé đọc cảm xúc tin nhắn</b><small>Đang tắt — bé phản ứng theo thái độ đã chọn ở trên.</small></div><button class="btn btn-ghost small" data-action="mood-enable">Bật</button></section>`
        : moodPanel()}
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
        <div class="inbox-filters" id="inbox-filters">${inboxFiltersHtml(ib.items)}</div>
        <div class="history inbox-list" id="inbox-list">${inboxRows(inboxFiltered(ib.items))}</div>
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
          ${!(S.settings.chat.names || []).length ? `<p class="notice warn">⚠️ Chưa có tên của bạn — bé chỉ nhận ra khi chính ứng dụng ghi “nhắc đến bạn” (Teams, Slack). Với Zalo, Messenger… hãy nhập tên mọi người hay @ bạn.</p>` : ''}
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
  allowed: 'Đã hiển thị', low_priority: 'Ít quan trọng → Inbox', cooldown: 'Quá nhiều tin cùng app (cooldown)', app_muted: 'App đã tắt tiếng', contact_ignored: 'Người quen: Bỏ qua', contact_inbox: 'Người quen: chỉ lưu Hộp thư', relationship_hours: 'Ngoài giờ của mối quan hệ', relationship_digest: 'Gom theo mối quan hệ',
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
      <div class="h-main">${h.meta ? `<div class="h-tk">${h.meta.key ? `<button class="h-key" data-action="copy-key" data-arg="${esc(h.meta.key)}" title="Bấm để chép mã">${esc(h.meta.key)}</button>` : ''}${h.meta.status ? `<span class="h-status tone-${esc(h.meta.statusTone || 'todo')}">${esc(h.meta.status)}</span>` : ''}${h.meta.event ? `<span class="h-event">${esc(h.meta.event)}</span>` : ''}</div>` : ''}<b>${esc(h.meta && h.meta.key && String(h.title).startsWith(h.meta.key + ' ') ? String(h.title).slice(h.meta.key.length + 1) : h.title)}</b><small>${esc(h.message || '')}</small></div>
      <div class="h-meta"><span class="pill small">${esc(h.app)}</span><small>${simple ? '' : `${esc(h.matchedBy)} · `}<time title="${esc(new Date(h.receivedAt).toLocaleString())}">${arrivedAt(h.receivedAt)}</time></small></div>
    </div>`).join('');
}

const INBOX_FILTERS = [
  ['all', 'Tất cả', () => true],
  ['chat', '💬 Tin nhắn', (i) => !WORK_APPS.has(i.app) && (i.category === 'chat' || i.category === 'social' || !!i.who)],
  ['work', '🧩 Công việc', (i) => WORK_APPS.has(i.app)],
  ['important', '⭐ Quan trọng', (i) => i.priority === 'important' || i.priority === 'critical'],
  ['unread', 'Chưa đọc', (i) => !i.read]
];
let inboxFilter = 'all';
function inboxFiltered(items) { const f = INBOX_FILTERS.find(x => x[0] === inboxFilter) || INBOX_FILTERS[0]; return (items || []).filter(f[2]); }
function inboxFiltersHtml(items) {
  return INBOX_FILTERS.map(([id, label, fn]) => `<button class="${inboxFilter === id ? 'on' : ''}" data-action="inbox-filter" data-arg="${id}" aria-pressed="${inboxFilter === id}">${label}<small>${(items || []).filter(fn).length}</small></button>`).join('');
}

function inboxRows(list) {
  if (!list || !list.length) return '<div class="empty">Hộp thư trống 🐾</div>';
  return list.slice(0, 100).map(h => `
    <div class="h-row ${h.read ? 'read' : ''}">
      <span class="h-emo emo-bg-${h.emotion}">${emo(h.emotion).emoji}</span>
      <div class="h-main"><b>${esc(h.title)}</b><small>${esc(h.message || '')}</small></div>
      <div class="h-meta">
        <small>${esc(h.app)} · ${arrivedAt(h.receivedAt)}${friendlyReason(h.reason) ? ` · ${esc(friendlyReason(h.reason))}` : ''}</small>
        <span class="row-actions">${h.who ? `<button class="btn btn-ghost small" data-action="inbox-classify" data-arg="${esc(h.id)}" title="Xếp người gửi / nhóm này vào Người quen">👥 Xếp nhóm</button>` : ''}${safeUrl(h.url) ? `<a class="link" href="${esc(safeUrl(h.url))}" target="_blank" rel="noopener">Mở ↗</a>` : ''}<button class="icon-btn" data-action="inbox-del" data-arg="${esc(h.id)}" title="Xóa">✕</button></span>
      </div>
    </div>`).join('');
}

function applyInbox(ib) {
  S.pipeline.inbox = ib;
  const el = document.getElementById('inbox-list');
  if (el) el.innerHTML = inboxRows(inboxFiltered(ib.items));
  const f = document.getElementById('inbox-filters');
  if (f) f.innerHTML = inboxFiltersHtml(ib.items);
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
  // Active pet in the sidebar foot.
  const pp = document.getElementById('pet-pill');
  if (pp && S.characters) {
    const pet = S.characters.find(c => c.id === S.settings.activePet) || {};
    pp.innerHTML = `${thumbs[pet.id] ? `<img src="${thumbs[pet.id]}" alt="">` : '🐾'}<span>Bé <b>${esc(pet.name || '')}</b></span>`;
    pp.onclick = () => { location.hash = '#pet'; };
  }
  // Reduced motion follows the app setting (system / on / off) in the Control Center too.
  const rm = S.settings.sounds && S.settings.sounds.reducedMotion;
  document.documentElement.classList.toggle('reduce-motion', rm === 'on');
  document.documentElement.classList.toggle('allow-motion', rm === 'off');
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
  const webhookExtra = a.id === 'webhook' ? `${S.preferredPort && S.port !== S.preferredPort ? `
    <p class="muted">Cổng ${S.preferredPort} bị Windows hoặc ứng dụng khác chặn, nên app đang dùng cổng ${S.port}. Hãy gửi webhook tới địa chỉ bên dưới.</p>` : ''}
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

let renderedView = '';
function render() {
  [route, sub] = parseHash();
  // Re-rendering the SAME page after a setting change must feel like an in-place update: no
  // entrance animation, no jump back to the top. Only navigating to another page animates.
  const view = `${route}/${sub || ''}`;
  const sameView = view === renderedView;
  renderedView = view;
  const keepScroll = sameView ? main.scrollTop : 0;
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  stageHome.appendChild(previewEl);
  main.innerHTML = `<div class="page page-${route}${sameView ? ' no-enter' : ''}">${pages[route]()}</div>`;
  main.scrollTop = keepScroll;
  syncInputs();
  if (document.getElementById('preview-host')) {
    mountPreview('preview-host');
    setPreviewEmotion(previewEmotion ?? 'idle');
  }
  updateBadges();
  if (route === 'monitor' && sub === 'rules') bindRules();
  if (route === 'monitor' && sub === 'tools') bindUploads();
  if (route === 'connect') bindConnect();
  if (route === 'pet') { bindMoodTry(); refreshContactDirectory(); }
  if (route === 'inbox') { if (sub && INBOX_FILTERS.some(x => x[0] === sub)) inboxFilter = sub; refreshInbox(); }
}

window.addEventListener('hashchange', render);

/* ================================================================== section behaviours */

function bindUploads() {
  main.querySelectorAll('[data-upload]').forEach(inp => inp.addEventListener('change', async () => {
    const file = inp.files[0];
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) { toast('File quá lớn (tối đa 60MB)', 'error'); inp.value = ''; return; }
    try {
      await api(`/api/pets/${inp.dataset.upload}/model`, { method: 'POST', raw: await file.arrayBuffer() });
      toast('Đã nhập mô hình .glb 🎉', 'ok');
      await refreshState();
      if (inp.dataset.upload === S.settings.activePet && stage) stage.reloadModel();
      render();
    } catch (err) { toast(err.message, 'error'); }
    finally { inp.value = ''; } // picking the same file again must fire 'change' again
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
    queueSave({ appRules: { ...S.settings.appRules, [name]: 'excited' } }, true).then(() => render());
  },
  'reset-keywords'() { queueSave({ keywordRules: S.defaults.keywordRules }, true).then(() => render()); },
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
    queueSave({ chat: { names: [full, `@${given}`] } }, true).then(() => render());
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
    queueSave({ privacy: { hiddenApps: [...cur] } }, true).then(() => render());
  },
  appear(id) {
    if (!APPEAR_PATCH[id]) return;
    queueSave(APPEAR_PATCH[id], true).then(() => render());
  },
  'size-preset'(id) {
    const p = SIZE_PRESETS.find(x => x[0] === id);
    if (!p) return;
    const v = p[3];
    queueSave({ appearance: { petScale: v.petScale }, notifications: { size: v.size, cardScale: v.cardScale } }, true).then(() => render());
  },
  'ct-app'(app) {
    Object.assign(ct, { app, manual: false, picks: [], q: '', mq: '', open: null, kind: 'chat', limit: 60, cursor: -1 });
    paintContacts();
    const ul = document.getElementById('ct-chats'); if (ul) ul.scrollTop = 0; // a different app's list starts at the top
  },
  'ct-manual'(appId) { ct.manual = true; ct.picks = []; ct.manualApp = appId || ''; paintContacts(); const n = document.getElementById('ct-name'); if (n) n.focus(); },
  async 'ct-apps-refresh'() {
    try { S.msgApps = (await api('/api/contacts/apps?refresh=1')).apps; paintContacts(); toast('Đã dò lại các app nhắn tin trên máy', 'ok'); }
    catch (err) { toast(err.message, 'error'); }
  },
  async 'ct-connect'(toolkit) {
    if (ct.connecting) return;
    try {
      const r = await api('/api/integrations/connect', { method: 'POST', body: { toolkit, name: 'Microsoft Teams' } });
      if (!r.opened) { toast('Không mở được trang đăng nhập — thử lại ở tab 🔌 Kết nối', 'error'); return; }
      toast('Đã mở trang đăng nhập Microsoft trong trình duyệt — đăng nhập xong bé sẽ tự lấy danh sách chat', 'ok');
    } catch (err) { toast(err.message, 'error'); return; }
    ct.connecting = true;
    paintContacts();
    // Wait for the OAuth to finish (up to ~3 min), then load the chat list.
    for (let i = 0; i < 45 && ct.connecting; i++) {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const st = await api('/api/integrations/refresh', { method: 'POST', body: {} });
        const app = (st.apps || []).find(a => a.toolkit === toolkit);
        if (app && app.status === 'active') {
          ct.connecting = false;
          delete ct.api.teams;
          await refreshContactDirectory();
          toast('✅ Đã kết nối Microsoft Teams', 'ok');
          return;
        }
      } catch { /* keep waiting */ }
    }
    ct.connecting = false;
    paintContacts();
  },
  'inbox-filter'(id) { inboxFilter = INBOX_FILTERS.some(x => x[0] === id) ? id : 'all'; applyInbox(S.pipeline.inbox); },
  async 'copy-key'(key) { try { await navigator.clipboard.writeText(key); toast(`Đã chép ${key}`, 'ok'); } catch { toast('Không chép được', 'error'); } },
  'mood-enable'() { queueSave({ mood: { followAttitude: false } }, true); },
  'ct-rel'(g) { if (!ctGroups()[g]) return; ct.group = g; paintContacts(); if (g === 'other') { const n = document.getElementById('ct-label'); if (n) n.focus(); } },
  'ct-kind'(k) { ct.kind = ['chat', 'meeting', 'all'].includes(k) ? k : 'chat'; ct.limit = 60; ct.cursor = -1; paintContacts(); const ul = document.getElementById('ct-chats'); if (ul) ul.scrollTop = 0; },
  'ct-more-rows'() { ct.limit += 50; paintChats(); },
  'ct-api-reload'() { const src = ctSources().find(s => s.app === ct.app); if (src) ctLoadApi(src.id, true); },
  'ct-open'(i) {
    const row = ctRows(ct.app)[Number(i)];
    if (!row) return;
    const viaSearch = ct.q && row._m.some(m => m.includes(ctFold(ct.q)));
    ct.open = ct.open === row.key ? (viaSearch ? '' : null) : row.key;
    ct.mq = '';
    if (ct.open && row.source && !Array.isArray(row.members)) ctLoadMembers(row);
    paintChats();
  },
  'ct-pick'(i) {
    const row = ctRows(ct.app)[Number(i)];
    if (!row) return;
    const kind = row.direct ? 'person' : 'chat';
    const already = ct.picks.length === 1 && ctIsPicked(kind, row.title);
    ct.picks = already ? [] : [{ kind, name: row.title, app: ct.app, targetId: row.chatId || null }];
    ctPreload();
    paintContacts();
  },
  'ct-member'(arg) {
    const [i, mi] = String(arg).split('|').map(Number);
    const row = ctRows(ct.app)[i];
    const m = row && Array.isArray(row.members) && row.members[mi];
    if (!m) return;
    ct.open = row.key;
    // Several people from one group can be classified at once; a member pick replaces a whole-group pick.
    ct.picks = ct.picks.filter(p => p.kind === 'person' && p.viaChat === row.title);
    if (ctIsPicked('person', m.name)) ct.picks = ct.picks.filter(p => ctFold(p.name) !== ctFold(m.name));
    else ct.picks.push({ kind: 'person', name: m.name, app: ct.app, targetId: row.source && m.id !== m.name ? m.id : null, viaChat: row.title });
    ctPreload();
    paintContacts();
  },
  'ct-suggest'(i) {
    const s = (ctDir().suggestions || [])[Number(i)];
    if (!s) return;
    ct.manual = false; ct.app = s.app; ct.q = ''; ct.open = null; ct.editId = null;
    ct.picks = [{ kind: s.kind, name: s.name, app: s.app, targetId: null }];
    ctPreload();
    paintContacts();
    const g = document.querySelector('.ct-rels');
    if (g) { g.scrollIntoView({ block: 'center', behavior: 'smooth' }); const on = g.querySelector('.ct-rel.on'); if (on) on.focus(); }
  },
  'ct-edit'(i) {
    const c = (S.settings.contacts || [])[Number(i)];
    if (!c) return;
    Object.assign(ct, { editId: c.id, group: c.group, label: c.label || '', emotion: c.emotion || '', attention: c.attention || 'auto', picks: [] });
    paintContacts();
    const g = document.querySelector('.ct-rels');
    if (g) { g.scrollIntoView({ block: 'center', behavior: 'smooth' }); const on = g.querySelector('.ct-rel.on'); if (on) on.focus(); }
  },
  'ct-cancel'() { ct.editId = null; ct.picks = []; paintContacts(); },
  'contact-add'() {
    const manual = !ct.editId && (ct.manual || !ctAppList().length);
    const group = ct.group;
    const label = group === 'other' ? String(ct.label || '').trim() : '';
    const valid = document.getElementById('ct-valid');
    const fail = (msg) => { if (valid) { valid.textContent = `⚠️ ${msg}`; valid.className = 'ct-valid err'; } toast(msg, 'error'); };
    if (group === 'other' && !label) return fail('Đặt tên cho quan hệ "Khác" trước nhé (vd: Hàng xóm)');
    const now = Date.now();
    const base = { group, label: label || null, emotion: ct.emotion || null, attention: ct.attention || 'auto', enabled: true, updatedAt: now };
    let list = [...(S.settings.contacts || [])];
    let names = [];
    if (ct.editId) {
      const i = list.findIndex(c => c.id === ct.editId);
      if (i < 0) return fail('Không tìm thấy quy tắc này nữa');
      list[i] = { ...list[i], ...base };
      names = [list[i].name];
    } else {
      const picks = manual
        ? [{ name: String(ct.manualName || '').trim(), kind: ct.manualKind === 'chat' ? 'chat' : 'person', app: ct.manualApp || null, targetId: null }]
        : ct.picks;
      if (!picks.length || !picks[0].name) return fail(manual ? 'Nhập tên người gửi trước nhé' : 'Chọn một người hoặc nhóm ở bước 2 trước nhé');
      for (const p of picks) {
        const entry = { name: p.name, kind: p.kind, app: p.app || null, targetId: p.targetId || null, ...base };
        const i = list.findIndex(c => ctKey(c) === ctKey(entry));
        if (i >= 0) list[i] = { ...list[i], ...entry };
        else list = [...list, { ...entry, createdAt: now }];
        names.push(p.name);
      }
    }
    const saved = queueSave({ contacts: list }, true);
    const g = ctGroupLabel({ group, label });
    toast(`${ct.editId ? 'Đã lưu' : 'Đã thêm'} ${names.length > 1 ? `${names.length} người` : names[0]} → ${g.emoji} ${g.label}`, 'ok');
    Object.assign(ct, { editId: null, picks: [], manualName: '', emotion: '', attention: 'auto' });
    saved.then(() => refreshContactDirectory());
  },
  'contact-remove'(i) {
    const list = [...(S.settings.contacts || [])];
    const [gone] = list.splice(Number(i), 1);
    if (!gone) return;
    if (ct.editId === gone.id) ct.editId = null;
    queueSave({ contacts: list }, true).then(() => paintContacts());
    toast(`Đã xoá ${gone.name} khỏi người quen`, 'ok');
  },
  'inbox-classify'(id) {
    const it = ((S.pipeline.inbox && S.pipeline.inbox.items) || []).find(x => x.id === id);
    if (!it || !it.who) return;
    const saved = ctSaved();
    const l = ctApp(it.app, it.appName);
    const groups = ctGroups();
    const first = saved.get(ctKey({ ...it.who[0], app: it.app }));
    openModal(`<header class="modal-head"><div class="ct-mh"><h3>👥 Xếp nhóm nhanh</h3><small>${l.icon} ${esc(l.label)} · bé chỉ lưu tên, không lưu nội dung tin</small></div><button class="icon-btn" data-action="modal-close">✕</button></header>
      <div class="ct-quick">
        ${it.who.map((w, i) => { const cur = saved.get(ctKey({ ...w, app: it.app })); return `<label class="ct-chk"><input type="radio" name="ct-quick-who" value="${i}" ${i === 0 ? 'checked' : ''}> ${w.kind === 'chat' ? `👥 Cả nhóm <b>${esc(w.name)}</b>` : `👤 <b>${esc(w.name)}</b>`}${cur ? ` <small class="muted">(đang là ${esc(ctGroupLabel(cur).label)})</small>` : ''}</label>`; }).join('')}
        <label class="ct-field"><span>Quan hệ</span><select id="ct-quick-group">${Object.entries(groups).filter(([g]) => g !== 'other').map(([g, x]) => `<option value="${g}" ${first && first.group === g ? 'selected' : ''}>${x.emoji} ${esc(x.label)}</option>`).join('')}</select></label>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">Huỷ</button><button class="btn btn-primary" data-action="inbox-classify-yes" data-arg="${esc(id)}">Lưu</button></div>`);
  },
  'inbox-classify-yes'(id) {
    const it = ((S.pipeline.inbox && S.pipeline.inbox.items) || []).find(x => x.id === id);
    const r = document.querySelector('input[name="ct-quick-who"]:checked');
    const w = it && it.who && it.who[Number(r ? r.value : 0)];
    if (!w) return;
    const group = document.getElementById('ct-quick-group').value;
    const now = Date.now();
    const entry = { name: w.name, kind: w.kind, app: it.app, group, updatedAt: now, enabled: true };
    const list = [...(S.settings.contacts || [])];
    const i = list.findIndex(c => ctKey(c) === ctKey(entry));
    if (i >= 0) list[i] = { ...list[i], ...entry }; else list.push({ ...entry, emotion: null, attention: 'auto', createdAt: now });
    queueSave({ contacts: list }, true);
    closeModal();
    const g = ctGroupLabel(entry);
    toast(`${w.name} → ${g.emoji} ${g.label}`, 'ok');
  },
  'ct-forget'() {
    const n = ctDir().apps.reduce((s, a) => s + a.chats.length, 0);
    openModal(`<header class="modal-head"><div class="ct-mh"><h3>🧹 Quên danh sách đã gặp?</h3><small>Bé sẽ xoá ${n} cuộc chat và tên người gửi đã ghi nhớ trên máy này, cùng các gợi ý "Hay nhắn nhất" và những gì bé nhận thấy.</small></div><button class="icon-btn" data-action="modal-close">✕</button></header>
      <ul class="ct-forget-list"><li>✅ Danh sách người quen bạn đã xếp nhóm vẫn giữ nguyên.</li><li>✅ Không ngắt kết nối ứng dụng nào, không xoá tin nhắn gốc.</li><li>✅ Hộp thư và cài đặt khác không bị ảnh hưởng.</li></ul>
      <div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">Huỷ</button><button class="btn btn-primary" data-action="ct-forget-yes">Quên danh sách</button></div>`);
  },
  async 'ct-forget-yes'() {
    try { S.contactDirectory = await api('/api/contacts/seen', { method: 'DELETE' }); ct.picks = []; closeModal(); paintContacts(); toast('Đã quên danh sách đã gặp', 'ok'); }
    catch (err) { toast(err.message, 'error'); }
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
    queueSave({ attention: { mutedApps: [...cur] } }, true).then(() => render());
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
    const saved = queueSave({ appearance: { customPosition: { x: null, y: null } } }, true);
    toast('Đã đưa bé về góc đã chọn', 'ok');
    saved.then(() => render());
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
  if (!d || !d.id) return;
  const i = S.adapters.findIndex(a => a.id === d.id);
  if (i >= 0) S.adapters[i] = d; else S.adapters.push(d);
  // Wherever this adapter is shown (Monitor → Tech cards, Connect, Home), patch it in place.
  const card = main.querySelector(`article.adapter[data-adapter="${d.id}"]`);
  // Rebuild the whole card when asked, or when its state changed and the user isn't typing in it.
  if (card && (rerenderCard || !card.contains(document.activeElement))) { card.outerHTML = adapterCard(d); return; }
  document.querySelectorAll(`[data-adapter-status="${d.id}"]`).forEach(el => { el.className = `status ${STATUS_CLASS[d.status] || ''}`; el.textContent = STATUS_VI[d.status] || d.status; });
  document.querySelectorAll(`[data-adapter-detail="${d.id}"]`).forEach(el => {
    el.textContent = `${d.detail || ''}${d.lastEventAt ? ` · sự kiện gần nhất ${timeAgo(d.lastEventAt)} (${d.eventCount})` : ''}`;
  });
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
    if (changed && modalEl.hidden && (route === 'connect' || route === 'home')) render(); // Monitor → Tech cards are patched in place above
  });
  es.addEventListener('settings', (e) => {
    if (savePending()) return; // our own save is on its way; this snapshot may predate it
    const prevAdv = advanced();
    S.settings = JSON.parse(e.data);
    setLanguage(S.settings.appearance.language);
    applyTheme(S.settings.appearance.uiTheme);
    syncInputs();
    applyPreviewSettings();
    if (prevAdv !== advanced()) renderNav();
    if (route === 'pet' && !(document.activeElement && /^ct-/.test(document.activeElement.id || ''))) refreshContactDirectory();
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
  makeThumbnails().catch(() => {}); // thumbnails are painted in place as they become ready
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
