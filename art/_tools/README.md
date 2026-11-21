# Character audio pipeline tools

Reproduces `assets/pets/*/sounds/*.ogg` (CP-22, docs/character-production/00 + 08).
Needs Python 3.10+, `pip install numpy scipy imageio-ffmpeg` (static ffmpeg with libopus).
Run from this folder; downloads go to `raw/` here (git-ignored is fine).

1. `python fs_search.py cands.json` — Freesound search, **CC0 filter only**, prints candidates.
2. `python fs_fetch_analyze.py cands.json <ids…>` — re-checks CC0 on each sound page, downloads the HQ
   preview, prints length / SNR / noise floor / peak. Look at spectrograms before choosing.
3. Edit `PLAN` in `process_audio.py` (cut window, band-pass, gain per file), then
   `python process_audio.py <repo>` — writes the Opus files, copies sources to `art/{pet}/audio/source/`
   and the credits/processing record to `art/{pet}/audio/SOURCES.json`.
4. `python banks.py <repo>` — writes the emotion → sound groups into each `pet.json`.
5. `npm test` — `test/audio-controller.test.mjs` checks every bank file exists, is Ogg, < 64 KB and has a
   CC0 source record; the overlay e2e decodes every file in Chromium.

Only CC0 (or licences recorded and approved in SOURCES.json) may enter `assets/`. Listen to every file
before setting `humanListened: true`.
