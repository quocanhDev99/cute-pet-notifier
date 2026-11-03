/**
 * Emotion pose library — one table drives all characters ("1 model / 8 emotions").
 * Continuous params are blended smoothly by the animator; discrete params
 * (eyes / mouth / fx) switch at the start of the transition.
 *
 * Arm Z is "outward" (+) / "inward" (−) independent of side. Arm X < 0 swings forward/up.
 */
export const BASE_POSE = {
  lean: 0, squash: 1, lift: 0, bodyYaw: 0,
  tilt: 0, pitch: 0, yaw: 0,
  earLift: 0,
  armLx: -0.3, armLz: 0.22, armRx: -0.3, armRz: 0.22, armWave: 0,
  tailSpeed: 2.2, tailAmp: 0.25, tailLift: 0,
  blush: 0.42, cheek: 0,
  brow: 0, browAngle: 0, browY: 0,
  eyeScale: 1, eyeSquint: 1, lookY: 0,
  bounce: 0, bounceFreq: 6, sway: 0, swayFreq: 2, shake: 0, stomp: 0,
  breath: 0.016, breathFreq: 2.2, beakOpen: 0,
  eyes: 'open', mouth: 'w', fx: [], envelope: false, tears: false
};

export const EMOTION_POSES = {
  idle: {},
  happy: {
    eyes: 'arcHappy', mouth: 'smile', beakOpen: 0.5,
    armLx: -2.75, armLz: 0.35, armRx: -2.75, armRz: 0.35, armWave: 0.28,
    bounce: 0.1, bounceFreq: 6.5, tailSpeed: 9, tailAmp: 0.45, blush: 0.75, earLift: 0.25,
    fx: ['sparkles']
  },
  excited: {
    eyes: 'star', mouth: 'smile', beakOpen: 0.6, lean: 0.14, pitch: -0.18,
    armLx: -1.45, armLz: -0.28, armRx: -1.45, armRz: -0.28,
    bounce: 0.055, bounceFreq: 9, tailSpeed: 11, tailAmp: 0.4, earLift: 0.55, blush: 0.6,
    envelope: true, fx: ['stars']
  },
  love: {
    eyes: 'heart', mouth: 'w', blush: 1, tilt: 0.12,
    armLx: -2.45, armLz: -0.78, armRx: -2.45, armRz: -0.78,
    sway: 0.09, swayFreq: 1.6, tailSpeed: 3, tailAmp: 0.35, earLift: 0.1,
    fx: ['hearts']
  },
  surprised: {
    eyes: 'open', eyeScale: 1.28, mouth: 'o', beakOpen: 1,
    brow: 1, browAngle: 0.28, browY: 0.045, earLift: 1, lean: -0.12, lift: 0.03,
    armLx: -0.9, armLz: 1.05, armRx: -0.9, armRz: 1.05,
    tailLift: 0.6, tailSpeed: 16, tailAmp: 0.1, shake: 0.03,
    fx: ['sweat', 'exclaim']
  },
  angry: {
    eyes: 'open', eyeSquint: 0.6, mouth: 'pout', cheek: 1, blush: 0.95,
    brow: 1, browAngle: -0.5, browY: -0.012,
    armLx: -1.2, armLz: -0.95, armRx: -1.28, armRz: -0.95,
    shake: 0.2, stomp: 1, tailSpeed: 14, tailAmp: 0.4, earLift: -0.45,
    fx: ['vein', 'steam']
  },
  sad: {
    eyes: 'open', eyeScale: 0.92, lookY: -0.02, tears: true, mouth: 'wavy',
    brow: 1, browAngle: 0.45, pitch: 0.32, earLift: -1, lean: 0.12, squash: 0.96,
    armLx: -0.12, armLz: 0.06, armRx: -0.12, armRz: 0.06,
    tailSpeed: 0.8, tailAmp: 0.08, tailLift: -0.45, sway: 0.025, swayFreq: 0.8, breathFreq: 1.2,
    fx: ['tears']
  },
  thinking: {
    eyes: 'open', lookY: 0.035, mouth: 'flat', tilt: 0.48, pitch: -0.12,
    armRx: -2.3, armRz: -0.55, armLx: -0.65, armLz: -0.6,
    brow: 1, browAngle: 0.12, browY: 0.02, tailSpeed: 1.6,
    fx: ['question']
  },
  sleeping: {
    eyes: 'arcClosed', mouth: 'small', pitch: 0.38, lean: 0.26, squash: 0.9, lift: -0.04, earLift: -0.3,
    armLx: -0.6, armLz: -0.35, armRx: -0.6, armRz: -0.35,
    tailSpeed: 0.6, tailAmp: 0.06, breath: 0.05, breathFreq: 0.9, blush: 0.55,
    fx: ['zzz']
  }
};

/** Card-holding overlays, applied on top of the emotion pose. */
export const HOLD_POSES = {
  billboard: (side) => side === 'left'
    ? { armRx: -1.2, armRz: 1.2, bodyYaw: -0.32 }
    : { armLx: -1.2, armLz: 1.2, bodyYaw: 0.32 },
  peeker: () => ({ armLx: -1.6, armLz: -0.1, armRx: -1.6, armRz: -0.1, lean: 0.04 }),
  courierRun: () => ({ lean: 0.3, armLx: -1.45, armLz: -0.25, armRx: -1.45, armRz: -0.25, bounce: 0.08, bounceFreq: 14, envelope: true, tailSpeed: 12 }),
  courierPresent: () => ({ armLx: -2.0, armLz: -0.2, armRx: -2.0, armRz: -0.2, envelope: true })
};

export function resolvePose(emotion, hold) {
  const p = { ...BASE_POSE, ...(EMOTION_POSES[emotion] || {}) };
  if (hold) Object.assign(p, hold);
  return p;
}

/** Picked-up / grabbed pose (Blueprint §9.2): scruff stretch, startled face, lifted. */
export const GRAB_POSE = {
  squash: 1.18, lift: 0.5, lean: -0.05, pitch: -0.1, earLift: 0.9,
  armLx: -1.9, armLz: 0.65, armRx: -1.9, armRz: 0.65,
  eyeScale: 1.3, eyeSquint: 1, brow: 1, browAngle: 0.3, browY: 0.04,
  tailSpeed: 14, tailAmp: 0.25, bounce: 0, stomp: 0, shake: 0,
  eyes: 'open', mouth: 'o'
};

/**
 * Cross-fade durations (seconds) — Blueprint §5.3: 0.18 s – 0.35 s depending on the action.
 * Startles are fast, waking/sleeping are slow; `reduced` is the floor used with Reduced Motion.
 */
export const TRANSITION_PROFILES = {
  startle: 0.18,
  grab: 0.18,
  pet: 0.2,
  land: 0.25,
  default: 0.28,
  card: 0.3,
  wake: 0.35,
  sleep: 0.35,
  reduced: 0.35
};
