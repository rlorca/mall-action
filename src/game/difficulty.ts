// Loop-based difficulty scaling. Pure functions. All values are capped.
export const FPS = 60;
export const sec = (s: number): number => Math.round(s * FPS);

export interface Difficulty {
  loop: number;
  spySpeedMul: number; // +10% per loop, cap 1.6
  spawnRateMul: number; // +15% per loop, cap 2.5 (higher = more frequent)
  shootRateMul: number; // +15% per loop, cap 2.5
  /** Base frames between spy shots on this loop (loop 1 = 150 = 2.5s), never below MIN_SHOT_INTERVAL. */
  shotIntervalFrames: number;
  alarmFrames: number; // 150s on loop 1, 20s sooner each loop, floor 45s
  spyCap: number; // 4, or 8 in Black Friday
  blackFriday: boolean;
}

export const MIN_SHOT_INTERVAL = 60; // "never more often than once a second"
export const BASE_SHOT_INTERVAL = 150; // 2.5 s
export const ALARM_SPEEDUP = 1.25; // spies ~25% faster once alarm is on

export function difficulty(loop: number, blackFriday = false): Difficulty {
  const n = Math.max(0, loop - 1);
  const spySpeedMul = Math.min(1.6, 1 + 0.1 * n);
  const spawnRateMul = Math.min(2.5, Math.pow(1.15, n)) * (blackFriday ? 2 : 1);
  const shootRateMul = Math.min(2.5, Math.pow(1.15, n));
  return {
    loop,
    spySpeedMul,
    spawnRateMul,
    shootRateMul,
    shotIntervalFrames: Math.max(MIN_SHOT_INTERVAL, Math.round(BASE_SHOT_INTERVAL / shootRateMul)),
    alarmFrames: sec(Math.max(45, 150 - 20 * n)),
    spyCap: blackFriday ? 8 : 4,
    blackFriday,
  };
}
