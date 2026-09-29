/** Level setup: decides what every fixture holds. Seeded and pure. */
import { Rng } from '../core/rng';
import { STORES, type StoreDef } from './layout';
import { roomFor } from './rooms';
import { randomPower, type PowerKind } from './powerups';
import type { StoreId } from '../art/manifest';

export type Content = { t: 'package' } | { t: 'power'; k: PowerKind } | { t: 'trap' } | { t: 'nothing' };

export interface StoreRuntime {
  id: StoreId;
  cleared: boolean;
  contents: Content[];
  opened: boolean[];
  toysReleased: boolean[];
}

export function isOpenStore(def: StoreDef, rt: StoreRuntime | undefined): boolean {
  if (def.role === 'closed') return false;
  if (def.role === 'target') return !!rt && !rt.cleared;
  return true;
}

export function setupStores(rng: Rng, blackFriday: boolean): Record<string, StoreRuntime> {
  const out: Record<string, StoreRuntime> = {};
  for (const def of STORES) {
    if (def.role === 'closed') continue;
    const room = roomFor(def.id);
    const n = room.fixtures.length;
    const food = def.id === 'hotspy' ? 0.8 : 0.25;
    const contents: Content[] = [];
    const pkg = def.role === 'target' ? rng.int(n) : -1;
    for (let i = 0; i < n; i++) {
      if (i === pkg) {
        contents.push({ t: 'package' });
      } else if (blackFriday) {
        contents.push({ t: 'power', k: randomPower(rng, { food }) });
      } else if (def.role === 'powerup') {
        contents.push(rng.chance(0.55) ? { t: 'power', k: randomPower(rng, { food }) } : { t: 'nothing' });
      } else {
        const r = rng.next();
        if (r < 0.28) contents.push({ t: 'power', k: randomPower(rng, { food }) });
        else if (r < 0.5) contents.push({ t: 'trap' });
        else contents.push({ t: 'nothing' });
      }
    }
    out[def.id] = {
      id: def.id,
      cleared: false,
      contents,
      opened: new Array(n).fill(false),
      toysReleased: new Array(n).fill(false),
    };
  }
  return out;
}
