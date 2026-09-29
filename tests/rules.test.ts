import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { createGame, konamiPush, step } from '../src/game/game';
import { frameOf } from '../src/core/input';
import { addScore, EXTRA_LIFE_AT, timeBonus } from '../src/game/common';
import { alarmFrames, maxSpies, shotInterval, spawnInterval, spySpeed, AIM_FRAMES, FIRST_SHOT_DELAY } from '../src/game/difficulty';
import { applyPower, noPowers, powersAfterDeath, tickPowers, DURATION, absorbHit, maxBullets } from '../src/game/powerups';
import { KONAMI, KonamiDetector } from '../src/game/konami';
import { JANITOR, KIOSKS, WALKER_STRETCHES, surf } from '../src/game/layout';
import { spawnSpy } from '../src/game/mall';
import { countSfx, inStore, lvl, placeAgent, playing, press, run } from './helpers';

describe('scoring', () => {
  it('gives exactly one extra life at 20,000 points', () => {
    const g = createGame({ seed: 1 });
    g.lives = 3;
    addScore(g, EXTRA_LIFE_AT - 100);
    expect(g.lives).toBe(3);
    addScore(g, 200);
    expect(g.lives).toBe(4);
    addScore(g, 50000);
    expect(g.lives).toBe(4);
    expect(g.hiScore).toBe(g.score);
  });
  it('never drops below zero and time bonus is 10 per second under 300 s', () => {
    const g = createGame({ seed: 1 });
    addScore(g, -500);
    expect(g.score).toBe(0);
    expect(timeBonus(0)).toBe(3000);
    expect(timeBonus(100 * 60)).toBe(2000);
    expect(timeBonus(400 * 60)).toBe(0);
  });
});

describe('difficulty scaling', () => {
  it('each loop is harder, and every value is capped', () => {
    expect(spySpeed(2) / spySpeed(1)).toBeCloseTo(1.1, 2);
    expect(spawnInterval(1) / spawnInterval(2)).toBeCloseTo(1.15, 1);
    expect(shotInterval(1) / shotInterval(2)).toBeCloseTo(1.15, 1);
    expect(alarmFrames(1) - alarmFrames(2)).toBe(20 * 60);
    expect(alarmFrames(1)).toBe(150 * 60);
    expect(shotInterval(1)).toBe(150);
    for (let l = 1; l < 50; l++) {
      expect(shotInterval(l)).toBeGreaterThanOrEqual(60);
      expect(spySpeed(l)).toBeLessThanOrEqual(1);
      expect(alarmFrames(l)).toBeGreaterThanOrEqual(60 * 60);
      expect(spawnInterval(l)).toBeGreaterThanOrEqual(150);
    }
  });
  it('black friday doubles the spy cap and spawn rate', () => {
    expect(maxSpies(true)).toBe(2 * maxSpies(false));
    expect(spawnInterval(1, true)).toBe(Math.round(spawnInterval(1) / 2));
  });
});

describe('power-ups', () => {
  it('one weapon at a time; armour, speed and radar stack', () => {
    const p = noPowers();
    applyPower(p, 'rapid');
    applyPower(p, 'armor');
    applyPower(p, 'sneakers');
    applyPower(p, 'radar');
    expect(maxBullets(p)).toBe(4);
    applyPower(p, 'spread');
    expect(p.weapon).toBe('spread');
    expect(p.armor && p.speed === 'sneakers' && p.radar).toBe(true);
    applyPower(p, 'ooze');
    expect(p.speed).toBe('ooze'); // shares the Sneakers slot
    expect(applyPower(p, 'oneup')).toBe(1);
  });
  it('timers run out; armour absorbs one hit; death keeps only radar', () => {
    const p = noPowers();
    applyPower(p, 'rapid');
    applyPower(p, 'pretzel');
    applyPower(p, 'radar');
    applyPower(p, 'cinnabomb');
    for (let i = 0; i < DURATION.cinnabomb; i++) tickPowers(p);
    expect(p.invincT).toBe(0);
    for (let i = 0; i < DURATION.rapid; i++) tickPowers(p);
    expect(p.weapon).toBeNull();
    expect(absorbHit(p)).toBe(true);
    expect(absorbHit(p)).toBe(false);
    applyPower(p, 'spread');
    const d = powersAfterDeath(p);
    expect(d.radar).toBe(true);
    expect(d.weapon).toBeNull();
  });
  it('timers keep running inside stores and stop in the map and pause screens', () => {
    const g = playing();
    applyPower(lvl(g).powers, 'rapid');
    inStore(g, 'crookstone');
    run(g, 60);
    expect(lvl(g).powers.weaponT).toBe(DURATION.rapid - 60);
    press(g, 'start'); // pause
    run(g, 60);
    expect(lvl(g).powers.weaponT).toBe(DURATION.rapid - 60);
    press(g, 'start');
    press(g, 'select'); // map
    run(g, 60);
    expect(g.overlay).toBe('map');
    expect(lvl(g).powers.weaponT).toBe(DURATION.rapid - 60);
  });
});

