/**
 * Fixed-step loop: the simulation runs at exactly 60 Hz regardless of the
 * display refresh rate. Rendering is decoupled (render once per animation frame
 * after `advance`). If the browser falls behind, catch-up is capped and the
 * remaining backlog is dropped so the game never spirals.
 */
export const STEP_MS = 1000 / 60;
export const MAX_CATCHUP_STEPS = 5;

export class FixedStepLoop {
  private acc = 0;
  /** Total steps ever run (frame counter, handy in tests). */
  steps = 0;

  constructor(
    private readonly step: () => void,
    readonly stepMs: number = STEP_MS,
    readonly maxSteps: number = MAX_CATCHUP_STEPS,
  ) {}

  /** Feed elapsed wall-clock ms; runs 0..maxSteps simulation steps. Returns how many ran. */
  advance(elapsedMs: number): number {
    if (!(elapsedMs > 0)) return 0;
    this.acc += Math.min(elapsedMs, 250);
    let n = 0;
    while (this.acc >= this.stepMs && n < this.maxSteps) {
      this.acc -= this.stepMs;
      this.step();
      this.steps++;
      n++;
    }
    // Dropped backlog: never carry more than one step of leftover.
    if (this.acc >= this.stepMs) this.acc = this.acc % this.stepMs;
    return n;
  }

  reset(): void {
    this.acc = 0;
  }
}
