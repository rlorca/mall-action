# AGENTS.md (haiku-5-5)

Read this before changing code. It describes this implementation of `one-shot-prompt.md`, not the whole benchmark.

## Architecture

- `src/core`: pure rules. No DOM, no Web Audio. `game.ts` is the top-level state machine. `constants.ts` holds units and geometry.
- `src/mall`: side-scrolling mall. `world.ts` owns all mall state and steps once per frame. `elevator.ts` is a pure car state machine. `rules.ts` holds NPC and spy-fairness rules. `layout.ts` is the store catalogue and props.
- `src/store`: top-down store rooms. `room.ts` owns the room state. `templates.ts` holds the ten room layouts.
- `src/render`: reads state and draws. It must never change state. `renderer.ts` dispatches by screen.
- `src/audio`: sound only. It reacts to outbox events.
- `src/splash`: a standalone module, reused by future FLICKERSOFT games.

## Rules that must hold

- Game rules are separate from rendering. The rules emit events (`MallEvent`, `StoreEvent`, `GameOutput`); the renderer and audio react to them.
- All randomness goes through `Rng`, seeded. Never use `Math.random` in rules.
- Units are frames (60 Hz) and pixels. Do not use wall-clock time in rules.
- Copy lives only in `src/core/copy.ts`, and every line must fit its limit (the tests enforce this).
- Each screen sets its own timer. `setScreen` must not reset a timer.

## Verify changes

```sh
npm test      # all rule tests, copy limits, sprite budgets, templates, soak + determinism
npm run build # typecheck + production build
```

Always run both before committing.

## Gotchas hit while building

- Class fields that read constructor parameter properties break under ES2022 field semantics. Assign in the constructor.
- A fall must measure its distance from where it started, not from its last step.
- A shaft opening with a car below is a pit. Standing still in a shaft opening calls the car after half a second.
- The Konami detector matches a suffix of recent presses, so leading Ups are fine.
- Vite builds use `base: './'` so the game works under a sub-path such as `/haiku-5.5/`.
