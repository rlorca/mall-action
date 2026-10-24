import { STEP_MS, MAX_CATCHUP } from "./constants.js";

/** Fixed-timestep accumulator, independent from requestAnimationFrame/rendering. */
export class FixedStepLoop {
  constructor(stepMs = STEP_MS, maxCatchup = MAX_CATCHUP) {
    this.stepMs = stepMs; this.maxCatchup = maxCatchup; this.accumulator = 0;
  }
  advance(deltaMs, step) {
    this.accumulator += Math.min(250, Math.max(0, deltaMs));
    let steps = 0;
    while (this.accumulator >= this.stepMs && steps < this.maxCatchup) {
      step(); this.accumulator -= this.stepMs; steps++;
    }
    if (steps === this.maxCatchup && this.accumulator >= this.stepMs) this.accumulator %= this.stepMs;
    return steps;
  }
}

export function integerScale(width, height, availableWidth, availableHeight) {
  return Math.max(1, Math.floor(Math.min(availableWidth / width, availableHeight / height)));
}
