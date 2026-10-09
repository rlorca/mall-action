import { Gfx } from './gfx';
import { Mall } from '../core/mall';
import {
  ESCALATORS,
  FLOOR_COUNT,
  FLOOR_P,
  FLOOR_R,
  FURNITURE,
  GETAWAY,
  HUD_H,
  MALL_H,
  MALL_W,
  SCREEN_W,
  SHAFTS,
  STOREFRONTS,
  STORE_W,
  VIEW_H,
  ZIP_POST_X,
  floorAt,
  floorY,
  shaftServes,
  LAMPS,
} from '../core/level';
import { carRoofY, doorsOpen, openingState } from '../core/elevator';
import { STORES, StoreId, storeInfo, UI } from '../core/copy';
import { C } from '../art/palette';
import { hudSlot } from '../core/powerups';
import { SPY_DEATH_FRAMES } from '../core/mall-spies';

/** Render-only state for the mall (never read by the rules). */
export class MallView {
  doors: number[] = [0, 0, 0];
  /** The mall's own simulation frame: world animations freeze when the mall is not stepped (pause, stores). */
  frame = 0;
  private last = -1;
  /** Catch up on the SIMULATION frames since the last draw (never "one per draw": the display may run at any Hz). */
  tick(mall: Mall): void {
    if (mall.frame < this.last || this.last < 0) this.last = mall.frame - 1;
    const n = Math.min(8, mall.frame - this.last);
    for (let k = mall.frame - n + 1; k <= mall.frame; k++) {
      mall.cars.forEach((car, i) => {
        const target = doorsOpen(car) ? 0 : 3;
        if (k % 3 === 0) this.doors[i] += Math.sign(target - this.doors[i]);
      });
    }
    this.last = mall.frame;
    this.frame = mall.frame;
  }
}

// per-floor wall colours: [wall, wainscot, slab A, slab B, accent]
const FLOOR_STYLE: Record<number, [number, number, number, number, number]> = {
  1: [0x36, 0x26, 0x17, 0x07, 0x25],
  2: [0x3c, 0x2c, 0x1c, 0x0c, 0x21],
  3: [0x33, 0x23, 0x13, 0x03, 0x24],
  4: [0x37, 0x27, 0x17, 0x07, 0x28],
  5: [0x10, 0x00, 0x2d, 0x00, 0x28],
};

/** Facade accent per store (sign backing for open stores is by role). */
const FACADE: Record<StoreId, number> = {
  forever12: 0x25,
  radioshock: 0x00,
  crookstone: 0x17,
  gamestonk: 0x1a,
  kgbtoys: 0x16,
  blockblustar: 0x01,
  spenders: 0x13,
  sambaddy: 0x16,
  sharper: 0x1c,
  hotspy: 0x27,
  circuitpity: 0x00,
  footlock: 0x12,
  borderline: 0x0a,
};

const WIN_PERIOD: Record<string, number> = { 'radioshock.l': 4, 'gamestonk.r': 30, 'spenders.l': 26, 'spenders.r': 5, 'sharper.r': 14, 'sambaddy.r': 12, 'hotspy.l': 18, 'forever12.r': 40, 'kgbtoys.l': 30, 'kgbtoys.r': 30, 'crookstone.l': 28, 'sharper.l': 24 };

export interface Cam {
  x: number;
  y: number;
  ox: number; // shake
  oy: number;
}

export function makeCam(mall: Mall, frame: number): Cam {
  let ox = 0;
  let oy = 0;
  if (mall.shake > 0) {
    const m = Math.min(4, 1 + Math.floor(mall.shake / 4));
    ox = ((frame * 7) % (2 * m + 1)) - m;
    oy = ((frame * 5) % (2 * m + 1)) - m;
  }
  return { x: mall.cam.x + ox, y: mall.cam.y + oy, ox, oy };
}

