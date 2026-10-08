import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, FONT_TINY } from '../engine/font';
import { makeRecolor } from '../engine/sprite';
import { FEATURES, FLOOR_NAMES, LEVEL_W, NUM_FLOORS, SHAFTS, floorY } from '../content/layout';
import { STORES, STORE_W } from '../content/stores';
import { packagesLeft, UI } from '../content/copy';
import { storeStatus, type StoreStatus } from '../game/levelstate';
import type { MallWorld } from '../game/mall/world';
import { DARK_HALF_W } from '../game/mall/modules/lamps';
import { JANITOR_FLOOR, PATCH_W } from '../game/mall/modules/janitor';
import { STRIP_CELLS } from '../game/mall/modules/booth';
import { SPRAY_FRAMES } from '../game/mall/modules/fountains';
import type { Fx } from '../game/mall/modules/fx';
import { blinkOn, drawSpriteByName, hash01 } from './screenFx';

/**
 * Mall furniture and NPCs: everything the mall "extras" modules (src/game/mall/modules) put in the world.
 * Reads `world.extras`; never mutates the rules.
 *
 *   drawMallFurniture  state-dependent STATIC things that sit behind the characters: kiosks (screen on while used),
 *                      the photo booth (curtain), fountains, hanging lamps / disco balls on their cords (and the
 *                      remains of broken ones), the wet patch with its sign.
 *   drawMallActors     janitor, walkers, cop, falling lamps and rolling disco balls, glass and sparks, then the
 *                      DARKNESS of shattered lamps, then the kiosk map panel and the photo strip popup.
 *
 * Call order for the integrator: backdrop -> furniture -> cars/spies/agent -> actors -> bubbles/popups/banner -> HUD.
 * (The darkness darkens whatever is already in the framebuffer, so it must come after the characters but before the
 * HUD; it is clipped to the play view anyway so it can never touch the HUD strip.)
 *
 * World coordinates in, screen coordinates out: screenX = x - camX, screenY = y - camY + 16 (the HUD strip).
 */
const HUD_H = 16;
const VIEW_W = 256;
const VIEW_H = 224;

const sx = (x: number, camX: number): number => Math.round(x - camX);
const sy = (y: number, camY: number): number => Math.round(y - camY) + HUD_H;
const offscreen = (x: number, w: number): boolean => x + w < 0 || x > VIEW_W;

const CEILING = 40;
/** The second walker's tracksuit is recoloured so the pair can be told apart. */
const WALKER_ALT = makeRecolor({ [C.TEAL]: C.PINKRED });
const WALKER_RECOLOR = [undefined, WALKER_ALT] as const;

// =============================================================== furniture

