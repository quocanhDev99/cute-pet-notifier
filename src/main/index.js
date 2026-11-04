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
const { NotificationPipeline } = require('../core/notification-pipeline');
const { InboxStore } = require('../core/inbox-store');
const { FOCUS_MODES, PRIORITIES } = require('../core/attention-engine');
const { PERSONALITY_PRESETS, DEFAULT_APP_RULES, DEFAULT_KEYWORD_RULES } = require('../core/emotion-engine');
const { EMOTION_SCHEMA, POSITIONS } = require('../shared/emotion-constants');
const { SAMPLE_NOTIFICATIONS } = require('../shared/sample-notifications');
const { AdapterHub } = require('../adapters');
const { startNotificationServer } = require('./server');

const PORT = 3721;
const ROOT = path.join(__dirname, '../..');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => openControlCenter());
}

let overlay = null;
let controlWin = null;
let tray = null;
let settings;
let secrets;
let pipeline;
let hub;
let inbox;
let lastModeKey = '';
const bus = new EventEmitter();
const apiToken = crypto.randomBytes(24).toString('hex');
const log = (...a) => console.log('[Main]', ...a);

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
    // Hidden / Gaming: stop presentation immediately, keep events in the Inbox.
    pipeline.flushQueueToInbox(eff.mode.hidePet ? `mode_${eff.mode.id}` : 'presence_hidden');
    sendOverlay('notification:dismiss', { reason: 'hidden' });
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
  overlay.webContents.on('did-finish-load', () => overlay.webContents.send('overlay:config', overlayPayload()));
  overlay.webContents.on('console-message', (_e, _level, message) => console.log(`[Overlay] ${message}`));
  overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlay.webContents.on('will-navigate', (e) => e.preventDefault());
  overlay.on('closed', () => { overlay = null; });
}

function fitOverlayToDisplay() {
  if (overlay && !overlay.isDestroyed()) overlay.setBounds(targetDisplay().workArea);
}

function sendOverlay(channel, data) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send(channel, data);
}

/* ------------------------------------------------------------------ */
/* Control Center window                                               */
/* ------------------------------------------------------------------ */

function quitApp() { setTimeout(() => app.quit(), 150); return { ok: true }; }

