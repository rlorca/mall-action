// Runs the built wasm in Node and replays the golden trace (made from the TypeScript game) through the raw ABI,
// proving the wasm build (not just the native build) matches frame for frame, including libm differences.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SFX_IDS, MUSIC_IDS } from '../audio/ids.js';

const WASM = 'target/wasm32-unknown-unknown/release/mall_action.wasm';
const B = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, SELECT: 64, START: 128 };
const MASKS = [0, B.RIGHT, B.LEFT, B.RIGHT | B.B, B.LEFT | B.B, B.A, B.RIGHT | B.A, B.UP, B.DOWN, B.B, B.UP | B.RIGHT, B.DOWN | B.RIGHT, B.START, B.SELECT, B.A | B.B, 0];
const SCN = [
  ['splash', 99, 0, 700, 5, 400], ['title-run', 7, 1, 4000, 11, 10], ['auto', 1234, 4 | 8, 5000, 23, 0],
  ['auto-intro', 42, 4, 3000, 31, 0],
];
const golden = JSON.parse(readFileSync('fixtures/golden-trace.json', 'utf8'));

async function load() {
  const { instance } = await WebAssembly.instantiate(readFileSync(WASM), {});
  return instance.exports;
}

test('wasm exports the expected ABI', async () => {
  const x = await load();
  for (const n of ['memory', 'init', 'tick', 'draw', 'sfx_next', 'music', 'duck', 'osd_show', 'osd_tick', 'state_json', 'state_json_len', 'frame_hash']) assert.ok(n in x, n);
  x.init(7, 1);
  x.tick(0, 0, 0);
  const rgba = new Uint8Array(x.memory.buffer, x.draw(), 256 * 240 * 4);
  assert.ok(rgba.some((v) => v !== 0), 'framebuffer has content');
  assert.equal(rgba[3], 255);
});

for (const [name, seed, flags, frames, inputSeed, startAt] of SCN) {
  test(`wasm replays golden trace: ${name}`, async () => {
    const x = await load();
    x.init(seed, flags);
    let held = 0, prev = 0, lcg = inputSeed >>> 0;
    const want = golden[name];
    let row = 0;
    for (let f = 0; f < frames; f++) {
      if (f % 15 === 0) { lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0; held = MASKS[(lcg >>> 16) % 16]; }
      let m = held;
      if (f === startAt && startAt > 0) m = B.START; else if (m & B.START && f % 15 !== 0) m &= ~B.START;
      if (name === 'splash' && f < startAt) m = 0;
      x.tick(m, m & ~prev, prev & ~m); prev = m;
      const sfx = []; for (let s = x.sfx_next(); s !== 0; s = x.sfx_next()) sfx.push(SFX_IDS[s - 1]);
      if (f % 10 === 9 || sfx.length) {
        x.draw();
        const mu = x.music();
        const got = `${f} ${sceneOf(x)} ${mu === 0 ? 'null' : MUSIC_IDS[mu - 1]} ${x.frame_hash() >>> 0} [${sfx.join(',')}]`;
        assert.equal(got, want[row], `${name}: row ${row}`);
        row++;
      }
    }
    assert.equal(row, want.length);
  });
}

function sceneOf(x) {
  const n = x.state_json(), len = x.state_json_len();
  return JSON.parse(new TextDecoder().decode(new Uint8Array(x.memory.buffer, n, len))).scene;
}
