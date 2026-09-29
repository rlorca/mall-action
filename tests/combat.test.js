import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall } from '../src/game/mallWorld.js';
import { createSpy } from '../src/game/spies.js';
import { createGameState } from '../src/game/state.js';
import { feetY } from '../src/world/constants.js';
import { applyPowerup } from '../src/logic/powerups.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
function setup() {
  const state = createGameState({ seed: 2 }); const world = createMallWorld(state);
  world.cars.forEach((c) => { c.ai = false; });
  world.spawnT = 1e9; world.cop = null; world.walkers = []; world.janitor = null;
  const p = world.player; Object.assign(p, { mode: 'ground', introT: 0, x: 200, floor: 1, y: feetY(1) });
  return { state, world, p };
}
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };

describe('combat', () => {
  it('shooting a standing spy kills it and scores 100', () => {
    const { state, world, p } = setup(); p.facing = 1;
    const s = createSpy(260, 1, 'door'); Object.assign(s, { state: 'walk', fireT: 999, dodge: false }); world.spies.push(s);
    run(world, state, pad([], ['a']), 1); run(world, state, NONE, 30);
    expect(s.state).toBe('dead'); expect(state.score).toBe(100);
  });
  it('max two bullets without rapid fire', () => {
    const { state, world } = setup();
    for (let i = 0; i < 40; i++) run(world, state, pad([], ['a']), 1);
    expect(world.bullets.filter((b) => b.owner === 'player').length).toBeLessThanOrEqual(2);
  });
  it('ducking dodges a high shot; standing does not', () => {
    const { state, world, p } = setup();
    world.enemyBullets.push({ x: 230, y: p.y - 18, vx: -2, vy: 0, floor: 1, w: 4, h: 2, owner: 'enemy', life: 90 });
    const ev = run(world, state, pad(['down']), 30);
    expect(ev.some((e) => e.type === 'sfx' && e.name === 'death')).toBe(false);
    world.enemyBullets.push({ x: 230, y: p.y - 18, vx: -2, vy: 0, floor: 1, w: 4, h: 2, owner: 'enemy', life: 90 });
    const ev2 = run(world, state, NONE, 30);
    expect(ev2.some((e) => e.type === 'sfx' && e.name === 'death')).toBe(true);
  });
  it('armor absorbs one shot', () => {
    const { state, world, p } = setup(); applyPowerup(state.power, 'armor');
    world.enemyBullets.push({ x: 230, y: p.y - 10, vx: -2, vy: 0, floor: 1, w: 4, h: 2, owner: 'enemy', life: 90 });
    run(world, state, NONE, 30);
    expect(p.mode).toBe('ground'); expect(state.power.armor).toBeNull();
  });
  it('shooting a lamp drops it on a spy below for 300', () => {
    const { state, world, p } = setup();
    const lamp = world.lights.find((l) => l.floor === 1 && l.x === 300);
    Object.assign(p, { x: 250, facing: 1 });
    // spy stands just past the lamp so the bullet reaches the lamp first, but the falling lamp (±8 px) still lands on him
    const s = createSpy(308, 1, 'door'); Object.assign(s, { state: 'wait', t: 999, fireT: 999, dodge: false }); world.spies.push(s);
    run(world, state, pad([], ['a']), 1);
    run(world, state, NONE, 90);
    expect(lamp.state).toBe('broken'); expect(s.state).toBe('dead'); expect(state.score).toBe(300);
  });
  it('a shot disco ball drops, rolls in the shot direction and flattens a spy for 300', () => {
    const { state, world, p } = setup();
    Object.assign(p, { x: 110, floor: 3, y: feetY(3), facing: 1 });
    const ball = world.lights.find((l) => l.floor === 3 && l.x === 160);
    const s = createSpy(220, 3, 'door'); Object.assign(s, { state: 'wait', t: 999, fireT: 999, dodge: false }); world.spies.push(s);
    run(world, state, pad([], ['a']), 1);
    run(world, state, NONE, 90);
    expect(s.state).toBe('dead'); expect(state.score).toBe(300);
    expect(['rolling', 'broken']).toContain(ball.state);
  });
  it('spies dodge only a small share of shots (most straight shots land)', () => {
    let kills = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const state = createGameState({ seed }); const world = createMallWorld(state);
      world.cars.forEach((c) => { c.ai = false; }); world.spawnT = 1e9; world.cop = null; world.walkers = []; world.janitor = null;
      Object.assign(world.player, { mode: 'ground', introT: 0, x: 200, floor: 1, y: feetY(1), facing: 1 });
      const s = createSpy(270, 1, 'door'); Object.assign(s, { state: 'walk', fireT: 999 }); world.spies.push(s);
      run(world, state, pad([], ['a']), 1); run(world, state, NONE, 40);
      if (s.state === 'dead') kills++;
    }
    expect(kills).toBeGreaterThanOrEqual(85);
  });
  it('a freshly spawned spy gives you ~2 s before its first shot, with a long aim warning', () => {
    const { state, world, p } = setup();
    world.spawnT = 1; // spawn now, next to a store door near the player
    Object.assign(p, { x: 120, floor: 1, y: feetY(1) }); // radioshock door at 216 is in spawn range
    let firstShot = null, aimStart = null;
    for (let f = 1; f <= 400 && firstShot === null; f++) {
      stepMall(world, NONE, state, state.rng);
      const s = world.spies[0];
      if (s && s.state === 'aim' && aimStart === null) aimStart = f;
      if (world.enemyBullets.length) firstShot = f;
    }
    expect(world.spies.length).toBe(1);
    expect(firstShot).toBeGreaterThanOrEqual(120);
    expect(firstShot - aimStart).toBeGreaterThanOrEqual(30);
  });
  it('player bullets outrun enemy bullets', () => {
    const { state, world } = setup();
    run(world, state, pad([], ['a']), 1);
    expect(Math.abs(world.bullets[0].vx)).toBeGreaterThanOrEqual(4);
  });
});