export function drawMallFurniture(fb: Framebuffer, w: MallWorld, camX: number, camY: number, frame: number): void {
  const ex = w.extras;
  if (!ex) return;
  fb.pushClip(0, HUD_H, VIEW_W, VIEW_H);

  // kiosks: the screen is on while somebody is looking at the directory
  ex.kiosks.kiosks.forEach((k, i) => {
    const x = sx(k.x, camX);
    if (offscreen(x, 24)) return;
    drawSpriteByName(fb, 'kiosk', x, sy(floorY(k.floor), camY) - 32, { frame: ex.kiosks.screenOn(i) ? 1 : 0 }, { w: 24, h: 32 });
  });

  // photo booth: curtain closed (feet visible) while the agent is inside
  {
    const x = sx(ex.booth.x, camX);
    if (!offscreen(x, 24)) {
      drawSpriteByName(fb, 'booth', x, sy(floorY(ex.booth.floor), camY) - 32, { frame: ex.booth.occupied ? 1 : 0 }, { w: 24, h: 32 });
    }
  }

  // fountains: lively water when ready, still while cooling down; a jet of droplets after a spray
  for (const f of ex.fountains.fountains) {
    const x = sx(f.x, camX);
    if (offscreen(x, f.w)) continue;
    const y = sy(floorY(f.floor), camY);
    const f0 = f.cool > 0 && f.spray === 0 ? 0 : (frame >> (f.spray > 0 ? 2 : 3)) & 3;
    drawSpriteByName(fb, 'fountain', x, y - 24, { frame: f0 }, { w: f.w, h: 24 });
    if (f.spray > 0) drawJets(fb, x + f.w / 2, y - 24, SPRAY_FRAMES - f.spray);
  }

  // the wet patch and its sign
  const patch = ex.janitor.patch;
  if (patch) {
    const x0 = sx(patch.x - PATCH_W / 2, camX);
    if (!offscreen(x0, PATCH_W)) drawWetPatch(fb, x0, sy(floorY(JANITOR_FLOOR), camY), frame, patch.t);
  }

  // hanging lamps and disco balls (falling / rolling ones are drawn with the actors)
  for (const l of ex.lamps.lamps) {
    const x = sx(l.x, camX);
    if (offscreen(x, 16) && offscreen(sx(l.homeX, camX), 16)) continue;
    const fy = floorY(l.floor);
    const ceil = sy(fy - CEILING, camY);
    const hx = sx(l.homeX, camX);
    if (l.mode === 'hung') {
      const bottom = sy(l.y, camY);
      if (l.kind === 'lamp') {
        fb.vLine(hx, ceil, bottom - 10 - ceil, C.BLACK);
        drawSpriteByName(fb, 'lamp.shade', hx - 6, bottom - 10, { frame: 0 }, { w: 12, h: 10 });
      } else {
        fb.vLine(hx, ceil, bottom - 12 - ceil, C.LTGRAY);
        drawSpriteByName(fb, 'disco.ball', hx - 6, bottom - 12, { frame: (frame >> 3) & 3 }, { w: 12, h: 12 });
      }
    } else {
      // the cord stub left hanging at the ceiling, and the wreck on the floor
      fb.vLine(hx, ceil, 3, l.kind === 'lamp' ? C.BLACK : C.LTGRAY);
      if (l.mode === 'broken') drawSpriteByName(fb, 'lamp.broken', sx(l.x, camX) - 6, sy(fy, camY) - 10, {}, { w: 12, h: 10 });
    }
  }

  fb.popClip();
}

/** Droplets of a fountain spray: a few arcs rising from the basin and falling back. */
function drawJets(fb: Framebuffer, cx: number, top: number, t: number): void {
  for (let i = 0; i < 5; i++) {
    const tt = t - i * 2;
    if (tt < 0 || tt > SPRAY_FRAMES - 4) continue;
    const u = tt / (SPRAY_FRAMES - 4); // 0..1
    const lift = Math.round(4 * u * (1 - u) * (10 + (i % 3) * 3));
    const dx = (i - 2) * 4 + Math.round((u - 0.5) * (i - 2) * 4);
    fb.fillRect(Math.round(cx + dx), top - 1 - lift, 2, 2, i % 2 ? C.WHITE : C.CYAN);
  }
}

/** A shiny puddle on the floor: a domed highlight over pale-blue slab rows, with glints that come and go. */
function drawWetPatch(fb: Framebuffer, x0: number, y: number, frame: number, left: number): void {
  const w = PATCH_W;
  const drying = left < 90 && (frame >> 2) % 2 === 0; // it flickers for the last 1.5 s
  const body = drying ? C.SKY : C.PALEBLUE;
  // the dome (what stands on the floor), then the two rows of the slab surface
  fb.fillRect(x0 + 14, y - 3, w - 28, 1, C.SKY);
  fb.fillRect(x0 + 7, y - 2, w - 14, 1, body);
  fb.fillRect(x0 + 2, y - 1, w - 4, 1, C.SKY);
  fb.fillRect(x0, y, w, 1, body);
  fb.fillRect(x0, y + 1, w, 1, C.SKY);
  // glints
  const step = frame >> 3;
  for (let i = 0; i < 5; i++) {
    const px = x0 + 3 + Math.floor(hash01(step, i) * (w - 6));
    fb.setPixel(px, i % 2 ? y : y - 1, C.WHITE);
  }
  // the yellow wet-floor sign stands at the patch's left end
  drawSpriteByName(fb, 'sign.wet', x0 + 4, y - 12, {}, { w: 8, h: 12 });
}

