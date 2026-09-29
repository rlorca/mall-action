// Bullets, lamps, disco balls, janitor, mall walkers, mall cop, fountains, coins, pickups and misc timers.
import type { Rng } from '../../core/rng';
import type { Floor } from '../../data/stores';
import { MISC, POWERUP_NAMES } from '../../data/copy';
import { CEILING_H, FLOOR_Y, LEVEL_W } from '../geometry';
import { addLife, addScore, applyPowerup, isInvincible } from '../progress';
import { DISCO_BALLS, JANITOR, KIOSKS, FOUNTAINS, LAMPS, WALKERS, WALK_MAX, WALK_MIN, segmentsOn, shaftsOn, walkBounds } from './layout';
import { MALL_COPY } from './copy';
import { bodyH, surfaceSolid } from './physics';
import { hitPlayer } from './player';
import { killSpy } from './spies';
import type { Bullet, Coin, Cop, Ctx, DiscoBall, Fountain, Janitor, Kiosk, Lamp, Walker } from './types';

export const WET_FRAMES = 600;
export const KICK_SLIDE = true;
export const FOUNTAIN_COOLDOWN = 900;
export const COP_CHASE_FRAMES = 600;
export const COP_FREEZE_FRAMES = 180;
export const COP_RANGE = 128;

export function makeLamps(): Lamp[] {
  return LAMPS.map((l) => ({ id: l.id, x: l.x, floor: l.floor, state: 'hang', y: FLOOR_Y[l.floor] - 26, vy: 0, frames: 0 }));
}
export function makeBalls(): DiscoBall[] {
  return DISCO_BALLS.map((l) => ({ id: l.id, x: l.x, floor: l.floor, state: 'hang', y: FLOOR_Y[l.floor] - 30, vy: 0, dir: 1, roll: 0 }));
}
export function makeJanitor(): Janitor {
  return { x: 60, floor: JANITOR.floor, dir: 1, mode: 'walk', frames: 0, nextMop: 200, animFrame: 0 };
}
export function makeWalkers(rng: Rng): Walker[] {
  return WALKERS.map((w, i) => ({
    id: i + 1,
    x: w.minX + rng.int(w.maxX - w.minX),
    floor: w.floor,
    dir: rng.chance(0.5) ? 1 : -1,
    minX: w.minX,
    maxX: w.maxX,
    pause: 0,
    animFrame: 0,
    lastVolley: 0,
    bubble: null,
  }));
}
export function makeCop(rng: Rng): Cop {
  const floors: Floor[] = ['4F', '3F', '2F', '1F'];
  const floor = rng.pick(floors);
  const seg = rng.pick(segmentsOn(floor));
  return { x: Math.round((seg.x0 + seg.x1) / 2), floor, dir: rng.chance(0.5) ? 1 : -1, mode: 'patrol', chaseFrames: 0, cool: 0, relocateIn: 900 + rng.int(600), bubble: null, animFrame: 0 };
}
export function makeKiosks(): Kiosk[] {
  return KIOSKS.map((k) => ({ floor: k.floor, x: k.x, w: k.w, cooldown: 0 }));
}
export function makeFountains(): Fountain[] {
  return FOUNTAINS.map((f) => ({ floor: f.floor, x: f.x, w: f.w, cooldown: 0, spray: 0 }));
}

/* ------------------------------------------------------------------ bullets */

function playerRectHit(c: Ctx, b: Bullet): boolean {
  const p = c.s.player;
  if (!(p.mode === 'walk' || p.mode === 'air' || p.mode === 'car' || p.mode === 'roof')) return false;
  return Math.abs(b.x - p.x) <= 6 && b.y >= p.y - bodyH(p.duck) && b.y <= p.y;
}

