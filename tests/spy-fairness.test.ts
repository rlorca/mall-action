import { describe, expect, it } from 'vitest';
import { SEC } from '../src/core/constants';
import { Rng } from '../src/core/rng';
import { SPY_DODGE_CHANCE, SPY_TELEGRAPH_FRAMES, rollVolleyDodge, spyMayFire } from '../src/mall/rules';

describe('spy fairness', () => {
  it('no spy may fire in its first two seconds', () => {
    expect(spyMayFire(2 * SEC - 1)).toBe(false);
    expect(spyMayFire(2 * SEC)).toBe(true);
  });

  it('every shot is telegraphed by an aiming pose of about half a second', () => {
    expect(SPY_TELEGRAPH_FRAMES).toBeGreaterThanOrEqual(Math.round(SEC / 2));
  });

  it('a spy dodges about 10% of volleys, deciding once per volley', () => {
    const rng = new Rng(31);
    let ducks = 0;
    for (let v = 1; v <= 20000; v++) {
      const r = rollVolleyDodge(rng, -1, v);
      if (r.ducks) ducks++;
    }
    expect(ducks / 20000).toBeGreaterThan(SPY_DODGE_CHANCE - 0.02);
    expect(ducks / 20000).toBeLessThan(SPY_DODGE_CHANCE + 0.02);
  });

  it('a spy rolls only once per volley', () => {
    const rng = new Rng(4);
    const first = rollVolleyDodge(rng, -1, 5);
    expect(first.rolled).toBe(true);
    const second = rollVolleyDodge(rng, 5, 5);
    expect(second.rolled).toBe(false);
    expect(second.ducks).toBe(false);
  });
});
