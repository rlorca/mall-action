// Top-level game state machine: title, mall, stores, overlays, lives, continues, loops.
// Pure rules. The browser shell feeds it input and reads its state and outbox.
import { SEC } from './constants';
import { CONTINUES_PER_GAME, MAX_LIVES, POINTS, Score, timeBonus } from './scoring';
import { difficultyFor, type Difficulty } from './difficulty';
import { PowerUps, POWERUP_NAMES, type PowerUpId } from './powerups';
import { KonamiDetector } from './konami';
import { Rng } from './rng';
import type { StepInput } from './input';
import type { SpygramPost } from './copy';
import { BLACK_FRIDAY_LINES, HEADLINES, SPYGRAM_COMPLETE, youGot } from './copy';
import type { MallEvent, StoreEvent, SfxName } from './events';
import { MallWorld } from '../mall/world';
import { storeById, TARGET_STORE_IDS, type StoreDef } from '../mall/layout';
import { StoreRoom } from '../store/room';
import { TEMPLATES } from '../store/templates';

export type Screen = 'title' | 'mall' | 'store' | 'map' | 'pause' | 'dying' | 'continue' | 'gameover' | 'levelclear' | 'fade';
export type LevelClearPhase = 'wagon' | 'tally' | 'headline' | 'spygram';
export type MusicTrack =
  | 'title'
  | 'mall'
  | 'alarm'
  | 'elevator'
  | 'sideB'
  | 'levelclear'
  | 'gameover'
  | 'silent'
  | `store:${string}`;

export type GameOutput =
  | { type: 'sfx'; name: SfxName }
  | { type: 'music'; track: MusicTrack }
  | { type: 'banner'; lines: readonly string[] }
  | { type: 'shake'; frames: number }
  | { type: 'popup'; points: number; x: number; y: number }
  | { type: 'bubble'; x: number; y: number; text: string };

export interface Banner {
  lines: readonly string[];
  t: number;
}

const FADE_FRAMES = 20;
const DEATH_FRAMES = 1.5 * SEC;
const LEVEL_CLEAR_PHASES: Record<LevelClearPhase, number> = { wagon: 3 * SEC, tally: 6 * SEC, headline: 4 * SEC, spygram: 3 * SEC };
const CONTINUE_FRAMES = 10 * SEC;
const GAMEOVER_FRAMES = 8 * SEC;

export interface GameOptions {
  seed: number;
  highScore?: number;
}

export class Game {
  readonly seed: number;
  readonly rng: Rng;
  readonly score = new Score();
  readonly powerUps = new PowerUps();
  readonly konami = new KonamiDetector();
  readonly outbox: GameOutput[] = [];
  readonly inventory: string[] = [];
  readonly storesOpened = new Map<string, Set<number>>();
  readonly visited = new Set<string>();
  remaining = new Set<string>(TARGET_STORE_IDS);
  screen: Screen = 'title';
  loop = 1;
  lives = MAX_LIVES;
  continues = CONTINUES_PER_GAME;
  packagesFound = 0;
  blackFriday = false;
  eggUsed = false;
  photoTaken = false;
  levelFrames = 0;
  frame = 0;
  highScore: number;
  banners: Banner[] = [];
  world!: MallWorld;
  room: StoreRoom | null = null;
  difficulty: Difficulty;
  /** Subphase timers: death, fade, level clear, continue, game over. */
  timer = 0;
  phase: LevelClearPhase = 'wagon';
  fade: { phase: 'out' | 'in'; t: number; after: () => void } | null = null;
  lastSpygram: SpygramPost | null = null;
  headline: readonly string[] = HEADLINES[0];
  continueCount = 9;
  gameOverPhase: 'closed' | 'over' = 'closed';
  shutter = 0;
  private music: MusicTrack = 'title';
  private sideB = false;
  private afterFade: Screen = 'mall';
  private pausedFrom: Screen = 'mall';
  clearSeconds = 0;
  private lastDeathSpot: { x: number; floor: number } | null = null;
  private storeDeath = false;

