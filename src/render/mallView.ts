import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { makeRecolor } from '../engine/sprite';
import { getSprite } from '../art/registry';
import { drawStorefront } from '../art/storefront';
import {
  ARRIVAL,
  CAR_H,
  CEILING_GAP,
  ESCALATORS,
  FEATURES,
  LEVEL_H,
  LEVEL_W,
  NUM_FLOORS,
  ROOF_Y,
  SHAFTS,
  SLAB_H,
  floorY,
} from '../content/layout';
import { STORES } from '../content/stores';
import { storeStatus } from '../game/levelstate';
import type { Level } from '../game/level';
import type { MallWorld } from '../game/mall/world';
import { openingState } from '../game/mall/geometry';
import type { Car, PlayerState, Spy } from '../game/mall/types';
import { drawBanner, drawBubbles, drawPopups } from './widgets';
import { hash01 } from './screenFx';
import { drawSpygram, spygramLikes } from './spygramView';

/** HUD strip height: the mall view starts below it. */
export const VIEW_TOP = 16;
export const VIEW_H = 224;

/**
 * Optional extra drawing hooks supplied by the integrator (NPCs, lamps and other state-dependent
 * furniture live in their own module and draw themselves).
 */
export interface MallDrawHooks {
  furniture?: (fb: Framebuffer, w: MallWorld, camX: number, camY: number, frame: number) => void;
  actors?: (fb: Framebuffer, w: MallWorld, camX: number, camY: number, frame: number) => void;
}

const FLASH = makeRecolor({ [C.RED]: C.WHITE, [C.PEACH]: C.WHITE, [C.BLACK]: C.YELLOW });
const GHOST = makeRecolor({ [C.RED]: C.LTGRAY, [C.PEACH]: C.LTGRAY });
const SKY_BANDS = [C.BLACK, C.BLACK, C.DKBLUE, C.DKBLUE, C.VIOLET, C.DKBLUE, C.VIOLET, C.PURPLE0];

/** Draw the whole mall scene (world + entities + banners) below the HUD. */
export function drawMall(fb: Framebuffer, level: Level, frame: number, hooks: MallDrawHooks = {}): void {
  const w = level.mall;
  const shake = w.shake > 0 ? ((frame & 2 ? 1 : -1) * Math.min(3, Math.ceil(w.shake / 4))) : 0;
  const camX = Math.round(w.cam.x) + shake;
  const camY = Math.round(w.cam.y) + (w.shake > 0 && frame & 1 ? 1 : 0);

  fb.pushClip(0, VIEW_TOP, 256, VIEW_H);
  fb.fillRect(0, VIEW_TOP, 256, VIEW_H, C.BLACK);
  drawSky(fb, camX, camY);
  drawBuilding(fb, camX, camY, frame);
  drawStorefronts(fb, level, camX, camY, frame);
  drawShafts(fb, w, camX, camY);
  drawFeatures(fb, camX, camY, frame);
  drawEscalators(fb, camX, camY, frame);
  hooks.furniture?.(fb, w, camX, camY, frame);
  drawCars(fb, w, camX, camY);
  hooks.actors?.(fb, w, camX, camY, frame);
  drawSpies(fb, w, camX, camY, frame);
  drawPickups(fb, w, camX, camY, frame);
  drawPlayer(fb, w, camX, camY, frame);
  drawBullets(fb, w, camX, camY);
  if (w.run.alarmOn) drawAlarm(fb, frame);
  drawPopups(fb, w.popups, camX, camY - VIEW_TOP);
  drawBubbles(fb, w.bubbles, camX, camY - VIEW_TOP);
  if (w.banner) drawBanner(fb, w.banner, VIEW_TOP + 8);
  drawSelfie(fb, w, frame);
  fb.popClip();
}

// ------------------------------------------------------------------ helpers
const sx = (x: number, camX: number): number => Math.round(x - camX);
const sy = (y: number, camY: number): number => Math.round(y - camY) + VIEW_TOP;

