import { SHAFTS, LIGHTS, KIOSKS, FOUNTAINS } from '../world/mallLevel.js';
import { feetY } from '../world/constants.js';
import { createCar, updateCar, aiCommand, crushVictims, carFloor, inShaftX, CAR_H } from '../logic/elevator.js';
import { tickPowerups } from '../logic/powerups.js';
import { difficulty } from '../logic/rules.js';
import { createPlayer, stepPlayer, killPlayer, placeOnFloor } from './mallPlayer.js';
import { stepSpies, spyFromCar, killSpy, alive } from './spies.js';
import { firePlayer, stepBullets, playerContacts } from './combat.js';
import { stepLights, lampTop } from './lights.js';
import { createNpcs, stepNpcs } from './mallNpcs.js';
import { exitHook } from './exitHook.js';

export function createMallWorld(state) {
  const world = {
    frame: 0,
    cars: SHAFTS.map(createCar),
    player: createPlayer(),
    playerCarCmd: 0,
    spies: [], bullets: [], enemyBullets: [], pickups: [], coins: [], fx: [],
    lights: LIGHTS.map((l, i) => ({ ...l, id: i, state: 'hanging', y: lampTop(l.floor), vy: 0, rollDir: 0, t: 0 })),
    wet: [], janitor: null, walkers: [], cop: null,
    kioskCooldown: KIOSKS.map(() => 0), fountainCooldown: FOUNTAINS.map(() => 0),
    spawnT: 300, alarm: false, banner: null, dark: null, exiting: false,
    upHooks: [exitHook],
  };
  if (state) createNpcs(world, state.rng);
  return world;
}

// Put the player back at their last safe spot after losing a life; clears everything that could chain another death.
export function respawnPlayer(world) {
  const p = world.player;
  placeOnFloor(p, p.lastSafe.x, p.lastSafe.floor);
  Object.assign(p, { frozenT: 0, hiddenT: 0, slideDir: 0, invulnT: 120, dieT: 0 });
  world.spies = []; world.bullets = []; world.enemyBullets = [];
  world.playerCarCmd = 0;
  if (world.cop) world.cop.state = 'patrol';
}

export const currentDifficulty = (world, state) => difficulty(state.loop, { blackFriday: state.blackFriday, alarm: world.alarm });

function stepCars(world, state, rng, ev) {
  const p = world.player;
  for (const car of world.cars) {
    const playerDriving = p.mode === 'car' && p.riding === car.id;
    // a parked car never leaves with someone standing inside it (they'd drop through its floor and be crushed)
    const here = carFloor(car);
    const standingIn = (e) => e.floor === here && inShaftX(car, e.x) && !e.riding;
    const occupied = here !== null && ((p.mode === 'ground' && standingIn(p)) || world.spies.some((s) => alive(s) && standingIn(s)));
    let cmd = 0;
    if (playerDriving) cmd = world.playerCarCmd;
    else if (car.callTarget != null) {
      const ty = feetY(car.callTarget);
      cmd = car.y === ty ? 0 : car.y < ty ? 1 : -1;
      if (car.y === ty) car.callTarget = null;
    } else if (car.ai && !occupied) cmd = aiCommand(car, rng);
    const { dy, stopped } = updateCar(car, cmd);
    if (stopped !== null) {
      ev.push({ type: 'carStopped', carId: car.id, floor: stopped, withPlayer: playerDriving });
      if (!playerDriving) spyFromCar(world, car, stopped, rng, currentDifficulty(world, state));
    }
    if (!dy) continue;
    if (p.riding === car.id) p.y = car.y;
    if (p.onRoof === car.id) p.y = car.y - CAR_H;
    if (playerDriving && world.frame % 8 === 0) ev.push({ type: 'sfx', name: 'hum' });
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
  ev.push(...stepNpcs(world, state, rng));
  ev.push(...firePlayer(world, pad, state));
  ev.push(...stepSpies(world, state, rng, diff));
  ev.push(...stepBullets(world, state, rng));
  ev.push(...stepLights(world, state));
  ev.push(...playerContacts(world, state));
  return ev;
}
