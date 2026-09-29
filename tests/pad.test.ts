import { describe, expect, it } from 'vitest';
import { PadTracker, emptyButtons, padHeld, emptyPad } from '../src/core/pad';

describe('PadTracker', () => {
  it('reports pressed on rising edge only', () => {
    const t = new PadTracker();
    expect(t.next({ a: true }).pressed.a).toBe(true);
    const f = t.next({ a: true });
    expect(f.pressed.a).toBe(false);
    expect(f.held.a).toBe(true);
  });
  it('reports released on falling edge', () => {
    const t = new PadTracker();
    t.next({ left: true });
    const f = t.next({});
    expect(f.released.left).toBe(true);
    expect(f.held.left).toBe(false);
    expect(t.next({}).released.left).toBe(false);
  });
  it('tracks buttons independently and fills missing as false', () => {
    const t = new PadTracker();
    t.next({ a: true });
    const f = t.next({ b: true });
    expect(f.pressed).toEqual({ ...emptyButtons(), b: true });
    expect(f.released).toEqual({ ...emptyButtons(), a: true });
  });
  it('reset forgets state', () => {
    const t = new PadTracker();
    t.next({ start: true });
    t.reset();
    expect(t.next({ start: true }).pressed.start).toBe(true);
  });
  it('helpers', () => {
    expect(padHeld('up', 'a')).toEqual({ up: true, a: true });
    expect(emptyPad().held.up).toBe(false);
  });
});
