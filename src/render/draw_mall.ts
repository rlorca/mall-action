/** Draws the side-scrolling mall from the game state. Read-only on state. */
import { C } from '../core/palette';
import { TINY_FONT } from '../core/font';
import {
  ANCHOR_POST, BENCHES, CABLE_END, CABLE_START, CAR_H, ESCALATORS, FLOORS, FLOOR_NAMES, FOUNTAINS, KIOSKS, MALL_W,
  PHOTO_BOOTH, PILLARS, PLANTS, SHAFTS, SHAFT_W, SKYSCRAPER, SLAB, STORES, STORE_W, WAGON, WALL_L, WALL_R, floorAtY,
  serves, shaftCeiling, surf, type StoreDef,
} from '../game/layout';
import { isOpenStore, type StoreRuntime } from '../game/setup';
import type { Car, GameState, Level, MallPlayer, Spy } from '../game/state';
import { Gfx, HUD_H, SCREEN_W } from './gfx';
import { drawBubbles, drawPopups } from './draw_common';

/** Wall and trim colours of each floor band. */
const BAND: { wall: number; trim: number; accent: number }[] = [
  { wall: C.NAVY, trim: C.DBLUE, accent: C.WHITE }, // roof (sky, unused)
  { wall: C.PERI, trim: C.BLUE, accent: C.LAVENDER },
  { wall: C.MINT, trim: C.TEAL, accent: C.PALEGREEN },
  { wall: C.PINK, trim: C.MAGENTA, accent: C.LPINK },
  { wall: C.ORANGE, trim: C.RUST, accent: C.CREAM },
  { wall: C.DGREY, trim: C.GREY, accent: C.LGREY },
];

export function drawMall(gx: Gfx, g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const shakeX = g.shake > 0 ? ((g.frame * 7) % 5) - 2 : 0;
  const shakeY = g.shake > 0 ? ((g.frame * 3) % 3) - 1 : 0;
  gx.ox = m.camX + shakeX;
  gx.oy = m.camY - HUD_H + shakeY;
  drawWorld(gx, g, lvl, g.frame);
  gx.ox = 0;
  gx.oy = 0;
}

/** Background and all static mall structure + entities. Exported for reuse (title, game over). */
export function drawWorld(gx: Gfx, g: GameState, lvl: Level, t: number): void {
  const m = lvl.mall;
  drawSky(gx, t);
  for (let f = 1; f < FLOORS; f++) drawBand(gx, f, t);
  drawRoofStuff(gx);
  for (const e of ESCALATORS) drawEscalator(gx, e.lower, e.bottomX, e.topX, t);
  for (const s of STORES) drawStorefront(gx, s, lvl.stores[s.id], g.blackFriday, t, 0);
  drawFurniture(gx, g, lvl, t);
  // Elevator shafts and cars (back parts).
  SHAFTS.forEach((s, i) => drawShaft(gx, i, m.cars[i], t));
  for (let f = 0; f < FLOORS; f++) drawSlab(gx, lvl, f);
  drawLamps(gx, lvl, t);
  drawWet(gx, lvl, t);
  drawEntities(gx, g, lvl, t);
  SHAFTS.forEach((_, i) => drawCarFront(gx, i, m.cars[i], m.player));
  // Dark sections under shattered lamps.
  for (const d of m.dark) {
    gx.dim(d.x0 - gx.ox, surf(d.floor) - 42 - gx.oy, d.x1 - d.x0, 42, Math.min(0.6, d.t / 60));
  }
  drawPopups(gx, lvl.popups, gx.ox, gx.oy);
  drawBubbles(gx, lvl.bubbles, gx.ox, gx.oy);
}

// ---------------------------------------------------------------- background

