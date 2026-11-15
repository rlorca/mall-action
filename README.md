# MALL ACTION: Rust + WebAssembly port of Sonnet 5.5 + Fable 5.1

An 8-bit spy caper in an 80s shopping mall (a FLICKERSOFT fan homage). This branch is a **port**, not a one-shot run:
the game from branch [`sonnet-5-5-fable-5-1`](../../tree/sonnet-5-5-fable-5-1) (TypeScript + Vite, commit `9475506`)
translated into the same architecture as [`rust-gpt-6.1-sol-medium`](../../tree/rust-gpt-6.1-sol-medium): a pure Rust
simulation and software renderer compiled to raw WebAssembly (no wasm-bindgen, no crates), with a small plain-JS shell
for input, the WebGL CRT, Web Audio and persistence.

Controls, rules, stores, power-ups, art and music are those of the original; see its README. Debug URLs are kept:
`?seed=N`, `?debug=1` (skip the splash, expose `window.__mall`), `?gallery=1` (sprite gallery), `?start=1`, `?skipintro=1`. The `window.__mall` debug API keeps `step`, `tap`, `pump`, `state`, `render`, `shot`, `realtime`, `input` and `audio`, but no longer exposes `game`, `fb` or the in-page `bot` (the state lives in wasm; `state()` returns a JSON summary).

## Layout

| Path | What |
|---|---|
| `src/engine`, `content`, `art`, `game`, `render`, `flickersoft.rs` | The Rust core; the module tree mirrors the TypeScript `src/` tree |
| `src/lib.rs` | The raw wasm ABI (`init`, `tick`, `draw`, `sfx_next`, `music`, `duck`, `osd_show`, `state_json`, ...) |
| `browser.js`, `web/` | Shell: fixed 60 Hz loop, keyboard/gamepad edge queue, WebGL CRT presenter, wiring |
| `audio/` | Music and sound synthesis, plain ES modules transpiled from the TypeScript audio (unchanged logic) |
| `fixtures/` | Golden data generated from the TypeScript game (traces, sprite hashes, render hashes) |
| `scripts/trace.ts`, `scripts/render-world.ts` | The generators for those fixtures (they run against the TypeScript worktree) |
| `PORTING.md` | The conventions the port followed |

## Parity with the original

The port is held to frame-exact parity, not "looks similar":

* `fixtures/golden-trace.json`: five scripted-input scenarios played on the TypeScript game, recording scene, music, a
  framebuffer hash and sound effects every 10 frames. `tests/golden.rs` replays them natively and `tests/wasm.test.mjs`
  replays them through the **built wasm** in Node. Both match.
* Every sprite (all of `art/`) matches the TypeScript registry frame by frame; ~2,700 render states of the HUD, store
  rooms, mall and whole-game scenes and ~265 screen states match by framebuffer hash.
* The RNG is bit-exact (mulberry32, `fork` labels), so seeds produce the same levels, spies and loot.
* The TypeScript test suites for the rules, the art, the renderers, the bot playthroughs (every store and the whole mall) and the audio were ported (524 Rust tests + 70 audio tests). The browser-only input/loop/scale tests were not ported: `web/*.js` is transpiled TypeScript and has no tests here.
* `Math.pow` in `difficulty()` is baked in as bit-exact tables (`fixtures/difficulty.txt` checks loops 1-70 bit for bit), so a libm difference between native, wasm and V8 cannot change the simulation. The golden traces stay in loop 1; later loops are covered by the ported unit tests, not by a TypeScript trace.

Known deliberate difference: Rust's `Framebuffer::fill_rect` does not reproduce a JavaScript `Uint8Array.fill` quirk
(a rect with `y == 0` lying wholly off the left edge fills the whole screen in the TypeScript engine); no fixture reaches it, but that is not proven for all play.

## Commands

```
npm test         # cargo test --release (524 unit tests + golden replay) and node --test (audio, wasm replay)
npm run build    # cargo build --release --target wasm32-unknown-unknown, then dist/ with cache-busting hashes
npm run dev      # serve dist/ at http://127.0.0.1:4176
```

Requires Rust with the `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`) and a recent Node (tested with 26; CI is pinned to 26 and the audio tests need `node:test` mocks). Note: Homebrew's Rust has no wasm target; use rustup.

## Benchmark notes

* **Model:** Claude Sonnet 5.5 (`claude-sonnet-5-5`) as the lead, with a Claude Fable 5.2 (`claude-fable-5-2`) advisor
  (this session's advisor; the source branch used Fable 5.1). Module ports were delegated to sub-agents of the same model.
* **Date:** 2026-11-15. **Harness:** Claude Code, with sub-agents working in parallel on separate modules. Effort setting: the session default (not recorded). Duration: roughly 1.5 to 2 hours wall-clock.
* **Interventions:** none on the design. One human interruption at the start (branch naming); the lead repaired build wiring (`art::init` re-export, module registration) and the wasm toolchain path.
* **Not a one-shot:** the task was "convert the Sonnet 5.5 + Fable 5.1 branch to Rust + WebAssembly like the Rust GPT
  branch", with a parity oracle (golden traces) built first. It is a translation benchmark, not comparable to the
  one-shot-prompt runs.
* **Verification:** cargo tests, golden replay native and wasm, and a real-browser run (headless Chrome over CDP: real
  key input, WebGL CRT on, no console errors, `?gallery=1`).
* **Not yet done:** audio was verified by the ported offline tests only, not by ear in a browser; nothing has been published.
