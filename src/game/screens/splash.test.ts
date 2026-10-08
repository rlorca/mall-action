import { describe, expect, it } from 'vitest';
import { SplashScreen } from './splash';
import { FLICKER_END, TOTAL_FRAMES } from '../../flickersoft/splash';
import { Btn, NO_PAD, type Pad } from '../../engine/pad';

const press = (mask: number): Pad => ({ held: mask, pressed: mask, released: 0 });

describe('SplashScreen adapter', () => {
  it('is silent until the letters settle, then asks for the splash jingle', () => {
    const s = new SplashScreen();
    while (s.frame < FLICKER_END - 1) {
      s.step(NO_PAD);
      expect(s.music()).toBeNull();
    }
    s.step(NO_PAD);
    expect(s.music()).toBe('splash');
  });

  it('finishes after about 3 seconds', () => {
    const s = new SplashScreen();
    let n = 0;
    while (!s.done && n < 1000) {
      s.step(NO_PAD);
      n++;
    }
    expect(n).toBe(TOTAL_FRAMES);
    expect(s.drainSfx()).toEqual([]);
  });

  it('any button skips it, with no jingle if it was early', () => {
    const s = new SplashScreen();
    for (let i = 0; i < 10; i++) s.step(NO_PAD);
    s.step(press(Btn.A));
    expect(s.done).toBe(true);
    expect(s.music()).toBeNull();
  });
});