// =============================================================== actors

export function drawMallActors(fb: Framebuffer, w: MallWorld, camX: number, camY: number, frame: number): void {
  const ex = w.extras;
  if (!ex) return;
  fb.pushClip(0, HUD_H, VIEW_W, VIEW_H);

  // ---- janitor
  {
    const j = ex.janitor.janitor;
    const x = sx(j.x, camX);
    if (!offscreen(x, 16)) {
      const name = j.mode === 'mop' ? 'janitor.mop' : 'janitor.walk';
      const f = j.mode === 'mop' ? (j.t >> 3) & 1 : (j.anim >> 4) & 1;
      drawSpriteByName(fb, name, x - 8, sy(floorY(j.floor), camY) - 24, { frame: f, flipX: j.face < 0 }, { w: 16, h: 24 });
    }
  }

  // ---- mall walkers
  ex.walkers.walkers.forEach((k, i) => {
    const x = sx(k.x, camX);
    if (offscreen(x, 16)) return;
    const f = k.angryT > 0 ? 0 : Math.floor(k.anim / (k.speed < 0.7 ? 9 : 6)) & 3;
    drawSpriteByName(fb, 'walker.walk', x - 8, sy(k.y, camY) - 24, { frame: f, flipX: k.face < 0, recolor: WALKER_RECOLOR[i % 2] }, { w: 16, h: 24 });
    if (k.angryT > 0 && (frame >> 2) % 2 === 0) fb.fillRect(x - 1 + k.face * 9, sy(k.y, camY) - 30, 2, 5, C.RED); // "!" over his head
  });

  // ---- mall cop
  {
    const c = ex.cop.cop;
    const x = sx(c.x, camX);
    if (!offscreen(x, 24)) {
      const y = sy(ex.cop.y, camY);
      const moving = c.mode === 'patrol' ? c.pauseT <= 0 : c.mode === 'chase' ? c.whistleT <= 0 : true;
      const whistling = c.whistleT > 0;
      const name = whistling ? 'cop.whistle' : 'cop.segway';
      drawSpriteByName(fb, name, x - 12, y - 24, { frame: whistling ? 0 : moving ? (c.anim >> 3) & 1 : 0, flipX: c.face < 0 }, { w: 24, h: 24 });
      if (c.mode === 'chase') {
        // flashing red / blue light on the helmet
        const on = (frame >> 2) & 1;
        fb.fillRect(x - c.face * 3 - 1, y - 27, 3, 2, on ? C.RED : C.BLUE);
      }
    }
  }

  // ---- falling lamps and rolling / falling disco balls
  for (const l of ex.lamps.lamps) {
    if (l.mode !== 'falling' && l.mode !== 'rolling' && l.mode !== 'fell') continue;
    const x = sx(l.x, camX);
    if (offscreen(x, 16)) continue;
    const bottom = sy(l.y, camY);
    if (l.kind === 'lamp') {
      drawSpriteByName(fb, 'lamp.shade', x - 6, bottom - 10, { frame: 1 }, { w: 12, h: 10 });
      fb.vLine(x, bottom - 13, 3, C.BLACK); // the snapped cord trailing behind
    } else {
      const spin = l.mode === 'falling' ? frame >> 2 : Math.floor(Math.abs(l.x) / 3) * (l.dir >= 0 ? 1 : -1);
      drawSpriteByName(fb, 'disco.ball', x - 6, bottom - 12, { frame: ((spin % 4) + 4) % 4 }, { w: 12, h: 12 });
    }
  }

  // ---- bullet sparks and glass
  for (const f of ex.fx.items) drawFx(fb, f, camX, camY);

  // ---- darkness of shattered lamps (over everything above, under the panels)
  for (const z of ex.lamps.dark) {
    const y0 = sy(floorY(z.floor) - CEILING, camY);
    const h = CEILING + 8;
    const age = z.total - z.t;
    // quick fade-in and a slow fade-out: every step lowers each band one rung on the style ladder
    const fade = Math.max(z.t < 30 ? Math.ceil((30 - z.t) / 10) : 0, age < 4 ? 2 : age < 8 ? 1 : 0);
    const x = sx(z.x, camX);
    const cx = Math.round(camX);
    const cy = Math.round(camY);
    const band = (from: number, to: number, rung: number): void => dimRect(fb, x + from, y0, to - from, h, rung - fade, cx, cy);
    band(-DARK_HALF_W + 8, DARK_HALF_W - 8, 3);
    band(-DARK_HALF_W, -DARK_HALF_W + 8, 2);
    band(DARK_HALF_W - 8, DARK_HALF_W, 2);
    band(-DARK_HALF_W - 5, -DARK_HALF_W, 1);
    band(DARK_HALF_W, DARK_HALF_W + 5, 1);
  }

  fb.popClip();

  // ---- overlays that must stay readable: kiosk map panel and the photo strip
  fb.pushClip(0, HUD_H, VIEW_W, VIEW_H);
  const panel = ex.kiosks.panel;
  if (panel) {
    const k = ex.kiosks.kiosks[panel.kiosk]!;
    drawKioskPanel(fb, w, k.floor, k.x + 12, panel.target, panel.total - panel.t, panel.t, frame);
  }
  const strip = ex.booth.strip;
  if (strip) drawPhotoStrip(fb, sx(strip.x, camX), sy(strip.y, camY), strip.t, strip.total);
  fb.popClip();
}

