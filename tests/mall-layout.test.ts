import { describe, it, expect } from 'vitest';
import { FLOORS, STORES, STORE_BY_ID, type Floor } from '../src/data/stores';
import { LIMITS } from '../src/data/copy';
import { FLOOR_Y, LEVEL_W, SHAFT_W, STOREFRONT_W } from '../src/game/geometry';
import { LAYOUT, SHAFTS, ESCALATORS, STORE_LAYOUTS, LAMPS, DISCO_BALLS, JANITOR, connections, shaftsOn, storesOn, type Rect } from '../src/game/mall/layout';
import { MALL_COPY } from '../src/game/mall/copy';
import { makeWorld, place, quiet, stepFrames } from './mall-helpers';

interface Span {
  name: string;
  x0: number;
  x1: number;
}
function spansOn(f: Floor): Span[] {
  const out: Span[] = [];
  for (const s of storesOn(f)) out.push({ name: `store:${s.id}`, x0: s.x, x1: s.x + s.w });
  for (const s of shaftsOn(f)) out.push({ name: `shaft:${s.id}`, x0: s.x, x1: s.x + s.w });
  for (const e of ESCALATORS) if (e.lower === f || e.upper === f) out.push({ name: `esc:${e.id}`, x0: e.x0 - 8, x1: e.x1 + 8 });
  for (const k of LAYOUT.kiosks) if (k.floor === f) out.push({ name: 'kiosk', x0: k.x - k.w / 2, x1: k.x + k.w / 2 });
  if (LAYOUT.booth.floor === f) out.push({ name: 'booth', x0: LAYOUT.booth.x - LAYOUT.booth.w / 2, x1: LAYOUT.booth.x + LAYOUT.booth.w / 2 });
  for (const k of LAYOUT.fountains) if (k.floor === f) out.push({ name: 'fountain', x0: k.x - k.w / 2, x1: k.x + k.w / 2 });
  if (LAYOUT.wagon.floor === f) out.push({ name: 'wagon', x0: LAYOUT.wagon.x - LAYOUT.wagon.w / 2, x1: LAYOUT.wagon.x + LAYOUT.wagon.w / 2 });
  for (const d of LAYOUT.decor) if (d.floor === f) out.push({ name: `decor:${d.kind}`, x0: d.x - d.w / 2, x1: d.x + d.w / 2 });
  return out;
}
const rectsOverlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('mall layout', () => {
  it('has 6 floors 48 px apart and the mall is 768 wide', () => {
    expect(LAYOUT.width).toBe(768);
    expect(LAYOUT.width).toBe(LEVEL_W);
    expect(FLOORS).toEqual(['R', '4F', '3F', '2F', '1F', 'P']);
    for (let i = 1; i < FLOORS.length; i++) expect(FLOOR_Y[FLOORS[i]] - FLOOR_Y[FLOORS[i - 1]]).toBe(48);
  });

  it('shafts A (R..2F), B (4F..P), C (R..1F) at fixed x with SHAFT_W', () => {
    const by = Object.fromEntries(SHAFTS.map((s) => [s.id, s]));
    expect(by.A.floors).toEqual(['R', '4F', '3F', '2F']);
    expect(by.B.floors).toEqual(['4F', '3F', '2F', '1F', 'P']);
    expect(by.C.floors).toEqual(['R', '4F', '3F', '2F', '1F']);
    for (const s of SHAFTS) expect(s.w).toBe(SHAFT_W);
    expect(by.C.auto).toBe(true);
    expect(by.A.auto).toBe(false);
  });

  it('has all 13 storefronts, 80 px wide, door centred, on the data-table floors, inside the level', () => {
    expect(STORE_LAYOUTS).toHaveLength(13);
    for (const s of STORE_LAYOUTS) {
      expect(s.floor).toBe(STORE_BY_ID[s.id].floor);
      expect(s.w).toBe(STOREFRONT_W);
      expect(s.doorX).toBe(s.x + 40);
      expect(s.x).toBeGreaterThanOrEqual(8);
      expect(s.x + s.w).toBeLessThanOrEqual(LEVEL_W - 8);
      expect(s.rect.y + s.rect.h).toBe(FLOOR_Y[s.floor]);
    }
    expect(new Set(STORE_LAYOUTS.map((s) => s.id)).size).toBe(STORES.length);
  });

  it('nothing on a floor overlaps anything else (stores, shafts, escalators, kiosks, booth, fountains, decor)', () => {
    for (const f of FLOORS) {
      const spans = spansOn(f);
      for (let i = 0; i < spans.length; i++)
        for (let j = i + 1; j < spans.length; j++) {
          const a = spans[i];
          const b = spans[j];
          const overlap = a.x0 < b.x1 && b.x0 < a.x1;
          expect(overlap, `${f}: ${a.name} overlaps ${b.name}`).toBe(false);
        }
      for (const s of spans) {
        expect(s.x0, `${f} ${s.name}`).toBeGreaterThanOrEqual(0);
        expect(s.x1, `${f} ${s.name}`).toBeLessThanOrEqual(LEVEL_W);
      }
    }
  });

  it('lamps hang in corridor gaps: never over a storefront sign, never in a shaft opening; disco balls only on 2F', () => {
    for (const l of LAMPS) {
      expect(l.floor).not.toBe('2F');
      const rect: Rect = { x: l.x - 5, y: FLOOR_Y[l.floor] - 44, w: 10, h: 18 };
      for (const st of STORE_LAYOUTS) expect(rectsOverlap(rect, st.sign), `lamp ${l.id} vs sign ${st.id}`).toBe(false);
      for (const st of STORE_LAYOUTS) if (st.floor === l.floor) expect(l.x + 5 <= st.x || l.x - 5 >= st.x + st.w, `${l.id} under ${st.id}`).toBe(true);
      for (const sh of shaftsOn(l.floor)) expect(l.x + 5 <= sh.x || l.x - 5 >= sh.x + sh.w).toBe(true);
    }
    expect(DISCO_BALLS.length).toBeGreaterThan(2);
    for (const d of DISCO_BALLS) {
      expect(d.floor).toBe('2F');
      for (const st of storesOn('2F')) expect(d.x + 6 <= st.x || d.x - 6 >= st.x + st.w).toBe(true);
    }
  });

  it('has kiosks on 4F..1F, the photo booth on 3F, fountains on 3F and 1F, the wagon on P', () => {
    expect(LAYOUT.kiosks.map((k) => k.floor).sort()).toEqual(['1F', '2F', '3F', '4F']);
    expect(LAYOUT.booth.floor).toBe('3F');
    expect(LAYOUT.fountains.map((f) => f.floor).sort()).toEqual(['1F', '3F']);
    expect(LAYOUT.wagon.floor).toBe('P');
    expect(ESCALATORS.map((e) => [e.lower, e.upper])).toEqual([['3F', '4F'], ['1F', '2F']]);
  });

  it('every floor is reachable from the roof (shafts + escalators); B is the only way to P', () => {
    const reach = (skip: string | null): Set<Floor> => {
      const seen = new Set<Floor>(['R']);
      const q: Floor[] = ['R'];
      const edges = connections().filter((e) => e.via !== skip);
      while (q.length) {
        const f = q.shift()!;
        for (const e of edges) if (e.from === f && !seen.has(e.to)) (seen.add(e.to), q.push(e.to));
      }
      return seen;
    };
    expect([...reach(null)].sort()).toEqual([...FLOORS].sort());
    expect(reach('B').has('P')).toBe(false);
    // and it still works without any single other route
    for (const skip of ['A', 'C', 'E1', 'E2']) expect(reach(skip).has('P')).toBe(true);
  });

  it('roof: A and C reach the roof, cable ends at an anchor post, skyscraper at the left edge', () => {
    expect(SHAFTS.filter((s) => s.topFloor === 'R').map((s) => s.id)).toEqual(['A', 'C']);
    expect(LAYOUT.zip.startX).toBeLessThan(LAYOUT.zip.postX);
    expect(LAYOUT.zip.skyscraper.x).toBe(0);
    expect(LAYOUT.zip.letGoX).toBeLessThan(LAYOUT.zip.postX);
    expect(LAYOUT.zip.letGoX).toBeGreaterThan(LAYOUT.zip.postX - 40);
  });

  it('the janitor patch is ~48 px and never reaches a shaft opening (4000 frames, several seeds)', () => {
    for (const seed of [1, 2, 3]) {
      const w = makeWorld(seed);
      quiet(w);
      place(w, 'P', 30);
      w.s.player.invuln = 1e9;
      const seen = new Set<number>();
      for (let i = 0; i < 4000; i += 20) {
        stepFrames(w, 20);
        for (const p of w.s.wetPatches) {
          seen.add(p.x0);
          expect(p.x1 - p.x0).toBe(JANITOR.patchW);
          for (const sh of shaftsOn(p.floor)) expect(p.x1 <= sh.x - 8 || p.x0 >= sh.x + sh.w + 8).toBe(true);
        }
      }
      expect(seen.size).toBeGreaterThan(2);
    }
  });

  it('mall copy fits its limits', () => {
    const lines = [...MALL_COPY.levelClear, ...MALL_COPY.photoStrip, MALL_COPY.kioskCooling, MALL_COPY.kioskNone, MALL_COPY.goldCoin, MALL_COPY.detained];
    for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(LIMITS.banner);
  });
});
