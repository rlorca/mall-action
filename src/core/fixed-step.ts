import { FRAME_MS, MAX_STEPS_PER_TICK } from './constants';

/**
 * Turns real elapsed time into a whole number of 60 Hz simulation steps.
 * Rendering happens once per browser frame, independently of this.
 * If the browser falls far behind, the backlog is dropped instead of spiralling.
 */
export class FixedStepClock {
  private acc = 0;

  constructor(private readonly maxSteps = MAX_STEPS_PER_TICK) {}

  advance(elapsedMs: number): number {
    // Ignore absurd gaps (tab switch, debugger pause) entirely.
    this.acc += Math.min(Math.max(elapsedMs, 0), 250);
    let steps = 0;
    while (this.acc >= FRAME_MS && steps < this.maxSteps) {
      this.acc -= FRAME_MS;
      steps++;
    }
    if (this.acc >= FRAME_MS) this.acc = 0; // capped: drop the rest of the backlog
    return steps;
  }

  reset(): void {
    this.acc = 0;
  }
}
