# Character Asset Pipeline

## Structure (decided — 00 §2 #5)
Everything under `assets/` is packed into the installer, so source files live elsewhere.

```text
assets/pets/{character_id}/        shipped, read by the runtime
  pet.json                         semanticMap / clipAliases / morphMap / sounds / version
  model.glb                        optional; missing or broken -> procedural rig
  thumbnail.png
  sounds/*.ogg                     runtime encodes (CP-05, CP-22)
art/{character_id}/                NOT shipped - source of truth for artists (Git LFS recommended)
  references/  concept/  blender/  textures_src/  audio/ (WAV masters)  previews/  qa/
  LICENSES.md                      source, author, licence, date for every reference/asset
```

Users can also import their own `model.glb` per character from the Control Center (stored in userData, max 60 MB, glTF 2.0 magic checked).

## Blender workflow
Reference -> model audit/cleanup -> topology -> UV -> materials -> rig -> facial rig -> secondary rig -> weight painting -> animation -> validation -> GLB export -> runtime QA -> optimization.

## Rig audit
Root, body, head, eyes, eyelids, ears, tail, limbs/paws, accessory and facial bones/morph targets as applicable. Character skeletons may differ; map to shared semantic interface rather than forcing identical rigs.

## GLB
Validate transforms, scale, skinning, materials, texture references, animation clips, morph targets, naming and file size. Keep Blender source.

## Audio
Preserve masters; runtime optimized files and metadata/license record. Prefer formats supported by existing runtime.

## Validation
Runtime already reports `glb-info` (bones resolved, clips, morphs, triangles) and `fallback` events. Add an offline GLB check script (CP-09) and a manifest schema test (CP-10). Automated manifest validation where practical; missing assets and failed loads must degrade gracefully.