export function drawMall(g: Gfx, mall: Mall, view: MallView, opts: { shuttersAmount?: number; hideAgent?: boolean } = {}): void {
  const f = view.frame;
  const cam = makeCam(mall, f);
  const X = (wx: number) => Math.floor(wx - cam.x);
  const Y = (wy: number) => Math.floor(wy - cam.y + HUD_H);

  g.rect(0, HUD_H, 256, VIEW_H, 0x0f);
  g.clip(0, HUD_H, 256, VIEW_H);

  drawSky(g, mall, X, Y, f);
  drawRoofStructures(g, mall, X, Y);

  for (let fl = 1; fl < FLOOR_COUNT; fl++) drawBand(g, mall, fl, X, Y, f);
  drawSlabs(g, mall, X, Y);
  for (const sf of STOREFRONTS) drawStorefront(g, mall, sf.id, X, Y, f);
  drawFurniture(g, mall, X, Y, f);
  drawEscalators(g, X, Y, f);
  drawShafts(g, mall, view, X, Y, f);
  drawLamps(g, mall, X, Y, f);
  drawPatches(g, mall, X, Y);
  drawWagon(g, mall, X, Y, f);
  drawActors(g, mall, view, X, Y, f, opts);
  drawDarkness(g, mall, X, Y);
  if (mall.alarm) {
    g.veil(0x16, 0.06 + 0.06 * Math.sin(f / 6));
  }
  if (opts.shuttersAmount !== undefined) drawShutters(g, mall, X, Y, opts.shuttersAmount);
  drawBubbles(g, mall, X, Y);
  g.unclip();
}

// ================================================================ sky & roof
function drawSky(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number, f: number): void {
  const roof = floorY(FLOOR_R);
  const bands = [0x0f, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04, 0x04, 0x05];
  const bh = Math.ceil(roof / bands.length);
  for (let i = 0; i < bands.length; i++) g.rect(0, Y(i * bh), 256, bh + 1, bands[i]);
  // stars (deterministic)
  for (let i = 0; i < 70; i++) {
    const sx = (i * 97 + 13) % MALL_W;
    const sy = (i * 53 + 7) % (roof - 36);
    if ((i + Math.floor(f / 24)) % 5 === 0) continue;
    g.px(X(sx), Y(sy), i % 3 === 0 ? 0x30 : 0x10);
  }
  // moon
  g.rect(X(560), Y(18), 10, 10, 0x38);
  g.rect(X(563), Y(16), 6, 14, 0x38);
  g.rect(X(566), Y(17), 5, 10, 0x05);
  // distant city skyline
  for (let i = 0; i < 40; i++) {
    const bx = 48 + i * 19;
    const h = 14 + ((i * 37) % 44);
    g.rect(X(bx), Y(roof - h), 15, h, 0x0f);
    g.rect(X(bx), Y(roof - h), 15, 1, 0x01);
    for (let wy = roof - h + 3; wy < roof - 3; wy += 5) for (let wx = 2; wx < 13; wx += 4) if ((i * 7 + wy + wx) % 4 === 0) g.px(X(bx + wx), Y(wy), (i + wy) % 3 ? 0x28 : 0x38);
  }
  // the dark skyscraper with lit windows at the left edge, and the zip-line cable
  g.rect(X(0), Y(20), 46, roof - 20, 0x0f);
  g.rect(X(0), Y(20), 46, 2, 0x00);
  g.rect(X(36), Y(14), 2, 6, 0x00);
  g.px(X(36), Y(12), f % 40 < 20 ? 0x16 : 0x0f);
  for (let wy = 26; wy < roof - 4; wy += 7) for (let wx = 4; wx < 42; wx += 8) {
    const lit = (wx * 13 + wy * 7 + (wy > 70 ? 3 : 0)) % 5 < 2;
    g.rect(X(wx), Y(wy), 4, 4, lit ? ((wx + wy) % 3 ? 0x28 : 0x38) : 0x01);
  }
  // cable: from the skyscraper ledge down to the anchor post
  const x0 = 38;
  const y0 = 44;
  const x1 = ZIP_POST_X;
  const y1 = floorY(FLOOR_R) - 44;
  const steps = x1 - x0;
  for (let i = 0; i <= steps; i++) g.px(X(x0 + i), Y(y0 + ((y1 - y0) * i) / steps), 0x10);
  void mall;
}

