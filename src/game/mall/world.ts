// The mall world: owns MallState, orchestrates one 60 Hz frame. PURE: no DOM / canvas / audio / Math.random / Date.
import type { EventSink, GameEvent, SfxName, StoreId } from '../../core/events';
import type { PadFrame } from '../../core/pad';
import { Rng } from '../../core/rng';
import { MISC, PA_ANNOUNCEMENTS, SPYGRAM_ARRIVAL } from '../../data/copy';
import type { Floor } from '../../data/stores';
import { STORES } from '../../data/stores';
import { difficulty, type Difficulty } from '../difficulty';
import type { MallWorldApi, MapSnapshot } from '../api';
import { FLOOR_Y, LEVEL_H, LEVEL_W } from '../geometry';
import { addScore, type Progress } from '../progress';
import { ESCALATORS, STORE_LAYOUT_BY_ID, WAGON, ZIP, cableY } from './layout';
import { makeCars, updateCars } from './elevators';
import { GRAVITY, nearestFloor } from './physics';
import { hitPlayer, killPlayer, makePlayer, respawnPlayer, updatePlayer, RESPAWN_INVULN } from './player';
import { copOnShot, makeBalls, makeCop, makeFountains, makeJanitor, makeKiosks, makeLamps, makeWalkers, updateBullets, updateProps } from './props';
import { FIRST_SPAWN, killSpy, spawnSpy, spawnTick, spyContacts, updateSpies } from './spies';
import type { Bubble, Ctx, DeathCause, MallState, Spy } from './types';

export interface MallOptions {
  seed: number;
  progress: Progress;
  /** Skip the zip-line arrival + selfie (tests / debugging): the player starts on the roof with control. */
  skipArrival?: boolean;
}

const NULL_SINK: EventSink = { push: () => undefined };

export class MallWorld implements MallWorldApi, Ctx {
  progress: Progress;
  pendingStore: StoreId | null = null;
  levelClear = false;
  s: MallState;
  rng: Rng;
  sink: EventSink = NULL_SINK;
  private startMusicPending = false;

  constructor(opts: MallOptions) {
    this.progress = opts.progress;
    this.rng = new Rng((opts.seed ^ 0x5bd1e995) >>> 0);
    const spygramIndex = this.rng.int(SPYGRAM_ARRIVAL.length);
    const player = makePlayer();
    player.x = ZIP.startX;
    player.y = cableY(ZIP.startX) + ZIP.hang;
    this.s = {
      frame: 0,
      playFrames: 0,
      phase: 'zip',
      phaseFrames: 0,
      spygramIndex,
      player,
      cars: makeCars(),
      escalators: ESCALATORS.map((e) => ({ id: e.id, riding: false })),
      spies: [],
      bullets: [],
      lamps: makeLamps(),
      discoBalls: makeBalls(),
      janitor: makeJanitor(),
      wetPatches: [],
      walkers: makeWalkers(this.rng),
      cop: makeCop(this.rng),
      kiosks: makeKiosks(),
      fountains: makeFountains(),
      coins: [],
      pickups: [],
      darkened: [],
      camera: { x: 0, y: 0 },
      alarm: false,
      rideHum: false,
      kioskPanel: null,
      photoStrip: null,
      hudFloor: 'R',
      announce: null,
      packagesLeftShown: 0,
      nextSpawnAt: FIRST_SPAWN,
      nextPaAt: 2400 + this.rng.int(1200),
      lastPaIndex: -1,
      idSeq: 0,
      volleySeq: 0,
      music: 'mall',
      levelClearFired: false,
      outOfLives: false,
    };
    if (opts.skipArrival) this.beginPlay(false);
    this.updateCamera(true);
  }

