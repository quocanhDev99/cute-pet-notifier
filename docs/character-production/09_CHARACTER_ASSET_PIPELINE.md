# Character Asset Pipeline

## Suggested structure
assets/characters/{character_id}/references, concept, blender, model, textures, animations, audio, previews, metadata, production.

## Blender workflow
Reference -> model audit/cleanup -> topology -> UV -> materials -> rig -> facial rig -> secondary rig -> weight painting -> animation -> validation -> GLB export -> runtime QA -> optimization.

## Rig audit
Root, body, head, eyes, eyelids, ears, tail, limbs/paws, accessory and facial bones/morph targets as applicable. Character skeletons may differ; map to shared semantic interface rather than forcing identical rigs.

## GLB
Validate transforms, scale, skinning, materials, texture references, animation clips, morph targets, naming and file size. Keep Blender source.

## Audio
Preserve masters; runtime optimized files and metadata/license record. Prefer formats supported by existing runtime.

## Validation
Automated manifest validation where practical; missing assets and failed loads must degrade gracefully.
