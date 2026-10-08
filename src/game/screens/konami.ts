import { Btn } from '../../engine/pad';

/** UP UP DOWN DOWN LEFT RIGHT LEFT RIGHT B A. */
export const KONAMI_CODE: readonly number[] = [
  Btn.UP,
  Btn.UP,
  Btn.DOWN,
  Btn.DOWN,
  Btn.LEFT,
  Btn.RIGHT,
  Btn.LEFT,
  Btn.RIGHT,
  Btn.B,
  Btn.A,
];

/**
 * Pure Konami-code detector. Feed it `pad.pressed` (rising edges) once per step.
 *
 * It keeps the last 10 button presses and fires when they equal the code exactly (a sliding
 * window), so extra leading Ups (UP UP UP DOWN ...) still work and any unrelated press simply
 * pushes the old sequence out of the window (no hand-written reset logic to get wrong).
 * A step where several buttons go down at once pushes that whole mask as one entry, which never
 * equals a single-button code entry, so chords break a sequence in progress.
 */
export class KonamiDetector {
  private readonly buf: number[] = [];

  /** Returns true on the step the code is completed. The window is cleared after a hit. */
  feed(pressed: number): boolean {
    if (pressed === 0) return false;
    this.buf.push(pressed);
    if (this.buf.length > KONAMI_CODE.length) this.buf.shift();
    if (this.buf.length === KONAMI_CODE.length && this.buf.every((b, i) => b === KONAMI_CODE[i])) {
      this.buf.length = 0;
      return true;
    }
    return false;
  }

  /** How many of the most recent presses form a correct prefix of the code (for UI hints / tests). */
  get progress(): number {
    for (let n = Math.min(this.buf.length, KONAMI_CODE.length - 1); n > 0; n--) {
      let ok = true;
      for (let i = 0; i < n; i++) {
        if (this.buf[this.buf.length - n + i] !== KONAMI_CODE[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return n;
    }
    return 0;
  }

  reset(): void {
    this.buf.length = 0;
  }
}
