// Power-up slots and timers. Pure. Timers are in frames and only tick when the game ticks.
import { SEC } from './constants';

export type PowerUpId =
  | 'rapid'
  | 'spread'
  | 'armor'
  | 'sneakers'
  | 'radar'
  | 'oneup'
  | 'cinnabomb'
  | 'juli'
  | 'pretzel';

export const POWERUP_NAMES: Record<PowerUpId, string> = {
  rapid: 'RAPID FIRE',
  spread: 'SPREAD SHOT',
  armor: 'ARMOR VEST',
  sneakers: 'SNEAKERS',
  radar: 'RADAR',
  oneup: '1-UP',
  cinnabomb: 'CINNABOMB',
  juli: 'JULI-OOZE',
  pretzel: 'SOFT PRETZEL',
};

/** Power-ups that pick a weapon slot (only one at a time). */
export const WEAPON_SLOT: ReadonlySet<PowerUpId> = new Set(['rapid', 'spread']);
/** Power-ups that use the speed slot (Sneakers and Juli-Ooze share it). */
export const SPEED_SLOT: ReadonlySet<PowerUpId> = new Set(['sneakers', 'juli']);

export const DURATION: Partial<Record<PowerUpId, number>> = {
  rapid: 20 * SEC,
  spread: 20 * SEC,
  sneakers: 20 * SEC,
  juli: 12 * SEC,
  cinnabomb: 6 * SEC,
};

export class PowerUps {
  weapon: { id: 'rapid' | 'spread'; left: number } | null = null;
  speed: { id: 'sneakers' | 'juli'; left: number } | null = null;
  cinnabomb = 0;
  armour: 'none' | 'vest' | 'pretzel' = 'none';
  radar = false;

  /** Apply a timed or permanent power-up. 1-Up is instant and handled by the game, not here. */
  grant(id: PowerUpId): void {
    if (WEAPON_SLOT.has(id)) {
      this.weapon = { id: id as 'rapid' | 'spread', left: DURATION[id] ?? 0 };
    } else if (SPEED_SLOT.has(id)) {
      this.speed = { id: id as 'sneakers' | 'juli', left: DURATION[id] ?? 0 };
    } else if (id === 'armor') {
      this.armour = 'vest';
    } else if (id === 'pretzel') {
      this.armour = 'pretzel';
    } else if (id === 'radar') {
      this.radar = true;
    } else if (id === 'cinnabomb') {
      this.cinnabomb = DURATION.cinnabomb ?? 0;
    }
    // 'oneup' is instant and handled by the game.
  }

  /** Called once per simulation frame, including inside stores. */
  tick(): void {
    if (this.weapon && --this.weapon.left <= 0) this.weapon = null;
    if (this.speed && --this.speed.left <= 0) this.speed = null;
    if (this.cinnabomb > 0) this.cinnabomb--;
  }

  /** Armour absorbs one hit. Returns true if the hit was absorbed. */
  absorbHit(): boolean {
    if (this.armour === 'none') return false;
    this.armour = 'none';
    return true;
  }

  /** On death everything is lost except Radar. */
  clearOnDeath(): void {
    this.weapon = null;
    this.speed = null;
    this.cinnabomb = 0;
    this.armour = 'none';
  }

  get isInvincible(): boolean {
    return this.cinnabomb > 0;
  }

  get maxBullets(): number {
    return this.weapon?.id === 'rapid' ? 4 : 2;
  }

  get walkMultiplier(): number {
    return this.speed ? 1.5 : 1;
  }
}
