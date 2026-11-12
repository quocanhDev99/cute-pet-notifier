/**
 * Cute Pet Companion — Electron main process.
 * Wires: SettingsStore · SecretStore · NotificationPipeline · AdapterHub · HTTP server
 *        · transparent overlay window (3D pet) · native Control Center window · tray.
 */
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, shell, nativeImage, safeStorage, powerMonitor, dialog, systemPreferences } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { EventEmitter } = require('events');

const { SettingsStore } = require('../core/settings-store');
const { SecretStore } = require('../core/secret-store');
const { IntegrationsManager } = require('../integrations');
const { BreakReminder } = require('../core/break-reminder');
let breaks = null;
const { NotificationPipeline } = require('../core/notification-pipeline');
const { InboxStore, badgeFilter } = require('../core/inbox-store');
const { ContactDirectory } = require('../core/contact-directory');
const { ChatSources } = require('../integrations/chat-sources');
const { MessagingApps } = require('./messaging-apps');
const { FOCUS_MODES, PRIORITIES } = require('../core/attention-engine');
const { PERSONALITY_PRESETS, DEFAULT_APP_RULES, DEFAULT_KEYWORD_RULES } = require('../core/emotion-engine');
const { EMOTION_SCHEMA, POSITIONS } = require('../shared/emotion-constants');
const { SAMPLE_NOTIFICATIONS } = require('../shared/sample-notifications');
const { AdapterHub } = require('../adapters');
const { startNotificationServer } = require('./server');

const PORT = 3721;
const ROOT = path.join(__dirname, '../..');

let activateReady = false;
// A second launch only asks the running copy to show its Control Center, then quits. app.quit() is
// asynchronous, so boot() must be skipped explicitly — otherwise the second copy starts its own
// server, hits "port 3721 in use" and shows an error box (seen on Windows).
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
  app.quit();
} else {
  app.on('second-instance', () => openControlCenter());
  // macOS: opening the app again from Finder/Launchpad while it runs fires "activate", not
  // "second-instance" — show the Control Center so the click does something visible.
  // Electron also fires "activate" for the very first launch (e.g. login item) → ignore that one.
  // Clicking the pet or a card button also makes macOS activate the app: that must NOT pop the
  // Control Center up, so ignore activations while / right after the cursor is on the overlay.
  // The click's own IPC can arrive a little AFTER 'activate', so decide a moment later.
  app.on('activate', () => {
    if (!activateReady) return;
    const at = Date.now();
    setTimeout(() => {
      if (overlayCausedActivation(at)) return;
      openControlCenter();
    }, 350);
  });
}

let overlay = null;
let controlWin = null;
let tray = null;
let settings;
let secrets;
let pipeline;
let hub;
let integrations;
let inbox;
let directory;
let chatSources;
const messagingApps = new MessagingApps({
  // Real app icons for the "Người quen" picker (Electron reads them from the .app / .exe).
  // macOS: QuickLook thumbnail of the .app = its real icon (getFileIcon returns the generic bundle icon).
  getIcon: async (p) => {
    let img = null;
    if (process.platform === 'darwin') img = await nativeImage.createThumbnailFromPath(p, { width: 64, height: 64 }).catch(() => null);
    if (!img || img.isEmpty()) img = await app.getFileIcon(p, { size: 'normal' }).catch(() => null);
    return img && !img.isEmpty() ? img.toDataURL() : null;
  }
});
let lastModeKey = '';
let httpServer = null; // our own local server (null when it failed to start, e.g. port in use)
let serverError = null;
const bus = new EventEmitter();
const apiToken = crypto.randomBytes(24).toString('hex');
/**
 * Technical log (never notification content). Also written to userData/logs/main.log, because the
 * installed app has no console — without the file, problems on another machine are invisible.
 */
const LOG_FILE = path.join(app.getPath('userData'), 'logs', 'main.log');
const log = (...a) => {
  console.log('[Main]', ...a);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 1024 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.1');
    const line = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
  } catch { /* logging must never break the app */ }
};

function userPetsDir() { return path.join(app.getPath('userData'), 'pets'); }

function readManifest() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/pet-manifest.json'), 'utf8')); } catch { return { characters: [] }; }
}

function characterList() {
  return (readManifest().characters || []).map(c => ({
    ...c,
    customModel: fs.existsSync(path.join(userPetsDir(), c.id, 'model.glb')),
    bundledModel: fs.existsSync(path.join(ROOT, 'assets/pets', c.id, 'model.glb'))
  }));
}

/* ------------------------------------------------------------------ */
/* Overlay window                                                      */
/* ------------------------------------------------------------------ */

function targetDisplay() {
  const id = settings.get().appearance.displayId;
  return screen.getAllDisplays().find(d => d.id === id) || screen.getPrimaryDisplay();
}

function systemPrefersReducedMotion() {
  try { return !!(systemPreferences.getAnimationSettings && systemPreferences.getAnimationSettings().prefersReducedMotion); } catch { return false; }
}

/** Effective runtime state sent to the overlay: presence, focus mode, reduced motion. */
function effectiveState() {
  const s = settings.get();
  const mode = pipeline ? pipeline.attention.mode() : { id: 'none', source: 'default', motion: 'full', sound: true };
  const pref = s.sounds.reducedMotion;
  const reducedMotion = pref === 'on' || (pref === 'system' && systemPrefersReducedMotion()) || mode.motion === 'reduced';
  const presence = s.system.presence;
  return {
    presence,
    mode: { id: mode.id, source: mode.source, emoji: mode.emoji, petEmotion: mode.petEmotion || null, sound: mode.sound !== false, hidePet: !!mode.hidePet },
    hidden: presence === 'hidden' || !!mode.hidePet,
    reducedMotion
  };
}