function drawRoofStructures(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number): void {
  const roof = floorY(FLOOR_R);
  // roof slab + parapet
  g.rect(X(0), Y(roof), MALL_W, 4, 0x10);
  g.rect(X(0), Y(roof), MALL_W, 1, 0x30);
  g.rect(X(0), Y(roof) + 4, MALL_W, 3, 0x2d);
  g.rect(X(0), Y(roof - 6), 8, 6, 0x10);
  g.rect(X(MALL_W - 8), Y(roof - 6), 8, 6, 0x10);
  // anchor post
  g.rect(X(ZIP_POST_X - 2), Y(roof - 46), 5, 46, 0x00);
  g.rect(X(ZIP_POST_X - 4), Y(roof - 48), 9, 4, 0x10);
  g.rect(X(ZIP_POST_X - 2), Y(roof - 3), 5, 3, 0x2d);
  // rooftop penthouses around shafts A and C (the cars stop here)
  for (const s of SHAFTS) {
    if (s.minFloor !== FLOOR_R) continue;
    g.rect(X(s.x - 8), Y(roof - 46), s.w + 16, 46, 0x10);
    g.rect(X(s.x - 8), Y(roof - 46), s.w + 16, 3, 0x30);
    g.rect(X(s.x - 10), Y(roof - 49), s.w + 20, 3, 0x2d);
    g.rect(X(s.x - 8), Y(roof - 46), 1, 46, 0x30);
    g.rect(X(s.x + s.w + 7), Y(roof - 46), 1, 46, 0x00);
    g.rect(X(s.x + 2), Y(roof - 56), 4, 7, 0x00); // vent
    g.rect(X(s.x + s.w - 8), Y(roof - 54), 6, 5, 0x00);
    g.rect(X(s.x - 2), Y(roof - 44), s.w + 4, 3, 0x00);
    g.px(X(s.cx), Y(roof - 43), 0x28);
  }
  void mall;
}

// ================================================================ bands, slabs
function drawBand(g: Gfx, mall: Mall, fl: number, X: (x: number) => number, Y: (y: number) => number, f: number): void {
  const st = FLOOR_STYLE[fl];
  const top = floorY(fl) - 44;
  g.rect(X(0), Y(top), MALL_W, 44, st[0]);
  if (fl === FLOOR_P) {
    // parking garage: dark concrete, painted lines, pipes
    g.rect(X(0), Y(top), MALL_W, 44, 0x00);
    g.rect(X(0), Y(top), MALL_W, 6, 0x2d);
    g.rect(X(0), Y(top + 8), MALL_W, 2, 0x10);
    for (let x = 20; x < MALL_W; x += 64) {
      g.rect(X(x), Y(floorY(fl) - 2), 24, 2, 0x28);
      g.rect(X(x + 40), Y(floorY(fl) - 14), 2, 14, 0x10);
    }
    for (let x = 0; x < MALL_W; x += 96) g.rect(X(x + 30), Y(top + 12), 6, 3, f % 60 < 30 ? 0x28 : 0x38);
    g.rect(X(0), Y(floorY(fl) - 20), MALL_W, 1, 0x2d);
    return;
  }
  // wainscot + rails
  g.rect(X(0), Y(floorY(fl) - 12), MALL_W, 12, st[1]);
  g.rect(X(0), Y(floorY(fl) - 13), MALL_W, 1, 0x30);
  // vertical pilasters
  for (let x = 0; x < MALL_W; x += 40) g.rect(X(x), Y(top), 1, 44, st[1]);
  // skylight stripes near the ceiling
  g.rect(X(0), Y(top), MALL_W, 2, st[4]);
  g.rect(X(0), Y(top + 2), MALL_W, 1, 0x30);
  // outer walls
  g.rect(X(0), Y(top), 8, 44, 0x0f);
  g.rect(X(MALL_W - 8), Y(top), 8, 44, 0x0f);
  void mall;
}

function drawSlabs(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number): void {
  for (let fl = 1; fl < FLOOR_COUNT; fl++) {
    const st = FLOOR_STYLE[fl];
    const y = floorY(fl);
    g.rect(X(0), Y(y), MALL_W, 4, st[2]);
    for (let x = 0; x < MALL_W; x += 8) if ((x / 8) % 2 === 0) g.rect(X(x), Y(y), 8, 2, st[3]);
    g.rect(X(0), Y(y), MALL_W, 1, 0x30);
    if (fl === FLOOR_P) g.rect(X(0), Y(y + 4), MALL_W, 8, 0x0f);
  }
  void mall;
}

