# AGENTS.md - MALL ACTION (branch `sonnet-5-5-opus-5-5`)

An 8-bit spy caper in an 80s shopping mall: a side-scrolling mall + top-down stores, browser-only, TypeScript + Vite +
Vitest. This file is for coding agents. Players: read `README.md`. The repo-level rules (this is one branch of a model
benchmark; never merge branches; do not edit `one-shot-prompt.md`) are in `AGENTS.md` on `main`.

## Architecture in one picture

```
 input (keyboard/gamepad) --> InputMapper --> PadFrame (held + pressed per step)
                                                  |
 requestAnimationFrame --> FixedStepLoop (60 Hz, <= 5 catch-up steps) --> Game.step(pad)      <- RULES, pure
                                                  |                              |
                                           events (EventQueue) <------------------+
                                                  |
        FrameRenderer.draw(game)  <-- reads state          GameAudio.handle(events) + .update(game) (music by state)
        Crt.present(canvas)       <-- WebGL shader
```

* `src/core/**` is the **rules layer**: no DOM, no canvas, no `Math.random`, no `Date`. It only mutates state and emits
  events (`run.events.emit('ding', ...)`). Everything in it runs in node under Vitest.
* `src/render/**`, `src/audio/**`, `src/main.ts` only **read** state and react to events. Rendering never changes rules.
  (Render-local state - door animation, popups, toast - lives in `MallView` / `FrameRenderer`.)
* One `Game` owns the screen state machine (`splash, title, mall, store, map, pause, clear, continue, gameover`), a
  `RunState` (score, lives, packages, power-ups, level setup - shared by mall and stores), a `Mall` and a `StoreRoom`.
* The mall is **paused** (not stepped) while the agent is in a store; the `Game` ticks timers (power-ups, level clock)
  in both. Map, pause, continue and fades do not step anything.

## Rules that must hold

1. **Game rules stay separate from rendering.** If a rule needs to know about a pixel or a canvas, the design is wrong.
2. **Seeded randomness everywhere.** Use `Rng` (`src/core/rng.ts`), seeded from `?seed=N` and `hashSeed(...)`. Never
   `Math.random()` / `Date.now()` in `src/core`. A seed + the same inputs must replay identically (there is a test).
3. **All timings are frames at 60 Hz.** (Seconds appear only in comments.) Render code may use its own frame counter.
4. **Every line of copy lives in `src/core/copy.ts`** (jokes, banners, UI labels, store names). Add it to
   `allCopyChecks()` so `tests/foundation.test.ts` verifies the length limit, font coverage and on-screen fit.
5. **Sprites are 3 colours + transparent**, from the fixed NES palette (`src/art/palette.ts`). A sprite is a `Bitmap`
   registered with `defSprite`; add it to `src/art/required.ts` with its size and `tests/art.test.ts` checks it.
6. **One source of truth for data**: the mall geometry is `level.ts`, the store table is `copy.ts` (`STORES`), room
   layouts are `stores-data.ts`. Rules and renderer both import them; never copy numbers.
7. **Per-GAME vs per-LEVEL state**: the GameStonk scene, the photo strip, the joke-item inventory and first-visit lines
   happen once per *game* (they survive `nextLoop`); packages, opened fixtures, Radar and the level clock reset each loop.
8. **Keep UI inside a 4 px safe margin.** The CRT curvature crops ~2 px at the edge midpoints.
9. The CRT effect is ON by default and must never blank or cover the picture. The choice (and mute) persists in
   `localStorage`; the high score does **not** (it is per session).

## Conventions

* TypeScript strict. No dependencies beyond Vite/Vitest/TypeScript (+ `@types/node` for tests). Build output has
  relative URLs (`base: './'`): it must work from any sub-path.
* Positions: the mall agent's `x` is the left edge of a 16 px sprite and `y` is the **feet line**; floors are
  `floorY(f) = 120 + 48 f`. Store rooms use pixel positions on a 16 px tile grid.
* Events are plain `{ kind, ... }` objects. The audio mapping is `src/audio/index.ts` (`sfx()` switch) - add the sound
  there when you emit a new event kind.
