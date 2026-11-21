# Character Production Master Plan

## Objective
Raise Cute Pet Companion's four characters to a consistent premium stylized-realism quality standard, with richer visuals, animation, personality, audio and interaction. Mochi is the pilot and production reference.

## Principles
- Audit before implementation; extend existing controllers and systems.
- Premium Stylized Realism; avoid photorealism and costly runtime fur.
- Small-overlay readability (96, 128, 192 and 256 px).
- Character identity comes from visual design, movement, expressions and audio—not generic TTS.
- Notifications remain non-intrusive; audio is policy-gated.
- Complete Mochi before productionizing Boba, Cloud and Pip.

## Phases
1. P0 Audit: repository, blueprint, assets, GLB, rig, animation, audio, controllers, policies, renderer, tests.
2. P1 Art direction and quality baseline.
3. P2 Mochi production asset, facial capability, animation, audio.
4. P3 Runtime integration and synchronization.
5. P4 QA, performance, regression and acceptance.
6. P5 Boba.
7. P6 Cloud.
8. P7 Pip.

## Task record
Each task must include ID, scope, dependencies, priority, files/modules affected, deliverable, verification, acceptance criteria, status and risks.

## Constraints
- Preserve Blueprint V4.1 and current canonical emotion IDs unless approved changes are documented.
- `idle`, `hidden`, `focused` remain presence/runtime states, not emotions.
- Do not duplicate AnimationController, EmotionController, AudioController, asset manager, event router or renderer.
- Do not expand notification features as part of this track except required integration and regression.
- Make changes incrementally and report blockers before making architecture-changing assumptions.