  constructor(opts: GameOptions) {
    this.seed = opts.seed >>> 0;
    this.rng = new Rng(this.seed);
    this.highScore = opts.highScore ?? 0;
    this.difficulty = difficultyFor(1);
    this.newLevel();
    this.setMusic('title');
  }

  // ------------------------------------------------------------ public API

  /** Advance one simulation frame. */
  step(input: StepInput): void {
    this.frame++;
    this.tickBanners();
    switch (this.screen) {
      case 'title':
        this.stepTitle(input);
        break;
      case 'mall':
        this.stepMall(input);
        break;
      case 'store':
        this.stepStore(input);
        break;
      case 'map':
        if (input.pressed.includes('select') || input.pressed.includes('start')) this.setScreen('mall');
        break;
      case 'pause':
        if (input.pressed.includes('start')) this.setScreen(this.pausedFrom);
        break;
      case 'dying':
        this.stepDying();
        break;
      case 'continue':
        this.stepContinue(input);
        break;
      case 'gameover':
        this.stepGameOver(input);
        break;
      case 'levelclear':
        this.stepLevelClear(input);
        break;
      case 'fade':
        this.stepFade();
        break;
    }
  }

  /** Pressing Select or Start during play. Called by the shell for the pause/map keys. */
  togglePause(): void {
    if (this.screen === 'mall' || this.screen === 'store') {
      this.pausedFrom = this.screen;
      this.setScreen('pause');
    } else if (this.screen === 'pause') {
      this.setScreen(this.pausedFrom);
    }
  }

  toggleMap(): void {
    if (this.screen === 'mall' || this.screen === 'store') {
      this.pausedFrom = this.screen;
      this.setScreen('map');
    } else if (this.screen === 'map') {
      this.setScreen(this.pausedFrom);
    }
  }

  drainOutbox(): GameOutput[] {
    const out = [...this.outbox];
    this.outbox.length = 0;
    return out;
  }

  /** The Konami code, on the title screen, switches on Black Friday Mode. */
  get isTitle(): boolean {
    return this.screen === 'title';
  }

  get bannerNow(): Banner | null {
    return this.banners[0] ?? null;
  }

  /** Time bonus for the level that was just cleared. */
  get timeBonusDisplay(): number {
    return timeBonus(this.clearSeconds);
  }

  get levelSeconds(): number {
    return this.levelFrames / SEC;
  }

  // ------------------------------------------------------------ screens

  /** Changes screen. Each screen sets its own timer, so this never resets one. */
  private setScreen(s: Screen): void {
    this.screen = s;
    if (s === 'title') this.setMusic('title');
    if (s === 'mall' || s === 'store') this.refreshMusic();
  }

  private stepTitle(input: StepInput): void {
    for (const p of input.pressed) {
      if (this.konami.press(p)) {
        this.blackFriday = true;
        this.outbox.push({ type: 'sfx', name: 'powerup' });
        this.addBanner(BLACK_FRIDAY_LINES, 3 * SEC);
      }
    }
    if (input.pressed.includes('start')) this.startNewGame();
  }

  private startNewGame(): void {
    this.loop = 1;
    this.lives = MAX_LIVES;
    this.continues = CONTINUES_PER_GAME;
    this.score.points = 0;
    this.packagesFound = 0;
    this.inventory.length = 0;
    this.storesOpened.clear();
    this.visited.clear();
    this.eggUsed = false;
    this.photoTaken = false;
    this.remaining = new Set(TARGET_STORE_IDS);
    this.powerUps.clearOnDeath();
    this.powerUps.radar = false;
    this.newLevel();
    this.setScreen('mall');
    this.setMusic('mall');
  }

  /** Builds the mall for the current loop. Keeps score, lives and inventory. */
  private newLevel(): void {
    this.difficulty = difficultyFor(this.loop, this.blackFriday);
    this.levelFrames = 0;
    this.world = new MallWorld({
      seed: (this.seed + this.loop * 1009) >>> 0,
      difficulty: this.difficulty,
      powerUps: this.powerUps,
      remaining: () => this.remaining,
      doorOpen: (id) => this.isDoorOpen(id),
      arrival: this.loop === 1 && this.packagesFound === 0,
      photoTaken: this.photoTaken,
    });
    this.room = null;
    this.lastDeathSpot = null;
  }

