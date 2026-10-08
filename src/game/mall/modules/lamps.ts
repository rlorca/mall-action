import { LAMPS, LAMP_HALF_W, floorY } from '../../../content/layout';
import { openingState, shaftAtX } from '../geometry';
import { PLAYER_HALF_W, SPY_H, SPY_HALF_W, type Bullet } from '../types';
import type { MallModule, MallWorld } from '../world';
import type { FxModule, ShotCandidate, ShotSource } from './fx';
import { sgn, sweepDist } from './util';

/** Floor index of 2F, whose fixtures are disco balls instead of lamps. */
export const DISCO_FLOOR = 3;
/** A hanging fixture's lowest point sits this far above the floor (shade bottom / ball bottom). */
export const HANG_BOTTOM = 22;
/** The cord/shade can be hit by a bullet whose y is within [floorY - HIT_TOP, floorY - HIT_BOTTOM]: a standing shot (y - 16) hits, a ducking one (y - 8) does not. */
export const HIT_TOP = 40;
export const HIT_BOTTOM = 14;
export const FALL_GRAVITY = 0.4;
/** Darkness around a shattered lamp: about +-48 px for about 2 s. */
export const DARK_HALF_W = 48;
export const DARK_FRAMES = 120;
export const DISCO_SPEED = 1.6;
/** Height of the fixture body that crushes (lamp shade 10, disco ball 12). */
const BODY_H = 10;

export type LampKind = 'lamp' | 'disco';
/** hung -> falling -> (lamp) broken | (disco) rolling -> broken (hit a wall) | fell (rolled into a pit). */
export type LampMode = 'hung' | 'falling' | 'rolling' | 'broken' | 'fell';

export interface Lamp {
  id: number;
  kind: LampKind;
  floor: number;
  /** Centre x (a rolling disco ball moves it). */
  x: number;
  homeX: number;
  /** y of the fixture's lowest point. */
  y: number;
  vy: number;
  /** Roll direction while rolling. */
  dir: -1 | 0 | 1;
  mode: LampMode;
  /** Frames in the current mode. */
  t: number;
}

export interface DarkZone {
  floor: number;
  x: number;
  /** Frames left / total (the view fades the last frames). */
  t: number;
  total: number;
}

/** Hanging lamps (4F, 3F, 1F) and disco balls (2F): shoot to drop; they kill, shatter and darken the corridor. */
export class LampsModule implements MallModule, ShotSource {
  readonly lamps: Lamp[] = [];
  readonly dark: DarkZone[] = [];

  constructor(private readonly fx: FxModule) {
    let id = 0;
    for (const [fs, xs] of Object.entries(LAMPS)) {
      const floor = Number(fs);
      for (const x of xs) {
        this.lamps.push({
          id: id++,
          kind: floor === DISCO_FLOOR ? 'disco' : 'lamp',
          floor,
          x,
          homeX: x,
          y: floorY(floor) - HANG_BOTTOM,
          vy: 0,
          dir: 0,
          mode: 'hung',
          t: 0,
        });
      }
    }
  }

  /** Is a bullet at (x, y) inside the lamp's cord/shade hit zone? */
  static hitZone(l: Lamp, b: Pick<Bullet, 'y'>): boolean {
    const fy = floorY(l.floor);
    return b.y >= fy - HIT_TOP && b.y <= fy - HIT_BOTTOM;
  }

  shotCandidate(w: MallWorld, b: Bullet): ShotCandidate | null {
    if (b.owner !== 'player') return null; // spy bullets pass
    let best: Lamp | null = null;
    let bestD = Infinity;
    for (const l of this.lamps) {
      if (l.mode !== 'hung' || !LampsModule.hitZone(l, b)) continue;
      const d = sweepDist(b, l.x - LAMP_HALF_W, l.x + LAMP_HALF_W);
      if (d !== null && d < bestD) {
        bestD = d;
        best = l;
      }
    }
    if (!best) return null;
    const lamp = best;
    return { dist: bestD, resolve: () => this.release(w, lamp, sgn(b.vx) || 1) };
  }

