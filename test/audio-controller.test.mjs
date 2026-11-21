/**
 * AudioController (docs/character-production/08, CP-05): policy gate, anti-spam cooldown, no immediate
 * repeats, procedural fallback — and the shipped sound banks are complete, licensed and small.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AudioPolicy, AudioController, normalizeBank, EVENT_RULES } from '../src/renderer/js/audio-controller.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EMOTIONS = ['happy', 'excited', 'love', 'surprised', 'angry', 'sad', 'thinking', 'sleeping'];
const PETS = ['cat_mochi', 'dog_boba', 'bunny_cloud', 'penguin_pip'];

const clock = () => { let t = 0; const now = () => t; now.add = (ms) => { t += ms; }; return now; };

test('policy: disabled or silent never plays; unknown events are refused', () => {
  const p = new AudioPolicy({ now: clock() });
  p.enabled = false;
  assert.deepStrictEqual(p.decide('reaction', { emotion: 'happy' }), { play: false, reason: 'disabled' });
  p.enabled = true;
  assert.strictEqual(p.decide('reaction', { emotion: 'happy', silent: true }).reason, 'silent');
  assert.strictEqual(p.decide('speak-the-notification').reason, 'unknown_event');
});

test('policy: cooldown stops spam (drag jingle, repeated petting)', () => {
  const now = clock();
  const p = new AudioPolicy({ now });
  assert.ok(p.decide('grab').play);
  now.add(EVENT_RULES.grab.cooldownMs - 1);
  assert.strictEqual(p.decide('grab').reason, 'cooldown');
  now.add(1);
  assert.ok(p.decide('grab').play);
  // Cooldowns are per event: a pet right after a grab still plays.
  assert.ok(p.decide('pet').play);
});

test('policy: variants never repeat back to back and cover the whole group', () => {
  const now = clock();
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const p = new AudioPolicy({ now, random });
  p.setBank(normalizeBank({ happy: ['a.ogg', 'b.ogg', 'c.ogg'] }));
  const seen = []; let prev = null;
  for (let i = 0; i < 60; i++) {
    now.add(1000);
    const d = p.decide('reaction', { emotion: 'happy' });
    assert.notStrictEqual(d.variant.file, prev, 'same variant twice in a row');
    prev = d.variant.file; seen.push(prev);
  }
  assert.deepStrictEqual([...new Set(seen)].sort(), ['a.ogg', 'b.ogg', 'c.ogg']);
});

test('policy: sleeping is a soft chime only; a missing group means procedural fallback', () => {
  const p = new AudioPolicy({ now: clock() });
  p.setBank(normalizeBank({ happy: ['a.ogg'] }));
  const sleep = p.decide('reaction', { emotion: 'sleeping' });
  assert.ok(sleep.play && sleep.chimeOnly);
  const d = p.decide('reaction', { emotion: 'angry' });
  assert.ok(d.play);
  assert.strictEqual(d.variant, null); // → SoundKit voice
});

test('normalizeBank: rejects paths, odd types and out-of-range values', () => {
  const b = normalizeBank({ happy: ['ok.ogg', '../../evil.ogg', 'x.exe', { file: 'r.ogg', rate: 9, gain: -1 }, 42], bad: 'nope' });
  assert.deepStrictEqual(b.happy.map(v => v.file), ['ok.ogg', 'r.ogg']);
  assert.strictEqual(b.happy[1].rate, 2);
  assert.strictEqual(b.happy[1].gain, 0);
  assert.strictEqual(b.bad, undefined);
});

test('controller: without Web Audio / files it falls back to the procedural kit and never throws', () => {
  const calls = [];
  const synth = { enabled: true, volume: 0.5, configure(o) { this.enabled = o.enabled; }, ensure: () => null,
    chime: (e) => calls.push(`chime:${e}`), voice: (k, e) => calls.push(`voice:${k}:${e}`), purr: () => calls.push('purr'),
    bell: () => calls.push('bell'), hmph: () => calls.push('hmph'), pop: () => calls.push('pop'), whoosh: () => calls.push('whoosh') };
  const c = new AudioController({ synth, fetchImpl: async () => ({ ok: false }) });
  c.configure({ enabled: true, volume: 0.5, channels: { interaction: 0.2 } });
  c.kind = 'meow'; c.hasBell = true;
  c.play('pet');
  c.play('land');
  c.play('grab');
  assert.deepStrictEqual(calls, ['purr', 'pop', 'bell']);
  calls.length = 0;
  c.configure({ enabled: false });
  c.play('kick');
  assert.deepStrictEqual(calls, []);
});

test('shipped sound banks: every pet covers the emotions, pet and grab; files exist, are small and CC0', () => {
  for (const pet of PETS) {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/pets', pet, 'pet.json'), 'utf8'));
    const bank = normalizeBank(cfg.sounds);
    for (const g of [...EMOTIONS.filter(e => e !== 'sleeping'), 'pet', 'grab']) assert.ok(bank[g] && bank[g].length, `${pet}: no "${g}" sounds`);
    const credits = JSON.parse(fs.readFileSync(path.join(ROOT, 'art', pet, 'audio', 'SOURCES.json'), 'utf8'));
    const licensed = new Map(credits.files.map(f => [path.basename(f.file), f]));
    for (const v of Object.values(bank).flat()) {
      const f = path.join(ROOT, 'assets/pets', pet, 'sounds', v.file);
      assert.ok(fs.existsSync(f), `${pet}: missing ${v.file}`);
      assert.ok(fs.statSync(f).size < 64 * 1024, `${pet}: ${v.file} is larger than 64 KB`);
      assert.strictEqual(fs.readFileSync(f).toString('ascii', 0, 4), 'OggS', `${pet}: ${v.file} is not Ogg`);
      const src = licensed.get(v.file);
      assert.ok(src, `${pet}: ${v.file} has no source record`);
      assert.match(src.source.license, /^CC0/);
      assert.match(src.source.url, /^https:\/\/freesound\.org\/people\/[^/]+\/sounds\/\d+\/$/);
    }
  }
});
