# AGENTS.md - MALL ACTION (branch `fable-5-2`)

Read this before changing anything. It covers this implementation only; the repository-level
layout (one implementation per branch, publishing to `gh-pages/<folder>`) is described in the
`AGENTS.md` on `main`. Do not merge or rebase this branch onto another one.

## What this is

A browser game in TypeScript, built with Vite, tested with Vitest. No runtime dependencies, no
external art or audio: sprites, tiles, fonts, music and sound effects are all generated from code.

## Architecture

```
input (keyboard/gamepad) -> VirtualPad.poll() -> { held, pressed }      src/core/input.ts
                                   |
                     stepGame(game, pad)   60 times a second            src/game/game.ts
                                   |          pure rules, mutate `game`
                                   v
     game state (plain data) --+--> drawGame(fb, game)                  src/render/*
                               |        software framebuffer of palette indices (256x240)
                               |              -> Presenter (WebGL, integer scale, CRT)
                               +--> game.sfx (names), musicFor(game), humOn(game)
                                              -> AudioEngine (WebAudio)  src/audio/*
```

- `src/game/` is **the rules**: physics, elevators, AI, scoring, stores, jokes. It never touches the
  DOM, the clock, or `Math.random`. One call to `stepGame` is one frame.
- `src/render/` only **reads** the state and draws it. `src/audio/` only consumes the sound names
  in `game.sfx` and the track name from `musicFor(game)`.
- `src/main.ts` is the only file that wires browser things together.
- `src/flickersoft/splash.ts` is self-contained (no imports) so other games can reuse it.

Key files in `src/game/`: `level.ts` (static mall layout), `rooms.ts` (store templates),
`copy.ts` (all text), `types.ts` (state), `setup.ts` (new game / level, what fixtures hide),
`mall.ts` (side-scrolling rules), `store.ts` (top-down rules), `game.ts` (screens, flow, music
choice), `powers.ts` (power-ups, scoring, difficulty).

## Rules that must hold

1. **Game rules stay separate from rendering.** Nothing in `src/game/` may import from `render/`,
   `audio/`, `platform/` or use `document`, `window`, `Date`, `performance`. Rendering must never
   mutate the game (a test steps two identical games, drawing only one, and compares them).
2. **Seeded randomness only.** All rule randomness goes through `game.rng` (`core/rng.ts`). The same
   seed and inputs must replay the same game. Render-side or audio-side noise (CRT grain, the like
   counter, the noise channel) must not draw from `game.rng`.
3. **Frame units.** All timings are in frames at 60 Hz; speeds are pixels per frame. `SEC = 60`.
4. **At most 3 colours plus transparent per sprite**, from the fixed NES-like palette
   (`gfx/palette.ts`). Mall characters are 16x24, store characters 16x16.
5. **All copy lives in `src/game/copy.ts`**, within the length limits in `LIMITS`.
6. **Level clear fires exactly once** per level (`Level.cleared` guards it; `game.clears` counts).
7. **The build must work from a sub-path**: keep `base: './'` in `vite.config.ts`, no absolute URLs.
8. **Audio must never break the game**: every `AudioEngine` call is guarded, and it stays silent
   until a user gesture.
9. **The CRT effect must never blank or cover the picture**: the warp maps edge midpoints exactly onto
   the image edges and all darkening factors are bounded.

## Conventions

- Positions: mall entities use `x` = centre, `y` = feet. Store entities use the top-left of a 16x16
  cell; the agent's collision box is `HB` in `store.ts`.
- Floors are indices 0..5 (`R, 4F, 3F, 2F, 1F, P`); `FLOOR_Y[i]` is the walking surface.
- A shaft opening is, depending on its car: walk-in (car here and stopped), a grate (car above), or a
  pit (car below). `groundBelow`, `carBlocks` and `moveX` in `mall.ts` implement this; use them
  instead of inventing new collision checks.
- State is plain data. New state goes into `types.ts` and is created in `setup.ts`.
- Sounds: push a name onto `game.sfx`; add the name to `audio/sfx.ts` (a test checks every emitted
  name exists). Music: return a track name from `musicFor`; add the song to `audio/songs.ts`.
