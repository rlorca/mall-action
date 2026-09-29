// MALL side-scrolling playfield renderer: draws everything in the view region y=16..239 from `world.s`.
// Pure drawing (no state of its own besides the camera helper); all positions are whole pixels.
//
//   drawMall(surface, world, tick)
//
// Depth order: sky < skyline < skyscraper < roof/floor bands < storefronts < shafts + cars < escalators <
//              furniture < lamps/balls < floor decals < actors < projectiles < darkness < bubbles < overlays.
import { C } from '../core/palette';
import { drawCityline, drawMallInterior, drawNightSky, drawSkyscraper, SKYSCRAPER, CITYLINE_H } from '../art/backdrops';
import { drawStorefront } from '../art/storefronts';
import type { Surface } from '../art/surface';
import { FLOORS, type Floor } from '../data/stores';
import { CAR_H, CEILING_H, FLOOR_Y, LEVEL_H, LEVEL_W } from '../game/geometry';
import { LAYOUT } from '../game/mall';
import type { MallWorld } from '../game/mall';
import { ESCALATORS, ROOF, ROOF_MIN, SHAFTS, STORE_LAYOUTS, WAGON, ZIP, cableY, type EscalatorLayout, type ShaftLayout } from '../game/mall/layout';
import { drawActors, drawBubbles, drawProjectiles } from './mallView-actors';
import { FOOT_DROP, VIEW_H, VIEW_TOP, VIEW_W, cam, inView, setCamera, sx, sy } from './mallView-common';
import { drawDarkness, drawKioskPanel, drawPhotoStrip, drawSelfie } from './mallView-overlays';

export function drawMall(s: Surface, w: MallWorld, tick: number): void {
  const st = w.s;
  setCamera(st.camera.x, st.camera.y);
  s.clip(0, VIEW_TOP, VIEW_W, VIEW_H);
  s.rect(0, VIEW_TOP, VIEW_W, VIEW_H, C.BLACK);

  drawSkyAndRoof(s, w, tick);
  drawBands(s);
  drawRoofProps(s, tick);
  drawSecurityAndSigns(s, w, tick);
  drawStorefronts(s, w, tick);
  drawShafts(s, w, tick);
  drawEscalators(s, w, tick);
  drawFurniture(s, w, tick);
  drawLampsAndBalls(s, w, tick);
  drawZip(s, w, tick);
  drawActors(s, w, tick);
  drawProjectiles(s, w, tick);
  drawDarkness(s, w);
  drawBubbles(s, w);
  drawKioskPanel(s, w, tick);
  drawPhotoStrip(s, w, tick);
  drawSelfie(s, w, tick);
  s.unclip();
}

/* ---------------------------------------------------------------- sky, skyline, skyscraper */

const SKY_H = FLOOR_Y.R + 2;
const ROOF_BAND_TOP = FLOOR_Y.R - 42;

function drawSkyAndRoof(s: Surface, w: MallWorld, tick: number): void {
  if (cam.y < SKY_H) {
    drawNightSky(s, 0, sy(0), VIEW_W, SKY_H, tick);
    // distant skyline with parallax; its base hides behind the roof parapet
    drawCityline(s, -(cam.x >> 1), sy(ROOF_BAND_TOP + 24 - CITYLINE_H), 520, tick);
    // the dark skyscraper at the left edge of the sky (its cable ledge is where the zip line starts)
    const bx = ZIP.startX - SKYSCRAPER.CABLE_X;
    const by = ZIP.startY - SKYSCRAPER.CABLE_Y;
    if (bx + SKYSCRAPER.W > cam.x) drawSkyscraper(s, sx(bx), sy(by), tick);
  }
  void w;
}

/* ---------------------------------------------------------------- floor bands */