/**
 * The ladder of "how dark": rung 0 = untouched, 1 = a light screen-door (one pixel in four black, rest a notch
 * darker), 2 = half the pixels black, 3 = very dark (the rest sinks to each hue's darkest row, half black).
 * The grid is fixed to the WORLD, so it does not shimmer when the camera scrolls. (Darkening pastel walls by two
 * NES rows lands on garish saturated colours, hence this ladder instead of a plain darkenRect.)
 */
function dimRect(fb: Framebuffer, x: number, y: number, w: number, h: number, rung: number, camX: number, camY: number): void {
  if (rung <= 0) return;
  const r = Math.min(3, rung);
  const x0 = Math.max(x, 0);
  const x1 = Math.min(x + w, VIEW_W);
  const y0 = Math.max(y, HUD_H);
  const y1 = Math.min(y + h, HUD_H + VIEW_H);
  if (x1 <= x0 || y1 <= y0) return;
  fb.darkenRect(x0, y0, x1 - x0, y1 - y0, r === 3 ? 3 : 1);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const wx = xx + camX;
      const wy = yy + camY;
      const black = r === 1 ? (wx & 1) === 0 && (wy & 1) === 0 : ((wx + wy) & 1) === 0;
      if (black) fb.setPixel(xx, yy, C.BLACK);
    }
  }
}

function drawFx(fb: Framebuffer, f: Fx, camX: number, camY: number): void {
  const x = sx(f.x, camX);
  if (offscreen(x, 24)) return;
  const y = sy(f.y, camY);
  const p = 1 - f.t / f.total; // 0..1
  const frameIdx = Math.min(2, Math.floor(p * 3));
  if (f.kind === 'spark') {
    drawSpriteByName(fb, 'fx.spark', x - 4, y - 4, { frame: frameIdx }, { w: 8, h: 8 });
    return;
  }
  // a burst of glass: three sprites flying apart
  const spread = 2 + p * 9;
  const rise = Math.round(Math.sin(Math.min(1, p * 1.4) * Math.PI) * 6);
  drawSpriteByName(fb, 'fx.glass', Math.round(x - 4 - spread), y - 4 - rise, { frame: frameIdx }, { w: 8, h: 8 });
  drawSpriteByName(fb, 'fx.glass', x - 4, y - 8 - rise - Math.round(p * 3), { frame: (frameIdx + 1) % 3 }, { w: 8, h: 8 });
  drawSpriteByName(fb, 'fx.glass', Math.round(x - 4 + spread), y - 4 - rise, { frame: (frameIdx + 2) % 3 }, { w: 8, h: 8 });
}