function drawSky(gx: Gfx, t: number): void {
  const top = surf(0);
  const bands = [C.BLACK, C.BLACK, C.DBLUE, C.DPURPLE, C.DPURPLE, C.PURPLE];
  const h = Math.ceil(top / bands.length);
  bands.forEach((c, i) => gx.wrect(0, i * h, MALL_W, h, c));
  // Stars (fixed pattern, a few twinkle).
  for (let i = 0; i < 70; i++) {
    const x = (i * 97 + 13) % MALL_W;
    const y = (i * 53 + 7) % (top - 30);
    const tw = (i % 7 === 0 && Math.floor(t / 20 + i) % 3 === 0) ? C.GREY : C.WHITE;
    gx.wrect(x, y, 1, 1, i % 5 === 0 ? C.YELLOW : tw);
  }
  // Moon.
  gx.wrect(600, 20, 12, 12, C.CREAM);
  gx.wrect(604, 18, 4, 16, C.CREAM);
  gx.wrect(598, 24, 16, 4, C.CREAM);
  gx.wrect(606, 22, 5, 5, C.YELLOW);
  // Skyscraper with lit windows.
  const sk = SKYSCRAPER;
  gx.wrect(sk.x, sk.top, sk.w, top - sk.top, C.BLACK);
  gx.wrect(sk.x + sk.w - 2, sk.top, 2, top - sk.top, C.DGREY);
  gx.wrect(sk.x + 20, sk.top - 6, 2, 6, C.DGREY);
  if (Math.floor(t / 30) % 2 === 0) gx.wrect(sk.x + 20, sk.top - 8, 2, 2, C.RED);
  for (let y = sk.top + 6; y < top - 6; y += 7) {
    for (let x = sk.x + 4; x < sk.x + sk.w - 6; x += 6) {
      const lit = ((x * 7 + y * 13) % 11) < 5;
      gx.wrect(x, y, 3, 4, lit ? C.YELLOW : C.DBLUE);
    }
  }
  // Cable to the roof anchor post.
  line(gx, CABLE_START.x, CABLE_START.y, CABLE_END.x, CABLE_END.y, C.LGREY);
  gx.wrect(ANCHOR_POST.x - 2, ANCHOR_POST.top, 4, surf(0) - ANCHOR_POST.top, C.GREY);
  gx.wrect(ANCHOR_POST.x - 3, ANCHOR_POST.top, 6, 3, C.LGREY);
}

function line(gx: Gfx, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) gx.wrect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1, c);
}

function drawRoofStuff(gx: Gfx): void {
  const y = surf(0);
  // Parapet and roof units.
  gx.wrect(WALL_L, y - 3, WALL_R - WALL_L, 3, C.GREY);
  for (const x of [300, 470, 560]) {
    gx.wrect(x, y - 16, 28, 16, C.LGREY);
    gx.wrect(x + 2, y - 14, 24, 2, C.GREY);
    gx.wrect(x + 2, y - 10, 24, 2, C.GREY);
    gx.wrect(x + 2, y - 6, 24, 2, C.GREY);
  }
  // Big rooftop sign.
  gx.wrect(650, y - 44, 92, 30, C.DRED);
  gx.wrect(652, y - 42, 88, 26, C.RED);
  gx.text('MALL', 668 - gx.ox, y - 38 - gx.oy, C.YELLOW, { shadow: C.DRED });
  gx.text('ACTION', 662 - gx.ox, y - 28 - gx.oy, C.WHITE, { shadow: C.DRED });
  gx.wrect(664, y - 14, 3, 14, C.GREY);
  gx.wrect(726, y - 14, 3, 14, C.GREY);
}

function drawBand(gx: Gfx, f: number, t: number): void {
  const b = BAND[f];
  const top = surf(f - 1) + SLAB;
  const bottom = surf(f);
  gx.wrect(0, top, MALL_W, bottom - top, b.wall);
  // Ceiling trim with little lights.
  gx.wrect(0, top, MALL_W, 3, b.trim);
  for (let x = 12; x < MALL_W; x += 32) gx.wrect(x, top + 3, 4, 1, b.accent);
  if (f === 5) {
    // Parking: stripes, pillars, level sign.
    for (const px of PILLARS) {
      gx.wrect(px, top, 12, bottom - top, C.GREY);
      gx.wrect(px + 1, top, 2, bottom - top, C.LGREY);
      for (let y = bottom - 10; y < bottom; y += 4) {
        gx.wrect(px, y, 12, 2, C.GOLD);
        gx.wrect(px, y + 2, 12, 2, C.BLACK);
      }
    }
    for (let x = 24; x < MALL_W; x += 40) gx.wrect(x, bottom - 1, 16, 1, C.YELLOW);
    gx.text('P', 20 - gx.ox, top + 10 - gx.oy, C.YELLOW);
    gx.text('EXIT →', 600 - gx.ox, top + 8 - gx.oy, C.LGREEN, { font: TINY_FONT });
  } else {
    // Floor label painted on the wall at both ends.
    gx.text(FLOOR_NAMES[f], 14 - gx.ox, top + 7 - gx.oy, b.trim);
    gx.text(FLOOR_NAMES[f], WALL_R - 16 - gx.ox, top + 7 - gx.oy, b.trim);
    if (f === 3) {
      // 2F disco: a few coloured floor lights.
      const cols = [C.HOTPINK, C.CYAN, C.GOLD, C.LGREEN];
      for (let x = 0; x < MALL_W; x += 24) gx.wrect(x + 4, bottom - 2, 8, 2, cols[(x / 24 + Math.floor(t / 15)) % cols.length]);
    }
  }
  // Side walls.
  gx.wrect(0, top, WALL_L, bottom - top, C.GREY);
  gx.wrect(WALL_R, top, MALL_W - WALL_R, bottom - top, C.GREY);
}

