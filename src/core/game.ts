import { EventQueue, GameEvent } from './events';
import { PadFrame, emptyFrame } from './pad';
import { KonamiDetector } from './konami';
import { Mall } from './mall';
import { StoreRoom } from './store';
import { RunState, newRun, nextLoop } from './run';
import { START_CONTINUES, START_LIVES, POINTS, timeBonus } from './scoring';
import { FlickersoftSplash } from '../flickersoft/splash';
import { HEADLINES, SPYGRAM_CLEAR, SpygramPost, StoreId, MISC } from './copy';
import { Rng, hashSeed } from './rng';
import { resetPowersOnDeath, tickPowers } from './powerups';
import { award } from './run';

export type Screen = 'splash' | 'title' | 'mall' | 'store' | 'map' | 'pause' | 'clear' | 'continue' | 'gameover';

export const FADE_FRAMES = 14;
export const CONTINUE_SECONDS = 9;

export interface Fade {
  t: number;
  /** 'out' fades to black, runs `mid`, then 'in'. */
  phase: 'out' | 'in';
  mid: () => void;
}

export type ClearPhase = 'drive' | 'tally' | 'news' | 'post';
export interface ClearState {
  phase: ClearPhase;
  t: number;
  packages: number;
  timeFrames: number;
  timeBonus: number;
  clearBonus: number;
  loop: number;
  headline: string;
  post: SpygramPost;
}

export type OverPhase = 'pa' | 'final';
export interface GameOverState {
  phase: OverPhase;
  t: number;
  /** 0..1 shutter progress (phase 'pa'). */
  shutters: number;
}

export interface TitleState {
  t: number;
  blackFriday: boolean;
  bfFlash: number;
  konami: KonamiDetector;
}

export interface GameOptions {
  seed: number;
  /** skip the studio splash (debug) */
  skipSplash?: boolean;
  hiScore?: number;
}

export class Game {
  screen: Screen = 'splash';
  /** The screen shown under the map / pause overlay. */
  under: Screen = 'mall';
  events = new EventQueue();
  seed: number;
  gameCount = 0;
  hiScore: number;
  splash = new FlickersoftSplash();
  title: TitleState = { t: 0, blackFriday: false, bfFlash: 0, konami: new KonamiDetector() };
  run: RunState | null = null;
  mall: Mall | null = null;
  store: StoreRoom | null = null;
  fade: Fade | null = null;
  clear: ClearState | null = null;
  over: GameOverState | null = null;
  continueFrames = 0;
  frame = 0;
  /** Last store the agent was in (return point after dying there). */
  lastStore: StoreId | null = null;
  pendingDeath: 'mall' | 'store' | null = null;
  rng: Rng;
  kioskPanelStore: StoreId | null = null;
  /** Where the last death happened (continue respawns there). */
  deathWhere: 'mall' | 'store' = 'mall';

  constructor(opts: GameOptions) {
    this.seed = opts.seed >>> 0;
    this.hiScore = opts.hiScore ?? 0;
    this.rng = new Rng(hashSeed('game', this.seed));
    if (opts.skipSplash) this.screen = 'title';
  }

