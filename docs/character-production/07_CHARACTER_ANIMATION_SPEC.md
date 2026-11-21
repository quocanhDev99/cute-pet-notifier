# Character Animation Specification

## Existing implementation
`src/renderer/js/pet/animation-controller.js` already has 5 layers — Base (idle/sleeping), Reaction (8 emotions), Interaction (grabbed), Actions (pet, reject, kick, wave, jolt, land, pop), Face (swapped behind a blink) — with cross-fades from the current blended pose. The logical layers below map onto it; extend it, don't add a second controller. Clip naming → runtime state mapping: `semantic-map.js` `DEFAULT_CLIP_ALIASES`.

## Layers (logical)
- Base: idle, breathing.
- Secondary: ears, tail, accessories.
- Facial: blink, gaze, expression.
- Interaction: pet, pickup, release.
- Emotion: canonical emotion actions.
- Special: sleep/wakeup.

## Lifecycle
Event -> resolve context/emotion -> resolve clip -> priority -> blend -> playback -> secondary motion -> recovery -> base idle.

## Principles
Anticipation, primary action, follow-through, settle, recovery and secondary motion. No mechanical point-to-point bone rotations. Smooth transitions and interruption recovery.

## Micro-animation (CP-06, not implemented yet)
Weighted behaviors with cooldown, duration, suppression, cancellation and controlled randomness. Do not randomize every frame.

## Policies
Respect Focus, Hidden, Reduced Motion, suspend/resume and character switching.

## Canonical emotions
happy, excited, love, surprised, angry, sad, thinking, sleeping. Runtime states `idle`, `hidden`, `focused` are not emotions.

## QA
Clip integrity, transitions, pose popping, interruption, idle fallback, secondary motion, reduced motion, performance and cleanup.