function overlayPayload() {
  const s = settings.get();
  return {
    settings: s,
    preset: PERSONALITY_PRESETS[s.personality],
    effective: effectiveState(),
    assetBase: `http://127.0.0.1:${PORT}/assets/`,
    platform: process.platform
  };
}

/** Re-evaluate presence/focus (quiet hours can start on their own) and propagate changes. */
function refreshEffectiveState(force = false) {
  const eff = effectiveState();
  const key = JSON.stringify(eff);
  if (!force && key === lastModeKey) return;
  const wasHidden = lastModeKey ? JSON.parse(lastModeKey).hidden : false;
  lastModeKey = key;
  if (eff.hidden && !wasHidden) {
    // Hidden / Gaming: stop presentation immediately, keep events in the Inbox — including the card
    // that is on screen right now. Critical cards stay (they bypass Hidden, Blueprint §7.1).
    const reason = eff.mode.hidePet ? `mode_${eff.mode.id}` : 'presence_hidden';
    pipeline.flushQueueToInbox(reason);
    const cur = pipeline.current;
    if (cur && cur.priority !== 'critical') {
      if (inbox) inbox.add({ ...cur, reason });
      dismissNativeBanner(cur);
      sendOverlay('notification:dismiss', { reason: 'hidden' });
    }
  }
  sendOverlay('overlay:config', overlayPayload());
  buildTrayMenu();
  bus.emit('event', 'mode', eff);
}

function createOverlay() {
  const { workArea } = targetDisplay();
  overlay = new BrowserWindow({
    ...workArea,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, '../renderer/index.html'));
  overlay.once('ready-to-show', () => overlay.showInactive());
  overlay.webContents.on('did-finish-load', () => { overlay.webContents.send('overlay:config', overlayPayload()); pushBadge(true); });
  overlay.webContents.on('console-message', (_e, _level, message) => console.log(`[Overlay] ${message}`));
  overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlay.webContents.on('will-navigate', (e) => e.preventDefault());
  overlay.on('closed', () => { overlay = null; stopHitTimer(); });
}

function fitOverlayToDisplay() {
  if (overlay && !overlay.isDestroyed()) overlay.setBounds(targetDisplay().workArea);
}

function sendOverlay(channel, data) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send(channel, data);
}

/** Unread Inbox items the pet's badge counts — follows the chat mode (see badgeFilter). */
function badgeUnread() { return inbox.unreadCount(badgeFilter(settings.get())); }

/** Unread counter on the pet (like an app-icon badge): unread Inbox items + cards still queued. */
let lastBadge = -1;
function pushBadge(force = false) {
  if (!inbox || !pipeline) return;
  const count = badgeUnread() + pipeline.queue.length;
  if (!force && count === lastBadge) return;
  lastBadge = count;
  sendOverlay('pet:badge', { count });
}

/* ------------------------------------------------------------------ */
/* Control Center window                                               */
/* ------------------------------------------------------------------ */


/* Mouse capture for the click-through overlay: captured when the renderer asks (pet hover, drag,
   resize) OR the real cursor is inside one of the reported interactive rectangles. */
let rendererWantsMouse = false;
let cursorInRect = false;
let lastCardUse = 0; // last press on a card / card action (buttons must never open the Control Center)
let lastOverlayUse = 0; // last time the cursor was on the pet / a card (see the 'activate' guard)
let hitRects = [];
let dockRect = null; // pet + card area in overlay coordinates (reported by the renderer)
let hitTimer = null;
let overlayIgnoring = true;
function applyMouseCapture() {
  if (!overlay || overlay.isDestroyed()) return;
  const ignore = !(rendererWantsMouse || cursorInRect);
  if (!ignore) lastOverlayUse = Date.now(); // pressing / dragging the pet counts as using the overlay
  if (ignore === overlayIgnoring) return;
  overlayIgnoring = ignore;
  if (ignore) {
    overlay.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlay.setIgnoreMouseEvents(false);
  }
}
function stopHitTimer() {
  if (hitTimer) { clearInterval(hitTimer); hitTimer = null; }
  hitRects = [];
  cursorInRect = false;
  applyMouseCapture();
}
function pollCursor() {
  if (!overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  const p = screen.getCursorScreenPoint();
  const b = overlay.getBounds();
  const x = p.x - b.x, y = p.y - b.y;
  const inside = hitRects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (inside) lastOverlayUse = Date.now();
  if (inside !== cursorInRect) { cursorInRect = inside; applyMouseCapture(); }
}

/** Was this activation just a click on the pet / a card / the badge (not a re-launch of the app)? */
function overlayCausedActivation(at) {
  if (cursorInRect || lastOverlayUse >= at - 3000) return true;
  if (!overlay || overlay.isDestroyed() || !overlay.isVisible() || !dockRect) return false;
  const p = screen.getCursorScreenPoint();
  const b = overlay.getBounds();
  const x = p.x - b.x, y = p.y - b.y, m = 40;
  return x >= dockRect.x - m && x <= dockRect.x + dockRect.w + m && y >= dockRect.y - m && y <= dockRect.y + dockRect.h + m;
}

function quitApp() { setTimeout(() => app.quit(), 150); return { ok: true }; }

/** Control Center URL with a single-use launch ticket (the page carries the API token). */
function controlUrl(section) {
  return httpServer ? httpServer.launchUrl(section ? `#${section}` : '') : null;
}

function showServerError() {
  dialog.showErrorBox('Cute Pet Companion', serverError || L('Máy chủ nội bộ chưa chạy.', 'The local server is not running.'));
}

function openControlCenter(section) {
  // Port 3721 taken by another program: never open (and trust) whatever answers there.
  if (!httpServer) { showServerError(); return; }
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.show();
    controlWin.focus();
    if (section) controlWin.webContents.executeJavaScript(`location.hash = ${JSON.stringify('#' + section)}`).catch(() => {});
    return;
  }
  controlWin = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 980,
    minHeight: 660,
    title: 'Cute Pet Companion — Control Center',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: settings && settings.get().appearance.uiTheme === 'midnight' ? '#17151F' : '#FFF7F2',
    show: false,
    icon: process.platform === 'darwin' ? undefined : APP_ICON,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  controlWin.loadURL(controlUrl(section));
  controlWin.once('ready-to-show', () => controlWin.show());
  controlWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  controlWin.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}/`)) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
    if (!app.isPackaged && fs.existsSync(APP_ICON)) app.dock.setIcon(APP_ICON); // packaged builds use icon.icns
  }
  controlWin.on('closed', () => {
    controlWin = null;
    if (process.platform === 'darwin' && app.dock) app.dock.hide();
  });
}

/* ------------------------------------------------------------------ */
/* Tray                                                                */
/* ------------------------------------------------------------------ */

const APP_ICON = path.join(ROOT, 'assets/icons/icon-512.png');

function trayIcon() {
  // Windows/Linux: colourful Mochi; macOS keeps a monochrome template icon (menu-bar convention).
  if (process.platform !== 'darwin') {
    const p = path.join(ROOT, 'assets/icons/tray-color.png');
    if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#000" d="M12 13c-2.2 0-4 1.8-4 4 0 2.2 1.8 4 4 4s4-1.8 4-4c0-2.2-1.8-4-4-4zm-5.5-2c1.4 0 2.5-1.1 2.5-2.5S7.9 6 6.5 6 4 7.1 4 8.5 5.1 11 6.5 11zm11 0c1.4 0 2.5-1.1 2.5-2.5S18.9 6 17.5 6 15 7.1 15 8.5s1.1 2.5 2.5 2.5zm-8-3c1.4 0 2.5-1.1 2.5-2.5S10.9 3 9.5 3 7 4.1 7 5.5 8.1 8 9.5 8zm5 0c1.4 0 2.5-1.1 2.5-2.5S15.9 3 14.5 3 12 4.1 12 5.5s1.1 2.5 2.5 2.5z"/></svg>`;
  const img = nativeImage.createFromDataURL('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')).resize({ width: 18, height: 18 });
  if (process.platform === 'darwin') img.setTemplateImage(true);
  return img;
}