  /* ---------------------------------------------------------------- Ctx */
  get outOfLives(): boolean {
    return this.s.outOfLives;
  }
  diff(): Difficulty {
    return difficulty(this.progress.loop, this.progress.blackFriday);
  }
  ev(e: GameEvent): void {
    this.sink.push(e);
  }
  sfx(n: SfxName): void {
    this.sink.push({ t: 'sfx', name: n });
  }
  award(points: number, x: number, y: number): void {
    addScore(this.progress, points, this.sink);
    this.sink.push({ t: 'popup', x, y, text: `${points > 0 ? '+' : ''}${points}` });
  }
  hitPlayer(cause: DeathCause): void {
    if (cause === 'bullet' || cause === 'spy' || cause === 'lamp' || cause === 'ball') hitPlayer(this, cause);
    else killPlayer(this, cause);
  }
  killPlayer(cause: DeathCause): void {
    killPlayer(this, cause);
  }
  killSpy(sp: Spy, how: Parameters<Ctx['killSpy']>[1]): void {
    killSpy(this, sp, how);
  }
  spawnSpy(floor: Floor, x: number, opts?: { line?: string; emerge?: boolean }): Spy | null {
    return spawnSpy(this, floor, x, opts);
  }
  say(target: { bubble: Bubble | null }, text: string, frames = 90): void {
    target.bubble = { text, frames };
  }
  enterStore(id: StoreId): void {
    this.pendingStore = id;
  }
  levelClearNow(): void {
    this.levelClear = true;
  }
  onPlayerShot(): void {
    copOnShot(this);
  }

  /* ---------------------------------------------------------------- API */
  clearPendingStore(): void {
    this.pendingStore = null;
  }

  returnFromStore(id: StoreId, sink: EventSink): void {
    this.sink = sink;
    const lay = STORE_LAYOUT_BY_ID[id];
    const p = this.s.player;
    this.pendingStore = null;
    p.mode = 'walk';
    p.hidden = false;
    p.x = lay.doorX;
    p.floor = lay.floor;
    p.y = FLOOR_Y[lay.floor];
    p.vx = 0;
    p.vy = 0;
    p.duck = false;
    p.slide = 0;
    p.kick = false;
    p.still = 0;
    p.anim = 'stand';
    p.invuln = Math.max(p.invuln, 60);
    p.safeX = p.x;
    p.safeFloor = lay.floor;
    this.s.bullets.length = 0;
    this.s.spies = this.s.spies.filter((sp) => !(sp.floor === lay.floor && Math.abs(sp.x - lay.doorX) < 64));
    this.checkAlarm();
    this.s.music = this.wantedMusic();
    sink.push({ t: 'music', name: this.s.music });
    this.updateCamera(true);
  }

  resumeAfterContinue(sink: EventSink): void {
    this.sink = sink;
    this.s.outOfLives = false;
    respawnPlayer(this);
    this.s.music = this.wantedMusic();
    sink.push({ t: 'music', name: this.s.music });
  }

  mapSnapshot(): MapSnapshot {
    const p = this.s.player;
    return {
      playerFloor: p.floor ?? nearestFloor(p.y),
      playerX: p.x,
      cars: this.s.cars.map((c) => ({ shaft: c.id, y: c.y, floor: c.level })),
      getawayCar: { x: WAGON.x },
      stores: STORES.map((st) => {
        const l = STORE_LAYOUT_BY_ID[st.id];
        return { id: st.id, floor: st.floor, x: l.x, w: l.w };
      }),
    };
  }

  /* ---------------------------------------------------------------- frame */
  step(pad: PadFrame, sink: EventSink): void {
    this.sink = sink;
    const s = this.s;
    s.frame++;
    if (this.startMusicPending) {
      this.startMusicPending = false;
      sink.push({ t: 'music', name: this.wantedMusic() });
    }
    if (s.outOfLives || this.pendingStore) return;
    if (s.phase !== 'play') {
      if (s.phase !== 'clear') this.intro(pad);
      this.updateCamera(false);
      return;
    }
    s.playFrames++;
    this.checkAlarm();
    this.paTick();
    updatePlayer(this, pad);
    updateCars(this, pad);
    spawnTick(this);
    updateSpies(this);
    updateBullets(this);
    updateProps(this);
    spyContacts(this);
    if (s.outOfLives) return;
    const p = s.player;
    s.hudFloor = nearestFloor(p.y);
    s.rideHum = p.mode === 'car' && s.cars.some((c) => c.id === p.carId && c.moving);
    for (const e of s.escalators) e.riding = p.mode === 'escalator' && p.escId === e.id;
    if (p.mode === 'entering' || p.mode === 'gone') {
      this.updateCamera(false);
      return;
    }
    const want = this.wantedMusic();
    if (want !== s.music) {
      s.music = want;
      sink.push({ t: 'music', name: want });
    }
    this.updateCamera(false);
  }

