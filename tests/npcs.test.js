import { describe, it, expect } from 'vitest';
import { createWetPatch, tickWet, slideStep, createCop, copSeesShot, startChase, stepCop, copCatches, createWalker, stepWalker, walkerBlocking, nearestTarget, WET_FRAMES } from '../src/logic/npcs.js';
import { feetY } from '../src/world/constants.js';

describe('wet floor', () => {
  it('expires after WET_FRAMES', () => {
    let ps = [createWetPatch(100, 4)];
    for (let i = 0; i < WET_FRAMES - 1; i++) ps = tickWet(ps);
    expect(ps).toHaveLength(1); ps = tickWet(ps); expect(ps).toHaveLength(0);
  });
  it('locks slide direction on entry and releases when off the patch', () => {
    const ps = [createWetPatch(100, 4)];
    const e = { x: 101, floor: 4, grounded: true, facing: 1, vx: 0, slideDir: 0 };
    expect(slideStep(ps, e, 1)).toBe(true); expect(e.vx).toBe(1);
    e.facing = -1; slideStep(ps, e, 1); expect(e.vx).toBe(1); // can't turn
    e.x = 160; expect(slideStep(ps, e, 1)).toBe(false); expect(e.slideDir).toBe(0);
  });
  it('airborne entities do not slide', () => {
    const e = { x: 101, floor: 4, grounded: false, facing: 1, vx: 0, slideDir: 0 };
    expect(slideStep([createWetPatch(100, 4)], e, 1)).toBe(false);
  });
});

describe('mall cop', () => {
  it('notices shots in front within range on same floor only', () => {
    const cop = createCop(2, 300); cop.facing = 1;
    expect(copSeesShot(cop, { x: 400, floor: 2 })).toBe(true);
    expect(copSeesShot(cop, { x: 200, floor: 2 })).toBe(false); // behind
    expect(copSeesShot(cop, { x: 500, floor: 2 })).toBe(false); // too far
    expect(copSeesShot(cop, { x: 350, floor: 3 })).toBe(false); // other floor
  });
  it('chases at 1.25× for 600 frames and catches on contact', () => {
    const cop = createCop(2, 300); startChase(cop);
    const player = { x: 350, floor: 2 };
    stepCop(cop, player, 1); expect(cop.x).toBeCloseTo(301.25);
    cop.x = 345; expect(copCatches(cop, player)).toBe(true);
    for (let i = 0; i < 600; i++) stepCop(cop, { x: 700, floor: 3 }, 1);
    expect(cop.state).toBe('patrol'); expect(copCatches(cop, player)).toBe(false);
  });
});

describe('mall walkers', () => {
  it('reverse at bounds', () => {
    const w = createWalker(3, 99, 1);
    for (let i = 0; i < 5; i++) stepWalker(w, 20, 100);
    expect(w.facing).toBe(-1);
  });
  it('block bullets on their floor', () => {
    const w = createWalker(3, 200, 1);
    expect(walkerBlocking([w], { x: 198, y: feetY(3) - 16, w: 4, h: 2 }, 3)).toBe(w);
    expect(walkerBlocking([w], { x: 198, y: feetY(3) - 16, w: 4, h: 2 }, 2)).toBeNull();
  });
});

describe('kiosk', () => {
  it('points to the nearest uncleared target, preferring same floor', () => {
    expect(nearestTarget({ x: 700, floor: 1 }, new Set()).id).toBe('radioshock');
    expect(nearestTarget({ x: 700, floor: 1 }, new Set(['radioshock', 'forever12'])).floor).not.toBe(1);
    const all = new Set(['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlockpicker']);
    expect(nearestTarget({ x: 0, floor: 1 }, all)).toBeNull();
  });
});
