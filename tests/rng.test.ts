import { describe, expect, it } from 'vitest';
import { Rng, seedFromString, hashString } from '../src/core/rng';

describe('Rng', () => {
  it('same seed same sequence, different seed differs', () => {
    const a = new Rng(123), b = new Rng(123), c = new Rng(124);
    const sa = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 20 }, () => c.next())).not.toEqual(sa);
  });
  it('next is in [0,1), int in range, range inclusive', () => {
    const r = new Rng(1);
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
      const q = r.range(3, 5);
      expect(q).toBeGreaterThanOrEqual(3);
      expect(q).toBeLessThanOrEqual(5);
    }
  });
  it('distribution is roughly uniform', () => {
    const r = new Rng(99);
    const bins = new Array(10).fill(0);
    for (let i = 0; i < 10000; i++) bins[r.int(10)]++;
    for (const b of bins) expect(b).toBeGreaterThan(800), expect(b).toBeLessThan(1200);
    let heads = 0;
    for (let i = 0; i < 10000; i++) if (r.chance(0.25)) heads++;
    expect(heads / 10000).toBeGreaterThan(0.22);
    expect(heads / 10000).toBeLessThan(0.28);
  });
  it('shuffle keeps elements and is deterministic', () => {
    const a = new Rng(5).shuffle([1, 2, 3, 4, 5, 6]);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Rng(5).shuffle([1, 2, 3, 4, 5, 6])).toEqual(a);
  });
  it('fork is deterministic and independent of the child use', () => {
    const p1 = new Rng(7), p2 = new Rng(7);
    const c1 = p1.fork(), c2 = p2.fork();
    expect(c1.next()).toBe(c2.next());
    c1.next();
    expect(p1.next()).toBe(p2.next());
  });
  it('pickNot never returns the excluded index when possible', () => {
    const r = new Rng(3);
    const arr = ['a', 'b', 'c'];
    let last = 0;
    for (let i = 0; i < 500; i++) {
      const p = r.pickNot(arr, last);
      expect(p.index).not.toBe(last);
      expect(arr[p.index]).toBe(p.value);
      last = p.index;
    }
    expect(r.pickNot(['only'], 0).index).toBe(0);
  });
  it('seedFromString', () => {
    expect(seedFromString('42', 1)).toBe(42);
    expect(seedFromString(null, 9)).toBe(9);
    expect(seedFromString('', 9)).toBe(9);
    expect(seedFromString('hello', 1)).toBe(hashString('hello'));
  });
});
