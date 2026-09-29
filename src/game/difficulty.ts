/**
 * Loop difficulty. Every loop: spies ~10% faster, appear ~15% more often, shoot ~15% more often,
 * and the alarm comes ~20 s sooner. All capped. Units: frames and px/frame.
 */
export const LOOP_CAP = 6;
const L = (loop: number) => Math.min(Math.max(1, loop), LOOP_CAP) - 1;

export function spySpeed(loop: number): number {
  return Math.min(0.62 * Math.pow(1.1, L(loop)), 1.0);
}
/** Frames between spy spawns. */
export function spawnInterval(loop: number, blackFriday = false): number {
  const base = Math.max(300 / Math.pow(1.15, L(loop)), 150);
  return Math.round(blackFriday ? base / 2 : base);
}
/** Frames between a spy's shots (never more often than once a second). */
export function shotInterval(loop: number): number {
  return Math.round(Math.max(150 / Math.pow(1.15, L(loop)), 60));
}
/** Frames after which the alarm goes off. */
export function alarmFrames(loop: number): number {
  return Math.max(150 - 20 * L(loop), 60) * 60;
}
export function maxSpies(blackFriday = false): number {
  return blackFriday ? 8 : 4;
}
export const ALARM_SPEED = 1.25;
export const ALARM_SPAWN = 0.65;
/** Frames before the first spy on a level. */
export const FIRST_SPAWN = 300;
/** A spy's first shot comes no sooner than this after it appears (the aim pose comes on top). */
export const FIRST_SHOT_DELAY = 120;
/** Length of the aiming pose (telegraph) before a shot. */
export const AIM_FRAMES = 30;
/** Chance that a spy ducks a volley (decided once per volley). */
export const DODGE_CHANCE = 0.1;