function drawSky(fb: Framebuffer, camX: number, camY: number): void {
  const top = sy(0, camY);
  const bottom = sy(ROOF_Y, camY);
  if (bottom <= VIEW_TOP) return;
  const bandH = Math.ceil(ROOF_Y / SKY_BANDS.length);
  SKY_BANDS.forEach((c, i) => fb.fillRect(0, top + i * bandH, 256, bandH + 1, c));
  // stars (deterministic hash, so they never shimmer between frames except by design)
  for (let i = 0; i < 46; i++) {
    const wx = Math.floor(hash01(i, 1) * LEVEL_W);
    const wy = Math.floor(hash01(i, 2) * (ROOF_Y - 24));
    fb.setPixel(sx(wx, camX), sy(wy, camY), i % 5 === 0 ? C.PALEYELLOW : C.LTGRAY);
  }
  // distant skyline
  for (let i = 0; i < 26; i++) {
    const bx = i * 32 + Math.floor(hash01(i, 5) * 10);
    const bh = 14 + Math.floor(hash01(i, 6) * 30);
    const bw = 14 + Math.floor(hash01(i, 7) * 14);
    const x = sx(bx, camX);
    const y = sy(ROOF_Y - bh, camY);
    fb.fillRect(x, y, bw, bh, C.DKBLUE);
    for (let wy = 3; wy < bh - 3; wy += 5) for (let wx = 3; wx < bw - 3; wx += 5) if (hash01(i * 31 + wy, wx) > 0.7) fb.setPixel(x + wx, y + wy, C.DKGREEN);
  }
}

/** The dark skyscraper at the left edge with lit windows, and the zip-line cable down to the anchor post. */
function drawBuilding(fb: Framebuffer, camX: number, camY: number, frame: number): void {
  const bx = sx(0, camX);
  const top = sy(ROOF_Y - 130, camY);
  const h = 130 + 40;
  fb.fillRect(bx, top, 46, h, C.BLACK);
  fb.fillRect(bx + 46, top, 2, h, C.DKBLUE);
  fb.fillRect(bx, top, 48, 2, C.DKBLUE);
  for (let r = 0; r < 18; r++) {
    for (let c = 0; c < 6; c++) {
      const lit = hash01(r * 7 + c, 17) > 0.45;
      const x = bx + 4 + c * 7;
      const y = top + 8 + r * 7;
      fb.fillRect(x, y, 4, 4, lit ? ((r + c) % 3 === 0 ? C.YELLOW : C.AMBER) : C.DKBLUE);
    }
  }
  // roof antenna blinking
  if ((frame >> 4) & 1) fb.fillRect(bx + 22, top - 6, 2, 2, C.RED);
  fb.vLine(bx + 22, top - 4, 4, C.MDGRAY);
  // cable
  fb.line(sx(ARRIVAL.cableStartX, camX), sy(ARRIVAL.cableStartY, camY), sx(ARRIVAL.postX, camX), sy(ARRIVAL.postTopY, camY), C.LTGRAY);
}

function wallRows(fb: Framebuffer, camX: number, camY: number, floor: number, dark: number): void {
  const wall = getSprite('mall.wall');
  const y1 = floorY(floor);
  const y0 = y1 - (CEILING_GAP);
  fb.pushClip(0, sy(y0, camY), 256, CEILING_GAP);
  const first = Math.floor(camX / 16);
  const last = Math.floor((camX + 255) / 16);
  const rows = Math.ceil(CEILING_GAP / 16);
  for (let r = 0; r < rows; r++) {
    for (let c = first; c <= last; c++) {
      if (c < 0 || c * 16 >= LEVEL_W) continue;
      const variant = (c * 5 + floor * 3) % 7 === 0 ? 1 : 0;
      fb.sprite(wall, sx(c * 16, camX), sy(y1 - 16 * (r + 1) + (rows * 16 - CEILING_GAP) * 0, camY), { frame: variant });
    }
  }
  if (dark > 0) fb.darkenRect(0, sy(y0, camY), 256, CEILING_GAP, dark);
  fb.popClip();
}

/** The parking level: bare grey concrete with a pipe run, expansion joints and a hazard stripe. */
function parkingBackdrop(fb: Framebuffer, camX: number, camY: number, floor: number): void {
  const y1 = floorY(floor);
  const y0 = y1 - CEILING_GAP;
  const top = sy(y0, camY);
  fb.fillRect(0, top, 256, CEILING_GAP, C.GRAY);
  fb.fillRect(0, top, 256, 3, C.BLACK);
  fb.hLine(0, top + 3, 256, C.LTGRAY);
  // pipe run along the ceiling
  fb.hLine(0, top + 8, 256, C.LTGRAY);
  fb.hLine(0, top + 9, 256, C.MDGRAY);
  // expansion joints and a bay-number stripe
  for (let x = Math.floor(camX / 48) * 48; x < camX + 256 + 48; x += 48) {
    if (x < 0 || x >= LEVEL_W) continue;
    fb.vLine(sx(x, camX), top + 4, CEILING_GAP - 4, C.BLACK);
    fb.vLine(sx(x, camX) + 1, top + 4, CEILING_GAP - 4, C.MDGRAY);
    fb.vLine(sx(x + 8, camX), top + 8, 4, C.LTGRAY); // pipe bracket
    fb.setPixel(sx(x + 22, camX), top + 18, C.WHITE);
  }
  // hazard stripe at the foot of the wall
  for (let x = Math.floor(camX / 8) * 8; x < camX + 264; x += 8) {
    if (x < 0 || x >= LEVEL_W) continue;
    fb.fillRect(sx(x, camX), top + CEILING_GAP - 4, 4, 4, C.YELLOW);
    fb.fillRect(sx(x + 4, camX), top + CEILING_GAP - 4, 4, 4, C.BLACK);
  }
}

