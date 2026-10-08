import { FEATURES } from '../../../content/layout';
import { STORES, DOOR_X, DOOR_W, type StoreId } from '../../../content/stores';
import { storeStatus } from '../../levelstate';
import type { MallModule, MallWorld } from '../world';

/** The directory map stays up about 4 s; each kiosk then needs about 20 s to cool down. */
export const PANEL_FRAMES = 240;
export const KIOSK_COOLDOWN = 1200;
export const KIOSK_W = 24;
/** The agent may stand this far from the kiosk's centre to use it. */
const REACH = 14;

export interface Kiosk {
  floor: number;
  /** Left edge. */
  x: number;
  /** Frame (w.frame) at which it can be used again. */
  readyAt: number;
}

export interface KioskPanel {
  /** Index into `kiosks`. */
  kiosk: number;
  /** The nearest store that still holds a package, or null when all six are found. */
  target: StoreId | null;
  /** Frames left / total. */
  t: number;
  total: number;
}

/** The store with a package left that is nearest to a kiosk: fewest floors away first, then nearest in x. */
export function nearestPackageStore(w: MallWorld, floor: number, cx: number): StoreId | null {
  let best: { id: StoreId; df: number; dx: number } | null = null;
  for (const s of STORES) {
    if (storeStatus(w.run.level, s.id) !== 'package') continue;
    const df = Math.abs(s.floor - floor);
    const dx = Math.abs(s.x + DOOR_X + DOOR_W / 2 - cx);
    if (!best || df < best.df || (df === best.df && dx < best.dx)) best = { id: s.id, df, dx };
  }
  return best ? best.id : null;
}

/** Directory kiosks (one per shopping floor): Up shows the nearest remaining package store. */
export class KiosksModule implements MallModule {
  readonly kiosks: Kiosk[] = [];
  panel: KioskPanel | null = null;

  constructor() {
    for (const f of FEATURES) if (f.kind === 'kiosk') this.kiosks.push({ floor: f.floor, x: f.x, readyAt: 0 });
  }

  /** Is the kiosk's screen on (somebody just used it)? */
  screenOn(index: number): boolean {
    return this.panel !== null && this.panel.kiosk === index;
  }

  step(): void {
    if (this.panel && --this.panel.t <= 0) this.panel = null;
  }

  interact(w: MallWorld, dir: -1 | 1): boolean {
    if (dir !== -1) return false;
    const p = w.player;
    if (p.floor === null) return false;
    const i = this.kiosks.findIndex((k) => k.floor === p.floor && Math.abs(p.x - (k.x + KIOSK_W / 2)) <= REACH);
    if (i < 0) return false;
    const k = this.kiosks[i]!;
    if (w.frame < k.readyAt) {
      w.run.sfx('buzzer');
      return true;
    }
    k.readyAt = w.frame + PANEL_FRAMES + KIOSK_COOLDOWN;
    this.panel = { kiosk: i, target: nearestPackageStore(w, k.floor, k.x + KIOSK_W / 2), t: PANEL_FRAMES, total: PANEL_FRAMES };
    w.run.sfx('select');
    return true;
  }

  onRespawn(): void {
    this.panel = null;
  }
}
