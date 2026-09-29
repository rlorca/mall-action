import {
  ELEVATOR_H,
  ELEVATOR_W,
  FLOOR_1F,
  FLOOR_2F,
  FLOOR_P,
  FLOOR_R,
  FLOOR_SPACING,
  HUD_H,
  MALL_SPRITE_H,
  MALL_W,
  SCREEN_W,
  VIEW_H,
  floorY,
} from '../core/constants';
import {
  ESCALATORS,
  LAMPS,
  lampTopY,
  PROPS,
  SHAFTS,
  shaftLeft,
} from '../core/mallLayout';
import { POWERUPS } from '../core/powerups';
import { STORES, STOREFRONT_W, type StoreDef } from '../core/storeDefs';
import type { GameState, MallState } from '../core/types';
import { DISPLAY_H, DISPLAY_W, displayFrames } from './displays';
import { FONT, TINY, drawText, drawTextCentered, textWidth } from './font';
import { C } from './palette';
import type { Framebuffer } from './pixels';
import { POWERUP_ICONS, SPRITES, makeShutter } from './sprites';

/** Storefront metrics, shared by the drawing code below. */
const FRONT_H = 40;
const SIGN_H = 9;
const WIN_Y = 12; // from the top of the storefront
const DOOR_W = 22;

const shutterCache = new Map<number, ReturnType<typeof makeShutter>>();
function shutter(w: number, h: number) {
  const key = w * 1000 + h;
  let s = shutterCache.get(key);
  if (!s) {
    s = makeShutter(w, h);
    shutterCache.set(key, s);
  }
  return s;
}

export interface MallDrawCtx {
  camX: number;
  camY: number;
  /** Global animation clock, so idle animation runs even when paused. */
  clock: number;
}

export function drawMall(fb: Framebuffer, g: GameState, ctx: MallDrawCtx): void {
  const m = g.mall;
  fb.setClip(HUD_H, HUD_H + VIEW_H);

  drawBackground(fb, g, ctx);
  drawStorefronts(fb, g, ctx);
  drawShafts(fb, m, ctx);
  drawEscalators(fb, ctx);
  drawProps(fb, g, ctx);
  drawWetPatches(fb, m, ctx);
  drawLamps(fb, m, ctx);
  drawCars(fb, m, ctx);
  drawPickupsAndCoins(fb, m, ctx);
  drawNpcs(fb, m, ctx);
  drawSpies(fb, m, ctx);
  drawPlayer(fb, g, ctx);
  drawBullets(fb, m, ctx);
  drawDarkness(fb, m, ctx);

  fb.clearClip();
}

const sx = (x: number, ctx: MallDrawCtx): number => Math.round(x - ctx.camX);
const sy = (y: number, ctx: MallDrawCtx): number => Math.round(y - ctx.camY) + HUD_H;

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