function drawBands(s: Surface): void {
  // roof deck (only right of the skyscraper gap)
  {
    const y = sy(ROOF_BAND_TOP);
    if (y < VIEW_TOP + VIEW_H && y + 48 > VIEW_TOP) drawMallInterior(s, sx(ROOF_MIN), y, LEVEL_W - ROOF_MIN, 48, 'roof', ROOF_MIN);
    // little end cap where the roof stops (left of it: open sky towards the skyscraper)
    if (inView(ROOF_MIN - 4, ROOF_MIN + 2, ROOF_BAND_TOP, FLOOR_Y.R + 6)) {
      s.rect(sx(ROOF_MIN - 3), sy(FLOOR_Y.R - 22), 3, 28, C.GRAY_M);
      s.vline(sx(ROOF_MIN - 3), sy(FLOOR_Y.R - 22), 28, C.GRAY_L);
      s.vline(sx(ROOF_MIN - 1), sy(FLOOR_Y.R - 22), 28, C.GRAY_D);
    }
  }
  for (const f of FLOORS) {
    if (f === 'R') continue;
    const top = FLOOR_Y[f] - 42;
    const y = sy(top);
    if (y >= VIEW_TOP + VIEW_H || y + 48 <= VIEW_TOP) continue;
    drawMallInterior(s, sx(0), y, LEVEL_W, 48, f === 'P' ? 'parking' : 'shop', 0);
  }
  // left of the roof the 4F roof edge is a plain ledge
  if (inView(0, ROOF_MIN, FLOOR_Y['4F'] - 46, FLOOR_Y['4F'] - 40)) {
    s.rect(sx(0), sy(FLOOR_Y['4F'] - 44), ROOF_MIN, 2, C.GRAY_M);
    s.rect(sx(0), sy(FLOOR_Y['4F'] - 42), ROOF_MIN, 1, C.GRAY_D);
  }
  // under the parking floor
  const under = FLOOR_Y.P + 6;
  if (cam.y + VIEW_H > under) {
    s.rect(0, sy(under), VIEW_W, LEVEL_H - under + 8, C.BLACK);
    s.hline(0, sy(under), VIEW_W, C.GRAY_DD);
  }
}

/* ---------------------------------------------------------------- roof props */

const ROOF_ACS = [292, 452, 640];
const ROOF_ANTENNAS = [172, 420, 590, 736];

function drawRoofProps(s: Surface, tick: number): void {
  const fy = FLOOR_Y.R;
  if (cam.y > fy + 8) return;
  for (const x of ROOF_ACS) if (inView(x - 12, x + 12, fy - 16, fy)) s.sprite('roof_ac', sx(x - 12), sy(fy - 16) + FOOT_DROP);
  for (const x of ROOF_ANTENNAS) if (inView(x - 4, x + 4, fy - 24, fy)) s.sprite('antenna', sx(x - 4), sy(fy - 24) + FOOT_DROP, { frame: (tick >> 4) & 1 });
  // penthouses over the shafts that reach the roof (A and C): steel casing around the shaft column
  for (const p of ROOF.penthouses) {
    if (!inView(p.x0, p.x1, p.topY - 6, fy)) continue;
    const x0 = sx(p.x0);
    const top = sy(p.topY - 5);
    const h = fy - p.topY + 5;
    s.rect(x0, top, 4, h, C.GRAY_M);
    s.rect(sx(p.x1) - 4, top, 4, h, C.GRAY_M);
    s.vline(x0, top, h, C.GRAY_L);
    s.vline(sx(p.x1) - 4, top, h, C.GRAY_L);
    s.vline(x0 + 3, top, h, C.GRAY_D);
    s.vline(sx(p.x1) - 1, top, h, C.GRAY_D);
    // cap
    s.rect(x0 - 1, top - 3, p.x1 - p.x0 + 2, 4, C.GRAY_L);
    s.hline(x0 - 1, top, p.x1 - p.x0 + 2, C.BLACK);
    s.hline(x0 - 1, top - 3, p.x1 - p.x0 + 2, C.WHITE);
  }
}

