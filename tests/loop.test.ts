import { describe, expect, it } from 'vitest';
import { FixedLoop, STEP_MS } from '../src/core/loop';

describe('FixedLoop', () => {
  it('runs whole steps and keeps the remainder', () => {
    let steps = 0;
    const l = new FixedLoop(() => steps++, () => {});
    expect(l.advance(STEP_MS * 0.5)).toBe(0);
    expect(l.advance(STEP_MS * 0.6)).toBe(1);
    expect(l.advance(STEP_MS * 3)).toBe(3);
    expect(steps).toBe(4);
  });
  it('60 fps of real time yields 60 steps per second', () => {
    let steps = 0;
    const l = new FixedLoop(() => steps++, () => {});
    for (let i = 0; i < 600; i++) l.advance(1000 / 60);
    expect(steps).toBe(600);
  });
  it('caps catch-up and drops the backlog', () => {
    const l = new FixedLoop(() => {}, () => {}, { maxStepsPerFrame: 5, maxDeltaMs: 10000 });
    expect(l.advance(2000)).toBe(5);
    expect(l.advance(0)).toBe(0);
  });
  it('clamps huge deltas (hidden tab) by default', () => {
    const l = new FixedLoop(() => {}, () => {});
    l.frame(0);
    expect(l.frame(60000)).toBeLessThanOrEqual(5);
  });
  it('ignores negative and NaN deltas', () => {
    const l = new FixedLoop(() => {}, () => {});
    expect(l.advance(-50)).toBe(0);
    expect(l.advance(NaN)).toBe(0);
  });
  it('frame() renders once per call with alpha in [0,1)', () => {
    const alphas: number[] = [];
    const l = new FixedLoop(() => {}, (a) => alphas.push(a));
    l.frame(0);
    l.frame(25);
    expect(alphas).toHaveLength(2);
    for (const a of alphas) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });
  it('120 Hz displays run a step every other frame', () => {
    let steps = 0;
    const l = new FixedLoop(() => steps++, () => {});
    for (let i = 0; i <= 120; i++) l.frame(i * (1000 / 120));
    expect(steps).toBe(60);
  });
});