function drawBackground(fb: Framebuffer, g: GameState, ctx: MallDrawCtx): void {
  fb.rect(0, HUD_H, SCREEN_W, VIEW_H, C.DARKBLUE);

  // --- the roof: night sky, a lit skyscraper, and the zip-line cable -----
  const roofTop = sy(floorY(FLOOR_R) - 80, ctx);
  const roofFloor = sy(floorY(FLOOR_R), ctx);
  if (roofFloor > HUD_H && roofTop < HUD_H + VIEW_H) {
    // Sky gradient in bands.
    const bands = [C.BLACK, C.NAVY, C.DARKBLUE, C.INDIGO];
    for (let i = 0; i < bands.length; i++) {
      fb.rect(0, roofTop + i * 20, SCREEN_W, 20, bands[i]);
    }
    // Stars.
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % MALL_W;
      const y = floorY(FLOOR_R) - 78 + ((i * 37) % 60);
      if (((i * 13 + Math.floor(ctx.clock / 30)) % 11) !== 0) fb.px(sx(x, ctx), sy(y, ctx), C.WHITE);
    }
    // The dark skyscraper at the left edge of the sky.
    const bx = sx(-60, ctx);
    fb.rect(bx, roofTop, 72, roofFloor - roofTop, C.BLACK);
    for (let wy = roofTop + 6; wy < roofFloor - 6; wy += 8) {
      for (let wx = bx + 6; wx < bx + 64; wx += 8) {
        const lit = ((wx + wy * 3) % 7) < 4;
        fb.rect(wx, wy, 4, 4, lit ? C.PALEYELLOW : C.DARKGREY);
      }
    }
    // The cable, from the skyscraper down to the anchor post.
    const x0 = sx(8, ctx);
    const y0 = sy(floorY(FLOOR_R) - 56, ctx);
    const x1 = sx(52, ctx);
    const y1 = sy(floorY(FLOOR_R) - 22, ctx);
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      fb.px(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), C.GREY);
    }
  }

  // --- the mall interior -------------------------------------------------
  for (let f = FLOOR_R; f <= FLOOR_P; f++) {
    const top = sy(floorY(f) - FLOOR_SPACING + 8, ctx);
    const h = FLOOR_SPACING;
    if (f !== FLOOR_R) {
      // Corridor wall.
      const wall = f === FLOOR_P ? C.BLACK : f === FLOOR_2F ? C.INDIGO : C.NAVY;
      fb.rect(0, top, SCREEN_W, h, wall);
      if (f !== FLOOR_P) {
        // A faint pattern so the corridors are not flat.
        for (let x = -(ctx.camX % 16); x < SCREEN_W; x += 16) {
          fb.vline(x, top, h, C.DARKBLUE);
        }
      }
    }
    // The floor slab.
    const slabY = sy(floorY(f), ctx);
    const slab = f === FLOOR_P ? C.DARKGREY : f === FLOOR_R ? C.GREY : C.LIGHTGREY;
    fb.rect(0, slabY, SCREEN_W, 8, slab);
    fb.hline(0, slabY, SCREEN_W, C.WHITE);
    fb.hline(0, slabY + 7, SCREEN_W, C.DARKGREY);
    if (f === FLOOR_P) {
      // Parking bay markings.
      for (let x = -(ctx.camX % 48); x < SCREEN_W; x += 48) {
        fb.rect(x, slabY - 10, 2, 10, C.GREY);
      }
    }
  }

  void g;
}

// ---------------------------------------------------------------------------
// Storefronts
// ---------------------------------------------------------------------------

function signColor(def: StoreDef): number {
  if (def.role === 'closed') return C.GREY;
  if (def.role === 'powerup') return C.LIGHTBLUE;
  return C.YELLOW;
}