/** Bilingual label for native menus (tray, context menu, app menu). */
function L(vi, en) { return settings && settings.get().appearance.language === 'en' ? en : vi; }

function buildTrayMenu() {
  if (!tray) return;
  const s = settings.get();
  const posLabels = { 'top-left': 'Trên trái', 'top-center': 'Trên giữa', 'top-right': 'Trên phải', 'middle-left': 'Giữa trái', 'middle-right': 'Giữa phải', 'bottom-left': 'Dưới trái', 'bottom-center': 'Dưới giữa', 'bottom-right': 'Dưới phải' };
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: L('🐾 Mở Control Center', '🐾 Open Control Center'), click: () => openControlCenter() },
    { label: L('🌐 Mở trong trình duyệt', '🌐 Open in browser'), click: () => { const u = controlUrl(); if (u) shell.openExternal(u); else showServerError(); } },
    { type: 'separator' },
    {
      label: L('🎭 Thử 8 cảm xúc', '🎭 Try the 8 emotions'),
      submenu: EMOTION_SCHEMA.map(e => ({ label: `${e.emoji}  ${e.assetKey} — ${e.meaning}`, click: () => testNotify({ emotion: e.id }) }))
    },
    {
      label: L('🪟 Chế độ cầm thẻ', '🪟 Presentation mode'),
      submenu: [['billboard', '🪧 Billboard Hugger'], ['peeker', '👀 Peeker'], ['courier', '✉️ Courier']].map(([id, label]) => ({
        label, type: 'radio', checked: s.notifications.presentationMode === id,
        click: () => updateSettings({ notifications: { presentationMode: id } })
      }))
    },
    {
      label: L('📍 Vị trí', '📍 Position'),
      submenu: POSITIONS.map(p => ({ label: posLabels[p], type: 'radio', checked: s.appearance.position === p, click: () => updateSettings({ appearance: { position: p } }) }))
    },
    { type: 'separator' },
    {
      label: L('👁️ Bé xuất hiện', '👁️ Pet appears'),
      submenu: [
        ['always', L('🐱 Luôn ở bên', '🐱 Always'), { system: { presence: 'full' }, appearance: { residentPet: true } }],
        ['notify', L('🔔 Chỉ khi có thông báo', '🔔 Only with notifications'), { system: { presence: 'full' }, appearance: { residentPet: false } }],
        ['hidden', L('🙈 Ẩn đi', '🙈 Hidden'), { system: { presence: 'hidden' } }]
      ].map(([id, label, patch]) => ({
        label, type: 'radio',
        checked: (s.system.presence === 'hidden' ? 'hidden' : s.appearance.residentPet === false ? 'notify' : 'always') === id,
        click: () => updateSettings(patch)
      }))
    },
    {
      label: `${(FOCUS_MODES[s.system.focusMode] || FOCUS_MODES.none).emoji} ${L('Chế độ tập trung', 'Focus mode')}`,
      submenu: [['none', L('Không (bình thường)', 'None (normal)')], ['work', L('Work — lọc tin giải trí', 'Work — filter entertainment')], ['focus', L('Deep Focus — chỉ tin khẩn', 'Deep Focus — critical only')], ['meeting', L('Meeting — im lặng, chỉ tin quan trọng', 'Meeting — silent, important only')], ['gaming', L('Gaming — ẩn pet, 0% GPU', 'Gaming — hide pet, 0% GPU')], ['relax', L('Relax — mọi tương tác', 'Relax — everything')], ['sleep', L('Sleep — im lặng tuyệt đối', 'Sleep — total silence')]].map(([id, label]) => ({
        label: `${FOCUS_MODES[id].emoji} ${label}`, type: 'radio', checked: s.system.focusMode === id, click: () => updateSettings({ system: { focusMode: id } })
      }))
    },
    { label: `📥 Inbox (${inbox ? inbox.unreadCount() : 0} ${L('chưa đọc', 'unread')})`, click: () => openControlCenter('inbox') },
    { label: L('🌙 Không làm phiền', '🌙 Do Not Disturb'), type: 'checkbox', checked: s.dnd.enabled, click: (i) => updateSettings({ dnd: { enabled: i.checked } }) },
    { label: L('🙈 Ẩn nội dung thông báo (khi chia sẻ màn hình)', '🙈 Hide notification content (screen sharing)'), type: 'checkbox', checked: s.privacy.displayMode !== 'full_content', click: (i) => updateSettings({ privacy: { displayMode: i.checked ? 'source_only' : 'full_content' } }) },
    { type: 'separator' },
    { label: L('⏻ Thoát Cute Pet Companion', '⏻ Quit Cute Pet Companion'), click: () => app.quit() }
  ]));
}