function parkingSlab(fb: Framebuffer, camX: number, camY: number, floor: number): void {
  const y = sy(floorY(floor), camY);
  fb.fillRect(0, y, 256, SLAB_H, C.MDGRAY);
  fb.hLine(0, y, 256, C.LTGRAY);
  fb.hLine(0, y + SLAB_H - 1, 256, C.BLACK);
  for (let x = Math.floor(camX / 24) * 24; x < camX + 256 + 24; x += 24) {
    if (x >= 0 && x < LEVEL_W) fb.fillRect(sx(x, camX), y + 3, 10, 1, C.WHITE);
  }
}

function slabRow(fb: Framebuffer, camX: number, camY: number, floor: number): void {
  const slab = getSprite('mall.slab');
  const y = sy(floorY(floor), camY);
  const first = Math.floor(camX / 16);
  const last = Math.floor((camX + 255) / 16);
  for (let c = first; c <= last; c++) if (c >= 0 && c * 16 < LEVEL_W) fb.sprite(slab, sx(c * 16, camX), y);
}

function drawStorefronts(fb: Framebuffer, level: Level, camX: number, camY: number, frame: number): void {
  for (let f = 1; f < NUM_FLOORS; f++) {
    if (f === NUM_FLOORS - 1) parkingBackdrop(fb, camX, camY, f);
    else wallRows(fb, camX, camY, f, 0);
  }
  for (let f = 0; f < NUM_FLOORS; f++) {
    if (f === NUM_FLOORS - 1) parkingSlab(fb, camX, camY, f);
    else slabRow(fb, camX, camY, f);
  }
  // ground under the parking level
  fb.fillRect(0, sy(floorY(NUM_FLOORS - 1) + SLAB_H, camY), 256, 80, C.BLACK);
  for (const st of STORES) {
    const x = sx(st.x, camX);
    if (x > 256 || x + 80 < 0) continue;
    const y = sy(floorY(st.floor) - 40, camY);
    drawStorefront(fb, x, y, st.id, {
      frame,
      cleared: storeStatus(level.run.level, st.id) === 'cleared',
      blackFriday: level.run.blackFriday,
    });
  }
}

/** Shaft columns (cut through the slabs), grates over openings with a car above, penthouses on the roof. */
function drawShafts(fb: Framebuffer, w: MallWorld, camX: number, camY: number): void {
  const wallTile = getSprite('shaft.wall');
  const grate = getSprite('grate');
  for (const s of SHAFTS) {
    const x = sx(s.x, camX);
    if (x > 256 || x + s.w < 0) continue;
    const y0 = floorY(s.top) - CEILING_GAP;
    const y1 = floorY(s.bottom);
    // roof penthouse housing around the top of the shaft
    if (s.top === 0) {
      fb.fillRect(x - 4, sy(y0 - 8, camY), s.w + 8, 10, C.MDGRAY);
      fb.hLine(x - 4, sy(y0 - 8, camY), s.w + 8, C.WHITE);
      fb.fillRect(x - 4, sy(y0 + 2, camY), 4, CEILING_GAP - 2, C.MDGRAY);
      fb.fillRect(x + s.w, sy(y0 + 2, camY), 4, CEILING_GAP - 2, C.MDGRAY);
    }
    fb.pushClip(x, sy(y0, camY), s.w, y1 - y0);
    for (let yy = y0; yy < y1; yy += 16) fb.sprite(wallTile, x, sy(yy, camY));
    fb.popClip();
    const car = w.car(s.id);
    for (let f = s.top; f <= s.bottom; f++) {
      if (openingState(car, f) === 'above') fb.sprite(grate, x, sy(floorY(f), camY));
    }
  }
}

