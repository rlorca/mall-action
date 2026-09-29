# AGENTS.md — MALL ACTION

Read this before changing anything. It describes the architecture, the rules
that must keep holding, and the traps this codebase has already fallen into.

This branch is one model's entry in a benchmark: the whole game was built from
`one-shot-prompt.md` on `main` in a single autonomous run. Keep the history —
fixes go in new commits, never by rewriting the original result.

## Verify a change

```bash
npm test        # 217 tests, all of the game rules
npm run build   # tsc --noEmit + vite build
```

Both must pass before you commit. CI runs exactly these two, then deploys.

For anything that touches feel, movement, collision or drawing, also play it:

```bash
npm run dev
```

and drive it with `?debug=1` (below). A change that passes the tests can still
look wrong; several bugs in this codebase were only ever visible in a
screenshot.

## The one architectural rule

**Game rules are separate from rendering.** This is not a style preference; the
whole test suite depends on it.

- `src/core/**` is pure. No DOM, no canvas, no `Date.now()`, no `Math.random()`,
  no audio calls. It runs in Node, which is why 217 tests can drive real
  gameplay in milliseconds.
- `src/render/**` and `src/audio/**` only ever **read** state. They never mutate
  it and the rules never call into them.
- The rules talk to the outside world through **one channel**: `EventBus` in
  `src/core/events.ts`. Push an event (`bus.sfx('ding')`, `bus.music('alarm')`,
  `bus.shake(...)`), and `main.ts` drains the queue once per step and acts on it.

If you need a rule to make a noise or shake the screen, push an event. If you
find yourself importing `src/render` from `src/core`, stop.

### The one exception, and why

`mall.ts` and `store.ts` need to call *forward* into `game.ts` (to start a fade,
enter a store, end the level). A direct import would be circular, so `game.ts`
injects those callbacks at load time via `setStartFade`, `setBeginStore`,
`setBeginLevelClear`, `setExitStore`, `setPlayerDiedInStore`. It is a little
ugly and it is deliberate. Do not "fix" it with a direct import.

## Rules that must keep holding

**Frames, not milliseconds.** Every duration in game state is an integer number
of frames at 60 Hz. `src/core/constants.ts` has a `sec()` helper for writing
them readably. If you store a duration in ms, determinism breaks.

**All randomness comes from `g.rng`.** One seeded `Rng` threaded through the
state. `Math.random()` anywhere in `src/core` is a bug — a given seed must
replay identically, and `tests/rules.test.ts` asserts it. Draw randomness in the
rules, not at render time: choosing a SPYGRAM post while drawing would make the
same seed show different posts.

**Rendering is a pure function of state.** Anything the renderer needs to draw
must live in the state, including banners, bubbles and score popups. The only
presentation-only state is the renderer's free-running `clock` (so idle
animation continues while paused) and the shake/flash counters.

**At most 3 colours plus transparent per sprite.** `Sprite` enforces this
structurally: `data` holds 0–3 where 0 is transparent and 1–3 index a 3-entry
colour table. You cannot exceed it by accident. `tests/sprites.test.ts` also
checks every sprite is the right size and is not blank.

**All colours are master-palette indices.** Never an RGB value. Use the named
constants in `src/render/palette.ts`.

**No external assets.** Every sprite, tile, glyph, note and sound effect is
generated from source at module load. If you are about to add a `.png` or a
`.wav`, you are solving the wrong problem.

**All joke copy lives in `src/core/copy.ts`,** with length limits at the top.
`tests/copy.test.ts` checks every line fits its limit, fits on a 256-pixel
screen when measured in the font that draws it, and only uses characters those
fonts actually have. It has caught a too-long headline and two missing glyphs.

## Playtesting with `?debug=1`

`?debug=1` exposes `window.MALLACTION` and skips the splash:

```js
MALLACTION.state                  // live game state
MALLACTION.step(frames, buttons)  // run N frames with `buttons` held
MALLACTION.press(button, frames)  // tap, then release
MALLACTION.Button                 // the button flags
MALLACTION.readyToExit()          // all 6 packages, standing at the getaway car
```

`step()` runs the real simulation — the same path a player drives — so an
automated playtest is a real playtest. `?seed=N` makes it reproducible and
`?gallery=1` shows every sprite at once.

