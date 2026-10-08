import { describe, expect, it } from 'vitest';
import { FlickerSplash, FLICKER_FRAMES, DONE_AT, PRESENTS_AT } from '../src/splash/flickersoft-splash';

/** A stand-in 2D context that counts the rectangles drawn per frame. */
function fakeContext(): { ctx: CanvasRenderingContext2D; rects: () => number } {
  let n = 0;
  const ctx = {
    fillStyle: '',
    fillRect: () => void n++,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects: () => n };
}

function frameRects(s: FlickerSplash): number {
  const { ctx, rects } = fakeContext();
  s.draw(ctx);
  return rects();
}

describe('FLICKERSOFT splash', () => {
  it('flickers on alternate frames during the first second', () => {
    const s = new FlickerSplash();
    const counts: number[] = [];
    for (let f = 0; f < 6; f++) {
      counts.push(frameRects(s));
      s.step(false);
    }
    // Consecutive frames show different letters, so the drawn rectangle counts change.
    expect(new Set(counts).size).toBeGreaterThan(1);
    expect(FLICKER_FRAMES).toBe(60);
  });

  it('settles solid after the flicker and then says PRESENTS', () => {
    const s = new FlickerSplash();
    for (let f = 0; f < FLICKER_FRAMES + 2; f++) s.step(false);
    const solid = frameRects(s);
    for (let f = 0; f < 4; f++) s.step(false);
    expect(frameRects(s)).toBeGreaterThanOrEqual(solid);
    expect(PRESENTS_AT).toBeGreaterThan(FLICKER_FRAMES);
  });

  it('finishes after about three seconds, emitting a jingle and done', () => {
    const s = new FlickerSplash();
    const events: string[] = [];
    for (let f = 0; f < DONE_AT + 2; f++) {
      s.step(false);
      events.push(...s.drainEvents().map((e) => e.type));
    }
    expect(s.done).toBe(true);
    expect(events).toContain('jingle');
    expect(events[events.length - 1]).toBe('done');
  });

  it('any button skips it at once', () => {
    const s = new FlickerSplash();
    s.step(true);
    expect(s.done).toBe(true);
    expect(s.drainEvents().map((e) => e.type)).toContain('done');
  });
});
