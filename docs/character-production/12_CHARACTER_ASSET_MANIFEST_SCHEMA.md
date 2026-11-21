# Character Asset Manifest (Schema Guidance)

Extend the two existing files — `assets/pet-manifest.json` (registry/status) and `assets/pets/{id}/pet.json` (per-character runtime config) — rather than adding a third manifest (CP-10). The production manifest is a machine-readable registry. Validate it against a formal JSON schema in implementation.

## Suggested fields
- characterId
- version
- status
- model: file, hash, status, compatibility
- rig: skeleton metadata, morph target metadata, semantic mappings
- animations: IDs, file/clip name, tags, status
- emotionMapping
- audio: IDs, files, event, emotion, channel, variants, cooldown, source, license, status
- assetVersion
- QA status
- fallback

Do not hardcode sample data into runtime without validation. A manifest error must not crash notifications or the app.