/* ------------------------------------------------------------------ */
/* App bridge                                                          */
/* ------------------------------------------------------------------ */

function updateSettings(patch) {
  const next = settings.update(patch || {});
  return next;
}

function testNotify(body = {}) {
  const emotion = SAMPLE_NOTIFICATIONS[body.emotion] ? body.emotion : 'happy';
  const sample = SAMPLE_NOTIFICATIONS[emotion];
  const r = pipeline.ingest({
    ...sample,
    forceEmotion: emotion,
    presentationMode: body.presentationMode,
    pet: body.pet,
    priority: body.priority
  }, 'test', { bypassDedupe: true, defaults: { deliveryMode: 'manual', provider: 'test' } });
  return { accepted: r.accepted, suppressed: !!r.suppressed, inboxed: !!r.inboxed, reason: r.reason, id: r.item.id, emotion: r.item.emotion, priority: r.item.priority };
}

function getState() {
  const s = settings.get();
  return {
    version: app.getVersion(),
    platform: process.platform,
    port: PORT,
    secureStorage: secrets.available(),
    settings: s,
    presets: PERSONALITY_PRESETS,
    contactGroups: require('../core/chat-filter').CONTACT_GROUPS,
    contactDirectory: directory ? directory.list() : { enabled: true, apps: [], suggestions: [], insights: [] },
    contactAttention: require('../core/contact-rules').CONTACT_ATTENTION,
    chatSources: chatSources ? chatSources.list() : [],
    defaults: { appRules: DEFAULT_APP_RULES, keywordRules: DEFAULT_KEYWORD_RULES },
    emotions: EMOTION_SCHEMA,
    characters: characterList(),
    displays: screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `Màn hình ${i + 1} — ${d.size.width}×${d.size.height}${d.id === screen.getPrimaryDisplay().id ? ' (chính)' : ''}` })),
    adapters: hub.describeAll(),
    integrations: integrations.status(),
    chatNameSuggestion: systemFullName(),
    // What macOS says about THIS app build (the helper reports the same via the adapter).
    appAxTrusted: process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : null,
    install: installInfo(),
    pipeline: pipeline.snapshot(),
    effective: effectiveState(),
    focusModes: FOCUS_MODES,
    priorities: PRIORITIES,
    autoLaunchSupported: process.platform === 'darwin' || process.platform === 'win32'
  };
}

let fullNameCache;
function systemFullName() {
  if (fullNameCache !== undefined) return fullNameCache;
  fullNameCache = '';
  try {
    if (process.platform === 'darwin') fullNameCache = require('child_process').execFileSync('/usr/bin/id', ['-F'], { timeout: 2000 }).toString().trim().slice(0, 40);
  } catch { /* ignore */ }
  return fullNameCache;
}

function applySystemSettings(s) {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      const cur = app.getLoginItemSettings();
      if (cur.openAtLogin !== s.system.autoLaunch) app.setLoginItemSettings({ openAtLogin: s.system.autoLaunch, openAsHidden: true });
    } catch (err) { log('login item error', err.message); }
  }
}

