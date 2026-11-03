/**
 * AnimationController — the single owner of a character's animation state
 * (Blueprint V3.2 §5, Animation Guide §A4–A5). Pure logic: no Three.js, testable in Node.
 *
 * Layers
 *   1. Base        idle | sleeping            (presence / focus mode)
 *   2. Reaction    one of the 8 emotions      (notification card)
 *   3. Interaction grabbed (sustained)        (user, highest priority)
 *   4. Actions     pet · reject · kick · wave · jolt · land · pop (one-shot, additive envelopes)
 *   5. Face        eyes / mouth / fx — swapped behind a blink at mid-transition (no pops)
 *
 * Every change of target starts a timed transition from the *current blended pose*
 * (never from a stale pose), so retargeting mid-transition is seamless.
 */
import { BASE_POSE, EMOTION_POSES, HOLD_POSES, GRAB_POSE, TRANSITION_PROFILES } from './emotion-poses.js';

const NUMERIC_KEYS = Object.keys(BASE_POSE).filter(k => typeof BASE_POSE[k] === 'number');
const FACE_KEYS = ['eyes', 'mouth', 'envelope', 'tears'];
const OSCILLATION_KEYS = ['bounce', 'shake', 'sway', 'stomp', 'armWave'];

export const ACTION_DURATIONS = Object.freeze({ pet: 0.75, reject: 0.9, kick: 0.9, wave: 1.4, jolt: 0.45, land: 0.5, pop: 0.28 });
/** User-initiated actions outrank notification-driven ones (guide §A5). */
const ACTION_PRIORITY = Object.freeze({ kick: 6, reject: 6, pet: 6, land: 6, wave: 3, jolt: 4, pop: 2 });

const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function composeTarget({ base, reaction, hold, holdSide }) {
  const emotion = reaction || base || 'idle';
  const p = { ...BASE_POSE, ...(EMOTION_POSES[emotion] || {}) };
  if (hold && HOLD_POSES[hold]) {
    const h = HOLD_POSES[hold](holdSide);
    Object.assign(p, h);
    // Billboard: only the card-side arm holds the card; the free arm keeps the emotion.
    if (hold === 'billboard') {
      const emo = { ...BASE_POSE, ...(EMOTION_POSES[emotion] || {}) };
      if (holdSide === 'left') { p.armLx = emo.armLx; p.armLz = emo.armLz; } else { p.armRx = emo.armRx; p.armRz = emo.armRz; }
    }
  }
  return { pose: p, emotion };
}

function profileFor(fromEmotion, toEmotion, reason) {
  if (reason && TRANSITION_PROFILES[reason]) return reason;
  if (toEmotion === 'surprised') return 'startle';
  if (toEmotion === 'sleeping') return 'sleep';
  if (fromEmotion === 'sleeping') return 'wake';
  return 'default';
}

export class AnimationController {
  constructor({ onEvent = () => {} } = {}) {
    this.onEvent = onEvent;
    this.base = 'idle';
    this.reaction = null;
    this.hold = null;
    this.holdSide = 'left';
    this.reducedMotion = false;
    this.motionSpeed = 1;
    this.time = 0;
    this.actions = {};           // name -> { t, d }
    this.grabWeight = 0;
    this.grabbed = false;
    const { pose, emotion } = composeTarget(this);
    this.emotion = emotion;
    this.pose = { ...pose };
    this.face = Object.fromEntries(FACE_KEYS.map(k => [k, pose[k]]));
    this.fx = pose.fx || [];
    this.transition = null;      // { from, to, toFace, t, d, profile, swapped }
    this.lastProfile = null;
    this.suspendedFrames = 0;
  }

  /* ------------------------------------------------------------ requests */

  setBase(state) { if (state !== this.base) { this.base = state; this.retarget(); } }
  setReaction(emotion) { const e = emotion || null; if (e !== this.reaction) { this.reaction = e; this.retarget(); } }
  setHold(mode, side = 'left') {
    if (mode === this.hold && side === this.holdSide) return;
    this.hold = mode; this.holdSide = side;
    this.retarget('card');
  }
  setReducedMotion(on) { this.reducedMotion = !!on; }
  setMotionSpeed(v) { this.motionSpeed = Math.max(0.3, Math.min(2.5, v || 1)); }

  setGrabbed(on) {
    if (!!on === this.grabbed) return;
    this.grabbed = !!on;
    if (!on) this.trigger('land');
    this.onEvent('state', { interaction: on ? 'grabbed' : null });
  }

  /** One-shot actions. Returns false when blocked by a higher-priority action. */
  trigger(name) {
    const d = ACTION_DURATIONS[name];
    if (!d) return false;
    if (this.reducedMotion && (name === 'jolt' || name === 'pop')) return false;
    const blocking = Object.keys(this.actions).find(a => (ACTION_PRIORITY[a] || 0) > (ACTION_PRIORITY[name] || 0) && a !== name);
    if (blocking && !(name in { kick: 1, reject: 1, pet: 1, land: 1 })) return false;
    this.actions[name] = { t: 0, d };
    return true;
  }