describe('NPC rules', () => {
  it('wet floor: slide at walking speed, no stopping or turning until off it', () => {
    const g = playing();
    const L = lvl(g);
    placeAgent(g, JANITOR.floor, 440);
    L.mall.janitor.nextMop = 99999;
    L.mall.wet = { floor: JANITOR.floor, x0: 450, x1: 498, t: 600 };
    run(g, 12, ['right']);
    const p = L.mall.player;
    expect(p.slide).toBe(1);
    const x = p.x;
    run(g, 10, ['left']);
    expect(p.x).toBe(x + 10);
    run(g, 60);
    expect(p.x).toBeGreaterThan(498);
    expect(p.slide).toBe(0);
  });
  it('mall cop: a shot in front of him starts a chase; being caught freezes 3 s and costs 500', () => {
    const g = playing();
    const L = lvl(g);
    const cop = L.mall.cop;
    cop.x = cop.x0 + 10;
    placeAgent(g, cop.floor, cop.x0 + 70);
    cop.facing = 1;
    g.score = 2000;
    L.mall.player.facing = 1;
    press(g, 'a');
    expect(cop.chase).toBeGreaterThan(0);
    expect(countSfx(g, 'whistle')).toBe(1);
    cop.x = L.mall.player.x - 5;
    run(g, 2);
    expect(L.mall.player.frozen).toBeGreaterThan(170);
    expect(g.score).toBe(1500);
    expect(L.mall.player.mode).toBe('ground'); // not a life
  });
  it('mall walkers block bullets from both sides and shooting one costs 200', () => {
    const g = playing();
    const L = lvl(g);
    const w = L.mall.walkers[0];
    placeAgent(g, w.floor, w.x - 40 < WALKER_STRETCHES[0].x0 ? w.x + 40 : w.x - 40);
    L.mall.player.facing = L.mall.player.x < w.x ? 1 : -1;
    g.score = 1000;
    press(g, 'a');
    run(g, 20);
    expect(g.score).toBe(800);
    expect(L.mall.bullets.filter((b) => b.mine).length).toBe(0);
  });
  it('kiosk: shows the nearest package store, then cools down', () => {
    const g = playing();
    const L = lvl(g);
    placeAgent(g, KIOSKS[0].floor, KIOSKS[0].x);
    press(g, 'up');
    expect(L.mall.kioskPanel?.store).toBeTruthy();
    L.mall.kioskPanel = null;
    run(g, 10);
    press(g, 'up');
    expect(L.mall.kioskPanel).toBeNull();
    run(g, 1200);
    press(g, 'up');
    expect(L.mall.kioskPanel).not.toBeNull();
  });
  it('the janitor is harmless and bullets pass through him', () => {
    const g = playing();
    const L = lvl(g);
    const j = L.mall.janitor;
    j.nextMop = 99999;
    L.mall.cop.floor = 1; // keep the Segway cop out of the line of fire
    placeAgent(g, JANITOR.floor, j.x - 30);
    L.mall.player.facing = 1;
    press(g, 'a');
    run(g, 10);
    expect(L.mall.bullets.some((b) => b.mine && b.x > j.x)).toBe(true);
    L.mall.player.x = j.x;
    run(g, 3);
    expect(L.mall.player.mode).not.toBe('dead');
  });
});