function drawSlab(gx: Gfx, lvl: Level, f: number): void {
  const y = surf(f);
  const m = lvl.mall;
  const cuts = SHAFTS.map((s, i) => ({ s, i })).filter(({ s }) => serves(s, f));
  const top = f === 0 ? C.LGREY : C.WHITE;
  const body = f === 5 ? C.GREY : f === 0 ? C.GREY : C.LGREY;
  const drawPart = (x0: number, x1: number) => {
    if (x1 <= x0) return;
    gx.wrect(x0, y, x1 - x0, 1, top);
    gx.wrect(x0, y + 1, x1 - x0, SLAB - 1, body);
    gx.wrect(x0, y + SLAB - 1, x1 - x0, 1, C.GREY);
    for (let x = x0 - (x0 % 16) + 16; x < x1; x += 16) gx.wrect(x, y + 1, 1, SLAB - 2, C.GREY);
  };
  let x = 0;
  for (const { s, i } of cuts) {
    drawPart(x, s.x);
    const car = m.cars[i];
    if (car.y < y) {
      // Car above: a grate you can stand on.
      gx.wrect(s.x, y, SHAFT_W, 2, C.GREY);
      for (let gx0 = s.x; gx0 < s.x + SHAFT_W; gx0 += 3) gx.wrect(gx0, y, 1, SLAB, C.LGREY);
    }
    x = s.x + SHAFT_W;
  }
  drawPart(x, MALL_W);
  if (f === 5) gx.wrect(0, y + SLAB, MALL_W, 16, C.DGREY);
}

// ---------------------------------------------------------------- shafts and cars

function drawShaft(gx: Gfx, i: number, car: Car, t: number): void {
  const s = SHAFTS[i];
  const top = shaftCeiling(s);
  const bottom = surf(s.bottom);
  gx.wrect(s.x, top, SHAFT_W, bottom - top, C.BLACK);
  gx.wrect(s.x + 5, top, 1, bottom - top, C.DGREY);
  gx.wrect(s.x + SHAFT_W - 6, top, 1, bottom - top, C.DGREY);
  // Machine housing on top.
  gx.wrect(s.x - 3, top - 6, SHAFT_W + 6, 6, C.GREY);
  gx.wrect(s.x - 3, top - 6, SHAFT_W + 6, 1, C.LGREY);
  gx.wrect(s.x - 3, top, 3, surf(s.top) - top, C.GREY);
  gx.wrect(s.x + SHAFT_W, top, 3, surf(s.top) - top, C.GREY);
  gx.text(s.id, s.x + 9 - gx.ox, top - 5 - gx.oy, C.WHITE, { font: TINY_FONT });
  // Door frames and floor indicators at every served floor.
  for (let f = s.top; f <= s.bottom; f++) {
    const y = surf(f);
    gx.wrect(s.x - 2, y - 34, 2, 34, C.LGREY);
    gx.wrect(s.x + SHAFT_W, y - 34, 2, 34, C.LGREY);
    gx.wrect(s.x - 2, y - 36, SHAFT_W + 4, 2, C.LGREY);
    gx.wrect(s.x + 4, y - 42, 16, 6, C.BLACK);
    const cf = floorAtY(car.y);
    const label = cf >= 0 ? FLOOR_NAMES[cf] : car.dir < 0 ? '↑' : '↓';
    const lit = cf === f ? C.GOLD : C.RED;
    if (cf >= 0) gx.text(label, s.x + 12 - label.length * 2 - gx.ox, y - 42 - gx.oy, lit, { font: TINY_FONT });
    else if (Math.floor(t / 8) % 2 === 0) gx.wrect(s.x + 11, y - 40, 2, 2, C.RED);
  }
  // The car's back wall (riders are drawn over this, then the front).
  const cy = car.y - CAR_H;
  gx.wrect(s.x + 1, cy, SHAFT_W - 2, CAR_H, C.OLIVE);
  gx.wrect(s.x + 3, cy + 3, SHAFT_W - 6, CAR_H - 6, C.GOLD);
  gx.wrect(s.x + 3, cy + 12, SHAFT_W - 6, 1, C.OLIVE);
  gx.wrect(s.x + 1, car.y - 2, SHAFT_W - 2, 2, C.DGREY);
  // Cable above the car.
  gx.wrect(s.x + 11, top, 2, cy - top, C.GREY);
}

