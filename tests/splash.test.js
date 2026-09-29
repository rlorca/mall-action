import { describe, it, expect } from 'vitest';
import { letterVisible, SPLASH, splashDone } from '../src/flickersoft/flicker.js';

describe('FLICKERSOFT splash flicker', () => {
  it('while overloaded, letters alternate: each shows on every other frame, neighbours out of phase', () => {
    const f = SPLASH.flickerFrom + 10;
    expect(letterVisible(0, f)).not.toBe(letterVisible(0, f + 1));
    expect(letterVisible(0, f)).not.toBe(letterVisible(1, f));
  });
  it('about half the letters are visible on any flicker frame', () => {
    const n = 'FLICKERSOFT'.length;
    const shown = Array.from({ length: n }, (_, i) => letterVisible(i, SPLASH.flickerFrom + 5)).filter(Boolean).length;
    expect(shown).toBeGreaterThanOrEqual(5); expect(shown).toBeLessThanOrEqual(6);
  });
  it('settles solid after the flicker phase', () => {
    for (let i = 0; i < 11; i++) expect(letterVisible(i, SPLASH.settleAt)).toBe(true);
  });
  it('ends after its full length', () => {
    expect(splashDone(SPLASH.length - 1)).toBe(false);
    expect(splashDone(SPLASH.length)).toBe(true);
  });
});
