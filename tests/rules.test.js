import { describe, it, expect } from 'vitest';
import { addScore, addPoints, canExit, packagesLeft, difficulty, isAlarm, timeBonus, SCORES } from '../src/logic/rules.js';

const st = () => ({ score: 0, lives: 3, extraLifeGiven: false, packages: new Set() });

describe('scoring', () => {
  it('adds spec scores and never goes below zero', () => {
    const s = st(); addScore(s, 'spyShot'); expect(s.score).toBe(100);
    addScore(s, 'detained'); expect(s.score).toBe(0);
    expect(SCORES).toMatchObject({ spyCrushed: 300, spyLight: 300, package: 500, powerup: 50, levelClear: 1000, coin: 50, slideKill: 300, discoKill: 300, walkerShot: -200, detained: -500, jokeItem: 1 });
  });
  it('awards exactly one extra life at 20 000', () => {
    const s = st(); s.score = 19950;
    expect(addScore(s, 'powerup').extraLife).toBe(true); expect(s.lives).toBe(4);
    s.score = 39990; expect(addPoints(s, 50).extraLife).toBe(false); expect(s.lives).toBe(4);
  });
});

describe('exit rule', () => {
  it('needs all 6 packages', () => {
    const s = st(); ['a', 'b', 'c', 'd', 'e'].forEach((p) => s.packages.add(p));
    expect(canExit(s)).toBe(false); expect(packagesLeft(s)).toBe(1);
    s.packages.add('f'); expect(canExit(s)).toBe(true);
  });
});

describe('difficulty', () => {
  it('loop 1 base values', () => {
    expect(difficulty(1)).toEqual({ spySpeed: 0.75, spawnInterval: 240, fireInterval: 90, alarmAt: 9000, spyCap: 4 });
  });
  it('scales per loop with caps', () => {
    const d2 = difficulty(2);
    expect(d2.spySpeed).toBeCloseTo(0.825); expect(d2.spawnInterval).toBe(204); expect(d2.fireInterval).toBe(78); expect(d2.alarmAt).toBe(130 * 60);
    const d20 = difficulty(20);
    expect(d20.spySpeed).toBe(1.5); expect(d20.spawnInterval).toBe(90); expect(d20.fireInterval).toBe(40); expect(d20.alarmAt).toBe(3600);
  });
  it('alarm and black friday modifiers', () => {
    const a = difficulty(1, { alarm: true });
    expect(a.spySpeed).toBeCloseTo(0.9375); expect(a.spawnInterval).toBe(168);
    const bf = difficulty(1, { blackFriday: true });
    expect(bf.spyCap).toBe(8); expect(bf.spawnInterval).toBe(120);
  });
  it('alarm triggers at alarmAt and time bonus decays', () => {
    expect(isAlarm(8999, 1)).toBe(false); expect(isAlarm(9000, 1)).toBe(true);
    expect(timeBonus(0)).toBe(3000); expect(timeBonus(60 * 100)).toBe(2000); expect(timeBonus(60 * 400)).toBe(0);
  });
});
