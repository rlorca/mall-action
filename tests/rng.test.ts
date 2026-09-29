import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../src/engine/rng';

describe('SeededRNG', () => {
  it('produces deterministic sequence for the same seed', () => {
    const a = new SeededRNG(42);
    const b = new SeededRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRNG(1);
    const b = new SeededRNG(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() returns values in [0, 1]', () => {
    const rng = new SeededRNG(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('nextInt returns values within range inclusive', () => {
    const rng = new SeededRNG(99);
    const results = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      results.add(v);
    }
    expect(results.size).toBe(5);
  });

  it('nextBool with chance 0 is always false', () => {
    const rng = new SeededRNG(1);
    for (let i = 0; i < 100; i++) {
      expect(rng.nextBool(0)).toBe(false);
    }
  });

  it('nextBool with chance 1 is always true', () => {
    const rng = new SeededRNG(1);
    for (let i = 0; i < 100; i++) {
      expect(rng.nextBool(1)).toBe(true);
    }
  });

  it('nextBool with default 0.5 produces both values', () => {
    const rng = new SeededRNG(42);
    let trues = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      if (rng.nextBool()) trues++;
    }
    expect(trues).toBeGreaterThan(0);
    expect(trues).toBeLessThan(n);
  });

  it('pick returns elements from the array', () => {
    const rng = new SeededRNG(7);
    const arr = ['a', 'b', 'c', 'd'];
    const results = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const v = rng.pick(arr);
      expect(arr).toContain(v);
      results.add(v);
    }
    expect(results.size).toBe(4);
  });

  it('shuffle returns a permutation of the same elements', () => {
    const rng = new SeededRNG(55);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(arr);
    expect(shuffled).toHaveLength(arr.length);
    expect(shuffled.sort()).toEqual([...arr].sort());
  });

  it('shuffle does not mutate original', () => {
    const rng = new SeededRNG(55);
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    rng.shuffle(arr);
    expect(arr).toEqual(copy);
  });

  it('getSeed returns current internal state', () => {
    const rng = new SeededRNG(42);
    rng.next();
    const s = rng.getSeed();
    expect(typeof s).toBe('number');
    expect(s).not.toBe(42);
  });
});
