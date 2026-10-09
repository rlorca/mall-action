# MALL ACTION — Astra implementation

This orphan branch is an independent benchmark. Do not merge other implementation histories or edit the shared prompt on main.

## Architecture

- `src/rules.js`: deterministic 60 Hz simulation, explicit input and event output. No DOM, audio, clock, storage or unseeded randomness.
- `src/data.js`, `src/copy.js`: content and hand-authored room templates. Copy lives together.
- `src/art.js`: source-generated pixel sprites, font and fixed palette.
- `src/render.js`, `src/crt.js`: drawing and optional WebGL monitor postprocess. Rendering cannot change rules.
- `src/audio.js`: four synthesized NES-like channels; consumes events.
- `src/input.js`: printed-letter mapping, physical release identity, queued taps and capped fixed loop.
- `src/main.js`: browser adapter; persistence and debug interface.
- `src/splash/`: reusable independent studio ident.

All gameplay time is in frames. Randomness must use the state PRNG. All pixel positions are rounded when drawn; sprite palettes contain at most three opaque colours. Assets are generated from source. Build URLs must stay relative.

## Verification

`npm ci && npm test && npm run build`; `npm run dev` for a real browser. Test with CRT enabled and seed 7. `?debug=1&seed=7` exposes `window.mall`: state, step(frames, buttons), input, rules, stop()/start(). Debug stepping pauses the real-time loop until start(). Inspect splash separately without debug. `?gallery=1` animates the sprite catalogue.

CI publishes only this branch into `gpt-6.astra/`, preserving other entries in gh-pages. Never hand-edit generated gh-pages.

## Gotchas found by live play

- Interaction zones must not overlap: the photo booth is at x=410 on 3F, clear of the escalator at x=352.
- Respawn invulnerability must cover falling/rolling hazards as well as bullets. A suspended hazard otherwise kills again on the first respawn frame.
- Keep queued presses in chronological order across duplicate presses; this affects fast Konami input as well as gameplay taps.
- Sprite preview scales (map/newspaper) must still round every destination pixel boundary, not just the sprite origin.
- A continue inside a store restores the death location and persistent fixture state; ordinary life respawns use the mall's last safe spot.
- Tests use explicit fixture state for rare events; browser playtest notes must distinguish assisted scenarios from normal play.
