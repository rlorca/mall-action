import type { Mall } from './mall';
import { overlap } from './mall';
import { Dir } from './mall-types';
import { FLOOR_1F, FLOOR_4F, JANITOR_RANGE, SHAFTS, WALKER_RANGE, WALK_MAX, WALK_MIN, floorAt, floorY, shaftServes } from './level';
import { MISC } from './copy';
import { award } from './run';
import { POINTS } from './scoring';

export const PATCH_W = 48;
export const PATCH_LIFE = 600; // ~10 s
export const MOP_FRAMES = 60;
export const COP_CHASE_FRAMES = 600; // ~10 s
export const COP_FREEZE_FRAMES = 180; // 3 s
export const COP_ALERT_RANGE = 128;

/** A patch centred on x must never reach a shaft opening (nor leave margin < 12 px). */
export function patchIsSafe(floor: number, cx: number): boolean {
  const x0 = cx - PATCH_W / 2 - 12;
  const x1 = cx + PATCH_W / 2 + 12;
  for (const s of SHAFTS) {
    if (!shaftServes(s, floor)) continue;
    if (x1 > s.x && x0 < s.x + s.w) return false;
  }
  return true;
}

export function stepNpcs(m: Mall): void {
  // wet patches expire
  for (const w of m.patches) w.life--;
  m.patches = m.patches.filter((w) => w.life > 0);
  stepJanitor(m);
  stepWalkers(m);
  stepCop(m);
}

function stepJanitor(m: Mall): void {
  const j = m.janitor;
  j.t++;
  if (j.state === 'mop') {
    if (j.t >= MOP_FRAMES) {
      m.patches = m.patches.filter((w) => !(w.floor === j.floor && Math.abs((w.x0 + w.x1) / 2 - j.x) < 8));
      m.patches.push({ floor: j.floor, x0: j.x - PATCH_W / 2, x1: j.x + PATCH_W / 2, life: PATCH_LIFE });
      m.events.emit('mopped', { x: j.x });
      j.state = 'walk';
      j.t = 0;
      j.nextMop = 360 + m.rng.int(0, 240);
    }
    return;
  }
  const nx = j.x + j.dir * 0.5;
  const lead = nx + j.dir * 8;
  if (nx < JANITOR_RANGE[0] || nx > JANITOR_RANGE[1] || m.isPit(j.floor, lead)) {
    j.dir = (j.dir * -1) as Dir;
  } else j.x = nx;
  if (j.t >= j.nextMop) {
    if (patchIsSafe(j.floor, j.x) && m.patches.filter((w) => w.floor === j.floor).length < 2) {
      j.state = 'mop';
      j.t = 0;
    } else j.nextMop = j.t + 60;
  }
}

function stepWalkers(m: Mall): void {
  const p = m.p;
  for (const w of m.walkers) {
    w.pause = Math.max(0, w.pause - 1);
    let dx = 0;
    if (w.pause === 0) {
      const nx = w.x + w.dir * w.speed;
      const lead = nx + 8 + w.dir * 8;
      if (nx < WALKER_RANGE[0] || nx > WALKER_RANGE[1] || m.isPit(w.floor, lead)) {
        w.dir = (w.dir * -1) as Dir;
        w.pause = 40; // catch their breath between stretches
      } else {
        dx = nx - w.x;
        w.x = nx;
      }
      // power-walk "sets": every so often a short rest
      if (m.frame % 420 === (w.sprite === 0 ? 0 : 210)) w.pause = 70;
    }
    // Touching a walker just pushes the agent along.
    if (p.mode === 'normal' && p.onGround && floorAt(p.y) === w.floor) {
      if (overlap(m.playerRect(), { x: w.x + 2, y: floorY(w.floor) - 24, w: 12, h: 24 })) {
        const push = dx !== 0 ? dx : w.dir * 0.5;
        const nx = p.x + push;
        if (!m.isPit(p.floor, nx + 8 + Math.sign(push) * 6)) p.x = Math.max(8, Math.min(752, nx));
      }
    }
  }
}

function stepCop(m: Mall): void {
  const c = m.cop;
  const p = m.p;
  const pcx = p.x + 8;
  if (c.whistle > 0) c.whistle--;
  const playerVisible = (p.mode === 'normal' || p.mode === 'frozen') && floorAt(p.y) === c.floor;

  if (c.state === 'cool') {
    if (--c.t <= 0) c.state = 'patrol';
  }

  // He blows the whistle if you shoot in front of him.
  if (c.state === 'patrol' && m.lastShotFrame === m.frame && playerVisible) {
    const toward: Dir = pcx >= c.x + 10 ? 1 : -1;
    if (toward === c.dir && Math.abs(pcx - (c.x + 10)) <= COP_ALERT_RANGE) {
      c.state = 'chase';
      c.t = COP_CHASE_FRAMES;
      c.whistle = 60;
      m.say('cop', c.x + 10, floorY(c.floor) - 34, MISC.copWhistle, c.floor, 120);
      m.events.emit('whistle');
    }
  }

  if (c.state === 'chase') {
    c.t--;
    if (playerVisible && p.mode === 'normal') {
      c.dir = pcx >= c.x + 10 ? 1 : -1;
      const nx = c.x + c.dir * 1.3;
      if (nx > WALK_MIN && nx < WALK_MAX && !m.isPit(c.floor, nx + 10 + c.dir * 10)) c.x = nx;
      // caught: frozen for 3 s, -500 points (not a life)
      if (p.invuln <= 0 && overlap(m.playerRect(), { x: c.x + 2, y: floorY(c.floor) - 26, w: 16, h: 26 })) {
        p.mode = 'frozen';
        p.timer = COP_FREEZE_FRAMES;
        p.ducking = false;
        p.kicking = false;
        p.slide = 0;
        award(m.run, POINTS.copCaught, { x: p.x + 8, y: p.y - 34, space: 'mall' });
        m.showBanner([MISC.copCaught], 150, 'warn');
        m.events.emit('detained');
        m.copCatches++;
        c.state = 'cool';
        c.t = 480;
      }
    }
    if (c.t <= 0) c.state = 'patrol';
    return;
  }

  // patrol: walk back and forth; occasionally move to another floor (away from the player)
  const sp = 0.8;
  const nx = c.x + c.dir * sp;
  if (nx < WALK_MIN + 10 || nx > WALK_MAX - 10 || m.isPit(c.floor, nx + 10 + c.dir * 10)) c.dir = (c.dir * -1) as Dir;
  else c.x = nx;
  if (++c.t % 360 === 0 && c.state === 'patrol') c.dir = (c.dir * -1) as Dir;
  if (--c.retarget <= 0) {
    c.retarget = 1500;
    const pf = floorAt(p.y);
    const floors = [FLOOR_4F, FLOOR_4F + 1, FLOOR_4F + 2, FLOOR_1F].filter((f) => f !== pf);
    c.floor = m.rng.pick(floors);
    c.x = Math.max(WALK_MIN + 10, Math.min(WALK_MAX - 10, pcx + (m.rng.chance(0.5) ? 1 : -1) * m.rng.int(180, 360)));
    if (m.isPit(c.floor, c.x + 10)) c.x += 60;
  }
}
