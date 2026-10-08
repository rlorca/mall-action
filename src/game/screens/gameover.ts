import type { Pad } from '../../engine/pad';
import { Btn } from '../../engine/pad';
import type { MusicId, SfxId } from '../../audio/ids';
import { UI } from '../../content/copy';
import type { Screen } from './screen';

/**
 * Game over timeline (60 Hz frames):
 *   0                PA chime
 *   TYPE1_AT ..      "ATTENTION SHOPPERS:" typewriter (one char per CHAR_FRAMES, a blip each)
 *   after a pause    "THE MALL IS NOW CLOSED" typewriter
 *   SHUTTER_AT ..    metal shutters roll down over the storefronts and the agent, floor by floor
 *   GAMEOVER_AT      "GAME OVER" + score + high score, the gameover jingle
 *   TIMEOUT          done on its own; Start finishes it earlier (after a short input grace)
 */
export const GO_CHAR_FRAMES = 3;
export const GO_TYPE1_AT = 40;
export const GO_TYPE2_AT = GO_TYPE1_AT + UI.closedLine1.length * GO_CHAR_FRAMES + 24;
export const GO_SHUTTER_AT = 120;
/** Frames one floor's shutter takes to roll down, and the delay between floors (top floor first). */
export const GO_SHUTTER_FRAMES = 84;
export const GO_SHUTTER_STAGGER = 30;
export const GO_FLOORS = 3;
export const GO_SHUTTERS_CLOSED_AT = GO_SHUTTER_AT + GO_SHUTTER_STAGGER * (GO_FLOORS - 1) + GO_SHUTTER_FRAMES;
export const GO_GAMEOVER_AT = GO_SHUTTERS_CLOSED_AT + 20;
export const GO_TIMEOUT = 10 * 60;
/** Start is ignored for this many frames so a carried-over button press cannot skip the screen. */
export const GO_INPUT_GRACE = 30;

export class GameOverScreen implements Screen {
  readonly score: number;
  readonly hiScore: number;
  private _frame = 0;
  private _done = false;
  private sfx: SfxId[] = ['paChime'];

  constructor(opts: { score: number; hiScore: number }) {
    this.score = opts.score;
    this.hiScore = opts.hiScore;
  }

  get frame(): number {
    return this._frame;
  }

  get done(): boolean {
    return this._done;
  }

  /** The visible part of the first / second typewriter line. */
  get line1(): string {
    return typed(UI.closedLine1, this._frame - GO_TYPE1_AT);
  }

  get line2(): string {
    return typed(UI.closedLine2, this._frame - GO_TYPE2_AT);
  }

  /** How far floor `f` (0 = top row) has its shutter down: 0 (open) .. 1 (closed). */
  shutter(f: number): number {
    const t = this._frame - GO_SHUTTER_AT - f * GO_SHUTTER_STAGGER;
    return Math.max(0, Math.min(1, t / GO_SHUTTER_FRAMES));
  }

  get showGameOver(): boolean {
    return this._frame >= GO_GAMEOVER_AT;
  }

  /** The score is at (or tied with) the high score and is worth a flourish. */
  get newRecord(): boolean {
    return this.score > 0 && this.score >= this.hiScore;
  }

  step(pad: Pad): void {
    if (this._done) return;
    if (this._frame >= GO_INPUT_GRACE && pad.pressed & Btn.START) {
      this._done = true;
      this.sfx.push('select');
      return;
    }
    const before = this._frame;
    this._frame++;
    const f = this._frame;
    if (f >= GO_TIMEOUT) {
      this._done = true;
      return;
    }
    // typewriter blips: one when a new non-space character appears
    for (const [text, at] of [
      [UI.closedLine1, GO_TYPE1_AT],
      [UI.closedLine2, GO_TYPE2_AT],
    ] as const) {
      const n = Math.floor((f - at) / GO_CHAR_FRAMES) + 1;
      const was = Math.floor((before - at) / GO_CHAR_FRAMES) + 1;
      if (f >= at && n !== was && n >= 1 && n <= text.length && text[n - 1] !== ' ') this.sfx.push('blip');
    }
    // low rolling hum while any shutter is moving, a clang when the last one lands
    if (f > GO_SHUTTER_AT && f < GO_SHUTTERS_CLOSED_AT && f % 24 === 0) this.sfx.push('hum');
    if (f === GO_SHUTTERS_CLOSED_AT) this.sfx.push('door');
  }

  /** Silence (apart from the PA) until the shutters are down, then the game over jingle. */
  music(): MusicId | null {
    return this.showGameOver ? 'gameover' : null;
  }

  drainSfx(): SfxId[] {
    const q = this.sfx;
    this.sfx = [];
    return q;
  }
}

function typed(text: string, framesSinceStart: number): string {
  if (framesSinceStart < 0) return '';
  const n = Math.min(text.length, Math.floor(framesSinceStart / GO_CHAR_FRAMES) + 1);
  return text.slice(0, n);
}
