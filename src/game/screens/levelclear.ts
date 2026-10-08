import type { Pad } from '../../engine/pad';
import { Btn } from '../../engine/pad';
import type { Rng } from '../../engine/rng';
import type { MusicId, SfxId } from '../../audio/ids';
import { HEADLINES, SPYGRAM_COMPLETE, type SpygramPost } from '../../content/copy';
import { PACKAGES_TOTAL } from '../../content/stores';
import { SCREEN_TEXT, loopLabel } from './screentext';
import type { Screen } from './screen';

/**
 * LEVEL CLEAR: four phases, Start skips ahead one phase, after the last one `done`.
 *   0 DRIVE     garage backdrop; the wood-panelled wagon drives off while a spy chases it waving a receipt
 *   1 TALLY     a receipt: packages, time bonus, clear bonus, LOOP n, score (counting up, blip sfx)
 *   2 NEWS      front page of THE DAILY MALL with a random headline
 *   3 SPYGRAM   a random mission-complete post
 * Phases 2..3 advance on their own timers too, so an idle player still moves on to the next loop.
 *
 * The screen does NOT touch the Run: the Game adds `bonusTotal` (time bonus + clear bonus) to the score
 * itself. `score` is the score BEFORE those bonuses (pass `scoreIncludesBonus: true` if the Game already
 * added them) so the SCORE line can count up from the old score to `finalScore`.
 */
export const LC_DRIVE_FRAMES = 270;
export const LC_NEWS_FRAMES = 7 * 60;
export const LC_SPYGRAM_FRAMES = 8 * 60;
/** After the last tally line has finished counting, how long the receipt stays up. */
export const LC_TALLY_HOLD = 100;

export type LevelClearPhase = 0 | 1 | 2 | 3;
export const PHASE_DRIVE = 0;
export const PHASE_TALLY = 1;
export const PHASE_NEWS = 2;
export const PHASE_SPYGRAM = 3;

export interface LevelClearOpts {
  rng: Rng;
  /** Packages collected this level (normally 6). */
  packages: number;
  /** Points for the time left (run.timeBonus()). */
  timeBonus: number;
  /** The flat clear bonus (1000). */
  clearBonus: number;
  /** The loop just completed (shown as "LOOP n"). */
  loop: number;
  /** Score before the bonuses are added (see above). */
  score: number;
  scoreIncludesBonus?: boolean;
}

export interface TallyRowView {
  label: string;
  /** Text of the value as currently counted (e.g. "4/6", "+1200", "LOOP 1", "012340"). */
  value: string;
  visible: boolean;
  counting: boolean;
  done: boolean;
  /** Highlight (the final score line). */
  total?: boolean;
}

interface TallyDef {
  key: 'packages' | 'time' | 'clear' | 'loop' | 'score';
  label: string;
  start: number;
  dur: number;
  from: number;
  to: number;
}

const GAP = 14;

export class LevelClearScreen implements Screen {
  readonly packages: number;
  readonly timeBonus: number;
  readonly clearBonus: number;
  readonly loop: number;
  readonly baseScore: number;
  /** What the Game must add to the score. */
  readonly bonusTotal: number;
  /** baseScore + bonusTotal: what the SCORE line ends on. */
  readonly finalScore: number;
  readonly headline: string;
  readonly post: SpygramPost;
  /** Seed for spygramLikes(). */
  readonly likeSeed: number;

  private _phase: LevelClearPhase = 0;
  private _phaseFrame = 0;
  private _frame = 0;
  private _done = false;
  private sfx: SfxId[] = [];
  private readonly defs: TallyDef[];
  private readonly tallyEnd: number;