function drawCarFront(gx: Gfx, i: number, car: Car, p: MallPlayer): void {
  const s = SHAFTS[i];
  const cy = car.y - CAR_H;
  // Roof and frame.
  gx.wrect(s.x, cy - 2, SHAFT_W, 3, C.GREY);
  gx.wrect(s.x, cy, 1, CAR_H, C.DGREY);
  gx.wrect(s.x + SHAFT_W - 1, cy, 1, CAR_H, C.DGREY);
  // Doors: closed while moving, open while stopped.
  if (car.moving) {
    const inside = p.mode === 'elevator' && p.car === i;
    gx.wrect(s.x + 1, cy + 1, 11, CAR_H - 3, C.LGREY);
    gx.wrect(s.x + 12, cy + 1, 11, CAR_H - 3, C.LGREY);
    gx.wrect(s.x + 11, cy + 1, 2, CAR_H - 3, C.GREY);
    // Little windows so the rider stays visible.
    if (inside) {
      gx.wrect(s.x + 5, cy + 3, 14, 12, C.GOLD);
      gx.ctx.save();
      gx.ctx.beginPath();
      gx.ctx.rect(s.x + 5 - gx.ox, cy + 3 - gx.oy, 14, 12);
      gx.ctx.clip();
      gx.wspr('agent_ride', s.x + 12, car.y);
      gx.ctx.restore();
    } else gx.wrect(s.x + 7, cy + 6, 10, 5, C.DGREY);
  } else {
    gx.wrect(s.x + 1, cy + 1, 3, CAR_H - 3, C.LGREY);
    gx.wrect(s.x + SHAFT_W - 4, cy + 1, 3, CAR_H - 3, C.LGREY);
  }
}

// ---------------------------------------------------------------- escalators

function drawEscalator(gx: Gfx, lower: number, bottomX: number, topX: number, t: number): void {
  const yb = surf(lower);
  const dir = Math.sign(topX - bottomX);
  const len = Math.abs(topX - bottomX);
  for (let i = 0; i <= len; i++) {
    const x = bottomX + dir * i;
    const y = yb - i;
    gx.wrect(x - 1, y, 3, yb - y + 1, C.GREY);
    gx.wrect(x - 1, y - 1, 3, 2, (i + Math.floor(t / 4)) % 4 === 0 ? C.WHITE : C.LGREY);
    gx.wrect(x - 1, y - 12, 3, 2, C.BLACK); // handrail
  }
  gx.wrect(bottomX - 6, yb - 12, 3, 12, C.DGREY);
  gx.wrect(topX - 2 + dir * 3, yb - len - 12, 3, 12, C.DGREY);
  // Landing plates.
  gx.wrect(bottomX - 7, yb - 1, 14, 1, C.GOLD);
  gx.wrect(topX - 7, yb - len - 1, 14, 1, C.GOLD);
}

// ---------------------------------------------------------------- storefronts

const SIGN = { target: { bg: C.RED, fg: C.WHITE }, powerup: { bg: C.BLUE, fg: C.WHITE }, closed: { bg: C.GREY, fg: C.LGREY } };
const DIM = [C.DGREY, C.GREY, C.BLACK];

