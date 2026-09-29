/** Power-up slots and timers. Pure. Timers are in frames. */
import type { Rng } from '../core/rng';

export type PowerKind = 'rapid' | 'spread' | 'armor' | 'sneakers' | 'radar' | 'oneup' | 'cinnabomb' | 'ooze' | 'pretzel';
export const POWER_KINDS: readonly PowerKind[] = ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup', 'cinnabomb', 'ooze', 'pretzel'];
export const FOOD: readonly PowerKind[] = ['cinnabomb', 'ooze', 'pretzel'];

export const DURATION = {
  rapid: 20 * 60,
  spread: 20 * 60,
  sneakers: 20 * 60,
  ooze: 12 * 60,
  cinnabomb: 6 * 60,
} as const;

export interface Powers {
  weapon: 'rapid' | 'spread' | null;
  weaponT: number;
  armor: boolean;
  speed: 'sneakers' | 'ooze' | null;
  speedT: number;
  radar: boolean;
  invincT: number;
  /** The timed power-up shown on the HUD (the most recent one still running). */
  hud: PowerKind | null;
}

export function noPowers(): Powers {
  return { weapon: null, weaponT: 0, armor: false, speed: null, speedT: 0, radar: false, invincT: 0, hud: null };
}

/** Apply a power-up. Returns the number of extra lives it grants. */
export function applyPower(p: Powers, kind: PowerKind): number {
  switch (kind) {
    case 'rapid':
    case 'spread':
      p.weapon = kind; // one weapon at a time: the new one replaces the old
      p.weaponT = DURATION[kind];
      p.hud = kind;
      return 0;
    case 'armor':
    case 'pretzel':
      p.armor = true;
      return 0;
    case 'sneakers':
    case 'ooze':
      p.speed = kind; // shares the speed slot
      p.speedT = DURATION[kind];
      p.hud = kind;
      return 0;
    case 'radar':
      p.radar = true;
      return 0;
    case 'cinnabomb':
      p.invincT = DURATION.cinnabomb;
      p.hud = 'cinnabomb';
      return 0;
    case 'oneup':
      return 1;
  }
}

/** One frame of timers. Call only while the game is running (not in map/pause/continue). */
export function tickPowers(p: Powers): void {
  if (p.weaponT > 0 && --p.weaponT === 0) p.weapon = null;
  if (p.speedT > 0 && --p.speedT === 0) p.speed = null;
  if (p.invincT > 0) p.invincT--;
  if (p.hud && hudRemaining(p) <= 0) p.hud = p.weapon ?? p.speed ?? (p.invincT > 0 ? 'cinnabomb' : null);
}

export function hudRemaining(p: Powers): number {
  switch (p.hud) {
    case 'rapid':
    case 'spread':
      return p.weapon === p.hud ? p.weaponT : 0;
    case 'sneakers':
    case 'ooze':
      return p.speed === p.hud ? p.speedT : 0;
    case 'cinnabomb':
      return p.invincT;
    default:
      return 0;
  }
}

export function hudFraction(p: Powers): number {
  if (!p.hud) return 0;
  const total = (DURATION as Record<string, number>)[p.hud] ?? 1;
  return Math.max(0, Math.min(1, hudRemaining(p) / total));
}

/** On death everything is lost except Radar. */
export function powersAfterDeath(p: Powers): Powers {
  const n = noPowers();
  n.radar = p.radar;
  return n;
}

/** Absorb a hit with armour. Returns true if absorbed. */
export function absorbHit(p: Powers): boolean {
  if (p.armor) {
    p.armor = false;
    return true;
  }
  return false;
}

export function walkSpeed(p: Powers): number {
  if (p.speed === 'ooze') return 1.5;
  if (p.speed === 'sneakers') return 1.35;
  return 1;
}
export function jumpVelocity(p: Powers): number {
  return p.speed === 'sneakers' ? -3.7 : -3.2;
}
export function searchFrames(p: Powers): number {
  return p.speed === 'sneakers' ? 30 : 45;
}
export function maxBullets(p: Powers): number {
  return p.weapon === 'rapid' ? 4 : 2;
}
export function shotCooldown(p: Powers): number {
  return p.weapon === 'rapid' ? 6 : 14;
}

const WEIGHTS: [PowerKind, number][] = [
  ['rapid', 3], ['spread', 3], ['armor', 2], ['sneakers', 2], ['radar', 1.2], ['oneup', 0.5],
  ['cinnabomb', 1], ['ooze', 1], ['pretzel', 1],
];

export function randomPower(rng: Rng, opts: { food?: number } = {}): PowerKind {
  if (opts.food !== undefined) {
    if (rng.chance(opts.food)) return rng.pick(FOOD);
    const nonFood = WEIGHTS.filter(([k]) => !FOOD.includes(k));
    return weighted(rng, nonFood);
  }
  return weighted(rng, WEIGHTS);
}

function weighted(rng: Rng, list: [PowerKind, number][]): PowerKind {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [k, w] of list) {
    r -= w;
    if (r < 0) return k;
  }
  return list[list.length - 1][0];
}
