// Generates fixtures/difficulty.txt and the POW_* tables in src/game/difficulty.rs from the TypeScript source.
// Run from the TS worktree (branch sonnet-5-5-fable-5-1) after copying this file into its scripts/: `npx tsx scripts/difficulty-fixture.ts > pow.txt`
import { difficulty } from '../src/game/difficulty';
const bits = (x: number) => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); return b.getBigUint64(0).toString(16).padStart(16, '0'); };
const p11: string[] = [], p115: string[] = [];
for (let n = 0; n <= 60; n++) { p11.push('0x' + bits(Math.pow(1.1, n))); p115.push('0x' + bits(Math.pow(1.15, n))); }
console.log('P11', p11.join(','));
console.log('P115', p115.join(','));
const rows: string[] = [];
for (let l = 1; l <= 70; l++) for (const bf of [false, true]) { const d = difficulty(l, bf); rows.push(`${l} ${bf ? 1 : 0} ${bits(d.spySpeed)} ${bits(d.spawnRate)} ${d.shotInterval} ${d.alarmFrames} ${d.spyCap}`); }
import('node:fs').then((fs) => fs.writeFileSync('difficulty.txt', rows.join('\n') + '\n'));