function openControlCenter(section) {
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
    backgroundColor: '#FFF7F2',
    show: false,
    icon: process.platform === 'darwin' ? undefined : APP_ICON,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  controlWin.loadURL(`http://127.0.0.1:${PORT}/${section ? '#' + section : ''}`);
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
    { label: L('🌐 Mở trong trình duyệt', '🌐 Open in browser'), click: () => shell.openExternal(`http://127.0.0.1:${PORT}`) },
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
      label: `${L('👁️ Hiện diện', '👁️ Presence')}: ${(L('vi', 'en') === 'en' ? { full: 'Full', minimal: 'Minimal', hidden: 'Hidden' } : { full: 'Đầy đủ', minimal: 'Tối giản', hidden: 'Ẩn' })[s.system.presence]}`,
      submenu: [['full', L('🐱 Đầy đủ (Full)', '🐱 Full')], ['minimal', L('🐾 Tối giản (Minimal)', '🐾 Minimal')], ['hidden', L('🙈 Ẩn hoàn toàn (Hidden)', '🙈 Hidden')]].map(([id, label]) => ({
        label, type: 'radio', checked: s.system.presence === id, click: () => updateSettings({ system: { presence: id } })
      }))
    },
    {
      label: `${(FOCUS_MODES[s.system.focusMode] || FOCUS_MODES.none).emoji} ${L('Chế độ tập trung', 'Focus mode')}`,
      submenu: [['none', L('Không (bình thường)', 'None (normal)')], ['work', L('Work — lọc tin giải trí', 'Work — filter entertainment')], ['focus', L('Deep Focus — chỉ tin khẩn', 'Deep Focus — critical only')], ['meeting', L('Meeting — im lặng, chỉ tin quan trọng', 'Meeting — silent, important only')], ['gaming', L('Gaming — ẩn pet, 0% GPU', 'Gaming — hide pet, 0% GPU')], ['relax', L('Relax — mọi tương tác', 'Relax — everything')], ['sleep', L('Sleep — im lặng tuyệt đối', 'Sleep — total silence')]].map(([id, label]) => ({
        label: `${FOCUS_MODES[id].emoji} ${label}`, type: 'radio', checked: s.system.focusMode === id, click: () => updateSettings({ system: { focusMode: id } })
      }))
    },
    { label: `📥 Inbox (${inbox ? inbox.unreadCount() : 0} ${L('chưa đọc', 'unread')})`, click: () => openControlCenter('attention') },
    { label: L('🌙 Không làm phiền', '🌙 Do Not Disturb'), type: 'checkbox', checked: s.dnd.enabled, click: (i) => updateSettings({ dnd: { enabled: i.checked } }) },
    { label: L('🐱 Thú cưng thường trú trên màn hình', '🐱 Keep the pet on screen'), type: 'checkbox', checked: s.appearance.residentPet, click: (i) => updateSettings({ appearance: { residentPet: i.checked } }) },
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
    defaults: { appRules: DEFAULT_APP_RULES, keywordRules: DEFAULT_KEYWORD_RULES },
    emotions: EMOTION_SCHEMA,
    characters: characterList(),
    displays: screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `Màn hình ${i + 1} — ${d.size.width}×${d.size.height}${d.id === screen.getPrimaryDisplay().id ? ' (chính)' : ''}` })),
    adapters: hub.describeAll(),
    pipeline: pipeline.snapshot(),
    effective: effectiveState(),
    focusModes: FOCUS_MODES,
    priorities: PRIORITIES,
    autoLaunchSupported: process.platform === 'darwin' || process.platform === 'win32'
  };
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
    if (overlay && e.sender === overlay.webContents) overlay.setIgnoreMouseEvents(!!ignore, { forward: true });
  });
  ipcMain.on('pet:save-position', (e, pos) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    if (pos && typeof pos === 'object') {
      settings.update({ appearance: { customPosition: pos } });
    }
  });
  ipcMain.on('notification:action', (e, msg = {}) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    const { action, id, url, source, externalId } = msg;
    if (action === 'click') {
      if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
      if (source) hub.handleAction(source, 'open', externalId);
    }
    if (action === 'finished') {
      // Close the hidden native banner too (alert-style banners would otherwise stay off-screen).
      const cur = pipeline.current;
      if (cur && cur.id === id && cur.source && cur.externalId) hub.handleAction(cur.source, 'dismiss', cur.externalId);
      pipeline.finished(id);
    }
    if (action === 'rendered') {
      const at = Number(msg.renderedAt);
      const r = pipeline.markRendered(id, Number.isFinite(at) && at <= Date.now() + 1000 ? at : Date.now());
      if (r) bus.emit('event', 'latency', r);
    }
  });
  ipcMain.on('system:battery', (e, info) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    const sys = hub.get('system');
    if (sys && info && typeof info === 'object') sys.reportBattery({ level: Number(info.level), charging: !!info.charging });
  });
  ipcMain.on('overlay:open-control', (e) => { if (overlay && e.sender === overlay.webContents) openControlCenter(); });
  // Right-click on the pet: always-reachable menu (the tray icon can be hidden behind the MacBook notch).
  ipcMain.on('overlay:context-menu', (e) => {
    if (!overlay || e.sender !== overlay.webContents) return;
    const s = settings.get();
    Menu.buildFromTemplate([
      { label: L('🐾 Mở Control Center', '🐾 Open Control Center'), click: () => openControlCenter() },
      { label: `📥 Inbox (${inbox ? inbox.unreadCount() : 0} ${L('chưa đọc', 'unread')})`, click: () => openControlCenter('attention') },
      { type: 'separator' },
      { label: L('🌙 Không làm phiền', '🌙 Do Not Disturb'), type: 'checkbox', checked: s.dnd.enabled, click: (i) => updateSettings({ dnd: { enabled: i.checked } }) },
      { label: L('🙈 Ẩn thú cưng (mở lại từ Control Center / menu khay)', '🙈 Hide the pet (restore from Control Center / tray)'), click: () => updateSettings({ system: { presence: 'hidden' } }) },
      { type: 'separator' },
      { label: L('⏻ Thoát Cute Pet Companion', '⏻ Quit Cute Pet Companion'), click: () => app.quit() }
    ]).popup({ window: overlay });
  });
}

