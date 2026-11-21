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
  for (const ch of ['overlay:hit-rects', 'overlay:dock-rect', 'overlay:interaction']) ipcMain.on(ch, () => {});
  let ignoring = true; // what the overlay asked main: ignore the mouse (click-through) or capture it
  ipcMain.on('window:set-ignore-mouse-events', (_e, v) => { ignoring = !!v; });
  ipcMain.on('overlay:open-control', () => { log.open++; });
  ipcMain.on('notification:action', (_e, m) => log.actions.push(m && m.action));
  win.webContents.on('console-message', (_e, level, msg) => {
    // Asset fetches are blocked on purpose (no server): only real script errors count.
    if (/Content Security Policy|Refused to connect|Failed to fetch|ERR_/.test(msg)) return;
    if (level >= 3 || /frame error|Uncaught|is not defined|TypeError/.test(msg)) log.errors.push(String(msg).slice(0, 200));
  });

  await win.loadFile(path.join(ROOT, 'src/renderer/index.html'));

  let s;
  let zone = null; // Mode B: where the OS draws its banners (main sends it as bannerZone)
  let reducedMotion = false;
  const sendConfig = () => win.webContents.send('overlay:config', { settings: JSON.parse(JSON.stringify(s)), preset: PERSONALITY_PRESETS[s.personality], effective: { presence: 'full', mode: { id: 'none' }, hidden: false, reducedMotion }, assetBase: 'http://127.0.0.1:1/', platform: process.platform, bannerZone: zone });
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
    const zi = (sel) => { const el = document.querySelector(sel); return el ? Number(getComputedStyle(el).zIndex) || 0 : null; };
    return JSON.stringify({ card: R(document.querySelector('.card')), pet: R(document.querySelector('.pet-slot')), badge: R(document.querySelector('.pet-badge')), z: { card: zi('.card-slot'), pet: zi('.pet-slot') }, clip: Number(document.querySelector('.pet-slot').dataset.clip || 0), title: R(document.querySelector('.card .title')),
      // Where the card rests once its entrance transition is over (hidden test windows freeze transitions).
      cardLayoutBottom: (() => { const c = document.querySelector('.card'), slot = document.querySelector('.card-slot'), d = document.querySelector('.dock'); return c ? Math.round(d.getBoundingClientRect().top + slot.offsetTop + c.offsetTop + c.offsetHeight) : null; })(),
      vh: innerHeight,
      cardLayoutTop: (() => { const c = document.querySelector('.card'), slot = document.querySelector('.card-slot'), d = document.querySelector('.dock'); return c ? Math.round(d.getBoundingClientRect().top + slot.offsetTop + c.offsetTop) : null; })(),
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
  for (const mode of ['billboard', 'peeker', 'courier', 'cling', 'resting']) {
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

  // 1b. Pet parked at the very bottom (feet on the taskbar): in every attachment style the card
  //     keeps EDGE_GAP px of air above the taskbar instead of sitting flush on it.
  for (const mode of ['cling', 'resting', 'peeker', 'billboard', 'courier']) {
    await setup({ mode, pos: { x: 1150, y: 5000 } }); // clamped to the lowest possible spot
    await show(card(`${mode}-bottom`));
    out({ check: 'card-taskbar', mode, ...(await measure()) });
    await dismiss();
  }
  for (const pos of ['bottom-right', 'bottom-left']) {
    await setup({ mode: 'cling' });
    s.appearance.position = pos; s.appearance.margin = 0; sendConfig(); await sleep(400);
    await show(card(`cling-${pos}-m0`));
    out({ check: 'card-taskbar', mode: `cling ${pos} margin 0`, ...(await measure()) });
    await dismiss();
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

  // 5. Mode B: a card for an event that ALSO has a system banner moves out of the banner area
  //    (Windows: bottom-right); other cards don't move; the pet is back in place after it closes.
  zone = { x: 1440 - 364 - 12, y: 900 - 150 - 12, w: 364, h: 150, edge: 'bottom' }; // Windows 11 toast geometry (main: bannerZone)
  await setup({ mode: 'billboard' });
  // A hidden window paints no frames, so CSS transitions never finish here: measure end states.
  await js(`(() => { const st = document.createElement('style'); st.id = 'no-transition'; st.textContent = '.dock { transition: none !important; }'; document.head.appendChild(st); return 1; })()`);
  const rest = await measure();
  await show(card('native-1', { source: 'windows_nc' }));
  const lifted = await measure();
  await dismiss();
  await show(card('cloud-1', { source: 'composio', app: 'gmail' }));
  const cloud = await measure();
  await dismiss();
  await sleep(500);
  out({ check: 'banner-zone', zone, rest, lifted, cloud, after: await measure() });
  // 5b. Mode 1 "pet only" companion: no card at all; the pet goes next to the banner area (outside it),
  //     reacts, and walks back to exactly where it was. Reduced Motion: it reacts in place, unless that
  //     place is under the banner (it would be hidden) — then it moves to the edge without running.
  await setup({ mode: 'billboard' });
  await js(`(() => { const st = document.createElement('style'); st.id = 'no-transition2'; st.textContent = '.dock, .dock.traveling { transition: none !important; }'; document.head.appendChild(st); return 1; })()`);
  log.actions = [];
  const cRest = await measure();
  await show(card('comp-1', { source: 'windows_nc', companion: true, duration: 3000 }), 1400);
  const cAt = await measure();
  await sleep(3000 + 700 + 600); // the companion time, the walk back, a margin
  const cBack = await measure();
  const cActions = log.actions.slice();
  // Reduced Motion: away from the banner area the pet reacts in place (no run across the screen) …
  reducedMotion = true;
  await setup({ mode: 'billboard', pos: { x: 300, y: 420 } });
  const rFarRest = await measure();
  await show(card('comp-2', { source: 'windows_nc', companion: true, duration: 3000 }), 1200);
  const cReduced = await measure();
  await sleep(3500);
  // … but where the OS banner would hide it (it is drawn above every window), it goes to the banner edge.
  await setup({ mode: 'billboard' });
  await show(card('comp-3', { source: 'windows_nc', companion: true, duration: 3000 }), 1200);
  const cReducedCovered = await measure();
  reducedMotion = false;
  await sleep(3500);
  out({ check: 'companion', zone, rest: cRest, at: cAt, back: cBack, reducedRest: rFarRest, reduced: cReduced, reducedCovered: cReducedCovered, actions: cActions });
  await js(`(() => { document.getElementById('no-transition2').remove(); return 1; })()`);
  zone = null;

  // 5c. Pet opacity applies to the pet only; click-through lets the mouse pass over the pet.
  await setup({ mode: 'billboard' });
  s.appearance.petOpacity = 0.5; sendConfig(); await sleep(400);
  await show(card('op-1'), 1800);
  // (A hidden window never runs the card's entrance animation, so check what wraps the card instead.)
  const opacity = await js(`(() => { let o = 1; for (let el = document.querySelector('.card').parentElement; el; el = el.parentElement) o *= Number(getComputedStyle(el).opacity); return JSON.stringify({ pet: getComputedStyle(document.querySelector('.pet-stage')).opacity, card: o }); })()`).then(JSON.parse);
  await dismiss();
  const hoverPet = () => js(`(async () => {
    const r = document.querySelector('.pet-slot').getBoundingClientRect();
    for (let i = 0; i < 3; i++) { document.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.55, bubbles: true })); await new Promise(res => setTimeout(res, 60)); }
    return 1;
  })()`);
  const away = () => js(`(() => { document.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5, bubbles: true })); return 1; })()`);
  await away(); await sleep(80);
  await hoverPet(); await sleep(80);
  const capturedNormally = !ignoring;
  await away(); await sleep(80);
  s.appearance.petClickThrough = true; sendConfig(); await sleep(400);
  await hoverPet(); await sleep(80);
  const capturedThrough = !ignoring;
  out({ check: 'pet-opacity-clickthrough', opacity, capturedNormally, capturedThrough });

  // 5d. Main resets the window to click-through (display change / resume) while the renderer holds
  //     the mouse: hovering a card must take the mouse again (cards used to ignore every click).
  s.appearance.petClickThrough = false; sendConfig(); await sleep(300);
  await show(card('resync-1'), 1400);
  const hoverCard = () => js(`(async () => {
    const r = document.querySelector('.card .open').getBoundingClientRect();
    for (let i = 0; i < 3; i++) { document.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true })); await new Promise(res => setTimeout(res, 60)); }
    return 1;
  })()`);
  await hoverCard(); await sleep(100);
  const before = !ignoring;
  ignoring = true; win.webContents.send('app:resumed', {}); await sleep(200); // what main does
  await hoverCard(); await sleep(150);
  out({ check: 'capture-resync', before, after: !ignoring });
  await dismiss();
  await js(`(() => { document.getElementById('no-transition').remove(); return 1; })()`);

  // 6. Every shipped pet sound decodes in the real Chromium audio stack (Ogg Opus).
  const fs = require('fs');
  const decoded = [];
  for (const pet of fs.readdirSync(path.join(ROOT, 'assets/pets'))) {
    const dir = path.join(ROOT, 'assets/pets', pet, 'sounds');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.ogg'))) {
      const b64 = fs.readFileSync(path.join(dir, f)).toString('base64');
      const dur = await js(`(async () => { const bin = Uint8Array.from(atob('${b64}'), c => c.charCodeAt(0)); const ctx = new OfflineAudioContext(1, 48000, 48000); try { const b = await ctx.decodeAudioData(bin.buffer); return b.duration; } catch (e) { return -1; } })()`);
      decoded.push({ file: `${pet}/${f}`, dur });
    }
  }
  out({ check: 'sounds-decode', decoded });

  out({ check: 'errors', errors: log.errors });
  app.quit();
}
