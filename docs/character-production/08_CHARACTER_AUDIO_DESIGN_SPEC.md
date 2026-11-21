# Character Audio Design Specification

## Current state (v3.6.0)
- `src/renderer/js/sound.js` `SoundKit`: procedural Web Audio only (species voice meow/woof/squeak/chirp, emotion chimes, purr, bell, pop, whoosh, hmph). No audio files, channels, variants or cooldown.
- Spoken lines: `speechSynthesis` with the **OS voice** (Windows SAPI / macOS), fixed lines only (break reminder, pick-up, drop). Not Google TTS; never notification content. Opt-in for new installs since v3.6.0 (`sounds.voice=false`).
- Policy already in place: `sounds.enabled`, volume, Focus modes without sound, Hidden, attention `silent`, Mode B `notifications.companionSound` (pet quiet for events that have a system banner).

## Direction
Keep OS-voice speech out of the default pet identity (opt-in only). Do not read notification content aloud or make pets generic voice assistants. Use short, non-verbal character vocalizations and sound effects. Fixed AI-produced audio may be considered only after quality and license review; it is not runtime TTS.

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
Masters: WAV 48 kHz / 24-bit in `art/{id}/audio/` (not shipped). Runtime: OGG/Opus in `assets/pets/{id}/sounds/` (Blueprint §8.5).

Audio brief -> original/licensed recording or suitable fixed generated asset -> edit/clean -> loudness and peak QA -> export -> metadata/license -> manifest -> runtime validation.

## Metadata
ID, character, event, emotion, category/channel, filename, duration, source, license, loudness, cooldown, variation group, priority, status and fallback.

## Controller (CP-05)
There is no AudioController yet: evolve `SoundKit` into it (one module), route every playback call in `renderer.js` through it, and keep the procedural sounds as the per-event fallback when no file exists. Context inputs: character, event, emotion, interaction, presence, Focus, Quiet Hours, priority, cooldown, variation, volume, channel, concurrency, expiry, suspend/resume.
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
