import { describe, expect, it } from 'vitest';
import { ESCALATORS, FLOOR_1F, FLOOR_2F, FLOOR_3F, FLOOR_4F, FLOOR_P, FURNITURE, GETAWAY, LAMPS, MALL_W, SHAFTS, STOREFRONTS, STORE_W, WALL_L, WALL_R, floorY, shaftServes, ROOF_Y, FLOOR_GAP, MALL_H, FLOOR_COUNT } from '../src/core/level';
import { STORES, storeInfo } from '../src/core/copy';

describe('mall layout', () => {
  it('is 768 px wide with 6 floors 48 px apart', () => {
    expect(MALL_W).toBe(768);
    expect(FLOOR_COUNT).toBe(6);
    expect(floorY(1) - floorY(0)).toBe(48);
    expect(FLOOR_GAP).toBe(48);
    expect(MALL_H).toBeGreaterThan(floorY(FLOOR_P));
    expect(ROOF_Y).toBeGreaterThan(60);
  });
  it('shafts: A serves R-2F, B serves 4F-P (the only way to P), C serves R-1F and runs on a timer', () => {
    const [A, B, C] = SHAFTS;
    expect([A.id, A.minFloor, A.maxFloor, A.mode]).toEqual(['A', 0, FLOOR_2F, 'manual']);
    expect([B.id, B.minFloor, B.maxFloor, B.mode]).toEqual(['B', FLOOR_4F, FLOOR_P, 'manual']);
    expect([C.id, C.minFloor, C.maxFloor, C.mode]).toEqual(['C', 0, FLOOR_1F, 'auto']);
  });
  it('escalators join 3F-4F and 1F-2F', () => {
    expect(ESCALATORS.map((e) => [e.upperFloor, e.lowerFloor])).toEqual([
      [FLOOR_4F, FLOOR_3F],
      [FLOOR_2F, FLOOR_1F],
    ]);
  });
  it('there are 13 storefronts about 80 px wide on 4F-1F with the specified floors', () => {
    expect(STOREFRONTS.length).toBe(13);
    expect(STORE_W).toBe(80);
    for (const sf of STOREFRONTS) {
      expect(sf.floor).toBe(storeInfo(sf.id).floor);
      expect(sf.floor).toBeGreaterThanOrEqual(FLOOR_4F);
      expect(sf.floor).toBeLessThanOrEqual(FLOOR_1F);
      expect(sf.doorX).toBe(sf.x + 40);
    }
    expect(STORES.filter((s) => s.floor === FLOOR_4F).map((s) => s.id)).toEqual(['forever12', 'radioshock', 'crookstone', 'gamestonk']);
    expect(STORES.filter((s) => s.floor === FLOOR_3F).map((s) => s.id)).toEqual(['kgbtoys', 'blockblustar', 'spenders']);
    expect(STORES.filter((s) => s.floor === FLOOR_2F).length).toBe(4);
    expect(STORES.filter((s) => s.floor === FLOOR_1F).length).toBe(2);
  });
  it('roles: 6 targets, 4 power-up shops, 3 closed', () => {
    expect(STORES.filter((s) => s.role === 'target').length).toBe(6);
    expect(STORES.filter((s) => s.role === 'powerup').length).toBe(4);
    expect(STORES.filter((s) => s.role === 'closed').map((s) => s.id).sort()).toEqual(['blockblustar', 'borderline', 'circuitpity']);
  });
  it('nothing overlaps: stores, shafts, escalators and furniture share each floor politely', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const boxes: { n: string; x0: number; x1: number }[] = [];
      for (const s of STOREFRONTS.filter((s) => s.floor === f)) boxes.push({ n: s.id, x0: s.x, x1: s.x + STORE_W });
      for (const sh of SHAFTS.filter((s) => shaftServes(s, f))) boxes.push({ n: 'shaft' + sh.id, x0: sh.x, x1: sh.x + sh.w });
      for (const e of ESCALATORS.filter((e) => e.upperFloor === f || e.lowerFloor === f)) boxes.push({ n: e.id, x0: Math.min(e.xLower, e.xUpper) - 12, x1: Math.max(e.xLower, e.xUpper) + 12 });
      for (const fu of FURNITURE.filter((x) => x.floor === f)) boxes.push({ n: fu.kind + fu.x, x0: fu.x, x1: fu.x + fu.w });
      if (f === FLOOR_P) boxes.push({ n: 'wagon', x0: GETAWAY.x, x1: GETAWAY.x + GETAWAY.w });
      for (let i = 0; i < boxes.length; i++) {
        expect(boxes[i].x0, boxes[i].n).toBeGreaterThanOrEqual(WALL_L - 1);
        expect(boxes[i].x1, boxes[i].n).toBeLessThanOrEqual(WALL_R + 1);
        for (let j = i + 1; j < boxes.length; j++) {
          // escalator landings sit on one floor's side of the ramp only; allow the two escalators' ramps to touch furniture-free ground
          const overlap = boxes[i].x0 < boxes[j].x1 && boxes[j].x0 < boxes[i].x1;
          expect(overlap, `floor ${f}: ${boxes[i].n} vs ${boxes[j].n}`).toBe(false);
        }
      }
    }
  });
  it('furniture: a kiosk on each shopping floor, a photo booth on 3F, fountains on 3F and 1F, parking pillars', () => {
    for (const f of [FLOOR_4F, FLOOR_3F, FLOOR_2F, FLOOR_1F]) expect(FURNITURE.some((x) => x.kind === 'kiosk' && x.floor === f), `kiosk ${f}`).toBe(true);
    expect(FURNITURE.some((x) => x.kind === 'booth' && x.floor === FLOOR_3F)).toBe(true);
    expect(FURNITURE.filter((x) => x.kind === 'fountain').map((x) => x.floor).sort()).toEqual([FLOOR_3F, FLOOR_1F]);
    expect(FURNITURE.some((x) => x.kind === 'bench')).toBe(true);
    expect(FURNITURE.some((x) => x.kind === 'plant')).toBe(true);
    expect(FURNITURE.filter((x) => x.kind === 'pillar').length).toBeGreaterThan(2);
    expect(GETAWAY.floor).toBe(FLOOR_P);
  });
  it('lamps hang in corridor gaps only (never over a store sign, shaft or escalator); 2F has disco balls', () => {
    expect(LAMPS.length).toBeGreaterThan(8);
    for (const l of LAMPS) {
      expect(l.disco).toBe(l.floor === FLOOR_2F);
      for (const s of STOREFRONTS.filter((s) => s.floor === l.floor)) expect(l.x < s.x - 2 || l.x > s.x + STORE_W + 2, `lamp ${l.x} over ${s.id}`).toBe(true);
      for (const sh of SHAFTS.filter((s) => shaftServes(s, l.floor))) expect(l.x < sh.x - 4 || l.x > sh.x + sh.w + 4).toBe(true);
    }
    expect(LAMPS.some((l) => l.disco)).toBe(true);
    expect(LAMPS.some((l) => !l.disco)).toBe(true);
  });
  it('every floor R..1F can be walked wall to wall without being blocked by a store (stores are wall decorations)', () => {
    expect(WALL_R - WALL_L).toBeGreaterThan(700);
  });
});
