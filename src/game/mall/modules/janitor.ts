import type { Rng } from '../../../engine/rng';
import type { Spy } from '../types';
import type { MallModule, MallWorld } from '../world';
import { sgn } from './util';

/** 1F is floor index 4. */
export const JANITOR_FLOOR = 4;
/**
 * The janitor patrols this x range only, and a patch is always centred within [PATCH_MIN_C, JANITOR_MAX_X], so its
 * edges stay in [12, 364]: the first shaft opening on 1F (B) starts at 392, so a wet patch can NEVER reach a shaft.
 */
export const JANITOR_MIN_X = 24;
export const JANITOR_MAX_X = 340;
export const PATCH_W = 48;
export const PATCH_MIN_C = 36;
export const PATCH_FRAMES = 600;
const JANITOR_SPEED = 0.4;
const MOP_FRAMES = 96;
/** The patch is mopped this far in front of him. */
const MOP_REACH = 20;

export type JanitorMode = 'walk' | 'mop';

export interface Janitor {
  x: number;
  floor: number;
  face: 1 | -1;
  mode: JanitorMode;
  /** Frames in the current mode. */
  t: number;
  anim: number;
  /** Frame (w.frame) at or after which he mops next (once no patch is left). */
  nextMop: number;
}

export interface WetPatch {
  /** Centre x. */
  x: number;
  /** Frames left. */
  t: number;
}

/** Where the patch lands for a janitor standing at x facing `face` (always inside the safe zone). */
export function patchCentre(x: number, face: 1 | -1): number {
  return Math.max(PATCH_MIN_C, Math.min(JANITOR_MAX_X, x + face * MOP_REACH));
}

interface SpySlide {
  prevX: number;
  sliding: boolean;
  dir: -1 | 1;
  /** Hit a wall: do not start again until it has left the patch. */
  blocked: boolean;
}

/** The janitor on 1F and his wet patches: anyone entering a patch slides at walking speed until off it. */
export class JanitorModule implements MallModule {
  readonly janitor: Janitor;
  patch: WetPatch | null = null;
  private readonly rng: Rng;
  private agentSliding = false;
  private agentBlocked = false;
  /** We set kick = true for a kick-landing on the patch (clear it again when the slide ends). */
  private agentKick = false;
  private readonly spySlide = new WeakMap<Spy, SpySlide>();

  constructor(w: MallWorld) {
    this.rng = w.rng.fork('janitor');
    this.janitor = {
      x: this.rng.between(JANITOR_MIN_X + 40, JANITOR_MAX_X - 40),
      floor: JANITOR_FLOOR,
      face: this.rng.chance(0.5) ? 1 : -1,
      mode: 'walk',
      t: 0,
      anim: 0,
      nextMop: this.rng.between(240, 600),
    };
  }

  /** Is x on the current patch? */
  onPatch(x: number): boolean {
    return this.patch !== null && Math.abs(x - this.patch.x) < PATCH_W / 2;
  }

  step(w: MallWorld): void {
    this.stepJanitor(w);
    this.stepAgent(w);
    this.stepSpies(w);
  }

  private stepJanitor(w: MallWorld): void {
    const j = this.janitor;
    j.t++;
    j.anim++;
    if (this.patch && --this.patch.t <= 0) {
      this.patch = null;
      j.nextMop = w.frame + this.rng.between(300, 720);
    }
    if (j.mode === 'mop') {
      if (j.t >= MOP_FRAMES) {
        this.patch = { x: patchCentre(j.x, j.face), t: PATCH_FRAMES };
        j.mode = 'walk';
        j.t = 0;
        // walk away from the fresh patch
        j.face = (j.face * -1) as 1 | -1;
      }
      return;
    }
    if (!this.patch && w.frame >= j.nextMop) {
      j.mode = 'mop';
      j.t = 0;
      return;
    }
    if (j.t > 60 && this.rng.chance(0.004)) {
      j.face = (j.face * -1) as 1 | -1;
      j.t = 0;
    }
    j.x += j.face * JANITOR_SPEED;
    if (j.x <= JANITOR_MIN_X) {
      j.x = JANITOR_MIN_X;
      j.face = 1;
    } else if (j.x >= JANITOR_MAX_X) {
      j.x = JANITOR_MAX_X;
      j.face = -1;
    }
  }

  private endAgentSlide(w: MallWorld): void {
    const p = w.player;
    if (this.agentSliding) {
      p.slide = 0;
      if (p.mode === 'ground') p.kick = false; // a grounded agent who is not sliding has no kick
    }
    this.agentSliding = false;
    this.agentKick = false;
  }

  private stepAgent(w: MallWorld): void {
    const p = w.player;
    const alive = w.playerAlive();
    if (!alive || (p.mode !== 'ground' && p.mode !== 'air')) {
      this.endAgentSlide(w);
      this.agentBlocked = false;
      return;
    }
    if (p.mode === 'air') return; // the core carries the slide through a jump
    // grounded
    const here = p.floor === JANITOR_FLOOR && !p.roof && this.onPatch(p.x);
    if (this.agentSliding) {
      if (!here) {
        this.endAgentSlide(w);
        this.agentBlocked = false;
      } else if (p.slide === 0) {
        // the core stopped us at a wall: stay put until we leave the patch
        this.agentSliding = false;
        this.agentBlocked = true;
        p.kick = false;
        this.agentKick = false;
      }
      return;
    }
    if (!here) {
      this.agentBlocked = false;
      return;
    }
    if (this.agentBlocked) return;
    const dir = (sgn(p.vx) || p.face) as 1 | -1;
    p.slide = dir;
    p.face = dir;
    p.ducking = false;
    this.agentSliding = true;
    if (p.landedKick) {
      // a jump-kick landing on the patch keeps kicking while sliding
      p.kick = true;
      this.agentKick = true;
    }
  }

  private stepSpies(w: MallWorld): void {
    const speed = w.spySpeed();
    for (const s of w.spies) {
      let rec = this.spySlide.get(s);
      if (!rec) {
        rec = { prevX: s.x, sliding: false, dir: 1, blocked: false };
        this.spySlide.set(s, rec);
      }
      const eligible = s.mode !== 'dying' && s.mode !== 'emerge' && s.floor === JANITOR_FLOOR;
      const here = eligible && this.onPatch(s.x);
      if (!here) {
        rec.sliding = false;
        rec.blocked = false;
      } else {
        if (!rec.sliding && !rec.blocked) {
          rec.sliding = true;
          rec.dir = (sgn(s.x - rec.prevX) || s.face) as 1 | -1;
        }
        if (rec.sliding) {
          // the spy AI already moved him this frame: replace that step by the slide (walking speed, no stopping or turning)
          const nx = w.tryMoveX(rec.prevX, s.y, rec.dir * speed, true);
          s.face = rec.dir;
          if (nx === rec.prevX) {
            rec.sliding = false;
            rec.blocked = true;
            s.x = rec.prevX;
          } else {
            s.x = nx;
            s.anim++;
          }
        }
      }
      rec.prevX = s.x;
    }
  }

  onRespawn(w: MallWorld): void {
    this.agentSliding = false;
    this.agentBlocked = false;
    this.agentKick = false;
    w.player.slide = 0;
  }
}
