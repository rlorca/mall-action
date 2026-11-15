# AGENTS.md — MALL ACTION (Rust + Macroquad)

Guidance for future coding agents. Read this before changing anything.

## Architecture

Cargo workspace, two crates:

* **`core/` (`mall-core`)** — zero dependencies. Pure game rules (`src/game`), a software **renderer** that draws state onto a
  256×240 RGBA `Canvas` (`src/render`), generated pixel art (`src/art`), NES-style chiptune synth (`src/audio`), copy (`src/copy.rs`),
  input mapping (`src/input.rs`). Everything here is unit-tested natively with `cargo test -p mall-core`.
* **`app/` (`mall-action`)** — the Macroquad shell: window + integer-scale letterbox, CRT shader (`crt.rs`, falls back to a plain blit
  if it fails to compile), keyboard glue (`keys.rs`), audio playback (`audio.rs`), browser glue (`platform.rs`).
* **`web/`** — `index.html`, `mall_plugin.js` (miniquad plugin: gamepad, URL options, localStorage, blur detection, `window.mallDebug`) and
  `mq_js_bundle.js` = miniquad `gl.js` + quad-snd `audio.js` + `mall_plugin.js` concatenated (the matching versions are pinned:
  `macroquad =0.4.16`). **If you bump macroquad, regenerate the bundle** (`cat miniquad/js/gl.js quad-snd/js/audio.js web/mall_plugin.js`)
  and keep the file order: plugin last.

Data flow per rendered frame: `FixedStep::advance(dt)` → N × (`Pad::begin_step()` → `Game::step(PadState)`) → `Renderer::render(&Game, &mut Canvas)`
→ upload canvas as a nearest-filtered texture → (CRT material) → screen. Audio: `Game::take_sfx()`, `Game::song()`, `Game::music_volume()`, `Game::hum()`.

## Rules that must hold

1. **Game rules are separate from rendering.** `game/*` never touches pixels, sprites or sound output; it emits `Sfx` events and exposes
   `song()`. `render/*` only reads state. Never put a rule in the renderer or a draw call in the rules.
2. **All randomness is seeded.** Use the `Rng` passed down (`ctx.rng`); never `rand`, time, or `HashMap` iteration order for decisions.
   Same seed ⇒ same game (there is a test).
3. **All timings are frames at 60 Hz** (`SEC = 60`). No wall-clock time in `game/*`. Rendering is decoupled (`fixedstep.rs`, catch-up capped at 5).
4. **Sprites are ASCII `SpriteDef`s with ≤ 3 colours + transparent** (`pixel.rs`); palette indices come from the 64-colour NES master palette.
   Tests enforce size/colour limits and that the renderer never requests a missing sprite (`render::tests`).
5. **Copy lives in `copy.rs`** and every line is length-tested.
6. **Input:** letter keys map by printed char, others by physical code; a release clears exactly what the press set; taps are queued so
   fast taps survive several sim steps per frame (`input.rs` tests).
7. The mall is paused (no timers) only in the map/pause/continue screens; power-up timers tick in stores too (`Game::step_play`).

## Conventions

* Floors: P=0, 1F..4F=1..4, R=5; `level::floor_y(f)`; floors are 48 px apart; walking line = top of the floor slab.
* Positions in the mall are `f32` pixels (feet y derived from floor + `z`); stores use pixel coordinates in room space.
* New sprite ⇒ add to the right file in `src/art/`, name it per the catalogue at the top of that file (`name` or `name_0..N` animations).
* New sound ⇒ add to the `Sfx`/`Song` enums, implement in `audio/`, and keep the tests that check peak level, determinism and looping.

## How to verify changes

```sh
export PATH=<toolchain with wasm32>/bin:$PATH
cargo test -p mall-core          # must pass: CI runs exactly this, then ./build.sh
./build.sh                       # production build into dist/
```

Visual check without a browser: `cargo run --release -p mall-core --example shot -- <scenario> out.png` (scenarios: title, selfie, walk, combat,
elevride, store, map, clear, continue, gameover, ...). Real check: serve `dist/` under a sub-path (e.g. `/mall-action/`) and drive it with headless
Chrome over CDP; with `?debug=1` use `window.mallDebug.step(frames, mask)` and `get(i)` for deterministic runs. Keep the CRT ON for playtests
(it is the default; the setting persists in localStorage, so clear it between sessions).

## Playtest hooks (`?debug=1`)

`window.mallDebug` (see `web/mall_plugin.js`): `step(n, mask)`, `get(i)`/`fields`, `set(name, v)` (teleport/cheats, `Game::debug_cmd`), `resume()`.
The first `step()` suspends real-time simulation so runs are deterministic with `?seed=N`. Cheats are ignored without `?debug=1`.

## Gotchas we hit

* Recent Rust no longer links wasm imports implicitly: `.cargo/config.toml` passes `-C link-arg=--import-undefined` for wasm32.
* Macroquad has no gamepad/URL/localStorage API: they come from the JS plugin through integer imports (`mall_gamepad_mask`, ...).
  `#[no_mangle] extern "C"` functions in the app (`mall_debug_step/get`) are exported to JS automatically.
* Macroquad's key events carry physical codes only; printed letters are paired from `get_char_pressed()` in `app/src/keys.rs`.
* `git worktree` + other agents: the shell cwd resets; always use absolute paths.
* Spies spawning out of a stopping car right on top of the player used to be an instant death; spawns are now suppressed within 70 px of
  the player and spies cannot touch-kill during their first 20 frames.
* Elevator pits: loop 1 starts shafts A and B at most one floor away from the roof/4F so a first fall is survivable.
* The automatic car (shaft C) never leaves while the player is *inside*: ride its roof instead (fall onto it from the floor above).
* Lamps hang at chest-shot height; when testing bullets on a floor, check for lamps/fountains in the line of fire (they absorb the shot).
* Native `cargo test` of the *app* crate would need ALSA on Linux; CI tests only `mall-core`.
* Macroquad's `load_sound_from_bytes().await` loops `next_frame()` until the browser has decoded the buffer: calling it in the game loop
  stalls the game. All audio is therefore rendered behind a LOADING bar and decoded in coroutines (`app/src/audio.rs`).
* Per-game (not per-loop) flags live in `Session` (`egg_done`, `visited`, `strip`), per-level state in `Mall`/`StoreState`.
* The CRT shader samples slightly *outward* (rounded extreme corners) so no picture content is ever cropped; keep HUD text >= 4 px from the edges.
