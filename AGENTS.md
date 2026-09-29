# MALL ACTION — implementation notes

This branch is the independent GPT-6 Sol benchmark implementation. Never merge another model's implementation into it. The shared specification lives on `main` and is read only.

## Architecture

- `src/rules.js`: deterministic, browser free 60 Hz game rules. `step(state, input)` returns a fresh state and event list. All random choices use the integer seed in state.
- `src/data.js`: stores, room plans, copy, music data, and fixed palette.
- `src/input.js`: keyboard and gamepad merged into NES buttons; pressed edges are queued.
- `src/render.js`: 256×240 canvas rendering, procedural pixel art, UI, and CRT composite. Rendering never changes game state.
- `src/audio.js`: Web Audio synthesis, silent until interaction.
- `src/splash.js`: reusable FLICKERSOFT splash timing and drawing.
- `src/main.js`: browser loop, fixed step accumulator, debug and gallery modes.

## Rules that must hold

Use frame counts for all timers. Keep randomness inside the rules module and seeded. Keep DOM, canvas, audio, and storage out of rules. Use relative paths for all resources so a build works in a subdirectory. Every game change should remain operable with keyboard and gamepad.

## Verify

Run `npm test` and `npm run build`. In a browser check a normal start, a store search, map and pause, and the debug URL `?debug=1&seed=7`. The local dev server is `npm run dev`.

## Gotchas

The simulation can run several times per paint, so input press edges must be consumed by one simulation step only. Keyboard releases use the mapping captured on keydown; the active layout can change while a key is held. The CRT surface must be redrawn each frame and must not hide the base canvas.