function drawStorefronts(fb: Framebuffer, g: GameState, ctx: MallDrawCtx): void {
  for (const def of STORES) {
    const x = sx(def.x, ctx);
    if (x > SCREEN_W || x + STOREFRONT_W < 0) continue;
    const top = sy(floorY(def.floor) - FRONT_H, ctx);
    const cleared = def.role === 'target' && g.level.stores[def.id]?.cleared;
    const closed = def.role === 'closed';

    // Facade.
    fb.rect(x, top, STOREFRONT_W, FRONT_H, cleared ? C.DARKGREY : C.GREY);

    // --- sign --------------------------------------------------------------
    fb.rect(x, top, STOREFRONT_W, SIGN_H, closed ? C.DARKGREY : C.BLACK);
    const label = def.name;
    const col = cleared ? C.GREY : signColor(def);
    drawTextCentered(fb, TINY, label, x + STOREFRONT_W / 2, top + 2, col);

    if (closed) {
      // Rolled-down shutter across the whole front.
      fb.blit(shutter(STOREFRONT_W, FRONT_H - SIGN_H), x, top + SIGN_H);
      drawClosedExtras(fb, def, x, top);
      continue;
    }

    // --- windows -----------------------------------------------------------
    const winY = top + WIN_Y;
    const leftX = x + 3;
    const rightX = x + STOREFRONT_W - DISPLAY_W - 3;
    for (const [i, wx] of [leftX, rightX].entries()) {
      fb.rect(wx - 1, winY - 1, DISPLAY_W + 2, DISPLAY_H + 2, C.DARKGREY);
      fb.rect(wx, winY, DISPLAY_W, DISPLAY_H, cleared ? C.DARKGREY : C.BLACK);
      const frames = displayFrames(def.windows[i]);
      const f = frames[Math.floor(ctx.clock / 20) % frames.length];
      if (cleared) {
        // Windows dim once the package has been taken.
        fb.rect(wx, winY, DISPLAY_W, DISPLAY_H, C.BLACK);
        fb.darken(wx, winY, DISPLAY_W, DISPLAY_H, C.DARKGREY, 4);
      } else {
        fb.blit(f, wx, winY);
      }
    }

    // --- door --------------------------------------------------------------
    const doorX = x + Math.round((STOREFRONT_W - DOOR_W) / 2);
    const doorY = top + FRONT_H - 26;
    let doorCol: number = C.LIGHTBLUE;
    if (def.role === 'target') {
      if (cleared) doorCol = C.DARKGREY;
      // Target doors are RED and BLINK while the package is still inside.
      else doorCol = Math.floor(ctx.clock / 15) % 2 === 0 ? C.RED : C.MAROON;
    }
    fb.rect(doorX, doorY, DOOR_W, 26, doorCol);
    fb.frame(doorX, doorY, DOOR_W, 26, C.BLACK);
    fb.rect(doorX + 3, doorY + 3, DOOR_W - 6, 10, cleared ? C.BLACK : C.PALEBLUE);
    fb.px(doorX + DOOR_W - 5, doorY + 18, C.PALEYELLOW);

    // Black Friday: a "70% OFF" sign on every open storefront.
    if (g.blackFriday) {
      drawTextCentered(fb, TINY, '70% OFF', x + STOREFRONT_W / 2, top + SIGN_H + 1, C.PALEYELLOW);
    }
  }
}

function drawClosedExtras(fb: Framebuffer, def: StoreDef, x: number, top: number): void {
  const y = top + SIGN_H + 4;
  if (def.id === 'blockbluster') {
    fb.rect(x + 6, y, 26, 12, C.WHITE);
    drawText(fb, TINY, 'FOR', x + 9, y + 1, C.BLACK);
    drawText(fb, TINY, 'LEASE', x + 8, y + 7, C.BLACK);
    // The faded VHS poster.
    fb.rect(x + 44, y, 24, 20, C.OLIVE);
    fb.frame(x + 44, y, 24, 20, C.TAN);
    drawText(fb, TINY, 'VHS', x + 50, y + 7, C.TAN);
  } else if (def.id === 'borderlinebooks') {
    fb.rect(x + 8, y + 4, 64, 11, C.YELLOW);
    drawTextCentered(fb, TINY, 'CLOSING SALE', x + STOREFRONT_W / 2, y + 7, C.RED);
  } else if (def.id === 'circuitpity') {
    // The shutter is only half down; dead TVs behind it.
    fb.rect(x, top + SIGN_H + 16, STOREFRONT_W, 15, C.BLACK);
    const frames = displayFrames('deadTvs');
    fb.blit(frames[0], x + 8, top + SIGN_H + 14);
    fb.blit(frames[0], x + 46, top + SIGN_H + 14);
  }
}

// ---------------------------------------------------------------------------
// Shafts, escalators, props
// ---------------------------------------------------------------------------

