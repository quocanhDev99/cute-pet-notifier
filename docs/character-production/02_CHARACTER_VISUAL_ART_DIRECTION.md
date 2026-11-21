# Character Visual Art Direction

## Art direction
Source of truth: Blueprint V4.1 §8.1 (stylized-realistic). This supersedes the "low-poly art toy / matte vinyl" look in `docs/guides/character/BLENDER_GUIDE.md` §3–4; that guide's technical limits (triangles, textures, export) still apply.

Premium Stylized Realism: cute, clean silhouette, expressive eyes and facial proportions, believable soft materials, controlled studio-like lighting, refined details, optimized for small desktop overlay.

## Visual quality checklist
- Silhouette and proportions remain readable at small sizes.
- Mesh, topology, UV, material and texture audit.
- Eye depth, pupil, highlights and eyelid capabilities.
- Mouth/nose/inner-ear material separation where appropriate.
- Accessory geometry and secondary motion only where justified.
- Consistent palette and visual identity per character.
- Soft lighting, fill and subtle rim; shadow quality and color management audited.
- Avoid heavy real-time fur, unnecessary postprocessing, excessive polygon counts or texture sizes.

## Rendering audit
Current renderer (`pet-stage.js`): WebGLRenderer alpha + antialias, DPR ≤ 2, sRGB output, ACES filmic, exposure 1.0, render-on-demand, 30 fps cap while only a resting mood is shown, full pause when Hidden/Gaming. No quality profiles yet (CP-08). Inspect renderer configuration, output color space, tone mapping, exposure, antialiasing, shadow maps, lighting, transparency, DPI scaling, quality profiles, render-on-demand behavior, GPU and memory use.

## Profiles
- Low: reduce shadow and render complexity.
- Balanced: default.
- High: higher quality when hardware allows.
Use a single renderer with configurable quality settings, not separate rendering implementations.

## QA
Test 72, 126, 210 and 400 px pet height (00 §2 #4); dark/light backgrounds; transparent overlay; DPI scaling; Windows; character switching; Focus/Hidden states.
