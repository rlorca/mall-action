import { describe, expect, it } from 'vitest';
import { SONGS } from '../src/audio/songs';
import { SFX } from '../src/audio/sfx';
import { SONG_IDS, SFX_IDS } from '../src/audio/ids';
import { parseTrack } from '../src/audio/notation';

describe('songs', () => {
  it('every song id exists', () => {
    for (const id of SONG_IDS) expect(SONGS[id], id).toBeDefined();
  });

  for (const id of SONG_IDS) {
    it(`${id} parses, stays in range and loops cleanly`, () => {
      const song = SONGS[id];
      const lengths: number[] = [];
      for (const [ch, src] of Object.entries(song.tracks)) {
        if (!src) continue;
        const t = parseTrack(src, ch === 'noise');
        expect(t.length).toBeGreaterThan(0);
        lengths.push(t.length);
        if (ch !== 'noise') {
          for (const e of t.events) {
            expect(e.note as number).toBeGreaterThanOrEqual(24);
            expect(e.note as number).toBeLessThanOrEqual(108);
          }
        }
      }
      expect(lengths.length).toBeGreaterThan(0);
      if (song.loop) expect(new Set(lengths).size, `${id} track lengths ${lengths}`).toBe(1);
    });
  }

  it('the mall ambient bed is quieter than every other looping song', () => {
    const mall = SONGS.mall.gain ?? 0.6;
    for (const id of SONG_IDS) {
      if (id === 'mall' || !SONGS[id].loop) continue;
      expect(mall).toBeLessThan(SONGS[id].gain ?? 0.6);
    }
  });

  it('kgb toys waltz is in 3/4', () => {
    const song = SONGS.store_kgbtoys;
    const len = parseTrack(song.tracks.p1!).length;
    expect(len % (3 * (song.steps ?? 4))).toBe(0);
  });
});

describe('sfx', () => {
  it('every sfx id exists and is well formed', () => {
    for (const id of SFX_IDS) {
      const def = SFX[id];
      expect(def, id).toBeDefined();
      expect(def.length).toBeGreaterThan(0);
      for (const s of def) {
        expect(s.dur).toBeGreaterThan(0);
        expect(s.f0).toBeGreaterThan(0);
        if (s.f1 !== undefined) expect(s.f1).toBeGreaterThan(0);
      }
    }
  });
});
