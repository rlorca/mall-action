import { STORES } from './mallLevel.js';
import { roomFor } from './storeRooms.js';
import { rollFixture } from '../logic/loot.js';

export function setupLevel(rng, { loop = 1, blackFriday = false } = {}) {
  const stores = {};
  for (const s of STORES) {
    if (s.role === 'closed') { stores[s.id] = { role: 'closed', fixtures: [] }; continue; }
    const n = roomFor(s).fixtures.length;
    const pkg = s.role === 'target' ? rng.int(0, n - 1) : -1;
    const fixtures = [];
    for (let i = 0; i < n; i++) {
      const c = i === pkg ? { type: 'package' } : rollFixture(rng, s, { blackFriday });
      fixtures.push({ ...c, searched: false });
    }
    stores[s.id] = { role: s.role, fixtures };
  }
  return { loop, stores };
}
