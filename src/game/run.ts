import { Rng } from '../engine/rng';
import { POWERUPS, type PowerId } from '../content/powerups';
import type { StoreId } from '../content/stores';
import { PACKAGES_TOTAL } from '../content/stores';
import type { SfxId } from '../audio/ids';
import type { LevelState } from './levelstate';
import { packagesTaken } from './levelstate';

export const START_LIVES = 3;
export const MAX_CONTINUES = 3;
export const EXTRA_LIFE_SCORE = 20000;
export const CLEAR_BONUS = 1000;
export const TIME_BONUS_BASE_SECONDS = 300;

export const POINTS = {
  spyShot: 100,
  spyCrushed: 300,
  package: 500,
  powerup: 50,
  levelClear: 1000,
  timePerSecond: 10,
  coin: 50,
  walkerShot: -200,
  caughtByCop: -500,
  jokeItem: 1,
} as const;

export interface PowerState {
  weapon: { id: 'rapid' | 'spread'; left: number } | null;
  speed: { id: 'sneakers' | 'ooze'; left: number } | null;
  armor: 'armor' | 'pretzel' | null;
  radar: boolean;
  /** Frames of Cinnabomb invincibility left. */
  invincible: number;
}

export function emptyPower(): PowerState {
  return { weapon: null, speed: null, armor: null, radar: false, invincible: 0 };
}

export interface FireProfile {
  maxBullets: number;
  cooldown: number;
  spread: boolean;
}

/**
 * Whole-game state that survives scene changes: score, lives, continues, loop,
 * power-ups, inventory and the per-game "first time" flags. Pure and testable;
 * sound requests go into `sfxQueue` (the Game drains it each step).
 */
export class Run {
  readonly rng: Rng;
  score = 0;
  hiScore: number;
  lives = START_LIVES;
  continuesLeft = MAX_CONTINUES;
  loop = 1;
  readonly blackFriday: boolean;
  /** Frames of play in the current level (stops while paused; counts inside stores). */
  levelFrames = 0;
  alarmOn = false;
  power: PowerState = emptyPower();
  /** Joke items collected this game (GameStonk easter egg etc). */
  inventory: string[] = [];
  /** The 4-frame photo strip from the photo booth (first exit each game). */
  photoStrip = false;
  /** Per-game "first time" flags. */
  seenStores = new Set<StoreId>();
  easterEggDone = false;
  extraLifeAwarded = false;
  /** Set when the extra-life threshold was crossed this step (UI can flash 1UP). */
  extraLifeJustAwarded = false;
  level!: LevelState;
  sfxQueue: SfxId[] = [];

  constructor(readonly seed: number, opts: { blackFriday?: boolean; hiScore?: number } = {}) {
    this.rng = new Rng(seed);
    this.blackFriday = !!opts.blackFriday;
    this.hiScore = opts.hiScore ?? 0;
  }

  sfx(id: SfxId): void {
    this.sfxQueue.push(id);
  }

  drainSfx(): SfxId[] {
    const q = this.sfxQueue;
    this.sfxQueue = [];
    return q;
  }

  // ---------------------------------------------------------------- score
  addScore(n: number): void {
    this.score = Math.max(0, this.score + n);
    if (this.score > this.hiScore) this.hiScore = this.score;
    if (!this.extraLifeAwarded && this.score >= EXTRA_LIFE_SCORE) {
      this.extraLifeAwarded = true;
      this.extraLifeJustAwarded = true;
      this.lives++;
      this.sfx('oneup');
    }
  }

  addLife(): void {
    this.lives++;
    this.sfx('oneup');
  }

  // ---------------------------------------------------------------- packages
  get packages(): number {
    return this.level ? packagesTaken(this.level) : 0;
  }

  get allPackages(): boolean {
    return this.packages >= PACKAGES_TOTAL;
  }

  // ---------------------------------------------------------------- items
  addJoke(name: string): void {
    this.inventory.push(name);
    this.addScore(POINTS.jokeItem);
  }

  /** "ITEMS: PET ROCK, MOOD RING" style line for the map; empty string when nothing yet. */
  inventoryLine(): string {
    const parts = [...this.inventory];
    if (this.photoStrip) parts.push('PHOTO STRIP');
    return parts.length ? parts.join(', ') : 'NONE YET';
  }

