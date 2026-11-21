# Character Visual Art Direction

## Art direction
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
Inspect renderer configuration, output color space, tone mapping, exposure, antialiasing, shadow maps, lighting, transparency, DPI scaling, quality profiles, render-on-demand behavior, GPU and memory use.

## Profiles
- Low: reduce shadow and render complexity.
- Balanced: default.
- High: higher quality when hardware allows.
Use a single renderer with configurable quality settings, not separate rendering implementations.

## QA
Test 96, 128, 192 and 256 px; dark/light backgrounds; transparent overlay; DPI scaling; Windows; character switching; Focus/Hidden states.
