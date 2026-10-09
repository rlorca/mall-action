import type { Mall, Rect } from './mall';
import { SPY_BULLET_SPEED } from './mall';
import { Dir, Spy } from './mall-types';
import { SHAFTS, STOREFRONTS, WALK_MAX, WALK_MIN, floorAt, floorY, shaftServes } from './level';
import { SPY_LAST_WORDS, storeInfo } from './copy';
import { openingState } from './elevator';
import { FOOD_POWERS, SHOP_POWERS } from './powerups';
import { award } from './run';
import { POINTS } from './scoring';

export const SPY_FIRST_SHOT_FRAMES = 120; // ~2 s after appearing
export const SPY_AIM_FRAMES = 30; // clear telegraph, ~0.5 s
export const SPY_DEATH_FRAMES = 24; // ~0.4 s
export const SPY_DODGE_CHANCE = 0.1;
export const SPY_SIGHT = 160;
export const SPY_STOP_DIST = 40;

export function spyRect(s: Spy): Rect {
  const h = s.state === 'duck' ? 14 : 24;
  return { x: s.x + 3, y: s.y - h, w: 10, h };
}

export function spawnSpyAt(m: Mall, floor: number, x: number, fromCar: boolean): Spy | null {
  if (m.spies.length >= m.diff.spyCap) return null;
  const pcx = m.p.x + 8;
  const s: Spy = {
    id: m.id(),
    x,
    y: floorY(floor),
    floor,
    dir: pcx >= x + 8 ? 1 : -1,
    state: 'emerge',
    t: fromCar ? 24 : 20,
    age: 0,
    cd: 0,
    aimHigh: false,
    wanderT: 0,
    wanderDir: 0,
    goalX: null,
    waitShaft: -1,
    volleyDecided: -1,
    slide: 0,
    walkAnim: 0,
    said: false,
    fromCar,
  };
  m.spies.push(s);
  m.events.emit('spySpawn', { id: s.id, floor, fromCar });
  return s;
}

/** Spies come out of the doors of open stores on the player's floor or one floor away, 64-200 px from the player. */
export function spawnSpies(m: Mall): void {
  if (m.spies.length >= m.diff.spyCap) return;
  const pf = floorAt(m.p.y);
  const pcx = m.p.x + 8;
  const doors = STOREFRONTS.filter((sf) => {
    const info = storeInfo(sf.id);
    const st = m.run.setup[sf.id];
    if (info.role === 'closed' || !st) return false;
    if (info.role === 'target' && st.cleared) return false;
    if (Math.abs(sf.floor - pf) > 1) return false;
    const d = Math.abs(sf.doorX - pcx);
    return d >= 64 && d <= 200;
  });
  if (!doors.length) return;
  const sf = m.rng.pick(doors);
  spawnSpyAt(m, sf.floor, sf.doorX - 8, false);
}

export function killSpy(m: Mall, s: Spy, how: string): void {
  if (s.state === 'dying') return;
  s.state = 'dying';
  s.t = SPY_DEATH_FRAMES;
  s.killedBy = how;
  const big = how === 'crush' || how === 'lamp' || how === 'ball' || how === 'slide';
  award(m.run, big ? POINTS.spyCrushed : POINTS.spyShot, { x: s.x + 8, y: s.y - 30, space: 'mall' });
  m.events.emit('spyDie', { how });
  if (how === 'crush') {
    m.shake = Math.max(m.shake, 10);
    m.events.emit('crushHit');
  }
  // ~35% of kills have last words
  if (m.rng.chance(0.35)) {
    m.say('spy' + s.id, s.x + 8, s.y - 30, m.rng.pick(SPY_LAST_WORDS), s.floor, 90);
    s.said = true;
  }
  // 5% drop a power-up, half of them food
  if (m.rng.chance(0.05)) {
    const food = m.rng.chance(0.5);
    m.dropPickup(food ? m.rng.pick(FOOD_POWERS) : m.rng.pick(SHOP_POWERS), s.x + 4, s.floor);
  }
}

function canSee(m: Mall, s: Spy): boolean {
  if (!m.visibleToSpies()) return false;
  if (m.p.invuln > 0 && m.p.mode === 'dying') return false;
  if (Math.abs(m.p.y - s.y) > 12) return false;
  return Math.abs(m.p.x + 8 - (s.x + 8)) <= SPY_SIGHT;
}

/** Try to move; returns false when blocked by a wall or a pit. */
function moveSpy(m: Mall, s: Spy, dx: number): boolean {
  if (dx === 0) return true;
  const nx = s.x + dx;
  if (nx < WALK_MIN || nx > WALK_MAX) return false;
  const lead = nx + 8 + Math.sign(dx) * 6;
  // Never walk into a pit (or into a car): only a grate is OK.
  if (m.isPit(s.floor, lead)) return false;
  s.x = nx;
  return true;
}

