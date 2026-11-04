/**
 * Eye-break reminder — after N minutes of ACTUAL screen use the pet suggests resting the eyes.
 *
 * - Counts active use only: ≥ 5 min of system idle (no mouse/keyboard), a locked screen or sleep
 *   resets the counter (the eyes already rested).
 * - Never nags at the wrong moment: while a blocking focus mode is on (meeting, deep focus,
 *   gaming, sleep/DND) the reminder waits until the mode ends.
 * - Snooze (10 min) and "break now" (pet sleeps with a countdown) come from the reminder card.
 * Pure logic: time / idle / mode are injected so it can be unit-tested.
 */
const { EventEmitter } = require('events');

const IDLE_RESET_SEC = 5 * 60;
const SNOOZE_MIN = 10;
const BLOCKING_MODES = new Set(['meeting', 'focus', 'gaming', 'sleep']);

class BreakReminder extends EventEmitter {
  /**
   * @param {{ getSettings: () => object, getIdleSeconds: () => number, getModeId: () => string, now?: () => number }} deps
   */
  constructor({ getSettings, getIdleSeconds, getModeId, now = Date.now }) {
    super();
    this.getSettings = getSettings;
    this.getIdleSeconds = getIdleSeconds;
    this.getModeId = getModeId;
    this.now = now;
    this.activeSince = now();
    this.snoozedUntil = 0;
    this.onBreakUntil = 0;
    this.pending = false; // a reminder card is out, waiting for an answer
    this.timer = null;
  }

  cfg() { const w = this.getSettings().wellbeing || {}; return { enabled: w.breakReminder !== false, every: (w.breakEveryMinutes || 60) * 60000, minutes: w.breakMinutes || 5 }; }

  start() { this.stop(); this.timer = setInterval(() => this.tick(), 30000); if (this.timer.unref) this.timer.unref(); }
  stop() { clearInterval(this.timer); this.timer = null; }

  /** Screen locked / system slept → counts as a rest. */
  rested() { this.activeSince = this.now(); this.pending = false; }

  tick() {
    const c = this.cfg();
    const t = this.now();
    if (!c.enabled) { this.activeSince = t; return null; }
    if (this.getIdleSeconds() >= IDLE_RESET_SEC) { this.rested(); return null; }
    if (t < this.onBreakUntil || t < this.snoozedUntil || this.pending) return null;
    if (BLOCKING_MODES.has(this.getModeId())) return null; // wait until the meeting / focus ends
    const usedMin = Math.round((t - this.activeSince) / 60000);
    if (t - this.activeSince < c.every) return null;
    this.pending = true;
    const r = { usedMinutes: usedMin, breakMinutes: c.minutes };
    this.emit('remind', r);
    return r;
  }

  startBreak() {
    const c = this.cfg();
    this.pending = false;
    this.onBreakUntil = this.now() + c.minutes * 60000;
    this.activeSince = this.onBreakUntil; // the next hour starts after the break
    this.emit('break', { minutes: c.minutes, until: this.onBreakUntil });
    return { minutes: c.minutes };
  }

  snooze() { this.pending = false; this.snoozedUntil = this.now() + SNOOZE_MIN * 60000; return { minutes: SNOOZE_MIN }; }

  dismiss() { this.pending = false; this.activeSince = this.now(); }
}

module.exports = { BreakReminder, IDLE_RESET_SEC, SNOOZE_MIN, BLOCKING_MODES };