// ================================================================ storefronts
export function drawStorefrontAt(g: Gfx, id: StoreId, x0: number, yTop: number, f: number, state: { cleared: boolean; bf: boolean }): void {
  const info = storeInfo(id);
  const dark = info.role === 'target' && state.cleared;
  const closed = info.role === 'closed';
  const facade = FACADE[id];
  // facade block
  g.rect(x0 - 1, yTop - 1, STORE_W + 2, 46, 0x0f);
  g.rect(x0, yTop, STORE_W, 45, facade);
  // sign
  const signBg = closed ? 0x2d : info.role === 'target' ? 0x16 : 0x12;
  const signFg = closed ? 0x10 : 0x30;
  g.rect(x0 + 1, yTop + 1, STORE_W - 2, 9, signBg);
  g.rect(x0 + 1, yTop + 1, STORE_W - 2, 1, closed ? 0x00 : info.role === 'target' ? 0x26 : 0x21);
  g.text(info.name, x0 + STORE_W / 2, yTop + 3, signFg, { font: 3, align: 'center' });
  // windows
  const win = (side: 'l' | 'r', wx: number) => {
    g.rect(wx, yTop + 11, 28, 32, closed ? 0x0f : 0x01);
    const key = `${id}.${side}`;
    const sname = `win.${key}`;
    const period = WIN_PERIOD[key] ?? 20;
    g.sprite(sname, Math.floor(f / period), wx, yTop + 11);
    if (dark) g.dim(wx, yTop + 11, 28, 32, 0.6);
  };
  win('l', x0);
  win('r', x0 + 52);
  // door
  const dx = x0 + 28;
  if (closed) g.sprite(id === 'circuitpity' ? 'shutter.half' : 'shutter', 0, dx, yTop + 11);
  else if (dark) g.sprite('door.dark', 0, dx, yTop + 11);
  else if (info.role === 'target') g.sprite('door.target', (f >> 4) & 1, dx, yTop + 11);
  else g.sprite('door.shop', 0, dx, yTop + 11);
  if (state.bf && !closed && !dark) g.sprite('sign.bf', 0, x0 + 26, yTop + 31);
}

function drawStorefront(g: Gfx, mall: Mall, id: StoreId, X: (x: number) => number, Y: (y: number) => number, f: number): void {
  const sf = STOREFRONTS.find((s) => s.id === id)!;
  const x = X(sf.x);
  if (x > 256 || x + STORE_W < 0) return;
  drawStorefrontAt(g, id, x, Y(floorY(sf.floor) - 44), f, { cleared: !!mall.run.setup[id]?.cleared, bf: mall.run.blackFriday });
}

// ================================================================ furniture
function drawFurniture(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number, f: number): void {
  for (const fu of FURNITURE) {
    const fy = floorY(fu.floor);
    const x = X(fu.x);
    if (x > 256 || x + 40 < 0) continue;
    switch (fu.kind) {
      case 'kiosk':
        g.sprite('kiosk', mall.kioskCd[fu.floor] > 0 ? 0 : (f >> 5) & 1, x, Y(fy - 30));
        break;
      case 'booth':
        g.sprite('booth', 0, x, Y(fy - 30));
        break;
      case 'fountain':
        g.sprite('fountain', (f >> 3) % 3, x, Y(fy - 22));
        break;
      case 'bench':
        g.sprite('bench', 0, x, Y(fy - 10));
        break;
      case 'plant':
        g.sprite('plant', 0, x, Y(fy - 20));
        break;
      case 'pillar':
        g.sprite('pillar', 0, x, Y(fy - 48));
        break;
    }
  }
}

function drawWagon(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number, f: number): void {
  const left = 6 - mall.run.packages.length;
  g.sprite('wagon', (f >> 4) & 1, X(GETAWAY.x), Y(floorY(FLOOR_P) - 22));
  if (left === 0 && (f >> 3) % 2 === 0) {
    g.text(UI.go, X(GETAWAY.x + 28), Y(floorY(FLOOR_P) - 32), 0x28, { font: 5, align: 'center', shadow: 0x0f });
  }
}

