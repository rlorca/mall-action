// Fixed-timestep engine: whole 60 Hz simulation steps, decoupled rendering, capped catch-up.
export const STEP_MS = 1000 / 60;

export interface LoopOptions {
  /** Max simulation steps per rendered frame; excess time is dropped (no death spiral). */
  maxStepsPerFrame?: number;
  /** Real-time gaps larger than this (ms, e.g. tab was hidden) are treated as this long. */
  maxDeltaMs?: number;
}

export class FixedLoop {
  private acc = 0;
  private last: number | null = null;
  private raf = 0;
  private running = false;
  readonly maxSteps: number;
  readonly maxDelta: number;
  /** Total simulation steps executed (handy for tests / diagnostics). */
  totalSteps = 0;

  constructor(
    private readonly step: () => void,
    private readonly render: (alpha: number) => void,
    opts: LoopOptions = {},
  ) {
    this.maxSteps = opts.maxStepsPerFrame ?? 5;
    this.maxDelta = opts.maxDeltaMs ?? 250;
  }

  /** Pure: accumulate dtMs, run whole steps (capped), return how many ran. Does not render. */
  advance(dtMs: number): number {
    if (!Number.isFinite(dtMs) || dtMs < 0) dtMs = 0;
    this.acc += Math.min(dtMs, this.maxDelta);
    let n = 0;
    while (this.acc >= STEP_MS - 1e-9 && n < this.maxSteps) {
      this.acc -= STEP_MS;
      this.step();
      n++;
    }
    if (this.acc >= STEP_MS - 1e-9) this.acc = 0; // cap hit: drop the backlog
    if (this.acc < 0) this.acc = 0;
    this.totalSteps += n;
    return n;
  }

  /** Process one rendered frame at the given timestamp (ms). Returns steps run. */
  frame(nowMs: number): number {
    const dt = this.last === null ? 0 : nowMs - this.last;
    this.last = nowMs;
    const n = this.advance(dt);
    this.render(this.acc / STEP_MS);
    return n;
  }

  /** Forget the previous timestamp (call when resuming from hidden state). */
  resetClock(): void {
    this.last = null;
    this.acc = 0;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = null;
    const tick = (t: number): void => {
      if (!this.running) return;
      this.frame(t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
