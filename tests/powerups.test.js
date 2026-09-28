import { describe, it, expect } from 'vitest';
import { createPowerState, applyPowerup, tickPowerups, resolveHit, walkSpeed, jumpVelocity, searchFrames, fireCooldown, maxBullets, resetOnDeath, activeLabel } from '../src/logic/powerups.js';

describe('power-ups', () => {
  it('weapons replace each other and expire', () => {
    const p = createPowerState();
    applyPowerup(p, 'rapid'); expect(fireCooldown(p)).toBe(8); expect(maxBullets(p)).toBe(4);
    applyPowerup(p, 'spread'); expect(p.weapon).toBe('spread'); expect(fireCooldown(p)).toBe(16);
    for (let i = 0; i < 1200; i++) tickPowerups(p);
    expect(p.weapon).toBeNull(); expect(maxBullets(p)).toBe(2);
  });
  it('sneakers and juli-ooze share the speed slot; only sneakers boosts jump & search', () => {
    const p = createPowerState();
    applyPowerup(p, 'juliooze'); expect(walkSpeed(p)).toBe(1.5); expect(jumpVelocity(p)).toBe(-3.2); expect(searchFrames(p)).toBe(45);
    applyPowerup(p, 'sneakers'); expect(p.speed).toBe('sneakers'); expect(jumpVelocity(p)).toBe(-3.6); expect(searchFrames(p)).toBe(24);
  });
  it('armor and pretzel absorb one hit; cinnabomb ignores hits', () => {
    const p = createPowerState();
    applyPowerup(p, 'pretzel'); expect(resolveHit(p)).toBe('absorbed'); expect(resolveHit(p)).toBe('dead');
    applyPowerup(p, 'cinnabomb'); applyPowerup(p, 'armor');
    expect(resolveHit(p)).toBe('ignored'); expect(p.armor).toBe('armor');
  });
  it('stacks armor + speed + radar with a weapon', () => {
    const p = createPowerState();
    ['spread', 'armor', 'sneakers', 'radar'].forEach((id) => applyPowerup(p, id));
    expect(p).toMatchObject({ weapon: 'spread', armor: 'armor', speed: 'sneakers', radar: true });
  });
  it('1-up reports an extra life', () => {
    expect(applyPowerup(createPowerState(), 'oneup').extraLife).toBe(1);
  });
  it('death clears everything except radar', () => {
    const p = createPowerState(); ['rapid', 'armor', 'sneakers', 'radar'].forEach((id) => applyPowerup(p, id));
    resetOnDeath(p);
    expect(p).toMatchObject({ weapon: null, armor: null, speed: null, radar: true, invincibleT: 0 });
  });
  it('activeLabel shows the timed power-up with remaining fraction', () => {
    const p = createPowerState(); applyPowerup(p, 'rapid'); for (let i = 0; i < 600; i++) tickPowerups(p);
    expect(activeLabel(p)).toEqual({ label: 'RAPID', frac: 0.5 });
  });
});