function drawShafts(fb: Framebuffer, m: MallState, ctx: MallDrawCtx): void {
  for (const shaft of SHAFTS) {
    const x = sx(shaftLeft(shaft), ctx);
    if (x > SCREEN_W || x + ELEVATOR_W < 0) continue;
    const car = m.cars.find((c) => c.shaft === shaft.id)!;
    const topF = Math.min(...shaft.floors);
    const botF = Math.max(...shaft.floors);

    // The shaft column behind everything.
    const y0 = sy(floorY(topF) - ELEVATOR_H, ctx);
    const y1 = sy(floorY(botF), ctx);
    fb.rect(x - 2, y0, ELEVATOR_W + 4, y1 - y0 + 8, C.BLACK);
    fb.vline(x - 2, y0, y1 - y0 + 8, C.DARKGREY);
    fb.vline(x + ELEVATOR_W + 1, y0, y1 - y0 + 8, C.DARKGREY);

    // The opening on each served floor, drawn from the car's position.
    for (const f of shaft.floors) {
      const fy = sy(floorY(f), ctx);
      if (car.atFloor === f) continue; // the car itself covers it
      if (car.y > floorY(f) + 1) {
        // Car below: an open pit.
        fb.blit(SPRITES.pit, x, fy);
      } else {
        // Car above: a grate you can stand on.
        fb.blit(SPRITES.grate, x, fy);
      }
    }

    // Shaft label, so the route is readable.
    drawText(fb, TINY, shaft.id, x + ELEVATOR_W / 2 - 1, sy(floorY(topF) - ELEVATOR_H - 8, ctx), C.PALEYELLOW);
  }
}

function drawCars(fb: Framebuffer, m: MallState, ctx: MallDrawCtx): void {
  for (const car of m.cars) {
    const shaft = SHAFTS.find((s) => s.id === car.shaft)!;
    const x = sx(shaft.x - ELEVATOR_W / 2, ctx);
    if (x > SCREEN_W || x + ELEVATOR_W < 0) continue;
    fb.blit(car.doorsOpen ? SPRITES.carOpen : SPRITES.carClosed, x, sy(car.y - ELEVATOR_H, ctx));
  }
}

function drawEscalators(fb: Framebuffer, ctx: MallDrawCtx): void {
  for (const e of ESCALATORS) {
    const x0 = sx(e.bottomX, ctx);
    const y0 = sy(floorY(e.bottomFloor), ctx);
    const x1 = sx(e.topX, ctx);
    const y1 = sy(floorY(e.topFloor), ctx);
    if (Math.max(x0, x1) < -20 || Math.min(x0, x1) > SCREEN_W + 20) continue;
    // The ramp.
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + (x1 - x0) * t);
      const py = Math.round(y0 + (y1 - y0) * t);
      fb.rect(px - 8, py, 16, 4, C.GREY);
      fb.hline(px - 8, py, 16, C.LIGHTGREY);
      // Moving tread marks.
      if ((i + Math.floor(ctx.clock / 6)) % 3 === 0) fb.hline(px - 6, py + 2, 12, C.DARKGREY);
    }
    // Handrails.
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + (x1 - x0) * t);
      const py = Math.round(y0 + (y1 - y0) * t) - 14;
      fb.px(px - 8, py, C.DARKGREY);
      fb.px(px + 7, py, C.DARKGREY);
    }
  }
}

function drawProps(fb: Framebuffer, g: GameState, ctx: MallDrawCtx): void {
  const m = g.mall;
  for (const p of PROPS) {
    const gy = floorY(p.floor);
    const x = sx(p.x, ctx);
    if (x < -60 || x > SCREEN_W + 60) continue;
    switch (p.kind) {
      case 'kiosk':
        fb.blit(SPRITES.kiosk, x - 10, sy(gy - 28, ctx));
        break;
      case 'booth':
        fb.blit(SPRITES.photoBooth, x - 12, sy(gy - 36, ctx));
        break;
      case 'fountain':
        fb.blit(SPRITES.fountain, x - 14, sy(gy - 24, ctx));
        break;
      case 'bench':
        fb.blit(SPRITES.bench, x - 14, sy(gy - 14, ctx));
        break;
      case 'plant':
        fb.blit(SPRITES.plant, x - 10, sy(gy - 24, ctx));
        break;
      case 'pillar':
        fb.blit(SPRITES.pillar, x - 10, sy(gy - 48, ctx));
        break;
      case 'car':
        fb.blit(SPRITES.stationWagon, x - 24, sy(gy - 24, ctx));
        if (g.level.packages >= 6 && Math.floor(ctx.clock / 20) % 2 === 0) {
          drawTextCentered(fb, TINY, 'PRESS UP', x, sy(gy - 34, ctx), C.PALEYELLOW);
        }
        break;
      case 'anchor':
        fb.blit(SPRITES.anchorPost, x - 6, sy(gy - 28, ctx));
        break;
    }
  }
  void m;
}

