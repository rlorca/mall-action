import type { Pad } from '../../engine/pad';
import { Btn } from '../../engine/pad';
import type { MusicId, SfxId } from '../../audio/ids';
import { STORE_IDS, STORE_W } from '../../content/stores';
import { KonamiDetector } from './konami';
import type { Screen } from './screen';

/** Gap between neighbouring storefronts in the scrolling row (px). */
export const TITLE_STORE_GAP = 8;
/** One full cycle of the row (13 storefronts + gaps): the scroll wraps seamlessly at this width. */
export const TITLE_STRIP_PERIOD = STORE_IDS.length * (STORE_W + TITLE_STORE_GAP);
/** The row moves 1 px every this many frames. */
export const TITLE_SCROLL_FRAMES = 2;

/** Scroll offset (px) of the storefront row after `frame` steps; wraps at TITLE_STRIP_PERIOD. */
export function stripOffset(frame: number): number {
  return Math.floor(frame / TITLE_SCROLL_FRAMES) % TITLE_STRIP_PERIOD;
}

/**
 * Title screen: Start finishes it (`done`); the Konami code (UP UP DOWN DOWN LEFT RIGHT LEFT RIGHT B A,
 * extra leading Ups are fine) switches on Black Friday Mode: `blackFriday` becomes true and the screen shows
 * a flashing "BLACK FRIDAY!" / "70% OFF EVERYTHING". The Game reads `blackFriday` when it starts the run.
 * Only Start starts the game (B and A are part of the code, so they must not).
 */
export class TitleScreen implements Screen {
  readonly hiScore: number;
  private _frame = 0;
  private _done = false;
  private _blackFriday = false;
  private _bfAt = -1;
  private sfx: SfxId[] = [];
  private readonly konami = new KonamiDetector();

  constructor(opts: { hiScore: number }) {
    this.hiScore = opts.hiScore;
  }

  get frame(): number {
    return this._frame;
  }

  get done(): boolean {
    return this._done;
  }

  /** Black Friday Mode was unlocked with the Konami code. */
  get blackFriday(): boolean {
    return this._blackFriday;
  }

  /** Frames since the code was entered (0 if not yet; check `blackFriday`). */
  get blackFridayFrames(): number {
    return this._bfAt < 0 ? 0 : this._frame - this._bfAt;
  }

  /** Storefront row scroll offset in px. */
  get scroll(): number {
    return stripOffset(this._frame);
  }

  step(pad: Pad): void {
    if (this._done) return;
    this._frame++;
    if (this.konami.feed(pad.pressed)) {
      if (!this._blackFriday) this._bfAt = this._frame;
      this._blackFriday = true;
      this.sfx.push('fanfare');
    }
    if (pad.pressed & Btn.START) {
      this._done = true;
      this.sfx.push('select');
    }
  }

  music(): MusicId | null {
    return 'title';
  }

  drainSfx(): SfxId[] {
    const q = this.sfx;
    this.sfx = [];
    return q;
  }
}
