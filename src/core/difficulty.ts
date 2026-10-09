/** Difficulty scaling per loop. Every factor is capped so late loops stay survivable. */
export interface Difficulty {
  loop: number;
  /** Spy walking speed in px/frame (before alarm bonus). */
  spySpeed: number;
  /** Frames between spy spawn attempts. */
  spawnEvery: number;
  /** Frames between a spy's volleys (never below 60). */
  fireEvery: number;
  /** Frames on the level before the alarm sounds. */
  alarmAt: number;
  spyCap: number;
}

export const BASE = {
  spySpeed: 0.75,
  spawnEvery: 420,
  fireEvery: 150, // ~2.5 s
  alarmAt: 150 * 60,
  spyCap: 4,
};
export const MIN_FIRE_EVERY = 60; // never more often than once a second
export const MAX_SPY_SPEED_MUL = 1.8;
export const MIN_SPAWN_EVERY = 150;
export const MIN_ALARM_AT = 45 * 60;

export function difficultyFor(loop: number, blackFriday = false): Difficulty {
  const n = Math.max(0, loop - 1);
  const spySpeed = BASE.spySpeed * Math.min(MAX_SPY_SPEED_MUL, Math.pow(1.1, n));
  let spawnEvery = Math.max(MIN_SPAWN_EVERY, BASE.spawnEvery / Math.pow(1.15, n));
  const fireEvery = Math.max(MIN_FIRE_EVERY, BASE.fireEvery / Math.pow(1.15, n));
  const alarmAt = Math.max(MIN_ALARM_AT, BASE.alarmAt - n * 20 * 60);
  let spyCap = BASE.spyCap;
  if (blackFriday) {
    spawnEvery = Math.max(MIN_SPAWN_EVERY / 2, spawnEvery / 2);
    spyCap *= 2;
  }
  return { loop, spySpeed, spawnEvery: Math.round(spawnEvery), fireEvery: Math.round(fireEvery), alarmAt: Math.round(alarmAt), spyCap };
}
