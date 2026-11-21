# Cat Mochi Production Specification

## Identity
ID: `cat_mochi`. Personality: warm, curious, playful, gentle. Motion: soft, smooth, subtly expressive. Audio: purr, meow and curious chirp. Mochi is the production reference.

## Locked identity (from the running character, `species.js`)
Pastel-orange tabby with darker orange stripes, cream muzzle/belly, pink nose and inner ears, soft blush; **folded ears (Scottish Fold)**; curved cat tail; red ribbon collar with a gold bell; round head slightly wider than tall. Production refines this look — it does not replace it. Folded ears limit "ear reaction" to small flattening/lifting twitches.

## Preparation
Create front/side/back/three-quarter references, neutral and emotion expressions, palette, material notes, accessory notes and silhouette validation.

## Model audit and refinement
Head, eyes, eyelids, pupils, mouth, nose, whiskers if suitable, ears, body, paws, tail, optional ribbon/bell. Verify rig and morph targets before rebuilding anything.

## Facial capabilities
Blink, slow blink, double blink, squint, wide eyes, gaze, smile, mouth open, pout, head tilt, ear reaction, optional cheek expression and recovery. Use existing facial/morph system where possible.

## P0 animation
Runtime mapping (CP-02): `idle_breathing`→idle, `emotion_*`→the 8 emotions, `sleep_loop`→sleeping, `interaction_pet`/`interaction_head_rub`→pet, `interaction_pickup`→grabbed, `interaction_release`→land. `idle_look_around`, `idle_blink`, `idle_slow_blink`, `idle_head_tilt`, `idle_weight_shift`, `sleep_enter`, `sleep_wakeup` need runtime states first (CP-06, CP-07). Missing clips fall back to the procedural pose; never block notifications.

`idle_breathing`, `idle_look_around`, `idle_blink`, `idle_slow_blink`, `idle_head_tilt`, `idle_weight_shift`, `interaction_pet`, `interaction_head_rub`, `interaction_pickup`, `interaction_release`, `emotion_happy`, `emotion_excited`, `emotion_surprised`, `emotion_thinking`, `emotion_sad`, `emotion_angry`, `emotion_love`, `sleep_enter`, `sleep_loop`, `sleep_wakeup`.

## Audio identity
Soft, warm, curious, playful, short and non-verbal. Build event variants for petting, happy, excited, surprised, thinking (optional), sleeping (optional), wakeup, low/high notification reactions (policy-controlled), rare idle.

## Pilot DoD
Approved model/materials, facial capability, animation clips and transitions, secondary motion, audio pack and manifest, synchronized event integration, Focus/Hidden/Quiet Hours/Mode B behavior, QA and performance report.