function registerIpc() {
  ipcMain.on('window:set-ignore-mouse-events', (e, ignore) => {
    if (overlay && e.sender === overlay.webContents) { rendererWantsMouse = !ignore; if (!ignore) lastOverlayUse = Date.now(); applyMouseCapture(); }
  });
  // Interactive rectangles (notification cards) in overlay coordinates. The main
  // process hit-tests the real cursor against them, more robust than renderer-only
  // hover tracking (fast moves, nested frames).
  ipcMain.on('overlay:hit-rects', (e, rects) => {
    if (!overlay || e.sender !== overlay.webContents || !Array.isArray(rects)) return;
    hitRects = rects.slice(0, 8).map(r => ({ x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h) }))
      .filter(r => [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0);
    if (hitRects.length && !hitTimer) { hitTimer = setInterval(pollCursor, 33); hitTimer.unref(); }
    if (!hitRects.length && hitTimer) stopHitTimer();
  });
  ipcMain.on('overlay:interaction', (e, onCard) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    lastOverlayUse = Date.now();
    if (onCard === true) lastCardUse = lastOverlayUse;
  });
  ipcMain.on('overlay:dock-rect', (e, r) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    const ok = r && typeof r === 'object' && [r.x, r.y, r.w, r.h].every(Number.isFinite);
    dockRect = ok ? { x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h) } : null;
  });
  ipcMain.on('pet:save-position', (e, pos) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    lastOverlayUse = Date.now();
    if (pos && typeof pos === 'object') {
      settings.update({ appearance: { customPosition: pos } });
    }
  });
  ipcMain.on('notification:action', (e, msg = {}) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    lastOverlayUse = Date.now();
    const { action, id, url, source, externalId } = msg;
    if (!['rendered', 'finished'].includes(action)) lastCardUse = lastOverlayUse; // a button on the card
    if (action === 'click') {
      if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
      if (source) hub.handleAction(source, 'open', externalId);
      // The unread badge counts down: what the user just opened (same app/chat) is read now.
      const opened = (pipeline.current && pipeline.current.id === id) ? pipeline.current : pipeline.history.find(h => h.id === id);
      if (opened && inbox) {
        const masked = (it) => it.privacy && it.privacy !== 'full_content';
        // A grouped card's title is a summary ("3 thông báo mới từ Zalo"): mark each member's chat.
        const parts = opened.group && Array.isArray(opened.members) ? opened.members : [opened];
        for (const m of parts) inbox.markConversationRead(m.app, masked(m) ? null : m.title);
      }
    }
    if (action === 'approve' && source === 'composio' && typeof externalId === 'string') {
      integrations.approvePullRequest(externalId)
        .then((r) => sendOverlay('notification:action-result', { id, action, key: externalId, ...r }))
        .catch((err) => sendOverlay('notification:action-result', { id, action, key: externalId, ok: false, error: err.message }));
      log(`[composio] approve requested ${id}`);
    }
    if (breaks && action === 'break-start') breaks.startBreak();
    if (breaks && action === 'break-snooze') breaks.snooze();
    if (breaks && action === 'close') { const cur = pipeline.current; if (cur && cur.id === id && cur.app === 'wellbeing') breaks.dismiss(); }
    if (action === 'open-url' && typeof url === 'string' && /^https:\/\//.test(url)) shell.openExternal(url);
    if (action === 'finished') {
      // Close the hidden native banner too (alert-style banners would otherwise stay off-screen) —
      // also when this card was already replaced and pipeline.current is a newer one.
      const cur = pipeline.current;
      const done = cur && cur.id === id ? cur : pipeline.history.find(h => h.id === id);
      dismissNativeBanner(done);
      pipeline.finished(id);
    }
    if (action === 'rendered') {
      const at = Number(msg.renderedAt);
      const r = pipeline.markRendered(id, Number.isFinite(at) && at <= Date.now() + 1000 ? at : Date.now());
      if (r) { bus.emit('event', 'latency', r); log(`[latency] ${r.source} desktop→render ${r.desktopToRender}ms, end-to-end ${r.endToEnd ?? '-'}ms`); }
    }
  });
  ipcMain.on('system:battery', (e, info) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    const sys = hub.get('system');
    if (sys && info && typeof info === 'object') sys.reportBattery({ level: Number(info.level), charging: !!info.charging });
  });
  ipcMain.on('overlay:open-control', (e, section) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    // macOS + Windows: the pet's double tap must not fire from clicks on a card (Approve asks for
    // two clicks; Open/Kick/rows sit next to the pet's body). The badge (section 'inbox') is its own button.
    if (section !== 'inbox' && Date.now() - lastCardUse < 1000) { log('[overlay] open-control ignored (card was just clicked)'); return; }
    openControlCenter(section === 'inbox' ? 'inbox' : undefined);
  });
  // Right-click on the pet: always-reachable menu (the tray icon can be hidden behind the MacBook notch).
  // Right-click on a notification card: "Xếp nhóm nhanh" for its sender / group chat.
  ipcMain.on('overlay:context-menu', (e, opts) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    const cardId = opts && typeof opts.cardId === 'string' ? opts.cardId : null;
    if (cardId) {
      const item = (pipeline.current && pipeline.current.id === cardId) ? pipeline.current : pipeline.history.find(h => h.id === cardId);
      const menu = item && quickAssignMenu(item);
      if (menu) { Menu.buildFromTemplate(menu).popup({ window: overlay }); return; }
    }
    const s = settings.get();
    Menu.buildFromTemplate([
      { label: L('🐾 Mở Control Center', '🐾 Open Control Center'), click: () => openControlCenter() },
      { label: `📥 Inbox (${inbox ? inbox.unreadCount() : 0} ${L('chưa đọc', 'unread')})`, click: () => openControlCenter('inbox') },
      { type: 'separator' },
      { label: L('🌙 Không làm phiền', '🌙 Do Not Disturb'), type: 'checkbox', checked: s.dnd.enabled, click: (i) => updateSettings({ dnd: { enabled: i.checked } }) },
      { label: L('🙈 Ẩn nội dung thông báo (khi chia sẻ màn hình)', '🙈 Hide notification content (screen sharing)'), type: 'checkbox', checked: s.privacy.displayMode !== 'full_content', click: (i) => updateSettings({ privacy: { displayMode: i.checked ? 'source_only' : 'full_content' } }) },
      { label: L('🙈 Ẩn thú cưng (mở lại từ Control Center / menu khay)', '🙈 Hide the pet (restore from Control Center / tray)'), click: () => updateSettings({ system: { presence: 'hidden' } }) },
      { type: 'separator' },
      { label: L('⏻ Thoát Cute Pet Companion', '⏻ Quit Cute Pet Companion'), click: () => app.quit() }
    ]).popup({ window: overlay });
  });
}

/** Close the off-screen native banner (macOS AX / Windows) behind a card; once per item. */
const dismissedBanners = new Set();
function dismissNativeBanner(item) {
  if (!item || !item.source || !item.externalId || !hub) return;
  const key = `${item.source}:${item.externalId}`;
  if (dismissedBanners.has(key)) return;
  dismissedBanners.add(key);
  if (dismissedBanners.size > 500) dismissedBanners.delete(dismissedBanners.values().next().value);
  hub.handleAction(item.source, 'dismiss', item.externalId);
}

