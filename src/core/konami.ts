import { Button } from './input';

/** Up Up Down Down Left Right Left Right B A */
export const KONAMI_SEQUENCE: readonly Button[] = [
  Button.Up,
  Button.Up,
  Button.Down,
  Button.Down,
  Button.Left,
  Button.Right,
  Button.Left,
  Button.Right,
  Button.B,
  Button.A,
];

/**
 * Konami code detector.
 *
 * Must still fire with extra LEADING presses of Up: pressing Up five times and
 * then the rest of the code counts. The trick is that on a mismatch we do not
 * reset to zero but retry the failed press against the start of the sequence,
 * which is exactly what a prefix-function / KMP style fallback does. With a
 * sequence starting UP UP, an extra Up keeps the matcher parked at index 2.
 */
export class KonamiDetector {
  private index = 0;

  /** Feed one button press. Returns true on the press that completes the code. */
  push(button: Button): boolean {
    // Directions/A/B only; anything else is ignored rather than resetting, so
    // a stray Start on the title screen does not cancel a code in progress.
    if (!KONAMI_SEQUENCE.includes(button)) return false;

    if (button === KONAMI_SEQUENCE[this.index]) {
      this.index++;
    } else {
      // Fall back to the longest prefix of the sequence that still matches,
      // ending with this press. For UUDDLRLRBA the only non-trivial case is a
      // repeated leading Up, which keeps us at index 2.
      this.index = this.longestFallback(button);
    }

    if (this.index >= KONAMI_SEQUENCE.length) {
      this.index = 0;
      return true;
    }
    return false;
  }

  private longestFallback(button: Button): number {
    // Try progressively shorter prefixes of what we had matched, then the
    // fresh start. `k` is the candidate length of matched prefix before this
    // press.
    for (let k = this.index - 1; k >= 0; k--) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (KONAMI_SEQUENCE[i] !== KONAMI_SEQUENCE[this.index - k + i]) {
          ok = false;
          break;
        }
      }
      if (ok && KONAMI_SEQUENCE[k] === button) return k + 1;
    }
    return KONAMI_SEQUENCE[0] === button ? 1 : 0;
  }

  reset(): void {
    this.index = 0;
  }

  get progress(): number {
    return this.index;
  }
}