describe('spy fairness', () => {
  it('first shot no sooner than ~2 s after appearing, after a clear aiming pose of ~0.5 s', () => {
    const g = playing(11);
    const L = lvl(g);
    placeAgent(g, 1, 300);
    L.mall.spawnT = -100000;
    const s = spawnSpy(g, L, 420, surf(1));
    placeAgent(g, 1, 500);
    L.mall.spies = [s];
    let aimStart = -1;
    let shotAt = -1;
    for (let f = 1; f < 400 && shotAt < 0; f++) {
      run(g, 1);
      L.mall.player.invuln = 5;
      if (s.mode === 'aim' && aimStart < 0) aimStart = f;
      if (L.mall.bullets.some((b) => !b.mine)) shotAt = f;
    }
    expect(aimStart).toBeGreaterThan(0);
    expect(shotAt).toBeGreaterThanOrEqual(FIRST_SHOT_DELAY + AIM_FRAMES - 2);
    expect(shotAt - aimStart).toBeGreaterThanOrEqual(AIM_FRAMES - 1);
  });
  it('spies duck about 10% of volleys (decided once per volley); most straight shots land', () => {
    const g = playing(3);
    const L = lvl(g);
    let hits = 0;
    let dodges = 0;
    for (let i = 0; i < 400; i++) {
      placeAgent(g, 1, 300);
      L.mall.spawnT = -100000;
      const s = spawnSpy(g, L, 350, surf(1));
      s.mode = 'walk';
      s.shotT = 9999;
      L.mall.player.cooldown = 0;
      L.mall.player.facing = 1;
      press(g, 'a');
      run(g, 20);
      if (String(s.mode) === 'dying' || !L.mall.spies.includes(s)) hits++;
      else dodges++;
    }
    const rate = dodges / (hits + dodges);
    expect(rate).toBeGreaterThan(0.04);
    expect(rate).toBeLessThan(0.18);
  });
  it('spies ignore a hidden player (photo booth)', () => {
    const g = playing(5);
    const L = lvl(g);
    placeAgent(g, 2, 540);
    press(g, 'up');
    expect(L.mall.player.mode).toBe('hidden');
    const s = spawnSpy(g, L, 580, surf(2));
    s.mode = 'walk';
    s.shotT = 0;
    run(g, 100);
    expect(L.mall.bullets.filter((b) => !b.mine).length).toBe(0);
  });
  it('the photo booth hides up to 5 s and adds a photo strip once per game', () => {
    const g = playing(5);
    const L = lvl(g);
    placeAgent(g, 2, 540);
    press(g, 'up');
    run(g, 301);
    expect(L.mall.player.mode).toBe('ground');
    expect(g.inventory).toContain('PHOTO STRIP');
    press(g, 'up');
    press(g, 'left');
    expect(g.inventory.filter((i) => i === 'PHOTO STRIP').length).toBe(1);
  });
});

describe('konami code', () => {
  it('detects the code, including with extra leading Ups', () => {
    const d = new KonamiDetector();
    for (const b of ['up', 'up', 'up', ...KONAMI] as const) {
      const done = d.push(b);
      if (done) return;
    }
    throw new Error('not detected');
  });
  it('the title screen enters Black Friday mode', () => {
    const g = createGame({ seed: 1, skipSplash: true });
    for (const b of ['up', 'up', 'up', 'up', ...KONAMI] as const) step(g, frameOf([], [b]));
    expect(g.title.bf).toBe(true);
    step(g, frameOf([], ['start']));
    run(g, 40);
    expect(g.blackFriday).toBe(true);
    expect(konamiPush(g, 'a')).toBe(false);
  });
  it('a wrong sequence does not trigger', () => {
    const d = new KonamiDetector();
    expect(['up', 'down', 'up', 'down', 'left', 'right', 'left', 'right', 'b', 'a'].some((b) => d.push(b as never))).toBe(false);
  });
});

describe('determinism', () => {
  it('a seed replays the same', () => {
    const a = playing(99);
    const b = playing(99);
    const inputs = ['right', 'right', 'a', 'b', 'left'] as const;
    for (let i = 0; i < 900; i++) {
      const k = inputs[Math.floor(i / 37) % inputs.length];
      step(a, frameOf([k]));
      step(b, frameOf([k]));
    }
    expect(JSON.stringify(lvl(a).mall)).toBe(JSON.stringify(lvl(b).mall));
    expect(new Rng(1).next()).toBe(new Rng(1).next());
  });
});
