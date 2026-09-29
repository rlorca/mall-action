# AGENTS.md: working on MALL ACTION (fable-5-1)

This branch is Claude Fable 5.1's implementation in the MALL ACTION model benchmark. Read `AGENTS.md` on `main`
for the repo layout and the benchmark protocol. In short: never merge or rebase this branch onto another, and put
any fixes after the one-shot run in new commits.

## Architecture

```
input (keyboard/gamepad) ─► VirtualPad ─► PadFrame per 60 Hz step
                                              │
                         game/step(g, frame)  ▼   pure rules, mutate GameState, push g.events
                                              │
             render(gx, g) reads state ◄──────┴──────► main.ts drains g.events ─► Synth (sfx, jingles)
             Presenter (WebGL CRT)                     musicFor(g) / humOn(g) pick the music
```

- `src/game/*` holds **all the rules** and never touches the DOM, time or `Math.random`. Its entry points:
  - `createGame`, `step`, `musicFor` and `humOn` in `game.ts`;
  - the mall in `mall.ts`, stores in `store.ts`, elevator cars in `elevator.ts`;
  - static data in `layout.ts` and `rooms.ts`, and level contents in `setup.ts`.
- `src/render/*` only reads state; `src/audio/*` only reacts to events. `src/main.ts` glues them together and hosts
  the debug API.
- Art and music are **data in source code**:
  - Sprites are text rows (`'.'` and `'1'..'3'`) plus a 3-colour palette (`src/art/art_*.ts`). The required set
    and sizes are listed in `src/art/manifest.ts`.
  - Songs use the text notation in `src/audio/notation.ts`, and SFX are sweep segments.
- `src/splash/` is self-contained, with no imports from the rest of the game. Keep it that way; future
  FLICKERSOFT games reuse it.

## Rules that must hold

1. **Game rules stay separate from rendering.** Nothing in `src/game` may import from `render`, `audio`, `main`
   or the DOM. The renderer never changes game state.
2. **Seeded randomness only.** Game logic uses `g.rng` or `level.rng` (the `Rng` in `core/rng.ts`). Never use
   `Math.random` in `src/game`. (The synth's noise-offset jitter is audio-only.)
3. **Frame units.** Every timing is in 60 Hz frames and every speed in px/frame. The simulation runs in fixed
   steps (`core/loop.ts`, catch-up capped at 5); rendering is decoupled.
4. **Whole pixels, NES limits.** Screen 256×240 with a 16 px HUD. Sprites use at most 3 colours plus transparent,
   from the NES palette (`core/palette.ts`). Only whole-number scaling and nearest-neighbour sampling.
5. **Copy lives in `game/copy.ts`**, and its length tests must pass.
6. **Relative URLs.** The build runs from a sub-path (`base: './'`).
7. The "must never happen" list:
   - Level Clear fires twice.
   - A ding repeats while a direction is held at the end of a shaft.
   - A called car crushes the player.
   - A wet patch reaches a shaft opening.
   - A store is unreachable.
   - Text runs off screen.
   - A key gets stuck.

## Conventions

- In the mall, y is the **feet** and x is the **centre**. Floors: `surf(i) = 144 + 48 i`, where 0 = R … 5 = P.
  Cars: `car.y` is the car floor, and the roof is `car.y - 30`.
- Stores: a room is a tile grid of any size (`rooms.ts` legend). x,y is the agent's centre, and the camera
  clamps to the room.
- The legend for colours is `C.*` in `core/palette.ts`. Sprites face right; the renderer flips them.
- Animation frames are `<name>_0.._N`, and the renderer discovers how many exist (`Gfx.frames`).
- Songs and SFX are listed in `audio/ids.ts`, and every id must exist in `songs.ts` / `sfx.ts` (tests check).

## How to verify a change

1. Run `npm test`, which covers every rule area in the brief, sprites and audio data included.
2. Run `npm run build` (type-check + Vite).
3. Play it for real: `npm run dev`, then open `/?seed=1`.
   - For scripted checks use `/?debug=1&seed=1`, with `window.__mall.freeze(true)` then
     `__mall.step(n, ['right'])`.
   - Keep the CRT on, which is the default. Watch the console and look at the screenshots.
4. Run `/?gallery=1` after touching any art.

## Gotchas hit while building this

- **Camera and bullets:** player bullets are culled against the camera. A test that teleports the agent must
  snap the camera (`updateCamera(m, true)`; the test helper `placeAgent` does it), or the first bullet vanishes.
- **Spawning over shafts:** spies spawned or placed over a shaft opening fall into the pit. Openings are 24 px
  wide at A x=112, C x=368 and B x=648.
- **Lamps vs spies:** lamps are checked **before** spies for player bullets. Otherwise a spy standing under a lamp
  absorbs the shot meant to drop the lamp on him.
- **Timers and overlays:** the frame that opens or closes the pause or map overlay does not tick the game.
  Timer tests must count this.
- **Tiny font:** the 3×5 font only has the glyphs in `core/font.ts`. Use `canRender` in tests when you add text
  drawn with it; a missing glyph renders as `?`.
- **CRT curvature:** the shader zooms out slightly so curvature never crops the HUD. Keep HUD text at x ≥ 4 and
  bubbles 6 px from the edges.
- **Headless WebGL:** needs SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`). "GPU stall due to
  ReadPixels" warnings in headless runs come from screenshots, not from the game.
- **Audio:** `Synth.unlock()` must run inside a user gesture. Every audio call is a no-op until then, and the
  game runs fine without audio.
