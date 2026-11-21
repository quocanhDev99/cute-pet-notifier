/**
 * AudioController — the ONE place the overlay makes sound (docs/character-production/08, task CP-05).
 *
 *   play(event, ctx) → policy gate → cooldown → pick a variant (never the same one twice in a row)
 *                    → recorded file of the active character (assets/pets/{id}/sounds/*.ogg)
 *                    → else the procedural SoundKit sound it always had (no file ≠ no sound)
 *
 * Events:  reaction (notification card, by emotion) · pet · grab · reject · land · kick · bell
 * Channels: vocal (the pet's own voice) · interaction (pop, whoosh, hmph, bell) · notification (chime)
 * Each channel has its own volume on top of the master volume.
 *
 * Policy lives upstream and arrives as `enabled` (sounds on, Focus mode allows sound, not Hidden) and
 * as `ctx.silent` for a reaction (attention decision, Mode B companion banner…). Notification content
 * is never read out — this module has no access to text at all.
 *
 * The bank comes from pet.json → "sounds": { group: ["file.ogg" | { file, rate, gain }] }; groups are
 * the 8 emotion IDs plus pet / grab. A missing group, file or decode error falls back silently.
 */
import { SoundKit } from './sound.js';

export const CHANNELS = Object.freeze(['vocal', 'interaction', 'notification']);

/** Per event: channel and minimum gap between two plays (anti-spam). */
export const EVENT_RULES = Object.freeze({
  reaction: { channel: 'vocal', cooldownMs: 400 },
  pet: { channel: 'vocal', cooldownMs: 1400 },
  grab: { channel: 'vocal', cooldownMs: 3500 },
  reject: { channel: 'interaction', cooldownMs: 600 },
  land: { channel: 'interaction', cooldownMs: 250 },
  kick: { channel: 'interaction', cooldownMs: 250 },
  bell: { channel: 'interaction', cooldownMs: 1200 }
});

