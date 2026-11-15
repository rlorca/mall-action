# Porting guide (TypeScript -> Rust)

This branch is a faithful port of the TypeScript game on branch `sonnet-5-5-fable-5-1` (commit 9475506, checked out
kept read-only in a separate git worktree) into Rust compiled to WebAssembly,
in the shape of branch `rust-gpt-6.1-sol-medium` (raw wasm ABI, no wasm-bindgen, no crates).

Parity is the goal: the same seed + the same inputs must give the same game, frame for frame. `fixtures/golden-trace.json`
(made by `scripts/trace.ts` from the TS source) holds a framebuffer hash per ~10 frames; `tests/golden.rs` replays it.

## Rules of the port
* Toolchain: stable Rust with the `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`).
  Edition 2021. No third-party crates. Use `#[no_mangle]` only in lib.rs.
* Module tree mirrors the TS tree: `src/engine`, `src/content`, `src/art`, `src/game/{mall,store,screens}`, `src/render`, `src/flickersoft.rs`.
  TS `foo/bar.ts` -> `foo/bar.rs`; a TS class -> struct + impl; unions of string literals -> `enum` (derive Clone, Copy, PartialEq, Eq, Debug)
  with `as_str()` if the string is needed (copy, ids). Keep names snake_case versions of the TS names so the two can be diffed.
* Numbers: use `f64` wherever TS holds fractions; `i32` for true integers (indices, frame counters, tiles). Never use `f32`.
* JS semantics: `Math.round` -> `engine::num::round_i/js_round` (NOT `f64::round`); `x|0` -> `to_i32`; `>>>0` -> `to_u32`; `Math.imul` -> `imul`.
  `Math.floor`, `Math.sqrt`, `sin`, `cos`, `hypot` map to f64 methods. `x % y` on doubles is Rust's `%` on f64.
* Ordering: JS Map/Set iterate in insertion order and Array.sort is stable. Use `Vec` (and `sort_by` / `sort_by_key`, which are stable), never `HashMap`/`HashSet`.
  Any place iteration order matters (spawning, collision loops, draw order, rng calls) must be reproduced exactly: rng call ORDER is what keeps parity.
* Randomness only through `engine::rng::Rng` (bit-exact with TS). `fork(label)` labels must be identical strings.
* No `std::time`, no threads, no I/O in the game. The sim is pure and deterministic.
* Mutable-aliasing: TS shares object references freely. In Rust prefer indices/ids into Vecs, or pass `&mut` explicitly; clone small data. Do not use `Rc<RefCell>` unless unavoidable.
* Tests: port every `*.test.ts` next to the module as `#[cfg(test)] mod tests` (or `tests/*.rs` for ones that cross modules). They are the spec. Keep the same test names (snake_case).
  Do not weaken or delete a test to make it pass; if a test seems to disagree with the TS behaviour, investigate (the TS tests all pass: `npx vitest run` in the source worktree).
* Comments: keep the TS doc comments (they hold the design rules). Port copy/jokes verbatim, character for character.
* Do NOT edit the source worktree (`sonnet-5-5-fable-5-1`). Write only inside your assigned files in the rust worktree.

## Parallel work
The port was done by several agents at once, each owning disjoint files and building in a private copy of the tree; shared `mod.rs` files were registered by the lead only once the module compiled.
