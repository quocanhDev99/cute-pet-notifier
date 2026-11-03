/**
 * Tiny procedural sound kit (Web Audio) — no audio assets needed.
 * Character voices: meow (cat), woof (dog), squeak (bunny), chirp (penguin).
 * If assets/pets/{id}/sounds/{name}.mp3 exists it can be added later; synthesis is the default.
 */
export class SoundKit {
  constructor() {
    this.ctx = null;
    this.volume = 0.45;
    this.enabled = true;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  configure({ enabled, volume }) {
    this.enabled = enabled !== false;
    if (typeof volume === 'number') this.volume = volume;
  }

  tone({ f0, f1 = f0, dur = 0.2, type = 'sine', gain = 0.3, delay = 0, q = 0, filter = 0 }) {
    const ctx = this.ensure();
    if (!ctx || !this.enabled || this.volume <= 0) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.volume, t0 + Math.min(0.03, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = 'bandpass'; bq.frequency.value = filter; bq.Q.value = q || 3;
      osc.connect(bq); node = bq;
    }
    node.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  voice(kind, mood = 'neutral') {
    const up = mood === 'happy' ? 1.15 : mood === 'sad' ? 0.8 : mood === 'angry' ? 0.75 : 1;
    switch (kind) {
      case 'woof':
        this.tone({ f0: 420 * up, f1: 240 * up, dur: 0.14, type: 'sawtooth', gain: 0.18, filter: 900, q: 2 });
        this.tone({ f0: 400 * up, f1: 220 * up, dur: 0.14, type: 'sawtooth', gain: 0.16, filter: 900, q: 2, delay: 0.2 });
        break;
      case 'squeak':
        this.tone({ f0: 1500 * up, f1: 2300 * up, dur: 0.09, type: 'sine', gain: 0.18 });
        this.tone({ f0: 1700 * up, f1: 2600 * up, dur: 0.08, type: 'sine', gain: 0.14, delay: 0.12 });
        break;
      case 'chirp':
        this.tone({ f0: 900 * up, f1: 1500 * up, dur: 0.1, type: 'triangle', gain: 0.2 });
        this.tone({ f0: 1100 * up, f1: 1800 * up, dur: 0.1, type: 'triangle', gain: 0.18, delay: 0.13 });
        break;
      default: // meow
        this.tone({ f0: 520 * up, f1: 820 * up, dur: 0.16, type: 'sawtooth', gain: 0.12, filter: 1400, q: 4 });
        this.tone({ f0: 820 * up, f1: 480 * up, dur: 0.32, type: 'sawtooth', gain: 0.12, filter: 1200, q: 4, delay: 0.14 });
    }
  }

  bell() {
    [2637, 3520, 5274].forEach((f, i) => this.tone({ f0: f, f1: f * 0.995, dur: 0.6 - i * 0.12, type: 'sine', gain: 0.07 / (i + 1), delay: i * 0.01 }));
  }

  emotion(emotion, kind) {
    switch (emotion) {
      case 'happy': [660, 880, 1320].forEach((f, i) => this.tone({ f0: f, dur: 0.14, type: 'triangle', gain: 0.12, delay: i * 0.08 })); break;
      case 'excited': [880, 1175, 1568, 1760].forEach((f, i) => this.tone({ f0: f, dur: 0.1, type: 'square', gain: 0.05, delay: i * 0.06 })); break;
      case 'love': [784, 988, 1175].forEach((f, i) => this.tone({ f0: f, dur: 0.3, type: 'sine', gain: 0.1, delay: i * 0.12 })); break;
      case 'surprised': this.tone({ f0: 500, f1: 1400, dur: 0.18, type: 'triangle', gain: 0.16 }); break;
      case 'angry': this.tone({ f0: 180, f1: 140, dur: 0.3, type: 'sawtooth', gain: 0.08, filter: 600 }); break;
      case 'sad': [523, 466, 392].forEach((f, i) => this.tone({ f0: f, f1: f * 0.97, dur: 0.28, type: 'sine', gain: 0.1, delay: i * 0.2 })); break;
      case 'thinking': [700, 760].forEach((f, i) => this.tone({ f0: f, dur: 0.1, type: 'sine', gain: 0.08, delay: i * 0.16 })); break;
      case 'sleeping': this.tone({ f0: 300, f1: 220, dur: 0.8, type: 'sine', gain: 0.06 }); return;
      default: break;
    }
    setTimeout(() => this.voice(kind, emotion), 260);
  }

  purr() {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    for (let i = 0; i < 6; i++) this.tone({ f0: 60, f1: 55, dur: 0.07, type: 'sawtooth', gain: 0.1, filter: 220, q: 1, delay: i * 0.08 });
  }

  /** Soft landing "boing" after being put down. */
  pop() {
    this.tone({ f0: 320, f1: 620, dur: 0.12, type: 'sine', gain: 0.14 });
    this.tone({ f0: 620, f1: 480, dur: 0.1, type: 'triangle', gain: 0.08, delay: 0.1 });
  }

  whoosh() { this.tone({ f0: 900, f1: 120, dur: 0.35, type: 'sawtooth', gain: 0.06, filter: 700, q: 0.7 }); }
  hmph() { this.tone({ f0: 260, f1: 180, dur: 0.18, type: 'sawtooth', gain: 0.08, filter: 500 }); }
}