  // ---------------------------------------------------------------- power-ups
  /** Apply a power-up (slot rules from the brief). Returns its display name. */
  givePower(id: PowerId): string {
    const def = POWERUPS[id];
    const p = this.power;
    switch (def.slot) {
      case 'weapon':
        p.weapon = { id: id as 'rapid' | 'spread', left: def.frames };
        break;
      case 'speed':
        p.speed = { id: id as 'sneakers' | 'ooze', left: def.frames };
        break;
      case 'armor':
        p.armor = id as 'armor' | 'pretzel';
        break;
      case 'radar':
        p.radar = true;
        break;
      case 'invincible':
        p.invincible = def.frames;
        break;
      case 'instant':
        this.addLife();
        break;
    }
    return def.name;
  }

  /** Called once per simulation step in BOTH the mall and stores (not while paused / map / continue). */
  tickPowers(): void {
    const p = this.power;
    if (p.weapon && --p.weapon.left <= 0) p.weapon = null;
    if (p.speed && --p.speed.left <= 0) p.speed = null;
    if (p.invincible > 0) p.invincible--;
  }

  get invincible(): boolean {
    return this.power.invincible > 0;
  }

  /** Armour absorbs exactly one hit. Returns true if the hit was absorbed. */
  absorbHit(): boolean {
    if (this.power.armor) {
      this.power.armor = null;
      return true;
    }
    return false;
  }

  /** Death: everything is lost except Radar. */
  clearPowersOnDeath(): void {
    const radar = this.power.radar;
    this.power = emptyPower();
    this.power.radar = radar;
  }

  /** Continue / new level: everything reset, Radar included. */
  resetPowers(): void {
    this.power = emptyPower();
  }

  /** The timed power-up the HUD shows with a draining bar (food first: it is the rarest). */
  activeTimed(): { id: PowerId; name: string; left: number; total: number } | null {
    const p = this.power;
    if (p.invincible > 0) return { id: 'cinnabomb', name: POWERUPS.cinnabomb.name, left: p.invincible, total: POWERUPS.cinnabomb.frames };
    if (p.weapon) return { id: p.weapon.id, name: POWERUPS[p.weapon.id].name, left: p.weapon.left, total: POWERUPS[p.weapon.id].frames };
    if (p.speed) return { id: p.speed.id, name: POWERUPS[p.speed.id].name, left: p.speed.left, total: POWERUPS[p.speed.id].frames };
    return null;
  }

  /** Walk speed multiplier. Sneakers 1.25x, Orange Juli-Ooze 1.5x. */
  walkFactor(): number {
    const s = this.power.speed;
    return s ? (s.id === 'ooze' ? 1.5 : 1.25) : 1;
  }

  /** Jump height multiplier (Sneakers jump higher). */
  jumpFactor(): number {
    return this.power.speed?.id === 'sneakers' ? 1.3 : 1;
  }

  /** Frames a store search takes (0.75 s; Sneakers search faster). */
  searchFrames(): number {
    return this.power.speed?.id === 'sneakers' ? 30 : 45;
  }

  fireProfile(): FireProfile {
    const w = this.power.weapon?.id;
    if (w === 'rapid') return { maxBullets: 4, cooldown: 6, spread: false };
    if (w === 'spread') return { maxBullets: 6, cooldown: 14, spread: true };
    return { maxBullets: 2, cooldown: 14, spread: false };
  }

  // ---------------------------------------------------------------- lives / continues
  /**
   * The agent died. Returns what happens next:
   *  'respawn' (lives remain), 'continue' (no lives, continues remain), 'gameover'.
   */
  loseLife(): 'respawn' | 'continue' | 'gameover' {
    this.lives--;
    this.clearPowersOnDeath();
    if (this.lives > 0) return 'respawn';
    return this.continuesLeft > 0 ? 'continue' : 'gameover';
  }

  /** Spend a continue: 3 fresh lives, powers reset; score, packages and loop are kept. */
  useContinue(): void {
    if (this.continuesLeft <= 0) throw new Error('no continues left');
    this.continuesLeft--;
    this.lives = START_LIVES;
    this.resetPowers();
  }

  // ---------------------------------------------------------------- level clear
  /** Seconds of play in the level. */
  get levelSeconds(): number {
    return Math.floor(this.levelFrames / 60);
  }

  timeBonus(): number {
    return Math.max(0, TIME_BONUS_BASE_SECONDS - this.levelSeconds) * POINTS.timePerSecond;
  }
}
