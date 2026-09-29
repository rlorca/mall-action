import { GameState, StoreState } from './state';
import { STORES } from '../data/stores';
import { STORE_LAYOUTS } from '../data/layouts';
import { StoreRole } from '../engine/types';

export function initStores(state: GameState): void {
  state.stores.clear();

  for (const store of STORES) {
    if (store.role === StoreRole.Closed) continue;

    const layout = STORE_LAYOUTS[store.id];
    const fixtureCount = layout ? layout.fixtureContents.length : 0;

    let packageIndex = -1;
    if (layout) {
      packageIndex = layout.fixtureContents.indexOf('package');
    }

    const storeState: StoreState = {
      id: store.id,
      entered: false,
      cleared: false,
      fixturesSearched: new Array(fixtureCount).fill(false),
      guardsAlive: [],
      firstVisitPlayed: false,
      packageIndex,
    };

    state.stores.set(store.id, storeState);
  }
}

export function resetStoresForNewLoop(state: GameState): void {
  for (const [, store] of state.stores) {
    store.entered = false;
    store.cleared = false;
    store.fixturesSearched.fill(false);
    store.guardsAlive = [];
    store.firstVisitPlayed = false;
  }
}
