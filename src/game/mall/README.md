# src/game/mall - the side-scrolling MALL world (pure rules)

Pure, deterministic, frame-based (60 Hz). No DOM / canvas / audio; randomness only from the seeded `Rng`;
output only through `GameEvent`s pushed into the `EventSink` given to `step(pad, sink)`.

| File | What |
|---|---|
| `layout.ts` | `LAYOUT`: static level (floors, shafts A/B/C, 13 storefronts, escalators, kiosks, booth, fountains, decor, lamps, disco balls, wagon, zip-line, roof, janitor/walker ranges) + helpers |
| `types.ts` | `MallState` and all entity types (the public state renderers read) |
| `world.ts` | `MallWorld` / `createMall`: frame orchestration, arrival, alarm, PA, music, Session API |
| `player.ts` | walk / jump / kick / duck / shoot, Up/Down actions (doors, escalators, kiosk, booth, wagon, calling), death + respawn |
| `elevators.ts` | cars: manual A/B, automatic C, calling, glide, crushing, dings, announcements |
| `spies.ts` | spawning, AI, aim/shoot/duck, death, drops |
| `props.ts` | bullets, lamps, disco balls, janitor + wet floor, walkers, cop, fountains, coins, pickups, timers |
| `physics.ts` | constants (jump, fall) and surface helpers |
| `copy.ts` | mall-side strings not in `src/data/copy.ts` |
| `index.ts` | public entry point + the full doc-comment of the renderer-facing state |

Usage: `const world = createMall({ seed, progress }); world.step(padFrame, sink);` then read `world.s`.
The Session ticks `tickPower` / `tickLevelClock` itself (the mall only reads `progress.levelFrames` for the alarm).

State conventions: world px, +x right, +y down; actors are positioned by centre x and FEET y; every animation is a
state name (`anim`) plus a frame counter (`animFrame`). See the comment at the top of `index.ts` for every field.

Session hooks: `pendingStore` + `clearPendingStore()`, `returnFromStore(id, sink)`, `outOfLives`,
`resumeAfterContinue(sink)`, `levelClear` (true exactly once), `mapSnapshot()`.

Extras for tests / tools: `createMall({ skipArrival: true })` starts with control on the roof;
`world.spawnSpy(floor, x, { emerge: false })` puts a spy in play.

Tests: `tests/mall-*.test.ts` (helpers in `tests/mall-helpers.ts`: `stepFrames`, `place`, `parkCar`, `quiet`).
