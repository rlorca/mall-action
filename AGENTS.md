# MALL ACTION — Rust implementation

This orphan branch belongs to the Rust-constrained GPT-6.1 Sol benchmark. Never merge another implementation into it. The root repository's shared one-shot-prompt.md is immutable.

- `src/game.rs`: pure fixed-frame simulation, seeded RNG, collision, elevators, stores and progression. No browser calls. Use integer coordinates; one tick is 1/60 second.
- `src/art.rs`: source-defined pixel font and sprites, NES-like palette and software framebuffer.
- `src/render.rs`: draws immutable state. Never mutate simulation from rendering.
- `src/copy.rs`: editable jokes and captions.
- `src/splash.rs`: reusable studio timing module; see splash/README.md.
- `src/lib.rs`: a tiny raw WebAssembly ABI, exposing framebuffer, input, sounds and debug operations.
- `browser.js`: input edge queue, fixed-step scheduling, WebGL CRT, Web Audio and persistence. No game rules.

Run `npm test`, `npm run build`, `npm run dev`. Rust requires the wasm32-unknown-unknown target (`rustup target add wasm32-unknown-unknown`). No Cargo or npm third-party dependencies. Browser verification must include real keyboard input with CRT enabled, screenshots, console checks and deterministic debug assertions.

Keep pause/map timers frozen, elevator stops aligned and ding events unique. Calls protect waiting riders. Package acquisition and level clear are idempotent. Persistent room fixtures survive re-entry; guards reset. Debug mutations are enabled only by ?debug=1. Browser keyup uses the mapping recorded at keydown. Consume queued edges once per simulation tick. WebGL uploads RGBA pixels from Wasm memory; refresh views after memory growth.

Publishing uses the branch workflow and relative asset URLs. Never edit generated gh-pages builds manually.
