import { describe, expect, it } from 'vitest';
import { createGame, step, continueNumber } from '../src/game/game';
import { frameOf } from '../src/core/input';
import { wagonCenter, surf } from '../src/game/layout';
import { DEFAULT_SPLASH, createSplash, letterVisible, stepSplash, isSettled } from '../src/splash/logic';
import { lvl, placeAgent, playing, press, run } from './helpers';

describe('exit rule', () => {
  it('is blocked with packages missing: banner and buzzer', () => {
    const g = playing();
    placeAgent(g, 5, wagonCenter());
    lvl(g).packages = 4;
    press(g, 'up');
    expect(g.banner?.lines[0]).toBe('PACKAGES LEFT: 2');
    expect(g.events.some((e) => e.t === 'sfx' && e.id === 'buzzer')).toBe(true);
    expect(g.scene).toBe('mall');
  });
  it('with all 6 packages, Level Clear fires exactly once', () => {
    const g = playing();
    placeAgent(g, 5, wagonCenter());
    lvl(g).packages = 6;
    press(g, 'up');
    press(g, 'up');
    expect(g.scene).toBe('levelclear');
    const loop = g.loop;
    const jingles = g.events.filter((e) => e.t === 'jingle' && e.id === 'jingle_clear').length;
    expect(jingles).toBe(1);
    let score = g.score;
    // Skip through tally, headline and post with Start.
    for (let i = 0; i < 4; i++) {
      run(g, 5);
      press(g, 'start');
    }
    run(g, 60);
    expect(g.loop).toBe(loop + 1);
    expect(g.score - score).toBeGreaterThanOrEqual(1000);
    score = g.score;
    run(g, 300);
    expect(g.loop).toBe(loop + 1);
    expect(g.scene).toBe('mall');
    expect(lvl(g).packages).toBe(0);
  });
});

describe('continues and game over', () => {
  function dieOnce(g: ReturnType<typeof playing>) {
    const p = lvl(g).mall.player;
    p.mode = 'ground';
    p.invuln = 0;
    lvl(g).mall.spies = [];
    p.mode = 'dead';
    p.deadT = 0;
    run(g, 95);
  }
  it('respawn keeps going with ~2 s invulnerability and spies cleared', () => {
    const g = playing();
    placeAgent(g, 1, 300);
    dieOnce(g);
    expect(g.lives).toBe(2);
    expect(lvl(g).mall.player.mode).toBe('ground');
    expect(lvl(g).mall.player.invuln).toBeGreaterThan(100);
  });
  it('3 continues per game; Start gives 3 fresh lives where you fell, keeping score and packages', () => {
    const g = playing();
    placeAgent(g, 1, 300);
    g.score = 1234;
    lvl(g).packages = 2;
    lvl(g).powers.radar = true;
    for (let c = 0; c < 3; c++) {
      g.lives = 1;
      dieOnce(g);
      expect(g.scene).toBe('continue');
      expect(continueNumber(g)).toBe(9);
      run(g, 30);
      press(g, 'start');
      expect(g.lives).toBe(3);
      expect(g.continues).toBe(2 - c);
      expect(g.score).toBe(1234);
      expect(lvl(g).packages).toBe(2);
      expect(lvl(g).powers.radar).toBe(false);
      expect(g.scene).toBe('mall');
    }
    g.lives = 1;
    dieOnce(g);
    expect(g.scene).toBe('gameover');
  });
  it('the continue countdown runs out into game over', () => {
    const g = playing();
    placeAgent(g, 1, 300);
    g.lives = 1;
    dieOnce(g);
    run(g, 60 * 6);
    expect(continueNumber(g)).toBe(3);
    run(g, 60 * 4 + 5);
    expect(g.scene).toBe('gameover');
    run(g, 800);
    run(g, 45);
    expect(g.scene).toBe('title');
  });
});

describe('FLICKERSOFT splash', () => {
  it('letters flicker on alternate frames, neighbours out of phase, then settle', () => {
    const s = createSplash();
    stepSplash(s, false);
    for (let i = 0; i < 10; i++) expect(letterVisible(s, i)).not.toBe(letterVisible(s, i + 1));
    const before = letterVisible(s, 0);
    stepSplash(s, false);
    expect(letterVisible(s, 0)).toBe(!before);
    let jingles = 0;
    while (!s.done) if (stepSplash(s, false) === 'jingle') jingles++;
    expect(jingles).toBe(1);
    expect(isSettled(s)).toBe(true);
    expect(s.t).toBe(DEFAULT_SPLASH.endAt);
    expect(DEFAULT_SPLASH.flickerEnd).toBeGreaterThanOrEqual(50);
    expect(DEFAULT_SPLASH.flickerEnd).toBeLessThanOrEqual(70);
  });
  it('any button skips it; the game then shows the title', () => {
    const g = createGame({ seed: 1 });
    expect(g.scene).toBe('splash');
    step(g, frameOf());
    step(g, frameOf([], ['a']));
    expect(g.scene).toBe('title');
  });
  it('runs to the title on its own after ~3 s', () => {
    const g = createGame({ seed: 1 });
    run(g, 181);
    expect(g.scene).toBe('title');
    expect(g.events.some((e) => e.t === 'splashJingle')).toBe(true);
  });
});

describe('overlays', () => {
  it('map and pause stop all timers; the agent does not move', () => {
    const g = playing();
    placeAgent(g, 1, 300);
    const frames = lvl(g).frames;
    press(g, 'select');
    run(g, 100, ['right']);
    expect(lvl(g).frames).toBe(frames);
    expect(lvl(g).mall.player.x).toBe(300);
    press(g, 'select');
    press(g, 'start');
    expect(g.overlay).toBe('pause');
    run(g, 100);
    expect(lvl(g).frames).toBe(frames);
    press(g, 'start');
    expect(g.overlay).toBeNull();
    void surf;
  });
});