/* ---------------------------------------------------------------- ceiling cameras, signs */

const CAMS: { floor: Floor; x: number }[] = [
  { floor: '4F', x: 400 },
  { floor: '4F', x: 236 },
  { floor: '3F', x: 400 },
  { floor: '3F', x: 236 },
  { floor: '2F', x: 236 },
  { floor: '2F', x: 400 },
  { floor: '1F', x: 236 },
  { floor: '1F', x: 400 },
  { floor: 'P', x: 260 },
  { floor: 'P', x: 610 },
];
const PARKING_SIGNS = [40, 160, 400, 540];

function drawSecurityAndSigns(s: Surface, w: MallWorld, tick: number): void {
  void w;
  for (const c of CAMS) {
    const fy = FLOOR_Y[c.floor];
    if (!inView(c.x - 4, c.x + 4, fy - 40, fy - 30)) continue;
    // mounted under the ceiling trim; the red light blinks
    s.sprite('security_cam', sx(c.x - 4), sy(fy - 38));
    if ((tick + c.x) % 90 < 10) s.px(sx(c.x + 2), sy(fy - 33), C.WHITE);
  }
  const py = FLOOR_Y.P;
  for (const x of PARKING_SIGNS) if (inView(x - 8, x + 8, py - 40, py)) s.sprite('parking_sign', sx(x - 8), sy(py - 39));
  if (inView(WAGON.x - 8, WAGON.x + 8, py - 40, py)) s.sprite('exit_sign', sx(WAGON.x - 8), sy(py - 39));
}

/* ---------------------------------------------------------------- storefronts */

function drawStorefronts(s: Surface, w: MallWorld, tick: number): void {
  const pk = w.progress.packages;
  const bf = w.progress.blackFriday;
  for (const l of STORE_LAYOUTS) {
    if (!inView(l.rect.x, l.rect.x + l.rect.w, l.rect.y, l.rect.y + l.rect.h)) continue;
    drawStorefront(s, l.id, sx(l.rect.x), sy(l.rect.y), { tick, cleared: pk.includes(l.id), blackFriday: bf });
  }
}

/* ---------------------------------------------------------------- elevator shafts + cars */

function labelOf(f: Floor): string {
  return f;
}

function drawShafts(s: Surface, w: MallWorld, tick: number): void {
  for (const sh of SHAFTS) {
    const bottom = FLOOR_Y[sh.bottomFloor];
    if (!inView(sh.x, sh.x + sh.w, sh.ceilingY - 10, bottom + 8)) continue;
    const car = w.s.cars.find((c) => c.id === sh.id)!;
    drawShaftColumn(s, sh, bottom);
    drawShaftOpenings(s, sh, car.y, tick, car.level);
    drawCar(s, sh, car, w, tick);
  }
}

function drawShaftColumn(s: Surface, sh: ShaftLayout, bottom: number): void {
  const x = sx(sh.x);
  const top = sy(sh.ceilingY);
  const h = bottom - sh.ceilingY;
  s.clip(x, top, sh.w, h);
  for (let y = 0; y < h; y += 16) s.sprite('elev_shaft_wall', x, top + y);
  s.unclip();
  // shaft frame (side jambs) so it reads against the wall
  s.vline(x - 1, top, h, C.BLACK);
  s.vline(x + sh.w, top, h, C.BLACK);
}

