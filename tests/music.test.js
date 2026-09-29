import { describe, it, expect } from 'vitest';
import { TRACKS } from '../src/audio/music.js';
import { parseTrack } from '../src/audio/notes.js';
import { STORES } from '../src/world/mallLevel.js';

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

describe('store and mall music', () => {
  const open = STORES.filter((s) => s.role !== 'closed');
  it('every open store has its own track', () => {
    const names = open.map((s) => `store_${s.id}`);
    for (const n of names) {
      const t = TRACKS[n]; expect(t, n).toBeDefined(); expect(t.loop).toBe(true);
      const lens = ['p1', 'p2', 'tri', 'noise'].map((c) => steps(t[c])).filter((x) => x > 0);
      expect(new Set(lens).size, `${n} channel lengths ${lens}`).toBe(1);
    }
    const bodies = names.map((n) => TRACKS[n].p1 ?? TRACKS[n].tri);
    expect(new Set(bodies).size).toBe(names.length); // all different
  });
  it('the mall theme is a quiet ambient bed', () => {
    expect(TRACKS.mall.gain).toBeLessThanOrEqual(0.5);
    expect(TRACKS.mall.bpm).toBeLessThanOrEqual(100);
    expect(TRACKS.mall.noise).toBeUndefined();
  });
});