function drawWetPatches(fb: Framebuffer, m: MallState, ctx: MallDrawCtx): void {
  for (const w of m.wetPatches) {
    const y = sy(floorY(w.floor), ctx);
    const x = sx(w.x, ctx);
    fb.rect(x, y, w.w, 3, C.PALECYAN);
    for (let i = 0; i < w.w; i += 4) {
      fb.px(x + i + (Math.floor(ctx.clock / 8) % 2), y + 1, C.WHITE);
    }
    fb.blit(SPRITES.wetSign, x + w.w / 2 - 6, y - 16);
  }
}

function drawLamps(fb: Framebuffer, m: MallState, ctx: MallDrawCtx): void {
  for (let i = 0; i < m.lamps.length; i++) {
    const st = m.lamps[i];
    const def = LAMPS[i];
    const x = sx(def.x - 7, ctx);
    if (x < -20 || x > SCREEN_W + 20) continue;
    const s = def.disco ? SPRITES.discoBall : SPRITES.lamp;
    if (st.broken) {
      const bx = st.rolling !== 0 ? st.rollX : def.x;
      fb.blit(SPRITES.brokenLamp, sx(bx - 8, ctx), sy(floorY(def.floor) - 6, ctx));
    } else if (st.fallen) {
      if (st.rolling !== 0) {
        fb.blit(s, sx(st.rollX - 7, ctx), sy(floorY(def.floor) - 18, ctx));
      } else {
        fb.blit(s, x, sy(st.fallY - 18, ctx));
      }
    } else {
      fb.blit(s, x, sy(lampTopY(def.floor), ctx));
      // A pool of light under a working lamp.
      if (!def.disco) {
        const ly = sy(floorY(def.floor) - 2, ctx);
        fb.darken(sx(def.x - 10, ctx), ly, 20, 2, C.PALEYELLOW, 2);
      }
    }
  }
}

/** Sections darkened by a shattered lamp. */
function drawDarkness(fb: Framebuffer, m: MallState, ctx: MallDrawCtx): void {
  for (let i = 0; i < m.lamps.length; i++) {
    const st = m.lamps[i];
    if (st.darkFrames <= 0) continue;
    const def = LAMPS[i];
    const x = sx(def.x - 48, ctx);
    const y = sy(floorY(def.floor) - FLOOR_SPACING + 8, ctx);
    fb.darken(x, y, 96, FLOOR_SPACING, C.BLACK, 2);
  }
}

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

function drawNpcs(fb: Framebuffer, m: MallState, ctx: MallDrawCtx): void {
  const j = m.janitor;
  fb.blit(SPRITES.janitor, sx(j.x - 8, ctx), sy(floorY(j.floor) - MALL_SPRITE_H, ctx), j.dir < 0);
  if (j.mopping > 0) {
    fb.blit(SPRITES.mop, sx(j.x + (j.dir > 0 ? 8 : -14), ctx), sy(floorY(j.floor) - 12, ctx));
  }

  for (const w of m.walkers) {
    fb.blit(SPRITES.walker, sx(w.x - 8, ctx), sy(floorY(w.floor) - MALL_SPRITE_H, ctx), w.dir < 0);
  }

  const cop = m.cop;
  fb.blit(SPRITES.copSegway, sx(cop.x - 8, ctx), sy(floorY(cop.floor) - MALL_SPRITE_H, ctx), cop.dir < 0);
}

