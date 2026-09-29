# MALL ACTION — GPT-6.1 Sol

This orphan branch is the independent GPT-6.1 Sol benchmark. Do not merge or rebase it with `main` or another implementation. The shared spec lives on `main`; do not modify it. Publish only to `gpt-6.1-sol/`, preserving the other games.

## Architecture

- `src/core.ts`: seeded xorshift RNG, fixed 60 Hz scheduler, virtual NES pad and ordered press queue. No browser dependencies in these classes.
- `src/data.ts`: store definitions, hand-authored room fixture layouts, shaft ranges, difficulty curves.
- `src/game.ts`: deterministic state and simulation. `step(game, held, pressed)` updates one frame; `events` describes sound cues. Rules never call DOM, Canvas, Audio, wall-clock APIs or unseeded randomness. All timers and velocities use frames and pixels per frame.
- `src/copy.ts`: humour, posts, dialogue, PA and newspaper text. Keep bubble lines <=28 characters, caption/comment lines <=21, headline lines <=26. `wrap` handles longer PA/banner text.
- `src/art.ts`: fixed master palette, three-colour bitmap sprites and 3×5 font source. Sprites must have exact row dimensions. Mall people 16×24; store people 16×16.
- `src/render.ts`: presentation only, reads game state. Canvas generates the 256×240 image, integer positions and nearest-neighbour sprites.
- `src/crt.ts`: WebGL presentation, texture sampled nearest. Curvature coordinates are clamped; never mask the game. `src/main.ts` owns browser IO, persistent CRT preference, resizes and debug API.
- `src/audio.ts`: original source melodies and NES-inspired synthesis; audio failures must not affect simulation.
- `src/splash/`: reusable FLICKERSOFT ident, no browser dependency.

## Verification

Run `npm ci`, `npm test`, `npm run build`. Do not weaken an assertion to hide a rules defect. Tests cover deterministic input/runtime, artwork/copy, level setup, traversal, physics, elevators, combat, powers, NPCs, search/extras, continues and full loop flow.

For browser checks run `npm run dev -- --port 5179` and open `http://127.0.0.1:5179/?debug=1&seed=42`. Inspect the console and actual screenshots with CRT **on**. `scripts/browser-playtest.mjs` exports `run(page, base, screenshotDirectory)` for a Playwright-compatible browser harness. It uses real key events and real-time simulation, with prepared positions for isolated interactions. It never advances through deterministic debug steps. A production sub-path check is also required.

`window.mallAction` is exposed only with `debug=1`; it contains `game`, `input`, `audio`, `renderer`, `running` and `step(n, held, pressed)`. Set `running=false` before using the stepping API for controlled tests; restore it afterward. `window.game` aliases the state. `gallery=1` renders the sprite atlas; `seed=N` fixes the RNG.

## Gotchas

- Consume queued presses **one at a time in arrival order**, even if different buttons arrive in one render frame. A map-close followed by search can otherwise discard search. Keyup removes the original physical key's binding, independent of its current printed letter.
- A called car can clear its call at arrival only after deciding whether the waiting passenger is still beside it. Crush checks use current occupancy, not occupancy captured before pickup.
- Elevators glide to exact floor coordinates and emit only one ding per stop. An automatic car cannot leave with a passenger inside.
- Searched fixture state belongs to the persistent room. Guard state belongs to the current visit. Never recreate rooms on re-entry.
- First-visit dialogue must finish before guards act. Renew entry invulnerability at the end of dialogue, so it is useful during playable frames.
- All bullets in a spread volley share one ID, so spies make one dodge decision per volley.
- Store power timers run; map/pause/continue timers stop. Death keeps Radar; continuing resets it.
- WebGL canvas dimensions change on resize; set its viewport each draw. Do not alter texture filtering or CSS pixel scaling.
- Use `127.0.0.1` during automation: another local process may bind the same port on IPv6 `localhost`.
- The publication workflow must use the shared `pages-publish` concurrency group. Test and build precede publication. Only replace this implementation's directory. The landing-page update is automated and idempotent.
