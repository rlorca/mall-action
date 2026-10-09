import { describe, expect, it } from 'vitest';
import { SONGS, STORE_SONG, TITLE_MELODY, parseTrack } from '../src/audio/songs';
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
  it('the elevator muzak is an arrangement of the title theme (same tune, slower, softer)', () => {
    expect(SONGS.title.p1!.notes).toBe(TITLE_MELODY);
    expect(SONGS.elevator.p1!.notes).toBe(TITLE_MELODY);
    expect(SONGS.elevator.bpm).toBeLessThan(SONGS.title.bpm);
    expect(SONGS.elevator.vol).toBeLessThan(SONGS.title.vol);
    expect(SONGS.elevator.p1!.duty).toBe(0.125);
  });
  it('the mall ambience is quiet, sparse and slow compared with the alarm', () => {
    expect(SONGS.mall.vol).toBeLessThan(SONGS.title.vol / 2);
    expect(SONGS.mall.noise).toBeUndefined();
    expect(SONGS.alarm.bpm).toBeGreaterThan(SONGS.mall.bpm * 2);
  });
  it('has title, mall, alarm, elevator, booth and the jingles', () => {
    for (const n of ['title', 'mall', 'alarm', 'elevator', 'booth', 'clear', 'gameover', 'itemget', 'splash']) expect(SONGS[n]).toBeTruthy();
  });
});
