import type { ButtonName } from './pad';

const SEQ: readonly ButtonName[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

// KMP failure table so repeated prefixes (extra Ups) never break detection.
const FAIL: number[] = (() => {
  const f = new Array<number>(SEQ.length).fill(0);
  for (let i = 1, k = 0; i < SEQ.length; i++) {
    while (k > 0 && SEQ[i] !== SEQ[k]) k = f[k - 1];
    if (SEQ[i] === SEQ[k]) k++;
    f[i] = k;
  }
  return f;
})();

/** Feed button PRESSES (rising edges). Returns true once when Up Up Down Down Left Right Left Right B A completes. */
export class KonamiDetector {
  private pos = 0;
  feed(button: ButtonName): boolean {
    while (this.pos > 0 && SEQ[this.pos] !== button) this.pos = FAIL[this.pos - 1];
    if (SEQ[this.pos] === button) this.pos++;
    if (this.pos === SEQ.length) {
      this.pos = 0;
      return true;
    }
    return false;
  }
  reset(): void {
    this.pos = 0;
  }
}
