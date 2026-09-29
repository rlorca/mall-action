// Session: the PURE flow / state machine of the whole game (splash -> title -> play -> level clear / continue / game over).
// No DOM, canvas or audio here. Everything the outside world needs to draw is exposed as public fields; everything it
// needs to hear/see as events goes into the EventSink handed to step(). One step() == one 60 Hz simulation frame.
import type { EventSink, StoreId } from '../core/events';
import type { PadFrame } from '../core/pad';
import { Rng, hashString } from '../core/rng';
import { STORE_BY_ID } from '../data/stores';
import { FlickerSplash } from '../flickersoft';
import type { HudModel } from '../render/hud';
import { ContinueState, GameOverState, LevelClearState, TitleState } from '../screens';
import { createMall, type MallWorld } from './mall';
import { newProgress, nextLoop, tickLevelClock, tickPower, useContinue, type Progress } from './progress';
import { canEnterStore, createStore, type StoreWorld } from './store';

export type Scene = 'splash' | 'title' | 'play' | 'levelclear' | 'continue' | 'gameover';
export type PlayMode = 'mall' | 'store';

export const FADE_FRAMES = 20;

export interface SessionOptions {
  seed: number;
  highScore: number;
  skipSplash?: boolean;
  /** Called (once per record) when a game ends with a new session high score; main persists it. */
  onHighScore?: (n: number) => void;
}

interface Transition {
  phase: 'out' | 'in';
  t: number;
  swap: () => void;
}

const anyPressed = (pad: PadFrame): boolean => Object.values(pad.pressed).some(Boolean);

export class Session {
  readonly seed: number;
  scene: Scene;
  tick = 0;
  highScore: number;
  onHighScore?: (n: number) => void;

  splash: FlickerSplash;
  title: TitleState | null = null;
  levelClear: LevelClearState | null = null;
  continueState: ContinueState | null = null;
  gameOver: GameOverState | null = null;

  progress: Progress;
  mall: MallWorld | null = null;
  store: StoreWorld | null = null;
  playMode: PlayMode = 'mall';

  /** Overlay flags while playing. */
  mapOpen = false;
  paused = false;
  /** Music should be ducked (pause overlay); main applies this to audio.setMusicDuck. */
  duck = false;

  private rng: Rng;
  private trans: Transition | null = null;
  private sink: EventSink | null = null;
  private gamesStarted = 0;
  /** Where a running Continue screen returns to. */
  private continueFrom: PlayMode = 'mall';
  private levelClearHandled = false;

  constructor(opts: SessionOptions) {
    this.seed = opts.seed >>> 0;
    this.highScore = Math.max(0, Math.floor(opts.highScore || 0));
    this.onHighScore = opts.onHighScore;
    this.rng = new Rng((this.seed ^ 0x9e3779b9) >>> 0);
    this.progress = newProgress(this.seed);
    this.splash = new FlickerSplash({
      width: 256,
      height: 240,
      onJingle: () => this.sink?.push({ t: 'music', name: 'jingle:splash' }),
    });
    if (opts.skipSplash) {
      this.scene = 'title';
      this.splash.done = true;
      this.title = new TitleState(this.highScore);
    } else {
      this.scene = 'splash';
    }
  }

  /** 0..1 amount of black to draw over the whole screen (scene / store transitions). */
  get fade(): number {
    const tr = this.trans;
    if (!tr) return 0;
    const a = Math.min(1, tr.t / FADE_FRAMES);
    return tr.phase === 'out' ? a : 1 - a;
  }

  get fading(): boolean {
    return this.trans !== null;
  }

  /** True while the game simulation is frozen by an overlay or a fade. */
  get frozen(): boolean {
    return this.paused || this.mapOpen || this.trans !== null;
  }

  /** The store the player is inside (for the map and HUD), or null. */
  get inStore(): StoreId | null {
    return this.scene === 'play' && this.playMode === 'store' && this.store ? this.store.storeId : null;
  }

  hudModel(): HudModel {
    const inStore = this.inStore;
    const floorLabel = inStore ? STORE_BY_ID[inStore].floor : (this.mall?.s.hudFloor ?? 'R');
    return {
      progress: this.progress,
      floorLabel,
      marquee: inStore ? STORE_BY_ID[inStore].name : null,
      alarm: !!this.mall?.s.alarm,
      tick: this.tick,
    };
  }

