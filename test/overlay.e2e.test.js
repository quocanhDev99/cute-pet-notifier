/**
 * Overlay end-to-end regression test: the REAL overlay page (renderer bundle + preload) in a hidden
 * Electron window, driven through what users actually do (test/fixtures/overlay-harness.js).
 * Every check here once broke in a release — keep them all:
 *   • the pet stays exactly where the user put it, whatever card / mode / size, and after it closes;
 *   • the card hugs the pet's real body (no gap), in Billboard and Courier;
 *   • drag & drop (slow, brisk, very fast, shaking) saves exactly the release point;
 *   • the unread badge sits beside the head, never on it;
 *   • card buttons never open the Control Center, a real double tap on the pet does;
 *   • no script errors (a frame error makes the pet invisible).
 * Skipped only where Electron cannot open a window (e.g. Linux CI without a display).
 * Screenshots for a human review: SNAP_DIR=/some/dir npm test
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const electron = (() => { try { return require('electron'); } catch { return null; } })();
const canRun = typeof electron === 'string' && fs.existsSync(electron) && (process.platform !== 'linux' || process.env.DISPLAY) && !process.env.SKIP_ELECTRON_TESTS;

let rows = null;
function harness() {
  if (rows) return rows;
  // Test the current sources, not a stale bundle (same options as `npm run build:overlay`).
  require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/renderer/js/renderer.js')], bundle: true, outfile: path.join(ROOT, 'src/renderer/js/bundle.js'), format: 'iife', target: 'chrome128', minify: true, legalComments: 'none', logLevel: 'silent' });
  const run = spawnSync(electron, [path.join(__dirname, 'fixtures/overlay-harness.js')], { encoding: 'utf8', timeout: 240000, env: { ...process.env } });
  rows = String(run.stdout).split('\n').filter(l => l.startsWith('@@')).map(l => JSON.parse(l.slice(2)));
  const err = rows.find(r => r.error);
  assert.ok(!err, `harness failed: ${err && err.error}\n${String(run.stderr).slice(-1500)}`);
  return rows;
}
const of = (check) => harness().filter(r => r.check === check);
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const opts = { skip: !canRun && 'Electron cannot open a window here', timeout: 300000 };

test('overlay e2e: the pet stays where the user put it, with any card, mode and size', opts, () => {
  const placed = of('card-placement'), closed = of('after-card-closes');
  assert.strictEqual(placed.length, 12, 'billboard/peeker/courier × left/right × sm/lg');
  for (const r of [...placed, ...closed]) {
    const where = `${r.check} ${r.mode} / ${r.side} / ${r.size}`;
    assert.ok(r.pet, `${where}: pet rendered`);
    assert.ok(near(r.pet.l, r.pos.x), `${where}: pet x ${r.pet.l} ≠ saved ${r.pos.x}`);
    // Peeker lifts the pet above the card while it shows (x only); everything else keeps x and y.
    if (!(r.check === 'card-placement' && r.mode === 'peeker')) assert.ok(near(r.pet.t, r.pos.y), `${where}: pet y ${r.pet.t} ≠ saved ${r.pos.y}`);
  }
});

test('overlay e2e: the card hugs the pet\'s real body (no gap), Peeker card sits under the pet', opts, () => {
  for (const r of of('card-placement')) {
    const where = `${r.mode} / pet on the ${r.side} / ${r.size}`;
    assert.ok(r.card && r.body, `${where}: card and measured body`);
    const W = r.pet.r - r.pet.l;
    if (r.mode === 'peeker') {
      const cardMid = (r.card.l + r.card.r) / 2, petMid = (r.pet.l + r.pet.r) / 2;
      assert.ok(Math.abs(cardMid - petMid) < (r.card.r - r.card.l) * 0.3, `${where}: card centred under the pet`);
      assert.ok(r.card.t > r.body.t && r.card.t < r.body.b, `${where}: card top crosses the pet's body`);
      continue;
    }
    // Card on the pet's left when the pet is on the right of the screen, and vice versa. The body is
    // animated (arms, breathing): judge the typical (median) overlap over several samples.
    const overlaps = r.bodies.filter(Boolean).map(b => (r.side === 'right' ? r.card.r - b.l : b.r - r.card.l)).sort((a, b) => a - b);
    const overlap = overlaps[Math.floor(overlaps.length / 2)];
    // Billboard: the paw is on the card. Courier (as designed since 3.5.6): the pet stands against the
    // card, touching it — allow a hairline either way, never a visible gap.
    const minOverlap = r.mode === 'billboard' ? W * 0.02 : -W * 0.05;
    assert.ok(overlap >= minOverlap, `${where}: gap between card and pet (overlap ${overlap}px, min ${Math.round(minOverlap)}px)`);
    assert.ok(overlap <= W * 0.35, `${where}: pet covers too much of the card (overlap ${overlap}px)`);
  }
});

test('overlay e2e: drag & drop saves exactly the release point (slow, brisk, very fast, shaking)', opts, () => {
  const drags = of('drag-drop');
  assert.strictEqual(drags.length, 8);
  for (const r of drags) {
    const where = `${r.kind} drag (${r.mode})`;
    assert.ok(r.saved, `${where}: position saved`);
    assert.ok(near(r.saved.x, r.release.petLeft) && near(r.saved.y, r.release.petTop), `${where}: saved ${JSON.stringify(r.saved)} ≠ release ${JSON.stringify(r.release)}`);
    assert.ok(near(r.afterDrop.pet.l, r.saved.x) && near(r.afterDrop.pet.t, r.saved.y), `${where}: pet moved after the drop`);
    assert.ok(near(r.withCard.pet.l, r.saved.x) && near(r.withCard.pet.t, r.saved.y), `${where}: a card moved the dropped pet`);
  }
});

test('overlay e2e: the unread badge sits beside the head, never on it', opts, () => {
  const badges = of('badge');
  assert.strictEqual(badges.length, 6);
  for (const r of badges) {
    const where = `badge ${r.size} (${r.state})`;
    assert.ok(r.badge && r.head, `${where}: badge shown and head measured`);
    assert.ok(r.badge.l >= r.pet.l - 1 && r.badge.r <= r.pet.r + 1 && r.badge.t >= r.pet.t - 1, `${where}: inside the pet's box`);
    const cx = (r.badge.l + r.badge.r) / 2, cy = (r.badge.t + r.badge.b) / 2;
    const hx = (r.head.l + r.head.r) / 2, hy = (r.head.t + r.head.b) / 2;
    const ellipse = ((cx - hx) / ((r.head.r - r.head.l) / 2)) ** 2 + ((cy - hy) / ((r.head.b - r.head.t) / 2)) ** 2;
    assert.ok(ellipse >= 1.3, `${where}: badge centre is on the head (${ellipse.toFixed(2)})`);
    assert.ok(cy < hy && cx > hx, `${where}: badge is up-right of the head`);
  }
});

test('overlay e2e: card buttons never open the Control Center; a double tap on the pet does', opts, () => {
  const [approve] = of('approve-click');
  assert.strictEqual(approve.open, 0, 'Approve (two clicks) opened the Control Center');
  assert.ok(approve.actions.includes('approve'), 'Approve still works');
  const [tap] = of('pet-double-tap');
  assert.strictEqual(tap.open, 1, 'a real double tap on the pet opens the Control Center');
});

test('overlay e2e: no script errors while doing all of the above', opts, () => {
  const [e] = of('errors');
  assert.deepStrictEqual(e.errors, []);
});
