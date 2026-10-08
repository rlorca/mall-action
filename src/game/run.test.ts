import { describe, expect, it } from 'vitest';
import { EXTRA_LIFE_SCORE, MAX_CONTINUES, POINTS, Run, START_LIVES } from './run';
import { difficulty, MIN_SHOT_INTERVAL } from './difficulty';
import type { LevelState } from './levelstate';
import { canEnterStore, storeStatus } from './levelstate';

const emptyLevel = (): LevelState => ({ seed: 1, loop: 1, blackFriday: false, stores: {} });

describe('Run scoring and lives', () => {
  it('starts with 3 lives and 3 continues', () => {
    const r = new Run(1);
    expect(r.lives).toBe(START_LIVES);
    expect(r.continuesLeft).toBe(MAX_CONTINUES);
  });
  it('awards exactly one extra life at 20,000 points', () => {
    const r = new Run(1);
    r.addScore(EXTRA_LIFE_SCORE - 1);
    expect(r.lives).toBe(3);
    r.addScore(1);
    expect(r.lives).toBe(4);
    r.addScore(50000);
    expect(r.lives).toBe(4);
    expect(r.drainSfx()).toContain('oneup');
  });
  it('never lets the score go negative and tracks the high score', () => {
    const r = new Run(1, { hiScore: 500 });
    r.addScore(POINTS.caughtByCop);
    expect(r.score).toBe(0);
    r.addScore(900);
    expect(r.hiScore).toBe(900);
    r.addScore(POINTS.walkerShot);
    expect(r.score).toBe(700);
    expect(r.hiScore).toBe(900);
  });
  it('time bonus is 10 per second under 300 s', () => {
    const r = new Run(1);
    r.levelFrames = 100 * 60;
    expect(r.timeBonus()).toBe(2000);
    r.levelFrames = 400 * 60;
    expect(r.timeBonus()).toBe(0);
  });
  it('lose life -> respawn / continue / game over; continue gives 3 fresh lives and keeps score', () => {
    const r = new Run(1);
    r.addScore(1234);
    expect(r.loseLife()).toBe('respawn');
    expect(r.loseLife()).toBe('respawn');
    expect(r.loseLife()).toBe('continue');
    r.useContinue();
    expect(r.lives).toBe(3);
    expect(r.continuesLeft).toBe(2);
    expect(r.score).toBe(1234);
    for (let c = 0; c < 2; c++) {
      r.lives = 1;
      expect(r.loseLife()).toBe('continue');
      r.useContinue();
    }
    r.lives = 1;
    expect(r.loseLife()).toBe('gameover');
    expect(() => r.useContinue()).toThrow();
  });
});

