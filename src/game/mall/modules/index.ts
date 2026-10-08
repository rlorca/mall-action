import type { MallWorld } from '../world';

/**
 * NPCs, lights and street furniture of the mall, plugged into MallWorld as modules.
 * OWNER: the mall-extras agent replaces this stub. `installExtras(w)` registers every module on `w.modules`
 * and stores the typed state on `w.extras` so the renderer can read it.
 */
export interface MallExtras {
  /** Typed state for the renderer lives here (lamps, discos, janitor, walkers, cop, kiosks, booth, fountains...). */
  readonly installed: boolean;
}

export function installExtras(w: MallWorld): MallExtras {
  const extras: MallExtras = { installed: false };
  w.extras = extras;
  return extras;
}