// ================================================================ escalators
function drawEscalators(g: Gfx, X: (x: number) => number, Y: (y: number) => number, f: number): void {
  for (const e of ESCALATORS) {
    const yU = floorY(e.upperFloor);
    const yL = floorY(e.lowerFloor);
    const dx = e.xUpper - e.xLower;
    // side wall under the ramp
    for (let t = 0; t <= 48; t++) {
      const wx = e.xLower + (dx * t) / 48;
      const wy = yL - t;
      g.rect(X(wx - 7), Y(wy), 14, 1, 0x2d);
      if ((t + (f >> 1) * (dx > 0 ? 1 : -1) * -1 + 480) % 6 < 3) g.rect(X(wx - 6), Y(wy - 1), 12, 1, 0x10);
      else g.rect(X(wx - 6), Y(wy - 1), 12, 1, 0x00);
    }
    // handrails
    for (let t = 0; t <= 48; t += 1) {
      const wx = e.xLower + (dx * t) / 48;
      g.px(X(wx), Y(yL - t - 24), 0x0f);
      g.px(X(wx), Y(yL - t - 23), 0x2d);
    }
    // balustrade posts
    for (const t of [0, 24, 48]) {
      const wx = e.xLower + (dx * t) / 48;
      g.rect(X(wx - 7), Y(yL - t - 24), 2, 24, 0x00);
      g.rect(X(wx + 5), Y(yL - t - 24), 2, 24, 0x00);
    }
    // landing plates
    g.rect(X(e.xLower - 12), Y(yL - 2), 24, 2, 0x28);
    g.rect(X(e.xUpper - 12), Y(yU - 2), 24, 2, 0x28);
    g.text(dx > 0 ? '>' : '<', X(e.xLower), Y(yL - 10), 0x28, { font: 5, align: 'center' });
  }
}

// ================================================================ shafts & elevators
function drawShafts(g: Gfx, mall: Mall, view: MallView, X: (x: number) => number, Y: (y: number) => number, f: number): void {
  SHAFTS.forEach((s, i) => {
    const car = mall.cars[i];
    const top = floorY(s.minFloor) - 44;
    const bot = floorY(s.maxFloor);
    const x = X(s.x);
    // shaft interior
    g.rect(x, Y(top), s.w, bot - top + 4, 0x0f);
    g.rect(x + 4, Y(top), 1, bot - top + 4, 0x2d);
    g.rect(x + s.w - 5, Y(top), 1, bot - top + 4, 0x2d);
    g.rect(x + 1, Y(top), 1, bot - top + 4, 0x00);
    g.rect(x + s.w - 2, Y(top), 1, bot - top + 4, 0x00);
    // counter-weight cable
    g.rect(x + 13, Y(top), 2, Math.max(0, car.y - 44 - top), 0x10);
    // openings
    for (let fl = s.minFloor; fl <= s.maxFloor; fl++) {
      const st = openingState(car, fl);
      const y = floorY(fl);
      if (st === 'above') {
        // grate
        g.rect(x, Y(y), s.w, 3, 0x10);
        for (let gx = 0; gx < s.w; gx += 3) g.rect(x + gx, Y(y), 1, 3, 0x00);
      } else if (st === 'below') {
        // open pit: hazard stripes on the lips
        for (let gx = 0; gx < s.w; gx += 4) {
          g.rect(x + gx, Y(y), 2, 2, 0x28);
        }
        g.rect(x, Y(y + 2), s.w, 2, 0x0f);
      }
      // floor plate: shaft letter + arrow
      g.text(s.id, x + s.w / 2, Y(y - 41), 0x28, { font: 3, align: 'center' });
    }
    // the car
    const cy = car.y;
    g.sprite('car.back', 0, x, Y(cy - 40));
    const p = mall.p;
    if (p.mode === 'car' && p.carIdx === i) drawAgent(g, mall, view, x + 6 + 0, Y(cy), f, true);
    g.sprite('car.front', Math.max(0, Math.min(3, view.doors[i])), x, Y(cy - 40));
    g.sprite('car.roof', 0, x, Y(cy - 44));
    // floor indicator light
    const ci = car.moving ? (f >> 2) & 1 : 1;
    g.px(x + 13, Y(cy - 39), ci ? 0x2a : 0x1a);
    g.px(x + 14, Y(cy - 39), ci ? 0x2a : 0x1a);
  });
}

