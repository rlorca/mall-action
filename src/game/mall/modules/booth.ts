import { Btn } from '../../../engine/pad';
import type { Pad } from '../../../engine/pad';
import { FEATURES } from '../../../content/layout';
import type { MallModule, MallWorld } from '../world';

export const BOOTH_FRAMES = 300;
export const BOOTH_W = 24;
/** The photo strip pops up for this long; its 4 frames appear one after the other. */
export const STRIP_FRAMES = 200;
export const STRIP_CELLS = 4;
const REACH = 12;
/** Ignore the exit keys for the first few frames so the Up press that went in cannot also pop him out. */
const MIN_INSIDE = 12;

export interface PhotoStrip {
  /** World position of the agent when he came out (the strip pops up above his head). */
  x: number;
  y: number;
  /** Frames since it popped up / total. */
  t: number;
  total: number;
}

/** The photo booth on 3F: Up hides the agent for up to 5 s; spies ignore him. */
export class BoothModule implements MallModule {
  /** Left edge and floor of the booth. */
  readonly x: number;
  readonly floor: number;
  /** Frames the agent has been inside (0 = nobody inside). */
  inside = 0;
  strip: PhotoStrip | null = null;
  /** The input of the current step (the core's hidden state never shows it to modules, see installExtras). */
  pad: Pad | null = null;

  constructor() {
    const f = FEATURES.find((k) => k.kind === 'booth')!;
    this.x = f.x;
    this.floor = f.floor;
  }

  /** Is somebody in the booth (curtain closed)? */
  get occupied(): boolean {
    return this.inside > 0;
  }

  interact(w: MallWorld, dir: -1 | 1): boolean {
    if (dir !== -1) return false;
    const p = w.player;
    if (p.floor !== this.floor || Math.abs(p.x - (this.x + BOOTH_W / 2)) > REACH) return false;
    p.x = this.x + BOOTH_W / 2;
    w.hidePlayer(BOOTH_FRAMES);
    this.inside = 1;
    w.run.sfx('door');
    return true;
  }

  step(w: MallWorld): void {
    if (this.strip && ++this.strip.t >= this.strip.total) this.strip = null;
    if (this.inside === 0) return;
    const p = w.player;
    if (p.mode === 'hidden') {
      this.inside++;
      const pad = this.pad;
      if (this.inside > MIN_INSIDE && pad && pad.held & (Btn.DOWN | Btn.LEFT | Btn.RIGHT)) w.unhidePlayer();
      if (p.mode === 'hidden') return;
    }
    // He is out (pressed a key, the 5 s ran out, or the world took him out of the booth)
    const normal = p.mode === 'ground' && w.playerAlive();
    this.inside = 0;
    if (normal && !w.run.photoStrip) {
      w.run.photoStrip = true;
      w.run.sfx('camera');
      this.strip = { x: p.x, y: p.y, t: 0, total: STRIP_FRAMES };
    }
  }

  onRespawn(): void {
    this.inside = 0;
    this.strip = null;
  }
}
