// Pure rules for NPCs and spy fairness. Used by the mall world and tested directly.
import { SEC, SHAFTS, SHAFT_W } from '../core/constants';
import type { Rng } from '../core/rng';
import { STORES } from './layout';

// ---- Spy fairness ----------------------------------------------------------
export const SPY_FIRST_SHOT_MIN_FRAMES = 2 * SEC; // first shot no sooner than ~2 s after appearing
export const SPY_TELEGRAPH_FRAMES = Math.round(SEC / 2); // clear aiming pose before every shot
export const SPY_DODGE_CHANCE = 0.1; // a spy ducks an incoming volley with 10%, decided once per volley
export const SPY_DUCK_FRAMES = 12;

/** Whether a spy that has existed `age` frames may fire yet. */
export function spyMayFire(age: number): boolean {
  return age >= SPY_FIRST_SHOT_MIN_FRAMES;
}

/** One dodge roll per volley. A spy that already rolled for this volley keeps its result. */
export function rollVolleyDodge(rng: Rng, lastVolleyRolled: number, volleyId: number): { rolled: boolean; ducks: boolean } {
  if (lastVolleyRolled === volleyId) return { rolled: false, ducks: false };
  return { rolled: true, ducks: rng.chance(SPY_DODGE_CHANCE) };
}

// ---- Wet floor (janitor) ---------------------------------------------------
export const WET_PATCH_W = 48;
export const WET_PATCH_FRAMES = 10 * SEC;
export const MOP_INTERVAL_FRAMES = 8 * SEC;

/** The floor-level x range a wet patch would cover if the janitor mopped at `x`. */
export function wetPatchAt(x: number): { x0: number; x1: number } {
  return { x0: x - WET_PATCH_W / 2, x1: x + WET_PATCH_W / 2 };
}

/** A patch may never reach a shaft opening on its floor (the janitor then skips mopping). */
export function patchReachesShaft(x0: number, x1: number, floor: number): boolean {
  return SHAFTS.some((s) => {
    const serves = floor >= s.minFloor && floor <= s.maxFloor;
    return serves && x1 > s.x && x0 < s.x + SHAFT_W;
  });
}

// ---- Mall cop --------------------------------------------------------------
export const COP_SHOT_RANGE = 128;
export const COP_CHASE_FRAMES = 10 * SEC;
export const COP_FREEZE_FRAMES = 3 * SEC;

/**
 * Whether a shot fired by the player triggers the cop: same floor, the cop faces the shooter,
 * and the shot is within range in front of him.
 */
export function copSpotsShot(cop: { x: number; floor: number; facing: -1 | 1 }, shot: { x: number; floor: number }): boolean {
  if (cop.floor !== shot.floor) return false;
  const dx = shot.x - cop.x;
  const inFront = Math.sign(dx) === cop.facing;
  return inFront && Math.abs(dx) <= COP_SHOT_RANGE;
}

// ---- Kiosk -----------------------------------------------------------------
export const KIOSK_COOLDOWN_FRAMES = 20 * SEC;
export const KIOSK_SHOW_FRAMES = 3 * SEC;

/** Nearest store that still holds a package, measured in floors then pixels, or null. */
export function nearestPackageStore(from: { x: number; floor: number }, remaining: ReadonlySet<string>): string | null {
  let best: { id: string; score: number } | null = null;
  for (const s of STORES) {
    if (!remaining.has(s.id)) continue;
    const score = Math.abs(s.floor - from.floor) * 1000 + Math.abs(s.x + 40 - from.x);
    if (!best || score < best.score) best = { id: s.id, score };
  }
  return best?.id ?? null;
}

// ---- Walkers ---------------------------------------------------------------
export const WALKER_SPEED = 0.5;
export const WALKER_PUSH = 0.5;

