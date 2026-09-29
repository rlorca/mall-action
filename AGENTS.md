# AGENTS.md - guide for coding agents

This is the `sonnet-5-5` branch of `rlorca/mall-action` (an independent history; `main` only holds the shared prompt and the repo guide). CI: `.github/workflows/pages.yml` tests, builds and publishes `dist/` to `gh-pages/sonnet-5.5/` on every push to this branch.

MALL ACTION: TypeScript + Vite + Vitest, no runtime dependencies, no external assets.

## Architecture

```
core/     loop, input, CRT presenter, scale, storage, debug, rng, pad, events, palette
game/     PURE rules. mall/ (side-scroller), store/ (top-down), progress, difficulty, geometry, session, api
art/      pixel.ts (SpriteDef pipeline), surface.ts (canvas wrapper), font.ts, sprites-*.ts, registry.ts,
          storefronts.ts, backdrops.ts, logo.ts, gallery.ts
audio/    notes/sequencer/songs/sfxdefs = pure data; voice.ts + index.ts = WebAudio
render/   mallView, storeView, hud, overlay, bubble (draw state; never mutate it)
screens/  title, map, pause, levelclear, continue, gameover, spygram (state class + draw fn per file)
data/     stores.ts (13 storefronts), copy.ts (all jokes)
flickersoft/  self-contained reusable splash
```

Flow: `main.ts`/`app.ts` -> `FixedLoop` -> `Input.poll()` -> `Session.step(pad, sink)` -> events -> `Overlay` + `AudioApi`; then `draw()` -> `Presenter`.

## Rules that must hold

1. **Game rules are pure.** Nothing in `src/game/**` (and screen *state classes*) may import DOM, canvas, audio or art. Rules output `GameEvent`s into an `EventSink`; renderers/audio react to them.
2. **Seeded randomness only.** Use `Rng` (`core/rng.ts`). Never `Math.random` or `Date` in game logic; the only wall-clock use is choosing the default seed in `main.ts`.
3. **Frame units.** The simulation is a fixed 60 Hz; every timing is in frames (`sec()` in `game/difficulty.ts`).
4. **Session owns clocks.** `tickPower` and `tickLevelClock` are called by `Session` once per unpaused frame in mall AND store. Worlds must not tick them. Map, pause, continue and fades stop all clocks.
5. **Sprites: at most 3 colours + transparent**, master palette only (`core/palette.ts`); whole-pixel drawing.
6. **All joke copy lives in `data/copy.ts`** and must fit its `LIMITS` (tests enforce it).
7. Level clear fires exactly once; one `ding` per elevator stop; searches start from a single B tap.

## Conventions

- Geometry/sizes shared between rules and art live in `game/geometry.ts`; store tile vocabulary in `game/store/tilekinds.ts`.
- Renderer-facing state is documented at the top of `game/mall/index.ts` and `game/store/README.md`.
- New sprites go in `art/sprites-*.ts` (unique names; tests check size/colours).
- Add tests for every rule you change (`tests/*.test.ts`).

## Verifying changes

```sh
npx tsc --noEmit && npx vitest run && npm run build
```
Then look at it in a real browser: `npm run dev`, open `/?debug=1&seed=1` (skips the splash; `window.__mall.step(n, ['right'])` advances frames) and `/?gallery=1`. Check the console is clean and the CRT is on (default).
Headless Chrome with software WebGL works for screenshots: launch with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.

## Gotchas

- Elevators: cars always stop level with a floor; exactly one ding per stop even while a direction is held.
- Closed/cleared stores cannot be entered; `canEnterStore` guards it.
- The mall does not advance while `pendingStore` is set (Session fades to the store).
- `Uint8Array` silently turns NaN into 0: `parseFrame` validates characters explicitly.
- Keyboard: releases clear the binding resolved at keydown (never re-resolve on keyup) to avoid stuck keys.
- Gamepad buttons only count after they were seen released once (`GamepadPoller`): a stuck/phantom HID device reporting a button held would otherwise mask keyboard presses (B never gets a fresh press).
- CRT shader uses mild curvature so the whole 256x240 picture stays visible.
