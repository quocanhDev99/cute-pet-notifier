/**
 * Electron harness for test/overlay-layout.test.js: loads the REAL overlay page with the real preload
 * in a hidden window, applies a saved pet position, shows notification cards, and prints the measured
 * card / pet boxes as JSON lines. (The main process is replaced by the minimal IPC the page needs.)
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { DEFAULT_SETTINGS } = require(path.join(ROOT, 'src/core/settings-store'));
const { PERSONALITY_PRESETS } = require(path.join(ROOT, 'src/core/emotion-engine'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log(JSON.stringify({ error: 'timeout' })); app.exit(1); }, 120000);
app.commandLine.appendSwitch('force-device-scale-factor', '1');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { preload: path.join(ROOT, 'src/preload/preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  for (const ch of ['notification:action', 'overlay:hit-rects', 'overlay:dock-rect', 'overlay:interaction', 'window:set-ignore-mouse-events', 'pet:save-position']) ipcMain.on(ch, () => {});
  await win.loadFile(path.join(ROOT, 'src/renderer/index.html'));
  const measure = () => win.webContents.executeJavaScript(`(() => {
    const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
    return JSON.stringify({ card: R(document.querySelector('.card')), pet: R(document.querySelector('.pet-slot')) });
  })()`).then(JSON.parse);
  const cases = [];
  for (const mode of ['billboard', 'peeker', 'courier']) {
    for (const [side, pos] of [['right', { x: 1150, y: 600 }], ['left', { x: 100, y: 600 }]]) cases.push({ mode, side, pos });
  }
  for (const c of cases) {
    const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    s.appearance.customPosition = c.pos;
    s.notifications.presentationMode = c.mode;
    win.webContents.send('overlay:config', { settings: s, preset: PERSONALITY_PRESETS[s.personality], effective: { presence: 'full', mode: { id: 'none' }, hidden: false, reducedMotion: false }, assetBase: 'http://127.0.0.1:1/', platform: process.platform });
    await sleep(600);
    const card = (id) => ({ id, app: 'teams', title: 'Kieu Nguyen @mentioned you', message: 'de c assign', emotion: 'happy', priority: 'important', duration: 20000, presentationMode: c.mode });
    win.webContents.send('notification:show', card(`${c.mode}-${c.side}-1`));
    await sleep(200); // a second card replaces the first one mid-animation (Courier run-in, card pop)
    win.webContents.send('notification:show', card(`${c.mode}-${c.side}-2`));
    await sleep(1600);
    console.log(JSON.stringify({ ...c, ...(await measure()) }));
    win.webContents.send('notification:dismiss', {});
    await sleep(1200);
  }
  app.quit();
});
