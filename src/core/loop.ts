/** Fixed 60 Hz simulation accumulator. Rendering is decoupled; catch-up is capped. */
export const STEP_MS = 1000 / 60;
export const MAX_CATCHUP = 5;

export class FixedLoop {
  private acc = 0;
  constructor(readonly stepMs = STEP_MS, readonly maxSteps = MAX_CATCHUP) {}
  /** Feed elapsed real time; returns how many simulation steps to run now. */
  advance(dtMs: number): number {
    if (!(dtMs > 0)) return 0;
    this.acc += dtMs;
    let n = Math.floor(this.acc / this.stepMs + 1e-9);
    if (n > this.maxSteps) {
      // The browser fell behind: drop the backlog instead of spiralling.
      n = this.maxSteps;
      this.acc = 0;
    } else {
      this.acc -= n * this.stepMs;
    }
    return n;
  }
  reset(): void {
    this.acc = 0;
  }
}
