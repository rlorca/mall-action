import { describe, expect, it } from 'vitest';
import { EXTRA_LIFE_EVERY, Score, timeBonus } from '../src/core/scoring';
import { difficultyFor } from '../src/core/difficulty';
import { SEC } from '../src/core/constants';

describe('scoring and lives', () => {
  it('grants an extra life each time the score crosses 20,000', () => {
    const s = new Score();
    expect(s.add(19_999)).toBe(0);
    expect(s.add(1)).toBe(1);
    expect(s.add(EXTRA_LIFE_EVERY)).toBe(1);
  });

  it('never goes below zero', () => {
    const s = new Score();
    s.add(-500);
    expect(s.points).toBe(0);
  });

  it('gives 10 points per second under 300 s for the time bonus', () => {
    expect(timeBonus(0)).toBe(3000);
    expect(timeBonus(290)).toBe(100);
    expect(timeBonus(400)).toBe(0);
  });
});

describe('difficulty scaling', () => {
  it('starts at the base rates on loop 1', () => {
    const d = difficultyFor(1);
    expect(d.spySpeed).toBe(1);
    expect(d.spawnRate).toBe(1);
    expect(d.fireRate).toBe(1);
    expect(d.alarmAtSec).toBe(150);
  });

  it('gets harder each loop, and the alarm comes sooner', () => {
    const l1 = difficultyFor(1);
    const l2 = difficultyFor(2);
    expect(l2.spySpeed).toBeGreaterThan(l1.spySpeed);
    expect(l2.fireRate).toBeGreaterThan(l1.fireRate);
    expect(l2.shotIntervalFrames).toBeLessThan(l1.shotIntervalFrames);
    expect(l2.alarmAtSec).toBe(130);
  });

  it('caps the scaling so late loops stay playable', () => {
    expect(difficultyFor(40).spySpeed).toBe(difficultyFor(9).spySpeed);
    expect(difficultyFor(40).alarmAtSec).toBeGreaterThanOrEqual(60);
    expect(difficultyFor(40).shotIntervalFrames).toBeGreaterThanOrEqual(SEC);
  });

  it('Black Friday doubles the spy cap and the spawn rate', () => {
    const normal = difficultyFor(1);
    const bf = difficultyFor(1, true);
    expect(bf.maxSpies).toBe(normal.maxSpies * 2);
    expect(bf.spawnRate).toBe(normal.spawnRate * 2);
  });
});
