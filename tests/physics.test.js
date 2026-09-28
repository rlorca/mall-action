import { describe, it, expect } from 'vitest';
import { aabb, stepAir, findLanding, supportedAt, moveInRoom, MAX_SAFE_FALL } from '../src/logic/physics.js';
import { createCar, CAR_H } from '../src/logic/elevator.js';
import { feetY } from '../src/world/constants.js';

const shaft = { id: 'T', x: 100, minFloor: 1, maxFloor: 4, startFloor: 3, ai: false };

describe('aabb', () => {
  it('detects overlap, not touching edges', () => {
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });
});

describe('jump arc', () => {
  it('JUMP -3.2 peaks about 20 px up', () => {
    const e = { x: 0, y: 100, vx: 0, vy: -3.2 }; let top = 100;
    for (let i = 0; i < 30; i++) { stepAir(e); top = Math.min(top, e.y); }
    expect(100 - top).toBeGreaterThanOrEqual(18); expect(100 - top).toBeLessThanOrEqual(22);
  });
});

describe('support and landing', () => {
  it('pit doorway is unsupported, plain floor is supported', () => {
    const c = createCar(shaft); // car at floor 3 → floor 2 doorway is a pit
    expect(supportedAt(112, 2, [c])).toBe(false);
    expect(supportedAt(50, 2, [c])).toBe(true);
    expect(supportedAt(112, 3, [c])).toBe(true); // inside car
  });
  it('falling through a pit lands on the roof of the car below', () => {
    const c = createCar(shaft);
    const land = findLanding(112, feetY(2), feetY(2) + 20, [c]);
    expect(land).toEqual({ y: c.y - CAR_H, floor: null, roof: 'T' });
  });
  it('falling past a floor line on plain floor lands on that floor', () => {
    expect(findLanding(50, feetY(2) - 5, feetY(2) + 3, [])).toEqual({ y: feetY(2), floor: 2, roof: null });
  });
  it('fall distance: car one floor down is safe (8 px), two floors down is fatal (56 px)', () => {
    expect(feetY(3) - CAR_H - feetY(2)).toBe(8);
    expect(feetY(3) - CAR_H - feetY(2)).toBeLessThanOrEqual(MAX_SAFE_FALL);
    expect(feetY(4) - CAR_H - feetY(2)).toBeGreaterThan(MAX_SAFE_FALL);
  });
});

describe('moveInRoom', () => {
  const solid = (px, py) => px < 16 || py < 16; // wall at left/top
  it('moves freely and stops at walls per axis', () => {
    const b = { x: 20, y: 20, w: 12, h: 12 };
    const r = moveInRoom(b, -5, 0, solid);
    expect(b.x).toBe(20 - 4); expect(r.hitX).toBe(true);
    moveInRoom(b, 0, 2, solid); expect(b.y).toBe(22);
  });
});
