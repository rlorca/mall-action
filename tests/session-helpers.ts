// Helpers for Session tests: a headless driver plus cheats that work through the public state.
import { EventBuffer, type StoreId } from '../src/core/events';
import { PadTracker, type Buttons } from '../src/core/pad';
import { FLOOR_Y } from '../src/game/geometry';
import { LAYOUT, STORE_LAYOUT_BY_ID } from '../src/game/mall/layout';
import { Session, type SessionOptions } from '../src/game/session';
import type { Floor } from '../src/data/stores';
import { TILE } from '../src/game/geometry';

export const SIX: readonly StoreId[] = ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlockpicker'];

export class SessionDriver {
  readonly s: Session;
  readonly tracker = new PadTracker();
  buf = new EventBuffer();
  highScores: number[] = [];
  constructor(opts: Partial<SessionOptions> = {}) {
    this.s = new Session({ seed: 1, highScore: 0, skipSplash: true, onHighScore: (n) => this.highScores.push(n), ...opts });
  }
  step(held: Partial<Buttons> = {}, n = 1): void {
    for (let i = 0; i < n; i++) this.s.step(this.tracker.next(held), this.buf);
  }
  /** Press for one frame, then release for `gap` frames. */
  tap(b: keyof Buttons, gap = 1): void {
    this.step({ [b]: true });
    this.step({}, gap);
  }
  /** Step (buttons per frame from `held`) until pred() holds; returns frames used. Throws after `max`. */
  until(pred: () => boolean, max = 2000, held: (i: number) => Partial<Buttons> = () => ({})): number {
    for (let i = 0; i < max; i++) {
      if (pred()) return i;
      this.step(held(i));
    }
    if (pred()) return max;
    throw new Error(`condition not reached in ${max} frames (scene ${this.s.scene})`);
  }
  /** Drain and return the events emitted since the last call. */
  events(): EventBuffer['events'] {
    return this.buf.drain();
  }
  music(): (string | null)[] {
    return this.buf.events.filter((e) => e.t === 'music').map((e) => (e as { name: string | null }).name);
  }
}

/** Title -> Start -> fade -> zip-line arrival -> skip the selfie -> player has control in the mall. */
export function toPlay(d: SessionDriver): void {
  d.step({}, 3);
  d.tap('start');
  d.until(() => d.s.scene === 'play' && d.s.mall?.s.phase === 'play' && !d.s.fading, 1500, (i) => (i % 40 === 0 ? { b: true } : {}));
  d.step({}, 2);
}

/** Make the mall harmless and stationary so scripted tests are not disturbed. */
export function quietMall(d: SessionDriver): void {
  const w = d.s.mall!;
  w.s.nextSpawnAt = 1e9;
  w.s.nextPaAt = 1e9;
  w.s.spies.length = 0;
  w.s.cop.floor = 'P';
  w.s.cop.x = 10;
  w.s.cop.relocateIn = 1e9;
  w.s.cop.cool = 1e9;
}

/** Teleport the mall player to stand on a floor. */
export function place(d: SessionDriver, floor: Floor, x: number): void {
  const p = d.s.mall!.s.player;
  p.mode = 'walk';
  p.floor = floor;
  p.x = x;
  p.y = FLOOR_Y[floor];
  p.vx = 0;
  p.vy = 0;
  p.duck = false;
  p.hidden = false;
  p.slide = 0;
  p.kick = false;
  p.carId = null;
  p.safeX = x;
  p.safeFloor = floor;
  p.invuln = 0;
}

export function doorOf(id: StoreId): number {
  return STORE_LAYOUT_BY_ID[id].doorX;
}

/** Walk to a store door via teleport and press Up; wait until the store scene is fully in (fade done). */
export function enterStore(d: SessionDriver, id: StoreId, floor: Floor): void {
  place(d, floor, doorOf(id));
  d.step({ up: true });
  d.step({});
  d.until(() => d.s.playMode === 'store' && !d.s.fading, 200);
}

/** Put the player at the store door row and step out. */
export function leaveStore(d: SessionDriver): void {
  const st = d.s.store!;
  st.player.y = (st.room.h - 1) * TILE;
  d.step({ down: true });
  d.until(() => d.s.playMode === 'mall' && !d.s.fading, 200);
}

/** Take all 6 packages and stand at the getaway car; hold Up until the level clear scene begins. */
export function driveAway(d: SessionDriver): void {
  const w = d.s.mall!;
  for (const id of SIX) if (!w.progress.packages.includes(id)) w.progress.packages.push(id);
  place(d, 'P', LAYOUT.wagon.x - 10);
  d.until(() => d.s.scene === 'levelclear', 300, (i) => ({ up: i % 2 === 0 }));
}

/** Kill the mall player with an enemy bullet. */
export function shootPlayer(d: SessionDriver): void {
  const w = d.s.mall!;
  w.s.player.invuln = 0;
  w.progress.power.armor = false;
  w.s.bullets.push({ id: 900 + w.s.idSeq++, x: w.s.player.x + 12, y: w.s.player.y - 18, vx: -2, vy: 0, owner: 'spy', volley: 0, spent: false });
}

/** Lose all remaining lives in the mall until the Continue / Game Over scene appears. */
export function loseAllLives(d: SessionDriver, target: 'continue' | 'gameover' = 'continue'): void {
  const w = d.s.mall!;
  w.progress.lives = 1;
  place(d, w.s.player.floor ?? '4F', w.s.player.x);
  shootPlayer(d);
  d.until(() => d.s.scene !== 'play', 400);
  void target;
}
