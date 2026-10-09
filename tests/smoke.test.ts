import { describe, expect, it } from 'vitest';
import { makeMall, skipArrival, stepN, newGame, Driver } from './helpers';

describe('smoke', () => {
  it('the arrival plays out and gives control on the roof', () => {
    const { mall, d } = makeMall(5);
    expect(mall.p.mode).toBe('zip');
    let sawCrouch = false;
    let sawSelfie = false;
    for (let i = 0; i < 700 && !mall.controlGiven; i++) {
      mall.step(d.frame({}));
      if (mall.p.mode === 'crouch') sawCrouch = true;
      if (mall.p.mode === 'selfie') sawSelfie = true;
    }
    expect(sawCrouch && sawSelfie).toBe(true);
    expect(mall.controlGiven).toBe(true);
    expect(mall.p.y).toBe(120);
  });

  it('title -> mall via Start', () => {
    const g = newGame(3);
    const d = new Driver();
    expect(g.screen).toBe('title');
    g.step(d.frame({ start: true }));
    for (let i = 0; i < 60; i++) g.step(d.frame({}));
    expect(g.screen).toBe('mall');
    expect(g.mall).not.toBeNull();
  });

  it('runs 3000 frames of mall without throwing', () => {
    const { mall, d } = makeMall(7);
    skipArrival(mall, d);
    stepN(mall, d, 3000, { right: true });
    expect(mall.frame).toBeGreaterThan(3000);
  });
});