// ================================================================ lamps
function drawLamps(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number, f: number): void {
  for (const l of mall.lamps) {
    const fy = floorY(l.floor);
    const x = X(l.x);
    if (x < -20 || x > 276) continue;
    if (l.state === 'hang') {
      if (l.disco) g.sprite('disco', (f >> 3) & 1, x - 6, Y(fy - 44));
      else g.sprite('lamp', 0, x - 5, Y(fy - 44));
    } else if (l.state === 'fall') {
      if (l.disco) g.sprite('ball', (f >> 2) & 1, x - 6, Y(l.y - 6));
      else g.spriteSub('lamp', 0, 0, 18, 10, 12, x - 5, Y(l.y - 6));
      // the cord stub left hanging
      g.vline(x, Y(fy - 44), 18, 0x2d);
    } else if (l.state === 'roll') {
      g.sprite('ball', (f >> 1) & 1, x - 6, Y(fy - 12));
    } else {
      g.vline(x, Y(fy - 44), 18, 0x2d);
      if (!l.disco) g.sprite('lamp.broken', 0, x - 6, Y(fy - 8));
    }
  }
  void LAMPS;
}

function drawPatches(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number): void {
  for (const w of mall.patches) {
    const fy = floorY(w.floor);
    const x0 = X(w.x0);
    const wd = w.x1 - w.x0;
    g.rect(x0, Y(fy - 2), wd, 2, 0x3c);
    g.rect(x0 + 3, Y(fy - 3), wd - 6, 1, 0x2c);
    for (let i = 4; i < wd - 4; i += 9) g.px(x0 + i, Y(fy - 2), 0x30);
    g.sprite('sign.wet', 0, x0 + wd / 2 - 5, Y(fy - 15));
  }
}

function drawDarkness(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number): void {
  for (const d of mall.darks) {
    const fy = floorY(d.floor);
    const a = Math.min(0.7, d.life / 40);
    g.ctx.globalAlpha = a;
    g.rect(X(d.x0), Y(fy - 44), d.x1 - d.x0, 44, 0x0f);
    g.ctx.globalAlpha = 1;
  }
}

// ================================================================ actors
export function agentSprite(mall: Mall, f: number): { name: string; flip: boolean } {
  const p = mall.p;
  const flip = p.dir < 0;
  switch (p.mode) {
    case 'zip':
      return { name: 'agent.zip', flip: false };
    case 'drop':
      return { name: 'agent.jump', flip: false };
    case 'crouch':
      return { name: 'agent.crouch', flip: false };
    case 'selfie':
      return { name: 'agent.selfie', flip: false };
    case 'dying':
      return { name: p.timer < 14 ? 'agent.die0' : 'agent.die1', flip };
    case 'frozen':
      return { name: 'agent.hurt', flip };
    case 'car':
    case 'escalator':
      return { name: p.shooting > 0 ? 'agent.shoot' : 'agent.stand', flip };
    default:
  }
  if (!p.onGround) return { name: p.kicking ? 'agent.kick' : 'agent.jump', flip };
  if (p.ducking) return { name: p.shooting > 0 ? 'agent.duckshoot' : 'agent.duck', flip };
  if (p.shooting > 0) return { name: 'agent.shoot', flip };
  if (p.slide !== 0) return { name: p.kicking ? 'agent.kick' : 'agent.walk1', flip };
  if (p.onRoof) return { name: 'agent.stand', flip };
  const moving = p.walkAnim > 0 && mall.lastMoveFrame >= mall.frame - 2;
  if (moving) return { name: `agent.walk${Math.floor(p.walkAnim / 5) % 4}`, flip };
  void f;
  return { name: 'agent.stand', flip };
}

