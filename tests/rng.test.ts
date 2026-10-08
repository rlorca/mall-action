import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('seeded random generator', () => {
  it('replays the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('stays in [0, 1) and respects integer bounds', () => {
    const r = new Rng(9);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('gives a fair chance: about 10% for chance(0.1)', () => {
    const r = new Rng(2024);
    let hits = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (r.chance(0.1)) hits++;
    expect(hits / N).toBeGreaterThan(0.09);
    expect(hits / N).toBeLessThan(0.11);
  });

  it('forks independent children from the same parent state', () => {
    const r = new Rng(5);
    const c1 = r.fork(1);
    const c2 = new Rng(5).fork(1);
    expect(c1.next()).toBe(c2.next());
    expect(r.fork(1).next()).not.toBe(r.fork(2).next());
  });
});
