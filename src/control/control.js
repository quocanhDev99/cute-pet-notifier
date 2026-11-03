/**
 * Desktop Control Center — 8 sections, live 3D preview, real-time updates (SSE).
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
const sound = new SoundKit();

let S = null; // full app state from /api/state
let route = 'dashboard';
let stage = null;
let previewEmotion = 'idle';
const thumbs = {};

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
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s trước`;
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return new Date(ts).toLocaleString('vi-VN');
}

const emo = (id) => (S.emotions.find(e => e.id === id) || { emoji: '🐾', label: id, assetKey: id });
const emotionOptions = (sel) => S.emotions.map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${e.emoji} ${e.label} (${e.id})</option>`).join('');

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
  pendingPatch = deepMerge(pendingPatch, patch);
  deepMerge(S.settings, patch);
  applyPreviewSettings();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, immediate ? 0 : 280);
}

async function flushSave() {
  const p = pendingPatch;
  pendingPatch = {};
  try {
    S.settings = await api('/api/settings', { method: 'PUT', body: p });
    syncInputs();
    flashSaved();
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
  queueSave(patchOf(el.dataset.setting, v), true);
});

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-choice]');
  if (c) { queueSave(patchOf(c.dataset.choice, c.dataset.value), true); syncInputs(); }
});

/* ================================================================== 3D preview */

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