function drawAgent(g: Gfx, mall: Mall, view: MallView, sx: number, sy: number, f: number, inCar = false): void {
  const p = mall.p;
  if (p.mode === 'store' || p.mode === 'booth') return;
  if (p.invuln > 0 && p.mode !== 'dying' && Math.floor(p.invuln / 3) % 2 === 0) return;
  const { name, flip } = agentSprite(mall, f);
  const inv = mall.run.powers.invincible;
  const xpx = inCar ? sx : sx;
  const ypx = inCar ? sy - 24 : sy - 24;
  if (inv) {
    const cols = [0x30, 0x28, 0x26, 0x2a];
    const c = cols[(f >> 2) % cols.length];
    g.spriteTint(name, 0, xpx, ypx, flip, [c, 0x0f, 0x37]);
  } else g.sprite(name, 0, xpx, ypx, flip);
  void view;
}

function drawActors(g: Gfx, mall: Mall, view: MallView, X: (x: number) => number, Y: (y: number) => number, f: number, opts: { hideAgent?: boolean }): void {
  // pickups
  for (const k of mall.pickups) {
    const x = X(k.x);
    const y = Y(k.y);
    if (k.kind === 'coin') g.sprite('coin', (f >> 3) % 4, x, y - 8);
    else if (k.kind === 'gold') g.sprite('coin.gold', (f >> 3) % 4, x, y - 8);
    else if (k.life > 180 || (f >> 2) % 2 === 0) g.sprite(`pu.${k.kind}`, 0, x - 4, y - 14 + Math.round(Math.sin(f / 8)));
  }
  // janitor
  const j = mall.janitor;
  {
    const name = j.state === 'mop' ? 'janitor.mop' : `janitor.walk${Math.floor(f / 8) % 4}`;
    g.sprite(name, 0, X(j.x), Y(floorY(j.floor) - 24), j.dir < 0);
  }
  // walkers
  for (const w of mall.walkers) {
    const moving = w.pause === 0;
    g.sprite(`walker${w.sprite}.${moving ? 'walk' + (Math.floor(f / 6) % 4) : 'stand'}`, 0, X(w.x), Y(floorY(w.floor) - 24), w.dir < 0);
  }
  // cop
  const c = mall.cop;
  g.sprite('cop', Math.floor(f / 8) % 2, X(c.x - 2), Y(floorY(c.floor) - 26), c.dir < 0);
  if (c.whistle > 0) g.text('!', X(c.x + 10), Y(floorY(c.floor) - 36), 0x28, { align: 'center', shadow: 0x0f });
  // spies
  for (const s of mall.spies) {
    let name = 'spy.stand';
    if (s.state === 'dying') name = s.t > SPY_DEATH_FRAMES * 0.55 ? 'spy.die0' : 'spy.die1';
    else if (s.state === 'aim') name = s.aimHigh ? 'spy.aimhigh' : 'spy.aimlow';
    else if (s.state === 'duck') name = 'spy.duck';
    else if (s.state === 'walk' && s.slide === 0) name = `spy.walk${Math.floor(s.walkAnim / 7) % 4}`;
    if (s.state === 'emerge') {
      // stepping out of the door: slide in from behind it
      const k = 1 - s.t / 20;
      g.clip(X(s.x), Y(s.y - 24), 16, 24);
      g.sprite(name, 0, X(s.x), Y(s.y - 24) + Math.round((1 - k) * 12), s.dir < 0);
      g.unclip();
    } else g.sprite(name, 0, X(s.x), Y(s.y - 24), s.dir < 0);
    if (s.state === 'aim' && (f >> 2) % 2 === 0) g.sprite('pad.exclaim', 0, X(s.x + 4), Y(s.y - 40));
  }
  // player
  if (!opts.hideAgent && mall.p.mode !== 'car') {
    const p = mall.p;
    if (p.mode === 'booth') {
      // only the shoes peek out from under the curtain
      g.rect(X(p.x + 5), Y(p.y - 1), 2, 1, 0x0f);
      g.rect(X(p.x + 9), Y(p.y - 1), 2, 1, 0x0f);
    } else drawAgent(g, mall, view, X(p.x), Y(p.y), f);
  }
  // bullets
  for (const b of mall.bullets) g.sprite(b.owner === 'player' ? 'bullet.p' : 'bullet.e', 0, X(b.x) - 2, Y(b.y) - 1);
  // kiosk panel
  void view;
}

