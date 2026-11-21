# Character QA and Acceptance

## Visual
Test 72/126/210/400 px pet height (00 §2 #4), dark/light backgrounds, transparent overlay, DPI scaling, Windows, materials, shadow, clipping and character switching.

## Animation
Idle smoothness, anticipation/follow-through, no pose pop, transitions, interruption, recovery, secondary motion, Reduced Motion, Focus/Hidden, suspend/resume.

## Audio
No clipping, loudness consistency, no spam, no immediate repeats, cooldown, mute, master/channel volumes, preview, sync, Focus, Hidden, Quiet Hours, Mode B, switching cleanup and graceful failure.

## Performance scenarios
Automate where possible (CP-11); extend `test/overlay.e2e.test.js` for checks that need the real overlay. Run together with the Blueprint Phase 4b soak test.

5-minute idle, 5-minute interactive, simulated notifications, repeated animation transitions, repeated audio events, 20 character-switch cycles, Hidden, Focus and suspend/resume. Record CPU, GPU, FPS, RAM, loading time, audio/animation latency and cleanup.

## Acceptance
A character is production-ready only when model/materials, rig, facial capability, core animation, secondary motion, audio identity, manifest, policy integration, performance and regression checks pass. Missing source/license metadata or critical runtime failure blocks approval.
