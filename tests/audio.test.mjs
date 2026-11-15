// Audio test suite (ported from the vitest tests in src/audio of the TypeScript game) for node:test.
// Run from the repo root:  node --test tests/audio.test.mjs
// The three groups below live in tests/audio-cases/ and use a small vitest-compatible shim over node:test/assert.
import './audio-cases/song.cases.mjs';
import './audio-cases/tracks.cases.mjs';
import './audio-cases/engine.cases.mjs';

// Integer host API used by the Rust core (setMusic: 0 = silence, n = MUSIC_IDS[n-1]; playSfx: SFX_IDS index).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../audio/audio.js';
import { MUSIC_IDS, SFX_IDS } from '../audio/ids.js';

test('integer host API maps indices onto ids', () => {
  const a = new AudioEngine();
  a.setMusic(1);
  assert.equal(a.musicPlaying(), MUSIC_IDS[0]);
  assert.equal(a.musicPlayingIndex(), 1);
  a.setMusic(MUSIC_IDS.length);
  assert.equal(a.musicPlaying(), MUSIC_IDS[MUSIC_IDS.length - 1]);
  a.setMusic(0);
  assert.equal(a.musicPlayingIndex(), 0);
  assert.doesNotThrow(() => SFX_IDS.forEach((_, i) => a.playSfx(i)));
  assert.doesNotThrow(() => a.playSfx(9999));
  assert.equal(a.toggleMute(), true);
});
