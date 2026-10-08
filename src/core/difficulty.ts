// Loop scaling. Pure. Every multiplier is capped so late loops stay playable.
import { SEC } from './constants';

export interface Difficulty {
  loop: number;
  spySpeed: number; // multiplier on spy walk speed
  spawnRate: number; // multiplier on spy spawn frequency
  fireRate: number; // multiplier on spy shot frequency
  alarmAtSec: number;
  maxSpies: number;
  shotIntervalFrames: number;
}

const MAX_LOOP_FOR_SCALING = 8;

export function difficultyFor(loop: number, blackFriday = false): Difficulty {
  const n = Math.min(Math.max(loop, 1), MAX_LOOP_FOR_SCALING) - 1;
  const spySpeed = Math.min(1 + 0.1 * n, 1.8);
  const spawnRate = Math.min(1 + 0.15 * n, 2.2);
  const fireRate = Math.min(1 + 0.15 * n, 2.0);
  const base = 2.5 * SEC; // 2.5 s between spy shots on loop 1
  const shotInterval = Math.max(SEC, Math.round(base / fireRate));
  const alarm = Math.max(60 * SEC, 150 * SEC - 20 * SEC * n);
  return {
    loop,
    spySpeed,
    spawnRate: spawnRate * (blackFriday ? 2 : 1),
    fireRate,
    alarmAtSec: alarm / SEC,
    maxSpies: 4 * (blackFriday ? 2 : 1),
    shotIntervalFrames: shotInterval,
  };
}
