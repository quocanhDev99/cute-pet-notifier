/**
 * Pomodoro — opt-in focus/break timer (docs/product/notifications/NOTIFICATION_MODE_REDESIGN_SPEC.md §4, Blueprint §10.5).
 *
 *   idle → focus (25) → break (5) → focus → … → every Nth focus a long break (15) → …
 *
 * - "Study" is the same timer with a 50/10 preset (no second mode).
 * - pause/resume keep the remaining time; skip ends the current phase now; stop returns to idle.
 * - Runtime only: nothing is written to disk, restarting the app stops the timer.
 * - Pure logic: time is injected (`now`) and the caller drives `tick()` (main runs it every second),
 *   so it is unit-tested without timers. Emits `change` (state) and `phase-end` ({ ended, next }).
 */
const { EventEmitter } = require('events');

const PRESETS = Object.freeze({
  pomodoro: { label: 'Pomodoro', focusMinutes: null, breakMinutes: null }, // = the user's settings
  study: { label: 'Học tập', focusMinutes: 50, breakMinutes: 10, longBreakMinutes: 20 }
});

class Pomodoro extends EventEmitter {
  /** @param {{ getSettings: () => object, now?: () => number }} deps */
  constructor({ getSettings, now = Date.now }) {
    super();
    this.getSettings = getSettings;
    this.now = now;
    this.focusDay = '';      // local date the counter below belongs to
    this.focusMsDay = 0;     // focus time completed today (Home → "Hoạt động hôm nay")
    this.reset();
  }

  dayKey(t = this.now()) { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

  /** Count focus time that really happened (a skipped phase counts only what elapsed). */
  addFocus(ms) {
    const k = this.dayKey();
    if (k !== this.focusDay) { this.focusDay = k; this.focusMsDay = 0; }
    this.focusMsDay += Math.max(0, ms);
  }

  focusMsToday() { return this.dayKey() === this.focusDay ? this.focusMsDay : 0; }

  reset() {
    this.phase = 'idle';      // idle | focus | break | long_break
    this.preset = 'pomodoro';
    this.endsAt = 0;
    this.remainingMs = 0;     // while paused
    this.paused = false;
    this.cycle = 0;           // completed focus phases in this run
  }

  cfg() {
    const p = (this.getSettings().pomodoro) || {};
    const pre = PRESETS[this.preset] || PRESETS.pomodoro;
    return {
      focus: (pre.focusMinutes || p.focusMinutes || 25) * 60000,
      break: (pre.breakMinutes || p.breakMinutes || 5) * 60000,
      longBreak: (pre.longBreakMinutes || p.longBreakMinutes || 15) * 60000,
      cyclesBeforeLong: p.cyclesBeforeLong || 4,
      autoContinue: p.autoContinue !== false,
      quiet: p.quietDuringFocus !== false
    };
  }

  durationOf(phase) {
    const c = this.cfg();
    return phase === 'focus' ? c.focus : phase === 'long_break' ? c.longBreak : phase === 'break' ? c.break : 0;
  }

  enter(phase) {
    this.phase = phase;
    this.paused = false;
    this.remainingMs = 0;
    this.endsAt = phase === 'idle' ? 0 : this.now() + this.durationOf(phase);
    this.emit('change', this.state());
  }

  start(preset = 'pomodoro') {
    this.reset();
    this.preset = PRESETS[preset] ? preset : 'pomodoro';
    this.enter('focus');
    return this.state();
  }

  pause() {
    if (this.phase === 'idle' || this.paused) return this.state();
    this.remainingMs = Math.max(0, this.endsAt - this.now());
    this.paused = true;
    this.emit('change', this.state());
    return this.state();
  }

  resume() {
    if (!this.paused) return this.state();
    this.endsAt = this.now() + this.remainingMs;
    this.paused = false;
    this.remainingMs = 0;
    this.emit('change', this.state());
    return this.state();
  }

  /** End the current phase now (counts as completed). */
  skip() {
    if (this.phase === 'idle') return this.state();
    this.advance();
    return this.state();
  }

  stop() {
    if (this.phase === 'idle') return this.state();
    this.reset();
    this.emit('change', this.state());
    return this.state();
  }

  nextPhase() {
    if (this.phase !== 'focus') return 'focus';
    return this.cycle % this.cfg().cyclesBeforeLong === 0 ? 'long_break' : 'break';
  }

  advance() {
    const ended = this.phase;
    if (ended === 'focus') {
      this.cycle++;
      const left = this.paused ? this.remainingMs : Math.max(0, this.endsAt - this.now());
      this.addFocus(this.durationOf('focus') - left);
    }
    const next = this.nextPhase();
    this.emit('phase-end', { ended, next, cycle: this.cycle, preset: this.preset, minutes: Math.round(this.durationOf(next) / 60000) });
    if (this.cfg().autoContinue) this.enter(next);
    else { this.phase = next; this.paused = true; this.remainingMs = this.durationOf(next); this.endsAt = 0; this.emit('change', this.state()); }
  }

  /** Call regularly (every second is plenty). */
  tick() {
    if (this.phase === 'idle' || this.paused) return null;
    if (this.now() >= this.endsAt) { this.advance(); return this.state(); }
    return null;
  }

  /** True while the timer wants the "deep focus" attention mode. */
  wantsQuiet() { return this.phase === 'focus' && !this.paused && this.cfg().quiet; }

  state() {
    const left = this.phase === 'idle' ? 0 : this.paused ? this.remainingMs : Math.max(0, this.endsAt - this.now());
    return {
      phase: this.phase,
      preset: this.preset,
      paused: this.paused,
      endsAt: this.paused ? 0 : this.endsAt,
      remainingMs: left,
      totalMs: this.durationOf(this.phase),
      cycle: this.cycle,
      quiet: this.wantsQuiet(),
      focusMsToday: this.focusMsToday()
    };
  }
}

module.exports = { Pomodoro, PRESETS };
