/**
 * Difficulty scaling per loop (1-based). Each loop: spies ~10% faster, ~15% more
 * frequent, ~15% more trigger-happy, alarm ~20 s sooner. Everything is capped.
 */
export const FPS = 60;

export interface Difficulty {
  /** Spy walking speed in px/frame. */
  spySpeed: number;
  /** Multiplier on how often spies spawn. */
  spawnRate: number;
  /** Frames between a spy's shots (never below MIN_SHOT_INTERVAL). */
  shotInterval: number;
  /** Frames into the level before the alarm goes off. */
  alarmFrames: number;
  /** Max spies on screen. */
  spyCap: number;
}

export const BASE_SPY_SPEED = 0.8;
export const BASE_SHOT_INTERVAL = Math.round(2.5 * FPS);
export const MIN_SHOT_INTERVAL = FPS; // never more often than once a second
export const BASE_ALARM_SECONDS = 150;
export const MIN_ALARM_SECONDS = 70;
export const ALARM_SPEED_BONUS = 1.25;
export const ALARM_SPAWN_BONUS = 1.5;

export function difficulty(loop: number, blackFriday = false): Difficulty {
  const n = Math.max(0, loop - 1);
  const spySpeed = Math.min(BASE_SPY_SPEED * Math.pow(1.1, n), BASE_SPY_SPEED * 1.8);
  const spawn = Math.min(Math.pow(1.15, n), 2.5);
  const fire = Math.min(Math.pow(1.15, n), 2.2);
  const shotInterval = Math.max(MIN_SHOT_INTERVAL, Math.round(BASE_SHOT_INTERVAL / fire));
  const alarmSeconds = Math.max(MIN_ALARM_SECONDS, BASE_ALARM_SECONDS - 20 * n);
  return {
    spySpeed,
    spawnRate: spawn * (blackFriday ? 2 : 1),
    shotInterval,
    alarmFrames: alarmSeconds * FPS,
    spyCap: blackFriday ? 8 : 4,
  };
}
