// Per-game progress + power-up / scoring rules shared by the mall and the stores. Pure and deterministic.
import type { EventSink, StoreId } from '../core/events';
import { PACKAGES_TOTAL } from '../data/stores';
import { sec } from './difficulty';

export type PowerupKind = 'rapid' | 'spread' | 'armor' | 'sneakers' | 'radar' | 'oneup' | 'cinnabomb' | 'juice' | 'pretzel';
export const FOOD_POWERUPS: readonly PowerupKind[] = ['cinnabomb', 'juice', 'pretzel'];
export const NON_FOOD_POWERUPS: readonly PowerupKind[] = ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup'];

export const POWERUP_DURATION: Partial<Record<PowerupKind, number>> = {
  rapid: sec(20),
  spread: sec(20),
  sneakers: sec(20),
  cinnabomb: sec(6),
  juice: sec(12),
};

export interface TimedSlot {
  kind: PowerupKind;
  frames: number; // remaining
  total: number;
}

export interface PowerState {
  weapon: TimedSlot | null; // rapid | spread (only one at a time)
  speed: TimedSlot | null; // sneakers | juice (share the slot)
  invincible: TimedSlot | null; // cinnabomb
  armor: boolean; // vest or pretzel: absorbs one hit
  radar: boolean; // rest of level; survives death
}

export function emptyPower(): PowerState {
  return { weapon: null, speed: null, invincible: null, armor: false, radar: false };
}

export const EXTRA_LIFE_SCORE = 20000;
export const START_LIVES = 3;
export const START_CONTINUES = 3;
export const MAX_LIVES = 9;

export interface Progress {
  seed: number;
  score: number;
  lives: number;
  continuesLeft: number;
  loop: number;
  blackFriday: boolean;
  /** Stores whose package was taken this level, in order. */
  packages: StoreId[];
  /** Open fixtures per store (fixture indices searched), persists for the level. */
  opened: Partial<Record<StoreId, number[]>>;
  /** Stores entered at least once this game (first-visit lines are once per GAME, not per level). */
  visited: StoreId[];
  gamestonkEggDone: boolean;
  photoStrip: boolean; // first photo-booth exit this game
  inventory: string[]; // joke items, "PHOTO STRIP", etc.
  power: PowerState;
  /** Frames the level has been running (advances in mall AND stores; stops in map/pause/continue). */
  levelFrames: number;
  extraLifeGiven: boolean;
  /** Frames used for the time bonus: same as levelFrames. */
}

export function newProgress(seed: number, blackFriday = false): Progress {
  return {
    seed,
    score: 0,
    lives: START_LIVES,
    continuesLeft: START_CONTINUES,
    loop: 1,
    blackFriday,
    packages: [],
    opened: {},
    visited: [],
    gamestonkEggDone: false,
    photoStrip: false,
    inventory: [],
    power: emptyPower(),
    levelFrames: 0,
    extraLifeGiven: false,
  };
}

/** Reset for the next loop: score/lives/inventory/visited-lines kept; level state cleared; radar and food lost. */
export function nextLoop(p: Progress): void {
  p.loop += 1;
  p.packages = [];
  p.opened = {};
  p.levelFrames = 0;
  p.power = emptyPower();
}

export function packagesLeft(p: Progress): number {
  return PACKAGES_TOTAL - p.packages.length;
}

/** Add (or subtract) points. Score never drops below 0. Awards the single 20,000-point extra life. Returns true if a life was granted. */
export function addScore(p: Progress, n: number, sink?: EventSink): boolean {
  p.score = Math.max(0, p.score + n);
  if (!p.extraLifeGiven && p.score >= EXTRA_LIFE_SCORE) {
    p.extraLifeGiven = true;
    p.lives = Math.min(MAX_LIVES, p.lives + 1);
    sink?.push({ t: 'sfx', name: 'extraLife' });
    sink?.push({ t: 'banner', lines: ['EXTRA LIFE!'], kind: 'item' });
    return true;
  }
  return false;
}

export function addLife(p: Progress): void {
  p.lives = Math.min(MAX_LIVES, p.lives + 1);
}

/** Apply a power-up. Returns the points awarded (50 each, 1-up too; 0 for joke items handled elsewhere). */
export function applyPowerup(p: Progress, kind: PowerupKind, sink?: EventSink): void {
  const pw = p.power;
  const dur = POWERUP_DURATION[kind] ?? 0;
  switch (kind) {
    case 'rapid':
    case 'spread':
      pw.weapon = { kind, frames: dur, total: dur };
      break;
    case 'sneakers':
    case 'juice':
      pw.speed = { kind, frames: dur, total: dur };
      break;
    case 'cinnabomb':
      pw.invincible = { kind, frames: dur, total: dur };
      break;
    case 'armor':
    case 'pretzel':
      pw.armor = true;
      break;
    case 'radar':
      pw.radar = true;
      break;
    case 'oneup':
      addLife(p);
      sink?.push({ t: 'sfx', name: 'extraLife' });
      break;
  }
  sink?.push({ t: 'sfx', name: 'powerup' });
  addScore(p, 50, sink);
}

/** Advance power-up timers by one frame. Call once per unpaused simulation frame (mall AND store). */
export function tickPower(p: Progress): void {
  const pw = p.power;
  for (const k of ['weapon', 'speed', 'invincible'] as const) {
    const s = pw[k];
    if (s) {
      s.frames--;
      if (s.frames <= 0) pw[k] = null;
    }
  }
}

/** Per-level clock. Call once per unpaused simulation frame. */
export function tickLevelClock(p: Progress): void {
  p.levelFrames++;
}

/** On death everything is lost except Radar. */
export function loseOnDeath(p: Progress): void {
  const radar = p.power.radar;
  p.power = emptyPower();
  p.power.radar = radar;
}

/** A continue: 3 fresh lives, score/packages/loop kept, power-ups reset (radar too). Returns false if none left. */
export function useContinue(p: Progress): boolean {
  if (p.continuesLeft <= 0) return false;
  p.continuesLeft--;
  p.lives = START_LIVES;
  p.power = emptyPower();
  return true;
}

/** Absorb a hit with armour if present. Returns true if the hit was absorbed. */
export function absorbHit(p: Progress): boolean {
  if (p.power.armor) {
    p.power.armor = false;
    return true;
  }
  return false;
}

export function isInvincible(p: Progress): boolean {
  return p.power.invincible !== null;
}

/** Walk speed multiplier from the speed slot: sneakers 1.35x, juice 1.5x. */
export function walkSpeedMul(p: Progress): number {
  const s = p.power.speed;
  return s ? (s.kind === 'juice' ? 1.5 : 1.35) : 1;
}

export const TIME_BONUS_BASE_SECONDS = 300;
export const LEVEL_CLEAR_BONUS = 1000;
/** 10 points per second under 300 s. */
export function timeBonus(levelFrames: number): number {
  return Math.max(0, Math.floor((TIME_BONUS_BASE_SECONDS * 60 - levelFrames) / 60)) * 10;
}
