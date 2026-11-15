/**
 * Fixed-step loop: the simulation runs at exactly 60 Hz regardless of the
 * display refresh rate. Rendering is decoupled (render once per animation frame
 * after `advance`). If the browser falls behind, catch-up is capped and the
 * remaining backlog is dropped so the game never spirals.
 */
export const STEP_MS = 1000 / 60;
export const MAX_CATCHUP_STEPS = 5;
export class FixedStepLoop {
    step;
    stepMs;
    maxSteps;
    acc = 0;
    /** Total steps ever run (frame counter, handy in tests). */
    steps = 0;
    constructor(step, stepMs = STEP_MS, maxSteps = MAX_CATCHUP_STEPS) {
        this.step = step;
        this.stepMs = stepMs;
        this.maxSteps = maxSteps;
    }
    /** Feed elapsed wall-clock ms; runs 0..maxSteps simulation steps. Returns how many ran. */
    advance(elapsedMs) {
        if (!(elapsedMs > 0))
            return 0;
        this.acc += Math.min(elapsedMs, 250);
        let n = 0;
        while (this.acc >= this.stepMs && n < this.maxSteps) {
            this.acc -= this.stepMs;
            this.step();
            this.steps++;
            n++;
        }
        // Dropped backlog: never carry more than one step of leftover.
        if (this.acc >= this.stepMs)
            this.acc = this.acc % this.stepMs;
        return n;
    }
    reset() {
        this.acc = 0;
    }
}
