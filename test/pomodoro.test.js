/**
 * Pomodoro (docs/product/notifications/NOTIFICATION_MODE_REDESIGN_SPEC.md §4): phases, long break, pause/resume, skip,
 * stop, Study preset, and the attention mode it asks for.
 */
const test = require('node:test');
const assert = require('node:assert');
const { Pomodoro } = require('../src/core/pomodoro');
const { AttentionEngine } = require('../src/core/attention-engine');
const { DEFAULT_SETTINGS } = require('../src/core/settings-store');

const MIN = 60000;
function mk(over = {}) {
  let t = 1_000_000;
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  Object.assign(s.pomodoro, over);
  const p = new Pomodoro({ getSettings: () => s, now: () => t });
  const ends = [];
  p.on('phase-end', (e) => ends.push(e));
  return { p, s, ends, advance: (ms) => { t += ms; p.tick(); } };
}

test('focus 25 → break 5 → focus …, long break after the 4th focus', () => {
  const { p, ends, advance } = mk();
  p.start();
  assert.strictEqual(p.phase, 'focus');
  advance(25 * MIN - 1);
  assert.strictEqual(p.phase, 'focus', 'ended a second early');
  advance(1);
  assert.strictEqual(p.phase, 'break');
  assert.deepStrictEqual(ends[0], { ended: 'focus', next: 'break', cycle: 1, preset: 'pomodoro', minutes: 5 });
  for (let i = 0; i < 3; i++) { advance(5 * MIN); advance(25 * MIN); } // three more focus phases
  assert.strictEqual(p.phase, 'long_break');
  assert.strictEqual(p.cycle, 4);
  advance(15 * MIN);
  assert.strictEqual(p.phase, 'focus');
});

test('pause keeps the remaining time; resume continues from there', () => {
  const { p, advance } = mk();
  p.start();
  advance(10 * MIN);
  p.pause();
  advance(60 * MIN); // time passes while paused
  assert.strictEqual(p.phase, 'focus');
  assert.strictEqual(p.state().remainingMs, 15 * MIN);
  p.resume();
  advance(15 * MIN);
  assert.strictEqual(p.phase, 'break');
});

test('skip ends the phase now; stop returns to idle', () => {
  const { p, ends } = mk();
  p.start();
  p.skip();
  assert.strictEqual(p.phase, 'break');
  assert.strictEqual(ends.length, 1);
  p.stop();
  assert.strictEqual(p.phase, 'idle');
  assert.strictEqual(p.state().remainingMs, 0);
});

test('Study preset is 50/10 with a 20-minute long break; user minutes apply to Pomodoro', () => {
  const { p, advance } = mk({ focusMinutes: 30, breakMinutes: 7 });
  p.start('study');
  assert.strictEqual(p.state().totalMs, 50 * MIN);
  advance(50 * MIN);
  assert.strictEqual(p.state().totalMs, 10 * MIN);
  p.start('pomodoro');
  assert.strictEqual(p.state().totalMs, 30 * MIN);
  advance(30 * MIN);
  assert.strictEqual(p.state().totalMs, 7 * MIN);
});

test('autoContinue off: the next phase waits, paused, for "resume"', () => {
  const { p, advance } = mk({ autoContinue: false });
  p.start();
  advance(25 * MIN);
  assert.strictEqual(p.phase, 'break');
  assert.ok(p.paused);
  advance(30 * MIN);
  assert.strictEqual(p.phase, 'break', 'moved on without the user');
  p.resume();
  advance(5 * MIN);
  assert.strictEqual(p.phase, 'focus');
});

test('attention: focus phase = deep focus (critical only) unless the user chose a mode by hand', () => {
  const { p, s, advance } = mk();
  const att = new AttentionEngine({ getSettings: () => s, getRuntime: () => ({ pomodoroQuiet: p.wantsQuiet() }) });
  assert.strictEqual(att.mode().id, 'none');
  p.start();
  assert.deepStrictEqual([att.mode().id, att.mode().source], ['focus', 'pomodoro']);
  p.pause();
  assert.strictEqual(att.mode().id, 'none', 'paused timer must not keep blocking notifications');
  p.resume();
  advance(25 * MIN); // break
  assert.strictEqual(att.mode().id, 'none');
  advance(5 * MIN);
  s.system.focusMode = 'meeting';
  assert.strictEqual(att.mode().id, 'meeting', 'manual choice wins');
  s.system.focusMode = 'none';
  s.pomodoro.quietDuringFocus = false;
  assert.strictEqual(att.mode().id, 'none');
});

test('focus minutes today: full phases count fully, a skipped phase counts what elapsed', () => {
  const { p, advance } = mk();
  p.start();
  advance(25 * MIN);                 // a full focus phase
  assert.strictEqual(p.state().focusMsToday, 25 * MIN);
  advance(5 * MIN);                  // break → focus again
  advance(10 * MIN);
  p.skip();                          // 10 of 25 minutes done
  assert.strictEqual(p.state().focusMsToday, 35 * MIN);
});
