import { floorY } from '../../../content/layout';
import { SHOUTS } from '../../../content/copy';
import { POINTS } from '../../run';
import type { Bullet } from '../types';
import { PLAYER_HALF_W } from '../types';
import type { MallModule, MallWorld } from '../world';
import type { FxModule, ShotCandidate, ShotSource } from './fx';
import { sgn, sweepDist } from './util';

/** 2F is floor index 3. */
export const WALKER_FLOOR = 3;
export const WALKER_HALF_W = 6;
export const WALKER_H = 24;
/** Two retirees, each with its own stretch of 2F (clear of the shaft openings at 168, 392 and 600) and speed. */
export const WALKER_DEFS: ReadonlyArray<{ min: number; max: number; speed: number }> = [
  { min: 208, max: 384, speed: 0.55 },
  { min: 436, max: 592, speed: 0.8 },
];
const ANGRY_FRAMES = 44;

export interface Walker {
  id: number;
  x: number;
  /** Feet y (the floor they walk on). */
  y: number;
  floor: number;
  face: 1 | -1;
  /** The stretch he paces and his speed (px/frame). */
  min: number;
  max: number;
  speed: number;
  anim: number;
  /** Frames left of standing still and fuming after being shot (no points beyond the first hit, but the bubble stays). */
  angryT: number;
  /** Position change this frame (carries the agent along). */
  dx: number;
}

/** Mall walkers: retirees in tracksuits power-walking set stretches on 2F. They never die, block every bullet and push the agent. */
export class WalkersModule implements MallModule, ShotSource {
  readonly walkers: Walker[] = [];

  constructor(w: MallWorld, private readonly fx: FxModule) {
    const rng = w.rng.fork('walkers');
    WALKER_DEFS.forEach((d, id) => {
      this.walkers.push({
        id,
        x: rng.range(d.min, d.max),
        y: floorY(WALKER_FLOOR),
        floor: WALKER_FLOOR,
        face: rng.chance(0.5) ? 1 : -1,
        min: d.min,
        max: d.max,
        speed: d.speed,
        anim: rng.between(0, 40),
        angryT: 0,
        dx: 0,
      });
    });
  }

  shotCandidate(w: MallWorld, b: Bullet): ShotCandidate | null {
    const fy = floorY(WALKER_FLOOR);
    if (b.y < fy - WALKER_H || b.y > fy) return null;
    let best: Walker | null = null;
    let bestD = Infinity;
    for (const k of this.walkers) {
      const d = sweepDist(b, k.x - WALKER_HALF_W, k.x + WALKER_HALF_W);
      if (d !== null && d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (!best) return null;
    const k = best;
    return {
      dist: bestD,
      resolve: () => {
        // both sides' bullets are stopped; only the agent's cost him
        this.fx.add('spark', b.x + sgn(b.vx) * Math.min(bestD, Math.abs(b.vx)), b.y, 8);
        if (b.owner !== 'player') return;
        w.run.addScore(POINTS.walkerShot);
        w.popup(k.x, k.y, String(POINTS.walkerShot), 0x16);
        w.say(k.x, k.y - 26, SHOUTS.walker, 70);
        w.run.sfx('blip');
        k.angryT = ANGRY_FRAMES;
        k.face = b.vx > 0 ? -1 : 1; // turns to scold the shooter
      },
    };
  }

  step(w: MallWorld): void {
    const p = w.player;
    const pushable = w.playerAlive() && p.mode === 'ground' && p.floor === WALKER_FLOOR && !p.roof;
    for (const k of this.walkers) {
      const x0 = k.x;
      if (k.angryT > 0) k.angryT--;
      else {
        k.x += k.face * k.speed;
        k.anim++;
        if (k.x <= k.min) {
          k.x = k.min;
          k.face = 1;
        } else if (k.x >= k.max) {
          k.x = k.max;
          k.face = -1;
        }
      }
      k.dx = k.x - x0;
      if (pushable) this.push(w, k);
    }
  }

  /** Touching a walker just pushes the agent along (never into a pit: `forSpy` movement honours the shaft rules). */
  private push(w: MallWorld, k: Walker): void {
    const p = w.player;
    const reach = WALKER_HALF_W + PLAYER_HALF_W;
    const d = p.x - k.x;
    if (Math.abs(d) >= reach) return;
    const dir = sgn(d) || k.face;
    const want = k.x + dir * reach;
    const nx = w.tryMoveX(p.x, p.y, want - p.x, true);
    if (Math.abs(nx - want) > 0.01) {
      // pinned against a wall or a shaft: the walker turns back instead of crushing him
      k.face = (dir * -1) as 1 | -1;
    }
    p.x = nx;
  }
}
