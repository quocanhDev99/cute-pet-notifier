# Character Animation Specification

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

## Micro-animation
Weighted behaviors with cooldown, duration, suppression, cancellation and controlled randomness. Do not randomize every frame.

## Policies
Respect Focus, Hidden, Reduced Motion, suspend/resume and character switching.

## Canonical emotions
happy, excited, love, surprised, angry, sad, thinking, sleeping. Runtime states `idle`, `hidden`, `focused` are not emotions.

## QA
Clip integrity, transitions, pose popping, interruption, idle fallback, secondary motion, reduced motion, performance and cleanup.
