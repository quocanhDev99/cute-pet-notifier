# Character Audio Design Specification

## Direction
Remove Google TTS from default pet-character identity. Do not read notification content aloud or make pets generic voice assistants. Use short, non-verbal character vocalizations and sound effects. Fixed AI-produced audio may be considered only after quality and license review; it is not runtime TTS.

## Audio categories
1. Vocalization.
2. Interaction SFX.
3. Notification reaction SFX.
4. Ambient/behavioral audio (optional and user-controlled).

## Initial Mochi pack target
Planning target ~30-35 assets including variants and interaction sounds: happy, curious, excited, surprised, petting, purr, sleeping, wakeup, interaction, notification reactions and rare idle. This is a target, not a hard gate for early prototypes.

## Character identities
- Mochi: soft purr, meow, curious chirp; warm, playful.
- Boba: friendly short vocal, playful bark/whine/sniff; energetic but restrained.
- Cloud: gentle squeak/sniff; very quiet and sparse.
- Pip: quirky chirp/trill; distinctive but short.

## Production pipeline
Audio brief -> original/licensed recording or suitable fixed generated asset -> edit/clean -> loudness and peak QA -> export -> metadata/license -> manifest -> runtime validation.

## Metadata
ID, character, event, emotion, category/channel, filename, duration, source, license, loudness, cooldown, variation group, priority, status and fallback.

## Controller
Extend existing controller. Context inputs: character, event, emotion, interaction, presence, Focus, Quiet Hours, priority, cooldown, variation, volume, channel, concurrency, expiry, suspend/resume.
Responsibilities: policy gate, event priority, variant selection, cooldown, concurrency, playback, fade, sync, cancellation and cleanup.

## Channels
master, vocal, interaction, notification, ambient. Provide master/channel volume, mute, preview, reset and per-character controls where current UI patterns allow.

## Policy
Respect Focus, Hidden, Quiet Hours, user mute, Mode B duplicate-sound avoidance, notification priority, suspend/resume and character switching. Ambient off by default or user-controlled. Low-priority events may be visual only. Digest must not trigger repetitive sounds.

## Variation
Weighted selection, no immediate repeats, cooldown, narrow gain variation, optional timing variation; avoid excessive pitch shifting.

## Synchronization
Use a shared event contract for emotion, animation and audio; avoid direct playback calls scattered across UI components.

## QA
Clipping, loudness consistency, repeat/spam, cooldown, mute, channel controls, preview, sync, policy, cleanup and graceful failure.
