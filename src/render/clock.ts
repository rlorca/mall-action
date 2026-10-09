/**
 * Visual timing must not depend on the display's refresh rate (a 120 Hz monitor draws twice as often as a 60 Hz one).
 * Every animation, blink and on-screen timer is therefore measured in SIMULATION frames (60 per second), never in
 * "number of draws". `SimClock` turns the simulation frame counter into "how many sim frames since the last draw".
 */
export class SimClock {
  private last = -1;
  /** Sim frames elapsed since the previous call (0 when the simulation did not advance; capped at 8). */
  dt(simFrame: number): number {
    const d = this.last < 0 ? 0 : Math.max(0, Math.min(8, simFrame - this.last));
    this.last = simFrame;
    return d;
  }
}

/** A countdown measured in sim frames. */
export class Countdown {
  constructor(public left: number) {}
  /** Advance by `dt` sim frames; true while still running. */
  tick(dt: number): boolean {
    this.left -= dt;
    return this.left > 0;
  }
}