export function stepSpies(m: Mall): void {
  const p = m.p;
  const pcx = p.x + 8;
  const baseSpeed = m.diff.spySpeed * (m.alarm ? 1.25 : 1);
  const keep: Spy[] = [];

  // Spies decide once per volley whether to duck an incoming bullet (10%).
  for (const b of m.bullets) {
    if (b.owner !== 'player') continue;
    for (const s of m.spies) {
      if (s.state === 'dying' || s.state === 'emerge' || s.floor !== b.floor || s.volleyDecided === b.volley) continue;
      const dx = s.x + 8 - b.x;
      if (Math.sign(dx) === Math.sign(b.vx) && Math.abs(dx) < 64) {
        s.volleyDecided = b.volley;
        if (m.rng.chance(SPY_DODGE_CHANCE) && s.state !== 'aim') {
          s.state = 'duck';
          s.t = 28;
        }
      }
    }
  }

  for (const s of m.spies) {
    s.age++;
    s.walkAnim++;
    if (s.cd > 0) s.cd--;
    if (s.state === 'dying') {
      if (--s.t <= 0) continue;
      keep.push(s);
      continue;
    }
    // wet floor: slides at walking speed and can't stop or turn
    const patch = m.patchAt(s.floor, s.x + 8);
    if (patch && s.slide === 0 && s.state !== 'emerge') s.slide = s.dir;
    if (s.slide !== 0) {
      if (!patch) s.slide = 0;
      else {
        moveSpy(m, s, s.slide * baseSpeed);
        keep.push(s);
        continue;
      }
    }

    switch (s.state) {
      case 'emerge':
        if (--s.t <= 0) s.state = 'walk';
        break;
      case 'duck':
        if (--s.t <= 0) s.state = 'walk';
        break;
      case 'aim': {
        s.dir = pcx >= s.x + 8 ? 1 : -1;
        if (--s.t <= 0) {
          const y = s.y - (s.aimHigh ? 16 : 6);
          m.bullets.push({
            id: m.id(),
            x: s.dir > 0 ? s.x + 16 : s.x - 2,
            y,
            vx: s.dir * SPY_BULLET_SPEED,
            vy: 0,
            owner: 'spy',
            floor: s.floor,
            volley: 0,
            base: floorY(s.floor),
            life: 200,
          });
          m.events.emit('enemyShot');
          const every = Math.max(60, m.diff.fireEvery * (m.alarm ? 0.85 : 1));
          s.cd = Math.round(every * (0.9 + m.rng.next() * 0.3));
          s.state = 'walk';
        }
        break;
      }
      case 'wait':
      case 'walk': {
        const sees = canSee(m, s);
        if (sees) {
          const toward: Dir = pcx >= s.x + 8 ? 1 : -1;
          s.dir = toward;
          const dist = Math.abs(pcx - (s.x + 8));
          if (dist > SPY_STOP_DIST && s.state === 'walk') moveSpy(m, s, toward * baseSpeed);
          s.goalX = null;
          s.state = s.state === 'wait' ? 'wait' : 'walk';
          if (s.age >= SPY_FIRST_SHOT_FRAMES && s.cd <= 0) {
            s.state = 'aim';
            s.t = SPY_AIM_FRAMES;
            s.aimHigh = m.rng.chance(0.5);
            m.events.emit('spyAim');
          }
        } else if (s.state === 'wait') {
          if (--s.t <= 0) {
            s.state = 'walk';
            s.waitShaft = -1;
          }
        } else wander(m, s, baseSpeed);
        break;
      }
    }
    keep.push(s);
  }
  m.spies = keep;
}

function wander(m: Mall, s: Spy, speed: number): void {
  if (s.goalX !== null) {
    const dx = s.goalX - s.x;
    if (Math.abs(dx) <= 1) {
      s.state = 'wait';
      s.t = 300 + m.rng.int(0, 300);
      s.goalX = null;
      return;
    }
    s.dir = dx > 0 ? 1 : -1;
    if (!moveSpy(m, s, s.dir * Math.min(speed, Math.abs(dx)))) s.goalX = null;
    return;
  }
  if (--s.wanderT <= 0) {
    s.wanderT = 60 + m.rng.int(0, 120);
    const r = m.rng.next();
    if (r < 0.2) {
      // go and wait in a shaft opening that is currently a safe grate
      const cands = SHAFTS.map((sh, i) => ({ sh, i })).filter(({ sh, i }) => shaftServes(sh, s.floor) && openingState(m.cars[i], s.floor) === 'above' && Math.abs(sh.cx - (s.x + 8)) < 240);
      if (cands.length) {
        const c = m.rng.pick(cands);
        s.goalX = c.sh.cx - 8;
        s.waitShaft = c.i;
        return;
      }
    }
    s.wanderDir = r < 0.45 ? -1 : r < 0.7 ? 0 : 1;
    if (s.wanderDir === 0) s.wanderT = 30 + m.rng.int(0, 40);
  }
  if (s.wanderDir !== 0) {
    s.dir = s.wanderDir;
    if (!moveSpy(m, s, s.wanderDir * speed * 0.8)) s.wanderDir = (s.wanderDir * -1) as -1 | 1;
  }
}
