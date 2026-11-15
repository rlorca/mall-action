# AGENTS.md (branch `bevy-sonnet-5-5`)

Rust + Bevy implementation of MALL ACTION. Read `README.md` first for the product; the spec is `one-shot-prompt.md`
on `main` (read-only). See the repo-level AGENTS.md on `main` for branch/publishing conventions.

## Architecture
- `core/` (`mall-core`) is **pure and dependency-free**: rules, art, audio synthesis, software rendering into a
  256x240 palette-indexed `Fb`. It never touches a window, the clock or audio devices.
- `app/` (`mall-app`) is the Bevy shell (wasm only): feeds key events into `InputMapper`, runs `FixedStep`
  (60 Hz, capped catch-up) from real time, calls `Game::step/draw`, uploads the framebuffer as a texture shown by
  a CRT `Material2d` (`crt.wesl`), pulls samples from `Synth` in a Bevy `Decodable`. Debug hooks: `app/src/debug.rs`.
- `splash/` is a standalone reusable crate (no deps).
- Data flow: `Game::step(PadState)` -> scenes (`mall::Mall`, `store::StoreRoom`, `screens::*`) -> `Out` events
  (`Sfx`, `Track`, `Hum`, `MusicVolume`) -> `Game::drain_events` -> `Synth::apply`.

## Rules that must hold
1. **Rules separate from rendering**: `draw(&self, ...)` only reads state. Everything testable without a browser.
2. **Seeded randomness only** (`rng::Rng`, `run.rng`); no clocks, no HashMap iteration order in game logic.
3. **Frame units** (60 Hz): all timings in frames.
4. **Palette discipline**: NES palette (`pixel::pal`), sprites <= 3 colours + transparent (tested by `art::tests`).
5. **All copy in `core/src/copy.rs`** with length tests. **No external assets**.
6. Level layout is single-sourced in `core/src/layout.rs` (mall + map overlay use it).
7. Sprites are looked up by name via `art::get`; `art/manifest.rs` lists every required name and size.

## Verify changes
```
cargo test -p mall-core -p mall-splash
./build.sh && python3 -m http.server -d dist   # then open ?debug=1 and drive window.mallDebug
```
Browser playtest recipe: headless Chrome with `--enable-unsafe-swiftshader --use-angle=swiftshader`, serve `dist`
under a sub-path, open `?debug=1&seed=N`, step with `mallDebug.step(n, mask)`, `mallDebug.cmd(...)` to warp, then
screenshot over CDP. `core/examples/shot_*.rs` render screens to PNG without a browser; `render_wav` dumps audio.

## Gotchas
- **Disk**: Bevy builds are big. Never compile `mall-app` natively; only `-p mall-core`/`-p mall-splash` for tests.
- **wasm-bindgen CLI must equal the `wasm-bindgen` crate version** (pinned `=0.2.130` in `app/Cargo.toml`,
  `build.sh`, and the workflow). Bump all three together.
- Bevy 0.20: events are `Message`s (`MessageReader`); custom shader is WESL embedded with `embedded_asset!`;
  `bevy::audio::AddAudioSource` must be imported. Don't carry over miniquad's `--import-undefined` flag.
- Browsers keep `AudioContext` suspended until a gesture: `index.html` wraps `AudioContext` and resumes on input;
  the Bevy audio player is only spawned after the first interaction.
- Keys are matched by printed letter, released by physical code (`input.rs`); keep that to avoid stuck keys.
- zsh expands `=0.2.130`: quote version args.
- The first `mallDebug.step` suspends real time; call `mallDebug.resume()` to go live. CRT choice persists in
  `localStorage` (`mall-action.crt`): clear it when taking default screenshots.
- Headless SwiftShader runs slowly, so real-time sims look slow there; use debug stepping for timing checks.
