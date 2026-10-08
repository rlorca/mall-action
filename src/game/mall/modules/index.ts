import type { MallWorld } from '../world';
import { BoothModule } from './booth';
import { CopModule } from './cop';
import { FountainsModule } from './fountains';
import { FxModule, ShotRouter } from './fx';
import { JanitorModule } from './janitor';
import { KiosksModule } from './kiosks';
import { LampsModule } from './lamps';
import { WalkersModule } from './walkers';

/**
 * NPCs, lights and street furniture of the mall, plugged into MallWorld as modules (brief 5.6 / 5.7).
 * `installExtras(w)` registers every module on `w.modules` and stores the typed state on `w.extras`; the renderer
 * (src/render/mallActorsView.ts) only READS this state. Every field is public and mutable so tests can set up a
 * scene directly (put a lamp in `falling`, a patch under the agent, the cop on a floor...).
 */
export interface MallExtras {
  readonly installed: boolean;
  /** Short cosmetic effects: bullet sparks and glass bursts (`fx.items`). */
  readonly fx: FxModule;
  /** Hanging lamps and 2F disco balls (`lamps.lamps`) and the darkened corridor sections (`lamps.dark`). */
  readonly lamps: LampsModule;
  /** The janitor on 1F (`janitor.janitor`) and the current wet patch (`janitor.patch`, null when dry). */
  readonly janitor: JanitorModule;
  /** The two mall walkers on 2F (`walkers.walkers`). */
  readonly walkers: WalkersModule;
  /** The mall cop (`cop.cop`). */
  readonly cop: CopModule;
  /** Directory kiosks (`kiosks.kiosks`) and the map panel being shown (`kiosks.panel`). */
  readonly kiosks: KiosksModule;
  /** The 3F photo booth (`booth.occupied`) and the photo strip popup (`booth.strip`). */
  readonly booth: BoothModule;
  /** The fountains (`fountains.fountains`). */
  readonly fountains: FountainsModule;
}

export function installExtras(w: MallWorld): MallExtras {
  if (w.extras) return w.extras;
  const fx = new FxModule();
  const lamps = new LampsModule(fx);
  const janitor = new JanitorModule(w);
  const walkers = new WalkersModule(w, fx);
  const cop = new CopModule(w, fx);
  const kiosks = new KiosksModule();
  const booth = new BoothModule();
  const fountains = new FountainsModule(w);
  const router = new ShotRouter([lamps, walkers, cop, fountains]);

  // Order matters only for state that reads the same frame's results: shots are routed first, then the world's NPCs.
  w.modules.push(fx, router, lamps, janitor, walkers, cop, kiosks, booth, fountains);
  const extras: MallExtras = { installed: true, fx, lamps, janitor, walkers, cop, kiosks, booth, fountains };
  w.extras = extras;
  return extras;
}
