import { describe, expect, it } from 'vitest';
import {
  SPLASH_TIMING,
  STUDIO_NAME,
  drawSplash,
  letterVisible,
  newSplash,
  splashPhase,
  stepSplash,
} from '../src/flickersoft/splash';
import { FONT } from '../src/render/font';
import { C, RAINBOW } from '../src/render/palette';
import { Framebuffer } from '../src/render/pixels';

describe('the FLICKERSOFT splash', () => {
  it('flickers letters on ALTERNATE frames', () => {
    // A single letter is on, off, on, off...
    for (let f = 0; f < SPLASH_TIMING.flicker - 1; f++) {
      expect(letterVisible(f, 0)).toBe(!letterVisible(f + 1, 0));
    }
  });

  it('puts neighbouring letters out of phase', () => {
    for (let f = 0; f < SPLASH_TIMING.flicker; f++) {
      for (let i = 0; i < STUDIO_NAME.length - 1; i++) {
        expect(letterVisible(f, i), `frame ${f} letter ${i}`).toBe(!letterVisible(f, i + 1));
      }
    }
  });

  it('never blanks the whole word: some letters are always lit', () => {
    for (let f = 0; f < SPLASH_TIMING.flicker; f++) {
      const lit = [...STUDIO_NAME].filter((_, i) => letterVisible(f, i)).length;
      expect(lit, `frame ${f}`).toBeGreaterThan(0);
    }
  });

  it('flickers for about one second, then settles solid', () => {
    expect(SPLASH_TIMING.flicker).toBe(60);
    for (let i = 0; i < STUDIO_NAME.length; i++) {
      expect(letterVisible(SPLASH_TIMING.flicker, i)).toBe(true);
      expect(letterVisible(SPLASH_TIMING.flicker + 30, i)).toBe(true);
    }
  });

  it('runs flicker -> settle -> presents -> done', () => {
    expect(splashPhase(0)).toBe('flicker');
    expect(splashPhase(59)).toBe('flicker');
    expect(splashPhase(60)).toBe('settle');
    expect(splashPhase(SPLASH_TIMING.presentsAt)).toBe('presents');
    expect(splashPhase(SPLASH_TIMING.total)).toBe('done');
  });

  it('shows PRESENTS and finishes after about 3 seconds', () => {
    expect(SPLASH_TIMING.presentsAt).toBeGreaterThan(SPLASH_TIMING.flicker);
    expect(SPLASH_TIMING.total / 60).toBeGreaterThan(2.8);
    expect(SPLASH_TIMING.total / 60).toBeLessThan(3.6);
  });

  it('fires the jingle exactly once, when the letters settle', () => {
    const s = newSplash();
    let fires = 0;
    let fireFrame = -1;
    for (let i = 0; i < SPLASH_TIMING.total + 30; i++) {
      const r = stepSplash(s, false);
      if (r.playJingle) {
        fires++;
        fireFrame = s.frame;
      }
    }
    expect(fires).toBe(1);
    expect(fireFrame).toBe(SPLASH_TIMING.flicker);
  });

  it('finishes on its own after the full run', () => {
    const s = newSplash();
    let finished = false;
    for (let i = 0; i < SPLASH_TIMING.total; i++) finished = stepSplash(s, false).finished;
    expect(finished).toBe(true);
  });

  it('is skipped by any button, stickily', () => {
    const s = newSplash();
    stepSplash(s, false);
    expect(stepSplash(s, true).finished).toBe(true);
    expect(stepSplash(s, false).finished).toBe(true);
  });

  it('always fills the screen and never leaves it blank', () => {
    const fb = new Framebuffer(256, 240);
    const pal = { black: C.BLACK, rainbow: RAINBOW, accent: C.WHITE };
    const s = newSplash();
    for (let i = 0; i < SPLASH_TIMING.total; i++) {
      fb.clear(0xff);
      drawSplash(fb, FONT, s, pal, 256, 240);
      // Every pixel written, and something other than the background drawn.
      expect(fb.data.every((v) => v !== 0xff), `frame ${i} left holes`).toBe(true);
      expect(fb.data.some((v) => v !== C.BLACK), `frame ${i} is blank`).toBe(true);
      stepSplash(s, false);
    }
  });
});
