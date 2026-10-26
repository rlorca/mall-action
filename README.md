# MALL ACTION

**An 8-bit spy caper in an 80s shopping mall.** A spiritual successor to Taito's *Elevator Action* (1983), published by the fictional studio **FLICKERSOFT**. Ride elevators, shoot spies, search stores for hidden packages, and drive away in the wood-panelled getaway wagon.

> **Play in your browser:** https://rlorca.github.io/mall-action/deepseek-v4-pro-high/

## The pitch

Spies have hidden **6 packages** in 6 stores across a six-floor shopping mall. You arrive by zip line, then work your way down through the floors — riding elevators and escalators, ducking into stores to search fixtures, and dodging (or shooting) the spies that pour out of the doors. Collect all 6 packages, reach the parking level, and drive away. Then the next loop starts, harder.

- **The mall** is a side-scroller in the vein of *Elevator Action*: floors, corridors, elevator shafts and escalators, with spies coming out of doors.
- **Entering a store** switches to a top-down, Zelda-style room where you search fixtures for hidden packages while guards patrol.
- **Look and sound:** top-tier NES/arcade 8-bit, with chiptune music — every sprite, tile, font glyph, music track and sound effect is generated from source code. No external assets.

## Features

- Fixed 60 Hz simulation, decoupled from rendering, with deterministic seeded randomness (`?seed=N`).
- 256×240 internal resolution, nearest-neighbour scaled, with an optional CRT effect (scanlines, vignette, noise) — **on by default**, toggle with **C**.
- Synthesised NES-style audio (two pulse waves, triangle, noise); **M** toggles mute.
- Keyboard **and** gamepad input, merged into a virtual NES pad. Letter keys match the printed letter (QWERTZ/AZERTY safe).
- 13 storefronts (6 target, 4 power-up, 3 closed), 9 store themes, 3 elevator shafts (two manual, one automatic), 2 escalators.
- Power-ups: Rapid Fire, Spread Shot, Armor Vest, Sneakers, Radar, 1-Up, and the food items Cinnabomb, Orange Juli-Ooze and Soft Pretzel.
- NPCs: a janitor with a wet floor, power-walking mall walkers, and a mall cop on a Segway.
- A full humour layer: SPYGRAM selfies, THE DAILY MALL headlines, spy last words, mall PA announcements, and a **Konami code** secret (↑↑↓↓←→←→ B A) that unlocks **Black Friday Mode**.
- Map overlay (Select), pause (Start), continues, game over, and a level-clear tally with a newspaper and a mission-complete post.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows, WASD | D-pad, left stick |
| A: shoot | Z, J | A (button 0) |
| B: jump (mall) / search (store) | X, K, Space | B (button 1) |
| Select: map | Shift, Tab | Select (button 8) |
| Start: pause, confirm | Enter | Start (button 9) |
| CRT on/off | C | |
| Mute | M | |

## Running, testing, building

```sh
npm install     # install dev dependencies
npm run dev     # start the Vite dev server
npm test        # run the test suite (Vitest)
npm run build   # type-check and build to dist/
```

The build outputs static files to `dist/` with relative asset URLs (`base: './'`), so it works when hosted under a sub-path.

## Debug URL options

- `?seed=N` — fix the random seed for a reproducible run.
- `?debug=1` — expose `window.mallGame` (the game context) and `window.stepGame(n, buttons)` for automated playtests; also skips the splash.
- `?gallery=1` — show every sprite, animated.

## Project layout

```
src/
  rules/        # pure game logic (no DOM/audio/canvas) — the testable core
    game.ts     #   Game class, screens, scoring, power-ups
    mall.ts     #   mall simulation (player, spies, elevators, NPCs)
    store.ts    #   store room simulation (searching, guards)
    layout.ts   #   mall + store layout data
    types.ts    #   shared types and constants
  render/       # canvas rendering (reads state, never mutates it)
  audio.ts      # synthesised audio (Web Audio API)
  input.ts      # keyboard + gamepad -> virtual NES pad
  sprites.ts    # pixel-art sprites (generated from source)
  font.ts       # 5x7 pixel font (generated from source)
  palette.ts    # NES-like master palette
  copy.ts       # every line of text/jokes lives here
  rng.ts        # deterministic seeded RNG
  main.ts       # entry point, game loop, debug support
test/           # Vitest test suite
```

## Where to add jokes

All copy lives in **`src/copy.ts`** — SPYGRAM posts, store first-visit lines, spy last words, elevator lines, PA announcements, headlines and GameStonk items. Length limits (speech bubbles 28 chars, SPYGRAM captions 21×2, comments 21, headlines 26 per line) are enforced by `test/copy.test.ts`.

## Disclaimer

*A FLICKERSOFT fan homage. Not affiliated with Taito or any parodied brand.*

## Benchmark notes

- **Model:** DeepSeek V4 Pro (`deepseek-v4-pro`)
- **Harness:** OpenCode
- **Reasoning/effort setting:** high
- **Date:** 2026-10-26
- **Subagents:** none — the whole run was done in a single session.
- **Time:** roughly 11 minutes of wall-clock time.
- **Interventions:** none from the human; the run was autonomous.
- **Not finished:** see `DECISIONS.md` for the honest list of simplifications
  (store extras, fountains/photo-booth flows, per-store music, some NPC
  interactions). The core loop — splash → title → zip-line → collect 6
  packages → exit → level clear → loop, with continues and game over — is
  complete and tested (60 tests pass, production build succeeds).
- **Costs:** recorded in `costs.json` (token/cost figures are not exposed by
  the harness, so they are `null`).