function drawFeatures(fb: Framebuffer, camX: number, camY: number, frame: number): void {
  for (const f of FEATURES) {
    const x = sx(f.x, camX);
    if (x > 256 || x + f.w < 0) continue;
    const fy = floorY(f.floor);
    switch (f.kind) {
      case 'bench':
        fb.sprite(getSprite('bench'), x, sy(fy - 12, camY));
        break;
      case 'plant':
        fb.sprite(getSprite('plant'), x, sy(fy - 24, camY));
        break;
      case 'pillar':
        fb.sprite(getSprite('pillar'), x, sy(fy - 48, camY));
        break;
      case 'wagon':
        fb.sprite(getSprite('wagon'), x, sy(fy - 28, camY), { frame: 0 });
        break;
      case 'post':
        fb.sprite(getSprite('post'), x, sy(fy - 16, camY));
        break;
      case 'ac':
        fb.sprite(getSprite('ac'), x, sy(fy - 16, camY));
        break;
      case 'pigeon':
        fb.sprite(getSprite('pigeon'), x, sy(fy - 8, camY), { frame: (frame >> 5) & 1 });
        break;
      default:
        break; // kiosk / booth / fountain are state-dependent: drawn by the furniture hook
    }
  }
}

function drawEscalators(fb: Framebuffer, camX: number, camY: number, frame: number): void {
  const step = getSprite('esc.step');
  const rail = getSprite('esc.rail');
  for (const e of ESCALATORS) {
    const x0 = e.xLow;
    const y0 = floorY(e.lower);
    const x1 = e.xHigh;
    const y1 = floorY(e.upper);
    if (Math.max(x0, x1) - camX < -8 || Math.min(x0, x1) - camX > 264) continue;
    const n = 48;
    const phase = (frame >> 1) % 8;
    for (let i = -8; i <= n; i += 8) {
      const t = (i + phase) / n;
      if (t < 0 || t > 1) continue;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      fb.sprite(step, sx(x - 4, camX), sy(y - 4, camY), { frame: (frame >> 2) & 3 });
    }
    for (let i = 0; i <= n; i += 4) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      fb.sprite(rail, sx(x - 2, camX), sy(y - 22, camY));
    }
    // landing plates
    fb.hLine(sx(x0 - 8, camX), sy(y0, camY), 16, C.YELLOW);
    fb.hLine(sx(x1 - 8, camX), sy(y1, camY), 16, C.YELLOW);
  }
}

function drawCars(fb: Framebuffer, w: MallWorld, camX: number, camY: number): void {
  for (const car of w.cars) {
    const s = car.def;
    const x = sx(s.x, camX);
    if (x > 256 || x + s.w < 0) continue;
    const spr = getSprite(car.open ? 'car.open' : 'car.closed');
    fb.sprite(spr, x, sy(car.y - CAR_H, camY));
  }
}

function playerSprite(w: MallWorld, p: PlayerState, frame: number): { name: string; frame: number; flip: boolean; recolor?: Uint8Array } | null {
  const flip = p.face < 0;
  const intro = w.intro;
  if (intro) {
    switch (intro.phase) {
      case 'zip':
        return { name: 'agent.hang', frame: 0, flip: false };
      case 'drop':
        return { name: 'agent.jump', frame: 0, flip: false };
      case 'crouch':
        return { name: 'agent.crouch', frame: 0, flip: false };
      case 'selfie':
        return { name: 'agent.selfie', frame: intro.t < 12 ? 1 : 0, flip: false };
    }
  }
  if (p.mode === 'hidden') return null;
  if (p.mode === 'dying' || p.mode === 'dead') {
    const t = p.deathT;
    return { name: 'agent.die', frame: t < 12 ? 0 : t < 30 ? 1 : 2, flip };
  }
  if (p.mode === 'ride') return { name: 'agent.ride', frame: 0, flip: false };
  if (p.mode === 'air') return { name: p.kick ? 'agent.kick' : 'agent.jump', frame: 0, flip };
  if (p.mode === 'escalator') return { name: 'agent.stand', frame: 0, flip };
  if (p.ducking) return { name: p.shootPose > 0 ? 'agent.shootlow' : 'agent.duck', frame: 0, flip };
  if (p.shootPose > 0) return { name: 'agent.shoot', frame: 0, flip };
  if (p.kick && p.slide !== 0) return { name: 'agent.kick', frame: 0, flip };
  if (Math.abs(p.vx) > 0.01 || p.slide !== 0) return { name: 'agent.walk', frame: (p.anim >> 3) & 3, flip };
  void frame;
  return { name: 'agent.stand', frame: 0, flip };
}

