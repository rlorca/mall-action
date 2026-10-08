import { describe, expect, it } from 'vitest';
import { PowerUps } from '../src/core/powerups';
import { SEC } from '../src/core/constants';

describe('power-up slots and timers', () => {
  it('only one weapon at a time: a new one replaces the old', () => {
    const p = new PowerUps();
    p.grant('rapid');
    p.grant('spread');
    expect(p.weapon?.id).toBe('spread');
    expect(p.maxBullets).toBe(2);
  });

  it('Rapid Fire allows up to four bullets', () => {
    const p = new PowerUps();
    p.grant('rapid');
    expect(p.maxBullets).toBe(4);
  });

  it('Sneakers and Juli-Ooze share the speed slot', () => {
    const p = new PowerUps();
    p.grant('sneakers');
    p.grant('juli');
    expect(p.speed?.id).toBe('juli');
    expect(p.walkMultiplier).toBe(1.5);
  });

  it('timed power-ups run out after their duration', () => {
    const p = new PowerUps();
    p.grant('rapid');
    for (let i = 0; i < 20 * SEC; i++) p.tick();
    expect(p.weapon).toBeNull();
  });

  it('armour absorbs exactly one hit', () => {
    const p = new PowerUps();
    p.grant('armor');
    expect(p.absorbHit()).toBe(true);
    expect(p.absorbHit()).toBe(false);
  });

  it('Cinnabomb makes the agent invincible for 6 s', () => {
    const p = new PowerUps();
    p.grant('cinnabomb');
    expect(p.isInvincible).toBe(true);
    for (let i = 0; i < 6 * SEC; i++) p.tick();
    expect(p.isInvincible).toBe(false);
  });

  it('on death everything is lost except Radar', () => {
    const p = new PowerUps();
    p.grant('rapid');
    p.grant('armor');
    p.grant('radar');
    p.clearOnDeath();
    expect(p.weapon).toBeNull();
    expect(p.armour).toBe('none');
    expect(p.radar).toBe(true);
  });
});
