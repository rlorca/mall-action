/** Fixed 60 Hz simulation clock, decoupled from rendering. */
export const FPS = 60;
export const STEP_MS = 1000 / FPS;
/** If the browser falls behind, run at most this many catch-up steps per rendered frame. */
export const MAX_STEPS_PER_FRAME = 5;

export class FixedLoop {
  private acc = 0;
  constructor(readonly maxSteps = MAX_STEPS_PER_FRAME) {}

  /** Feed elapsed real time (ms). Returns how many simulation steps to run now. */
  advance(dtMs: number): number {
    if (!(dtMs > 0)) return 0;
    this.acc += Math.min(dtMs, 1000);
    let n = Math.floor(this.acc / STEP_MS);
    if (n > this.maxSteps) {
      n = this.maxSteps;
      this.acc = 0; // drop the backlog instead of spiralling
    } else {
      this.acc -= n * STEP_MS;
    }
    return n;
  }

  reset(): void {
    this.acc = 0;
  }
}
