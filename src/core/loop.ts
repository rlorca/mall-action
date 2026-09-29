import { FPS } from './constants';

export const STEP_MS = 1000 / FPS;
/** If the browser stalls (tab hidden, GC pause) we cap catch-up rather than
 *  spiral-of-death through hundreds of steps. */
export const MAX_CATCHUP_STEPS = 5;

/**
 * Fixed 60 Hz accumulator, decoupled from rendering.
 *
 * Pure: it has no timer of its own. Call advance() with a wall-clock delta and
 * it tells you how many simulation steps to run. Tested without a browser.
 */
export class FixedLoop {
  private accumulator = 0;
  /** Steps dropped because of the catch-up cap; useful for diagnostics. */
  droppedSteps = 0;

  /**
   * @param deltaMs elapsed wall time since the previous call
   * @returns the number of simulation steps to run now (0..MAX_CATCHUP_STEPS)
   */
  advance(deltaMs: number): number {
    // Guard against negative or absurd deltas (clock changes, first frame).
    if (!Number.isFinite(deltaMs) || deltaMs < 0) deltaMs = 0;
    if (deltaMs > 1000) deltaMs = 1000;

    this.accumulator += deltaMs;
    let steps = Math.floor(this.accumulator / STEP_MS);
    if (steps <= 0) return 0;

    this.accumulator -= steps * STEP_MS;

    if (steps > MAX_CATCHUP_STEPS) {
      this.droppedSteps += steps - MAX_CATCHUP_STEPS;
      steps = MAX_CATCHUP_STEPS;
      // Drop the backlog entirely; we are not going to catch up on it.
      this.accumulator = 0;
    }
    return steps;
  }

  /** Fraction through the current step, for interpolated rendering. */
  get alpha(): number {
    return this.accumulator / STEP_MS;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
