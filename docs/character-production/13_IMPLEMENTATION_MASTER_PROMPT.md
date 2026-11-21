# CUTE PET COMPANION — CHARACTER VISUAL & AUDIO PRODUCTION MASTER PROMPT

You are a senior desktop application engineer, 3D character pipeline technical director, animation systems engineer, audio designer and QA engineer. Work directly within the existing Cute Pet Companion repository.

## Objective
Improve the four pet characters—Cat Mochi, Dog Boba, Bunny Cloud and Penguin Pip—through production-quality visual assets, expressive animation, character-specific audio, interaction and runtime integration. Prioritize Mochi as the production pilot. Do not expand unrelated notification features.

## Source of truth and audit
The first audit is done: start from `00_AUDIT_AND_TASKS.md` (module map, decisions, task IDs) and update it instead of producing a new one. Characters keep their current identity (`species.js`). Sizes: 72/126/210/400 px. Speech is the OS voice and opt-in, not Google TTS.

Read and reconcile the current repository docs, especially README, BLUEPRINT V4.1, Blender Guide, Animation and Realtime Notification Guide, architecture notes and existing implementation. Inspect actual code, GLB, rig, morph targets, animation, audio, manifest, controllers, renderer, notification integration, tests and asset status. Do not assume documentation reflects code.

Produce an audit report with:
- Existing systems/assets and paths.
- Current state and gaps.
- Reusable modules.
- Duplicate/obsolete paths to avoid.
- Blockers, risks and dependencies.
- Current audio/TTS usage and replacement plan.
- Baseline performance and QA evidence where available.

## Architecture constraints
- Preserve the existing application architecture and canonical emotion IDs: happy, excited, love, surprised, angry, sad, thinking, sleeping.
- idle, hidden and focused remain runtime/presence states, not emotions.
- Extend existing AnimationController, EmotionController, AudioController, event router, asset manager and renderer. Do not create duplicates.
- Do not rewrite notification architecture or expand unrelated notification features.
- Keep Mode B, Focus, Hidden, Quiet Hours, Reduced Motion, mute and notification policies.
- Avoid heavy real-time fur, excessive polygon/texture sizes, expensive postprocessing or needless continuous rendering.
- Make incremental changes with tests. Document any architectural deviation and ask for approval before destructive/rewrite changes.

## Art direction
Premium Stylized Realism, cute but refined, expressive, readable at 96–256 px, believable soft materials, quality lighting/shadows and character-specific silhouette/personality. Audit color management, output color space, tone mapping, exposure, anti-aliasing, shadows, materials, transparency, DPI and quality profiles (Low, Balanced default, High).

## Character production
### Mochi
ID cat_mochi. Warm, curious, playful and calm. Audit/refine head, eyes, eyelids, pupils, mouth, nose, ears, tail, paws and optional accessories. Implement/validate facial capability, blink variants, gaze, smile, mouth, head tilt, ear reaction and recovery using existing systems. Core clips: breathing, look-around, blink/slow blink, head tilt, weight shift, pet/head rub, pickup/release, happy/excited/surprised/thinking/sad/angry/love, sleep enter/loop/wakeup. Audio identity: short warm purr/meow/chirp, never generic TTS.
### Boba
ID dog_boba. Friendly, energetic, playful. Tail, ears, mouth, paws and optional collar. Clips include breathing, look-around, tail wag, ear reaction, head tilt, pet, jump, paw, pickup/release, canonical emotions and sleep/wakeup. Audio: short friendly vocalizations, playful bark/whine/sniff, restrained and non-repetitive.
### Cloud
ID bunny_cloud. Gentle, calm, shy. Ears, eyes, soft silhouette and pastel palette. Clips include breathing, ear sway/reaction, blink/slow blink, head tilt, look-around, pet, nuzzle, hop, pickup/release, canonical emotions and sleep/wakeup. Audio: gentle, sparse squeaks/sniffs, low volume.
### Pip
ID penguin_pip. Quirky, curious, expressive. Compact silhouette, wings, beak, feet and belly materials. Clips include breathing, wobble, look-around, head tilt, wing motion, blink, pet, waddle, hop, optional spin, pickup/release, canonical emotions and sleep/wakeup. Audio: short quirky chirps/trills.