  constructor(opts: LevelClearOpts) {
    this.packages = opts.packages;
    this.timeBonus = opts.timeBonus;
    this.clearBonus = opts.clearBonus;
    this.loop = opts.loop;
    this.bonusTotal = opts.timeBonus + opts.clearBonus;
    this.baseScore = opts.scoreIncludesBonus ? Math.max(0, opts.score - this.bonusTotal) : opts.score;
    this.finalScore = this.baseScore + this.bonusTotal;
    const r = opts.rng.fork('levelclear');
    this.headline = r.pick(HEADLINES);
    this.post = r.pick(SPYGRAM_COMPLETE);
    this.likeSeed = r.int(1 << 30);

    // Tally schedule (phase-1 frames): each line starts when the previous finished, plus a gap.
    const T = SCREEN_TEXT.tally;
    const defs: TallyDef[] = [];
    let t = 24;
    const add = (key: TallyDef['key'], label: string, dur: number, from: number, to: number): void => {
      defs.push({ key, label, start: t, dur, from, to });
      t += dur + GAP;
    };
    add('packages', T.packages, Math.max(12, opts.packages * 8), 0, opts.packages);
    add('time', T.time, 50, 0, opts.timeBonus);
    add('clear', T.clear, 40, 0, opts.clearBonus);
    add('loop', loopLabel(opts.loop), 0, 0, 0);
    add('score', T.score, 64, this.baseScore, this.finalScore);
    this.defs = defs;
    this.tallyEnd = t - GAP + LC_TALLY_HOLD;
  }

  get phase(): LevelClearPhase {
    return this._phase;
  }

  /** Frames since the current phase began. */
  get phaseFrame(): number {
    return this._phaseFrame;
  }

  /** Frames since the screen began. */
  get frame(): number {
    return this._frame;
  }

  get done(): boolean {
    return this._done;
  }

  /** Receipt rows for the renderer, computed from the tally clock. */
  get tally(): TallyRowView[] {
    const pf = this._phase === PHASE_TALLY ? this._phaseFrame : this._phase > PHASE_TALLY ? 1e9 : 0;
    return this.defs.map((d) => {
      const visible = pf >= d.start;
      const p = d.dur === 0 ? (visible ? 1 : 0) : Math.max(0, Math.min(1, (pf - d.start) / d.dur));
      const v = Math.round(d.from + (d.to - d.from) * p);
      const done = visible && p >= 1;
      let value: string;
      switch (d.key) {
        case 'packages':
          value = `${v}/${PACKAGES_TOTAL}`;
          break;
        case 'time':
        case 'clear':
          value = `+${v}`;
          break;
        case 'loop':
          value = '';
          break;
        case 'score':
          value = String(v).padStart(6, '0');
          break;
      }
      return { label: d.label, value, visible, counting: visible && !done, done, total: d.key === 'score' };
    });
  }

  step(pad: Pad): void {
    if (this._done) return;
    this._frame++;
    if (pad.pressed & Btn.START) {
      this.advance(true);
      return;
    }
    this._phaseFrame++;
    const pf = this._phaseFrame;
    switch (this._phase) {
      case PHASE_DRIVE:
        if (pf === 24) this.sfx.push('door');
        if (pf === 52) this.sfx.push('zip');
        if (pf >= LC_DRIVE_FRAMES) this.advance(false);
        break;
      case PHASE_TALLY: {
        for (const d of this.defs) {
          const local = pf - d.start;
          if (local === 0 && d.dur === 0) this.sfx.push('coin');
          else if (local > 0 && local <= d.dur) {
            if (local % 3 === 0 && local < d.dur) this.sfx.push('blip');
            if (local === d.dur) this.sfx.push('coin');
          }
        }
        if (pf >= this.tallyEnd) this.advance(false);
        break;
      }
      case PHASE_NEWS:
        if (pf >= LC_NEWS_FRAMES) this.advance(false);
        break;
      case PHASE_SPYGRAM:
        if (pf >= LC_SPYGRAM_FRAMES) this.advance(false);
        break;
    }
  }

  private advance(byPlayer: boolean): void {
    if (this._phase === PHASE_SPYGRAM) {
      this._done = true;
      if (byPlayer) this.sfx.push('select');
      return;
    }
    this._phase = (this._phase + 1) as LevelClearPhase;
    this._phaseFrame = 0;
    if (byPlayer) this.sfx.push('select');
    if (this._phase === PHASE_NEWS) this.sfx.push('thud');
    if (this._phase === PHASE_SPYGRAM) this.sfx.push('camera');
  }

  music(): MusicId | null {
    return this._phase < PHASE_NEWS ? 'levelclear' : 'newspaper';
  }

  drainSfx(): SfxId[] {
    const q = this.sfx;
    this.sfx = [];
    return q;
  }
}
