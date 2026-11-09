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
- Symphony Machine: `symphony/src/` (app.html, sym-engine.js, build.py, test.js). Own engine, built for BBC Symphony Orchestra Discover. Edit the source, run `python3 symphony/src/build.py`, then `node symphony/src/test.js`.
- Voice leading for chords and pad (E.leadVoices, from the Symphony Machine): after the melody ceiling, each block chord takes the closest voicing to the previous one without parallel fifths or octaves; rhythm untouched, own material untouched (band only runs on machine material). Measured over all genres: parallels 16.5% -> 5.4% of chord changes, voice movement 2.8 -> 2.0 semitones, beats bit-identical.
- Melody lessons from the Symphony Machine (band, scaled by E.WIND, off below 0.3): 8-bar phrase ends land on the root, 4-bar ends stay open on 3rd/5th; velocities lean toward the bar's high point; stepwise falling pairs on the beat sigh (second note softer, shorter). Measured: root at 8-bar ends 47 -> 68 percent, open 4-bar ends 49 -> 80 percent; note counts and beats identical.
