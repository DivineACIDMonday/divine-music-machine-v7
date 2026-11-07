# One engine for every app

The music engine (genres, generators, arrangement, the band, feel, MIDI) lives in ONE file:

    engine/engine.js

Every app page carries a copy of it inline, so each page stays one self-contained file that works on its own. Never edit the engine inside a page.

## To change the engine
1. Edit `engine/engine.js`.
2. Run `python3 tools/sync_engine.py "<version>"`. It writes the engine into:
   - Machine: `index.html`, `lite/`, `groove/`
   - UJAM: `ujam/`, `ujam/lite/`, `ujam/groove/`, `lite/ujam/`
   - Divine Groove Machine: `../divine-groove-machine/index.html` (its own repo, commit it there too)
   - and builds the Studios (`studio/`, `studio/groove/`, `ujam/studio/`, `ujam/studio/groove/`) from `tools/studio/app.html`.
3. Test, then commit both repos.

## App differences live in flags, not in copies
- `window.DMM_UJAM`: UJAM pages (own recent-songs list, UJAM plugins only via the Studio patch in `tools/ujam_build.py`).
- `window.DMM_LITE`, `window.DMS_GROOVE`: set by the page.
- `song.dgm` (set by `E.makeGroove`): a Groove Machine song, the beat is always yours.

## Other sources in the repos
- Studio UI: `tools/studio/app.html`, built by `tools/studio/build.py`.
- Score Machine: `score/index.html` is its own source (own engine).
- Percussion Machine: `divineacidmonday.github.io/percussion/src/` (app.html, perc-engine.js, build.py).