describe('Run power-ups', () => {
  it('weapons replace each other; armour/speed/radar stack with the weapon', () => {
    const r = new Run(1);
    r.givePower('rapid');
    r.givePower('armor');
    r.givePower('sneakers');
    r.givePower('radar');
    expect(r.power.weapon?.id).toBe('rapid');
    r.givePower('spread');
    expect(r.power.weapon?.id).toBe('spread');
    expect(r.power.armor).toBe('armor');
    expect(r.power.speed?.id).toBe('sneakers');
    expect(r.power.radar).toBe(true);
  });
  it('sneakers and Orange Juli-Ooze share one slot; ooze is 1.5x walk speed', () => {
    const r = new Run(1);
    r.givePower('sneakers');
    expect(r.walkFactor()).toBeGreaterThan(1);
    r.givePower('ooze');
    expect(r.power.speed?.id).toBe('ooze');
    expect(r.walkFactor()).toBe(1.5);
  });
  it('timers run 20 s / 12 s / 6 s and expire', () => {
    const r = new Run(1);
    r.givePower('rapid');
    r.givePower('ooze');
    r.givePower('cinnabomb');
    for (let i = 0; i < 6 * 60; i++) r.tickPowers();
    expect(r.invincible).toBe(false);
    expect(r.power.speed).not.toBeNull();
    for (let i = 0; i < 6 * 60; i++) r.tickPowers();
    expect(r.power.speed).toBeNull();
    expect(r.power.weapon).not.toBeNull();
    for (let i = 0; i < 8 * 60; i++) r.tickPowers();
    expect(r.power.weapon).toBeNull();
  });
  it('armour (vest or pretzel) absorbs exactly one hit', () => {
    const r = new Run(1);
    r.givePower('pretzel');
    expect(r.absorbHit()).toBe(true);
    expect(r.absorbHit()).toBe(false);
  });
  it('death clears everything except Radar; continue clears Radar too', () => {
    const r = new Run(1);
    r.givePower('radar');
    r.givePower('rapid');
    r.givePower('armor');
    r.clearPowersOnDeath();
    expect(r.power.radar).toBe(true);
    expect(r.power.weapon).toBeNull();
    expect(r.power.armor).toBeNull();
    r.resetPowers();
    expect(r.power.radar).toBe(false);
  });
  it('1-Up is instant (+1 life), rapid fire allows 4 bullets', () => {
    const r = new Run(1);
    r.givePower('oneup');
    expect(r.lives).toBe(4);
    expect(r.fireProfile().maxBullets).toBe(2);
    r.givePower('rapid');
    expect(r.fireProfile().maxBullets).toBe(4);
    expect(r.fireProfile().cooldown).toBeLessThan(14);
  });
  it('joke items are worth +1 point and go in the inventory', () => {
    const r = new Run(1);
    r.addJoke('PET ROCK');
    expect(r.score).toBe(1);
    expect(r.inventoryLine()).toContain('PET ROCK');
  });
  it('HUD timed power-up reports a draining bar', () => {
    const r = new Run(1);
    expect(r.activeTimed()).toBeNull();
    r.givePower('spread');
    const a = r.activeTimed()!;
    expect(a.left).toBe(a.total);
    r.tickPowers();
    expect(r.activeTimed()!.left).toBe(a.total - 1);
  });
});

describe('level state helpers', () => {
  it('reports store status and entry rules', () => {
    const lvl = emptyLevel();
    expect(storeStatus(lvl, 'forever12')).toBe('package');
    expect(storeStatus(lvl, 'crookstone')).toBe('powerup');
    expect(storeStatus(lvl, 'blockbluster')).toBe('closed');
    expect(canEnterStore(lvl, 'blockbluster')).toBe(false);
    lvl.stores.forever12 = { id: 'forever12', fixtures: [], packageTaken: true };
    expect(storeStatus(lvl, 'forever12')).toBe('cleared');
    expect(canEnterStore(lvl, 'forever12')).toBe(false);
  });
});

describe('difficulty scaling', () => {
  it('loop 1 matches the brief (a shot about every 2.5 s, 4 spies, alarm after 150 s)', () => {
    const d = difficulty(1);
    expect(d.shotInterval).toBe(150);
    expect(d.spyCap).toBe(4);
    expect(d.alarmFrames).toBe(150 * 60);
  });
  it('each loop: spies faster, more frequent, shoot more often, alarm 20 s sooner; all capped', () => {
    const d1 = difficulty(1);
    const d2 = difficulty(2);
    expect(d2.spySpeed / d1.spySpeed).toBeCloseTo(1.1, 5);
    expect(d2.spawnRate / d1.spawnRate).toBeCloseTo(1.15, 5);
    expect(d2.shotInterval).toBeLessThan(d1.shotInterval);
    expect(d1.alarmFrames - d2.alarmFrames).toBe(20 * 60);
    const d99 = difficulty(99);
    expect(d99.shotInterval).toBeGreaterThanOrEqual(MIN_SHOT_INTERVAL);
    expect(d99.spySpeed).toBeLessThanOrEqual(d1.spySpeed * 1.8 + 1e-9);
    expect(d99.spawnRate).toBeLessThanOrEqual(2.5);
    expect(d99.alarmFrames).toBeGreaterThanOrEqual(70 * 60);
  });
  it('Black Friday doubles the spy cap and spawn rate', () => {
    const n = difficulty(1);
    const b = difficulty(1, true);
    expect(b.spyCap).toBe(n.spyCap * 2);
    expect(b.spawnRate).toBe(n.spawnRate * 2);
  });
});