/** Normalise one pet.json "sounds" entry list to [{ file, rate, gain }]. */
export function normalizeBank(sounds) {
  const out = {};
  if (!sounds || typeof sounds !== 'object' || Array.isArray(sounds)) return out;
  for (const [group, list] of Object.entries(sounds)) {
    if (!Array.isArray(list)) continue;
    const items = list.map((v) => (typeof v === 'string' ? { file: v } : v && typeof v.file === 'string' ? v : null))
      .filter(v => v && /^[a-z0-9_.-]+\.(ogg|mp3|wav)$/i.test(v.file))
      .map(v => ({ file: v.file, rate: clamp(Number(v.rate) || 1, 0.5, 2), gain: clamp(Number(v.gain) || 1, 0, 2) }));
    if (items.length) out[group] = items;
  }
  return out;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Pure decision logic (no Web Audio) — what to play for an event. Unit-tested in Node.
 */
export class AudioPolicy {
  constructor({ now = () => Date.now(), random = Math.random } = {}) {
    this.now = now;
    this.random = random;
    this.enabled = true;
    this.lastAt = {};       // event → time of the last play
    this.lastVariant = {};  // group → index of the last variant
    this.bank = {};
  }

  setBank(bank) { this.bank = bank || {}; this.lastVariant = {}; }

  groupFor(event, ctx = {}) {
    if (event === 'reaction') return ctx.emotion || null;
    if (event === 'pet' || event === 'grab') return event;
    return null;
  }

  /** Index of the next variant: random, but never the same as the previous one when there is a choice. */
  pick(group) {
    const list = this.bank[group];
    if (!list || !list.length) return -1;
    if (list.length === 1) return 0;
    let i = Math.floor(this.random() * (list.length - 1));
    if (i >= (this.lastVariant[group] ?? -1)) i++;
    if (i >= list.length) i = 0;
    return i;
  }

  /**
   * @returns {{play:false, reason:string} | {play:true, channel:string, group:string|null, variant:object|null}}
   */
  decide(event, ctx = {}) {
    const rule = EVENT_RULES[event];
    if (!rule) return { play: false, reason: 'unknown_event' };
    if (!this.enabled) return { play: false, reason: 'disabled' };
    if (ctx.silent) return { play: false, reason: 'silent' };
    if (event === 'reaction' && ctx.emotion === 'sleeping') return { play: true, channel: 'notification', group: null, variant: null, chimeOnly: true };
    const t = this.now();
    if (t - (this.lastAt[event] ?? -Infinity) < rule.cooldownMs) return { play: false, reason: 'cooldown' };
    this.lastAt[event] = t;
    const group = this.groupFor(event, ctx);
    const idx = group ? this.pick(group) : -1;
    if (idx >= 0) this.lastVariant[group] = idx;
    return { play: true, channel: rule.channel, group, variant: idx >= 0 ? this.bank[group][idx] : null };
  }
}

/**
 * Web Audio side: loads/decodes the active character's files and plays decisions.
 */
export class AudioController {
  constructor({ synth = new SoundKit(), fetchImpl = (...a) => fetch(...a) } = {}) {
    this.synth = synth;
    this.fetch = fetchImpl;
    this.policy = new AudioPolicy({ now: () => performance.now() });
    this.master = 0.45;
    this.channels = { vocal: 1, interaction: 1, notification: 1 };
    this.useRecorded = true;
    this.character = null;
    this.kind = 'meow';           // procedural voice of the character
    this.hasBell = false;         // accessory sound (Mochi's collar bell)
    this.buffers = new Map();     // file → AudioBuffer (active character only)
    this.loadToken = 0;
    this.vocalNode = null;        // current vocal: a new one replaces it (no stacking)
    this.assetBase = '';
  }

  configure({ enabled, volume, channels, recorded, assetBase }) {
    this.policy.enabled = enabled !== false;
    if (typeof volume === 'number') this.master = clamp(volume, 0, 1);
    if (channels) for (const c of CHANNELS) if (typeof channels[c] === 'number') this.channels[c] = clamp(channels[c], 0, 1);
    if (typeof recorded === 'boolean') this.useRecorded = recorded;
    if (assetBase) this.assetBase = assetBase;
    this.synth.configure({ enabled: this.policy.enabled, volume: this.master });
    if (!this.policy.enabled) this.stopVocal();
  }

  /** Switch character: drop the previous bank (frees decoded audio), load the new one in the background. */
  async setCharacter(id, { kind = 'meow', bell = false } = {}) {
    if (id === this.character) return;
    this.character = id;
    this.kind = kind;
    this.hasBell = bell;
    this.stopVocal();
    this.buffers.clear();
    this.policy.setBank({});
    const token = ++this.loadToken;
    if (!this.assetBase) return;
    try {
      const res = await this.fetch(`${this.assetBase}pets/${id}/pet.json`, { cache: 'no-store' });
      if (!res.ok || token !== this.loadToken) return;
      const bank = normalizeBank((await res.json()).sounds);
      if (token !== this.loadToken) return;
      this.policy.setBank(bank);
      const files = [...new Set(Object.values(bank).flat().map(v => v.file))];
      await Promise.all(files.map(f => this.load(id, f, token)));
    } catch { /* no bank: procedural sounds only */ }
  }

  async load(id, file, token) {
    try {
      const ctx = this.synth.ensure();
      if (!ctx) return;
      const res = await this.fetch(`${this.assetBase}pets/${id}/sounds/${file}`);
      if (!res.ok) return;
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      if (token === this.loadToken) this.buffers.set(file, buf);
    } catch { /* undecodable file → that variant uses the procedural fallback */ }
  }

  gainFor(channel) { return this.master * (this.channels[channel] ?? 1); }

  stopVocal() {
    const n = this.vocalNode;
    this.vocalNode = null;
    if (!n) return;
    try {
      const t = n.ctx.currentTime;
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setValueAtTime(n.gain.gain.value, t);
      n.gain.gain.linearRampToValueAtTime(0.0001, t + 0.05);
      n.src.stop(t + 0.06);
    } catch { /* already stopped */ }
  }

  /** Play a decoded variant; false when it isn't available (→ caller uses the fallback). */
  playFile(variant, channel, delay = 0) {
    if (!this.useRecorded || !variant) return false;
    const buf = this.buffers.get(variant.file);
    const ctx = this.synth.ensure();
    if (!buf || !ctx) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Narrow natural variation: ±3 % rate, ±1 dB.
    src.playbackRate.value = variant.rate * (0.97 + Math.random() * 0.06);
    const gain = ctx.createGain();
    gain.gain.value = this.gainFor(channel) * variant.gain * (0.89 + Math.random() * 0.22);
    src.connect(gain).connect(ctx.destination);
    const t0 = ctx.currentTime + delay;
    if (channel === 'vocal') {
      this.stopVocal();
      const node = { src, gain, ctx };
      this.vocalNode = node;
      src.onended = () => { if (this.vocalNode === node) this.vocalNode = null; };
    }
    src.start(t0);
    return true;
  }

  /** Run a procedural SoundKit call at a channel's volume. */
  synthAt(channel, fn) {
    if (!this.synth.enabled) return;
    const keep = this.synth.volume;
    this.synth.volume = this.gainFor(channel);
    try { fn(this.synth); } finally { this.synth.volume = keep; }
  }

  /** @returns the decision (useful for diagnostics/tests). */
  play(event, ctx = {}) {
    const d = this.policy.decide(event, ctx);
    if (!d.play) return d;
    switch (event) {
      case 'reaction': {
        this.synthAt('notification', s => s.chime(ctx.emotion));
        if (d.chimeOnly) break;
        // The pet answers a beat after the chime (as before).
        if (!this.playFile(d.variant, 'vocal', 0.26)) {
          setTimeout(() => this.synthAt('vocal', s => s.voice(this.kind, ctx.emotion)), 260);
        }
        if (this.hasBell && ['happy', 'excited', 'love'].includes(ctx.emotion)) setTimeout(() => this.synthAt('interaction', s => s.bell()), 450);
        break;
      }
      case 'pet':
        if (!this.playFile(d.variant, 'vocal')) this.synthAt('vocal', s => (this.kind === 'meow' ? s.purr() : s.voice(this.kind, 'happy')));
        break;
      case 'grab':
        // Mochi's collar bell jingles when she's picked up; everyone else just reacts.
        if (this.hasBell) this.synthAt('interaction', s => s.bell());
        if (!this.playFile(d.variant, 'vocal', this.hasBell ? 0.12 : 0) && !this.hasBell) this.synthAt('vocal', s => s.voice(this.kind, 'surprised'));
        break;
      case 'bell': this.synthAt('interaction', s => s.bell()); break;
      case 'reject': this.synthAt('interaction', s => s.hmph()); break;
      case 'land': this.synthAt('interaction', s => s.pop()); break;
      case 'kick': this.synthAt('interaction', s => s.whoosh()); break;
      default: break;
    }
    return d;
  }

  dispose() {
    this.loadToken++;
    this.stopVocal();
    this.buffers.clear();
  }
}