  /** Progress 0..1 of an active action (null when inactive). */
  action(name) { const a = this.actions[name]; return a ? Math.min(1, a.t / a.d) : null; }
  /** Bell-shaped 0..1..0 envelope of an action. */
  envelope(name) { const u = this.action(name); return u === null ? 0 : Math.sin(u * Math.PI); }

  retarget(reason) {
    const { pose, emotion } = composeTarget(this);
    const profile = profileFor(this.emotion, emotion, reason);
    let d = TRANSITION_PROFILES[profile];
    if (this.reducedMotion) d = Math.max(d, TRANSITION_PROFILES.reduced);
    const toFace = Object.fromEntries(FACE_KEYS.map(k => [k, pose[k]]));
    this.transition = { from: { ...this.pose }, to: pose, toFace, t: 0, d, profile, swapped: false, faceChanges: FACE_KEYS.some(k => toFace[k] !== this.face[k]) };
    this.lastProfile = { profile, duration: d, from: this.emotion, to: emotion };
    if (emotion !== this.emotion) { this.emotion = emotion; this.trigger('pop'); }
    if (emotion === 'surprised') this.trigger('jolt');
    this.fx = pose.fx || [];
    this.onEvent('transition', this.lastProfile);
  }

  /* ------------------------------------------------------------ frame */

  /**
   * @param {number} rawDt seconds since last frame (may be huge after sleep/suspend)
   * @returns {{dt:number, time:number, pose:object, face:object, faceBlink:number, grab:number, fx:string[]}}
   */
  update(rawDt) {
    // Delta-time guard: a gap > 250ms means suspend/resume or a stalled tab → don't jump.
    let dt;
    if (!Number.isFinite(rawDt) || rawDt < 0) dt = 0;
    else if (rawDt > 0.25) { dt = 0; this.suspendedFrames++; }
    else dt = Math.min(0.05, rawDt);
    this.time += dt * this.motionSpeed;

    // One-shot actions
    for (const [name, a] of Object.entries(this.actions)) {
      a.t += dt;
      if (a.t >= a.d) { delete this.actions[name]; this.onEvent('action-done', { action: name }); }
    }

    // Grab layer weight (0.18s in, 0.25s out)
    const gTarget = this.grabbed ? 1 : 0;
    const gRate = dt / (this.grabbed ? TRANSITION_PROFILES.grab : TRANSITION_PROFILES.land);
    if (gTarget > this.grabWeight) this.grabWeight = Math.min(1, this.grabWeight + gRate);
    else if (gTarget < this.grabWeight) this.grabWeight = Math.max(0, this.grabWeight - gRate);

    // Pose transition
    let faceBlink = 1;
    const tr = this.transition;
    if (tr) {
      tr.t += dt * this.motionSpeed;
      const u = Math.min(1, tr.t / tr.d);
      const e = easeInOut(u);
      for (const k of NUMERIC_KEYS) this.pose[k] = tr.from[k] + (tr.to[k] - tr.from[k]) * e;
      if (tr.faceChanges) {
        // Hide the discrete face swap behind a quick blink centred at mid-transition.
        faceBlink = 1 - 0.92 * Math.sin(u * Math.PI);
        if (!tr.swapped && u >= 0.5) { Object.assign(this.face, tr.toFace); tr.swapped = true; }
      } else if (!tr.swapped) { Object.assign(this.face, tr.toFace); tr.swapped = true; }
      if (u >= 1) { Object.assign(this.face, tr.toFace); this.transition = null; }
    }

    // Grab overlay (blend toward the "picked up" pose by weight)
    const out = { ...this.pose };
    if (this.grabWeight > 0) {
      const w = easeInOut(this.grabWeight);
      for (const k of Object.keys(GRAB_POSE)) if (typeof GRAB_POSE[k] === 'number') out[k] = out[k] + (GRAB_POSE[k] - out[k]) * w;
    }
    const face = this.grabWeight > 0.5 ? { ...this.face, eyes: GRAB_POSE.eyes, mouth: GRAB_POSE.mouth } : { ...this.face };
    if (this.grabWeight > 0 && this.grabWeight < 1) faceBlink = Math.min(faceBlink, 1 - 0.9 * Math.sin(this.grabWeight * Math.PI));
    if (this.actions.pet) face.eyes = 'arcHappy';

    // Reduced motion: scale oscillation amplitudes down instead of removing life entirely.
    if (this.reducedMotion) for (const k of OSCILLATION_KEYS) out[k] *= 0.2;

    return { dt, time: this.time, pose: out, face, faceBlink, grab: this.grabWeight, fx: this.fx };
  }

  /** True while anything is still moving toward a target (render loop must keep running). */
  get busy() {
    return !!this.transition || Object.keys(this.actions).length > 0 || this.grabbed || (this.grabWeight > 0 && this.grabWeight < 1);
  }
}

export { composeTarget, NUMERIC_KEYS };