/**
 * One storefront: sign on top, door in the middle, a display window each side.
 * `x0` shifts it (title screen reuses this with its own positions).
 */
export function drawStorefront(gx: Gfx, s: StoreDef, rt: StoreRuntime | undefined, bf: boolean, t: number, x0: number, yOverride?: number): void {
  const x = s.x + x0;
  const y = yOverride ?? surf(s.floor);
  const cleared = s.role === 'target' && !!rt?.cleared;
  const open = s.role === 'closed' ? false : isOpenStore(s, rt);
  // Facade.
  gx.wrect(x, y - 40, STORE_W, 40, C.DGREY);
  gx.wrect(x + 1, y - 39, STORE_W - 2, 38, C.GREY);
  // Sign, coloured by role.
  const sc = SIGN[s.role];
  gx.wrect(x + 2, y - 39, STORE_W - 4, 9, cleared ? C.DGREY : sc.bg);
  gx.textC(s.name, x + STORE_W / 2 - gx.ox, y - 37 - gx.oy, cleared ? C.GREY : sc.fg, { font: TINY_FONT });
  // Windows with displays.
  const glass = s.role === 'closed' ? C.DGREY : cleared ? C.BLACK : C.SKY;
  for (const [wx, side] of [[x + 4, 'a'], [x + 48, 'b']] as const) {
    gx.wrect(wx, y - 28, 28, 24, C.LGREY);
    gx.wrect(wx + 1, y - 27, 26, 22, glass);
    const base = `disp_${s.id}_${side}`;
    const name = gx.anim(base, t + (side === 'b' ? 7 : 0), 14);
    const spr = gx.sprite(name);
    if (spr) gx.spr(name, wx + 2 - gx.ox, y - 26 - gx.oy, false, cleared || s.role === 'closed' ? DIM.slice(0, spr.colors.length) : undefined);
    // Glass glint.
    if (s.role !== 'closed' && !cleared) gx.wrect(wx + 22, y - 26, 1, 5, C.WHITE);
  }
  // Door.
  const dx = x + 32;
  gx.wrect(dx, y - 26, 16, 26, C.LGREY);
  if (s.role === 'closed') {
    for (let yy = y - 26; yy < y; yy += 3) gx.wrect(dx + 1, yy, 14, 2, C.GREY);
  } else if (cleared) {
    gx.wrect(dx + 1, y - 25, 14, 25, C.BLACK);
  } else {
    const blink = s.role === 'target' && Math.floor(t / 16) % 2 === 1;
    const col = s.role === 'target' ? (blink ? C.DRED : C.RED) : C.BLUE;
    gx.wrect(dx + 1, y - 25, 14, 25, col);
    gx.wrect(dx + 7, y - 25, 2, 25, s.role === 'target' ? C.CRIMSON : C.DBLUE);
    gx.wrect(dx + 3, y - 20, 3, 6, C.SKY);
    gx.wrect(dx + 10, y - 20, 3, 6, C.SKY);
    gx.wrect(dx + 5, y - 12, 1, 3, C.GOLD);
    gx.wrect(dx + 10, y - 12, 1, 3, C.GOLD);
  }
  // Closed-store extras.
  if (s.id === 'circuitpity') {
    // Shutter half down over the whole front.
    for (let yy = y - 29; yy < y - 16; yy += 3) gx.wrect(x + 3, yy, STORE_W - 6, 2, C.LGREY);
    gx.wrect(x + 3, y - 16, STORE_W - 6, 1, C.GREY);
  }
  if (s.id === 'borderline') {
    gx.wrect(x + 6, y - 16, STORE_W - 12, 7, C.GOLD);
    gx.textC('CLOSING SALE', x + STORE_W / 2 - gx.ox, y - 15 - gx.oy, C.DRED, { font: TINY_FONT });
  }
  // Black Friday sign on every open storefront.
  if (bf && open) {
    gx.wrect(x + 5, y - 34, 26, 7, C.YELLOW);
    gx.text('70% OFF', x + 6 - gx.ox, y - 33 - gx.oy, C.RED, { font: TINY_FONT });
  }
}

// ---------------------------------------------------------------- furniture, lights, wet floor

