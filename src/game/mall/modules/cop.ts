import { floorY } from '../../../content/layout';
import { SHOUTS } from '../../../content/copy';
import type { Rng } from '../../../engine/rng';
import { POINTS } from '../../run';
import type { Bullet } from '../types';
import type { MallModule, MallWorld } from '../world';
import type { FxModule, ShotCandidate, ShotSource } from './fx';
import { floorSegments, segmentAt, sgn, sweepDist } from './util';

/** The shopping floors he patrols: 4F, 3F, 2F, 1F. */
export const COP_FLOORS: readonly number[] = [1, 2, 3, 4];
export const COP_HALF_W = 11;
export const COP_H = 24;
/** He notices a shot fired in front of him within this distance (same floor, facing the agent). */
export const COP_SIGHT = 128;
export const CHASE_FRAMES = 600;
export const FREEZE_FRAMES = 180;
export const PATROL_SPEED = 0.6;
export const CHASE_SPEED = 1.45;
/** After arresting (or losing) him he wanders off and ignores shots for this long. */
export const CALM_FRAMES = 300;
const WHISTLE_FRAMES = 44;
/** Catch distance (x) and how high the agent's feet may be above the Segway. */
const CATCH_DX = 14;
const CATCH_ABOVE = 18;

export type CopMode = 'patrol' | 'chase' | 'calm';

export interface Cop {
  x: number;
  floor: number;
  face: 1 | -1;
  mode: CopMode;
  /** Frames in the current mode. */
  t: number;
  /** Frames of chase left. */
  chaseT: number;
  anim: number;
  /** Frames of the whistle pose still to show. */
  whistleT: number;
  /** Frames standing still (patrol pauses). */
  pauseT: number;
  /** Frame (w.frame) at or after which he may change floor (when nobody is looking). */
  nextHop: number;
  /** Frames during which a shot in front of him is ignored (just calmed down). */
  ignoreT: number;
}

/** The neutral mall cop on his Segway: whistles and chases if provoked, freezes the agent for 3 s and fines him 500. */
export class CopModule implements MallModule, ShotSource {
  readonly cop: Cop;
  private readonly rng: Rng;
  private readonly segCache = new Map<number, Array<[number, number]>>();

  constructor(w: MallWorld, private readonly fx: FxModule) {
    this.rng = w.rng.fork('cop');
    const floor = this.rng.pick(COP_FLOORS);
    const seg = this.rng.pick(this.segments(floor));
    this.cop = {
      x: this.rng.range(seg[0], seg[1]),
      floor,
      face: this.rng.chance(0.5) ? 1 : -1,
      mode: 'patrol',
      t: 0,
      chaseT: 0,
      anim: 0,
      whistleT: 0,
      pauseT: 0,
      nextHop: this.rng.between(1500, 3000),
      ignoreT: 0,
    };
  }

  /** The free stretches of a floor between the shaft openings and the walls (he never uses the shafts). */
  segments(floor: number): Array<[number, number]> {
    let s = this.segCache.get(floor);
    if (!s) {
      s = floorSegments(floor, COP_HALF_W);
      this.segCache.set(floor, s);
    }
    return s;
  }

  get y(): number {
    return floorY(this.cop.floor);
  }

  shotCandidate(w: MallWorld, b: Bullet): ShotCandidate | null {
    const c = this.cop;
    if (b.y < this.y - COP_H || b.y > this.y) return null;
    const d = sweepDist(b, c.x - COP_HALF_W, c.x + COP_HALF_W);
    if (d === null) return null;
    return {
      dist: d,
      resolve: () => {
        w.run.sfx('helmetPing');
        this.fx.add('spark', b.x + sgn(b.vx) * Math.min(d, Math.abs(b.vx)), b.y, 10);
        if (b.owner === 'player' && c.mode === 'patrol') this.provoke(w);
      },
    };
  }

  /** Blow the whistle and give chase. */
  provoke(w: MallWorld): void {
    const c = this.cop;
    c.mode = 'chase';
    c.t = 0;
    c.chaseT = CHASE_FRAMES;
    c.whistleT = WHISTLE_FRAMES;
    c.pauseT = 0;
    c.face = (sgn(w.player.x - c.x) || c.face) as 1 | -1;
    w.run.sfx('whistle');
    w.say(c.x, this.y - 28, SHOUTS.cop, 110);
  }

  /** The agent fired this frame (the core sets shootPose to 8 exactly then, even for a 3-way spread). */
  private firedThisFrame(w: MallWorld): boolean {
    return w.player.shootPose === 8 && (w.player.mode === 'ground' || w.player.mode === 'air');
  }