* Songs are text patterns in `src/audio/songs.ts` (`NOTE[:steps]`, 1 step = a 16th). `tests/songs.test.ts` requires every
  channel of a song to have the same length.

## How to verify a change

```sh
npm test          # 230+ tests: rules, copy, art, layout, a scripted bot that plays the WHOLE level on 8 seeds
npm run build     # tsc --noEmit (tests included) + vite build
npm run dev       # then open /?debug=1&seed=5   (window.__game.step(n, held) / .pause() / .render())
npx vite-node scripts/dump-sprites.ts sheet.png agent. 4   # PNG sheet of the sprites whose name starts with 'agent.'
```

A change to rules is not done until you have looked at it in a real browser (CRT on, the default): splash -> title ->
arrival -> an elevator ride -> a store -> a package -> the map/pause screens -> level clear. Read the console. Take
screenshots and look at them (`?debug=1` and `__game.render()` make them reproducible).

`tests/bot.ts` is a goal-based scripted player. If you change level geometry, shaft timings or store layouts and
`tests/route.test.ts` stops finishing the level, you have probably created a softlock - fix the game, not the bot.

## Gotchas we hit

* **Held key on boarding.** Walking into a stopped car with Right held used to step straight out the other side:
  leaving a car / a car roof needs a *fresh press* (`pad.pressed`), not a held direction.
* **Fades swallow input.** `Game.step` returns during a fade (14 frames out + 14 in). Tests (and bots) must wait for
  `game.fade === null` before pressing Start on the continue screen etc.
* **Shots get intercepted in tests.** Hanging lamps (reach chest height), fountains (3F, 1F), walkers (2F) and the cop
  all stop or react to bullets. Park cars, kill lamps (`l.state = 'dead'`) and pick a clean corridor in tests.
* **Pits stop walkers.** Spies, the cop and walkers refuse to walk into a shaft opening that is not a grate, so a test
  that expects a spy to cross a pit will hang. Park the cars at the top of their shafts (`quiet()` in `mall-npcs.test.ts`).
* **tsc narrowing in tests.** `sp.state = 'wait'` then `sp.state === 'dying'` is a TS "no overlap" error - cast
  (`(sp.state as string)`). `npm run build` type-checks `tests/` too.
* **macOS `sed -i`** needs `sed -i ''`; use a small Python snippet for multi-line edits.
* **Two keys, one button.** A second key for an already-held button must not queue a phantom tap (`InputMapper.keyDown`).
* **Browser automation.** A Claude-in-Chrome tab starts hidden (`document.hidden`): `requestAnimationFrame` never fires and
  the game looks frozen. Raise the window (AppleScript `activate` + `set index of w to 1`) and confirm with a 1 s rAF
  count (guard it with a `setTimeout`). Held keys do not survive a single `javascript_tool` call: dispatch `keydown`, wait
  in a separate tool call, then `keyup` - or step with `?debug=1` (`__game.step(n, held)`). The tool's bare `shift` key
  sends no event; use `Tab` for the map. Keep the debug page's `localStorage` clean (a toggled `c`/`m` persists).
* **Screenshots for docs**: render with the CRT on (`__game.render()`), crop `crt.vp` from the canvas in the same task and
  POST it to a local receiver; do not pass image data through the tool output.
* **WebGL canvas capture** only works in the same task as the draw (`preserveDrawingBuffer` is off).

## Adding things

* **A store**: add the id to `STORES` (`copy.ts`) and `PLACEMENT` (`level.ts`); window sprites `win.<id>.l/.r` and a theme
  (`stores-data.ts` `TEMPLATES`, 14x9 interior), a song in `songs.ts` + `STORE_SONG`, first-visit lines. Run the tests:
  templates, layout overlap, art sizes and "one song per open store" will tell you what is missing.
* **A power-up**: `powerups.ts` (kind, duration, slot), `copy.ts` names (`POWERUP_NAMES`, `POWERUP_HUD_NAMES`), icon
  `pu.<kind>` in `sprites-mall.ts`, `required.ts`, and loot tables in `levelsetup.ts` if it should appear in stores.
* **A joke**: see "Where to add jokes" in `README.md`.