async function boot() {
  const dir = app.getPath('userData');
  settings = new SettingsStore(dir);
  secrets = new SecretStore(dir, safeStorage);
  inbox = new InboxStore(dir, { getSettings: () => settings.get() });
  pipeline = new NotificationPipeline({ getSettings: () => settings.get(), inbox });
  hub = new AdapterHub({ settings, secrets, log, dataDir: dir }, { port: PORT, powerMonitor, platform: process.platform });

  hub.on('notification', (payload, source, meta) => {
    const r = pipeline.ingest(payload, source, { defaults: meta || {} });
    // Technical log only — no notification content (privacy).
    log(`[${source}] ${r.item.id} ${r.item.deliveryMode} → ${r.item.emotion}/${r.item.priority || '-'} (${r.reason || r.item.matchedBy})`);
  });
  hub.on('status', (d) => bus.emit('event', 'adapter', d));

  pipeline.on('display', (item) => {
    sendOverlay('notification:show', item);
    bus.emit('event', 'display', { id: item.id, title: item.title, emotion: item.emotion, app: item.app });
  });
  pipeline.on('inbox', (item, decision) => {
    bus.emit('event', 'inbox', { unread: inbox.unreadCount(), item: { id: item.id, title: item.title, app: item.app, priority: item.priority, reason: decision.reason } });
    buildTrayMenu();
  });
  pipeline.on('history', (h) => bus.emit('event', 'history', h));

  settings.on('change', (s) => {
    refreshEffectiveState(true);
    fitOverlayToDisplay();
    buildTrayMenu();
    applySystemSettings(s);
    bus.emit('event', 'settings', s);
  });

  registerIpc();

  let serverError = null;
  try {
    await startNotificationServer({
      port: PORT,
      apiToken,
      userPetsDir: userPetsDir(),
      adapters: hub,
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
        list: () => ({ unread: inbox.unreadCount(), items: inbox.list(200), digest: inbox.digest() }),
        markRead: (id) => { inbox.markRead(id); buildTrayMenu(); },
        remove: (id) => { inbox.remove(id); buildTrayMenu(); },
        clear: () => { inbox.clear(); buildTrayMenu(); }
      },
      clearQueue: () => pipeline.clearQueue(),
      quit: quitApp,
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
  if (serverError) hub.get('webhook').markServerError(serverError);
  else if (!settings.get().adapters.webhook.enabled) hub.get('webhook').setStatus('Disconnected', 'Đang từ chối POST /notify');

  // Quiet hours can begin without any user action → re-evaluate periodically.
  setInterval(() => refreshEffectiveState(), 30 * 1000).unref();
  powerMonitor.on('resume', () => sendOverlay('app:resumed', {}));
  refreshEffectiveState(true);

  screen.on('display-metrics-changed', fitOverlayToDisplay);
  screen.on('display-added', fitOverlayToDisplay);
  screen.on('display-removed', fitOverlayToDisplay);

  // First run: greet & open Control Center so new users see where everything is.
  const firstRunFlag = path.join(app.getPath('userData'), '.welcomed');
  if (!fs.existsSync(firstRunFlag)) {
    fs.writeFileSync(firstRunFlag, String(Date.now()));
    setTimeout(() => {
      pipeline.ingest({ title: 'Mèo Mochi chào sen! 🐾', message: 'Mình sẽ mang thông báo tới cho bạn. Mở Control Center từ icon dấu chân trên thanh menu nhé!', app: 'default', forceEmotion: 'love', priority: 'important' }, 'system', { bypassDedupe: true, defaults: { deliveryMode: 'native_os' } });
      openControlCenter();
    }, 1500);
  }
}

if (process.platform === 'darwin' && app.dock) app.dock.hide();

app.whenReady().then(() => {
  try { app.setAboutPanelOptions({ applicationName: 'Cute Pet Companion', applicationVersion: app.getVersion(), iconPath: APP_ICON, credits: 'Mèo Mochi · Chó Boba · Thỏ Cloud · Penguin Pip' }); } catch { /* optional */ }
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Cute Pet Companion', submenu: [{ role: 'about' }, { type: 'separator' }, { label: L('⏻ Thoát Cute Pet Companion', '⏻ Quit Cute Pet Companion'), accelerator: 'Cmd+Q', click: () => app.quit() }] },
      { role: 'editMenu' },
      { role: 'windowMenu' }
    ]));
  }
  boot();
});

app.on('before-quit', () => { if (hub) hub.stopAll(); });
app.on('window-all-closed', (e) => { e.preventDefault(); /* tray app keeps running */ });