/* ------------------------------------------------------------------ Familiar contacts: quick assign */

const { fold } = require('../core/chat-filter');
// Same key as the Control Center (ctKey): accent-folded, so "Nhung" and "Nhưng" can't diverge.
const contactKeyOf = (c) => `${c.app || '*'}|${c.kind === 'chat' ? 'chat' : 'person'}|${fold(c.name).trim()}`;

/** Add / change / remove ONE familiar-contact rule (used from the card menu and the Control Center). */
function assignContact({ name, kind, app: appId, group }) {
  const list = [...(settings.get().contacts || [])];
  const entry = { name, kind: kind === 'chat' ? 'chat' : 'person', app: appId || null };
  const i = list.findIndex(c => contactKeyOf(c) === contactKeyOf(entry));
  if (!group) { if (i >= 0) list.splice(i, 1); }
  else if (i >= 0) list[i] = { ...list[i], group, enabled: true, updatedAt: Date.now() };
  else list.push({ ...entry, group, emotion: null, attention: 'auto', enabled: true, createdAt: Date.now(), updatedAt: Date.now() });
  settings.update({ contacts: list });
  log(`[contacts] ${group ? 'set' : 'removed'} ${entry.kind} rule (${entry.app || 'any app'})`);
}

/** Who a card / Inbox item can be classified as: [{ kind: person|chat, name }] (names only). */
function quickTargets(item) {
  const { isChat } = require('../core/chat-filter');
  const { conversationOf } = require('../core/contact-directory');
  if (!item || item.group || !isChat(item) || (item.privacy && item.privacy !== 'full_content')) return [];
  const conv = conversationOf(item);
  if (!conv) return [];
  const out = [];
  if (conv.sender) out.push({ kind: 'person', name: conv.sender });
  if (!conv.direct) out.push({ kind: 'chat', name: conv.chat });
  return out;
}

/** Native menu for a card: "👤 <sender> là…" / "👥 Cả nhóm <chat> là…". Null when nothing can be named. */
function quickAssignMenu(item) {
  const { CONTACT_GROUPS } = require('../core/chat-filter');
  const contacts = settings.get().contacts || [];
  const targets = quickTargets(item).map(t => ({ ...t, label: t.kind === 'chat' ? `👥 ${L('Cả nhóm', 'Whole chat')} “${t.name}” ${L('là…', 'is…')}` : `👤 ${t.name} ${L('là…', 'is…')}` }));
  if (!targets.length) return null;
  const menu = [{ label: L('🐾 Xếp nhóm nhanh', '🐾 Quick classify'), enabled: false }];
  for (const t of targets) {
    const entry = { name: t.name, kind: t.kind, app: item.app };
    const cur = contacts.find(c => contactKeyOf(c) === contactKeyOf(entry));
    menu.push({
      label: t.label.slice(0, 80),
      submenu: [
        ...Object.entries(CONTACT_GROUPS).map(([id, g]) => ({ label: `${g.emoji} ${g.label}`, type: 'radio', checked: !!cur && cur.group === id, click: () => assignContact({ ...entry, group: id }) })),
        { type: 'separator' },
        { label: L('✕ Không phải người quen', '✕ Not a familiar contact'), enabled: !!cur, click: () => assignContact({ ...entry, group: null }) }
      ]
    });
  }
  menu.push({ type: 'separator' }, { label: L('⚙️ Chỉnh chi tiết trong Người quen…', '⚙️ Edit in Familiar contacts…'), click: () => openControlCenter('pet') });
  return menu;
}

