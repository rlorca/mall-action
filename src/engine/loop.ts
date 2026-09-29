import { FPS } from './types';

export class GameLoop {
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly stepMs: number = 1000 / FPS;
  private readonly maxSteps: number = 5;
  private running: boolean = false;
  private rafId: number = 0;

  constructor(
    private onStep: (dt: number) => void,
    private onRender: (alpha: number) => void
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private tick = (time: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const elapsed = time - this.lastTime;
    this.lastTime = time;
    this.accumulator += Math.min(elapsed, this.stepMs * this.maxSteps);

    let steps = 0;
    while (this.accumulator >= this.stepMs && steps < this.maxSteps) {
      this.onStep(this.stepMs);
      this.accumulator -= this.stepMs;
      steps++;
    }

    const alpha = this.accumulator / this.stepMs;
    this.onRender(alpha);
  };

  isRunning(): boolean {
    return this.running;
  }
}

export function stepFrames(
  update: () => void,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    update();
  }
}