function drawPlayer(fb: Framebuffer, w: MallWorld, camX: number, camY: number, frame: number): void {
  const p = w.player;
  const spec = playerSprite(w, p, frame);
  if (!spec) return;
  // blinking invulnerability
  if (p.invuln > 0 && p.mode !== 'dying' && (frame >> 2) & 1) return;
  const spr = getSprite(spec.name);
  let recolor: Uint8Array | undefined;
  if (w.run.invincible && (frame >> 1) & 1) recolor = FLASH;
  if (p.frozen > 0 && (frame >> 2) & 1) recolor = GHOST;
  const x = sx(p.x - 8, camX);
  const y = sy(p.y - 24, camY);
  fb.sprite(spr, x, y, { frame: spec.frame, flipX: spec.flip, recolor });
  // the agent holds his phone up during the selfie: nothing else to draw
}

function spySprite(s: Spy): { name: string; frame: number } {
  switch (s.mode) {
    case 'aim':
      return { name: s.aimHigh ? 'spy.aimhigh' : 'spy.aimlow', frame: 0 };
    case 'duck':
      return { name: 'spy.duck', frame: 0 };
    case 'dying':
      return { name: 'spy.die', frame: Math.min(2, Math.floor(s.deathT / 8)) };
    case 'emerge':
      return { name: 'spy.stand', frame: 0 };
    case 'wait':
      return { name: 'spy.stand', frame: 0 };
    default:
      return { name: 'spy.walk', frame: (s.anim >> 3) & 3 };
  }
}

function drawSpies(fb: Framebuffer, w: MallWorld, camX: number, camY: number, frame: number): void {
  for (const s of w.spies) {
    const spec = spySprite(s);
    const x = sx(s.x - 8, camX);
    const y = sy(s.y - 24, camY);
    if (x > 256 || x < -16) continue;
    if (s.mode === 'emerge') {
      // step out of the door: reveal from the door line, flickering in
      if (s.t < 8 && (frame & 1)) continue;
    }
    fb.sprite(getSprite(spec.name), x, y, { frame: spec.frame, flipX: s.face < 0 });
  }
}

function drawBullets(fb: Framebuffer, w: MallWorld, camX: number, camY: number): void {
  const pb = getSprite('bullet.player');
  const eb = getSprite('bullet.enemy');
  for (const b of w.bullets) {
    fb.sprite(b.owner === 'player' ? pb : eb, sx(b.x - 2, camX), sy(b.y - 1, camY), { flipX: b.vx < 0 });
  }
}

function drawPickups(fb: Framebuffer, w: MallWorld, camX: number, camY: number, frame: number): void {
  for (const k of w.pickups) {
    if (k.life < 90 && (frame >> 2) & 1) continue; // blink before disappearing
    if (k.kind === 'power' && k.power) {
      fb.sprite(getSprite(`item.${k.power}`), sx(k.x - 6, camX), sy(k.y - 12, camY));
    } else {
      fb.sprite(getSprite(k.kind === 'goldcoin' ? 'item.goldcoin' : 'item.coin'), sx(k.x - 4, camX), sy(k.y - 8, camY), { frame: (frame >> 3) & 3 });
    }
  }
}

function drawAlarm(fb: Framebuffer, frame: number): void {
  if ((frame >> 4) & 1) {
    fb.strokeRect(0, VIEW_TOP, 256, VIEW_H, C.RED);
    fb.strokeRect(1, VIEW_TOP + 1, 254, VIEW_H - 2, C.MAROON);
  }
}

/** Phone flash, then the SPYGRAM card, during the roof selfie. */
function drawSelfie(fb: Framebuffer, w: MallWorld, frame: number): void {
  const intro = w.intro;
  if (!intro || intro.phase !== 'selfie') return;
  const t = intro.t;
  if (t < 12) {
    const level = Math.max(0, 3 - Math.floor(t / 3));
    fb.fillRect(0, VIEW_TOP, 256, VIEW_H, C.WHITE);
    if (level < 3) fb.darkenRect(0, VIEW_TOP, 256, VIEW_H, 3 - level);
    return;
  }
  const cardT = t - 12;
  const x = Math.max(0, Math.floor((256 - 184) / 2));
  const slide = Math.min(1, cardT / 14);
  const y = Math.round(VIEW_TOP + 6 + (1 - slide) * 200);
  drawSpygram(fb, intro.post, spygramLikes(cardT, w.run.seed), frame, { x, y });
}

export { LEVEL_H };
export type { Car };