async function boot() {
  const dir = app.getPath('userData');
  settings = new SettingsStore(dir);
  // "Nhỏ gọn" (presence=minimal) is no longer offered — it read as a size option. Move it to "Luôn ở bên".
  if (settings.get().system.presence === 'minimal') settings.update({ system: { presence: 'full' } });
  secrets = new SecretStore(dir, safeStorage);
  inbox = new InboxStore(dir, { getSettings: () => settings.get() });
  directory = new ContactDirectory(dir, { getSettings: () => settings.get() });
  // First run with the picker: seed it from chats already waiting in the Inbox (skip masked items).
  if (!directory.chats.length) {
    for (const it of [...inbox.list(200)].reverse()) {
      if (!/•••/.test(it.title || '') && !/^🔒/.test(it.message || '')) directory.learn(it, it.receivedAt || Date.now());
    }
  }
  pipeline = new NotificationPipeline({ getSettings: () => settings.get(), inbox, directory });
  integrations = new IntegrationsManager({ settings, secrets, log, dataDir: dir, openExternal: (u) => shell.openExternal(u), pollSeconds: () => settings.get().integrations.pollSeconds });
  integrations.on('notification', (payload) => {
    const r = pipeline.ingest(payload, 'composio', { defaults: { deliveryMode: 'near_realtime_poll', provider: 'composio' } });
    log(`[composio] ${r.item.id} near_realtime_poll → ${r.item.emotion}/${r.item.priority || '-'} (${r.reason || r.item.matchedBy})`);
  });
  hub = new AdapterHub({
    settings, secrets, log, dataDir: dir,
    // The APP itself must be in the Accessibility list (its helper inherits it); prompting from the
    // main process registers the current, signed app identity.
    promptAccessibility: () => (process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(true) : false),
    appAccessibilityTrusted: () => (process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : false)
  }, { port: PORT, powerMonitor, platform: process.platform });

  chatSources = new ChatSources({ integrations, hub, secrets, settings, dir });

  hub.on('notification', (payload, source, meta) => {
    const r = pipeline.ingest(payload, source, { defaults: meta || {} });
    pushBadge();
    // Technical log only — no notification content (privacy).
    log(`[${source}] ${r.item.id} ${r.item.deliveryMode} → ${r.item.emotion}/${r.item.priority || '-'} (${r.reason || r.item.matchedBy})`);
  });
  hub.on('status', (d) => bus.emit('event', 'adapter', d));

  inbox.on('change', () => pushBadge());
  pipeline.on('display', (item) => {
    sendOverlay('notification:show', item);
    pushBadge();
    bus.emit('event', 'display', { id: item.id, title: item.title, emotion: item.emotion, app: item.app });
  });
  pipeline.on('inbox', (item, decision) => {
    bus.emit('event', 'inbox', { unread: inbox.unreadCount(), item: { id: item.id, title: item.title, app: item.app, priority: item.priority, reason: decision.reason } });
    buildTrayMenu();
  });
  pipeline.on('history', (h) => bus.emit('event', 'history', h));
  pipeline.on('preempted', (prev) => dismissNativeBanner(prev)); // replaced card: its banner too

  settings.on('change', (s) => {
    pushBadge(); // switching the chat mode changes what the badge counts
    refreshEffectiveState(true);
    fitOverlayToDisplay();
    buildTrayMenu();
    applySystemSettings(s);
    bus.emit('event', 'settings', s);
  });

  registerIpc();

  try {
    httpServer = await startNotificationServer({
      port: PORT,
      apiToken,
      userPetsDir: userPetsDir(),
      adapters: hub,
      integrations,
      getState,
      updateSettings,
      resetSettings: () => settings.reset(),
      ingest: (payload, source) => pipeline.ingest(payload, source, { defaults: { deliveryMode: 'realtime_push', provider: 'webhook' } }),
      previewClassify: (payload) => pipeline.preview(payload),
      testNotify,
      webhookEnabled: () => hub.get('webhook').enabledForIngest,
      getWebhookSecret: () => secrets.get('webhook.secret'),
      clearHistory: () => pipeline.clearHistory(),
      inbox: {
        list: () => ({ unread: inbox.unreadCount(), items: inbox.list(200).map(it => { const who = quickTargets(it); return who.length ? { ...it, who } : it; }), digest: inbox.digest() }),
        markRead: (id) => { inbox.markRead(id); buildTrayMenu(); },
        remove: (id) => { inbox.remove(id); buildTrayMenu(); },
        clear: () => { inbox.clear(); buildTrayMenu(); }
      },
      clearQueue: () => pipeline.clearQueue(),
      contactDirectory: { list: () => directory.list(), clear: () => { directory.clear(); chatSources.clearCache(); } },
      chatSources,
      messagingApps,
      quit: quitApp,
      isKnownPet: (id) => characterList().some(c => c.id === id),
      onModelChanged: (id) => { sendOverlay('model:changed', { id }); bus.emit('event', 'characters', characterList()); },
      onEvent: (fn) => bus.on('event', fn)
    });
  } catch (err) {
    const msg = err.code === 'EADDRINUSE'
      ? `Cổng ${PORT} đang được ứng dụng khác sử dụng. Hãy tắt ứng dụng đó (hoặc phiên bản cũ của Cute Pet) rồi mở lại.`
      : err.message;
    dialog.showErrorBox('Cute Pet Companion', msg);
    serverError = msg;
  }

  createOverlay();
  tray = new Tray(trayIcon());
  tray.setToolTip('Cute Pet Companion');
  buildTrayMenu();
  applySystemSettings(settings.get());

  await hub.startEnabled();
  integrations.start();
  breaks = new BreakReminder({
    getSettings: () => settings.get(),
    getIdleSeconds: () => { try { return powerMonitor.getSystemIdleTime(); } catch { return 0; } },
    getModeId: () => pipeline.attention.mode().id
  });
  breaks.on('remind', ({ usedMinutes, breakMinutes }) => {
    pipeline.ingest({
      title: L(`Bạn đã nhìn màn hình ${usedMinutes} phút rồi 👀`, `You’ve been looking at the screen for ${usedMinutes} min 👀`),
      message: L(`Cho mắt nghỉ ${breakMinutes} phút nhé: nhìn ra xa khoảng 6 m, chớp mắt vài lần, đứng dậy vươn vai một chút.`, `Give your eyes ${breakMinutes} minutes: look ~6 m away, blink a few times, stand up and stretch.`),
      app: 'wellbeing', appName: L('Sức khỏe', 'Wellbeing'), forceEmotion: 'love', priority: 'important', duration: 45000,
      actions: ['break-start', 'break-snooze'], sourceEventId: `break:${Date.now()}`
    }, 'wellbeing', { bypassDedupe: true, defaults: { deliveryMode: 'native_os', provider: 'wellbeing' } });
  });
  breaks.on('break', ({ minutes }) => sendOverlay('break:start', { minutes }));
  powerMonitor.on('lock-screen', () => breaks.rested());
  powerMonitor.on('suspend', () => breaks.rested());
  breaks.start();
  if (!app.isPackaged && process.env.CPC_DEV_HOOKS === '1') global.__cpcDev = { settings, integrations, pipeline, get breaks() { return breaks; }, mouse: () => ({ hitRects, cursorInRect, overlayIgnoring, rendererWantsMouse }) }; // dev-only test hook
  if (serverError) hub.get('webhook').markServerError(serverError);
  else if (!settings.get().adapters.webhook.enabled) hub.get('webhook').setStatus('Disconnected', 'Đang từ chối POST /notify');

  // Quiet hours can begin without any user action → re-evaluate periodically.
  setInterval(() => refreshEffectiveState(), 30 * 1000).unref();

  const recoverOverlay = () => {
    if (!overlay || overlay.isDestroyed()) return;
    fitOverlayToDisplay();
    if (process.platform === 'darwin') {
      overlay.setAlwaysOnTop(true, 'screen-saver');
    } else {
      overlay.setAlwaysOnTop(true);
    }
    overlayIgnoring = true;
    rendererWantsMouse = false;
    cursorInRect = false;
    overlay.setIgnoreMouseEvents(true, { forward: true });
    sendOverlay('app:resumed', {});
  };

  powerMonitor.on('resume', () => {
    if (breaks) breaks.rested();
    recoverOverlay();
  });
  powerMonitor.on('unlock-screen', () => {
    recoverOverlay();
  });
  refreshEffectiveState(true);

  screen.on('display-metrics-changed', recoverOverlay);
  screen.on('display-added', recoverOverlay);
  screen.on('display-removed', recoverOverlay);

  checkMacInstall();
  setTimeout(() => { activateReady = true; }, 3000);

  // First run: greet & open Control Center so new users see where everything is.
  const firstRunFlag = path.join(app.getPath('userData'), '.welcomed');
  if (!fs.existsSync(firstRunFlag)) {
    fs.writeFileSync(firstRunFlag, String(Date.now()));
    setTimeout(() => {
      pipeline.ingest({ title: 'Mèo Mochi chào sen! 🐾', message: 'Mình sẽ mang thông báo tới cho bạn. Mở Control Center từ icon dấu chân trên thanh menu nhé!', app: 'default', forceEmotion: 'love', priority: 'important' }, 'system', { bypassDedupe: true, defaults: { deliveryMode: 'native_os' } });
      if (httpServer) openControlCenter();
    }, 1500);
  }
}

