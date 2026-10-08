import type { Run } from '../run';
import { STORE_IDS, type StoreId } from '../../content/stores';
import { storeStatus, type StoreStatus } from '../levelstate';
import type { ShaftId } from '../../content/layout';
import type { MapData } from './mapdata';

/**
 * The MALL DIRECTORY overlay needs no state of its own (the Game decides when Select opens and closes it,
 * and `MapData.frame` drives the blinking), so this file only offers a helper that fills a MapData from
 * the Run and the mall world. The drawing lives in `render/mapView.ts` (`drawMapView(fb, data)`).
 */
export function buildMapData(
  run: Run,
  frame: number,
  cars: ReadonlyArray<{ shaft: ShaftId; y: number }>,
  player: { x: number; y: number; inStore: StoreId | null },
): MapData {
  const statuses = {} as Record<StoreId, StoreStatus>;
  for (const id of STORE_IDS) statuses[id] = storeStatus(run.level, id);
  return {
    frame,
    cars: cars.map((c) => ({ shaft: c.shaft, y: c.y })),
    player: { ...player },
    statuses,
    radar: run.power.radar,
    inventory: run.inventoryLine(),
    blackFriday: run.blackFriday,
  };
}
