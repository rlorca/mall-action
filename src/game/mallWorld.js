import { floorTop } from '../world/constants.js';
import { SHAFTS, LIGHTS, KIOSKS, FOUNTAINS } from '../world/mallLevel.js';
import { createCar, updateCar, aiCommand, crushVictims, CAR_H } from '../logic/elevator.js';
import { tickPowerups } from '../logic/powerups.js';
import { createPlayer, stepPlayer, killPlayer } from './mallPlayer.js';

export function createMallWorld() {
  return {
    frame: 0,
    cars: SHAFTS.map(createCar),
    player: createPlayer(),
    playerCarCmd: 0,
    spies: [], bullets: [], enemyBullets: [], pickups: [], coins: [], fx: [],
    lights: LIGHTS.map((l, i) => ({ ...l, id: i, state: 'hanging', y: floorTop(l.floor) + 4, vy: 0, rollDir: 0, t: 0 })),
    wet: [], janitor: null, walkers: [], cop: null,
    kioskCooldown: KIOSKS.map(() => 0), fountainCooldown: FOUNTAINS.map(() => 0),
    spawnT: 120, alarm: false, banner: null, dark: null, exiting: false,
    upHooks: [],
  };
}

function stepCars(world, state, rng, ev) {
  const p = world.player;
  for (const car of world.cars) {
    const playerDriving = p.mode === 'car' && p.riding === car.id;
    const cmd = playerDriving ? world.playerCarCmd : car.ai ? aiCommand(car, rng) : 0;
    const { dy, stopped } = updateCar(car, cmd);
    if (stopped !== null) ev.push({ type: 'carStopped', carId: car.id, floor: stopped, withPlayer: playerDriving });
    if (!dy) continue;
    if (p.riding === car.id) p.y = car.y;
    if (p.onRoof === car.id) p.y = car.y - CAR_H;
    if (crushVictims(car, dy, [p]).length) killPlayer(p, 'crush', state, ev);
  }
}

export function stepMall(world, pad, state, rng) {
  const ev = [];
  world.frame++;
  state.levelFrames++;
  tickPowerups(state.power);
  stepCars(world, state, rng, ev);
  ev.push(...stepPlayer(world.player, pad, world, state));
  return ev;
}