function bulletConsumed(c: Ctx, b: Bullet): boolean {
  const s = c.s;
  // mall cop: bullets ping off his helmet
  const cop = s.cop;
  if (Math.abs(b.x - cop.x) <= 8 && b.y >= FLOOR_Y[cop.floor] - 26 && b.y <= FLOOR_Y[cop.floor]) {
    c.sfx('ping');
    return true;
  }
  // walkers block bullets from both sides
  for (const w of s.walkers) {
    if (Math.abs(b.x - w.x) <= 6 && b.y >= FLOOR_Y[w.floor] - 24 && b.y <= FLOOR_Y[w.floor]) {
      if (b.owner === 'player' && w.lastVolley !== b.volley) {
        w.lastVolley = b.volley;
        c.award(-200, w.x, FLOOR_Y[w.floor] - 28);
        c.say(w, MISC.walkerHey, 60);
      }
      c.sfx('blip');
      return true;
    }
  }
  if (b.owner === 'spy') {
    if (playerRectHit(c, b)) {
      hitPlayer(c, 'bullet');
      return true;
    }
    return false;
  }
  // player bullets
  for (const sp of s.spies) {
    if (sp.state === 'dying') continue;
    if (Math.abs(b.x - sp.x) <= 6 && b.y >= sp.y - bodyH(sp.state === 'duck') && b.y <= sp.y) {
      killSpy(c, sp, 'shot');
      return true;
    }
  }
  for (const l of s.lamps) {
    if (l.state !== 'hang') continue;
    const fy = FLOOR_Y[l.floor];
    if (Math.abs(b.x - l.x) <= 6 && b.y >= fy - CEILING_H && b.y <= fy - 14) {
      l.state = 'falling';
      l.vy = 0;
      c.sfx('lamp');
      return true;
    }
  }
  for (const d of s.discoBalls) {
    if (d.state !== 'hang') continue;
    const fy = FLOOR_Y[d.floor];
    if (Math.abs(b.x - d.x) <= 7 && b.y >= fy - CEILING_H && b.y <= fy - 14) {
      d.state = 'falling';
      d.vy = 0;
      d.dir = b.vx >= 0 ? 1 : -1;
      c.sfx('lamp');
      return true;
    }
  }
  for (const f of s.fountains) {
    const fy = FLOOR_Y[f.floor];
    if (Math.abs(b.x - f.x) <= f.w / 2 && b.y >= fy - 20 && b.y <= fy) {
      if (f.cooldown <= 0) sprayFountain(c, f);
      else c.sfx('ping');
      return true;
    }
  }
  return false;
}

export function sprayFountain(c: Ctx, f: Fountain): void {
  f.cooldown = FOUNTAIN_COOLDOWN;
  f.spray = 40;
  const n = c.rng.range(3, 5);
  const goldIdx = c.rng.int(20) === 0 ? c.rng.int(n) : -1;
  for (let i = 0; i < n; i++) {
    c.s.coins.push({
      id: ++c.s.idSeq,
      x: f.x + c.rng.range(-4, 4),
      y: FLOOR_Y[f.floor] - 14,
      floor: f.floor,
      vx: (c.rng.next() - 0.5) * 3,
      vy: -3 - c.rng.next() * 1.5,
      gold: i === goldIdx,
      bounces: 0,
      life: 900,
    });
  }
  c.sfx('coin');
}

export function updateBullets(c: Ctx): void {
  const s = c.s;
  const keep: Bullet[] = [];
  for (const b of s.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < 0 || b.x > LEVEL_W || b.y < 0 || b.y > 420) continue;
    if (bulletConsumed(c, b)) continue;
    keep.push(b);
  }
  s.bullets = keep;
}

/* ------------------------------------------------------------------ lights */