// =============================================================== kiosk map panel

const PANEL_W = 128;
const PANEL_H = 80;
const ROW_H = 8;
const MAP_SCALE = 8; // mall px per panel px: 768 -> 96

const STATUS_FILL: Record<StoreStatus, number | null> = {
  package: C.RED,
  cleared: C.GRAY,
  powerup: C.BLUE,
  closed: null,
};

/**
 * "MALL DIRECTORY": a little schematic of the six floors with every store, the shafts, a blinking marker for where
 * the kiosk is and the nearest store that still holds a package flashing in yellow. Screen-space panel at the top.
 */
function drawKioskPanel(
  fb: Framebuffer,
  w: MallWorld,
  kioskFloor: number,
  kioskX: number,
  target: string | null,
  age: number,
  left: number,
  frame: number,
): void {
  const x = Math.floor((VIEW_W - PANEL_W) / 2);
  const y = HUD_H + 4;
  // slide open / closed like a shutter
  const vis = Math.max(2, Math.round(PANEL_H * Math.min(1, age / 8, left / 8)));
  fb.pushClip(x, y, PANEL_W, vis);
  fb.fillRect(x, y, PANEL_W, PANEL_H, C.BLACK);
  fb.strokeRect(x, y, PANEL_W, PANEL_H, C.WHITE);
  fb.fillRect(x + 1, y + 1, PANEL_W - 2, 11, C.DKBLUE);
  fb.hLine(x + 1, y + 12, PANEL_W - 2, C.SKY);
  drawText(fb, UI.directory, x + PANEL_W / 2, y + 3, C.WHITE, { align: 'center', shadow: C.BLACK });

  const x0 = x + 16;
  const top = y + 15;
  // floors
  for (let f = 0; f < NUM_FLOORS; f++) {
    const ry = top + f * ROW_H;
    fb.hLine(x0, ry + ROW_H - 1, LEVEL_W / MAP_SCALE, f === 0 ? C.WHITE : C.MDGRAY);
    drawText(fb, FLOOR_NAMES[f]!, x + 4, ry + 1, f === kioskFloor ? C.YELLOW : C.LTGRAY, { font: FONT_TINY });
  }
  // shafts
  for (const s of SHAFTS) {
    fb.fillRect(x0 + Math.floor(s.x / MAP_SCALE), top + s.top * ROW_H, 3, (s.bottom - s.top + 1) * ROW_H - 1, C.DKTEAL);
  }
  // stores
  const flash = blinkOn(frame, 16, 9);
  for (const st of STORES) {
    const status = storeStatus(w.run.level, st.id);
    const bx = x0 + Math.floor(st.x / MAP_SCALE);
    const by = top + st.floor * ROW_H + 1;
    const bw = Math.round(STORE_W / MAP_SCALE);
    const isTarget = st.id === target;
    if (isTarget) {
      fb.fillRect(bx - 1, by - 1, bw + 2, 7, flash ? C.YELLOW : C.WHITE);
      fb.fillRect(bx, by, bw, 5, flash ? C.ORANGE : C.RED);
    } else {
      const fill = STATUS_FILL[status];
      if (fill === null) fb.strokeRect(bx, by, bw, 5, C.MDGRAY);
      else fb.fillRect(bx, by, bw, 5, fill);
    }
  }
  // you are here
  if (blinkOn(frame, 24, 16)) {
    const hx = x0 + Math.floor(kioskX / MAP_SCALE);
    const hy = top + kioskFloor * ROW_H + 2;
    fb.fillRect(hx - 1, hy - 1, 4, 6, C.BLACK);
    fb.fillRect(hx, hy, 2, 2, C.PEACH);
    fb.fillRect(hx, hy + 2, 2, 2, C.WHITE);
  }
  // footer: the winner, or nothing left
  const label = target ? (STORES.find((s) => s.id === target)?.name ?? '') : packagesLeft(0);
  drawText(fb, label, x + PANEL_W / 2, y + PANEL_H - 10, target ? (flash ? C.YELLOW : C.WHITE) : C.GREEN, { align: 'center' });
  fb.popClip();
}