function drawShaftOpenings(s: Surface, sh: ShaftLayout, carY: number, tick: number, level: Floor | null): void {
  const x = sx(sh.x);
  for (const f of sh.floors) {
    const fy = FLOOR_Y[f];
    // floor indicator over the opening: lit when the car is here, otherwise shows where the car is
    const ly = sy(fy - CEILING_H) + 1;
    s.rect(x + sh.w / 2 - 8, ly, 16, 7, C.BLACK);
    s.frame(x + sh.w / 2 - 8, ly, 16, 7, C.GRAY_D);
    const here = level === f;
    const lab = level ?? nearestLabel(carY);
    const blink = level === null && (tick >> 3) % 2 === 0;
    s.text(labelOf(lab), x + sh.w / 2, ly + 1, here ? C.YELLOW_L : blink ? C.ORANGE : C.ORANGE_D, { small: true, align: 'center' });
    if (Math.abs(carY - fy) < 1) continue; // car level: the door is the opening
    if (f === sh.bottomFloor && carY > fy) continue;
    if (carY < fy) s.sprite('elev_grate', x, sy(fy)); // car above: a grate to stand on
    else s.sprite('elev_pit', x, sy(fy)); // car below: an open pit
  }
}

function nearestLabel(carY: number): Floor {
  let best: Floor = 'R';
  let bd = 1e9;
  for (const f of FLOORS) {
    const d = Math.abs(FLOOR_Y[f] - carY);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

function drawCar(s: Surface, sh: ShaftLayout, car: MallWorld['s']['cars'][number], w: MallWorld, tick: number): void {
  void w;
  void tick;
  const x = sx(car.x);
  const top = sy(car.y - CAR_H);
  // cable up to the shaft ceiling (the wall already has one; add the car's suspension stub)
  s.sprite('elev_car_roof', x, top);
  s.sprite(car.doorsOpen ? 'elev_car_open' : 'elev_car_closed', x, top);
  void sh;
}

/* ---------------------------------------------------------------- escalators */

function drawEscalators(s: Surface, w: MallWorld, tick: number): void {
  for (const e of ESCALATORS) {
    const yl = FLOOR_Y[e.lower];
    const yu = FLOOR_Y[e.upper];
    if (!inView(e.x0 - 16, e.x1 + 16, yu - 40, yl + 8)) continue;
    const riding = w.s.escalators.find((q) => q.id === e.id)?.riding ?? false;
    const goingUp = !riding || w.s.player.escUp;
    drawEscalator(s, e, yl, yu, tick, goingUp);
  }
}

function drawEscalator(s: Surface, e: EscalatorLayout, yl: number, yu: number, tick: number, up: boolean): void {
  const W = e.x1 - e.x0;
  const surf = (col: number): number => yl - col; // col 0 = bottom landing end
  const colX = (col: number): number => (e.dir === 1 ? e.x0 + col : e.x1 - 1 - col);
  // well in the upper floor + truss underneath
  for (let col = 0; col < W; col++) {
    const x = sx(colX(col));
    const ty = surf(col);
    // dark opening above the surface where it cuts through the upper floor strip
    if (ty < yu + 6) s.rect(x, sy(yu), 1, ty - yu + 1, C.BLACK);
    const h = yl - ty + 1;
    s.rect(x, sy(ty + 1), 1, h, (col & 15) < 2 ? C.BLACK : C.GRAY_DD);
  }
  // diagonal struts under the steps
  for (let col = 0; col < W; col++) {
    const x = sx(colX(col));
    const y = surf(col) + 9 + ((col >> 3) & 1) * 0;
    if (y < yl) s.px(x, sy(y), C.GRAY_D);
  }
  // moving steps: 8x8 treads translating along the diagonal
  const off = up ? tick & 7 : 7 - (tick & 7);
  const x0 = sx(Math.min(e.x0, e.x1));
  s.clip(x0, sy(yu - 4), W, yl - yu + 4 + 1);
  for (let k = -1; k <= 6; k++) {
    const col = k * 8 + off;
    const wx = e.dir === 1 ? e.x0 + col : e.x1 - col - 8;
    s.sprite('esc_step', sx(wx), sy(yl - col - 8), { frame: 0, flipX: false });
  }
  s.unclip();
  // handrail: diagonal band ~24 px above the treads, with newel posts at both ends
  const railH = 22;
  for (let k = 0; k < 6; k++) {
    const wx = e.dir === 1 ? e.x0 + k * 8 : e.x1 - k * 8 - 8;
    s.sprite('esc_rail', sx(wx), sy(yl - k * 8 - 8 - railH), { flipX: e.dir === -1 });
  }
  for (const col of [0, W - 1]) {
    const x = sx(colX(col));
    s.rect(x - 1, sy(surf(col) - railH), 2, railH, C.GRAY_M);
    s.vline(x - 1, sy(surf(col) - railH), railH, C.GRAY_L);
  }
  // mid balusters
  for (let col = 12; col < W - 4; col += 12) s.vline(sx(colX(col)), sy(surf(col) - railH + 4), railH - 4, C.GRAY_D);
  // landing plates (comb) flush with the floors
  const bx = e.dir === 1 ? e.x0 - 16 : e.x1;
  const tx = e.dir === 1 ? e.x1 : e.x0 - 16;
  s.sprite('esc_landing', sx(bx), sy(yl));
  s.sprite('esc_landing', sx(tx), sy(yu));
}

/* ---------------------------------------------------------------- furniture */

function drawFurniture(s: Surface, w: MallWorld, tick: number): void {
  const st = w.s;
  // kiosks
  for (const k of st.kiosks) {
    const fy = FLOOR_Y[k.floor];
    if (!inView(k.x - 14, k.x + 14, fy - 32, fy)) continue;
    s.sprite('kiosk', sx(k.x - 12), sy(fy - 32) + FOOT_DROP, { frame: k.cooldown > 0 ? 0 : (tick >> 4) & 1 });
  }
  // photo booth
  {
    const b = LAYOUT.booth;
    const fy = FLOOR_Y[b.floor];
    if (inView(b.x - 14, b.x + 14, fy - 32, fy)) s.sprite(st.player.mode === 'booth' ? 'photobooth' : 'photobooth_open', sx(b.x - 12), sy(fy - 32) + FOOT_DROP);
  }
  // decor (benches, plants, pillars) + trash cans next to benches
  for (const d of LAYOUT.decor) {
    const fy = FLOOR_Y[d.floor];
    if (!inView(d.x - 14, d.x + 14, fy - 48, fy)) continue;
    if (d.kind === 'bench') {
      s.sprite('bench', sx(d.x - 12), sy(fy - 12) + FOOT_DROP);
      s.sprite('trashcan', sx(d.x + 18 - (d.x > 700 ? 0 : 36)), sy(fy - 12) + FOOT_DROP);
    } else if (d.kind === 'plant') s.sprite('plant', sx(d.x - 8), sy(fy - 24) + FOOT_DROP);
    else s.sprite('pillar', sx(d.x - 8), sy(fy - 48) + FOOT_DROP + (FOOT_DROP ? 0 : 0));
  }
  // fountains with spray
  for (const f of st.fountains) {
    const fy = FLOOR_Y[f.floor];
    if (!inView(f.x - 18, f.x + 18, fy - 40, fy)) continue;
    s.sprite('fountain', sx(f.x - 16), sy(fy - 24) + FOOT_DROP, { frame: (tick >> 3) % 3 });
    if (f.spray > 0) s.sprite('fountain_spray', sx(f.x - 4), sy(fy - 38), { frame: (tick >> 2) % 3 });
  }
  // getaway wagon (behind the actors; the player stands in front of it)
  drawWagon(s, w, tick);
}

function drawWagon(s: Surface, w: MallWorld, tick: number): void {
  const fy = FLOOR_Y.P;
  if (!inView(WAGON.x - 26, WAGON.x + 26, fy - 24, fy)) return;
  const ready = w.progress.packages.length >= 6;
  s.sprite(ready ? 'getaway_wagon_lights' : 'getaway_wagon', sx(WAGON.x - 24), sy(fy - 24) + FOOT_DROP, { frame: ready ? (tick >> 4) & 1 : 0 });
}

/* ---------------------------------------------------------------- lamps + disco balls */

function drawLampsAndBalls(s: Surface, w: MallWorld, tick: number): void {
  for (const l of w.s.lamps) {
    const fy = FLOOR_Y[l.floor];
    if (l.state === 'gone' || !inView(l.x - 10, l.x + 10, fy - 46, fy + 4)) continue;
    if (l.state === 'hang') {
      const shadeTop = l.y - 12;
      // cord from the ceiling trim down to the shade
      for (let y = fy - 42; y < shadeTop; y += 8) {
        if (y + 8 > shadeTop) {
          s.clip(sx(l.x - 1), sy(y), 2, shadeTop - y);
          s.sprite('lamp_cord', sx(l.x - 1), sy(y));
          s.unclip();
        } else s.sprite('lamp_cord', sx(l.x - 1), sy(y));
      }
      s.sprite('lamp_shade', sx(l.x - 8), sy(shadeTop));
    } else if (l.state === 'falling') {
      s.sprite('lamp_shade', sx(l.x - 8), sy(l.y - 12));
    } else {
      const el = 40 - l.frames;
      s.sprite('lamp_shatter', sx(l.x - 8), sy(fy - 12) + FOOT_DROP, { frame: Math.min(2, el >> 3) });
    }
  }
  for (const d of w.s.discoBalls) {
    const fy = FLOOR_Y[d.floor];
    if (d.state === 'gone' || !inView(d.x - 10, d.x + 10, fy - 48, fy + 4)) continue;
    if (d.state === 'hang') {
      s.clip(sx(d.x - 8), sy(fy - 42), 16, 60);
      s.sprite('disco_ball_hang', sx(d.x - 8), sy(d.y - 16), { frame: (tick >> 3) & 3 });
      s.unclip();
    } else if (d.state === 'falling') {
      s.sprite('disco_ball', sx(d.x - 8), sy(d.y - 8), { frame: (tick >> 2) & 3 });
    } else {
      const f = (d.dir === 1 ? d.roll >> 1 : -(d.roll >> 1)) & 3;
      s.sprite('disco_ball', sx(d.x - 8), sy(d.y - 8), { frame: f });
    }
  }
}

/* ---------------------------------------------------------------- zip line */

function drawZip(s: Surface, w: MallWorld, tick: number): void {
  void tick;
  if (cam.y > ZIP.postTopY + 60 || cam.x > ZIP.postX + 40) return;
  // anchor post: a pole from the roof deck up to the cable end, capped by the sprite
  const pyTop = ZIP.postTopY;
  const px = ZIP.postX;
  const poleTop = pyTop + 14;
  s.rect(sx(px - 1), sy(poleTop), 3, FLOOR_Y.R - poleTop + FOOT_DROP, C.GRAY_M);
  s.vline(sx(px - 1), sy(poleTop), FLOOR_Y.R - poleTop, C.GRAY_L);
  s.vline(sx(px + 1), sy(poleTop), FLOOR_Y.R - poleTop, C.GRAY_D);
  s.rect(sx(px - 5), sy(FLOOR_Y.R - 3) + FOOT_DROP, 11, 3, C.GRAY_D);
  s.hline(sx(px - 5), sy(FLOOR_Y.R - 3) + FOOT_DROP, 11, C.GRAY_L);
  s.sprite('anchor_post', sx(px - 4), sy(pyTop));
  // cable: two pixel rows (bright over dark) from the skyscraper ledge to the post
  for (let x = ZIP.startX; x <= px - 3; x++) {
    const y = Math.round(cableY(x));
    s.px(sx(x), sy(y), C.GRAY_L);
    s.px(sx(x), sy(y + 1), C.GRAY_D);
  }
  // pulley on the cable while the agent hangs from it
  const p = w.s.player;
  if (p.mode === 'zip') s.sprite('zip_cable_pulley', sx(p.x - 8), sy(cableY(p.x) - 3));
}
