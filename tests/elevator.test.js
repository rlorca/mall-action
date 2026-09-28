import { describe, it, expect } from 'vitest';
import { createCar, carFloor, updateCar, doorwayState, crushVictims, aiCommand, CAR_H } from '../src/logic/elevator.js';
import { feetY } from '../src/world/constants.js';
import { createRng } from '../src/core/rng.js';

const shaft = { id: 'T', x: 100, minFloor: 1, maxFloor: 4, startFloor: 2, ai: false };

describe('car movement', () => {
  it('starts aligned at startFloor', () => {
    const c = createCar(shaft); expect(carFloor(c)).toBe(2);
  });
  it('moves 1 px per frame while commanded', () => {
    const c = createCar(shaft); const r = updateCar(c, 1);
    expect(r.dy).toBe(1); expect(carFloor(c)).toBeNull();
  });
  it('glides to the next floor after release and stops once', () => {
    const c = createCar(shaft);
    for (let i = 0; i < 10; i++) updateCar(c, 1);
    const stops = [];
    for (let i = 0; i < 60; i++) { const r = updateCar(c, 0); if (r.stopped !== null) stops.push(r.stopped); }
    expect(c.y).toBe(feetY(3)); expect(stops).toEqual([3]);
  });
  it('does not stop at intermediate floors while held, and clamps at the end once', () => {
    const c = createCar(shaft); const stops = [];
    for (let i = 0; i < 200; i++) { const r = updateCar(c, 1); if (r.stopped !== null) stops.push(r.stopped); }
    expect(c.y).toBe(feetY(4)); expect(stops).toEqual([4]);
  });
  it('AI car picks another floor, travels, waits', () => {
    const c = createCar({ ...shaft, ai: true }); const rng = createRng(3); const stops = [];
    for (let i = 0; i < 600; i++) { const r = updateCar(c, aiCommand(c, rng)); if (r.stopped !== null) stops.push(r.stopped); }
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[0]).not.toBe(2);
  });
});

describe('doorways', () => {
  it('reports car / solid / pit / none', () => {
    const c = createCar(shaft); // at floor 2
    expect(doorwayState(c, 2)).toBe('car');
    expect(doorwayState(c, 3)).toBe('solid'); // car above floor 3
    expect(doorwayState(c, 1)).toBe('pit');   // car below floor 1
    expect(doorwayState(c, 0)).toBe('none');  // shaft doesn't reach
  });
});

describe('crush', () => {
  const ent = (o) => ({ x: 112, y: feetY(3), w: 12, h: 24, riding: null, onRoof: null, ...o });
  it('descending car crushes someone standing in the doorway below', () => {
    const c = createCar(shaft); const victim = ent();
    let hit = [];
    for (let i = 0; i < 48 && !hit.length; i++) { const { dy } = updateCar(c, 1); hit = crushVictims(c, dy, [victim]); }
    expect(hit).toEqual([victim]);
    expect(c.y).toBeLessThan(feetY(3));
  });
  it('does not crush passengers or people outside the shaft', () => {
    const c = createCar(shaft);
    const rider = ent({ y: c.y, riding: 'T' }); const outside = ent({ x: 140 });
    for (let i = 0; i < 48; i++) { const { dy } = updateCar(c, 1); expect(crushVictims(c, dy, [rider, outside])).toEqual([]); rider.y = c.y; }
  });
  it('roof rider is crushed near the top of the shaft', () => {
    const c = createCar({ ...shaft, startFloor: 2 });
    const rider = ent({ y: c.y - CAR_H, onRoof: 'T' });
    let hit = [];
    for (let i = 0; i < 48 && !hit.length; i++) { const { dy } = updateCar(c, -1); rider.y = c.y - CAR_H; hit = crushVictims(c, dy, [rider]); }
    expect(hit).toEqual([rider]);
  });
});
