import { describe, it, expect } from 'vitest';
import { TRACKS } from '../src/audio/music.js';
import { parseTrack } from '../src/audio/notes.js';

const REQUIRED = ['title', 'mall', 'mallAlarm', 'store', 'muzak', 'booth', 'levelClear', 'gameOver', 'itemGet'];
const steps = (s) => parseTrack(s ?? '').reduce((n, t) => n + t.len, 0);

describe('TRACKS', () => {
  it('defines every required track with equal-length channels', () => {
    for (const name of REQUIRED) {
      const t = TRACKS[name]; expect(t, name).toBeDefined();
      const lens = ['p1', 'p2', 'tri', 'noise'].map((c) => steps(t[c])).filter((n) => n > 0);
      expect(new Set(lens).size, `${name} channel lengths ${lens}`).toBe(1);
    }
  });
  it('loops the level music but not jingles', () => {
    expect(TRACKS.mall.loop).toBe(true); expect(TRACKS.levelClear.loop).toBe(false); expect(TRACKS.itemGet.loop).toBe(false);
  });
});
