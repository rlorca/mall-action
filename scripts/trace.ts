// Golden-trace generator for the Rust port (parity oracle). Untracked on this branch.
import { writeFileSync } from 'node:fs';
import { Btn, padFromHeld } from '../src/engine/pad';
import { Framebuffer } from '../src/engine/framebuffer';
import { Game } from '../src/game/game';
import { renderGame } from '../src/render/gameView';
import '../src/art';

const MASKS = [0, Btn.RIGHT, Btn.LEFT, Btn.RIGHT | Btn.B, Btn.LEFT | Btn.B, Btn.A, Btn.RIGHT | Btn.A, Btn.UP, Btn.DOWN, Btn.B, Btn.UP | Btn.RIGHT, Btn.DOWN | Btn.RIGHT, Btn.START, Btn.SELECT, Btn.A | Btn.B, 0];
const fnv = (px: Uint8Array): number => { let h = 0x811c9dc5; for (let i = 0; i < px.length; i++) { h ^= px[i]!; h = Math.imul(h, 0x01000193); } return h >>> 0; };

interface Scn { name: string; seed: number; opts: Record<string, unknown>; frames: number; inputSeed: number; startAt: number }
const SCN: Scn[] = [
  { name: 'splash', seed: 99, opts: {}, frames: 700, inputSeed: 5, startAt: 400 },
  { name: 'title-run', seed: 7, opts: { skipSplash: true }, frames: 4000, inputSeed: 11, startAt: 10 },
  { name: 'auto', seed: 1234, opts: { autostart: true, skipIntro: true }, frames: 5000, inputSeed: 23, startAt: 0 },
  { name: 'auto-intro', seed: 42, opts: { autostart: true }, frames: 3000, inputSeed: 31, startAt: 0 },
  { name: 'bf', seed: 3, opts: { autostart: true, skipIntro: true, blackFriday: true }, frames: 4000, inputSeed: 47, startAt: 0 },
];
const out: Record<string, unknown> = {};
for (const s of SCN) {
  const g = new Game({ seed: s.seed, ...s.opts } as never);
  const fb = new Framebuffer();
  let held = 0; let prev = 0; let lcg = s.inputSeed >>> 0; const rows: string[] = [];
  for (let f = 0; f < s.frames; f++) {
    if (f % 15 === 0) { lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0; held = MASKS[(lcg >>> 16) % 16]!; }
    let m = held; if (f === s.startAt && s.startAt > 0) m = Btn.START; else if (m & Btn.START && f % 15 !== 0) m &= ~Btn.START;
    if (s.name === 'splash' && f < s.startAt) m = 0;
    g.step(padFromHeld(prev, m)); prev = m;
    const sfx = g.drainSfx();
    if (f % 10 === 9 || sfx.length) {
      renderGame(fb, g);
      rows.push(`${f} ${g.scene} ${g.music()} ${fnv(fb.px)} [${sfx.join(',')}]`);
    }
  }
  out[s.name] = rows;
}
writeFileSync(process.argv[2] ?? 'trace.json', JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"'));
