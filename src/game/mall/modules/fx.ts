import type { Bullet } from '../types';
import type { MallModule, MallWorld } from '../world';

/** Short cosmetic effects the renderer draws (bullet sparks, glass bursts). Deterministic frame counters only. */
export interface Fx {
  kind: 'spark' | 'glass';
  x: number;
  y: number;
  t: number;
  total: number;
}

export class FxModule implements MallModule {
  items: Fx[] = [];

  add(kind: Fx['kind'], x: number, y: number, frames = kind === 'glass' ? 28 : 12): void {
    this.items.push({ kind, x, y, t: frames, total: frames });
  }

  step(): void {
    for (let i = this.items.length - 1; i >= 0; i--) if (--this.items[i]!.t <= 0) this.items.splice(i, 1);
  }

  onRespawn(): void {
    this.items.length = 0;
  }
}

/**
 * A thing a bullet can hit this frame. The shot router picks the NEAREST candidate along the bullet's path across all
 * modules, so a walker standing under a lamp takes the shot, not whichever module happens to be registered first.
 */
export interface ShotCandidate {
  /** Distance along x from the bullet to the target (0 = already inside). */
  dist: number;
  /** Apply the hit; the bullet is consumed afterwards. */
  resolve(): void;
}

export interface ShotSource {
  shotCandidate(w: MallWorld, b: Bullet): ShotCandidate | null;
}

export class ShotRouter implements MallModule {
  constructor(private readonly sources: ShotSource[]) {}

  step(): void {}

  onBullet(w: MallWorld, b: Bullet): boolean {
    let best: ShotCandidate | null = null;
    for (const s of this.sources) {
      const c = s.shotCandidate(w, b);
      if (c && (!best || c.dist < best.dist)) best = c;
    }
    if (!best) return false;
    best.resolve();
    return true;
  }
}
