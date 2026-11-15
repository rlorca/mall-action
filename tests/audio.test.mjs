// Audio test suite (ported from the vitest tests in src/audio of the TypeScript game) for node:test.
// Run from the repo root:  node --test tests/audio.test.mjs
// The three groups below live in tests/audio-cases/ and use a small vitest-compatible shim over node:test/assert.
import './audio-cases/song.cases.mjs';
import './audio-cases/tracks.cases.mjs';
import './audio-cases/engine.cases.mjs';