function setPreviewEmotion(id) {
  previewEmotion = id;
  ensureStage();
  stage.setEmotion(id);
  stage.setAnnoying(presetFor(S.settings.personality).annoyingEmotions.includes(id));
  document.querySelectorAll('[data-preview-emotion]').forEach(b => b.classList.toggle('active', b.dataset.previewEmotion === id));
  const label = document.getElementById('preview-label');
  if (label) label.textContent = id === 'idle' ? '🐾 Đứng chờ (idle)' : `${emo(id).emoji} ${emo(id).assetKey} · ${emo(id).label}`;
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

const previewControls = (extra = '') => `
  <div class="preview-wrap">
    <div class="preview-host" id="preview-host"><div class="preview-bubble"></div><div class="preview-floor"></div></div>
    <div class="preview-label" id="preview-label"></div>
    <div class="emotion-pad">
      ${S.emotions.map(e => `<button class="emo-btn" data-preview-emotion="${e.id}" title="${esc(e.meaning)}"><span>${e.emoji}</span><small>${e.label}</small></button>`).join('')}
    </div>
    <div class="action-row">
      <button class="chip-btn" data-preview-emotion="idle">🐾 Idle</button>
      <button class="chip-btn" data-action="stage-play" data-arg="wave">👋 Vẫy tay</button>
      <button class="chip-btn" data-action="stage-play" data-arg="pet">💕 Vuốt ve</button>
      <button class="chip-btn" data-action="stage-play" data-arg="kick">🦶 Đá</button>
      ${extra}
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

/* ================================================================== sections */

const H = {
  head(title, sub, right = '') {
    return `<header class="page-head"><div><h1>${title}</h1><p>${sub}</p></div><div class="head-right">${right}<span id="saved-badge" class="saved-badge">✓ Đã lưu</span></div></header>`;
  },
  toggle(path, label, desc = '') {
    return `<label class="toggle-row"><div><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</div><input type="checkbox" data-setting="${path}"><span class="switch"></span></label>`;
  },
  slider(path, label, min, max, step, fmt = '') {
    return `<label class="slider-row"><div class="slider-top"><b>${label}</b><span class="val" data-out="${path}" data-fmt="${fmt}"></span></div><input type="range" data-setting="${path}" min="${min}" max="${max}" step="${step}"></label>`;
  },
  number(path, label, min, max, desc = '') {
    return `<label class="field"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}<input type="number" data-setting="${path}" min="${min}" max="${max}"></label>`;
  }
};

const DELIVERY_LABEL = { realtime_push: '⚡ Realtime push', near_realtime_poll: '⏱️ Near real-time (poll)', scheduled_sync: '🗓️ Scheduled sync', native_os: '🖥️ System event', manual: '✋ Manual' };
const PRIORITY_LABEL = { critical: '🚨 Khẩn cấp', important: '⭐ Quan trọng', normal: '• Bình thường', low: '💤 Ít quan trọng' };
const REASON_LABEL = {
  allowed: 'Hiển thị', low_priority: 'Ít quan trọng → Inbox', cooldown: 'Quá nhiều tin cùng app (cooldown)', app_muted: 'App đã tắt tiếng',
  presence_hidden: 'Đang ẩn thú cưng', presence_minimal: 'Hiện tối giản', critical_bypass: 'Khẩn cấp — vượt rào', queue_overflow: 'Hàng đợi đầy', manual_test: 'Thử nghiệm'
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

const STATUS_CLASS = { 'Connected': 'ok', 'Disconnected': 'off', 'Requires Authorization': 'warn', 'Permission Limited': 'warn', 'Unsupported': 'na', 'Error': 'err' };
const STATUS_VI = { 'Connected': 'Đã kết nối', 'Disconnected': 'Chưa kết nối', 'Requires Authorization': 'Cần xác thực', 'Permission Limited': 'Quyền hạn chế', 'Unsupported': 'Không hỗ trợ', 'Error': 'Lỗi' };

const sections = {
  dashboard() {
    const st = S.pipeline.stats;
    const total = Object.values(st.byEmotion).reduce((a, b) => a + b, 0) || 0;
    const pet = S.characters.find(c => c.id === S.settings.activePet) || {};
    const preset = presetFor(S.settings.personality);
    const connected = S.adapters.filter(a => a.status === 'Connected' || a.status === 'Permission Limited');
    return `
      ${H.head('Xin chào sen! 👋', 'Tổng quan thú cưng, cảm xúc hiện tại và thông báo trong phiên này.')}
      <section class="hero panel">
        <div class="hero-stage">${previewControls()}</div>
        <div class="hero-info">
          <div class="eyebrow">Thú cưng đang hoạt động</div>
          <h2>${esc(pet.name || 'Mèo Mochi')}</h2>
          <div class="pill-row">
            <span class="pill">${preset.emoji} ${esc(preset.name)}</span>
            <span class="pill">${S.pipeline.lastEmotion ? `${emo(S.pipeline.lastEmotion).emoji} Cảm xúc gần nhất: ${emo(S.pipeline.lastEmotion).label}` : '🐾 Chưa có thông báo'}</span>
            <span class="pill ${S.pipeline.dnd ? 'pill-night' : ''}">${S.pipeline.dnd ? '🌙 Đang không làm phiền' : '☀️ Sẵn sàng nhận tin'}</span>
          </div>
          <div class="stat-grid">
            <div class="stat"><b id="st-received">${st.received}</b><span>Đã nhận</span></div>
            <div class="stat"><b>${st.displayed}</b><span>Đã hiển thị</span></div>
            <div class="stat"><b>${st.deduped + st.grouped}</b><span>Gộp / trùng lặp</span></div>
            <div class="stat"><b>${st.suppressed}</b><span>Ẩn do DND</span></div>
          </div>
          <div class="cta-row">
            <button class="btn btn-primary" data-action="test" data-arg="${previewEmotion === 'idle' ? 'happy' : previewEmotion}">🚀 Gửi thông báo thử ra desktop</button>
            <a class="btn btn-ghost" href="#connections">🔌 ${connected.length} kết nối đang hoạt động</a>
          </div>
        </div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <h3>🎭 Phân bố cảm xúc</h3>
          <div class="bars">
            ${S.emotions.map(e => {
              const n = st.byEmotion[e.id] || 0;
              return `<div class="bar-row"><span class="bar-label">${e.emoji} ${e.label}</span><div class="bar"><i class="emo-bg-${e.id}" style="width:${total ? (n / total) * 100 : 0}%"></i></div><b>${n}</b></div>`;
            }).join('')}
          </div>
        </section>
        <section class="panel">
          <h3>📥 Inbox & chế độ</h3>
          <div class="mini-row"><span>Chưa đọc</span><a class="link" href="#attention"><b id="dash-inbox">${S.pipeline.inbox ? S.pipeline.inbox.unread : 0}</b> tin</a></div>
          <div class="mini-row"><span>Chế độ hiện tại</span><a class="link" href="#focus">${(S.focusModes[S.effective.mode.id] || {}).emoji || ''} ${esc(S.effective.mode.id)} · ${esc(S.effective.presence)}</a></div>
          <h3 style="margin-top:16px">📈 Độ trễ đo thực tế</h3>
          <div class="adapter-mini">${Object.entries(S.pipeline.latency || {}).filter(([k, v]) => v.count).map(([k, v]) => `<div class="mini-row"><span>${esc(k.replace(':', ' · ').replace(/_/g, ' '))}</span><span>p50 <b>${v.p50}</b>ms · p95 <b>${v.p95}</b>ms <small class="muted">n=${v.count}</small></span></div>`).join('') || '<div class="empty">Chưa có mẫu đo — gửi vài thông báo nhé.</div>'}</div>
        </section>
        <section class="panel">
          <h3>🔌 Kết nối</h3>
          <div class="adapter-mini">
            ${S.adapters.filter(a => a.status !== 'Unsupported').map(a => `<a href="#connections" class="mini-row"><span>${a.icon} ${esc(a.name)}</span><span class="status ${STATUS_CLASS[a.status]}" data-adapter-status="${a.id}">${STATUS_VI[a.status]}</span></a>`).join('')}
          </div>
        </section>
      </div>
      <section class="panel">
        <div class="panel-head"><h3>🕘 Thông báo gần đây</h3><span class="muted">Hàng đợi: <b>${S.pipeline.queueLength}</b></span></div>
        <div class="history" id="history">${historyRows(S.pipeline.history)}</div>
      </section>`;
  },

  pets() {
    const labels = { planned: 'Kế hoạch', pilot: 'Pilot', reference_ready: 'Có ảnh tham chiếu', turnaround_ready: 'Có turnaround', model_ready: 'Có model', rigging_ready: 'Đã rig', animation_ready: 'Có animation', glb_validated: 'GLB đã kiểm', runtime_integrated: 'Runtime procedural', production_ready: 'Production' };
    return `
      ${H.head('Thú cưng', 'Chọn nhân vật, xem trước 3D thời gian thực và nhập mô hình .glb từ Blender.')}
      <div class="grid-pets">
        ${S.characters.map(c => `
          <article class="pet-card ${S.settings.activePet === c.id ? 'active' : ''}">
            <div class="pet-thumb">${thumbs[c.id] ? `<img src="${thumbs[c.id]}" alt="">` : '<div class="thumb-loading">…</div>'}</div>
            <div class="pet-meta">
              <h3>${esc(c.name)}</h3>
              <div class="pill-row">
                <span class="pill small">${esc(labels[c.status] || c.status)}</span>
                <span class="pill small ${c.customModel || c.bundledModel ? 'pill-ok' : ''}">${c.customModel ? '📦 GLB tùy chỉnh' : c.bundledModel ? '📦 GLB đi kèm' : '🧩 Rig procedural'}</span>
              </div>
              <div class="btn-row">
                ${S.settings.activePet === c.id ? '<span class="btn btn-done">✓ Đang dùng</span>' : `<button class="btn btn-primary small" data-action="pick-pet" data-arg="${c.id}">Chọn</button>`}
                <label class="btn btn-ghost small">⬆️ Nhập .glb<input type="file" accept=".glb,model/gltf-binary" data-upload="${c.id}" hidden></label>
                ${c.customModel ? `<button class="btn btn-ghost small danger" data-action="remove-glb" data-arg="${c.id}">Xóa GLB</button>` : ''}
              </div>
            </div>
          </article>`).join('')}
      </div>
      <div class="grid-2 wide-left">
        <section class="panel">${previewControls()}</section>
        <section class="panel prose">
          <h3>📦 Chuẩn gói nhân vật</h3>
          <p>Mỗi nhân vật dùng <b>1 mô hình duy nhất</b> + khung xương + morph targets + animation clips. File <code>.glb</code> nhập vào sẽ được dùng thay cho rig procedural.</p>
          <ul>
            <li>Gốc tọa độ tại đáy bàn chân, mặt hướng <b>+Z</b>, cao 1.5–2.0 BU (tự chuẩn hóa).</li>
            <li>Bones: <code>root spine chest neck head arm_L/R paw_L/R leg_L/R foot_L/R tail_01/02 ear_L/R</code> — bone <code>head</code> sẽ nhìn theo chuột.</li>
            <li>Clips: <code>idle hold_card dodge reject pet kick feed wave</code> + tên 8 cảm xúc.</li>
            <li>Morph targets đặt tên theo cảm xúc (<code>happy</code> hoặc <code>01_happy</code>…) sẽ tự blend.</li>
          </ul>
          <p class="muted">Xem chi tiết: docs/BLENDER_GUIDE.md</p>
        </section>
      </div>`;
  },

  emotions() {
    const s = S.settings;
    const kw = (s.keywordRules && s.keywordRules.length ? s.keywordRules : S.defaults.keywordRules);
    const appRules = { ...S.defaults.appRules, ...s.appRules };
    return `
      ${H.head('Cảm xúc & Tính cách', 'Emotion Engine độc lập với nhân vật — 5 preset tính cách, bộ quy tắc phân loại 5 tầng và xem trước 8 cảm xúc.')}
      <section class="panel">
        <h3>🧬 Preset tính cách</h3>
        <div class="preset-grid">
          ${Object.values(S.presets).map(p => `
            <button class="preset ${s.personality === p.id ? 'selected' : ''}" data-choice="personality" data-value="${p.id}">
              <span class="preset-emoji">${p.emoji}</span>
              <b>${esc(p.name)}</b>
              <small>${esc(p.description)}</small>
              <span class="preset-tags"><i>⚡ ×${p.motionSpeed}</i><i>🙅 né ${Math.round(p.evasionSensitivity * 100)}%</i><i>${emo(p.defaultEmotion).emoji} mặc định</i></span>
            </button>`).join('')}
        </div>
      </section>
      <div class="grid-2 wide-left">
        <section class="panel">${previewControls('<button class="chip-btn primary" data-action="test-current">🚀 Thử trên desktop</button>')}</section>
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
            <li><b>1</b> Quy tắc tùy chỉnh</li><li><b>2</b> Theo ứng dụng</li><li><b>3</b> Từ khóa</li><li><b>4</b> Metadata (priority, mood, event)</li><li><b>5</b> Mặc định theo tính cách</li>
          </ol>
        </section>
      </div>
      <section class="panel">
        <div class="panel-head"><h3>① Quy tắc tùy chỉnh</h3><button class="btn btn-primary small" data-action="add-rule">＋ Thêm quy tắc</button></div>
        <div class="rules" id="rules">${rulesTable()}</div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h3>② Theo ứng dụng</h3><div class="inline-add"><input id="new-app" placeholder="vd: jira, discord"><button class="btn btn-ghost small" data-action="add-app-rule">＋ Thêm</button></div></div>
          <div class="app-rules">
            ${Object.entries(appRules).map(([app, e]) => `
              <div class="app-rule"><code>${esc(app)}</code>
                <select data-app-rule="${esc(app)}"><option value="">— không áp dụng —</option>${emotionOptions(e)}</select>
              </div>`).join('')}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>③ Từ khóa</h3><button class="btn btn-ghost small" data-action="reset-keywords">↺ Mặc định</button></div>
          <div class="kw-list">
            ${kw.map((r, i) => `
              <label class="kw-row"><span>${emo(r.emotion).emoji} ${emo(r.emotion).label}</span>
                <textarea rows="2" data-kw-index="${i}" data-kw-emotion="${r.emotion}">${esc(r.keywords.join(', '))}</textarea>
              </label>`).join('')}
          </div>
        </section>
      </div>`;
  },

  notifications() {
    const modes = [
      ['billboard', '🪧', 'Billboard Hugger', 'Thú cưng đứng cạnh, một tay giữ mép thẻ acrylic, thẻ "thở" theo nhịp.'],
      ['peeker', '👀', 'Peeker', 'Ló đầu từ sau mép thẻ, gác hai tay lên viền, mắt dõi theo chuột.'],
      ['courier', '✉️', 'Courier', 'Chạy vào từ mép màn hình mang phong bì, rồi bung thẻ thông báo.']
    ];
    const themes = [
      ['pastel', 'Cute Pastel'],
      ['minimal', 'Minimal White'],
      ['dark', 'Dark Mode'],
      ['glass', 'Glassmorphism'],
      ['acrylic', 'Transparent Acrylic']
    ];
    const pos = ['top-left', 'top-center', 'top-right', 'middle-left', null, 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
    return `
      ${H.head('Thông báo', 'Kiểu cầm thẻ, giao diện thẻ, vị trí trên màn hình và chống nghẽn hàng đợi.')}
      <section class="panel">
        <h3>🪟 Chế độ cầm thẻ</h3>
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
          <h3>🎨 Giao diện thẻ</h3>
          <div class="theme-grid">
            ${themes.map(([id, name]) => `
              <button class="theme-card" data-choice="notifications.theme" data-value="${id}">
                <div class="theme-swatch t-${id}"><i></i><i></i><i></i></div><b>${name}</b>
              </button>`).join('')}
          </div>
          <div class="seg" role="radiogroup">
            ${[['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn']].map(([v, l]) => `<button data-choice="notifications.size" data-value="${v}">${l}</button>`).join('')}
          </div>
          ${H.slider('notifications.duration', '⏱️ Thời gian hiển thị', 3000, 30000, 500, 'sec')}
        </section>
        <section class="panel">
          <h3>📍 Vị trí trên màn hình</h3>
          <div class="pos-picker">
            ${pos.map(p => p ? `<button data-choice="appearance.position" data-value="${p}" title="${p}"><i></i></button>` : '<div class="pos-screen">🖥️</div>').join('')}
          </div>
          <p class="muted center">Chọn một trong 8 góc / mép. Khoảng cách viền chỉnh ở mục Hiển thị.</p>
        </section>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h3>🚦 Chống nghẽn hàng đợi</h3>
          <div class="form-grid">
            ${H.number('notifications.maxQueue', 'Tối đa trong hàng đợi', 1, 100, 'Tin cũ ít quan trọng sẽ bị bỏ khi đầy')}
            ${H.number('notifications.dedupeSeconds', 'Bỏ trùng trong (giây)', 0, 600, 'Cùng nguồn + tiêu đề + nội dung')}
            ${H.number('notifications.groupThreshold', 'Gộp khi ≥ N tin cùng app', 2, 50, 'Hiển thị 1 thẻ tóm tắt')}
          </div>
          <div class="btn-row"><button class="btn btn-ghost small" data-action="clear-queue">🧹 Xóa hàng đợi</button></div>
        </section>
        <section class="panel prose">
          <h3>🧠 Ai được phép làm phiền?</h3>
          <p>Mức ưu tiên, cooldown, tắt tiếng từng ứng dụng và Inbox nằm ở <a class="link" href="#attention">Sự chú ý &amp; Inbox</a>.</p>
          <p>Chế độ hiện diện (Full / Minimal / Hidden), 6 chế độ tập trung và giờ yên tĩnh nằm ở <a class="link" href="#focus">Tập trung &amp; Hiện diện</a>.</p>
        </section>
      </div>
      <section class="panel">
        <h3>🚀 Gửi thông báo thử ra desktop</h3>
        <div class="test-grid">
          ${S.emotions.map(e => `<button class="test-btn emo-border-${e.id}" data-action="test" data-arg="${e.id}"><span>${e.emoji}</span><b>${e.assetKey}</b><small>${esc(e.meaning)}</small></button>`).join('')}
        </div>
      </section>`;
  },

  attention() {
    const a = S.settings.attention;
    const ib = S.pipeline.inbox || { unread: 0, items: [], digest: { total: 0, byApp: [], byPriority: {} } };
    const apps = [...new Set([...Object.keys(S.pipeline.stats.bySource || {}), ...Object.keys(S.defaults.appRules), 'slack', 'github', 'calendar', 'gmail', 'system'])].sort();
    return `
      ${H.head('Quản lý sự chú ý', 'Chống mỏi thông báo: 4 mức ưu tiên, cooldown theo ứng dụng, gom chùm và hộp thư Inbox — không có gì bị mất khi bạn đang tập trung.')}
      <div class="grid-2">
        <section class="panel">
          <h3>🚦 Chính sách ưu tiên</h3>
          <div class="prio-ladder">
            <div class="prio-step critical"><b>🚨 Khẩn cấp</b><small>Pin cạn, máy quá nhiệt, server sập → luôn được hiện${a.criticalBypass ? ', vượt mọi chế độ' : ''}.</small></div>
            <div class="prio-step important"><b>⭐ Quan trọng</b><small>Tin nhắn riêng, @mention, lịch họp sắp tới.</small></div>
            <div class="prio-step normal"><b>• Bình thường</b><small>Cập nhật thường ngày — tuân theo cooldown.</small></div>
            <div class="prio-step low"><b>💤 Ít quan trọng</b><small>Khuyến mãi, bản tin → ${a.lowToInbox ? 'thẳng vào Inbox' : 'vẫn hiện thẻ'}.</small></div>
          </div>
          ${H.toggle('attention.criticalBypass', 'Tin khẩn cấp được vượt rào mọi chế độ')}
          ${H.toggle('attention.lowToInbox', 'Tin ít quan trọng vào Inbox, không bật thẻ')}
        </section>
        <section class="panel">
          <h3>⏳ Cooldown & tắt tiếng ứng dụng</h3>
          <div class="form-grid two">
            ${H.number('attention.cooldownCount', 'Tối đa số thẻ / ứng dụng', 1, 50)}
            ${H.number('attention.cooldownWindowSec', 'Trong khoảng (giây)', 0, 600, '0 = tắt cooldown')}
          </div>
          <b class="sub-title">🔕 Ứng dụng đã tắt tiếng (vào thẳng Inbox)</b>
          <div class="mute-list">
            ${apps.map(app => `<button class="mute-chip ${(a.mutedApps || []).includes(app) ? 'muted' : ''}" data-action="toggle-mute" data-arg="${esc(app)}">${(a.mutedApps || []).includes(app) ? '🔕' : '🔔'} ${esc(app)}</button>`).join('')}
          </div>
        </section>
      </div>
      <section class="panel">
        <div class="panel-head">
          <h3>📥 Inbox <span class="count-badge" id="inbox-count">${ib.unread}</span> chưa đọc</h3>
          <div class="btn-row tight">
            <button class="btn btn-ghost small" data-action="inbox-read-all">✓ Đánh dấu đã đọc</button>
            <button class="btn btn-ghost small danger" data-action="inbox-clear">🗑️ Xóa Inbox</button>
          </div>
        </div>
        <div class="digest">
          <div class="digest-total"><b>${ib.digest.total}</b><span>tin chưa đọc</span></div>
          <div class="pill-row">${Object.entries(ib.digest.byPriority || {}).filter(([, n]) => n).map(([p, n]) => `<span class="pill small prio-pill-${p}">${PRIORITY_LABEL[p]} · ${n}</span>`).join('') || '<span class="muted">Không có tin nào đang chờ 🎉</span>'}</div>
          <div class="pill-row">${(ib.digest.byApp || []).slice(0, 8).map(([app, n]) => `<span class="pill small">${esc(app)} · ${n}</span>`).join('')}</div>
        </div>
        <div class="history inbox-list" id="inbox-list">${inboxRows(ib.items)}</div>
      </section>
      <section class="panel">
        <h3>🧪 Thử chính sách với từng mức ưu tiên</h3>
        <div class="btn-row">
          ${['critical', 'important', 'normal', 'low'].map(p => `<button class="chip-btn" data-action="test-priority" data-arg="${p}">${PRIORITY_LABEL[p]}</button>`).join('')}
        </div>
        <p class="muted">Gửi một thông báo thử qua pipeline thật (không bỏ qua Attention Engine) và cho biết nó được hiện hay vào Inbox.</p>
      </section>`;
  },

  focus() {
    const sys = S.settings.system;
    const eff = S.effective || { mode: { id: 'none', source: 'default' } };
    const presences = [
      ['full', '🐱', 'Đồng hành toàn phần', 'Ngồi ở góc màn hình, thở nhịp nhàng, dõi theo chuột, đón vuốt ve.'],
      ['minimal', '🐾', 'Tối giản', 'Thu nhỏ, cuộn tròn ngủ ở góc; thẻ vẫn hiện nhưng chuyển động nhẹ.'],
      ['hidden', '🙈', 'Ẩn hoàn toàn', 'Ẩn toàn bộ, ngừng render (0% GPU). Tin vào Inbox, trừ tin khẩn cấp.']
    ];
    const modes = [
      ['none', 'Bình thường', 'Mọi tin bình thường trở lên được hiện.'],
      ['work', 'Work', 'Lọc tin mạng xã hội, giải trí, khuyến mãi.'],
      ['focus', 'Deep Focus', 'Chỉ tin khẩn cấp; tắt âm thanh, giảm chuyển động.'],
      ['meeting', 'Meeting', 'Thú cưng ngủ; chỉ tin quan trọng trở lên, không âm thanh.'],
      ['gaming', 'Gaming', 'Ẩn thú cưng & dừng WebGL (0%); tin khẩn vẫn được hiện.'],
      ['relax', 'Relax', 'Mọi tương tác, cả tin ít quan trọng.'],
      ['sleep', 'Sleep', 'Im lặng tuyệt đối, chỉ tin khẩn cấp.']
    ];
    const srcLabel = { manual: 'bạn chọn', dnd: 'Không làm phiền', quiet_hours: 'giờ yên tĩnh', default: 'mặc định' };
    return `
      ${H.head('Tập trung & Hiện diện', 'Lệnh thủ công của bạn luôn có quyền cao nhất. Thú cưng không bao giờ ép bạn tương tác.')}
      <div class="mode-banner">${(S.focusModes[eff.mode.id] || {}).emoji || '🐾'} Đang áp dụng: <b>${esc(({ none: 'Bình thường', work: 'Work', focus: 'Deep Focus', meeting: 'Meeting', gaming: 'Gaming', relax: 'Relax', sleep: 'Sleep' })[eff.mode.id] || eff.mode.id)}</b> <span class="muted">(${srcLabel[eff.mode.source] || eff.mode.source})</span>${eff.reducedMotion ? ' · <span class="pill small">🐢 Giảm chuyển động</span>' : ''}</div>
      <section class="panel">
        <h3>👁️ Trạng thái hiện diện</h3>
        <div class="mode-grid">
          ${presences.map(([id, icon, name, desc]) => `<button class="mode-card" data-choice="system.presence" data-value="${id}"><span class="big-emoji">${icon}</span><b>${name}</b><small>${desc}</small></button>`).join('')}
        </div>
      </section>
      <section class="panel">
        <h3>🎯 Chế độ tập trung</h3>
        <div class="focus-grid">
          ${modes.map(([id, name, desc]) => {
            const m = S.focusModes[id];
            return `<button class="mode-card" data-choice="system.focusMode" data-value="${id}"><span class="big-emoji">${m.emoji}</span><b>${name}</b><small>${desc}</small>
              <span class="preset-tags"><i>≥ ${m.minPriority}</i><i>${m.sound ? '🔊' : '🔇'}</i><i>${m.motion === 'reduced' ? '🐢 giảm' : '🐇 đầy đủ'}</i></span></button>`;
          }).join('')}
        </div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <h3>🌙 Không làm phiền & giờ yên tĩnh</h3>
          ${H.toggle('dnd.enabled', 'Bật Không làm phiền (= Sleep)', 'Áp dụng khi bạn không chọn chế độ tập trung nào khác.')}
          ${H.toggle('dnd.quietHoursEnabled', 'Giờ yên tĩnh hằng ngày (tự bật Sleep)')}
          <div class="time-row"><label>Từ <input type="time" data-setting="dnd.quietStart"></label><label>đến <input type="time" data-setting="dnd.quietEnd"></label></div>
        </section>
        <section class="panel prose">
          <h3>ℹ️ Giới hạn hiện tại</h3>
          <ul>
            <li>Gaming Mode cần bật thủ công: Electron không có API công khai để phát hiện ứng dụng khác đang toàn màn hình.</li>
            <li>Chế độ tự động theo lịch họp (Calendar-aware Focus) thuộc Phase 10 — chưa triển khai.</li>
          </ul>
        </section>
      </div>`;
  },

  connections() {
    return `
      ${H.head('Kết nối ứng dụng', 'Chỉ dùng API chính thức, webhook và sự kiện hệ điều hành — không screen-scraping. Token được mã hóa bằng Keychain / DPAPI.')}
      ${S.secureStorage ? '' : '<div class="alert">⚠️ Bộ lưu trữ bảo mật của hệ điều hành không khả dụng — không thể lưu token.</div>'}
      <div class="adapter-grid">${S.adapters.map(adapterCard).join('')}</div>`;
  },

  appearance() {
    const hasCustomPos = S.settings.appearance.customPosition && Number.isFinite(S.settings.appearance.customPosition.x);
    return `
      ${H.head('Hiển thị & Vị trí', 'Màn hình hiển thị, vị trí tự do, khoảng cách viền, kích thước và chế độ thường trú.')}
      <div class="grid-2">
        <section class="panel">
          <h3>🖥️ Đa màn hình & Tỷ lệ</h3>
          <label class="field"><b>Hiển thị trên</b>
            <select data-setting="appearance.displayId">
              ${S.displays.map(d => `<option value="${d.id}">${esc(d.label)}</option>`).join('')}
            </select>
          </label>
          ${H.slider('appearance.margin', '↔️ Khoảng cách viền', 0, 120, 2, 'px')}
          ${H.slider('appearance.petScale', '🔍 Kích thước thú cưng', 0.6, 1.6, 0.05, 'x')}
        </section>
        <section class="panel">
          <h3>🖐️ Kéo thả tự do & Thường trú</h3>
          ${H.toggle('appearance.dragEnabled', 'Cho phép nắm kéo thả tự do', 'Nhấn giữ chuột vào thú cưng để nhấc bổng và thả vào bất kỳ vị trí nào trên màn hình làm việc.')}
          ${H.toggle('appearance.residentPet', 'Luôn ngồi ở góc màn hình', 'Tắt đi để thú cưng chỉ xuất hiện khi có thông báo. Khi rảnh, render tự ngủ đông (0% CPU).')}
          <div class="btn-row" style="margin-top:12px">
            <button class="btn btn-ghost small" data-action="reset-position">↺ Đặt lại vị trí mặc định</button>
            ${hasCustomPos ? '<span class="chip" style="align-self:center">📍 Đang ở vị trí kéo thả tùy chỉnh</span>' : ''}
          </div>
          <p class="muted">Mẹo: Thú cưng sẽ có phản ứng quơ quào chân, kêu cứu hài hước khi bị bạn nhấc bổng!</p>
        </section>
      </div>`;
  },

  sounds() {
    const voices = [['meow', '🐱 Meo'], ['woof', '🐶 Gâu'], ['squeak', '🐰 Chíp'], ['chirp', '🐧 Píp']];
    return `
      ${H.head('Âm thanh & Hoạt họa', 'Âm lượng, tiếng kêu, độ nhạy vuốt ve và cường độ chuyển động.')}
      <div class="grid-2">
        <section class="panel">
          <h3>🔊 Âm thanh</h3>
          ${H.toggle('sounds.enabled', 'Bật âm thanh', 'Tiếng kêu & hiệu ứng được tổng hợp bằng Web Audio, không cần file âm thanh.')}
          ${H.slider('sounds.volume', 'Âm lượng', 0, 1, 0.05, 'pct')}
          <div class="btn-row wrap">
            ${voices.map(([v, l]) => `<button class="chip-btn" data-action="voice" data-arg="${v}">${l}</button>`).join('')}
            <button class="chip-btn" data-action="bell">🔔 Chuông</button>
            ${S.emotions.map(e => `<button class="chip-btn" data-action="emo-sound" data-arg="${e.id}">${e.emoji}</button>`).join('')}
          </div>
        </section>
        <section class="panel">
          <h3>✨ Hoạt họa & xúc giác</h3>
          ${H.slider('sounds.animationIntensity', 'Cường độ chuyển động', 0.3, 2, 0.05, 'x')}
          ${H.slider('sounds.petSensitivity', 'Độ nhạy vuốt ve', 0.3, 3, 0.05, 'x')}
          <label class="field"><b>🐢 Giảm chuyển động (Reduced Motion)</b>
            <select data-setting="sounds.reducedMotion">
              <option value="system">Theo hệ điều hành${S.effective && S.effective.reducedMotion ? ' (đang bật)' : ''}</option>
              <option value="on">Luôn bật</option>
              <option value="off">Tắt</option>
            </select>
          </label>
          <p class="muted">Thử vuốt đầu thú cưng ở khung xem trước bên dưới.</p>
        </section>
      </div>
      <section class="panel">${previewControls()}</section>`;
  },

  settings() {
    const lang = S.settings.appearance.language || 'vi';
    return `
      ${H.head('Cài đặt', 'Khởi động cùng hệ thống, ngôn ngữ, quyền riêng tư và bảo mật dữ liệu.')}
      <div class="grid-2">
        <section class="panel">
          <h3>🚀 Hệ thống</h3>
          ${S.autoLaunchSupported ? H.toggle('system.autoLaunch', 'Tự khởi động cùng hệ thống', 'Mở ẩn khi đăng nhập macOS / Windows.') : '<p class="muted">Tự khởi động chỉ hỗ trợ macOS / Windows.</p>'}
          <label class="field" style="margin-top:14px"><b>🌐 Ngôn ngữ hiển thị (Language)</b>
            <select data-setting="appearance.language">
              <option value="vi" ${lang === 'vi' ? 'selected' : ''}>🇻🇳 Tiếng Việt</option>
              <option value="en" ${lang === 'en' ? 'selected' : ''}>🇺🇸 English</option>
            </select>
          </label>
        </section>
        <section class="panel">
          <h3>🔒 Quyền riêng tư</h3>
          ${H.toggle('privacy.keepHistory', 'Lưu lịch sử thông báo trong phiên', 'Chỉ lưu trong bộ nhớ, không ghi ra ổ đĩa.')}
          ${H.number('privacy.historyLimit', 'Số thông báo tối đa', 0, 1000)}
          ${H.toggle('attention.persistInbox', 'Lưu Inbox xuống ổ đĩa', 'Để tin trong Inbox không mất khi khởi động lại. Tắt sẽ xóa file inbox.json.')}
          <div class="btn-row"><button class="btn btn-ghost small" data-action="clear-history">🗑️ Xóa lịch sử</button></div>
        </section>
      </div>
      <div class="grid-2">
        <section class="panel prose">
          <h3>🛡️ Bảo mật</h3>
          <ul>
            <li>Lưu trữ token: <b>${S.secureStorage ? (S.platform === 'darwin' ? 'macOS Keychain ✓' : S.platform === 'win32' ? 'Windows DPAPI ✓' : 'OS keyring ✓') : 'không khả dụng ✗'}</b></li>
            <li>Máy chủ chỉ lắng nghe <code>127.0.0.1:${S.port}</code>, kiểm tra Host header.</li>
            <li>API Control Center yêu cầu token ngẫu nhiên mỗi lần khởi động.</li>
            <li>Nội dung thông báo được xem là dữ liệu không tin cậy: lọc ký tự điều khiển, giới hạn độ dài, chỉ mở link http(s).</li>
          </ul>
        </section>
        <section class="panel prose">
          <h3>ℹ️ Thông tin</h3>
          <ul>
            <li>Phiên bản: <b>${esc(S.version)}</b> · Nền tảng: <b>${esc(S.platform)}</b></li>
            <li>Webhook: <code>POST http://127.0.0.1:${S.port}/notify</code></li>
          </ul>
          <div class="btn-row"><button class="btn btn-ghost small danger" data-action="reset-settings">↺ Khôi phục cài đặt gốc</button></div>
        </section>
      </div>`;
  }
};

function historyRows(list) {
  if (!list || !list.length) return '<div class="empty">Chưa có thông báo nào. Thử gửi một cái nhé! 🐾</div>';
  return list.slice(0, 30).map(h => `
    <div class="h-row">
      <span class="h-emo emo-bg-${h.emotion}">${emo(h.emotion).emoji}</span>
      <div class="h-main"><b>${esc(h.title)}</b><small>${esc(h.message || '')}</small></div>
      <div class="h-meta"><span class="pill small">${esc(h.app)}</span><small>${esc(h.matchedBy)} · ${timeAgo(h.receivedAt)}</small>${h.status === 'suppressed' ? '<small class="night">🌙 DND</small>' : ''}</div>
    </div>`).join('');
}

function inboxRows(list) {
  if (!list || !list.length) return '<div class="empty">Inbox trống — không có tin nào bị giữ lại. 🐾</div>';
  return list.slice(0, 100).map(h => `
    <div class="h-row ${h.read ? 'read' : ''}">
      <span class="h-emo emo-bg-${h.emotion}">${emo(h.emotion).emoji}</span>
      <div class="h-main"><b>${esc(h.title)}</b><small>${esc(h.message || '')}</small></div>
      <div class="h-meta">
        <span class="pill small prio-pill-${h.priority}">${PRIORITY_LABEL[h.priority] || h.priority}</span>
        <small>${esc(h.app)} · ${esc(reasonLabel(h.reason))} · ${timeAgo(h.receivedAt)}</small>
        <span class="row-actions">${h.url ? `<a class="link" href="${esc(h.url)}" target="_blank" rel="noopener">Mở ↗</a>` : ''}<button class="icon-btn" data-action="inbox-del" data-arg="${esc(h.id)}" title="Xóa">✕</button></span>
      </div>
    </div>`).join('');
}

function applyInbox(ib) {
  S.pipeline.inbox = ib;
  const el = document.getElementById('inbox-list');
  if (el) el.innerHTML = inboxRows(ib.items);
  updateBadges();
  if (route === 'attention') render();
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
    pill.innerHTML = `${m.emoji || '🐾'} <b>${esc(S.effective.mode.id === 'none' ? 'Bình thường' : S.effective.mode.id)}</b> · ${esc({ full: 'Full', minimal: 'Minimal', hidden: 'Hidden' }[S.effective.presence] || '')}`;
    pill.onclick = () => { location.hash = '#focus'; };
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
    if (f.type === 'secret') {
      return `<label class="field"><b>${esc(f.label)} ${f.isSet ? '<span class="lock">🔒 đã lưu</span>' : ''}</b><input type="password" autocomplete="off" data-af="${f.key}" placeholder="${f.isSet ? '•••••••• (để trống để giữ nguyên)' : esc(f.placeholder || '')}"></label>`;
    }
    if (f.type === 'boolean') return `<label class="toggle-row compact"><div><b>${esc(f.label)}</b></div><input type="checkbox" data-af="${f.key}" ${f.value ? 'checked' : ''}><span class="switch"></span></label>`;
    if (f.type === 'number') return `<label class="field"><b>${esc(f.label)}</b><input type="number" data-af="${f.key}" value="${f.value ?? ''}"></label>`;
    if (f.type === 'text') return `<label class="field"><b>${esc(f.label)}</b><input type="text" autocomplete="off" spellcheck="false" data-af="${f.key}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}"></label>`;
    if (f.type === 'select') return `<label class="field"><b>${esc(f.label)}</b><select data-af="${f.key}">${f.options.map(o => `<option value="${o.value}" ${o.value === f.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    return '';
  }).join('');
  const isOn = a.status === 'Connected' || a.status === 'Permission Limited';
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
          <button class="btn btn-primary small" data-action="adapter-connect" data-arg="${a.id}">${isOn ? '↻ Lưu & kết nối lại' : '🔗 Lưu & kết nối'}</button>
          ${isOn ? `<button class="btn btn-ghost small" data-action="adapter-disconnect" data-arg="${a.id}">Ngắt kết nối</button>` : ''}
          ${(a.actions || []).map(x => `<button class="btn btn-ghost small" data-action="adapter-run" data-arg="${a.id}|${x.id}">${esc(x.label)}</button>`).join('')}
          ${a.fields.some(f => f.type === 'secret' && f.isSet) ? `<button class="btn btn-ghost small danger" data-action="adapter-forget" data-arg="${a.id}">Xóa token</button>` : ''}
        </div>`}
    </article>`;
}

/* ================================================================== routing */

function render() {
  route = (location.hash || '#dashboard').slice(1);
  if (!sections[route]) route = 'dashboard';
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  stageHome.appendChild(previewEl);
  main.innerHTML = `<div class="page page-${route}">${sections[route]()}</div>`;
  main.scrollTop = 0;
  syncInputs();
  if (document.getElementById('preview-host')) {
    mountPreview('preview-host');
    setPreviewEmotion(previewEmotion);
  }
  updateBadges();
  if (route === 'emotions') bindEmotions();
  if (route === 'pets') bindPets();
}

window.addEventListener('hashchange', render);

/* ================================================================== section behaviours */

function bindPets() {
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

let clsTimer = null;
function bindEmotions() {
  const run = async () => {
    const title = document.getElementById('cls-title').value;
    const message = document.getElementById('cls-message').value;
    const app = document.getElementById('cls-app').value;
    const out = document.getElementById('cls-result');
    if (!title && !message && !app) { out.innerHTML = '<span class="muted">Kết quả sẽ hiện ở đây</span>'; return; }
    try {
      const r = await api('/api/classify', { method: 'POST', body: { title, message, app } });
      const c = r.classification;
      const labels = { custom: '① Quy tắc tùy chỉnh', app: '② Theo ứng dụng', keyword: '③ Từ khóa', metadata: '④ Metadata', default: '⑤ Mặc định', forced: 'Ép buộc' };
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
    const appRules = { ...S.settings.appRules, [sel.dataset.appRule]: sel.value || null };
    queueSave({ appRules }, true);
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

const actions = {
  async test(arg) {
    try {
      const r = await api('/api/test-notification', { method: 'POST', body: { emotion: arg } });
      toast(r.suppressed ? '🌙 Đang Không làm phiền — đã ghi lại nhưng không hiện' : `Đã gửi ${emo(arg).emoji} ra desktop!`, 'ok');
    } catch (err) { toast(err.message, 'error'); }
  },
  'test-current'() { actions.test(previewEmotion === 'idle' ? 'happy' : previewEmotion); },
  'stage-play'(arg) { ensureStage(); stage.play(arg); if (arg === 'pet') { sound.purr(); bubble('Purrr~ 💕'); } if (arg === 'kick') setTimeout(() => sound.whoosh(), 300); },
  async 'pick-pet'(arg) {
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
  async 'clear-history'() { await api('/api/history', { method: 'DELETE' }); S.pipeline.history = []; toast('Đã xóa lịch sử'); },
  async 'reset-settings'() {
    if (!confirm(tr('Khôi phục toàn bộ cài đặt về mặc định? (Token kết nối được giữ nguyên)'))) return;
    S.settings = await api('/api/settings/reset', { method: 'POST' });
    toast('Đã khôi phục cài đặt gốc');
    render();
  },
  async 'adapter-connect'(id) {
    const card = main.querySelector(`[data-adapter="${id}"]`);
    const values = {};
    card.querySelectorAll('[data-af]').forEach(el => {
      if (el.type === 'password') { if (el.value.trim()) values[el.dataset.af] = el.value.trim(); }
      else if (el.type === 'checkbox') values[el.dataset.af] = el.checked;
      else if (el.type === 'number') values[el.dataset.af] = Number(el.value);
      else values[el.dataset.af] = el.value;
    });
    const btn = card.querySelector('[data-action="adapter-connect"]');
    btn.disabled = true; btn.textContent = '⏳ Đang kết nối…';
    try {
      await api(`/api/adapters/${id}/configure`, { method: 'POST', body: values });
      const d = await api(`/api/adapters/${id}/connect`, { method: 'POST' });
      updateAdapter(d, true);
      toast(d.status === 'Connected' ? `${d.icon} ${d.name}: đã kết nối!` : `${d.name}: ${STATUS_VI[d.status]} — ${d.detail}`, d.status === 'Connected' ? 'ok' : 'error');
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  },
  async 'adapter-disconnect'(id) { updateAdapter(await api(`/api/adapters/${id}/disconnect`, { method: 'POST' }), true); },
  async 'adapter-forget'(id) {
    const a = S.adapters.find(x => x.id === id);
    const body = Object.fromEntries(a.fields.filter(f => f.type === 'secret').map(f => [f.key, null]));
    await api(`/api/adapters/${id}/disconnect`, { method: 'POST' });
    updateAdapter(await api(`/api/adapters/${id}/configure`, { method: 'POST', body }), true);
    toast('Đã xóa token khỏi Keychain');
  },
  copy(arg) { navigator.clipboard.writeText(document.getElementById(arg).textContent).then(() => toast('Đã copy')); },
  voice(arg) { sound.voice(arg, 'happy'); },
  bell() { sound.bell(); },
  'emo-sound'(arg) { sound.emotion(arg, 'meow'); },
  async 'test-priority'(arg) {
    try {
      const r = await api('/api/test-notification', { method: 'POST', body: { emotion: arg === 'critical' ? 'surprised' : arg === 'low' ? 'thinking' : 'happy', priority: arg } });
      toast(r.inboxed ? `📥 ${PRIORITY_LABEL[arg]} → Inbox (${reasonLabel(r.reason)})` : `🪧 ${PRIORITY_LABEL[arg]} → hiện trên desktop`, r.inboxed ? '' : 'ok');
      refreshInbox();
    } catch (err) { toast(err.message, 'error'); }
  },
  'toggle-mute'(app) {
    const cur = new Set(S.settings.attention.mutedApps || []);
    if (cur.has(app)) cur.delete(app); else cur.add(app);
    queueSave({ attention: { mutedApps: [...cur] } }, true);
    setTimeout(render, 300);
  },
  async 'inbox-read-all'() { const r = await api('/api/inbox/read', { method: 'POST', body: {} }); applyInbox(r); },
  async 'inbox-clear'() { await api('/api/inbox', { method: 'DELETE' }); applyInbox({ unread: 0, items: [], digest: { total: 0, byApp: [], byPriority: {} } }); },
  async 'inbox-del'(id) { applyInbox(await api(`/api/inbox/${id}`, { method: 'DELETE' })); },
  async 'quit-app'() {
    if (!confirm(tr('Tắt hẳn Cute Pet Companion? Thú cưng sẽ biến mất cho tới khi bạn mở lại app.'))) return;
    await api('/api/app/quit', { method: 'POST' }).catch(() => {});
    document.body.innerHTML = `<div class="loading">👋 ${tr('Đã tắt Cute Pet Companion. Bạn có thể đóng cửa sổ này.')}</div>`;
  },
  async 'adapter-run'(arg) {
    const [id, action] = String(arg).split('|');
    try { await api(`/api/adapters/${id}/action`, { method: 'POST', body: { action } }); toast('Đã mở Cài đặt Hệ thống', 'ok'); } catch (err) { toast(err.message, 'error'); }
  },
  'reset-position'() {
    queueSave({ appearance: { customPosition: { x: null, y: null } } }, true);
    toast('Đã đặt lại vị trí mặc định', 'ok');
    setTimeout(() => render(), 350);
  }
};

document.addEventListener('click', (e) => {
  const p = e.target.closest('[data-preview-emotion]');
  if (p) { setPreviewEmotion(p.dataset.previewEmotion); if (p.dataset.previewEmotion !== 'idle') sound.emotion(p.dataset.previewEmotion, 'meow'); return; }
  const a = e.target.closest('[data-action]');
  if (a && actions[a.dataset.action]) { e.preventDefault(); actions[a.dataset.action](a.dataset.arg); }
});

function updateAdapter(d, rerenderCard = false) {
  const i = S.adapters.findIndex(a => a.id === d.id);
  if (i >= 0) S.adapters[i] = d;
  document.querySelectorAll(`[data-adapter-status="${d.id}"]`).forEach(el => { el.className = `status ${STATUS_CLASS[d.status]}`; el.textContent = STATUS_VI[d.status]; });
  const det = document.querySelector(`[data-adapter-detail="${d.id}"]`);
  if (det) det.textContent = d.detail || '';
  if (rerenderCard && route === 'connections') {
    const card = main.querySelector(`[data-adapter="${d.id}"]`);
    if (card) card.outerHTML = adapterCard(d);
  }
}

/* ================================================================== live updates */

async function refreshState() { S = await api('/api/state'); }

function connectEvents() {
  const dot = document.getElementById('live-dot');
  const es = new EventSource(`/api/events?token=${encodeURIComponent(TOKEN)}`);
  es.addEventListener('hello', () => { dot.className = 'live-dot on'; dot.querySelector('span').textContent = 'Đang chạy trên desktop'; });
  es.onerror = () => { dot.className = 'live-dot'; dot.querySelector('span').textContent = 'Mất kết nối với app…'; };
  es.addEventListener('adapter', (e) => updateAdapter(JSON.parse(e.data)));
  es.addEventListener('settings', (e) => { if (!Object.keys(pendingPatch).length) { S.settings = JSON.parse(e.data); setLanguage(S.settings.appearance.language); syncInputs(); applyPreviewSettings(); } });
  es.addEventListener('history', (e) => {
    const h = JSON.parse(e.data);
    S.pipeline.history.unshift(h);
    S.pipeline.stats.received++;
    const el = document.getElementById('history');
    if (el) el.innerHTML = historyRows(S.pipeline.history);
    const r = document.getElementById('st-received');
    if (r) r.textContent = S.pipeline.stats.received;
  });
  es.addEventListener('display', (e) => {
    const d = JSON.parse(e.data);
    S.pipeline.lastEmotion = d.emotion;
    S.pipeline.stats.byEmotion[d.emotion] = (S.pipeline.stats.byEmotion[d.emotion] || 0) + 1;
    if (route === 'dashboard') setPreviewEmotion(d.emotion); // mirror the desktop pet
  });
  es.addEventListener('characters', (e) => { S.characters = JSON.parse(e.data); });
  es.addEventListener('inbox', (e) => {
    const d = JSON.parse(e.data);
    if (S.pipeline.inbox) S.pipeline.inbox.unread = d.unread;
    updateBadges();
    if (route === 'attention') refreshInbox();
  });
  es.addEventListener('mode', (e) => {
    S.effective = JSON.parse(e.data);
    updateBadges();
    if (route === 'focus') render();
  });
  es.addEventListener('latency', (e) => {
    const d = JSON.parse(e.data);
    // Keep a lightweight local view; the authoritative p50/p95 come from /api/state.
    if (route === 'dashboard' || route === 'connections') refreshState().then(() => { if (route === 'dashboard') render(); });
    void d;
  });
}

/* ================================================================== boot */

(async function boot() {
  try {
    await refreshState();
  } catch (err) {
    main.innerHTML = `<div class="loading">Không kết nối được với Cute Pet Companion (${esc(err.message)}). Hãy mở lại từ menu khay hệ thống.</div>`;
    return;
  }
  setLanguage(S.settings.appearance.language);
  render();
  connectEvents();
  makeThumbnails().then(() => { if (route === 'pets') render(); }).catch(() => {});
  setInterval(() => { if (route === 'dashboard' || route === 'connections') refreshState().then(() => { if (route === 'connections') S.adapters.forEach(a => updateAdapter(a)); }); }, 30000);
})();