function drawShutters(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number, amount: number): void {
  const a = Math.max(0, Math.min(1, amount));
  for (const sf of STOREFRONTS) {
    const x = X(sf.x - 2);
    const top = Y(floorY(sf.floor) - 44);
    const h = Math.floor(46 * a);
    if (h <= 0) continue;
    g.rect(x, top, STORE_W + 4, h, 0x10);
    for (let yy = 2; yy < h; yy += 3) g.rect(x, top + yy, STORE_W + 4, 1, 0x00);
    g.rect(x, top + h - 2, STORE_W + 4, 2, 0x2d);
  }
  // ...and over the agent
  const p = mall.p;
  const px = X(p.x - 4);
  const py = Y(p.y - 30);
  const h = Math.floor(34 * a);
  if (h > 0) {
    g.rect(px, py, 24, h, 0x10);
    for (let yy = 2; yy < h; yy += 3) g.rect(px, py + yy, 24, 1, 0x00);
  }
}

// ================================================================ speech bubbles & banners
export function placeBubble(text: string, anchorX: number, anchorY: number, w5: number): { x: number; y: number; w: number; h: number; tailX: number } {
  const w = w5 + 6;
  const h = 11;
  let x = Math.floor(anchorX - w / 2);
  x = Math.max(2, Math.min(256 - 2 - w, x));
  let y = Math.floor(anchorY - h);
  y = Math.max(HUD_H + 2, Math.min(240 - 4 - h, y));
  const tailX = Math.max(x + 4, Math.min(x + w - 5, Math.floor(anchorX)));
  return { x, y, w, h, tailX };
}

function drawBubbles(g: Gfx, mall: Mall, X: (x: number) => number, Y: (y: number) => number): void {
  for (const b of mall.bubbles) {
    const tw = g.measure(b.text);
    const bx = placeBubble(b.text, X(b.x), Y(b.y), tw);
    g.rect(bx.x, bx.y, bx.w, bx.h, 0x30);
    g.rect(bx.x + 1, bx.y - 1, bx.w - 2, 1, 0x30);
    g.rect(bx.x + 1, bx.y + bx.h, bx.w - 2, 1, 0x30);
    g.rect(bx.tailX - 1, bx.y + bx.h + 1, 3, 1, 0x30);
    g.rect(bx.tailX, bx.y + bx.h + 2, 1, 1, 0x30);
    g.text(b.text, bx.x + 3, bx.y + 2, 0x0f);
  }
}

export function drawBanner(g: Gfx, mall: Mall): void {
  const b = mall.banner;
  if (!b) return;
  const blink = (mall.frame >> 3) % 2 === 0;
  const lines = b.lines;
  const w = Math.max(...lines.map((l) => g.measure(l))) + 10;
  const h = lines.length * 9 + 5;
  const x = Math.floor((256 - w) / 2);
  const y = HUD_H + 6;
  const bg = b.kind === 'alarm' ? (blink ? 0x16 : 0x06) : b.kind === 'warn' ? 0x06 : b.kind === 'pa' ? 0x02 : 0x0f;
  const fg = b.kind === 'floor' ? 0x28 : b.kind === 'warn' ? 0x38 : 0x30;
  g.rect(x, y, w, h, bg);
  g.box(x, y, w, h, b.kind === 'pa' ? 0x21 : 0x30);
  lines.forEach((l, i) => g.text(l, 128, y + 4 + i * 9, fg, { align: 'center' }));
}

/** Drawn straight onto a Gfx: used by the map too. */
export function storeColour(mall: Mall, id: StoreId): 'package' | 'cleared' | 'powerup' | 'closed' {
  const info = storeInfo(id);
  if (info.role === 'closed') return 'closed';
  if (info.role === 'powerup') return 'powerup';
  return mall.run.setup[id]?.cleared ? 'cleared' : 'package';
}

export { STORES, hudSlot, carRoofY, SCREEN_W, MALL_H, shaftServes, floorAt, C };
