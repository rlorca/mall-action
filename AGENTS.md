# MALL ACTION — Rust implementation

This orphan branch belongs to the Rust-constrained GPT-6.1 Sol benchmark. Never merge another implementation into it. The root repository's shared one-shot-prompt.md is immutable.

- `src/game.rs`: pure fixed-frame simulation, seeded RNG, collision, elevators, stores and progression. No browser calls. Use integer coordinates; one tick is 1/60 second.
- `src/art.rs`: source-defined pixel font and sprites, fixed 48-colour master palette and software framebuffer.
- `src/pixel.rs`: pixel-row bitmap atlas. Dots are transparent, digits 1–3 are material inks. Keep every sprite to three inks, add new props to `ALL`, and inspect them in the four-page `?gallery=1` view.
- `src/render.rs`: draws immutable state. Never mutate simulation from rendering.
- `src/copy.rs`: editable jokes and captions.
- `src/splash.rs`: reusable studio timing module; see splash/README.md.
- `src/lib.rs`: a tiny raw WebAssembly ABI, exposing framebuffer, input, sounds and debug operations.
- `browser.js`: input edge queue, fixed-step scheduling, WebGL CRT, Web Audio and persistence. No game rules.

Run `npm test`, `npm run build`, `npm run dev`. Rust requires the wasm32-unknown-unknown target (`rustup target add wasm32-unknown-unknown`). No Cargo or npm third-party dependencies. Browser verification must include real keyboard input with CRT enabled, screenshots, console checks and deterministic debug assertions.

Keep pause/map timers frozen, elevator stops aligned and ding events unique. Calls protect waiting riders. Package acquisition and level clear are idempotent. Persistent room fixtures survive re-entry; guards reset. Debug mutations are enabled only by ?debug=1. Browser keyup uses the mapping recorded at keydown. Consume queued edges once per simulation tick. WebGL uploads RGBA pixels from Wasm memory; refresh views after memory growth.

Publishing uses the branch workflow and relative asset URLs. Never edit generated gh-pages builds manually.

Art changes must be inspected in the browser at 256×240 with CRT on. Keep silhouettes legible against both pale mall walls and dark store floors. Animate walking from travelled distance, so idle actors do not walk in place. Build assets have content-hashed URLs to prevent the browser displaying a stale Wasm renderer after publishing.

Collision geometry lives in `src/collision.rs`. Store actor coordinates are sprite top-lefts: movement uses the 10×6 feet at (+3,+10), while bullets use their own 3×2 bounds. Never use `Room::solid` for bullets or toys; use `Room::blocks(Rect)`. Unit-step movement prevents tunnelling; corner assistance nudges one lateral pixel only within three pixels of an edge. Mall y is the actor's foot height. Car roofs are `car.y - CAR_HEIGHT` (28), matching rendering. Landings sweep previous and current surfaces, including moving car floors. Fatal falls/crushes must resolve even during damage invulnerability. Depth-sort shop actors and furniture by their foot/front-edge positions.

Music runs in `synth-worklet.js` on the audio rendering thread, using the pure sample-clock `Synth` in `synth.js` and explicit arrangements in `score.js`. `audio.js` only starts the graph, sends state changes and plays effects. Do not schedule music from RAF or game stepping. Keep fades and headroom; preserve harmonic chord voicings. `tests/audio.test.mjs` checks waveform continuity, clipping, transport timing and transitions. `scripts/collision-playtest.js` checks real key-driven movement and music through a 750 ms main-thread stall.