  step(w: MallWorld): void {
    const c = this.cop;
    const p = w.player;
    c.t++;
    c.anim++;
    if (c.whistleT > 0) c.whistleT--;
    if (c.ignoreT > 0) c.ignoreT--;

    // ---- provoked by a shot fired in front of him?
    if (c.mode === 'patrol' && c.ignoreT <= 0 && w.playerVisible() && this.firedThisFrame(w) && (p.floor === c.floor || (p.mode === 'air' && w.playerFloor() === c.floor))) {
      const dx = p.x - c.x;
      if (Math.abs(dx) <= COP_SIGHT && sgn(dx) === c.face) this.provoke(w);
    }

    switch (c.mode) {
      case 'patrol':
        this.patrol(w);
        break;
      case 'chase':
        this.chase(w);
        break;
      case 'calm':
        this.calm();
        break;
    }
  }

  private move(dir: -1 | 1, speed: number): boolean {
    const c = this.cop;
    const [lo, hi] = segmentAt(this.segments(c.floor), c.x);
    const nx = c.x + dir * speed;
    if (nx < lo || nx > hi) {
      c.x = Math.max(lo, Math.min(hi, nx));
      return false;
    }
    c.x = nx;
    return true;
  }

  private patrol(w: MallWorld): void {
    const c = this.cop;
    if (c.pauseT > 0) {
      c.pauseT--;
      return;
    }
    this.maybeHop(w);
    if (!this.move(c.face, PATROL_SPEED)) {
      c.face = (c.face * -1) as 1 | -1;
      c.pauseT = this.rng.between(20, 80);
    } else if (this.rng.chance(0.004)) {
      c.pauseT = this.rng.between(40, 140);
      if (this.rng.chance(0.4)) c.face = (c.face * -1) as 1 | -1;
    }
  }

  /** Now and then he moves on to another floor, but only when nobody is watching. */
  private maybeHop(w: MallWorld): void {
    const c = this.cop;
    if (w.frame < c.nextHop) return;
    const p = w.player;
    const pf = w.playerFloor();
    const watched = (floor: number, x: number): boolean => Math.abs(floor - pf) <= 1 && Math.abs(x - p.x) < 300;
    if (watched(c.floor, c.x)) {
      c.nextHop = w.frame + 120;
      return;
    }
    for (let tries = 0; tries < 8; tries++) {
      const floor = this.rng.pick(COP_FLOORS);
      if (floor === c.floor) continue;
      const seg = this.rng.pick(this.segments(floor));
      const x = this.rng.range(seg[0], seg[1]);
      if (watched(floor, x)) continue;
      c.floor = floor;
      c.x = x;
      c.face = this.rng.chance(0.5) ? 1 : -1;
      break;
    }
    c.nextHop = w.frame + this.rng.between(1500, 3000);
  }

  private chase(w: MallWorld): void {
    const c = this.cop;
    const p = w.player;
    if (--c.chaseT <= 0 || !w.playerAlive()) {
      this.calmDown(w);
      return;
    }
    const dx = p.x - c.x;
    if (c.whistleT <= 0) {
      if (Math.abs(dx) > 2) {
        c.face = sgn(dx) as 1 | -1;
        this.move(c.face, CHASE_SPEED);
      }
    } else if (Math.abs(dx) > 2) c.face = sgn(dx) as 1 | -1; // the whistle stops him for a moment
    // caught?
    const catchable = w.playerVisible() && (p.mode === 'ground' || p.mode === 'air') && p.frozen <= 0;
    if (catchable && Math.abs(p.x - c.x) < CATCH_DX && p.y > this.y - CATCH_ABOVE && p.y <= this.y + 4) {
      this.arrest(w);
    }
  }

  /** Frozen for 3 s and fined 500 points: NOT a life. */
  arrest(w: MallWorld): void {
    const p = w.player;
    p.frozen = FREEZE_FRAMES;
    p.vx = 0;
    w.run.addScore(POINTS.caughtByCop);
    w.popup(p.x, p.y - 30, String(POINTS.caughtByCop), 0x16);
    w.showBanner(SHOUTS.detained, 150, undefined, 0x28);
    w.run.sfx('whistle');
    w.addShake(3);
    this.calmDown(w);
  }

  private calmDown(w: MallWorld): void {
    const c = this.cop;
    c.mode = 'calm';
    c.t = 0;
    c.chaseT = 0;
    c.ignoreT = CALM_FRAMES;
    // wander off, away from the agent
    c.face = (sgn(c.x - w.player.x) || c.face) as 1 | -1;
  }

  private calm(): void {
    const c = this.cop;
    if (!this.move(c.face, PATROL_SPEED)) c.face = (c.face * -1) as 1 | -1;
    if (c.t >= CALM_FRAMES) {
      c.mode = 'patrol';
      c.t = 0;
      c.pauseT = 0;
    }
  }

  /** The agent died: the cop calms down and wanders off. */
  onRespawn(w: MallWorld): void {
    const c = this.cop;
    if (c.mode === 'chase') this.calmDown(w);
    c.whistleT = 0;
  }
}