  private wantedMusic(): 'mall' | 'alarm' | 'elevator' {
    if (this.s.player.mode === 'car') return 'elevator';
    return this.s.alarm ? 'alarm' : 'mall';
  }

  private checkAlarm(): void {
    const s = this.s;
    if (s.alarm || s.phase !== 'play') return;
    if (this.progress.levelFrames >= this.diff().alarmFrames) {
      s.alarm = true;
      this.sfx('alarm');
      this.ev({ t: 'banner', lines: [...MISC.alarm], kind: 'alarm', frames: 150 });
    }
  }

  private paTick(): void {
    const s = this.s;
    if (s.playFrames < s.nextPaAt) return;
    const r = this.rng.pickNot(PA_ANNOUNCEMENTS, s.lastPaIndex);
    s.lastPaIndex = r.index;
    this.sfx('chime');
    this.ev({ t: 'banner', lines: [...r.value], kind: 'pa', frames: MISC.paDisplayFrames });
    s.nextPaAt = s.playFrames + 3300 + this.rng.int(600);
  }

  private beginPlay(emit: boolean): void {
    const s = this.s;
    const p = s.player;
    s.phase = 'play';
    s.phaseFrames = 0;
    p.mode = 'walk';
    p.x = p.x < 60 ? ZIP.letGoX + 8 : p.x;
    p.y = FLOOR_Y.R;
    p.floor = 'R';
    p.hidden = false;
    p.duck = false;
    p.vx = 0;
    p.vy = 0;
    p.anim = 'stand';
    p.safeX = p.x;
    p.safeFloor = 'R';
    s.music = 'mall';
    if (emit) this.sink.push({ t: 'music', name: 'mall' });
    else this.startMusicPending = true;
  }

  private intro(pad: PadFrame): void {
    const s = this.s;
    const p = s.player;
    s.phaseFrames++;
    p.animFrame++;
    switch (s.phase) {
      case 'zip': {
        if (s.phaseFrames === 1 || s.phaseFrames % 20 === 0) this.sfx('zip');
        p.x += 1 + Math.min(1.5, s.phaseFrames / 40);
        p.y = cableY(p.x) + ZIP.hang;
        p.anim = 'hang';
        if (p.x >= ZIP.letGoX) {
          s.phase = 'drop';
          s.phaseFrames = 0;
          p.mode = 'drop';
          p.x = ZIP.letGoX;
          p.vy = 0;
          p.anim = 'drop';
        }
        break;
      }
      case 'drop': {
        p.vy += 0.55;
        p.y += p.vy;
        if (p.y >= FLOOR_Y.R) {
          p.y = FLOOR_Y.R;
          p.vy = 0;
          s.phase = 'land';
          s.phaseFrames = 0;
          p.mode = 'land';
          p.anim = 'crouch';
          this.sfx('thud');
          this.ev({ t: 'shake', frames: 8, mag: 1 });
        }
        break;
      }
      case 'land': {
        if (s.phaseFrames >= 30) {
          s.phase = 'selfie';
          s.phaseFrames = 0;
          p.mode = 'selfie';
          p.anim = 'selfie';
          this.sfx('flash');
          this.ev({ t: 'flash', frames: 12 });
          this.ev({ t: 'music', name: 'jingle:selfie' });
        }
        break;
      }
      case 'selfie': {
        const anyPress = Object.values(pad.pressed).some(Boolean);
        if (s.phaseFrames >= 150 || anyPress) this.beginPlay(true);
        break;
      }
      default:
        break;
    }
  }

  private updateCamera(snap: boolean): void {
    const s = this.s;
    const p = s.player;
    const tx = Math.min(LEVEL_W - 256, Math.max(0, Math.round(p.x - 128)));
    const ty = Math.min(LEVEL_H - 224, Math.max(0, Math.round(p.y - 12 - 112)));
    if (snap) {
      s.camera.x = tx;
      s.camera.y = ty;
    } else {
      s.camera.x = tx;
      s.camera.y += Math.max(-6, Math.min(6, ty - s.camera.y));
    }
  }
}

export function createMall(opts: MallOptions): MallWorld {
  return new MallWorld(opts);
}

export { RESPAWN_INVULN, GRAVITY };
