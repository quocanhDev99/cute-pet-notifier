import test from 'node:test';
import assert from 'node:assert';
import { AnimationController, IDLE_BEHAVIOURS } from '../src/renderer/js/pet/animation-controller.js';
import { TRANSITION_PROFILES } from '../src/renderer/js/pet/emotion-poses.js';
import { resolveClip, morphWeightsFor, normalizeName } from '../src/renderer/js/pet/semantic-map.js';

const FRAME = 1 / 60;
const run = (c, seconds, dt = FRAME) => { const out = []; for (let t = 0; t < seconds; t += dt) out.push(c.update(dt)); return out; };

test('transition profiles stay within 0.18–0.35 s', () => {
  for (const [k, v] of Object.entries(TRANSITION_PROFILES)) assert.ok(v >= 0.18 && v <= 0.35, `${k}=${v}`);
  const c = new AnimationController();
  c.setReaction('surprised'); assert.strictEqual(c.lastProfile.duration, 0.18);
  run(c, 0.5);
  c.setReaction(null); c.setBase('sleeping'); assert.strictEqual(c.lastProfile.duration, 0.35);
});

test('no pose pop: every numeric param moves continuously between frames', () => {
  const c = new AnimationController();
  run(c, 0.2);
  let prev = c.update(FRAME).pose;
  const seq = ['happy', 'angry', 'sleeping', 'excited', null, 'surprised', 'love'];
  let maxStep = 0;
  let worst = '';
  for (const e of seq) {
    c.setReaction(e);
    const frames = run(c, 0.12); // part of a transition…
    c.setReaction(e === 'happy' ? 'sad' : e); // …then retarget mid-transition on purpose
    for (const f of [...frames, ...run(c, 0.4)]) {
      for (const k of ['armLx', 'armRx', 'pitch', 'lean', 'squash', 'lift', 'eyeScale']) {
        const d = Math.abs(f.pose[k] - prev[k]);
        if (d > maxStep) { maxStep = d; worst = `${k} → ${e}`; }
      }
      prev = f.pose;
    }
  }
  // Largest arm swing in the library is ~2.6 rad over ≥0.18 s → per-frame step must stay well below a "snap".
  assert.ok(maxStep < 0.45, `max per-frame step ${maxStep.toFixed(3)} (${worst})`);
});

test('face swaps happen behind a blink (never at full open eyes)', () => {
  const c = new AnimationController();
  run(c, 0.3);
  c.setReaction('happy');
  let prevEyes = c.update(FRAME).face.eyes;
  for (const f of run(c, 0.4)) {
    if (f.face.eyes !== prevEyes) assert.ok(f.faceBlink < 0.2, `swap at faceBlink=${f.faceBlink}`);
    prevEyes = f.face.eyes;
  }
  assert.strictEqual(prevEyes, 'arcHappy');
});

test('delta-time guard: resume after sleep does not jump', () => {
  const c = new AnimationController();
  c.setReaction('happy');
  const before = c.update(FRAME);
  const after = c.update(3600); // laptop lid opened after an hour
  assert.strictEqual(after.dt, 0);
  assert.ok(Math.abs(after.pose.armLx - before.pose.armLx) < 1e-9);
  assert.strictEqual(c.update(0.2).dt, 0.05); // long frame clamped
});

test('grab weight ramps smoothly in 0.18 s and out in 0.25 s, then lands', () => {
  const c = new AnimationController();
  c.setGrabbed(true);
  const w = run(c, 0.25).map(f => f.grab);
  for (let i = 1; i < w.length; i++) assert.ok(w[i] >= w[i - 1]);
  assert.strictEqual(w[w.length - 1], 1);
  c.setGrabbed(false);
  assert.ok(c.action('land') !== null);
  const w2 = run(c, 0.3).map(f => f.grab);
  for (let i = 1; i < w2.length; i++) assert.ok(w2[i] <= w2[i - 1]);
  assert.strictEqual(w2[w2.length - 1], 0);
});

test('user interaction outranks notification-driven actions', () => {
  const c = new AnimationController();
  assert.strictEqual(c.trigger('kick'), true);
  assert.strictEqual(c.trigger('wave'), false); // blocked while user kick plays
  assert.strictEqual(c.trigger('pet'), true);   // user actions always allowed
});

test('reduced motion: longer transitions, damped oscillations, no jolt', () => {
  const c = new AnimationController();
  c.setReducedMotion(true);
  c.setReaction('happy');
  assert.ok(c.lastProfile.duration >= 0.35);
  const f = run(c, 0.6).pop();
  assert.ok(f.pose.bounce <= 0.1 * 0.2 + 1e-9);
  assert.strictEqual(c.trigger('jolt'), false);
});

