import { Button } from './pad';

export const KONAMI: readonly Button[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

/**
 * Tracks the last N presses; it fires when the most recent presses END with the Konami sequence,
 * so extra leading Ups (UUUU-UU-DD...) still count.
 */
export class KonamiDetector {
  private recent: Button[] = [];
  /** Feed one fresh press. Returns true the moment the code is completed. */
  push(b: Button): boolean {
    this.recent.push(b);
    if (this.recent.length > 32) this.recent.shift();
    const n = KONAMI.length;
    if (this.recent.length < n) return false;
    const tail = this.recent.slice(-n);
    const ok = tail.every((v, i) => v === KONAMI[i]);
    if (ok) this.recent = [];
    return ok;
  }
  reset(): void {
    this.recent = [];
  }
}
