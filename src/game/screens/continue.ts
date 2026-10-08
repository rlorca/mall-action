import type { Pad } from '../../engine/pad';
import { Btn } from '../../engine/pad';
import type { MusicId, SfxId } from '../../audio/ids';
import type { Screen } from './screen';

/** Seconds on the clock when the screen opens. */
export const CONTINUE_SECONDS = 9;
/** Sim frames per displayed number. */
export const CONTINUE_FRAMES_PER_COUNT = 60;
/** Total frames until the clock runs out. */
export const CONTINUE_TOTAL_FRAMES = CONTINUE_SECONDS * CONTINUE_FRAMES_PER_COUNT;
/** The number turns red at this value and below. */
export const CONTINUE_RED_AT = 3;

export type ContinueResult = 'continue' | 'gameover';

/**
 * CONTINUE? screen: a BIG countdown from 9 (60 frames per number), one 'beep' per number,
 * red at 3 or below. Start => `result === 'continue'` (the Game spends the continue and gives 3 fresh
 * lives); the clock reaching 0 => `result === 'gameover'`. The Game reads `result` when `done`.
 */
export class ContinueScreen implements Screen {
  readonly continuesLeft: number;
  private _frame = 0;
  private _result: ContinueResult | null = null;
  private sfx: SfxId[] = ['beep'];

  constructor(opts: { continuesLeft: number }) {
    this.continuesLeft = opts.continuesLeft;
  }

  get frame(): number {
    return this._frame;
  }

  /** null while the clock is running. */
  get result(): ContinueResult | null {
    return this._result;
  }

  get done(): boolean {
    return this._result !== null;
  }

  /** The displayed number, 9 down to 0. */
  get count(): number {
    return Math.max(0, CONTINUE_SECONDS - Math.floor(this._frame / CONTINUE_FRAMES_PER_COUNT));
  }

  /** Frame inside the current second (0..59): drives the pulse of the big digit. */
  get tick(): number {
    return this._frame % CONTINUE_FRAMES_PER_COUNT;
  }

  get urgent(): boolean {
    return this.count <= CONTINUE_RED_AT;
  }

  step(pad: Pad): void {
    if (this._result) return;
    if (pad.pressed & Btn.START) {
      this._result = 'continue';
      this.sfx.push('select');
      return;
    }
    this._frame++;
    if (this._frame >= CONTINUE_TOTAL_FRAMES) {
      this._result = 'gameover';
      this.sfx.push('buzzer');
      return;
    }
    if (this._frame % CONTINUE_FRAMES_PER_COUNT === 0) this.sfx.push('beep');
  }

  music(): MusicId | null {
    return 'continue';
  }

  drainSfx(): SfxId[] {
    const q = this.sfx;
    this.sfx = [];
    return q;
  }
}
