# Cute Pet Companion — Character Sample Visual Reference

> **Identity lock (21/11/2026):** the briefs below describe the characters as they exist in the app (`src/renderer/js/pet/species.js`); production refines them and must not change palette, ears, tail or signature accessory without a recorded decision (see `00_AUDIT_AND_TASKS.md` §2 #1). An earlier version of this file described different looks (cream-white Mochi, floppy-eared Boba, charcoal Pip); those were not approved identities.
>
> **Status:** Visual direction and reference brief. This file is not a set of final approved character renders. New concept-image generation was unavailable when this file was prepared.

## Shared art direction

- **Style:** Premium Stylized Realism — polished, soft 3D characters with believable materials, but exaggerated, readable silhouettes and expressive faces.
- **Target size:** Readable at the pet heights the app renders: 72, 126, 210 (default) and 400 px.
- **Lighting:** Soft studio key light, gentle rim light, ambient occlusion kept subtle; avoid harsh shadows.
- **Materials:** Soft fur/fabric-like surfaces where appropriate, refined eye highlights, restrained roughness variation; no noisy textures.
- **Shape language:** Rounded, friendly, compact forms; avoid overly thin limbs or cluttered accessories.
- **Composition:** Character centered, full body, three-quarter view, neutral studio background, with front/side/back turnaround and expression thumbnails in production sheets.

## 1. Cat Mochi — production pilot

**Visual brief:** Compact pastel-orange tabby kitten with soft darker-orange stripes, cream muzzle and belly, round head slightly wider than tall, **folded ears (Scottish Fold)**, soft cheeks with a light blush, short legs, large glossy but not oversized eyes, tiny pink nose and a gently curved tail. Signature accessory: red ribbon collar with a small gold bell (keep it simple and rig-friendly).

**Personality cues:** Warm, curious, playful, affectionate. Expression range should be conveyed primarily through eyelids, ears, mouth and tail.

**Reference search:** [Stylized 3D kitten character design](https://www.google.com/search?tbm=isch&q=premium+stylized+3D+kitten+character+design)

**Concept-sheet requirements:** Front / 3-quarter / side / back; happy, excited, surprised, curious, sad, sleepy; idle, stretch, tail-sway and small playful interaction poses.

## 2. Dog Boba

**Visual brief:** Small rounded corgi puppy, golden-honey coat with snow-white muzzle and chest, **upright pointed ears**, short legs, long low body, **stub tail**, little bean-shaped brows, dark nose. Signature accessory: light-blue bandana.

**Personality cues:** Energetic, friendly, playful. Avoid frantic motion; short bursts followed by clear settle poses.

**Reference search:** [Stylized 3D puppy character design](https://www.google.com/search?tbm=isch&q=premium+stylized+3D+puppy+character+design)

**Concept-sheet requirements:** Front / 3-quarter / side / back; happy, excited, surprised, thinking, sleepy; rump wiggle (stub-tail wag), sniff, head tilt and playful bounce.

## 3. Bunny Cloud

**Visual brief:** Snow-white round bunny, **long ears with peach-pink tips**, pink nose, strong soft blush, small paws, puff tail and gentle facial proportions. Signature accessory: a small green sprout on top of the head. Ears are the main secondary-motion feature.

**Personality cues:** Calm, gentle, shy, reassuring. Use small gestures, ear motion and quiet reactions rather than large movement.

**Reference search:** [Stylized 3D bunny character design](https://www.google.com/search?tbm=isch&q=premium+stylized+3D+bunny+character+design)

**Concept-sheet requirements:** Front / 3-quarter / side / back; happy, love, shy, surprised, sad, sleepy; ear droop, ear perk, small hop and settle.

## 4. Penguin Pip

**Visual brief:** Tiny rounded penguin with a **pastel slate-blue** body, white belly and face mask, orange beak and feet, short flippers and a compact belly. Signature accessory: yellow knit beanie. Make the silhouette clear and expressive at small scale.

**Personality cues:** Quirky, curious, slightly clumsy but charming. Wobble and wing gestures should be controlled and readable.

**Reference search:** [Stylized 3D penguin character design](https://www.google.com/search?tbm=isch&q=premium+stylized+3D+penguin+character+design)

**Concept-sheet requirements:** Front / 3-quarter / side / back; happy, excited, surprised, thinking, sleepy; wobble, wing flap, head tilt and tiny step.

## Recommended image references to collect

For each character, collect references for:
1. **Model/style:** 3–5 full-body images showing silhouette, materials and proportions.
2. **Face:** 2–3 close-up images showing eyes, eyelids, brows, mouth and emotional readability.
3. **Pose:** 3–5 images showing idle posture, interaction, anticipation and settle.
4. **Material:** 1–2 images for fur softness, eye material and lighting.

Use reference images as visual inspiration only. Do not directly copy a third-party character or artwork. Final assets should be original and cleared for use.

## Image-generation prompts for future concept sheets

### Mochi
> Create an original premium stylized-realism 3D desktop companion kitten named Mochi. Compact pastel-orange tabby with soft darker-orange stripes, cream muzzle and belly, folded ears like a Scottish Fold, rounded head and blushing cheeks, short legs, large expressive glossy eyes, tiny pink nose, subtle soft-fur surface, curved tail, red ribbon collar with a small gold bell, warm and curious personality. Show a clean character design sheet with front, three-quarter, side and back views plus six face expressions. Soft studio lighting, neutral background, high-quality game-character sculpt, clean silhouette, no text, no logos.

### Boba
> Create an original premium stylized-realism 3D desktop companion corgi puppy named Boba. Compact golden-honey and snow-white corgi, upright pointed ears, rounded muzzle, little bean-shaped brows, short legs, stub tail, light-blue bandana, friendly playful personality. Clean character sheet with front, three-quarter, side and back views plus expression thumbnails. Soft studio lighting, neutral background, polished game-character sculpt, no text, no logos.

### Cloud
> Create an original premium stylized-realism 3D desktop companion bunny named Cloud. Snow-white compact bunny, long ears with peach-pink tips, soft blush, small paws, puff tail, a small green sprout on top of the head, rounded body and shy gentle personality. Clean character sheet with front, three-quarter, side and back views plus expression thumbnails and ear poses. Soft studio lighting, neutral background, polished game-character sculpt, no text, no logos.

### Pip
> Create an original premium stylized-realism 3D desktop companion penguin named Pip. Tiny rounded pastel slate-blue penguin with white belly and face mask, orange beak and feet, short expressive flippers, yellow knit beanie, compact belly and quirky curious personality. Clean character sheet with front, three-quarter, side and back views plus expression thumbnails and wobble poses. Soft studio lighting, neutral background, polished game-character sculpt, no text, no logos.

## Approval checklist

- [ ] Silhouette is recognizable at 72 px (smallest pet height in the app).
- [ ] Matches the locked identity (palette, ears, tail, accessory) of the running character.
- [ ] Character is visually distinct from the other three.
- [ ] Eyes, mouth, ears / tail / wings support expression and animation.
- [ ] Material and lighting match the shared art direction.
- [ ] Model is rig-friendly and does not rely on complex accessories.
- [ ] Reference sources are recorded and usage rights are reviewed.
- [ ] Final concept is original and approved before production modeling.
