/** Power-up slots, timers and scoring helpers. */
import type { Game, Level, Powers } from './types';
import { POWER_NAMES, TEXT, type PowerKind } from './copy';
import type { Rng } from '../core/rng';

export const SEC = 60;
export const DUR = { rapid: 20 * SEC, spread: 20 * SEC, sneakers: 20 * SEC, cinnabomb: 6 * SEC, juliooze: 12 * SEC };
export const EXTRA_LIFE_AT = 20000;

export function newPowers(): Powers {
  return { weapon: 'none', weaponT: 0, armor: false, speed: 'none', speedT: 0, radar: false, cinna: 0 };
}

export function addScore(g: Game, n: number): void {
  g.score = Math.max(0, g.score + n);
  if (!g.extraGiven && g.score >= EXTRA_LIFE_AT) {
    g.extraGiven = true;
    g.lives++;
    g.sfx.push('oneup');
    if (g.level) g.level.banner = { lines: [TEXT.extraLife], t: 120 };
  }
  if (g.score > g.hi) g.hi = g.score;
}

/** Apply a power-up. One weapon at a time; armour, speed and radar stack with it. */
export function applyPower(g: Game, p: Powers, kind: PowerKind): void {
  switch (kind) {
    case 'rapid': p.weapon = 'rapid'; p.weaponT = DUR.rapid; break;
    case 'spread': p.weapon = 'spread'; p.weaponT = DUR.spread; break;
    case 'armor': case 'pretzel': p.armor = true; break;
    case 'sneakers': p.speed = 'sneakers'; p.speedT = DUR.sneakers; break;
    case 'juliooze': p.speed = 'juliooze'; p.speedT = DUR.juliooze; break;
    case 'radar': p.radar = true; break;
    case 'oneup': g.lives++; break;
    case 'cinnabomb': p.cinna = DUR.cinnabomb; break;
  }
}

/** Collecting a power-up: effect + 50 points + sound. */
export function grantPower(g: Game, L: Level, kind: PowerKind): void {
  applyPower(g, L.powers, kind);
  addScore(g, 50);
  g.sfx.push(kind === 'oneup' ? 'oneup' : 'powerup');
  L.banner = { lines: [POWER_NAMES[kind]], t: 120 };
}

/** Runs every frame of play (mall AND stores); never while map/pause/continue are open. */
export function tickPowers(p: Powers): void {
  if (p.weaponT > 0 && --p.weaponT === 0) p.weapon = 'none';
  if (p.speedT > 0 && --p.speedT === 0) p.speed = 'none';
  if (p.cinna > 0) p.cinna--;
}

/** Everything is lost on death except Radar. */
export function loseOnDeath(p: Powers): void {
  const radar = p.radar;
  Object.assign(p, newPowers());
  p.radar = radar;
}

export function walkSpeed(p: Powers): number {
  return p.speed === 'none' ? 1 : 1.5;
}
export function maxShots(p: Powers): number {
  return p.weapon === 'rapid' ? 4 : 2;
}
export function shotCooldown(p: Powers): number {
  return p.weapon === 'rapid' ? 6 : 14;
}
export function searchFrames(p: Powers): number {
  return p.speed === 'sneakers' ? 27 : 45;
}

/** The timed power-up shown in the HUD: [kind, framesLeft, framesTotal] or null. */
export function hudPower(p: Powers): [PowerKind, number, number] | null {
  if (p.cinna > 0) return ['cinnabomb', p.cinna, DUR.cinnabomb];
  if (p.weapon !== 'none') return [p.weapon, p.weaponT, p.weapon === 'rapid' ? DUR.rapid : DUR.spread];
  if (p.speed !== 'none') return [p.speed, p.speedT, p.speed === 'sneakers' ? DUR.sneakers : DUR.juliooze];
  return null;
}

const NORMAL: PowerKind[] = ['rapid', 'rapid', 'rapid', 'spread', 'spread', 'spread', 'armor', 'armor', 'armor', 'sneakers', 'sneakers', 'sneakers', 'radar', 'oneup'];
const FOOD: PowerKind[] = ['cinnabomb', 'juliooze', 'pretzel'];
export function randomPower(rng: Rng, foodChance: number): PowerKind {
  return rng.chance(foodChance) ? rng.pick(FOOD) : rng.pick(NORMAL);
}
export function isFood(k: PowerKind): boolean {
  return FOOD.includes(k);
}

/** Difficulty scaling per loop; everything is capped. */
export function difficulty(loop: number, alarm: boolean, blackFriday: boolean) {
  const n = Math.max(0, loop - 1);
  const speedMul = Math.min(1.6, 1 + 0.1 * n) * (alarm ? 1.25 : 1);
  const spawnMul = Math.min(2.5, Math.pow(1.15, n)) * (alarm ? 1.5 : 1) * (blackFriday ? 2 : 1);
  const shootInterval = Math.max(60, Math.round(150 / Math.min(2.5, Math.pow(1.15, n))));
  const alarmAt = Math.max(60 * SEC, (150 - 20 * n) * SEC);
  const spyCap = blackFriday ? 8 : 4;
  return { speedMul, spawnMul, shootInterval, alarmAt, spyCap };
}