function drawFurniture(gx: Gfx, g: GameState, lvl: Level, t: number): void {
  const m = lvl.mall;
  for (const k of KIOSKS) {
    gx.wspr('kiosk', k.x, surf(k.floor));
    if (m.kioskCool === 0 && Math.floor(t / 20) % 2 === 0) gx.wrect(k.x - 1, surf(k.floor) - 26, 2, 2, C.LGREEN);
  }
  for (const b of BENCHES) gx.wspr('bench', b.x, surf(b.floor));
  for (const p of PLANTS) gx.wspr('plant', p.x, surf(p.floor));
  FOUNTAINS.forEach((f, i) => {
    const cool = m.fountainCool[i] > 0;
    gx.wspr(cool ? 'fountain_0' : gx.anim('fountain', t, 8), f.x, surf(f.floor));
  });
  // Photo booth (curtain closed when someone is inside).
  const hidden = m.player.mode === 'hidden';
  gx.wspr('booth', PHOTO_BOOTH.x, surf(PHOTO_BOOTH.floor));
  if (hidden) {
    gx.wrect(PHOTO_BOOTH.x - 7, surf(PHOTO_BOOTH.floor) - 24, 14, 20, C.RED);
    gx.wrect(PHOTO_BOOTH.x - 5, surf(PHOTO_BOOTH.floor) - 4, 3, 3, C.BLACK);
    gx.wrect(PHOTO_BOOTH.x + 2, surf(PHOTO_BOOTH.floor) - 4, 3, 3, C.BLACK);
  }
  // Getaway car.
  const wy = surf(WAGON.floor);
  gx.wspr('wagon_body', WAGON.x + WAGON.w / 2, wy - 2);
  gx.spr('wagon_wheel_0', WAGON.x + 10 - gx.ox, wy - 10 - gx.oy);
  gx.spr('wagon_wheel_0', WAGON.x + 46 - gx.ox, wy - 10 - gx.oy);
  if (lvl.packages >= 6 && Math.floor(t / 20) % 2 === 0) {
    gx.textC('GO!', WAGON.x + WAGON.w / 2 - gx.ox, wy - 36 - gx.oy, C.LGREEN, { shadow: C.BLACK });
  }
  void g;
}

function drawLamps(gx: Gfx, lvl: Level, t: number): void {
  for (const l of lvl.mall.lamps) {
    const ceil = surf(l.floor) - 42;
    if (l.state === 'hang') {
      const shadeTop = l.y - (l.disco ? 16 : 8);
      gx.wrect(l.x, ceil, 1, shadeTop - ceil, C.BLACK);
      if (l.disco) gx.wspr(gx.anim('disco', t, 10), l.x, l.y);
      else {
        gx.wspr('lamp', l.x, l.y);
        // Warm light cone.
        gx.wrect(l.x - 3, l.y, 7, 1, C.YELLOW);
      }
    } else if (l.state === 'fall' || l.state === 'roll') {
      gx.wspr(l.disco ? gx.anim('disco', t, 4) : 'lamp', l.x, l.y);
    }
  }
  for (const s of lvl.mall.shards) gx.wspr('glass', s.x, s.y);
}

function drawWet(gx: Gfx, lvl: Level, t: number): void {
  const w = lvl.mall.wet;
  if (!w) return;
  const y = surf(w.floor);
  gx.wrect(w.x0, y - 1, w.x1 - w.x0, 2, C.LBLUE);
  for (let x = w.x0 + ((t >> 2) % 6); x < w.x1; x += 6) gx.wrect(x, y - 1, 2, 1, C.WHITE);
  gx.wspr('wetsign', (w.x0 + w.x1) / 2, y);
}

// ---------------------------------------------------------------- characters

function spyFrame(gx: Gfx, s: Spy): string {
  switch (s.mode) {
    case 'aim':
      return s.aimHigh ? 'spy_aim_high' : 'spy_aim_low';
    case 'duck':
      return 'spy_duck';
    case 'dying':
      return 'spy_dead';
    case 'walk':
      return gx.anim('spy_walk', s.anim, 8);
    default:
      return 'spy_stand';
  }
}

