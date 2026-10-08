import { describe, expect, it } from 'vitest';
import { ContinueScreen, CONTINUE_FRAMES_PER_COUNT, CONTINUE_TOTAL_FRAMES } from './continue';
import { Btn, NO_PAD, type Pad } from '../../engine/pad';

const press = (mask: number): Pad => ({ held: mask, pressed: mask, released: 0 });

describe('ContinueScreen', () => {
  it('starts at 9 with CONTINUES LEFT data and the continue music', () => {
    const s = new ContinueScreen({ continuesLeft: 2 });
    expect(s.count).toBe(9);
    expect(s.continuesLeft).toBe(2);
    expect(s.done).toBe(false);
    expect(s.result).toBeNull();
    expect(s.music()).toBe('continue');
  });

  it('counts down one number every 60 frames', () => {
    const s = new ContinueScreen({ continuesLeft: 3 });
    const seen: number[] = [];
    for (let f = 0; f < CONTINUE_TOTAL_FRAMES - 1; f++) {
      if (f % CONTINUE_FRAMES_PER_COUNT === 0) seen.push(s.count);
      expect(s.count).toBe(9 - Math.floor(f / 60));
      s.step(NO_PAD);
    }
    expect(seen).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('beeps once per second (nine beeps), and nothing in between', () => {
    const s = new ContinueScreen({ continuesLeft: 3 });
    let beeps = s.drainSfx().filter((x) => x === 'beep').length;
    expect(beeps).toBe(1); // the 9
    const perSecond: number[] = [];
    for (let sec = 1; sec < 9; sec++) {
      let n = 0;
      for (let f = 0; f < 60; f++) {
        s.step(NO_PAD);
        n += s.drainSfx().filter((x) => x === 'beep').length;
      }
      perSecond.push(n);
      beeps += n;
    }
    expect(perSecond.every((n) => n === 1)).toBe(true);
    expect(beeps).toBe(9);
  });

  it('is red at 3 or below', () => {
    const s = new ContinueScreen({ continuesLeft: 1 });
    const red: Record<number, boolean> = {};
    for (let f = 0; f < CONTINUE_TOTAL_FRAMES - 1; f++) {
      red[s.count] = s.urgent;
      s.step(NO_PAD);
    }
    for (let n = 1; n <= 9; n++) expect(red[n], `count ${n}`).toBe(n <= 3);
  });

  it('Start gives result "continue" and finishes', () => {
    const s = new ContinueScreen({ continuesLeft: 3 });
    for (let i = 0; i < 100; i++) s.step(NO_PAD);
    s.step(press(Btn.START));
    expect(s.done).toBe(true);
    expect(s.result).toBe('continue');
    expect(s.drainSfx()).toContain('select');
  });

  it('other buttons do not continue', () => {
    const s = new ContinueScreen({ continuesLeft: 3 });
    for (const b of [Btn.A, Btn.B, Btn.UP, Btn.SELECT]) s.step(press(b));
    expect(s.done).toBe(false);
  });

  it('the clock reaching 0 gives result "gameover" after 9 s', () => {
    const s = new ContinueScreen({ continuesLeft: 0 });
    let steps = 0;
    while (!s.done && steps < 2000) {
      s.step(NO_PAD);
      steps++;
    }
    expect(steps).toBe(9 * 60);
    expect(s.result).toBe('gameover');
    expect(s.count).toBe(0);
  });

  it('ignores further input once finished', () => {
    const s = new ContinueScreen({ continuesLeft: 3 });
    s.step(press(Btn.START));
    const f = s.frame;
    s.step(NO_PAD);
    expect(s.frame).toBe(f);
    expect(s.result).toBe('continue');
  });
});
