/**
 * Overlay layout regression test (real renderer + preload in a hidden Electron window):
 * the pet must stay exactly at its saved position whatever card / presentation mode is shown,
 * and the card must sit right next to the pet. Skipped where Electron can't open a window.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const electron = (() => { try { return require('electron'); } catch { return null; } })();
const canRun = typeof electron === 'string' && fs.existsSync(electron) && (process.platform !== 'linux' || process.env.DISPLAY) && !process.env.SKIP_ELECTRON_TESTS;

test('overlay: pet stays at its saved spot and the card sits next to it, in every mode', { skip: !canRun && 'Electron cannot open a window here', timeout: 180000 }, () => {
  const bundle = path.join(ROOT, 'src/renderer/js/bundle.js');
  // Test the current sources, not a stale bundle (same options as `npm run build:overlay`).
  require('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/renderer/js/renderer.js')], bundle: true, outfile: bundle, format: 'iife', target: 'chrome128', minify: true, legalComments: 'none', logLevel: 'silent' });
  const run = spawnSync(electron, [path.join(__dirname, 'fixtures/overlay-layout-harness.js')], { encoding: 'utf8', timeout: 150000, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '' } });
  const rows = String(run.stdout).split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l));
  assert.ok(!rows.some(r => r.error), `harness: ${JSON.stringify(rows.find(r => r.error))}`);
  assert.strictEqual(rows.length, 6, `measured all cases\n${run.stderr}`);
  for (const r of rows) {
    const where = `${r.mode} / pet on the ${r.side}`;
    assert.ok(r.card && r.pet, `${where}: card and pet rendered`);
    // The pet never moves away from where the user put it (Peeker lifts it above the card: x only).
    assert.ok(Math.abs(r.pet.l - r.pos.x) <= 1, `${where}: pet x ${r.pet.l} ≠ saved ${r.pos.x}`);
    if (r.mode !== 'peeker') assert.ok(Math.abs(r.pet.t - r.pos.y) <= 1, `${where}: pet y ${r.pet.t} ≠ saved ${r.pos.y}`);
    // The card hugs the pet: overlapping or touching it, never far away.
    const petW = r.pet.r - r.pet.l;
    if (r.mode === 'peeker') {
      assert.ok(r.card.t <= r.pet.b && r.card.t >= r.pet.t, `${where}: card top ${r.card.t} under the pet (${r.pet.t}–${r.pet.b})`);
    } else if (r.side === 'right') {
      const gap = r.pet.l - r.card.r; // card on the pet's left
      assert.ok(gap <= 0 && gap >= -petW * 0.5, `${where}: card↔pet gap ${gap}px`);
    } else {
      const gap = r.card.l - r.pet.r; // card on the pet's right
      assert.ok(gap <= 0 && gap >= -petW * 0.5, `${where}: card↔pet gap ${gap}px`);
    }
  }
});