// =============================================================== photo strip

const CELL_W = 12;
const CELL_H = 9;
const CELL_BG = [C.SKY, C.HOTPINK, C.LTGREEN, C.AMBER] as const;
export const STRIP_REVEAL_FRAMES = 16;

/** One photo: the agent pulling a different face in each of the four frames. */
function drawPhotoCell(fb: Framebuffer, x: number, y: number, i: number): void {
  fb.fillRect(x, y, CELL_W, CELL_H, CELL_BG[i % CELL_BG.length]!);
  fb.fillRect(x + 3, y + 1, 6, 2, C.BLACK); // hair
  fb.fillRect(x + 3, y + 3, 6, 5, C.PEACH); // face
  fb.fillRect(x + 2, y + 8, 8, 1, C.RED); // trench coat collar
  switch (i % 4) {
    case 0: // deadpan
      fb.setPixel(x + 4, y + 4, C.BLACK);
      fb.setPixel(x + 7, y + 4, C.BLACK);
      fb.fillRect(x + 5, y + 6, 2, 1, C.BLACK);
      break;
    case 1: // big grin
      fb.setPixel(x + 4, y + 4, C.BLACK);
      fb.setPixel(x + 7, y + 4, C.BLACK);
      fb.fillRect(x + 4, y + 6, 4, 1, C.WHITE);
      fb.hLine(x + 4, y + 7, 4, C.BLACK);
      break;
    case 2: // sunglasses
      fb.fillRect(x + 3, y + 4, 6, 1, C.BLACK);
      fb.fillRect(x + 5, y + 6, 2, 1, C.BLACK);
      break;
    default: // wink and tongue
      fb.setPixel(x + 4, y + 4, C.BLACK);
      fb.hLine(x + 7, y + 4, 2, C.BLACK);
      fb.fillRect(x + 4, y + 6, 4, 1, C.BLACK);
      fb.fillRect(x + 6, y + 7, 2, 1, C.PINKRED);
      break;
  }
}

/**
 * The four-frame photo strip popping up next to the agent after the first time he leaves the booth: the four photos
 * get "taken" one after the other (white flash), then the strip stays a moment and blinks out. (x, y) = the agent's
 * feet in screen pixels.
 */
function drawPhotoStrip(fb: Framebuffer, x: number, y: number, t: number, total: number): void {
  if (t > total - 24 && (t >> 2) % 2 === 1) return; // blink out
  const w = CELL_W + 4;
  const h = STRIP_CELLS * (CELL_H + 1) + 3;
  const pop = Math.min(8, Math.floor(t / 2));
  let cx = x + 16;
  if (cx + w > VIEW_W - 2) cx = x - 16 - w;
  const top = Math.max(HUD_H + 2, y - 30 - h + 8 - pop);
  fb.fillRect(cx, top, w, h, C.WHITE);
  fb.strokeRect(cx, top, w, h, C.BLACK);
  for (let i = 0; i < STRIP_CELLS; i++) {
    const cy = top + 2 + i * (CELL_H + 1);
    const born = 6 + i * STRIP_REVEAL_FRAMES;
    if (t < born) {
      fb.fillRect(cx + 2, cy, CELL_W, CELL_H, C.BLACK);
    } else if (t < born + 3) {
      fb.fillRect(cx + 2, cy, CELL_W, CELL_H, C.WHITE); // flash
    } else {
      drawPhotoCell(fb, cx + 2, cy, i);
    }
  }
}