A scripted playthrough that navigates the mall, enters all six target stores,
searches for the packages and reaches the exit is the best end-to-end check.
Two things to know if you write one:

- The bot needs **BFS pathfinding inside a store**. A greedy "vertical then
  horizontal" walker wedges against a counter forever and reports a false
  failure. Store layouts are small grids; `'.oLP'` are the walkable characters.
- **You cannot stop a car at an intermediate floor by holding a direction.**
  That is the design: hold to drive past floors, release near the target and the
  car glides on and stops level with it. A bot that holds Down until
  `car.atFloor === target` will ride to the end of the shaft and hang.

## Gotchas already hit

These were real bugs. Most of them would not have been caught by unit tests
alone; several took a screenshot or a scripted playthrough to see.

- **A spy stepping out of an arriving elevator killed the player instantly.**
  Any freshly spawned spy now has a contact grace (`SPY_EMERGE_GRACE`), and a
  car will not drop one on a player standing in that opening.
- **The fitting-room ambush was an unavoidable death.** The thrown shoe spawned
  on top of the player and hit within three frames. The shoe is now aimed from
  the spy, and the scare grants a startle window (`AMBUSH_GRACE`).
- **The lamp hitbox sat entirely above the standing shot,** so lamps could not
  be shot at all. The hit band now runs from `LAMP_HIT_TOP` down to
  `LAMP_HIT_BOTTOM` (chest height), while a ducking shot still passes under.
  Keep lamps clear of the fountains — a lamp in front of one eats every shot
  aimed at it, and `tests/level.test.ts` now enforces the spacing.
- **The agent spawned standing on the store's door tile** and immediately
  tripped the walk-out check, bouncing straight back to the mall. He now enters
  one tile inside.
- **The store camera was only updated at the end of `stepStore`,** which returns
  early during a cutscene — so a room that opened on its first-visit lines was
  drawn off-centre. The camera is updated before the cutscene branch now.
- **Boarding a car with Up also drove it away** on the same press.
  `player.driveLatch` makes the car ignore the direction until it is released.
- **Standing on a car's roof auto-called that same car,** carrying the player up
  into the shaft ceiling. The auto-call skips the shaft you are riding.
- **The CRT shader scaled the image inward,** which pushed the top rows of the
  HUD off screen. The brief requires the effect never partly cover the picture,
  so the distortion now only pushes samples outward; the corners show black
  surround and every pixel stays visible.
- **The camera-flash overlay was a persistent 50% white checkerboard** that
  buried the whole scene for six frames. It is one near-solid frame now, then it
  thins out.
- **The sprite gallery drew black sprites on black cells.** Cells are mid-grey.
- **`const enum` breaks under `isolatedModules`.** `Button` is a plain `as const`
  object with a matching type. Do not convert it back.

## Layout invariants

`tests/level.test.ts` pins the mall geometry, because moving one number quietly
breaks something three floors away:

- every floor is reachable from the roof, and shaft B is the only way to P;
- no storefront overlaps another, or a shaft opening;
- no hanging lamp covers a store sign, blocks a fountain, or sits on an
  escalator landing;
- the mall walkers never cross a shaft opening;
- every store room is the right size, its door is centred on the bottom row, and
  every floor tile is reachable from that door;
- every fixture has a walkable neighbour, so it can actually be searched.

If you move a storefront, a shaft, a lamp or a prop, run the tests. They will
tell you what you broke.

## Level-setup invariants

Also pinned by tests, across many seeds and in both normal and Black Friday mode:

- each target store holds **exactly one** package, and nothing else holds one;
- power-up shops never hold a trap;
- in Black Friday mode every non-package fixture holds a power-up;
- the same seed always produces the same layout.

## Conventions

- TypeScript strict, `noUnusedLocals` and `noUnusedParameters` on. `npm run
  build` typechecks before it bundles.
- `base: './'` in `vite.config.ts` is **required** — the game is served from a
  sub-path on GitHub Pages and absolute asset URLs would 404.
- Comments explain *why*, not *what*. The interesting ones here are the ones
  marked as deliberate design decisions; leave those in place.
- Tests read as sentences about the game ("gives exactly one ding per stop"),
  not about the implementation. Keep that.
