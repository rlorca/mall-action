/**
 * Render a song or sound effect to a WAV file so you can listen to it without opening the game.
 *
 *   npx tsx scripts/render-song.ts <id> [out.wav] [--loops N] [--rate 44100]
 *   npx tsx scripts/render-song.ts --all [outDir]          (every song and sfx; default outDir playtest-out/audio)
 *   npx tsx scripts/render-song.ts --list
 *
 * <id> is a music id (title, mall, store.kgbtoys, levelclear, ...) or an sfx id written as sfx:ding.
 * Looping songs render one pass by default; --loops 2 renders the seam too. This uses the same offline renderer
 * the tests measure (src/audio/offline.ts), which shares its envelopes, mix levels and noise LFSR with the
 * browser synth, so it is a close (not sample-exact) preview of what the game plays.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MUSIC_IDS, SFX_IDS, type MusicId, type SfxId } from '../src/audio/ids';
import { encodeWav, renderSfx, renderSong } from '../src/audio/offline';
import { SFX } from '../src/audio/sfx';
import { getSong } from '../src/audio/songs';

const args = process.argv.slice(2);
const flag = (name: string, fallback: number): number => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const loops = flag('--loops', 1);
const rate = flag('--rate', 44100);

function write(path: string, samples: Float32Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodeWav(samples, rate));
  console.log(`${path}  (${(samples.length / rate).toFixed(1)} s)`);
}

function renderOne(id: string): Float32Array {
  if (id.startsWith('sfx:')) {
    const sid = id.slice(4) as SfxId;
    if (!SFX[sid]) throw new Error(`unknown sfx "${sid}"`);
    return renderSfx(SFX[sid], { sampleRate: rate });
  }
  if (!(MUSIC_IDS as readonly string[]).includes(id)) throw new Error(`unknown music id "${id}" (try --list)`);
  return renderSong(getSong(id as MusicId), { sampleRate: rate, loops });
}

if (args[0] === '--list') {
  console.log('music: ' + MUSIC_IDS.join(' '));
  console.log('sfx:   ' + SFX_IDS.map((s) => `sfx:${s}`).join(' '));
} else if (args[0] === '--all') {
  const dir = args[1] ?? 'playtest-out/audio';
  for (const id of MUSIC_IDS) write(join(dir, `${id}.wav`), renderOne(id));
  for (const id of SFX_IDS) write(join(dir, `sfx-${id}.wav`), renderOne(`sfx:${id}`));
} else if (args[0]) {
  const id = args[0];
  write(args[1] ?? `playtest-out/${id.replace(':', '-')}.wav`, renderOne(id));
} else {
  console.log('usage: npx tsx scripts/render-song.ts <id|sfx:id> [out.wav] [--loops N] [--rate 44100] | --all [dir] | --list');
}
