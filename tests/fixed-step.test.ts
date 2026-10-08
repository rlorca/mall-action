import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../src/core/fixed-step';
import { FRAME_MS, MAX_STEPS_PER_TICK } from '../src/core/constants';

describe('fixed 60 Hz clock', () => {
  it('runs one step per 1/60 s of real time', () => {
    const c = new FixedStepClock();
    let steps = 0;
    for (let i = 0; i < 60; i++) steps += c.advance(FRAME_MS);
    expect(steps).toBe(60);
  });

  it('caps the catch-up steps and drops the backlog', () => {
    const c = new FixedStepClock();
    expect(c.advance(200)).toBe(MAX_STEPS_PER_TICK);
    expect(c.advance(0)).toBe(0); // the backlog was dropped, not replayed later
  });

  it('ignores absurd gaps such as a backgrounded tab', () => {
    const c = new FixedStepClock();
    expect(c.advance(60_000)).toBeLessThanOrEqual(MAX_STEPS_PER_TICK);
  });
});
