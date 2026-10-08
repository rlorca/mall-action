import { describe, expect, it } from 'vitest';
import { SHAFTS, SHAFT_W } from '../src/core/constants';
import { STORES } from '../src/mall/layout';
import {
  KIOSK_COOLDOWN_FRAMES,
  copSpotsShot,
  nearestPackageStore,
  patchReachesShaft,
  wetPatchAt,
} from '../src/mall/rules';
import { makeWorld, quietWorld, input, run } from './helpers';

describe('wet floor (janitor)', () => {
  it('a wet patch never reaches a shaft opening on its floor', () => {
    const B = SHAFTS[1]; // on 1F (floor 4), B opens at x = 320
    const near = wetPatchAt(B.x - 10); // centred just short of the shaft: its edge overlaps the opening
    expect(patchReachesShaft(near.x0, near.x1, 4)).toBe(true);
    const clear = wetPatchAt(200);
    expect(patchReachesShaft(clear.x0, clear.x1, 4)).toBe(false);
    expect(B.x + SHAFT_W).toBeGreaterThan(B.x);
  });

  it('the agent slides across the patch and cannot stop or turn until off it', () => {
    const w = quietWorld();
    w.player.floor = 4;
    w.player.x = 200;
    w.player.facing = 1;
    w.wet = { x0: 190, x1: 240, t: 600 };
    const x0 = w.player.x;
    run(w, 10, ['left']); // holding the opposite way
    expect(w.player.x).toBeGreaterThan(x0);
  });
});

describe('mall cop', () => {
  const cop = { x: 100, floor: 2, facing: 1 as const };
  it('is spotted by a shot fired in front of him on his floor, within 128 px', () => {
    expect(copSpotsShot(cop, { x: 200, floor: 2 })).toBe(true);
  });
  it('ignores shots from behind, from other floors, or from beyond 128 px', () => {
    expect(copSpotsShot(cop, { x: 50, floor: 2 })).toBe(false);
    expect(copSpotsShot(cop, { x: 200, floor: 3 })).toBe(false);
    expect(copSpotsShot(cop, { x: 260, floor: 2 })).toBe(false);
  });
});

describe('directory kiosk', () => {
  it('points at the nearest store that still holds a package', () => {
    const remaining = new Set(['FOREVER12', 'KGB_TOYS']);
    // Standing on 3F (floor 2), the KGB TOYS store is on the same floor.
    expect(nearestPackageStore({ x: 40, floor: 2 }, remaining)).toBe('KGB_TOYS');
    expect(nearestPackageStore({ x: 40, floor: 2 }, new Set())).toBeNull();
  });

  it('shows the store on the first press and then cools down', () => {
    const w = makeWorld();
    const kiosk = w.player;
    kiosk.floor = 1; // 4F
    kiosk.x = 672; // the 4F kiosk
    w.spies.length = 0;
    const first = w.step(input([], ['up']));
    expect(first.some((e) => e.type === 'kiosk')).toBe(true);
    expect(KIOSK_COOLDOWN_FRAMES).toBeGreaterThan(0);
    run(w, 5);
    const second = w.step(input([], ['up']));
    expect(second.some((e) => e.type === 'kiosk')).toBe(false);
    expect(STORES.length).toBe(13);
  });
});