function drawSpies(fb: Framebuffer, m: MallState, ctx: MallDrawCtx): void {
  for (const s of m.spies) {
    const x = sx(s.x - 8, ctx);
    if (x < -20 || x > SCREEN_W + 20) continue;
    const y = sy(s.y - MALL_SPRITE_H, ctx);
    let spr = SPRITES.spyIdle;
    if (s.state === 'dead') spr = SPRITES.spyDead;
    else if (s.ducking) spr = SPRITES.spyDuck;
    else if (s.state === 'aim') spr = s.aimHigh ? SPRITES.spyAim : SPRITES.spyAimLow;
    else if (s.state === 'walk') spr = Math.floor(ctx.clock / 8) % 2 === 0 ? SPRITES.spyWalk : SPRITES.spyIdle;
    fb.blit(spr, x, y, s.facing < 0);

    // The telegraph is deliberately loud: a flashing marker over an aiming spy.
    if (s.state === 'aim' && Math.floor(ctx.clock / 4) % 2 === 0) {
      drawText(fb, TINY, '!', x + 6, y - 7, C.RED);
    }
  }
}

function drawPlayer(fb: Framebuffer, g: GameState, ctx: MallDrawCtx): void {
  const m = g.mall;
  const p = m.player;
  if (p.mode === 'hidden') return;

  // Blinking invulnerability.
  if (p.invulnFrames > 0 && Math.floor(ctx.clock / 3) % 2 === 0) return;

  let spr = SPRITES.agentIdle;
  switch (p.mode) {
    case 'zip':
      spr = SPRITES.agentZip;
      break;
    case 'land':
      spr = SPRITES.agentLand;
      break;
    case 'selfie':
      spr = SPRITES.agentSelfie;
      break;
    case 'dead':
      spr = SPRITES.agentDead;
      break;
    default: {
      const shooting = p.shootCooldown > 8;
      if (p.ducking) spr = shooting ? SPRITES.agentShootDuck : SPRITES.agentDuck;
      else if (!p.onGround) spr = SPRITES.agentJump;
      else if (shooting) spr = SPRITES.agentShoot;
      else if (p.escalator) spr = SPRITES.agentIdle;
      else {
        const moving = p.slideDir !== 0 || (p.anim % 1 === 0 && p.stillFrames === 0);
        spr = moving ? (Math.floor(ctx.clock / 7) % 2 === 0 ? SPRITES.agentWalk1 : SPRITES.agentWalk2) : SPRITES.agentIdle;
      }
      break;
    }
  }
  if (p.stillFrames > 2 && p.onGround && p.mode === 'play' && !p.ducking) spr = SPRITES.agentIdle;

  const x = sx(p.x - 8, ctx);
  const y = sy(p.y - MALL_SPRITE_H, ctx);

  if (g.powerups.invulnFrames > 0) {
    // Cinnabomb: invincible and flashing.
    const flash: [number, number, number] =
      Math.floor(ctx.clock / 3) % 2 === 0 ? [C.WHITE, C.PALEYELLOW, C.WHITE] : [C.BLACK, C.RED, C.TAN];
    fb.blitTinted(spr, x, y, flash, p.facing < 0);
  } else {
    fb.blit(spr, x, y, p.facing < 0);
  }

  // Jump-kick sparkle, so the player can see it is active.
  if (p.jumpKick && !p.onGround && Math.floor(ctx.clock / 3) % 2 === 0) {
    fb.px(x + (p.facing > 0 ? 13 : 2), y + 20, C.PALEYELLOW);
    fb.px(x + (p.facing > 0 ? 14 : 1), y + 21, C.YELLOW);
  }

  // The SPYGRAM phone flash on arrival.
  if (p.mode === 'selfie' && p.modeFrames < 8) {
    fb.blit(SPRITES.flash, x + 4, y - 6);
  }
}

