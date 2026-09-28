import { SHAFTS, LIGHTS, KIOSKS, FOUNTAINS } from '../world/mallLevel.js';
import { createCar, updateCar, aiCommand, crushVictims, CAR_H } from '../logic/elevator.js';
import { tickPowerups } from '../logic/powerups.js';
import { difficulty } from '../logic/rules.js';
import { createPlayer, stepPlayer, killPlayer } from './mallPlayer.js';
import { stepSpies, spyFromCar, killSpy, alive } from './spies.js';
import { firePlayer, stepBullets, playerContacts } from './combat.js';
import { stepLights, lampTop } from './lights.js';

export function createMallWorld() {
  return {
    frame: 0,
    cars: SHAFTS.map(createCar),
    player: createPlayer(),
    playerCarCmd: 0,
    spies: [], bullets: [], enemyBullets: [], pickups: [], coins: [], fx: [],
    lights: LIGHTS.map((l, i) => ({ ...l, id: i, state: 'hanging', y: lampTop(l.floor), vy: 0, rollDir: 0, t: 0 })),
    wet: [], janitor: null, walkers: [], cop: null,
    kioskCooldown: KIOSKS.map(() => 0), fountainCooldown: FOUNTAINS.map(() => 0),
    spawnT: 300, alarm: false, banner: null, dark: null, exiting: false,
    upHooks: [],
  };
}

export const currentDifficulty = (world, state) => difficulty(state.loop, { blackFriday: state.blackFriday, alarm: world.alarm });

function stepCars(world, state, rng, ev) {
  const p = world.player;
  for (const car of world.cars) {
    const playerDriving = p.mode === 'car' && p.riding === car.id;
    const cmd = playerDriving ? world.playerCarCmd : car.ai ? aiCommand(car, rng) : 0;
    const { dy, stopped } = updateCar(car, cmd);
    if (stopped !== null) {
      ev.push({ type: 'carStopped', carId: car.id, floor: stopped, withPlayer: playerDriving });
      if (!playerDriving) spyFromCar(world, car, stopped, rng, currentDifficulty(world, state));
    }
    if (!dy) continue;
    if (p.riding === car.id) p.y = car.y;
    if (p.onRoof === car.id) p.y = car.y - CAR_H;
    const victims = crushVictims(car, dy, [p, ...world.spies.filter(alive)]);
    for (const v of victims) {
      if (v === p) killPlayer(p, 'crush', state, ev);
      else if (killSpy(world, v, 'spyCrushed', state, ev)) ev.push({ type: 'sfx', name: 'crush' }, { type: 'shake', frames: 6 });
    }
  }
}

export function stepMall(world, pad, state, rng) {
  const ev = [];
  world.frame++;
  state.levelFrames++;
  tickPowerups(state.power);
  const diff = currentDifficulty(world, state);
  stepCars(world, state, rng, ev);
  ev.push(...stepPlayer(world.player, pad, world, state));
  ev.push(...firePlayer(world, pad, state));
  ev.push(...stepSpies(world, state, rng, diff));
  ev.push(...stepBullets(world, state, rng));
  ev.push(...stepLights(world, state));
  ev.push(...playerContacts(world, state));
  return ev;
}
