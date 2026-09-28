import { describe, it, expect } from 'vitest';
import { weighted, rollPowerup, rollSpyDrop, FOOD_TABLE } from '../src/logic/loot.js';
import { createRng } from '../src/core/rng.js';

describe('loot', () => {
  it('weighted never picks zero-weight entries and covers others', () => {
    const r = createRng(9); const seen = new Set();
    for (let i = 0; i < 2000; i++) seen.add(weighted(r, [['a', 1], ['b', 0], ['c', 3]]));
    expect([...seen].sort()).toEqual(['a', 'c']);
  });
  it('food rolls only return food', () => {
    const r = createRng(2); const food = FOOD_TABLE.map(([id]) => id);
    for (let i = 0; i < 200; i++) expect(food).toContain(rollPowerup(r, { food: true }));
  });
  it('spy drops happen roughly 5% of the time', () => {
    const r = createRng(11); let n = 0;
    for (let i = 0; i < 10000; i++) if (rollSpyDrop(r)) n++;
    expect(n).toBeGreaterThan(350); expect(n).toBeLessThan(650);
  });
});