function underKill(c: Ctx, floor: Floor, x: number, bottomY: number, half: number, cause: 'lamp' | 'ball'): void {
  const p = c.s.player;
  if ((p.mode === 'walk' || p.mode === 'air') && p.floor === floor && Math.abs(p.x - x) <= half) {
    if (bottomY >= p.y - bodyH(p.duck)) {
      if (!isInvincible(c.progress) && p.invuln <= 0) c.killPlayer(cause);
    }
  }
  for (const sp of c.s.spies) {
    if (sp.state === 'dying' || sp.floor !== floor || Math.abs(sp.x - x) > half) continue;
    if (bottomY >= sp.y - bodyH(sp.state === 'duck')) killSpy(c, sp, cause);
  }
}

function updateLights(c: Ctx): void {
  const s = c.s;
  for (const l of s.lamps) {
    if (l.state === 'falling') {
      l.vy += 0.5;
      l.y += l.vy;
      const fy = FLOOR_Y[l.floor];
      underKill(c, l.floor, l.x, l.y, 9, 'lamp');
      if (l.y >= fy) {
        l.y = fy;
        l.state = 'shattered';
        l.frames = 40;
        c.sfx('glass');
        c.ev({ t: 'shake', frames: 14, mag: 2 });
        s.darkened.push({ x0: l.x - 48, x1: l.x + 48, y0: fy - CEILING_H, y1: fy, frames: 120 });
      }
    } else if (l.state === 'shattered') {
      if (--l.frames <= 0) l.state = 'gone';
    }
  }
  const p = s.player;
  for (const d of s.discoBalls) {
    const fy = FLOOR_Y[d.floor];
    if (d.state === 'falling') {
      d.vy += 0.5;
      d.y += d.vy;
      underKill(c, d.floor, d.x, d.y + 6, 8, 'ball');
      if (d.y >= fy - 6) {
        d.y = fy - 6;
        d.state = 'rolling';
        c.sfx('glass');
      }
    } else if (d.state === 'rolling') {
      const nx = d.x + d.dir * 2;
      d.roll++;
      if (nx <= WALK_MIN + 4 || nx >= WALK_MAX - 4 || !surfaceSolid(s, d.floor, nx)) {
        d.state = 'gone';
        c.sfx('glass');
        continue;
      }
      d.x = nx;
      for (const sp of s.spies) {
        if (sp.state !== 'dying' && sp.floor === d.floor && Math.abs(sp.x - d.x) <= 10) killSpy(c, sp, 'ball');
      }
      if ((p.mode === 'walk' || p.mode === 'air') && p.floor === d.floor && Math.abs(p.x - d.x) <= 9 && p.y > fy - 8 && p.invuln <= 0 && !isInvincible(c.progress)) {
        c.killPlayer('ball');
      }
    }
  }
  s.darkened = s.darkened.filter((r) => --r.frames > 0);
}

/* ------------------------------------------------------------------ janitor */

function updateJanitor(c: Ctx): void {
  const s = c.s;
  const j = s.janitor;
  j.animFrame++;
  for (const w of s.wetPatches) w.frames--;
  s.wetPatches = s.wetPatches.filter((w) => w.frames > 0);
  if (j.mode === 'mop') {
    if (--j.frames <= 0) {
      j.mode = 'walk';
      j.nextMop = 240 + c.rng.int(240);
    }
    return;
  }
  j.x += j.dir * 0.5;
  if (j.x >= JANITOR.maxX) j.dir = -1;
  else if (j.x <= JANITOR.minX) j.dir = 1;
  if (--j.nextMop <= 0) {
    j.mode = 'mop';
    j.frames = 90;
    // ~48 px patch, kept well clear of every shaft opening
    let x0 = Math.max(JANITOR.patchMinX, j.x - JANITOR.patchW / 2);
    for (const sh of shaftsOn(j.floor)) if (x0 + JANITOR.patchW > sh.x - 16 && x0 < sh.x + sh.w + 16) x0 = Math.min(x0, sh.x - 16 - JANITOR.patchW);
    x0 = Math.max(JANITOR.patchMinX, x0);
    s.wetPatches.push({ x0, x1: x0 + JANITOR.patchW, floor: j.floor, frames: WET_FRAMES });
    if (s.wetPatches.length > 2) s.wetPatches.shift();
  }
}

