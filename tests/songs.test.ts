import { describe, expect, it } from 'vitest';
import { SONGS, STORE_SONG, parseTrack } from '../src/audio/songs';
import { OPEN_STORES } from '../src/core/stores-data';

describe('music', () => {
  for (const [name, song] of Object.entries(SONGS)) {
    it(`${name}: every channel parses and has the same length`, () => {
      const lens: Record<string, number> = {};
      for (const ch of ['p1', 'p2', 'tri', 'noise'] as const) {
        const t = song[ch];
        if (!t) continue;
        lens[ch] = parseTrack(t, ch === 'noise').steps;
      }
      const vals = Object.values(lens);
      expect(vals.length).toBeGreaterThan(0);
      expect(new Set(vals).size, JSON.stringify(lens)).toBe(1);
    });
  }
  it('every open store has its own distinct song', () => {
    const songs = OPEN_STORES.map((s) => STORE_SONG[s]);
    expect(songs.every(Boolean)).toBe(true);
    expect(new Set(songs).size).toBe(OPEN_STORES.length);
    for (const s of songs) expect(SONGS[s]).toBeTruthy();
  });
  it('has title, mall, alarm, elevator, booth and the jingles', () => {
    for (const n of ['title', 'mall', 'alarm', 'elevator', 'booth', 'clear', 'gameover', 'itemget', 'splash']) expect(SONGS[n]).toBeTruthy();
  });
});
