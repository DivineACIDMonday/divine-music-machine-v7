# Hidden genres

Hidden on 15 November 2026, until their deep upgrade (measured against reference tracks, like the eleven below).
They stay in the motor, so old songs still open and other machines can still borrow them. They are only not offered.

## Live (deep upgrade done)
Breakbeat, House, Synthwave, Hip hop, Trip hop, Techno, Acid, Drum and bass, Blues, Punk, New wave.

## Hidden
1. Divine Monday (divine)
2. Free flow (free)
3. Minimal techno (minimal)
4. Dub techno (dubtechno)
5. Club (club)
6. Trance (trance)
7. Eurodance (eurodance)
8. UK garage (garage)
9. EBM (ebm)
10. Chillout (chillout)
11. Ambient (ambient)
12. Dub (dub)
13. Funk and disco (funk)
14. Singer songwriter (songwriter)

## Still borrowed by a machine (keep these working in the motor)
- Ambient: the Director's Cinematic plays on the Ambient engine (director/src/app.html, ENGINE_GENRE).
- Chillout: the Director's "hands" beat style uses the Chillout beat (director/src/app.html, BEAT_GENRE).
- Free flow: the Studio's DIY "No shadows" starts a song in Free flow (tools/studio/app.html, makeSong('free')).

## Where the list lives
- Engine: E.HIDDEN_GENRES in engine/engine.js (E.GENRE_ORDER_FULL keeps the full list).
- Journey: JP.HIDDEN_STUDIO in journey/src/journey-plan.js (same list, by name).
- Sampler: the Burp genre dropdown in sampler/src/app.html (options removed by hand).

## To bring a genre back
Remove it from E.HIDDEN_GENRES and JP.HIDDEN_STUDIO, add its option back in the Sampler dropdown, then sync and build.