/**
 * macOS install sanity checks (packaged builds only):
 *  • Intel build on an Apple-chip Mac runs under Rosetta → 3D animation stutters badly
 *    (measured: 2–5 s main-thread stalls). Tell the user to install the "-arm64" DMG.
 *  • Running straight from the DMG / Downloads → offer to move into Applications
 *    (stable path for permissions and updates).
 */
function installInfo() {
  if (process.platform !== 'darwin' || !app.isPackaged) return { rosetta: false, inApplications: true };
  let inApplications = true;
  try { inApplications = app.isInApplicationsFolder(); } catch { /* ignore */ }
  return { rosetta: !!app.runningUnderARM64Translation, inApplications };
}

async function checkMacInstall() {
  const info = installInfo();
  if (info.rosetta) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Cute Pet Companion',
      message: L('Bạn đang dùng bản cho Mac Intel trên máy chip Apple', 'You are running the Intel build on an Apple-chip Mac'),
      detail: L(
        'macOS phải dịch app qua Rosetta nên hoạt họa của bé sẽ chậm và giật.\n\nHãy tải và cài file có đuôi "-arm64.dmg" (dành cho chip Apple M1/M2/M3/M4), rồi xoá bản này.',
        'macOS translates the app through Rosetta, so the pet\'s animation will be slow and choppy.\n\nPlease download and install the file ending in "-arm64.dmg" (for Apple M1/M2/M3/M4), then delete this copy.'
      ),
      buttons: [L('Đã hiểu', 'OK')]
    }).catch(() => {});
  }
  if (!info.inApplications) {
    const r = await dialog.showMessageBox({
      type: 'question',
      title: 'Cute Pet Companion',
      message: L('Chuyển app vào thư mục Applications?', 'Move the app to the Applications folder?'),
      detail: L(
        'App đang chạy từ file cài đặt hoặc thư mục Tải về. Chuyển vào Applications để quyền Trợ năng và các bản cập nhật hoạt động ổn định.',
        'The app is running from the installer or Downloads. Moving it to Applications keeps permissions and updates working reliably.'
      ),
      buttons: [L('Chuyển vào Applications', 'Move to Applications'), L('Để sau', 'Not now')],
      defaultId: 0, cancelId: 1
    }).catch(() => ({ response: 1 }));
    if (r.response === 0) {
      try { app.moveToApplicationsFolder(); } catch (err) { console.error('[Main] move to Applications failed:', err && err.message); }
    }
  }
}

if (process.platform === 'darwin' && app.dock) app.dock.hide();

app.whenReady().then(() => {
  if (!isPrimaryInstance) return;
  try { app.setAboutPanelOptions({ applicationName: 'Cute Pet Companion', applicationVersion: app.getVersion(), iconPath: APP_ICON, credits: 'Mèo Mochi · Chó Boba · Thỏ Cloud · Penguin Pip' }); } catch { /* optional */ }
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Cute Pet Companion', submenu: [{ role: 'about' }, { type: 'separator' }, { label: L('⏻ Thoát Cute Pet Companion', '⏻ Quit Cute Pet Companion'), accelerator: 'Cmd+Q', click: () => app.quit() }] },
      { role: 'editMenu' },
      { role: 'windowMenu' }
    ]));
  }
  boot().catch((err) => {
    log('boot failed', err && err.stack ? err.stack : String(err));
    dialog.showErrorBox('Cute Pet Companion', `${L('Không khởi động được', 'Failed to start')}: ${err && err.message}`);
    app.quit();
  });
});

let quitting = false;
app.on('before-quit', () => {
  if (quitting) return; // before-quit can fire more than once
  quitting = true;
  if (breaks) breaks.stop();
  if (integrations) { try { integrations.stop(); } catch { /* ignore */ } }
  stopHitTimer();
  if (!hub) return;
  // Windows: turn native banners back on synchronously — the async path could be cut off by exit.
  // shutdownSync marks the adapter so stopAll() below doesn't start a second, async restore.
  const win = hub.get('windows_nc');
  if (win && win.shutdownSync) win.shutdownSync();
  hub.stopAll();
});
app.on('window-all-closed', (e) => { e.preventDefault(); /* tray app keeps running */ });
