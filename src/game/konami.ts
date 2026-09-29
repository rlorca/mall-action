/** Konami code detection on the title screen. Extra leading presses (e.g. more Ups) still match. */
import type { Button } from '../core/input';

export const KONAMI: readonly Button[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

export class KonamiDetector {
  private buf: Button[] = [];
  /** Feed one button press; returns true when the code has just been completed. */
  push(b: Button): boolean {
    this.buf.push(b);
    if (this.buf.length > KONAMI.length) this.buf.shift();
    if (this.buf.length < KONAMI.length) return false;
    const ok = this.buf.every((x, i) => x === KONAMI[i]);
    if (ok) this.buf = [];
    return ok;
  }
  reset(): void {
    this.buf = [];
  }
}