  /** Whether spies may come out of this store: open target stores and power-up shops. */
  isDoorOpen(id: string): boolean {
    const s = storeById(id);
    if (s.role === 'closed') return false;
    if (s.role === 'target') return this.remaining.has(id);
    return true;
  }

  private stepMall(input: StepInput): void {
    if (input.pressed.includes('select')) return this.toggleMap();
    if (input.pressed.includes('start')) return this.togglePause();
    this.levelFrames++;
    this.checkAlarm();
    const events = this.world.step(input);
    this.handleMallEvents(events);
    this.refreshMusic();
  }

  private stepStore(input: StepInput): void {
    if (input.pressed.includes('select')) return this.toggleMap();
    if (input.pressed.includes('start')) return this.togglePause();
    this.levelFrames++;
    this.checkAlarm();
    const room = this.room;
    if (!room) return this.setScreen('mall');
    const events = room.step(input);
    this.handleStoreEvents(events);
    if (room.exited && this.screen === 'store') this.leaveStore();
    this.refreshMusic();
  }

  private checkAlarm(): void {
    if (!this.world.alarm && this.levelFrames >= this.difficulty.alarmAtSec * SEC) this.world.activateAlarm();
  }

  private handleMallEvents(events: MallEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'sfx':
          this.outbox.push({ type: 'sfx', name: e.name });
          break;
        case 'banner':
          this.addBanner(e.lines, e.frames);
          break;
        case 'score':
          this.addScore(e.points, e.x, e.y);
          break;
        case 'death':
          this.onDeath(false);
          return;
        case 'enterStore':
          this.enterStore(e.storeId);
          return;
        case 'levelClear':
          this.beginLevelClear();
          return;
        case 'pkgsLeft':
          this.addBanner([`PACKAGES LEFT: ${e.n}`]);
          break;
        case 'spygram':
          this.lastSpygram = e.post;
          break;
        case 'bubble':
          this.outbox.push({ type: 'bubble', x: e.x, y: e.y, text: e.text });
          break;
        case 'kiosk':
          break; // the renderer draws the kiosk panel from the world's state
        case 'photo':
          this.photoTaken = true;
          this.inventory.push('PHOTO STRIP');
          this.addBanner(['PHOTO STRIP ADDED']);
          break;
        case 'copCaught':
          this.addBanner(['DETAINED! -500']);
          break;
        case 'extraLife':
          this.gainLife();
          break;
        case 'alarm':
          this.setMusic('alarm');
          break;
        case 'pickup':
          this.collectPowerUp(e.id);
          break;
        case 'hurt':
          this.outbox.push({ type: 'sfx', name: 'hurt' });
          break;
      }
    }
  }

  private handleStoreEvents(events: StoreEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'sfx':
          this.outbox.push({ type: 'sfx', name: e.name });
          break;
        case 'banner':
          this.addBanner(e.lines, e.frames);
          break;
        case 'score':
          this.addScore(e.points, e.x, e.y);
          break;
        case 'packageFound':
          this.foundPackage(e.storeId);
          break;
        case 'powerUp':
          this.collectPowerUp(e.id);
          break;
        case 'death':
          this.storeDeath = true;
          this.onDeath(true);
          return;
        case 'exit':
          break;
        case 'bubble':
          this.outbox.push({ type: 'bubble', x: e.x, y: e.y, text: e.text });
          break;
        case 'easterEgg':
          this.inventory.push(e.item);
          this.addBanner([youGot(e.item)], 2 * SEC);
          this.outbox.push({ type: 'sfx', name: 'itemGet' });
          break;
        case 'sideB':
          this.sideB = true;
          break;
        case 'hurt':
          break;
      }
    }
  }

  private foundPackage(storeId: string): void {
    if (!this.remaining.has(storeId)) return;
    this.remaining.delete(storeId);
    this.packagesFound++;
  }

  private collectPowerUp(id: PowerUpId): void {
    if (id === 'oneup') {
      this.gainLife();
    } else {
      this.powerUps.grant(id);
    }
    this.addScore(POINTS.powerUp, 0, 0);
    this.addBanner([POWERUP_NAMES[id]], SEC);
    this.outbox.push({ type: 'sfx', name: 'powerup' });
  }

  private gainLife(): void {
    this.lives = Math.min(this.lives + 1, 9);
    this.outbox.push({ type: 'sfx', name: 'extraLife' });
  }

  private addScore(points: number, x: number, y: number): void {
    const lives = this.score.add(points);
    for (let i = 0; i < lives; i++) this.gainLife();
    if (this.score.points > this.highScore) this.highScore = this.score.points;
    if (points !== 0) this.outbox.push({ type: 'popup', points, x, y });
  }

  private addBanner(lines: readonly string[], frames = SEC * 2): void {
    this.banners.push({ lines, t: frames });
    this.outbox.push({ type: 'banner', lines });
  }

  private tickBanners(): void {
    for (const b of this.banners) b.t--;
    while (this.banners.length && this.banners[0].t <= 0) this.banners.shift();
  }

  // ------------------------------------------------------------ stores

  private enterStore(storeId: string): void {
    const store = storeById(storeId);
    this.fadeThen('store', () => {
      const firstVisit = !this.visited.has(storeId);
      this.visited.add(storeId);
      const egg = storeId === 'GAMESTONK' && !this.eggUsed;
      if (egg) this.eggUsed = true;
      this.sideB = false;
      this.room = this.buildRoom(store, firstVisit, egg);
    });
  }

  private buildRoom(store: StoreDef, firstVisit: boolean, egg: boolean): StoreRoom {
    const template = TEMPLATES[store.template ?? ''];
    if (!template) throw new Error(`no template for ${store.id}`);
    const opened = this.storesOpened.get(store.id) ?? new Set<number>();
    this.storesOpened.set(store.id, opened);
    const seed = (this.seed ^ Math.imul(this.loop, 2654435761) ^ hashString(store.id)) >>> 0;
    return new StoreRoom({
      store,
      template,
      seed,
      blackFriday: this.blackFriday,
      powerUps: this.powerUps,
      firstVisit,
      egg,
      opened,
      packagesFound: this.packagesFound,
    });
  }

  private leaveStore(): void {
    const store = this.room ? this.room.store : null;
    this.fadeThen('mall', () => {
      this.room = null;
      this.sideB = false;
      if (store) this.world.returnFromStore(store);
    });
  }

  // ------------------------------------------------------------ fade

  private fadeThen(to: Screen, swap: () => void): void {
    this.afterFade = to;
    this.fade = { phase: 'out', t: 0, after: swap };
    this.screen = 'fade';
    this.timer = 0;
  }

  private stepFade(): void {
    const f = this.fade;
    if (!f) return this.setScreen(this.afterFade);
    f.t++;
    if (f.phase === 'out' && f.t >= FADE_FRAMES) {
      f.after();
      f.phase = 'in';
      f.t = 0;
    } else if (f.phase === 'in' && f.t >= FADE_FRAMES) {
      this.fade = null;
      this.setScreen(this.afterFade);
    }
  }

  // ------------------------------------------------------------ death & continues

  private onDeath(inStore: boolean): void {
    this.lastDeathSpot = { x: this.world.player.x, floor: this.world.player.floor };
    this.outbox.push({ type: 'sfx', name: 'death' });
    this.lives--;
    this.powerUps.clearOnDeath();
    this.setScreen('dying');
    this.timer = DEATH_FRAMES;
    this.storeDeath = inStore;
    this.setMusic('silent');
  }

  private stepDying(): void {
    if (--this.timer > 0) return;
    if (this.lives > 0) {
      this.continueFromSafeSpot();
      return;
    }
    if (this.continues > 0) {
      this.continueCount = 9;
      this.timer = CONTINUE_FRAMES;
      this.setScreen('continue');
      this.setMusic('gameover');
    } else {
      this.beginGameOver();
    }
  }

  private continueFromSafeSpot(): void {
    this.room = null;
    this.world.respawn();
    this.setScreen('mall');
    this.refreshMusic();
  }

  private stepContinue(input: StepInput): void {
    if (--this.timer % SEC === 0 && this.continueCount > 0) {
      this.continueCount--;
      this.outbox.push({ type: 'sfx', name: this.continueCount <= 3 ? 'buzzer' : 'blip' });
    }
    if (input.pressed.includes('start')) {
      this.continues--;
      this.lives = MAX_LIVES;
      this.room = null;
      // "Where you fell": the agent comes back from the place he died, not the last safe spot.
      if (this.lastDeathSpot && !this.storeDeath) this.world.respawnAt(this.lastDeathSpot);
      else this.world.respawn();
      this.setScreen('mall');
      this.refreshMusic();
      return;
    }
    if (this.timer <= 0 || this.continueCount <= 0) this.beginGameOver();
  }

  private beginGameOver(): void {
    this.gameOverPhase = 'closed';
    this.shutter = 0;
    this.timer = GAMEOVER_FRAMES;
    this.setScreen('gameover');
    this.setMusic('gameover');
    this.outbox.push({ type: 'sfx', name: 'pa' });
  }

  private stepGameOver(input: StepInput): void {
    this.timer--;
    this.shutter = Math.min(1, this.shutter + 1 / (2 * SEC));
    if (this.timer < GAMEOVER_FRAMES - 3 * SEC) this.gameOverPhase = 'over';
    if (this.timer <= 0 || input.pressed.includes('start')) {
      this.setScreen('title');
    }
  }

  // ------------------------------------------------------------ level clear

  private beginLevelClear(): void {
    this.score.add(POINTS.levelClear);
    if (this.score.points > this.highScore) this.highScore = this.score.points;
    this.setScreen('levelclear');
    this.phase = 'wagon';
    this.timer = LEVEL_CLEAR_PHASES.wagon;
    this.clearSeconds = this.levelSeconds;
    this.lastSpygram = this.rng.pick(SPYGRAM_COMPLETE);
    this.headline = this.rng.pick(HEADLINES);
    this.setMusic('levelclear');
    this.outbox.push({ type: 'sfx', name: 'levelClear' });
  }

  private stepLevelClear(input: StepInput): void {
    const skip = input.pressed.includes('start') || input.pressed.includes('a') || input.pressed.includes('b');
    this.timer--;
    if (skip || this.timer <= 0) this.advanceLevelClear();
  }

  private advanceLevelClear(): void {
    const order: LevelClearPhase[] = ['wagon', 'tally', 'headline', 'spygram'];
    const i = order.indexOf(this.phase);
    if (i < order.length - 1) {
      this.phase = order[i + 1];
      this.timer = LEVEL_CLEAR_PHASES[this.phase];
      if (this.phase === 'tally') this.score.add(timeBonus(this.clearSeconds));
      return;
    }
    // Next loop: harder, with the same score and inventory.
    this.loop++;
    this.packagesFound = 0;
    this.remaining = new Set(TARGET_STORE_IDS);
    this.storesOpened.clear();
    this.visited.clear();
    this.powerUps.clearOnDeath();
    this.powerUps.radar = false;
    this.newLevel();
    this.setScreen('mall');
    this.refreshMusic();
  }

  // ------------------------------------------------------------ music

  private setMusic(track: MusicTrack): void {
    if (track === this.music) return;
    this.music = track;
    this.outbox.push({ type: 'music', track });
  }

  private refreshMusic(): void {
    if (this.screen === 'store' && this.room) {
      this.setMusic(this.sideB ? 'sideB' : `store:${this.room.store.id}`);
      return;
    }
    if (this.screen !== 'mall') return;
    const player = this.world.player;
    if (player.mode === 'car') this.setMusic('elevator');
    else if (this.world.alarm) this.setMusic('alarm');
    else this.setMusic('mall');
  }

  get currentMusic(): MusicTrack {
    return this.music;
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

