import { Btn, type Pad } from '../engine/pad';
import { Rng } from '../engine/rng';
import type { MusicId, SfxId } from '../audio/ids';
import { Run } from './run';
import { Level } from './level';
import { SplashScreen } from './screens/splash';
import { TitleScreen } from './screens/title';
import { LevelClearScreen } from './screens/levelclear';
import { ContinueScreen } from './screens/continue';
import { GameOverScreen } from './screens/gameover';

export type SceneKind = 'splash' | 'title' | 'level' | 'clear' | 'continue' | 'gameover';

export interface GameOptions {
  seed: number;
  /** Skip the FLICKERSOFT splash (?debug=1). */
  skipSplash?: boolean;
  /** Start straight in the mall (debug / automated playtests); skips the title. */
  autostart?: boolean;
  /** Skip the zip-line arrival too (debug). */
  skipIntro?: boolean;
  blackFriday?: boolean;
  hiScore?: number;
}

/**
 * The whole game as a scene machine. `step(pad)` is THE entry point: the rAF loop and the ?debug=1 stepper
 * both call it, once per 60 Hz frame. Everything inside is deterministic for a given seed and input sequence.
 *
 *   splash -> title -> level (mall <-> store, map, pause) -> clear -> level (next loop)
 *                          \-> continue -> level | gameover -> title
 */
export class Game {
  scene: SceneKind;
  frame = 0;
  readonly seed: number;
  readonly rng: Rng;
  /** Session high score (resets when the page reloads). */
  hiScore: number;

  run: Run | null = null;
  level: Level | null = null;
  splash: SplashScreen | null = null;
  title: TitleScreen | null = null;
  clear: LevelClearScreen | null = null;
  cont: ContinueScreen | null = null;
  over: GameOverScreen | null = null;

  private games = 0;
  private sfxQueue: SfxId[] = [];
  private readonly skipIntro: boolean;

  constructor(opts: GameOptions) {
    this.seed = opts.seed;
    this.rng = new Rng(opts.seed);
    this.hiScore = opts.hiScore ?? 0;
    this.skipIntro = !!opts.skipIntro;
    if (opts.autostart) {
      this.scene = 'title';
      this.startRun(!!opts.blackFriday);
    } else if (opts.skipSplash) {
      this.scene = 'title';
      this.title = new TitleScreen({ hiScore: this.hiScore });
    } else {
      this.scene = 'splash';
      this.splash = new SplashScreen();
    }
  }

  // ------------------------------------------------------------------ the one entry point
  step(pad: Pad): void {
    this.frame++;
    switch (this.scene) {
      case 'splash':
        this.stepSplash(pad);
        break;
      case 'title':
        this.stepTitle(pad);
        break;
      case 'level':
        this.stepLevel(pad);
        break;
      case 'clear':
        this.stepClear(pad);
        break;
      case 'continue':
        this.stepContinue(pad);
        break;
      case 'gameover':
        this.stepGameOver(pad);
        break;
    }
    if (this.run) this.sfxQueue.push(...this.run.drainSfx());
  }

  // ------------------------------------------------------------------ scenes
  private stepSplash(pad: Pad): void {
    const s = this.splash!;
    s.step(pad);
    this.collect(s.drainSfx());
    if (s.done) {
      this.splash = null;
      this.title = new TitleScreen({ hiScore: this.hiScore });
      this.scene = 'title';
    }
  }

  private stepTitle(pad: Pad): void {
    const t = this.title!;
    t.step(pad);
    this.collect(t.drainSfx());
    if (t.done) {
      const bf = t.blackFriday;
      this.title = null;
      this.startRun(bf);
    }
  }

  private startRun(blackFriday: boolean): void {
    this.games++;
    this.run = new Run(this.seed + (this.games - 1) * 7919, { blackFriday, hiScore: this.hiScore });
    this.level = new Level(this.run, this.rng.fork(`game${this.games}`), { skipIntro: this.skipIntro });
    this.scene = 'level';
  }

  private stepLevel(pad: Pad): void {
    const lv = this.level!;
    const run = this.run!;
    lv.step(pad);
    this.hiScore = Math.max(this.hiScore, run.hiScore, run.score);
    switch (lv.result) {
      case 'clear': {
        const d = lv.clearData();
        this.clear = new LevelClearScreen({
          rng: this.rng.fork(`clear${this.games}-${run.loop}`),
          packages: d.packages,
          timeBonus: d.timeBonus,
          clearBonus: d.clearBonus,
          loop: d.loop,
          score: d.score,
          scoreIncludesBonus: true,
        });
        this.scene = 'clear';
        break;
      }
      case 'continue':
        this.cont = new ContinueScreen({ continuesLeft: run.continuesLeft });
        this.scene = 'continue';
        break;
      case 'gameover':
        this.endGame();
        break;
      default:
        break;
    }
  }

  private stepClear(pad: Pad): void {
    const c = this.clear!;
    c.step(pad);
    this.collect(c.drainSfx());
    if (c.done) {
      this.clear = null;
      const run = this.run!;
      run.loop++;
      this.level = new Level(run, this.rng.fork(`game${this.games}`), { skipIntro: this.skipIntro });
      this.scene = 'level';
    }
  }

  private stepContinue(pad: Pad): void {
    const c = this.cont!;
    c.step(pad);
    this.collect(c.drainSfx());
    if (!c.done) return;
    const run = this.run!;
    if (c.result === 'continue') {
      this.cont = null;
      run.useContinue();
      this.level!.resume();
      this.scene = 'level';
    } else {
      this.cont = null;
      this.endGame();
    }
  }

  private endGame(): void {
    const run = this.run!;
    this.hiScore = Math.max(this.hiScore, run.score);
    this.over = new GameOverScreen({ score: run.score, hiScore: this.hiScore });
    this.scene = 'gameover';
  }

  private stepGameOver(pad: Pad): void {
    const o = this.over!;
    o.step(pad);
    this.collect(o.drainSfx());
    if (o.done) {
      this.over = null;
      this.run = null;
      this.level = null;
      this.title = new TitleScreen({ hiScore: this.hiScore });
      this.scene = 'title';
    }
  }

  // ------------------------------------------------------------------ outputs
  private collect(sfx: SfxId[]): void {
    for (const s of sfx) this.sfxQueue.push(s);
  }

  /** Sound effects requested since the last call. */
  drainSfx(): SfxId[] {
    const q = this.sfxQueue;
    this.sfxQueue = [];
    return q;
  }

  /** The music the current scene wants (null = silence). */
  music(): MusicId | null {
    switch (this.scene) {
      case 'splash':
        return this.splash!.music();
      case 'title':
        return this.title!.music();
      case 'level':
        return this.level!.music();
      case 'clear':
        return this.clear!.music();
      case 'continue':
        return this.cont!.music();
      case 'gameover':
        return this.over!.music();
    }
  }

  /** Pause turns the music down. */
  duck(): boolean {
    return this.scene === 'level' && this.level!.overlay === 'pause';
  }
}

export { Btn };