function drawBullets(fb: Framebuffer, m: MallState, ctx: MallDrawCtx): void {
  for (const b of m.bullets) {
    fb.blit(b.fromPlayer ? SPRITES.bullet : SPRITES.enemyBullet, sx(b.x - 2, ctx), sy(b.y - 1, ctx), b.vx < 0);
  }
}

function drawPickupsAndCoins(fb: Framebuffer, m: MallState, ctx: MallDrawCtx): void {
  for (const pu of m.pickups) {
    const bob = Math.round(Math.sin(ctx.clock / 10) * 2);
    const icon = POWERUP_ICONS[pu.id] ?? SPRITES.puRapid;
    fb.blit(icon, sx(pu.x - 6, ctx), sy(pu.y - 16 + bob, ctx));
    // Blink out as it expires.
    if (pu.frames < 120 && Math.floor(ctx.clock / 4) % 2 === 0) {
      fb.rect(sx(pu.x - 6, ctx), sy(pu.y - 16 + bob, ctx), 12, 12, C.BLACK);
    }
    void POWERUPS;
  }
  for (const c of m.coins) {
    fb.blit(c.gold ? SPRITES.goldCoin : SPRITES.coin, sx(c.x - 4, ctx), sy(c.y - 8, ctx));
  }
}

// ---------------------------------------------------------------------------
// Ephemera drawn above everything
// ---------------------------------------------------------------------------

export function drawMallEphemera(fb: Framebuffer, g: GameState, ctx: MallDrawCtx): void {
  const m = g.mall;
  fb.setClip(HUD_H, HUD_H + VIEW_H);
  for (const p of m.popups) {
    drawTextCentered(fb, TINY, p.text, sx(p.x, ctx), sy(p.y, ctx), p.text.startsWith('-') ? C.RED : C.PALEYELLOW);
  }
  for (const b of m.bubbles) {
    drawBubble(fb, b.text, sx(b.x, ctx), sy(b.y, ctx));
  }
  fb.clearClip();
}

/** A speech bubble, always kept fully on screen. */
export function drawBubble(fb: Framebuffer, text: string, cx: number, y: number): void {
  const w = textWidth(TINY, text) + 8;
  const h = 11;
  let x = Math.round(cx - w / 2);
  x = Math.max(2, Math.min(SCREEN_W - w - 2, x));
  const by = Math.max(HUD_H + 2, y - h - 4);
  fb.rect(x, by, w, h, C.WHITE);
  fb.frame(x, by, w, h, C.BLACK);
  // Tail.
  const tx = Math.max(x + 3, Math.min(x + w - 5, Math.round(cx) - 1));
  fb.rect(tx, by + h, 3, 2, C.WHITE);
  fb.px(tx + 1, by + h + 2, C.BLACK);
  drawText(fb, TINY, text, x + 4, by + 3, C.BLACK);
}

/** The centred banner used for announcements. */
export function drawBanner(fb: Framebuffer, lines: string[], kind: string): void {
  const h = lines.length * 8 + 6;
  const w = Math.max(...lines.map((l) => textWidth(FONT, l))) + 10;
  const x = Math.round((SCREEN_W - w) / 2);
  const y = HUD_H + 18;
  fb.rect(x, y, w, h, kind === 'alarm' ? C.MAROON : C.BLACK);
  fb.frame(x, y, w, h, kind === 'alarm' ? C.RED : C.WHITE);
  lines.forEach((l, i) => {
    drawTextCentered(fb, FONT, l, SCREEN_W / 2, y + 4 + i * 8, kind === 'alarm' ? C.PALEYELLOW : C.WHITE);
  });
}

export { FLOOR_1F, FLOOR_2F };
