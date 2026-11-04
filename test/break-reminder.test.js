const test = require('node:test');
const assert = require('node:assert');
const { BreakReminder } = require('../src/core/break-reminder');

function make(over = {}) {
  let t = 0, idle = 0, mode = 'none';
  const settings = { wellbeing: { breakReminder: true, breakEveryMinutes: 60, breakMinutes: 5, ...over } };
  const r = new BreakReminder({ getSettings: () => settings, getIdleSeconds: () => idle, getModeId: () => mode, now: () => t });
  const events = [];
  r.on('remind', (e) => events.push(e));
  return { r, events, set: (o) => { if ('t' in o) t = o.t; if ('idle' in o) idle = o.idle; if ('mode' in o) mode = o.mode; } };
}
const min = (m) => m * 60000;

test('Break reminder: fires after 60 min of active use, only once until answered', () => {
  const { r, events, set } = make();
  set({ t: min(59) }); r.tick();
  assert.strictEqual(events.length, 0);
  set({ t: min(60) }); r.tick(); r.tick();
  assert.strictEqual(events.length, 1);
  assert.deepStrictEqual(events[0], { usedMinutes: 60, breakMinutes: 5 });
});

test('Break reminder: 5 min away resets the hour; locked screen counts as rest', () => {
  const { r, events, set } = make();
  set({ t: min(50), idle: 301 }); r.tick();         // away ≥5 min at minute 50
  set({ t: min(100), idle: 0 }); r.tick();          // only 50 min of use since
  assert.strictEqual(events.length, 0);
  set({ t: min(111) }); r.tick();
  assert.strictEqual(events.length, 1);
  r.dismiss(); r.rested();
  set({ t: min(170) }); r.tick();
  assert.strictEqual(events.length, 1);
});

test('Break reminder: waits during meetings / deep focus, then reminds', () => {
  const { r, events, set } = make();
  set({ t: min(65), mode: 'meeting' }); r.tick();
  assert.strictEqual(events.length, 0);
  set({ t: min(90), mode: 'none' }); r.tick();
  assert.strictEqual(events.length, 1);
});

test('Break reminder: snooze 10 min, break restarts the hour after it ends, disabled = silent', () => {
  const { r, events, set } = make();
  set({ t: min(60) }); r.tick();
  r.snooze();
  set({ t: min(69) }); r.tick();
  assert.strictEqual(events.length, 1);
  set({ t: min(70) }); r.tick();
  assert.strictEqual(events.length, 2);
  r.startBreak();                                    // break 70→75, next hour starts at 75
  set({ t: min(134) }); r.tick();
  assert.strictEqual(events.length, 2);
  set({ t: min(135) }); r.tick();
  assert.strictEqual(events.length, 3);
  const off = make({ breakReminder: false });
  off.set({ t: min(500) }); off.r.tick();
  assert.strictEqual(off.events.length, 0);
});