test('semantic map: production clip names from docs/character-production play without overrides', () => {
  const names = ['idle_breathing', 'emotion_happy', 'emotion_excited', 'emotion_love', 'emotion_surprised', 'emotion_angry', 'emotion_sad', 'emotion_thinking', 'sleep_loop', 'interaction_pet', 'interaction_pickup', 'interaction_release'];
  const clips = names.map(name => ({ name }));
  const expect = { idle: 'idle_breathing', happy: 'emotion_happy', excited: 'emotion_excited', love: 'emotion_love', surprised: 'emotion_surprised', angry: 'emotion_angry', sad: 'emotion_sad', thinking: 'emotion_thinking', sleeping: 'sleep_loop', pet: 'interaction_pet', grabbed: 'interaction_pickup', land: 'interaction_release' };
  for (const [state, clip] of Object.entries(expect)) assert.strictEqual(resolveClip(clips, state).name, clip, state);
  // The legacy names still win when both exist (no change for existing GLBs).
  assert.strictEqual(resolveClip([{ name: 'emotion_happy' }, { name: 'happy' }], 'happy').name, 'happy');
});

test('semantic map: clip aliases, morph fallback, name normalization', () => {
  const clips = [{ name: 'Idle' }, { name: '01_happy' }, { name: 'mixamorig:Grab' }];
  assert.strictEqual(resolveClip(clips, 'happy').name, '01_happy');
  assert.strictEqual(resolveClip(clips, 'idle').name, 'Idle');
  assert.strictEqual(resolveClip(clips, 'kick'), null);
  assert.strictEqual(resolveClip(clips, 'grabbed', { grabbed: ['grab'] }).name, 'mixamorig:Grab');
  assert.deepStrictEqual(Object.keys(morphWeightsFor('angry')).sort(), ['05_angry', 'angry', 'cheek_puff', 'eye_squint', 'mouth_pout']);
  assert.strictEqual(normalizeName('DEF-Ear_L.001'), 'ear_l');
});

test('idle micro-behaviours (CP-06): only when resting, weighted, cooldowns, no back-to-back repeat', () => {
  const a = new AnimationController();
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const seen = [];
  for (let i = 0; i < 40; i++) {
    const name = a.pickIdle(rnd);
    if (name) {
      assert.notStrictEqual(name, seen[seen.length - 1], 'same idle behaviour twice in a row');
      const d = a.startIdle(name, rnd);
      assert.ok(d > 0);
      seen.push(name);
      for (let t = 0; t < d + 0.1; t += 1 / 30) a.update(1 / 30);
      assert.strictEqual(a.idle, null, 'behaviour did not finish');
    }
    for (let t = 0; t < 4; t += 0.05) a.update(0.05); // a few seconds pass between ticks
  }
  assert.ok(new Set(seen).size >= 4, `only ${[...new Set(seen)]} played`);
  // Cooldown: the same behaviour never restarts before its cooldown.
  const starts = {};
  // (re-run with a fresh controller and fake time)
  const b = new AnimationController();
  for (let i = 0; i < 200; i++) {
    const n = b.pickIdle(rnd);
    if (n) { if (starts[n] !== undefined) assert.ok(b.time - starts[n] >= IDLE_BEHAVIOURS[n].cooldown); starts[n] = b.time; b.startIdle(n, rnd); }
    b.update(0.05);
  }
});

test('idle micro-behaviours: blocked by cards, holding, actions; reduced motion keeps only blinks', () => {
  const a = new AnimationController();
  a.setReaction('happy');
  assert.strictEqual(a.pickIdle(), null);
  a.setReaction(null);
  for (let i = 0; i < 40; i++) a.update(0.05); // let the transition finish
  a.setGrabbed(true);
  assert.strictEqual(a.pickIdle(), null);
  a.setGrabbed(false);
  for (let i = 0; i < 40; i++) a.update(0.05);
  a.setReducedMotion(true);
  for (let i = 0; i < 30; i++) {
    const n = a.pickIdle();
    if (n) { assert.ok(IDLE_BEHAVIOURS[n].gentle, `${n} plays with reduced motion`); a.startIdle(n); }
    for (let t = 0; t < 12; t += 0.05) a.update(0.05);
  }
});

test('idle micro-behaviours: a card arriving mid-behaviour fades it out (no pop) and the pose stays continuous', () => {
  const a = new AnimationController();
  a.startIdle('headTilt', () => 0.9);
  let prev = null;
  for (let t = 0; t < 0.9; t += 1 / 60) prev = a.update(1 / 60).pose.tilt;
  a.setReaction('surprised');
  let maxJump = 0;
  for (let t = 0; t < 1; t += 1 / 60) { const v = a.update(1 / 60).pose.tilt; maxJump = Math.max(maxJump, Math.abs(v - prev)); prev = v; }
  assert.strictEqual(a.idle, null);
  assert.ok(maxJump < 0.05, `tilt jumped ${maxJump.toFixed(3)} rad in one frame`);
  // Slow blink closes the eyelids only — it must not drive the face-swap blink (mouth).
  const c = new AnimationController();
  c.startIdle('slowBlink');
  let minLid = 1, minFace = 1;
  for (let t = 0; t < 1.3; t += 1 / 60) { const f = c.update(1 / 60); minLid = Math.min(minLid, f.idleBlink); minFace = Math.min(minFace, f.faceBlink); }
  assert.ok(minLid < 0.2 && minFace === 1);
});
