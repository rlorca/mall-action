import { POWERUP_NAMES } from './copy';

export type PowerKind = 'rapid' | 'spread' | 'armor' | 'sneakers' | 'radar' | 'oneup' | 'cinnabomb' | 'juice' | 'pretzel';

export const POWER_KINDS: PowerKind[] = ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup', 'cinnabomb', 'juice', 'pretzel'];
/** Kinds that appear in power-up shops and as ordinary fixture loot (food is mostly Hot Spy + spy drops). */
export const SHOP_POWERS: PowerKind[] = ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup'];
export const FOOD_POWERS: PowerKind[] = ['cinnabomb', 'juice', 'pretzel'];

export const DURATION: Record<PowerKind, number> = {
  rapid: 20 * 60,
  spread: 20 * 60,
  armor: 0,
  sneakers: 20 * 60,
  radar: 0,
  oneup: 0,
  cinnabomb: 6 * 60,
  juice: 12 * 60,
  pretzel: 0,
};

export interface TimedSlot {
  kind: PowerKind;
  frames: number;
  total: number;
}

export interface PowerState {
  /** Rapid Fire or Spread Shot (only one at a time). */
  weapon: TimedSlot | null;
  /** Sneakers or Orange Juli-Ooze. */
  speed: TimedSlot | null;
  /** Armor Vest or Soft Pretzel: absorbs one hit. */
  armor: boolean;
  radar: boolean;
  /** Cinnabomb: invincible + kills spies on touch. */
  invincible: TimedSlot | null;
}

export function newPowers(): PowerState {
  return { weapon: null, speed: null, armor: false, radar: false, invincible: null };
}

export function powerName(k: PowerKind): string {
  return POWERUP_NAMES[k];
}

/** Applies a pick-up. Returns true when it grants an extra life (the caller handles lives). */
export function applyPower(p: PowerState, kind: PowerKind): { extraLife: boolean } {
  const slot = (): TimedSlot => ({ kind, frames: DURATION[kind], total: DURATION[kind] });
  switch (kind) {
    case 'rapid':
    case 'spread':
      p.weapon = slot(); // a new weapon replaces the old one
      break;
    case 'sneakers':
    case 'juice':
      p.speed = slot(); // shared slot
      break;
    case 'armor':
    case 'pretzel':
      p.armor = true;
      break;
    case 'radar':
      p.radar = true;
      break;
    case 'cinnabomb':
      p.invincible = slot();
      break;
    case 'oneup':
      return { extraLife: true };
  }
  return { extraLife: false };
}

/** Timers keep running everywhere in the game (mall AND stores). They only stop when the game is not stepped. */
export function tickPowers(p: PowerState): void {
  for (const k of ['weapon', 'speed', 'invincible'] as const) {
    const s = p[k];
    if (s) {
      s.frames--;
      if (s.frames <= 0) p[k] = null;
    }
  }
}

/** On death everything is lost except Radar. */
export function resetPowersOnDeath(p: PowerState): void {
  p.weapon = null;
  p.speed = null;
  p.armor = false;
  p.invincible = null;
}

/** Walk speed multiplier. */
export function speedMul(p: PowerState): number {
  return p.speed ? 1.5 : 1;
}
export function sneakerBoost(p: PowerState): boolean {
  return p.speed?.kind === 'sneakers';
}

export interface FireProfile {
  cooldown: number;
  maxBullets: number;
  spread: boolean;
}
export function fireProfile(p: PowerState): FireProfile {
  const k = p.weapon?.kind;
  if (k === 'rapid') return { cooldown: 6, maxBullets: 4, spread: false };
  if (k === 'spread') return { cooldown: 16, maxBullets: 2, spread: true };
  return { cooldown: 14, maxBullets: 2, spread: false };
}

/** The timed power-up the HUD shows: Cinnabomb beats weapon beats speed. */
export function hudSlot(p: PowerState): TimedSlot | null {
  return p.invincible ?? p.weapon ?? p.speed;
}
