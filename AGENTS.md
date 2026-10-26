# AGENTS.md — MALL ACTION

Architecture, rules that must hold, conventions, and how to verify changes for
this codebase. Read this before changing anything.

## Architecture

The game is split into a **pure rules layer** and a **rendering/audio layer**:

- `src/rules/` — all game logic. Pure TypeScript, no DOM, no canvas, no audio.
  The `Game` class (`src/rules/game.ts`) owns all state and advances one frame
  per `step(pad)`, returning a list of `GameEvent`s. The mall simulation is in
  `src/rules/mall.ts`, the store (top-down room) simulation in
  `src/rules/store.ts`, and the static layout data in `src/rules/layout.ts`.
- `src/render/renderer.ts` — draws the state to a 256×240 buffer and scales it
  up. It **reads** state and **never mutates** it.
- `src/audio.ts` — synthesised audio; consumes the events emitted by the rules.
- `src/main.ts` — the game loop (fixed 60 Hz), input wiring, debug support.

## Rules that must hold

1. **Game rules are separate from rendering.** Never put game logic in the
   renderer, and never read the canvas/DOM from `src/rules/`. The rules must be
   testable in Node (Vitest) without a browser.
2. **Deterministic seeded randomness.** All randomness goes through `Rng`
   (`src/rng.ts`). Never call `Math.random()` in game logic. A given seed must
   always replay the same.
3. **Frame units.** All timings are in frames (60 Hz). No `setTimeout`/`Date`
   in the rules. The render loop caps catch-up steps (see `main.ts`).
4. **Sprites use at most 3 colours plus transparent.** Enforced by
   `test/sprites.test.ts`. Every sprite, tile, font glyph, music track and
   sound effect is generated from source — no external assets.
5. **Copy lives in one place.** All text is in `src/copy.ts`, with length
   limits enforced by `test/copy.test.ts`.
6. **The build must work from a sub-path.** `vite.config.ts` sets `base: './'`.
   Never assume the app is served from `/`.

## Conventions

- One frame is `1/60` s. `60` frames = 1 second, `20 * 60` = 20 seconds, etc.
- The virtual pad has eight buttons: `up down left right a b select start`
  (`src/input.ts`). The rules consume a `PadFrame` (`held`, `pressed`,
  `released`); `pressed`/`released` are edge-triggered.
- Events are plain objects `{ type: string, ... }`. `main.ts` maps event types
  to sound effects (`SFX_MAP`) and picks the music track.
- Floor ids are `"R" | "4F" | "3F" | "2F" | "1F" | "P"` (see `src/copy.ts`).
  `FLOOR_Y` in `src/rules/types.ts` maps a floor to its walking-surface Y.

## How to verify changes

```sh
npm test        # run the full Vitest suite
npm run build   # type-check (tsc --noEmit) and build to dist/
```

Both must pass. CI (`.github/workflows/pages.yml`) runs `npm ci`, `npm test`,
`npm run build`, and only then publishes `dist/` to the `gh-pages` branch under
`deepseek-v4-pro-high/`. A failing test blocks the publish.

For a manual check, run `npm run dev` and open the dev server. Useful debug
URLs: `?seed=N`, `?debug=1` (exposes `window.mallGame` and
`window.stepGame(n, buttons)`), `?gallery=1`.

## Gotchas

- **The spec's own headlines exceed 26 chars.** They wrap to two lines on the
  newspaper front page; `test/copy.test.ts` allows up to 52 chars (2×26).
- **Elevator shafts are gaps in the floor.** A shaft opening is `board` (car at
  this floor), `grate` (car above), or `pit` (car below). Falling more than one
  floor (48 px) is fatal; landing on a car roof one floor down is safe.
- **`Game.emit` is public** because the mall/store simulations (separate
  modules) call it. Keep it that way, or move the sims into the class.
- **The store `banner` is a `Banner` object** (`{ text, timer }`), not a plain
  string — unlike some other fields.
- **`createMall` takes only an `Rng`.** Loop/Black-Friday scaling is applied in
  the step functions via `game.loop` / `game.blackFriday`, not at creation.
