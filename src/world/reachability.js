import { SHAFTS, ESCALATORS } from './mallLevel.js';
import { FLOORS } from './constants.js';

export function floorGraph() {
  const g = new Map(Array.from({ length: FLOORS }, (_, i) => [i, new Set()]));
  const link = (a, b) => { g.get(a).add(b); g.get(b).add(a); };
  for (const s of SHAFTS) for (let f = s.minFloor; f < s.maxFloor; f++) link(f, f + 1);
  for (const e of ESCALATORS) link(e.bottomFloor, e.topFloor);
  return g;
}
export function reachableFloors(start = 0) {
  const g = floorGraph(); const seen = new Set([start]); const q = [start];
  while (q.length) for (const n of g.get(q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  return seen;
}