  /** Tab hidden / window blurred: pause if the game is in progress. */
  autoPause(sink?: EventSink): void {
    if (this.scene !== 'play' || this.paused || this.mapOpen || !this.canOverlay()) return;
    this.paused = true;
    this.duck = true;
    sink?.push({ t: 'sfx', name: 'pause' });
  }

  /** Hash of all deterministic state (tests / debugging). */
  stateHash(): number {
    return hashString(
      JSON.stringify({
        scene: this.scene,
        tick: this.tick,
        progress: this.progress,
        mall: this.mall?.s ?? null,
        store: this.store?.stateHash() ?? null,
        fade: this.fade,
        pm: this.playMode,
      }),
    );
  }

  step(pad: PadFrame, sink: EventSink): void {
    this.sink = sink;
    this.tick++;
    if (this.trans) {
      this.stepTransition();
      return;
    }
    switch (this.scene) {
      case 'splash':
        this.splash.update(anyPressed(pad));
        if (this.splash.done) {
          this.scene = 'title';
          this.title = new TitleState(this.highScore);
        }
        break;
      case 'title':
        this.stepTitle(pad, sink);
        break;
      case 'play':
        this.stepPlay(pad, sink);
        break;
      case 'levelclear':
        this.stepLevelClear(pad, sink);
        break;
      case 'continue':
        this.stepContinue(pad, sink);
        break;
      case 'gameover':
        this.stepGameOver(pad, sink);
        break;
    }
  }

  /* ------------------------------------------------------------ transitions */

  /** Fade out, run swap() (the scene actually changes here), fade back in. */
  private fadeThrough(swap: () => void): void {
    this.trans = { phase: 'out', t: 0, swap };
  }

  private stepTransition(): void {
    const tr = this.trans;
    if (!tr) return;
    tr.t++;
    if (tr.t >= FADE_FRAMES) {
      if (tr.phase === 'out') {
        tr.swap();
        this.trans = { phase: 'in', t: 0, swap: () => undefined };
      } else this.trans = null;
    }
  }

  /* ------------------------------------------------------------ title */

  private stepTitle(pad: PadFrame, sink: EventSink): void {
    const t = this.title;
    if (!t) return;
    t.update(pad, sink);
    if (t.startRequested) {
      const bf = t.blackFriday;
      this.fadeThrough(() => this.startGame(bf));
    }
  }

  private startGame(blackFriday: boolean): void {
    const seed = (this.seed + Math.imul(this.gamesStarted, 0x9e3779b1)) >>> 0;
    this.gamesStarted++;
    this.progress = newProgress(seed, blackFriday);
    this.title = null;
    this.resetOverlays();
    this.levelClearHandled = false;
    this.store = null;
    this.playMode = 'mall';
    this.mall = createMall({ seed, progress: this.progress });
    this.scene = 'play';
    this.sink?.push({ t: 'music', name: null });
  }

  private resetOverlays(): void {
    this.mapOpen = false;
    this.paused = false;
    this.duck = false;
  }

  /* ------------------------------------------------------------ play */

  /** Pause / map allowed once the player has control (not during the arrival) and not while fading. */
  private canOverlay(): boolean {
    if (this.trans) return false;
    if (this.playMode === 'store') return true;
    return this.mall?.s.phase === 'play';
  }

  private stepPlay(pad: PadFrame, sink: EventSink): void {
    // Overlay toggles.
    if (this.canOverlay()) {
      if (this.mapOpen) {
        if (pad.pressed.select || pad.pressed.start) {
          this.mapOpen = false;
          sink.push({ t: 'sfx', name: 'select' });
        }
        return;
      }
      if (this.paused) {
        if (pad.pressed.start) {
          this.paused = false;
          this.duck = false;
          sink.push({ t: 'sfx', name: 'pause' });
        }
        return;
      }
      if (pad.pressed.start) {
        this.paused = true;
        this.duck = true;
        sink.push({ t: 'sfx', name: 'pause' });
        return;
      }
      if (pad.pressed.select) {
        this.mapOpen = true;
        sink.push({ t: 'sfx', name: 'select' });
        return;
      }
    } else if (this.paused || this.mapOpen) {
      // Overlay left up across a fade would freeze forever: drop it.
      this.resetOverlays();
    }

    if (this.playMode === 'mall') this.stepMall(pad, sink);
    else this.stepStore(pad, sink);
  }

