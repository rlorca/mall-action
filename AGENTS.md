# MALL ACTION — Implementation Notes (Haiku 4.5)

## Architecture

The implementation follows a **model-view-simulation** architecture:

- **`src/rules.ts`:** Pure game simulation (no DOM, canvas, or audio side effects). The `step(state, input)` function returns a fresh state each frame. All random choices use a seeded RNG.
- **`src/render.ts`:** Canvas rendering layer. Reads state and draws it; never changes game state.
- **`src/input.ts`:** Keyboard and gamepad input, merged into NES buttons.
- **`src/audio.ts`:** Web Audio synthesis for SFX and music stubs.
- **`src/data.ts`:** Game data (stores, palette, copy, physics constants).
- **`src/art.ts`:** Procedural pixel art generation.
- **`src/main.ts`:** Browser loop (60 Hz fixed step), ties everything together.

## Rules That Must Hold

1. **Deterministic simulation:** All randomness lives in `rules.ts` and uses the seeded RNG. A given seed always replays the same.
2. **Fixed 60 Hz timestep:** One `step()` call per frame, no matter how fast the browser renders.
3. **Input consumption:** Key press edges are consumed by one step only; holding a key after doesn't repeat the press.
4. **No side effects in rules:** `step()` is pure. Audio, DOM changes, and canvas operations happen in render/audio layers only.
5. **Frame units:** All timings (jump duration, enemy spawns, animations) use frame counts, not milliseconds.

## Current Status

### ✅ Complete

- Game loop and fixed-step simulation
- Splash screen (auto-skip after 3 s or on input)
- Title screen with start prompt
- Mall level with basic rendering
- Player movement, jumping, gravity
- Shooting with bullet physics
- Spy spawning and basic AI
- Collision detection (player/spy, bullets)
- Power-ups system (sneakers, rapidfire, spread shot, armor)
- Input handling (keyboard + gamepad fallback)
- Seeded RNG with frame-based determinism
- Test suite (RNG, game state, basic gameplay)

### 🔄 In Progress

- Sprite rendering (currently placeholder rectangles)
- Store interior system (top-down rooms, searching, guards)
- Elevator mechanics (manual control, crushing spies)
- Escalators and other floor transitions
- All 13 storefronts with unique themes and layouts
- Detailed NPC behavior (janitor, mall walkers, cop, photo booth)
- Level clear screen with score tally
- Continue/game over screens
- Music playback (currently silent stubs)

### ❌ Not Started

- CRT post-effect and scaling
- Sprite animation frames
- Dynamic difficulty scaling per loop
- Alarm trigger and speed boost
- Black Friday mode
- SPYGRAM posts with photo booth
- Shopping mall directory kiosk system
- All copy/dialogue lines
- Comprehensive test coverage for stores and NPCs

## How to Verify

1. **Run tests:** `npm test` — should pass 20+ assertions
2. **Dev server:** `npm run dev` → `http://localhost:5173`
   - Try splash skip, start game, move around with arrows, shoot with Z
   - Spies should appear after ~5 seconds
   - Enemies move and shoot back
3. **Debug mode:** `?debug=1` exposes `window.gameContext.step(frames, buttons)`
4. **Fixed seed:** `?seed=42` — play twice, both runs identical

## Gotchas

- Input press edges must be cleared after each `step()`, else keys get stuck.
- Jumping while moving should carry forward momentum (jump-kick).
- Floors are 48px apart; player must not fall through gaps.
- Bullets move independently of player frame step; they need their own update.
- Power-ups in stores should not reset on death (except some; Radar is permanent per level).
- Elevator doors are closed while moving, open while stopped.
- Escalator transitions are automatic (player walks onto, gets carried).

## Next Implementation Steps

1. **Sprite system:** Render `Art` sprites via `Canvas.putImageData` with palette lookup
2. **Store system:** Separate top-down `Screen.Store`, fixture search progress, guards
3. **Elevators:** Rider detection, floor-stop dinging, crushing physics
4. **NPC variety:** Janitor (wet floor slide), mall walkers (hittable, knockback), cop chasing
5. **Level scaling:** Loop N increases spy speed/spawn rate/fire rate by ~10-15% each
6. **Audio:** Background music per screen, SFX queue for priority mixing
7. **Full copy:** Jokes, store lines, spy last words, PA announcements
8. **CRT effect:** Scanlines, curvature, vignette as an optional canvas post-process

## Testing Strategy

Each major feature (physics, enemy AI, power-ups, floor transitions) has a unit test. Run with `npm test`. New features should add tests *before* implementation (TDD) to clarify expected behavior.

---

See [`one-shot-prompt.md`](../../blob/main/one-shot-prompt.md) on `main` for the full specification.
