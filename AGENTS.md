# AGENTS.md — MALL ACTION implementation

## Architecture

This branch is a self-contained browser game built with vanilla JavaScript, Vite, Canvas 2D, Web Audio, and Vitest. It has no runtime package dependencies and no external art or audio assets.

- `src/core/` is the **pure rules layer**. It must not read the DOM, Canvas, Web Audio, wall-clock time, or `Math.random()`.
- `src/core/game.js` owns mutable game state and advances it exactly one 60 Hz frame per `step(input)` call. Events returned by a step are the only route from rules to sound and screen effects.
- `src/render/` reads state and draws it. It must not change game rules. Sprites and the font are generated pixel data.
- `src/main.js` is the browser adapter: fixed-step accumulator, keyboard/gamepad input, resize, local persistence, and debug API.
- `src/audio.js` synthesises two pulse-style channels, triangle, and noise. Browser autoplay means it stays silent until unlocked by user input.
- `src/splash/flickersoft.js` is deliberately reusable and has no game-state dependency.

## Invariants that must hold

1. **Fixed frame units.** Gameplay durations are integer frames at 60 Hz, never milliseconds. Rendering and `requestAnimationFrame` do not determine game outcomes. Catch-up is capped by `FixedStepLoop`.
2. **Determinism.** Every gameplay random choice uses the seeded `RNG` in `src/core/rng.js`. Given the same seed and input sequence, state must replay exactly. CSS noise and audio scheduling are presentation-only.
3. **Input edges.** `fooPressed` is a fresh edge; `foo` is held state. Do not turn held B into repeated searches or held elevator input into repeated stop events. Key releases must remove the exact pressed token. Do not discard queued taps during catch-up.
4. **Pause means pause.** Map, pause, and continue screens stop gameplay and power-up timers, except the continue countdown itself. Timers otherwise keep running in stores.
5. **Level setup.** There are 13 storefronts: exactly six targets, four power-up shops, and three closed stores. Each target has exactly one package. Power-up shops never have traps or packages. Black Friday turns every non-package fixture into a power-up.
6. **Persistent searches.** Fixture contents and opened state survive leaving and re-entering. Cleared target stores cannot be entered again. First-visit lines and the GameStonk easter egg are once per game, not once per loop.
7. **Elevator edges.** Cars stop exactly on served floors, glide after release, and emit one ding per trip. Automatic cars do not depart with an occupant. Called cars protect their pickup. B is the only route to P.
8. **Fair combat.** Spy shots have a first-shot delay and a 30-frame aiming telegraph. Ducking avoids high, not low, shots. Dodge choice happens once per incoming volley. Invulnerability and armour must not be bypassed by a second hazard in the same frame.
9. **Exit and continue.** Level clear can fire only once. A continue preserves score, packages, and loop, resets power-ups, and grants three lives at the death spot. There are three continues per game.
10. **Pixel output.** Internal resolution is 256×240. Scale only by whole numbers with nearest-neighbour rendering. Sprites use at most three actual colours plus transparent. Do not introduce downloaded fonts, images, music, or sound files.
11. **Static sub-path builds.** Keep Vite `base: "./"`; never assume the game is hosted at `/`.

## Conventions

- Use small ES modules and plain serialisable state where practical. Entity IDs come from `MallGame.nextId`.
- Keep player-facing humour in `src/core/copy.js`; line-length tests are part of the contract.
- Store coordinates in rooms are logical pixels before the renderer's Y offset. Mall floor Y values are walkway baselines.
- Do not add a test that merely mirrors a magic number: exercise a state transition or player-visible invariant.
- Screenshots in `screenshots/` are real browser captures, not source art.

## Verification

Always run before committing:

```sh
npm test
npm run build
```

For gameplay or rendering changes, also run the real-time browser playtest with CRT enabled:

```sh
npm run dev -- --port 4173
# Chrome with --remote-debugging-port=9222, then:
node scripts/browser-playtest.mjs
```

Check console output is empty and actually inspect changed screens. Test a nested base URL for deployment changes. Useful debug URLs are `?debug=1&seed=42` and `?gallery=1`.

## Gotchas already handled

- Up boards an escalator at its **bottom**; Down boards at its **top**.
- Enemy bullets need `enemy: true`; otherwise the shared collision pass treats them as player bullets.
- A lamp's shade/cord must intersect standing-shot height, not only look reachable.
- `killPlayer` can change scene during a rules update. Check scene transitions before starting another scene's update.
- Store HUD names need clipping/marquee scrolling; full names such as HOT SPY ON A STICK do not fit the LED panel.
- Browser favicon requests count as console errors in automated playtests; the favicon is inline and generated.
- Web Audio methods can fail or remain suspended. The game must continue silently.