  private stepMall(pad: PadFrame, sink: EventSink): void {
    const mall = this.mall;
    if (!mall) return;
    const playing = mall.s.phase === 'play';
    if (playing) {
      tickPower(this.progress);
      tickLevelClock(this.progress);
    }
    mall.step(pad, sink);

    if (mall.levelClear && !this.levelClearHandled) {
      this.levelClearHandled = true;
      this.levelClear = new LevelClearState(this.progress, this.rng.fork(), sink);
      this.scene = 'levelclear';
      return;
    }
    if (mall.outOfLives) {
      this.beginContinueOrGameOver('mall', sink);
      return;
    }
    if (mall.pendingStore) {
      const id = mall.pendingStore;
      if (!canEnterStore(this.progress, id)) {
        // Defensive: closed / cleared doors never get here, but never trap the player in a fade.
        mall.returnFromStore(id, sink);
        return;
      }
      this.fadeThrough(() => this.enterStore(id));
    }
  }

  private enterStore(id: StoreId): void {
    const mall = this.mall;
    const store = createStore({ id, seed: this.rng.int(0x7fffffff), progress: this.progress });
    this.sink?.push({ t: 'music', name: null });
    if (store.refused) {
      // Should not happen (checked before the fade); go straight back.
      if (mall && this.sink) mall.returnFromStore(id, this.sink);
      return;
    }
    this.store = store;
    this.playMode = 'store';
    mall?.clearPendingStore();
  }

  private stepStore(pad: PadFrame, sink: EventSink): void {
    const store = this.store;
    if (!store) {
      this.playMode = 'mall';
      return;
    }
    tickPower(this.progress);
    tickLevelClock(this.progress);
    store.step(pad, sink);
    if (store.outOfLives) {
      this.beginContinueOrGameOver('store', sink);
      return;
    }
    if (store.exited) {
      const id = store.storeId;
      this.fadeThrough(() => this.leaveStore(id));
    }
  }

  private leaveStore(id: StoreId): void {
    this.store = null;
    this.playMode = 'mall';
    if (this.mall && this.sink) this.mall.returnFromStore(id, this.sink);
  }

  /* ------------------------------------------------------------ level clear / continue / game over */

  private stepLevelClear(pad: PadFrame, sink: EventSink): void {
    const lc = this.levelClear;
    if (!lc) return;
    lc.update(pad, sink);
    if (lc.done) {
      this.levelClear = null;
      this.fadeThrough(() => this.startNextLoop());
    }
  }

  private startNextLoop(): void {
    nextLoop(this.progress);
    this.resetOverlays();
    this.levelClearHandled = false;
    this.store = null;
    this.playMode = 'mall';
    this.mall = createMall({ seed: this.rng.int(0x7fffffff), progress: this.progress });
    this.scene = 'play';
    this.sink?.push({ t: 'music', name: null });
  }

  private beginContinueOrGameOver(from: PlayMode, sink: EventSink): void {
    this.resetOverlays();
    if (this.progress.continuesLeft > 0) {
      this.continueFrom = from;
      this.continueState = new ContinueState(this.progress);
      this.scene = 'continue';
    } else this.beginGameOver(sink);
  }

  private stepContinue(pad: PadFrame, sink: EventSink): void {
    const cs = this.continueState;
    if (!cs) return;
    cs.update(pad, sink);
    if (cs.accepted) {
      this.continueState = null;
      useContinue(this.progress);
      this.scene = 'play';
      if (this.continueFrom === 'store' && this.store) {
        this.playMode = 'store';
        this.store.resumeAfterContinue(sink);
        sink.push({ t: 'music', name: `store:${this.store.storeId}` as never });
      } else {
        this.playMode = 'mall';
        this.mall?.resumeAfterContinue(sink);
      }
    } else if (cs.expired) {
      this.continueState = null;
      this.beginGameOver(sink);
    }
  }

  private beginGameOver(_sink: EventSink): void {
    // The screen gets the PREVIOUS best so it can announce a new record itself.
    this.gameOver = new GameOverState(this.progress.score, this.highScore);
    if (this.progress.score > this.highScore) {
      this.highScore = this.progress.score;
      this.onHighScore?.(this.highScore);
    }
    this.scene = 'gameover';
  }

  private stepGameOver(pad: PadFrame, sink: EventSink): void {
    const go = this.gameOver;
    if (!go) return;
    go.update(pad, sink);
    if (go.done) {
      this.gameOver = null;
      this.fadeThrough(() => {
        this.mall = null;
        this.store = null;
        this.playMode = 'mall';
        this.title = new TitleState(this.highScore);
        this.scene = 'title';
      });
    }
  }
}