export function playerFrame(gx: Gfx, p: MallPlayer): string {
  switch (p.mode) {
    case 'zip':
      return 'agent_hang';
    case 'drop':
      return 'agent_jump';
    case 'land':
      return 'agent_crouch';
    case 'selfie':
      return 'agent_selfie';
    case 'dead':
      return 'agent_dead';
    case 'air':
      return p.kick ? 'agent_kick' : p.shooting > 0 ? 'agent_shoot' : 'agent_jump';
    case 'elevator':
      return p.shooting > 0 ? 'agent_shoot' : 'agent_ride';
    default:
      break;
  }
  if (p.slide !== 0) return p.kick ? 'agent_kick' : 'agent_stand';
  if (p.duck) return p.shooting > 0 ? 'agent_duckshoot' : 'agent_duck';
  if (p.shooting > 0) return 'agent_shoot';
  if (p.mode === 'escalator') return 'agent_stand';
  if (p.anim > 0 && p.still === 0) {
    const cycle = [0, 1, 0, 2][Math.floor(p.anim / 7) % 4];
    return `agent_walk_${cycle}`;
  }
  return 'agent_stand';
}

const CINNA = [[C.GOLD, C.BLACK, C.WHITE], [C.HOTPINK, C.BLACK, C.SKIN], [C.CYAN, C.BLACK, C.WHITE]];

function drawEntities(gx: Gfx, g: GameState, lvl: Level, t: number): void {
  const m = lvl.mall;
  // Janitor.
  const j = m.janitor;
  gx.wspr(j.mopT > 0 ? gx.anim('janitor_mop', j.anim, 10) : gx.anim('janitor_walk', j.anim, 12), j.x, surf(4), j.dir < 0);
  for (const w of m.walkers) {
    gx.wspr(gx.anim(w.id % 2 ? 'walker_a' : 'walker_b', w.anim, 9), w.x, surf(w.floor), w.dir < 0);
  }
  const cop = m.cop;
  gx.wspr(cop.chase > 0 && Math.floor(t / 10) % 2 === 0 ? 'cop_whistle' : gx.anim('cop', cop.anim, 12), cop.x, surf(cop.floor), cop.facing < 0);
  for (const c of m.coins) {
    if (c.t < 90 && Math.floor(t / 4) % 2 === 0) continue;
    gx.wspr(gx.anim(c.gold ? 'gcoin' : 'coin', t, 5), c.x, c.y);
  }
  for (const u of m.pickups) {
    if (u.t < 120 && Math.floor(t / 4) % 2 === 0) continue;
    gx.wspr('pu_' + u.kind, u.x, u.y);
  }
  for (const s of m.spies) {
    if (s.mode === 'dying' && Math.floor(s.t / 3) % 2 === 1) continue;
    if (s.mode === 'emerge') {
      // Stepping out of a door: rises into view.
      gx.ctx.save();
      gx.ctx.beginPath();
      gx.ctx.rect(s.x - 8 - gx.ox, s.y - 26 - gx.oy, 16, 26);
      gx.ctx.clip();
      gx.wrect(s.x - 7, s.y - 25, 14, 25, C.BLACK);
      gx.wspr('spy_stand', s.x, s.y, s.facing < 0);
      gx.ctx.restore();
      continue;
    }
    gx.wspr(spyFrame(gx, s), s.x, s.y, s.facing < 0);
  }
  // The agent.
  const p = m.player;
  const blink = p.invuln > 0 && Math.floor(t / 3) % 2 === 0;
  const inMovingCar = p.mode === 'elevator' && m.cars[p.car].moving;
  if (p.mode !== 'hidden' && !blink && !inMovingCar) {
    const frame = playerFrame(gx, p);
    const colors = lvl.powers.invincT > 0 ? CINNA[Math.floor(t / 4) % CINNA.length] : undefined;
    const flip = p.mode === 'elevator' && frame === 'agent_ride' ? false : p.facing < 0;
    gx.wspr(frame, p.x, p.y, flip, colors);
    if (p.frozen > 0 && Math.floor(t / 8) % 2 === 0) gx.textC('!!', p.x - gx.ox, p.y - 34 - gx.oy, C.YELLOW, { shadow: C.BLACK });
    if (lvl.powers.armor) gx.wrect(p.x - 1, p.y - 30, 2, 2, C.CYAN);
  }
  for (const b of m.bullets) gx.spr(b.mine ? 'bullet' : 'ebullet', b.x - 2 - gx.ox, b.y - 1 - gx.oy, b.vx < 0);
  void g;
  void SCREEN_W;
}