## Animation quality
Use logical layers: base, secondary, facial, interaction, emotion and special. Every authored clip should have anticipation, action, follow-through, settle and recovery where appropriate. Blend transitions, interrupt safely, return to base idle and prevent pose popping. Microbehavior uses weighted selection, cooldown, suppression and cancellation—not random behavior every frame. Respect Focus, Hidden, Reduced Motion and suspend/resume.

## Audio system
Remove Google TTS from default character identity pipeline; do not read notification contents aloud. Do not create long character dialogue or generic voice assistant behavior. Produce or source original/licensed fixed sound assets, including AI-generated fixed assets only after quality/license review. Preserve source and license metadata.

Build/extend one AudioController with context gating, event priority, asset variants, cooldown, concurrency, fade, playback, sync and cleanup. Channels: master, vocal, interaction, notification, ambient. Provide volume, mute, preview and reset controls using existing UI conventions. Ambient off by default or user-controlled. Avoid immediate repeats and sound spam. Respect Focus, Hidden, Quiet Hours, Mode B duplicate-sound avoidance and notification priority. Audio failure must not break character, animation or notification flow.

## Asset pipeline
Define a structured asset directory for references, concept, Blender source, model/GLB, textures, animation, audio, preview, metadata and production versions. Audit rig/mesh/UV/materials/scale/transforms/clip names/morph targets. Keep Blender source. Validate GLB and runtime loading. Create a manifest and schema validation; missing assets should fail gracefully.

## Integration
Use a shared event contract for emotion, animation and audio. Avoid direct playback or animation calls scattered in UI components. Audit lifecycle, switching, hidden/suspend, listeners and disposal. Dispose textures/materials/geometries and release stale playback/listeners appropriately.

## Implementation order
1. Audit and report; no implementation assumptions.
2. Define art direction and production baseline.
3. Complete Mochi asset/rig/facial/animation/audio pilot.
4. Integrate shared event and controller behavior.
5. QA and benchmark Mochi; resolve defects.
6. Apply proven pipeline to Boba.
7. Apply to Cloud.
8. Apply to Pip.
Do not parallelize all character production before pilot acceptance.

## QA and DoD
Test visuals at 96, 128, 192 and 256 px on light/dark backgrounds, overlay, DPI scaling and Windows. Test animation transitions, interruptions, recovery, Focus/Hidden/Reduced Motion and suspend/resume. Test audio clipping/loudness, variants, repeat/cooldown, mute, channels, preview, sync, Quiet Hours, Mode B and cleanup. Test idle, interactive, simulated notification, repeated transitions/events, switching and suspend/resume. Record CPU, GPU, FPS, RAM, loading time, audio/animation latency and resource cleanup.

A character is production-ready only when assets, rig, facial capability, core animations, secondary motion, audio identity, manifest, policy, performance, QA and regression are approved.

## Deliverables
1. Audit report.
2. Updated/new documentation files following the proposed 12-document structure.
3. Task breakdown with IDs, dependencies, priorities, files/modules, tests and acceptance criteria.
4. Mochi pilot implementation and evidence, when safe and feasible.
5. Asset production briefs and manifests.
6. QA and performance report.
7. Explicit list of completed, pending, blocked and deferred work.
8. Before/after evidence (screenshots, clips, logs or metrics where possible).

## Working rules
- Inspect before changing.
- Reuse existing architecture.
- Do not invent assets or claim tests passed without evidence.
- Do not overwrite user assets without backup or approval.
- Keep changes small, reviewable and reversible.
- If an asset requires external production, create a detailed brief and mark it pending instead of fabricating a finished asset.
- Prioritize quality, expressive personality and non-intrusive desktop experience.
