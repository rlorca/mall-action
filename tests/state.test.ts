import { describe, it, expect } from 'vitest';
import { createInitialState, getFloorY, getFloorFromY } from '../src/game/state';
import { FloorId, GameScreen, Direction, FPS } from '../src/engine/types';

describe('GameState', () => {
  it('createInitialState returns a valid state with given seed', () => {
    const state = createInitialState(42);
    expect(state.seed).toBe(42);
    expect(state.frame).toBe(0);
    expect(state.loop).toBe(1);
    expect(state.screen).toBe(GameScreen.Splash);
  });

  it('debug mode starts at Mall screen', () => {
    const state = createInitialState(42, true);
    expect(state.screen).toBe(GameScreen.Mall);
    expect(state.debug).toBe(true);
  });

  it('initial player has 3 lives', () => {
    const state = createInitialState(42);
    expect(state.player.lives).toBe(3);
  });

  it('initial player has 3 continues', () => {
    const state = createInitialState(42);
    expect(state.player.continues).toBe(3);
  });

  it('initial player starts at score 0', () => {
    const state = createInitialState(42);
    expect(state.player.score).toBe(0);
  });

  it('initial player faces right', () => {
    const state = createInitialState(42);
    expect(state.player.direction).toBe(Direction.Right);
  });

  it('initial player is on the ground and not jumping', () => {
    const state = createInitialState(42);
    expect(state.player.onGround).toBe(true);
    expect(state.player.jumping).toBe(false);
  });

  it('creates 3 elevators', () => {
    const state = createInitialState(42);
    expect(state.elevators).toHaveLength(3);
  });

  it('elevator A serves Roof to 2F', () => {
    const state = createInitialState(42);
    const elA = state.elevators.find(e => e.shaft === 'A')!;
    expect(elA.floorsServed).toContain(FloorId.Roof);
    expect(elA.floorsServed).toContain(FloorId.F4);
    expect(elA.floorsServed).toContain(FloorId.F3);
    expect(elA.floorsServed).toContain(FloorId.F2);
    expect(elA.floorsServed).not.toContain(FloorId.F1);
    expect(elA.floorsServed).not.toContain(FloorId.Parking);
  });

  it('elevator B serves 4F to Parking (only way to Parking)', () => {
    const state = createInitialState(42);
    const elB = state.elevators.find(e => e.shaft === 'B')!;
    expect(elB.floorsServed).toContain(FloorId.F4);
    expect(elB.floorsServed).toContain(FloorId.Parking);
    expect(elB.floorsServed).not.toContain(FloorId.Roof);
  });

  it('elevator C serves Roof to 1F', () => {
    const state = createInitialState(42);
    const elC = state.elevators.find(e => e.shaft === 'C')!;
    expect(elC.floorsServed).toContain(FloorId.Roof);
    expect(elC.floorsServed).toContain(FloorId.F1);
    expect(elC.floorsServed).not.toContain(FloorId.Parking);
  });

  it('elevator C is the auto elevator with a timer', () => {
    const state = createInitialState(42);
    const elC = state.elevators.find(e => e.shaft === 'C')!;
    expect(elC.autoTimer).toBeGreaterThan(0);
  });

  it('creates 2 escalators', () => {
    const state = createInitialState(42);
    expect(state.escalators).toHaveLength(2);
  });

  it('escalator connects 3F and 4F', () => {
    const state = createInitialState(42);
    const esc = state.escalators.find(e =>
      e.topFloor === FloorId.F4 && e.bottomFloor === FloorId.F3
    );
    expect(esc).toBeDefined();
  });

  it('escalator connects 1F and 2F', () => {
    const state = createInitialState(42);
    const esc = state.escalators.find(e =>
      e.topFloor === FloorId.F2 && e.bottomFloor === FloorId.F1
    );
    expect(esc).toBeDefined();
  });

  it('alarm timer starts at ~150 seconds', () => {
    const state = createInitialState(42);
    expect(state.alarmTimer).toBe(150 * FPS);
  });

  it('total packages is 6', () => {
    const state = createInitialState(42);
    expect(state.totalPackages).toBe(6);
  });

  it('spies array starts empty', () => {
    const state = createInitialState(42);
    expect(state.spies).toHaveLength(0);
  });

  it('spy spawn timer starts at ~5 seconds', () => {
    const state = createInitialState(42);
    expect(state.spySpawnTimer).toBe(5 * FPS);
  });

  it('creates fountains on 3F and 1F', () => {
    const state = createInitialState(42);
    expect(state.fountains).toHaveLength(2);
    expect(state.fountains.map(f => f.floor)).toContain(FloorId.F3);
    expect(state.fountains.map(f => f.floor)).toContain(FloorId.F1);
  });

  it('creates NPCs including janitor, walkers, and mall cop', () => {
    const state = createInitialState(42);
    const types = state.npcs.map(n => n.type);
    expect(types).toContain('janitor');
    expect(types).toContain('mall_walker');
    expect(types).toContain('mall_cop');
  });

  it('janitor is on 1F', () => {
    const state = createInitialState(42);
    const jan = state.npcs.find(n => n.type === 'janitor')!;
    expect(jan.floor).toBe(FloorId.F1);
  });

  it('mall walkers are on 2F', () => {
    const state = createInitialState(42);
    const walkers = state.npcs.filter(n => n.type === 'mall_walker');
    expect(walkers.length).toBe(2);
    walkers.forEach(w => expect(w.floor).toBe(FloorId.F2));
  });

  it('lamps on 2F are disco balls', () => {
    const state = createInitialState(42);
    const discos = state.lamps.filter(l => l.isDisco);
    expect(discos.length).toBeGreaterThan(0);
    discos.forEach(d => expect(d.floor).toBe(FloorId.F2));
  });

  it('CRT is enabled by default', () => {
    const state = createInitialState(42);
    expect(state.crtEnabled).toBe(true);
  });
});

describe('Floor Y calculations', () => {
  it('getFloorY returns consistent values', () => {
    expect(getFloorY(FloorId.Roof)).toBe(16);
    expect(getFloorY(FloorId.F4)).toBe(64);
    expect(getFloorY(FloorId.F3)).toBe(112);
    expect(getFloorY(FloorId.F2)).toBe(160);
    expect(getFloorY(FloorId.F1)).toBe(208);
    expect(getFloorY(FloorId.Parking)).toBe(256);
  });

  it('floors are 48px apart', () => {
    const roof = getFloorY(FloorId.Roof);
    const f4 = getFloorY(FloorId.F4);
    expect(f4 - roof).toBe(48);
  });

  it('getFloorFromY roundtrips with getFloorY', () => {
    for (let f = FloorId.Roof; f <= FloorId.Parking; f++) {
      expect(getFloorFromY(getFloorY(f as FloorId))).toBe(f);
    }
  });
});
