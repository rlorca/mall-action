# AGENTS.md: MALL ACTION, Rust + WebAssembly port (branch `rust-sonnet-5-5-fable-5-1`)

Orphan branch. Never merge another implementation into it. This is a port of `sonnet-5-5-fable-5-1` (TypeScript); read
`PORTING.md` for the conventions and that branch's `AGENTS.md` for the game's rules, which all still hold.

* Simulation and rendering are pure Rust (`src/`, tree mirrors the TS tree). Rules never touch time, I/O or the DOM; all
  randomness is `engine::rng::Rng` (bit-exact mulberry32). One tick is 1/60 s; `Game::step(pad)` is the only entry point.
* `src/lib.rs` is the whole wasm ABI. `browser.js` + `web/` do input, the WebGL CRT and audio; no game rules there.
  Audio is JS (`audio/`), driven by integer ids (`index+1` into `SFX_IDS` / `MUSIC_IDS`; Rust enums in `audio_ids.rs`
  must keep the same order as `audio/ids.js`).
* JS numeric semantics are reproduced deliberately (`engine::num`: `round_i` = `Math.round`, not `f64::round`). Keep
  `f64` for fractions, `Vec` not `HashMap` (iteration order matters), and keep rng call order identical when editing.
* Parity gate: `cargo test --release` (incl. `tests/golden.rs`) and `node --test tests/` (incl. wasm replay). If you
  change behaviour intentionally, regenerate the fixtures from the TS worktree only when the TS source changes; never
  edit a fixture to make a test pass.
* Toolchain: Rust with `wasm32-unknown-unknown`, no crates. Verify visual changes in a browser at 256x240 with the CRT on.
* Publishing: `.github/workflows/pages.yml` publishes `dist/` to `gh-pages/rust-sonnet-5.5-fable-5.1/` on push to this branch.
  Builds use relative URLs and `?v=<hash>` cache-busting. Never edit gh-pages by hand.
