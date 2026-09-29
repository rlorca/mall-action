import { describe, expect, it } from 'vitest';
import { step } from '../src/game/game';
import { frameOf } from '../src/core/input';
import { surf, SHAFTS, shaftCenter } from '../src/game/layout';
import { FATAL_FALL } from '../src/game/mall';
import { lvl, placeAgent, playing, press, run } from './helpers';

describe('agent physics', () => {
  it('walks 1 px per frame', () => {
    const g = playing();
    placeAgent(g, 1, 300);
    run(g, 20, ['right']);
    expect(lvl(g).mall.player.x).toBe(320);
  });
  it('jumps about 20 px high and lands back on the floor', () => {
    const g = playing();
    placeAgent(g, 1, 300);
    press(g, 'b');
    const p = lvl(g).mall.player;
    let top = p.y;
    for (let i = 0; i < 60; i++) {
      step(g, frameOf());
      top = Math.min(top, p.y);
    }
    expect(surf(1) - top).toBeGreaterThanOrEqual(18);
    expect(surf(1) - top).toBeLessThanOrEqual(23);
    expect(p.mode).toBe('ground');
    expect(p.y).toBe(surf(1));
  });
  it('a moving jump carries momentum and is a jump-kick', () => {
    const g = playing();
    placeAgent(g, 1, 300);
    step(g, frameOf(['right'], ['b']));
    const p = lvl(g).mall.player;
    expect(p.kick).toBe(true);
    run(g, 10);
    expect(p.x).toBeGreaterThan(305);
  });
  it('ducking lowers the body', () => {
    const g = playing();
    placeAgent(g, 1, 300);
    run(g, 2, ['down']);
    expect(lvl(g).mall.player.duck).toBe(true);
  });
  it('falling into a shaft onto a car one floor down is safe', () => {
    const g = playing();
    const L = lvl(g);
    L.mall.cars[0].y = surf(2); // shaft A car at 3F
    placeAgent(g, 1, shaftCenter(SHAFTS[0]));
    run(g, 40);
    expect(L.mall.player.mode).toBe('ground');
    expect(L.mall.player.y).toBe(surf(2) - 30);
  });
  it('falling more than one floor is fatal', () => {
    const g = playing();
    const L = lvl(g);
    L.mall.cars[0].y = surf(3); // car two floors below 4F
    placeAgent(g, 1, shaftCenter(SHAFTS[0]));
    run(g, 60);
    expect(L.mall.player.mode).toBe('dead');
    expect(surf(3) - 30 - surf(1)).toBeGreaterThan(FATAL_FALL);
  });
  it('can stand on a grate when the car is above, and ride a car roof', () => {
    const g = playing();
    const L = lvl(g);
    L.mall.cars[0].y = surf(0);
    placeAgent(g, 2, shaftCenter(SHAFTS[0]));
    run(g, 10);
    expect(L.mall.player.mode).toBe('ground');
    expect(L.mall.player.y).toBe(surf(2));
  });
  it('riding a car roof up into the top of the shaft crushes', () => {
    const g = playing();
    const L = lvl(g);
    const car = L.mall.cars[0];
    car.y = surf(2);
    placeAgent(g, 1, shaftCenter(SHAFTS[0]));
    run(g, 30); // falls onto the roof
    expect(L.mall.player.y).toBe(surf(2) - 30);
    car.call = 0; // send the car to the roof
    run(g, 120);
    expect(L.mall.player.mode).toBe('dead');
    expect(L.mall.player.deathCause).toBe('crush');
  });
});
