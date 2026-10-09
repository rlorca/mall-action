/**
 * Fixed-step loop: the simulation always advances in 1/60 s steps; rendering is decoupled.
 * `advance(dtMs)` returns how many simulation steps to run for this rendered frame,
 * capped so a slow tab can never spiral (death-spiral protection).
 */
export const STEP_MS = 1000 / 60;
export const MAX_CATCHUP_STEPS = 5;

export class FixedStepLoop {
  private acc = 0;
  /** Number of steps that were dropped by the catch-up cap (diagnostics only). */
  dropped = 0;
  constructor(
    readonly stepMs = STEP_MS,
    readonly maxSteps = MAX_CATCHUP_STEPS,
  ) {}

  advance(dtMs: number): number {
    if (!(dtMs > 0)) return 0;
    this.acc += Math.min(dtMs, 1000);
    let steps = 0;
    while (this.acc >= this.stepMs) {
      this.acc -= this.stepMs;
      steps++;
    }
    if (steps > this.maxSteps) {
      this.dropped += steps - this.maxSteps;
      steps = this.maxSteps;
      this.acc = 0;
    }
    return steps;
  }

  /** 0..1 progress to the next step (for optional interpolation). */
  get alpha(): number {
    return this.acc / this.stepMs;
  }

  reset(): void {
    this.acc = 0;
  }
}
