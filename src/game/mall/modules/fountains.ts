import { FEATURES, floorY } from '../../../content/layout';
import type { Rng } from '../../../engine/rng';
import type { Bullet } from '../types';
import type { MallModule, MallWorld } from '../world';
import type { ShotCandidate, ShotSource } from './fx';
import { sweepDist } from './util';

export const FOUNTAIN_H = 24;
export const FOUNTAIN_COOLDOWN = 900;
/** One spray in twenty includes a gold coin (an extra life). */
export const GOLD_CHANCE = 1 / 20;
export const COIN_LIFE = 60 * 12;
/** Frames the water jet animation shows after a spray. */
export const SPRAY_FRAMES = 40;

export interface Fountain {
  floor: number;
  /** Left edge and width. */
  x: number;
  w: number;
  /** Frames of cool-down left (0 = ready). */
  cool: number;
  /** Frames of spray animation left. */
  spray: number;
}

/** The mall fountains (3F, 1F): a player shot sprays 3 to 5 bouncing coins, then it cools down for about 15 s. */
export class FountainsModule implements MallModule, ShotSource {
  readonly fountains: Fountain[] = [];
  private readonly rng: Rng;

  constructor(w: MallWorld) {
    this.rng = w.rng.fork('fountains');
    for (const f of FEATURES) if (f.kind === 'fountain') this.fountains.push({ floor: f.floor, x: f.x, w: f.w, cool: 0, spray: 0 });
  }

  shotCandidate(w: MallWorld, b: Bullet): ShotCandidate | null {
    if (b.owner !== 'player') return null;
    let best: Fountain | null = null;
    let bestD = Infinity;
    for (const f of this.fountains) {
      if (f.cool > 0) continue; // while cooling, bullets pass through the (dry) basin
      const fy = floorY(f.floor);
      if (b.y < fy - FOUNTAIN_H || b.y > fy) continue;
      const d = sweepDist(b, f.x, f.x + f.w);
      if (d !== null && d < bestD) {
        bestD = d;
        best = f;
      }
    }
    if (!best) return null;
    const f = best;
    return { dist: bestD, resolve: () => this.sprayCoins(w, f) };
  }

  /** 3 to 5 coins worth 50 each fly out of the basin; one spray in twenty includes a gold coin (extra life). */
  sprayCoins(w: MallWorld, f: Fountain): void {
    const n = this.rng.between(3, 5);
    const gold = this.rng.chance(GOLD_CHANCE) ? this.rng.int(n) : -1;
    const cx = f.x + f.w / 2;
    const fy = floorY(f.floor);
    for (let i = 0; i < n; i++) {
      // Fan the coins out evenly with a little jitter. The arc is low on purpose: the ceiling is only 40 px above the
      // floor and the core's pickup physics would land a coin that rose past the slab on the floor above.
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      w.spawnPickup({
        x: cx + t * 8,
        y: fy - FOUNTAIN_H,
        kind: i === gold ? 'goldcoin' : 'coin',
        vx: t * 2.4 + this.rng.range(-0.3, 0.3),
        vy: -this.rng.range(1.7, 2.3),
        onGround: false,
        life: COIN_LIFE,
      });
    }
    f.cool = FOUNTAIN_COOLDOWN;
    f.spray = SPRAY_FRAMES;
    w.run.sfx('splash');
  }

  step(): void {
    for (const f of this.fountains) {
      if (f.cool > 0) f.cool--;
      if (f.spray > 0) f.spray--;
    }
  }
}
