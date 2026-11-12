/**
 * Electron harness for test/overlay.e2e.test.js — drives the REAL overlay page (renderer bundle +
 * preload) in a hidden window through the scenarios users actually hit, and prints one JSON line
 * per check. The main process is replaced by the IPC the page needs; saving the pet's position
 * re-sends the config exactly like the app's main process does.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { DEFAULT_SETTINGS } = require(path.join(ROOT, 'src/core/settings-store'));
const { PERSONALITY_PRESETS } = require(path.join(ROOT, 'src/core/emotion-engine'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const out = (o) => process.stdout.write('@@' + JSON.stringify(o) + '\n');
setTimeout(() => { out({ error: 'timeout' }); app.exit(1); }, 200000);
app.commandLine.appendSwitch('force-device-scale-factor', '1');

app.whenReady().then(() => run().catch((err) => { out({ error: err.message }); app.exit(1); }));

async function run() {
  const win = new BrowserWindow({ width: 1440, height: 900, useContentSize: true, show: false, webPreferences: { preload: path.join(ROOT, 'src/preload/preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  const log = { open: 0, actions: [], errors: [], saved: null };
  for (const ch of ['overlay:hit-rects', 'overlay:dock-rect', 'overlay:interaction', 'window:set-ignore-mouse-events']) ipcMain.on(ch, () => {});
  ipcMain.on('overlay:open-control', () => { log.open++; });
  ipcMain.on('notification:action', (_e, m) => log.actions.push(m && m.action));
  win.webContents.on('console-message', (_e, level, msg) => {
    // Asset fetches are blocked on purpose (no server): only real script errors count.
    if (/Content Security Policy|Refused to connect|Failed to fetch|ERR_/.test(msg)) return;
    if (level >= 3 || /frame error|Uncaught|is not defined|TypeError/.test(msg)) log.errors.push(String(msg).slice(0, 200));
  });

  await win.loadFile(path.join(ROOT, 'src/renderer/index.html'));

  let s;
  const sendConfig = () => win.webContents.send('overlay:config', { settings: JSON.parse(JSON.stringify(s)), preset: PERSONALITY_PRESETS[s.personality], effective: { presence: 'full', mode: { id: 'none' }, hidden: false, reducedMotion: false }, assetBase: 'http://127.0.0.1:1/', platform: process.platform });
  ipcMain.on('pet:save-position', (_e, p) => { log.saved = p; s.appearance.customPosition = p; sendConfig(); });
  const setup = async (patch) => {
    step = JSON.stringify(patch);
    s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    s.appearance.customPosition = patch.pos || null;
    s.notifications.presentationMode = patch.mode || 'billboard';
    if (patch.size) s.notifications.size = patch.size;
    sendConfig();
    await sleep(500);
  };
  // Every page call fails loudly instead of hanging the whole run.
  let step = 'start';
  const js = (code) => Promise.race([
    win.webContents.executeJavaScript(code),
    sleep(8000).then(() => { throw new Error(`page did not answer during "${step}"`); })
  ]);
  const measure = () => js(`(() => {
    const R = (el) => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
    // The pet's real drawn body / head (3D model projected to the screen), in page coordinates.
    const sr = document.querySelector('.pet-stage').getBoundingClientRect(), d = window.__cpcDiagnostics || {};
    const P = (b) => b ? { l: Math.round(sr.left + b.l), t: Math.round(sr.top + b.t), r: Math.round(sr.left + b.r), b: Math.round(sr.top + b.b) } : null;
    return JSON.stringify({ card: R(document.querySelector('.card')), pet: R(document.querySelector('.pet-slot')), badge: R(document.querySelector('.pet-badge')),
      body: P(d.bodyBox && d.bodyBox()), head: P(d.headBox && d.headBox()) });
  })()`).then(JSON.parse);
  /** Optional screenshots for a human to look at (SNAP_DIR=…): measurements can't judge looks. */
  const snap = async (name) => {
    if (!process.env.SNAP_DIR) return;
    const img = await win.webContents.capturePage();
    require('fs').writeFileSync(path.join(process.env.SNAP_DIR, `${name}.png`), img.toPNG());
  };
  const card = (id, extra = {}) => ({ id, app: 'teams', title: 'Kieu Nguyen @mentioned you', message: 'de c assign', emotion: 'happy', priority: 'important', duration: 30000, presentationMode: s.notifications.presentationMode, ...extra });
  const show = async (item, wait = 1200) => { win.webContents.send('notification:show', item); await sleep(wait); };
  const dismiss = async () => { win.webContents.send('notification:dismiss', {}); await sleep(900); };
  /** Real pointer events on the pet's body: press, move in `steps` (optionally zig-zag = shake), release. */
  const drag = (dx, dy, { steps = 20, stepMs = 16, holdMs = 0, shake = false, clickAfter = false } = {}) => js(`(async () => {
    const r = document.querySelector('.pet-slot').getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height * 0.55;
    const ev = (type, x, y) => document.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, bubbles: true }));
    ev('pointerdown', x, y);
    for (let i = 1; i <= ${steps}; i++) {
      await new Promise(r => setTimeout(r, ${stepMs}));
      const wob = ${shake} ? (i % 2 ? 60 : -60) : 0;
      ev('pointermove', x + ${dx} * i / ${steps} + wob, y + ${dy} * i / ${steps});
    }
    if (${shake}) ev('pointermove', x + ${dx}, y + ${dy});
    await new Promise(r => setTimeout(r, ${holdMs}));
    ev('pointerup', x + ${dx}, y + ${dy});
    ${clickAfter} ? document.documentElement.dispatchEvent(new MouseEvent('click', { clientX: x + ${dx}, clientY: y + ${dy}, bubbles: true, cancelable: true })) : 0;
    return JSON.stringify({ petLeft: Math.round(r.left + ${dx}), petTop: Math.round(r.top + ${dy}) });
  })()`).then(JSON.parse);
  /** Press + click `times` on an element (or on the pet's body when selector is null). */
  const clickAt = (selector, times, gapMs) => js(`(async () => {
    for (let i = 0; i < ${times}; i++) {
      const el = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'null'};
      const pr = document.querySelector('.pet-slot').getBoundingClientRect();
      const r = el ? el.getBoundingClientRect() : { left: pr.left + pr.width * 0.4, top: pr.top + pr.height * 0.6, width: pr.width * 0.2, height: 2 };
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const target = document.elementFromPoint(x, y) || document.body;
      const o = { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, composed: true };
      target.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1, pointerId: 2 }));
      target.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0, pointerId: 2 }));
      target.dispatchEvent(new MouseEvent('click', o));
      await new Promise(r => setTimeout(r, ${gapMs}));
    }
  })()`);

  // 1. Card placement: every presentation mode × both screen sides × pet sizes, with a second card
  //    replacing the first one mid-animation; then the card closes.
  for (const mode of ['billboard', 'peeker', 'courier']) {
    for (const [side, pos] of [['right', { x: 1150, y: 600 }], ['left', { x: 100, y: 600 }]]) {
      for (const size of ['sm', 'lg']) { // the smallest and the largest pet bracket 'md'
        await setup({ mode, pos, size });
        await show(card(`${mode}-${side}-${size}-1`), 200);
        await show(card(`${mode}-${side}-${size}-2`));
        // The pet keeps moving (breathing, arms): sample its body a few times.
        const m = await measure();
        const bodies = [m.body];
        for (let i = 0; i < 6; i++) { await sleep(110); bodies.push((await measure()).body); }
        out({ check: 'card-placement', mode, side, size, pos, ...m, bodies });
        await snap(`card-${mode}-${side}-${size}`);
        await dismiss();
        out({ check: 'after-card-closes', mode, side, size, pos, ...(await measure()) });
      }
    }
  }

  // 2. Drag & drop: slow (hand stops), brisk, very fast, and shaking — the pet stays where it is let
  //    go, and a card shown afterwards doesn't move it.
  for (const [kind, opts] of [['slow', { holdMs: 300, clickAfter: true }], ['brisk', { clickAfter: true }], ['very-fast', { steps: 8, stepMs: 10 }], ['shake', { steps: 24, shake: true }]]) {
    for (const mode of ['billboard', 'courier']) {
      await setup({ mode, pos: { x: 1150, y: 600 } });
      log.saved = null;
      const release = await drag(-300, -150, opts);
      await sleep(900);
      const afterDrop = await measure();
      await show(card(`drag-${kind}-${mode}`));
      out({ check: 'drag-drop', kind, mode, release, saved: log.saved, afterDrop, withCard: await measure() });
      await dismiss();
    }
  }

  // 3. Unread badge: beside the pet's head, inside the pet's box — at rest and while a card shows.
  for (const size of ['sm', 'md', 'lg']) {
    await setup({ pos: { x: 1150, y: 600 }, size });
    win.webContents.send('pet:badge', { count: 76 });
    await sleep(900);
    out({ check: 'badge', size, state: 'rest', ...(await measure()) });
    await snap(`badge-${size}`);
    await show(card(`badge-${size}`));
    out({ check: 'badge', size, state: 'card', ...(await measure()) });
    await dismiss();
    win.webContents.send('pet:badge', { count: 0 });
  }

  // 4. Card buttons never open the Control Center (Approve needs two clicks); a real double tap on
  //    the pet's body still does.
  await setup({ mode: 'billboard', pos: { x: 1150, y: 600 } });
  log.open = 0; log.actions = [];
  await show(card('approve-1', { source: 'composio', app: 'bitbucket', actions: ['approve'], externalId: 'x' }));
  await clickAt('.card footer .approve', 2, 150);
  await sleep(600);
  out({ check: 'approve-click', open: log.open, actions: log.actions.filter(a => a !== 'rendered') });
  await dismiss();
  log.open = 0;
  await clickAt(null, 2, 120);
  await sleep(600);
  out({ check: 'pet-double-tap', open: log.open });

  out({ check: 'errors', errors: log.errors });
  app.quit();
}