  // ================================================================ step
  step(pad: PadFrame): void {
    this.frame++;
    if (this.fade) {
      this.stepFade();
      return;
    }
    switch (this.screen) {
      case 'splash':
        this.splash.step(Object.values(pad.pressed).some(Boolean));
        if (this.splash.jingle) this.events.emit('splashJingle');
        if (this.splash.done) {
          this.screen = 'title';
          this.title.t = 0;
          this.events.emit('toTitle');
        }
        break;
      case 'title':
        this.stepTitle(pad);
        break;
      case 'mall':
        this.stepMall(pad);
        break;
      case 'store':
        this.stepStore(pad);
        break;
      case 'map':
        if (pad.pressed.select || pad.pressed.start || pad.pressed.b) {
          this.screen = this.under;
          this.events.emit('mapClose');
        }
        break;
      case 'pause':
        if (pad.pressed.start) {
          this.screen = this.under;
          this.events.emit('pauseOff');
        }
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
  }

  private startFade(mid: () => void): void {
    this.fade = { t: 0, phase: 'out', mid };
  }
  private stepFade(): void {
    const f = this.fade!;
    f.t++;
    if (f.t >= FADE_FRAMES) {
      if (f.phase === 'out') {
        f.mid();
        f.phase = 'in';
        f.t = 0;
      } else this.fade = null;
    }
  }

  // ================================================================ title
  private stepTitle(pad: PadFrame): void {
    const t = this.title;
    t.t++;
    if (t.bfFlash > 0) t.bfFlash--;
    for (const b of ['up', 'down', 'left', 'right', 'a', 'b'] as const) {
      if (pad.pressed[b] && t.konami.push(b)) {
        t.blackFriday = true;
        t.bfFlash = 240;
        this.events.emit('blackFriday');
      }
    }
    if (pad.pressed.start) {
      this.events.emit('startGame');
      this.startFade(() => this.startGame());
    }
  }

  startGame(): void {
    const bf = this.title.blackFriday;
    const seed = (this.seed + this.gameCount * 7919) >>> 0;
    this.gameCount++;
    this.run = newRun(seed, bf, this.hiScore);
    this.run.events = this.events;
    this.mall = new Mall(this.run);
    this.store = null;
    this.clear = null;
    this.over = null;
    this.screen = 'mall';
    this.under = 'mall';
    this.pendingDeath = null;
    this.events.emit('mallStart');
  }

  // ================================================================ mall
  private stepMall(pad: PadFrame): void {
    const run = this.run!;
    const mall = this.mall!;
    if (pad.pressed.select && mall.p.mode !== 'dying') {
      this.screen = 'map';
      this.under = 'mall';
      this.events.emit('mapOpen');
      return;
    }
    if (pad.pressed.start && mall.controlGiven) {
      this.screen = 'pause';
      this.under = 'mall';
      this.events.emit('pauseOn');
      return;
    }
    const from = this.events.items.length;
    mall.step(pad);
    if (mall.controlGiven || mall.p.mode === 'dying') {
      run.levelFrames++;
    }
    if (mall.p.mode !== 'dying') tickPowers(run.powers);
    this.handleEvents(from);
  }

  private handleEvents(from: number): void {
    const evs = this.events.items.slice(from);
    for (const e of evs) this.handle(e);
    this.hiScore = Math.max(this.hiScore, this.run?.score.score ?? 0);
  }

  private handle(e: GameEvent): void {
    const run = this.run!;
    switch (e.kind) {
      case 'enterStore': {
        const id = e.id as StoreId;
        this.lastStore = id;
        this.startFade(() => {
          this.store = new StoreRoom(run, id);
          this.screen = 'store';
          this.under = 'store';
          this.events.emit('storeEntered', { id });
        });
        break;
      }
      case 'exitStore': {
        const id = e.id as StoreId;
        this.startFade(() => {
          this.mall!.returnFromStore(id);
          this.store = null;
          this.screen = 'mall';
          this.under = 'mall';
          this.events.emit('storeLeft', { id });
        });
        break;
      }
      case 'playerDied': {
        run.score.lives = Math.max(0, run.score.lives - 1);
        this.pendingDeath = e.where === 'store' ? 'store' : 'mall';
        break;
      }
      case 'deathDone':
        this.afterDeath();
        break;
      case 'levelClear':
        this.beginClear();
        break;
    }
  }

  private afterDeath(): void {
    const run = this.run!;
    const where = this.pendingDeath ?? 'mall';
    this.pendingDeath = null;
    if (run.score.lives > 0) {
      this.startFade(() => this.respawnPlayer(where));
    } else if (run.continuesLeft > 0) {
      this.startFade(() => {
        this.screen = 'continue';
        this.continueFrames = CONTINUE_SECONDS * 60;
        this.events.emit('continueScreen');
        this.deathWhere = where;
      });
    } else {
      this.startFade(() => this.beginGameOver());
    }
  }

  private respawnPlayer(where: 'mall' | 'store'): void {
    const mall = this.mall!;
    if (where === 'store' && this.store) {
      mall.returnFromStore(this.store.id);
      this.store = null;
    }
    mall.respawn();
    this.screen = 'mall';
    this.under = 'mall';
    this.events.emit('respawn');
  }

  // ================================================================ store
  private stepStore(pad: PadFrame): void {
    const run = this.run!;
    const store = this.store!;
    if (pad.pressed.select && store.p.state !== 'dead') {
      this.screen = 'map';
      this.under = 'store';
      this.events.emit('mapOpen');
      return;
    }
    if (pad.pressed.start && store.p.state !== 'dead') {
      this.screen = 'pause';
      this.under = 'store';
      this.events.emit('pauseOn');
      return;
    }
    const from = this.events.items.length;
    store.step(pad);
    run.levelFrames++;
    if (store.p.state !== 'dead') tickPowers(run.powers);
    this.handleEvents(from);
  }

  // ================================================================ level clear
  private beginClear(): void {
    const run = this.run!;
    const tb = timeBonus(run.levelFrames);
    this.clear = {
      phase: 'drive',
      t: 0,
      packages: run.packages.length,
      timeFrames: run.levelFrames,
      timeBonus: tb,
      clearBonus: POINTS.levelClear,
      loop: run.loop,
      headline: this.rng.pick(HEADLINES),
      post: this.rng.pick(SPYGRAM_CLEAR),
    };
    award(run, tb + POINTS.levelClear);
    this.screen = 'clear';
    this.under = 'clear';
    this.events.emit('levelClearStart');
  }

  private stepClear(pad: PadFrame): void {
    const c = this.clear!;
    c.t++;
    const dur: Record<ClearPhase, number> = { drive: 260, tally: 300, news: 330, post: 330 };
    const skip = pad.pressed.start;
    if (skip || c.t >= dur[c.phase]) {
      const order: ClearPhase[] = ['drive', 'tally', 'news', 'post'];
      const i = order.indexOf(c.phase);
      if (i < order.length - 1) {
        c.phase = order[i + 1];
        c.t = 0;
        this.events.emit('clearPhase', { phase: c.phase });
      } else {
        this.startFade(() => this.nextLoopStart());
      }
    }
  }

  private nextLoopStart(): void {
    const run = this.run!;
    nextLoop(run);
    this.mall = new Mall(run);
    this.store = null;
    this.clear = null;
    this.screen = 'mall';
    this.under = 'mall';
    this.events.emit('loopStart', { loop: run.loop });
  }

  // ================================================================ continue / game over
  private stepContinue(pad: PadFrame): void {
    const run = this.run!;
    this.continueFrames--;
    if (this.continueFrames > 0 && this.continueFrames % 60 === 0) this.events.emit('continueBeep', { sec: Math.ceil(this.continueFrames / 60) });
    if (pad.pressed.start) {
      run.continuesLeft--;
      run.score.lives = START_LIVES;
      // score, packages and loop are kept; power-ups reset
      resetPowersOnDeath(run.powers);
      const where = this.deathWhere;
      this.events.emit('continueUsed');
      this.startFade(() => this.respawnPlayer(where));
      return;
    }
    if (this.continueFrames <= 0) this.startFade(() => this.beginGameOver());
  }

  continueSeconds(): number {
    return Math.max(0, Math.ceil(this.continueFrames / 60));
  }

  private beginGameOver(): void {
    this.screen = 'gameover';
    this.over = { phase: 'pa', t: 0, shutters: 0 };
    this.events.emit('gameOver');
  }

  private stepGameOver(pad: PadFrame): void {
    const o = this.over!;
    o.t++;
    if (o.phase === 'pa') {
      o.shutters = Math.max(0, Math.min(1, (o.t - 100) / 140));
      if (pad.pressed.start || o.t > 330) {
        o.phase = 'final';
        o.t = 0;
        this.events.emit('gameOverFinal');
      }
    } else if (o.t > 330 || (pad.pressed.start && o.t > 20)) {
      this.startFade(() => {
        this.screen = 'title';
        this.title = { t: 0, blackFriday: false, bfFlash: 0, konami: new KonamiDetector() };
        this.run = null;
        this.mall = null;
        this.store = null;
        this.over = null;
        this.events.emit('toTitle');
      });
    }
  }

  // ================================================================ helpers for renderers / tests
  /** Total typed characters for the closing message (typewriter). */
  gameOverChars(): number {
    return Math.floor((this.over?.t ?? 0) / 3);
  }
  closingLines(): [string, string] {
    return [MISC.closed1, MISC.closed2];
  }
}

export { START_CONTINUES };
export const NO_PAD = emptyFrame();
