import { describe, it, expect } from 'vitest';
import { createSplashState, updateSplash, getSplashRenderInfo } from '../src/flickersoft/splash';

describe('FLICKERSOFT Splash', () => {
  it('initial state: frame 0, flicker phase, not done', () => {
    const s = createSplashState();
    expect(s.frame).toBe(0);
    expect(s.phase).toBe('flicker');
    expect(s.done).toBe(false);
  });

  it('after 30 frames: still in flicker phase', () => {
    let s = createSplashState();
    for (let i = 0; i < 30; i++) s = updateSplash(s, false);
    expect(s.phase).toBe('flicker');
    expect(s.done).toBe(false);
  });

  it('after 60 frames: transitions to settle', () => {
    let s = createSplashState();
    for (let i = 0; i < 61; i++) s = updateSplash(s, false);
    expect(s.phase).toBe('settle');
    expect(s.done).toBe(false);
  });

  it('after 90 frames: transitions to presents', () => {
    let s = createSplashState();
    for (let i = 0; i < 91; i++) s = updateSplash(s, false);
    expect(s.phase).toBe('presents');
    expect(s.done).toBe(false);
  });

  it('after 180 frames: done', () => {
    let s = createSplashState();
    for (let i = 0; i < 181; i++) s = updateSplash(s, false);
    expect(s.phase).toBe('done');
    expect(s.done).toBe(true);
  });

  it('skip immediately sets done', () => {
    const s = createSplashState();
    const skipped = updateSplash(s, true);
    expect(skipped.done).toBe(true);
    expect(skipped.phase).toBe('done');
  });

  it('updating a done state returns the same state', () => {
    let s = createSplashState();
    s = updateSplash(s, true);
    const again = updateSplash(s, false);
    expect(again.done).toBe(true);
    expect(again.frame).toBe(s.frame);
  });

  it('getSplashRenderInfo returns 11 letters for FLICKERSOFT', () => {
    const s = createSplashState();
    const info = getSplashRenderInfo(s);
    expect(info.letters).toHaveLength(11);
    expect(info.letters.map(l => l.char).join('')).toBe('FLICKERSOFT');
  });

  it('flicker phase: neighbouring letters have opposite visibility', () => {
    let s = createSplashState();
    s = updateSplash(s, false);
    const info = getSplashRenderInfo(s);
    for (let i = 0; i < info.letters.length - 1; i++) {
      expect(info.letters[i].visible).not.toBe(info.letters[i + 1].visible);
    }
  });

  it('settle phase: all letters visible, underline shown', () => {
    let s = createSplashState();
    for (let i = 0; i < 65; i++) s = updateSplash(s, false);
    const info = getSplashRenderInfo(s);
    for (const l of info.letters) {
      expect(l.visible).toBe(true);
    }
    expect(info.showUnderline).toBe(true);
    expect(info.showPresents).toBe(false);
  });

  it('presents phase: shows presents and underline', () => {
    let s = createSplashState();
    for (let i = 0; i < 95; i++) s = updateSplash(s, false);
    const info = getSplashRenderInfo(s);
    expect(info.showPresents).toBe(true);
    expect(info.showUnderline).toBe(true);
  });

  it('each letter has a rainbow color', () => {
    const s = createSplashState();
    const info = getSplashRenderInfo(s);
    for (const l of info.letters) {
      expect(l.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
