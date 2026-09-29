# AGENTS.md — Mall Action (Opus 4.6 implementation)

## Architecture

The codebase follows a strict **rules-separate-from-rendering** pattern:

```
src/engine/    Pure engine: types, RNG, input mapping, game loop
src/game/      Pure game rules: state, simulation, store init
src/rendering/ Canvas renderer (only draws state, never mutates it)
src/audio/     Web Audio synth, SFX, music (reacts to events from rules)
src/sprites/   All pixel art defined as code arrays
src/data/      Store definitions, text/copy, room layouts
```

### Key separation

- `updateGame(state, input) → GameEvent[]` is the core simulation. It is pure: no DOM, no audio, no rendering. It takes the current state and input, mutates the state, and returns a list of events.
- The renderer reads state and draws it. It never mutates game state.
- Audio reacts to GameEvent types (e.g., `sfx_shot`, `play_mall_music`).
- All randomness uses `SeededRNG` from `src/engine/rng.ts`. No `Math.random()` in game logic.

## Rules that must hold

1. **Deterministic simulation**: Same seed + same inputs = same outcome. All game logic uses `state.rng`.
2. **Frame-based timing**: All durations are in frames (60 fps). No milliseconds in game rules.
3. **No rendering in rules**: `simulation.ts` must import nothing from `rendering/`, `audio/`, or browser APIs.
4. **One package per target store**: Exactly 6 target stores, each with exactly 1 package fixture.
5. **Level clear fires once**: The `levelClearFired` flag prevents double-triggering.
6. **Power-up slot rules**: Only one weapon at a time. Armor, speed, and Radar stack with weapon.
7. **All text in copy.ts**: Every user-visible string lives in `src/data/copy.ts` for easy editing.
8. **Sprite palette rule**: At most 3 colors + transparent per sprite.

## Conventions

- TypeScript strict mode
- Vitest for tests
- Vite for build (base: './' for sub-path hosting)
- No external assets — everything generated from source

## How to verify changes

```bash
npm test           # All tests must pass
npm run build      # Production build must succeed
npm run dev        # Visual check in browser
```

Then open `http://localhost:5173/?debug=1` and verify:
- Splash → Title → Arrival → Mall gameplay works
- Elevators, escalators, stores all function
- No console errors
- CRT effect toggles with C
- Sound toggles with M

## Gotchas

- The build is served from a sub-path (`/opus-4.6/`). All asset URLs must be relative (Vite `base: './'`).
- Browser autoplay policy: audio context starts suspended. The `AudioManager` handles this by initializing on first user input.
- Elevator ding must play exactly once per stop. The `dingPlayed` flag on each elevator prevents repeats.
- Wet floor patches must never reach elevator shaft openings (would cause unavoidable death).
- Konami code detection must tolerate extra leading Up presses.
- Store search: a single B tap must work; holding B after search must not auto-repeat.