- New sprite: add ASCII art to `gfx/sprites.ts` (characters, items) or `gfx/props.ts` (props, tiles).
  It appears in `?gallery=1` and is covered by the colour/size test automatically.
- New store: add a row to `STORES` in `level.ts`, a template to `ROOM_ART` in `rooms.ts`, a song
  `store_<key>` in `songs.ts`, window displays in `render/storefront.ts`. Rooms may be any size; the
  store view has a camera.

## How to verify a change

1. `npm test` - 150 tests of the rules, including a scripted bot (`tests/bot.ts`) that plays whole
   loops using pad input only. If the bot gets stuck, you created a softlock. If the fairness test
   fails, loop 1 got too hard.
2. `npm run build` - also type-checks `src`, `tests` and `scripts`.
3. Look at it without a browser: `npx tsx scripts/scenes.ts shots` renders about 40 scenes to PNG
   through the real renderer. Actually open the images.
4. Play it in a real browser with the CRT on (the default): `npm run dev`. For automation, load
   `?debug=1&seed=N` and use `window.__mall` (`game`, `step(n, held, pressed)`, `state()`), or send
   real key events. Check that the console shows no errors.
5. Before publishing, serve `dist/` from a sub-path (for example `/mall-action/fable-5.2/`) and load
   it there.

## Gotchas hit while building this

- **Riders fell through moving cars.** `groundBelow` must list the car floor itself as a surface,
  not only grates and the car roof. There is a test for gliding to a floor.
- **`shaftColumn(x)` is purely geometric.** It returns a shaft even on floors that shaft does not
  serve (A's column on 1F is ordinary corridor). Always pair it with `shaftServes`.
- **Hanging lamps intercept standing shots** (by design: duck to shoot under them). Tests and
  scripted scenes that fire across a floor must stand clear of the lamp columns in `LAMPS`.
- **The fatal-fall threshold is exactly one floor (48 px).** A pit with the car two floors down is a
  52 px fall onto its roof; with a larger threshold it was survivable.
- **Guard hitboxes need inclusive bounds.** The agent is often tile-aligned, so his bullet lands
  exactly on a hitbox edge; with strict comparisons a cornered guard was unhittable and the bot
  looped forever.
- **Store guards were unfair when they could stand next to you.** They now keep `GUARD_KEEP_AWAY`
  tiles off, telegraph for 30 frames and fire slow bullets. A fitting-room spy spawns away from the
  agent, otherwise his shoe hit on the frame it was thrown.
- **A favicon 404 is a console error.** `index.html` carries an empty `data:` icon.
- **Do not "fix" CRT wobble with filtering.** Curvature with nearest sampling makes pixel columns
  slightly uneven at 2x. A sharp-bilinear shader was tried and reverted: it softened the default
  view, and the brief demands nearest-neighbour with no blur. The texture stays `NEAREST`.
- **A called car must retarget if it is already moving.** An automatic car on its own trip used to
  pass through the floor of someone who had just called it from a grate, crushing them.
- **Size the canvas in device pixels** (`Presenter.resize`), or a fractional `devicePixelRatio`
  blurs the picture.
- **Level clear lasts 1080 frames** (three screens). Tests that wait for the next loop must wait
  longer than that or press Start.
- **TypeScript narrowing in tests:** after `s.state = 'walk'`, comparing `s.state === 'dead'` later
  is a type error even though the rules mutated it; cast to `string`.
- **`vitest` prints nothing for passing probes.** When investigating, write findings to a file.
- **BSD `sed` on macOS** does not expand `\n` in replacements; use a small script for multi-line edits.
- **Node resolves modules upward.** In a worktree under another checkout, a missing dependency can be
  silently satisfied by the parent's `node_modules`; verify with a clean `npm ci`.

## Not done / known limits

- The music has never been listened to by a human or judged by ear; it was verified to parse, to stay
  in range and to schedule notes in a real browser.
- Gamepad support is unit-tested but untested on hardware.
- Spies do not change floors on their own (they can ride a car that moves while they stand in it).
- Rooms are all one screen; the room system and camera support larger ones, but no anchor store exists.