  /** Cut the cord: the fixture starts to fall (a disco ball will roll in `dir` afterwards). */
  release(w: MallWorld, l: Lamp, dir: -1 | 1): void {
    if (l.mode !== 'hung') return;
    l.mode = 'falling';
    l.t = 0;
    l.vy = 0;
    l.dir = dir;
    w.run.sfx('lampFall');
  }

  step(w: MallWorld): void {
    for (let i = this.dark.length - 1; i >= 0; i--) if (--this.dark[i]!.t <= 0) this.dark.splice(i, 1);
    for (const l of this.lamps) {
      if (l.mode === 'falling') this.stepFalling(w, l);
      else if (l.mode === 'rolling') this.stepRolling(w, l);
      else if (l.mode === 'fell') {
        l.vy += FALL_GRAVITY;
        l.y += l.vy;
        l.t++;
      } else l.t++;
    }
  }

  private stepFalling(w: MallWorld, l: Lamp): void {
    l.t++;
    l.vy += FALL_GRAVITY;
    l.y += l.vy;
    const fy = floorY(l.floor);
    if (l.y >= fy) l.y = fy;
    this.crush(w, l);
    if (l.y < fy) return;
    // reached the floor
    if (l.kind === 'lamp') {
      this.shatter(w, l, true);
    } else {
      l.mode = 'rolling';
      l.t = 0;
      l.vy = 0;
      w.run.sfx('discoRoll');
      w.addShake(3);
    }
  }

  private stepRolling(w: MallWorld, l: Lamp): void {
    l.t++;
    if (l.t % 24 === 0) w.run.sfx('discoRoll');
    const fy = floorY(l.floor);
    const nx = w.tryMoveX(l.x, fy, l.dir * DISCO_SPEED);
    if (nx === l.x) {
      // a wall (or a car in the doorway): the ball stops and shatters
      this.shatter(w, l, false);
      return;
    }
    l.x = nx;
    // a pit (shaft opening whose car is away): it drops out of sight
    const s = shaftAtX(l.x, l.floor);
    if (s && openingState(w.car(s.id), l.floor) === 'pit') {
      l.mode = 'fell';
      l.t = 0;
      l.vy = 0;
      return;
    }
    this.crush(w, l);
  }

  private shatter(w: MallWorld, l: Lamp, darken: boolean): void {
    l.mode = 'broken';
    l.t = 0;
    l.vy = 0;
    l.dir = 0;
    w.run.sfx('glass');
    w.addShake(darken ? 6 : 4);
    this.fx.add('glass', l.x, floorY(l.floor) - 4);
    if (darken) this.dark.push({ floor: l.floor, x: l.x, t: DARK_FRAMES, total: DARK_FRAMES });
  }

  /** Kill whatever the falling lamp / rolling ball is on top of. */
  private crush(w: MallWorld, l: Lamp): void {
    const half = LAMP_HALF_W + SPY_HALF_W - 1;
    const top = l.y - BODY_H;
    for (const s of w.spies) {
      if (s.mode === 'dying' || s.mode === 'emerge') continue;
      if (Math.abs(s.x - l.x) >= half) continue;
      if (s.y < top || s.y - SPY_H > l.y) continue;
      w.killSpy(s, l.kind === 'disco' ? 'disco' : 'lamp');
    }
    const p = w.player;
    if (w.playerAlive() && p.mode !== 'hidden' && p.mode !== 'ride' && p.mode !== 'escalator' && w.playerVisible()) {
      if (Math.abs(p.x - l.x) < LAMP_HALF_W + PLAYER_HALF_W - 1 && p.y >= top && w.hitboxTop() <= l.y) {
        w.hurtPlayer(l.kind === 'disco' ? 'disco' : 'lamp', false);
      }
    }
  }

  /** The agent died: a falling lamp lands and goes out at once, a rolling ball is gone, darkness ends. */
  onRespawn(): void {
    this.dark.length = 0;
    for (const l of this.lamps) {
      if (l.mode === 'falling' || l.mode === 'rolling') {
        l.mode = 'broken';
        l.y = floorY(l.floor);
        l.t = 0;
        l.vy = 0;
        l.dir = 0;
      }
    }
  }
}