/* ------------------------------------------------------------------ walkers */

function updateWalkers(c: Ctx): void {
  const p = c.s.player;
  for (const w of c.s.walkers) {
    w.animFrame++;
    if (w.bubble && --w.bubble.frames <= 0) w.bubble = null;
    if (w.pause > 0) {
      w.pause--;
      continue;
    }
    w.x += w.dir * 0.8;
    if (w.x >= w.maxX) {
      w.x = w.maxX;
      w.dir = -1;
      w.pause = 30;
    } else if (w.x <= w.minX) {
      w.x = w.minX;
      w.dir = 1;
      w.pause = 30;
    }
    // touching one just pushes you along
    if ((p.mode === 'walk' || p.mode === 'air') && p.floor === w.floor && Math.abs(p.x - w.x) <= 11 && p.y > FLOOR_Y[w.floor] - 24) {
      const nx = p.x + w.dir * 0.8;
      const b = walkBounds(w.floor);
      if (nx >= b.min && nx <= b.max && surfaceSolid(c.s, w.floor, nx)) p.x = nx;
    }
  }
}

/* ------------------------------------------------------------------ cop */

function relocateCop(c: Ctx): void {
  const cop = c.s.cop;
  const floors: Floor[] = (['4F', '3F', '2F', '1F'] as Floor[]).filter((f) => f !== cop.floor);
  cop.floor = c.rng.pick(floors);
  const seg = c.rng.pick(segmentsOn(cop.floor));
  cop.x = seg.x0 + c.rng.int(Math.max(1, seg.x1 - seg.x0));
  cop.dir = c.rng.chance(0.5) ? 1 : -1;
  cop.mode = 'patrol';
  cop.chaseFrames = 0;
  cop.relocateIn = 900 + c.rng.int(600);
}

/** Called whenever the player shoots: in front of the cop (same floor, facing, <=128 px) starts the chase. */
export function copOnShot(c: Ctx): void {
  const cop = c.s.cop;
  const p = c.s.player;
  if (cop.mode !== 'patrol' || cop.cool > 0) return;
  if (p.floor !== cop.floor) return;
  const dx = p.x - cop.x;
  if (Math.abs(dx) > COP_RANGE) return;
  if (dx * cop.dir < 0) return; // he is not facing the player
  cop.mode = 'chase';
  cop.chaseFrames = COP_CHASE_FRAMES;
  c.sfx('whistle');
  c.say(cop, MISC.copWhistle, 120);
}

function updateCop(c: Ctx): void {
  const cop = c.s.cop;
  const p = c.s.player;
  cop.animFrame++;
  if (cop.cool > 0) cop.cool--;
  if (cop.bubble && --cop.bubble.frames <= 0) cop.bubble = null;
  if (cop.mode === 'chase') {
    cop.chaseFrames--;
    const canSee = p.floor === cop.floor && !p.hidden && p.mode !== 'dying';
    if (canSee) {
      const dx = p.x - cop.x;
      cop.dir = dx >= 0 ? 1 : -1;
      cop.x += cop.dir * Math.min(1.5, Math.abs(dx));
      cop.x = Math.min(WALK_MAX, Math.max(WALK_MIN, cop.x));
      if (Math.abs(dx) <= 12 && (p.mode === 'walk' || p.mode === 'air') && p.frozen <= 0) {
        // caught: frozen for 3 s and -500 points; not a life
        p.frozen = COP_FREEZE_FRAMES;
        p.slide = 0;
        p.kick = false;
        if (p.mode === 'air') p.mode = 'air';
        addScore(c.progress, -500, c.sink);
        c.ev({ t: 'popup', x: p.x, y: p.y - 30, text: MISC.copCaught });
        c.sfx('whistle');
        cop.mode = 'patrol';
        cop.cool = 900;
        cop.chaseFrames = 0;
        cop.relocateIn = 120;
      }
    }
    if (cop.chaseFrames <= 0) {
      cop.mode = 'patrol';
      cop.cool = 300;
    }
    return;
  }
  // patrol back and forth inside the segment he stands in
  const seg = segmentsOn(cop.floor).find((sg) => cop.x >= sg.x0 && cop.x <= sg.x1) ?? { x0: WALK_MIN, x1: WALK_MAX };
  cop.x += cop.dir * 0.8;
  if (cop.x >= seg.x1 - 8) cop.dir = -1;
  else if (cop.x <= seg.x0 + 8) cop.dir = 1;
  if (--cop.relocateIn <= 0) relocateCop(c);
}

