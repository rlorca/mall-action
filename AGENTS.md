# AGENTS.md — working on Mall Action

Guidance for AI coding agents (and humans) changing this repo. Read this before editing.

## What this is

A browser game by **FLICKERSOFT**: a spiritual successor to Taito's *Elevator Action*, set in an 80s shopping mall.

- **The mall** is side-scrolling. It has 6 floors, 3 elevator shafts and 2 escalators.
- **The stores** are top-down, Zelda-style. You search fixtures in them for 6 packages.
- **Everything is generated in code.** Pixel art, font, music and sound effects are all authored in source. There are no asset files; keep it that way.

The design spec and the original build plan are in `docs/superpowers/`. The spec is the reference for how the game should behave.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest, must stay green (300+ tests)
npm run build      # must succeed, output in dist/
```

A push to `main` runs `.github/workflows/pages.yml`, which runs `npm ci`, `npm test` and `npm run build`, then deploys to https://rlorca.github.io/mall-action/. **A red test suite blocks the deploy.**

## Architecture

```
src/core        loop (fixed 60 Hz), input (keyboard/gamepad → virtual NES pad), rng, scene manager
src/audio       WebAudio NES-style synth; music.js (tracks as note strings), sfx.js
src/gfx         palette (NES colours), grid→texture, 8×8 font (glyphs.js), sprites/ (pixel grids as code)
src/world       constants, mall layout (mallLevel.js), store room templates, per-level setup
src/logic       pure rules: physics, elevators, scoring/difficulty, power-ups, loot, NPC rules, secrets
src/game        pure simulation: mallWorld/mallPlayer/spies/combat/lights/mallNpcs, storeWorld/storeExtras, humor.js
src/scenes      PixiJS scenes and overlays (title, mall, store, map, pause, continue, level clear, game over)
src/flickersoft the FLICKERSOFT boot splash, shared across FLICKERSOFT games (see its README)
src/ui          HUD
tests           Vitest specs
tools/shot.mjs  headless-Chrome driver for screenshots and playtests
```

### Rules that keep it working

- **The simulation is pure.** `src/logic`, `src/world`, `src/game` and `src/audio/notes.js` must not import `pixi.js` or touch `window` or `document`. They change plain objects and return **events** (`{ type: 'sfx' | 'music' | 'banner' | 'enterStore' | … }`). The scenes turn those events into sound and visuals.
  - `stepMall(world, pad, state, rng)` is the mall's update step.
  - `stepStore(world, pad, state, rng)` is the store's.
- **Scenes only render.** A scene calls the step function, handles the events, then syncs sprites from the world state.
  - The Pixi scene contract is `{ container, enter(ctx, params), update(ctx), exit(ctx) }`.
  - Overlays (map, pause, continue) are pushed on top of the current scene. The world doesn't step while one is open.
- **Extension points instead of edits to core flow:**
  - `world.upHooks`: actions for Up pressed in the mall, such as the kiosk, photo booth and getaway car.
  - `bulletHooks` in `combat.js`: extra bullet targets.
  - `storeHooks` in `storeWorld.js`: `create`, `beforeReveal`, `bulletSolid` and `step`.
- **Game state lives in `ctx.state`** and is created by `createGameState` in `src/game/state.js`. It holds the score, lives, continues, loop, packages, cleared stores, power-ups, inventory and seeded rng. Always use `state.rng` for randomness, never `Math.random`, so the seeds stay reproducible. The one exception is cosmetic effects in the renderer.
- **Units:**
  - Time is in **frames** at 60 per second.
  - The screen is 256×240, with a 16 px HUD at the top.
  - Mall floors are indexed 0 to 5 (R, 4F, 3F, 2F, 1F, P). `feetY(i) = 72 + 48*i`.
  - Store rooms are 16×11 tiles of 16 px.

## Conventions

- **TDD.** Write the failing test first and watch it fail, then implement. Game rules belong in pure modules precisely so they can be tested this way.
- Match the surrounding style: ES modules, 2-space indent, single quotes, small focused files, sparse comments that explain *why*.
- **Sprites** are string grids in `src/gfx/sprites/*.js`.
  - `'.'` is transparent, and `'1'`, `'2'`, `'3'` are palette slots. **3 colours at most per sprite**, taken from `C` in `palette.js`.
  - Add every new sprite to the size table in `tests/sprites.test.js`.
  - Browse all sprites with `?gallery=1`.
- **Text:**
  - The 8×8 font is uppercase only. `^ _ < >` draw **arrows** (↑ ↓ ← →) and `♥` is a heart, so don't use `_` or `<` as literal characters.
  - Store signs use the 3×5 micro font in `sprites/tiny.js`.
- **Jokes and copy** live in `src/game/humor.js` and `QUIPS` in `src/game/storeExtras.js`. Tests enforce the length limits:
  - Speech bubbles: 28 characters.
  - SPYGRAM caption lines: 21 characters.
  - Headlines: 26 characters per line.
- **Music** lives in `src/audio/music.js`, written as note strings (`C4:2 -:2 …`, measured in 16th-note steps). Every channel in a track must have the same total length; there's a test for it. Each store has its own track, named `store_<id>`.
- **Parody names only.** Stores and brands are puns (RadioShock, GameStonk, SPYGRAM). Never use real logos, trade dress or exact real names.

## Verifying changes

1. Run `npm test` and `npm run build`.
2. For anything visual or input-related, look at it in a real browser.
   - `?debug=1` exposes `window.__mall` (the game's `ctx`) and `__mall.drive(buttons, frames)`. That call steps the game deterministically and pauses the real-time loop.
   - `?seed=N` fixes the random seed.
   - `tools/shot.mjs` scripts headless Chrome through a session. Its steps are `wait:ms`, `key:Code`, `hold:Code:ms`, `down:`/`up:`, `shot:name` and `eval:js`. Example:
     ```bash
     node tools/shot.mjs "http://localhost:5173/?debug=1&seed=3" /tmp/shots \
       "eval:__mall.drive(['start'],1); __mall.drive([],200)" shot:mall
     ```
3. **Also test in real time with the CRT filter on**, not only with `drive()`. The CRT is on by default for players, and some bugs only appear there.

## Hard-won gotchas

- **Don't use `cacheAsTexture()` while the CRT filter is active.** In Pixi 8 it turned the whole stage black from the moment the mall started.
- **The CRT filter needs `app.stage.filterArea = app.screen`**, which `main.js` sets on resize. Without it, the effect only covers the area where something is drawn.
- **Input:**
  - Letter keys map by the printed letter (`e.key`), so QWERTZ and AZERTY keyboards work. Other keys map by physical `e.code`.
  - Held keys are tracked by `e.code`, so a key release always clears the key that was pressed.
  - Key presses are queued, so a fast double tap isn't lost when several fixed steps run in one frame.
  - A held direction must never cancel an action on its own; use `pressed`, not `held`.
- **Elevator doorways:** at each floor a shaft opening is `car` (the car is here), `solid` (car above: a grate you can stand on and get crushed on) or `pit` (car below: you fall). Falls longer than 48 px kill.
  - Cars that the player called don't crush the player.
  - The AI car waits while anyone stands inside it.
- **Scene flow:**
  - `ctx.mallScene` is reused when you come back from a store, so the mall's world state persists.
  - A new level or loop builds a fresh `MallScene`.
- **Audio can't start until the player has interacted with the page** (browser autoplay rules). Nothing is allowed to depend on audio playing.

## Don'ts

- Don't add image or audio asset files, or new runtime dependencies, without a strong reason.
- Don't commit `dist/`, `node_modules/` or `.superpowers/`, which are git-ignored.
- Don't weaken or delete tests to make a change pass. Fix the code, or update the test when the spec itself changed.
