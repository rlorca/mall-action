import type { Pad } from './input';

const CODE: readonly Pad[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

/**
 * Matches the Konami code as a suffix of the recent press history, so extra
 * leading presses (for example, several Ups before the code) still count.
 */
export class KonamiDetector {
  private history: Pad[] = [];

  /** Feed one press. Returns true exactly when the code has just been completed. */
  press(pad: Pad): boolean {
    this.history.push(pad);
    if (this.history.length > CODE.length) this.history.shift();
    const hit = this.history.length === CODE.length && CODE.every((p, i) => this.history[i] === p);
    if (hit) this.history = [];
    return hit;
  }

  reset(): void {
    this.history = [];
  }
}
