import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng.js';

describe('createRng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42), b = createRng(42);
    const xs = Array.from({ length: 5 }, () => a.next());
    const ys = Array.from({ length: 5 }, () => b.next());
    expect(xs).toEqual(ys);
  });
  it('int is inclusive and in range', () => {
    const r = createRng(1); const seen = new Set();
    for (let i = 0; i < 500; i++) { const v = r.int(2, 4); expect(v).toBeGreaterThanOrEqual(2); expect(v).toBeLessThanOrEqual(4); seen.add(v); }
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });
  it('shuffle returns a permutation without mutating', () => {
    const r = createRng(7); const src = [1, 2, 3, 4, 5];
    const out = r.shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
