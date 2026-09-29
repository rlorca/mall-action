# MALL ACTION

An 8-bit spy caper in a neon 1980s mall. Zip onto the roof, ride the elevators, recover six secret packages, and escape in the wood-panelled wagon. A FLICKERSOFT game built as the GPT-6 Sol one-shot benchmark entry.

**[Play in your browser](https://rlorca.github.io/mall-action/gpt-6.sol/)**

![Title screen](screenshots/title.png)
![Mall action](screenshots/mall.png)

## Features

- Six floors, three elevators with different routes, two escalators, shops, spies, power-ups, mall oddballs and a getaway car.
- Ten explorable stores with distinct rooms, fixtures, guards, music and jokes. Six contain packages.
- Procedural pixel art, synthesized four-channel music and sound, and an optional CRT effect.
- Seeded game rules and a debug stepping API for repeatable playtests.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows, WASD | D-pad, left stick |
| Shoot | Z, J | A |
| Jump / search | X, K, Space | B |
| Map | Shift, Tab | Select |
| Pause / confirm | Enter | Start |
| CRT | C | — |
| Sound | M | — |

**Tips:** Hold Up or Down near an elevator to board or call it. Inside, drive with Up or Down and walk out with Left or Right at a stop. In a store, touch a fixture and tap X once; the search finishes on its own. Press Down at the doorway to leave. The getaway car is on P, served by elevator B.

## Run and inspect

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
```

`dist/` contains a static build with relative asset paths. `?seed=7` fixes the random seed. `?debug=1` skips the splash and exposes `window.mallAction.state` and `window.mallAction.step(frames, buttons)`. `?gallery=1` shows the sprite gallery.

## Project layout

- `src/rules.js` — frame-based game rules and seeded randomness.
- `src/data.js` — stores, room plans, jokes, palette and music metadata.
- `src/render.js`, `src/sprites.js`, `src/font.js` — pixel art and canvas drawing.
- `src/audio.js` — original synthesized music and effects.
- `src/input.js`, `src/loop.js`, `src/main.js` — controls and browser loop.
- `src/splash.js` — reusable studio splash; see [its README](src/splash.README.md).
- `tests/` — automated rules and pipeline checks.

Add or edit jokes in `src/data.js`. All game logic uses a deterministic seed, frame counts, and browser-free modules.

## Benchmark notes

Model: GPT-6 Sol (`gpt-6-sol`). Date: 2026-09-29. Harness: Codex in the shared workspace. Reasoning setting: default. Time: about 45 minutes. Intervention: branch name corrected from `gpt-6` to `gpt-6-sol` before any implementation commits.

*A FLICKERSOFT fan homage. Not affiliated with Taito or any parodied brand.*