/* ------------------------------------------------------------------ coins / pickups */

function updateCoins(c: Ctx): void {
  const s = c.s;
  const p = s.player;
  const keep: Coin[] = [];
  for (const k of s.coins) {
    k.life--;
    const fy = FLOOR_Y[k.floor] - 4;
    if (k.bounces < 3 || k.y < fy) {
      k.vy += 0.3;
      k.x += k.vx;
      k.y += k.vy;
      if (k.y >= fy) {
        k.y = fy;
        if (k.bounces < 3) {
          k.vy = -Math.abs(k.vy) * 0.6;
          k.bounces++;
          k.vx *= 0.7;
        } else {
          k.vy = 0;
          k.vx = 0;
        }
      }
      const b = walkBounds(k.floor);
      k.x = Math.min(b.max, Math.max(b.min, k.x));
    }
    let taken = false;
    if ((p.mode === 'walk' || p.mode === 'air' || p.mode === 'car') && Math.abs(p.x - k.x) <= 10 && k.y >= p.y - 26 && k.y <= p.y + 4 && (p.floor === k.floor || p.mode === 'air')) {
      taken = true;
      if (k.gold) {
        addLife(c.progress);
        c.sfx('extraLife');
        c.ev({ t: 'popup', x: k.x, y: k.y - 8, text: MALL_COPY.goldCoin });
      } else {
        c.sfx('coin');
        c.award(50, k.x, k.y - 8);
      }
    }
    if (!taken && k.life > 0) keep.push(k);
  }
  s.coins = keep;
}

function updatePickups(c: Ctx): void {
  const s = c.s;
  const p = s.player;
  const keep = [];
  for (const k of s.pickups) {
    k.life--;
    if ((p.mode === 'walk' || p.mode === 'air') && Math.abs(p.x - k.x) <= 10 && p.y >= k.y - 4 && p.y - 26 <= k.y && (p.floor === k.floor || p.mode === 'air')) {
      applyPowerup(c.progress, k.kind, c.sink);
      const name = POWERUP_NAMES[k.kind] ?? k.kind;
      c.ev({ t: 'banner', lines: [name], frames: 90, kind: 'item' });
      c.ev({ t: 'popup', x: k.x, y: k.y - 24, text: '+50' });
      continue;
    }
    if (k.life > 0) keep.push(k);
  }
  s.pickups = keep;
}

/** Everything that just ticks along. */
export function updateProps(c: Ctx): void {
  const s = c.s;
  updateLights(c);
  updateJanitor(c);
  updateWalkers(c);
  updateCop(c);
  updateCoins(c);
  updatePickups(c);
  for (const k of s.kiosks) if (k.cooldown > 0) k.cooldown--;
  for (const f of s.fountains) {
    if (f.cooldown > 0) f.cooldown--;
    if (f.spray > 0) f.spray--;
  }
  if (s.kioskPanel && (--s.kioskPanel.frames <= 0 || s.player.floor !== s.kioskPanel.kioskFloor)) s.kioskPanel = null;
  if (s.photoStrip && --s.photoStrip.frames <= 0) s.photoStrip = null;
  if (s.announce && --s.announce.frames <= 0) s.announce = null;
}
