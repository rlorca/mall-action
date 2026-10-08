import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, FONT_TINY, textWidth, wrapText } from '../engine/font';
import { UI } from '../content/copy';
import { STORES, STORE_W, type StoreId } from '../content/stores';
import { CAR_H, ESCALATORS, FEATURES, FLOOR_GAP, FLOOR_NAMES, LEVEL_W, NUM_FLOORS, ROOF_Y, SHAFTS, WAGON } from '../content/layout';
import type { StoreStatus } from '../game/levelstate';
import type { MapData } from '../game/screens/mapdata';
import { SCREEN_TEXT } from '../game/screens/screentext';
import { blinkOn, W } from './screenFx';

/**
 * MALL DIRECTORY: a schematic of the whole mall (not to scale: 768 px across becomes 230, each 48 px floor
 * becomes 26). Every position goes through mapX / mapY so stores, shafts, cars, escalators, the wagon and the
 * player all stay consistent with each other.
 */
export const MAP_X0 = 20;
export const MAP_XS = 0.3;
export const MAP_TOP = 36; // y of the roof walking surface
export const MAP_PITCH = 24; // y distance between floors
const BOX_H = 16;

export const mapX = (wx: number): number => Math.round(MAP_X0 + wx * MAP_XS);
/** World y (a floor surface or feet y) -> map y. Linear in floors, so a gliding car moves smoothly. */
export const mapY = (wy: number): number => Math.round(MAP_TOP + ((wy - ROOF_Y) / FLOOR_GAP) * MAP_PITCH);
const lineY = (floor: number): number => MAP_TOP + floor * MAP_PITCH;

export const STORE_BOX_W = Math.round(STORE_W * MAP_XS);

/** Short sign for the box: the first word of the store name, at most 5 letters. */
export function shortLabel(name: string): string {
  return name.split(' ')[0]!.replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

export interface StoreBox {
  id: StoreId;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where each store's box is drawn (exported for tests). */
export function storeBoxes(): StoreBox[] {
  return STORES.map((s) => ({ id: s.id, x: mapX(s.x), y: lineY(s.floor) - BOX_H - 2, w: STORE_BOX_W, h: BOX_H }));
}

const FILL: Record<StoreStatus, number | null> = {
  package: C.RED,
  cleared: C.GRAY,
  powerup: C.BLUE,
  closed: null,
};
const LABEL: Record<StoreStatus, number> = {
  package: C.WHITE,
  cleared: C.BLACK,
  powerup: C.WHITE,
  closed: C.MDGRAY,
};

function drawStoreBox(fb: Framebuffer, b: StoreBox, status: StoreStatus, name: string, flash: boolean, bang: boolean, frame: number): void {
  const fill = FILL[status];
  if (flash) {
    fb.fillRect(b.x, b.y, b.w, b.h, C.WHITE);
    fb.strokeRect(b.x, b.y, b.w, b.h, C.YELLOW);
  } else if (fill === null) {
    fb.strokeRect(b.x, b.y, b.w, b.h, C.MDGRAY);
  } else {
    fb.fillRect(b.x, b.y, b.w, b.h, fill);
    fb.strokeRect(b.x, b.y, b.w, b.h, status === 'package' ? C.SALMON : status === 'powerup' ? C.CYAN : C.LTGRAY);
  }
  const label = shortLabel(name);
  const lw = textWidth(label, { font: FONT_TINY });
  const col = flash ? C.BLACK : LABEL[status];
  drawText(fb, label, b.x + Math.floor((b.w - lw) / 2), b.y + b.h - 7, col, { font: FONT_TINY });
  if (bang) drawBang(fb, b.x + Math.floor(b.w / 2), b.y + 2, frame % 20 < 12 ? C.YELLOW : C.WHITE);
}

function thickLine(fb: Framebuffer, x0: number, y0: number, x1: number, y1: number, c: number): void {
  fb.line(x0, y0, x1, y1, c);
  fb.line(x0 + 1, y0, x1 + 1, y1, c);
}

function drawGetawayCar(fb: Framebuffer, x: number, floorLine: number): void {
  const y = floorLine - 8;
  fb.fillRect(x, y + 2, 22, 5, C.AMBER);
  fb.fillRect(x + 4, y, 14, 3, C.AMBER);
  fb.fillRect(x + 5, y + 1, 5, 2, C.CYAN);
  fb.fillRect(x + 11, y + 1, 5, 2, C.CYAN);
  fb.hLine(x + 1, y + 4, 20, C.BROWN);
  fb.fillRect(x + 3, y + 6, 3, 2, C.BLACK);
  fb.fillRect(x + 16, y + 6, 3, 2, C.BLACK);
}

function drawElevatorCar(fb: Framebuffer, x: number, bottom: number, h = 16): void {
  fb.fillRect(x, bottom - h, 7, h, C.YELLOW);
  fb.strokeRect(x, bottom - h, 7, h, C.BLACK);
  fb.vLine(x + 3, bottom - h + 1, h - 2, C.BROWN);
}

/** A bold 3 px wide "!" (the thin font glyph is hard to see at this size). */
function drawBang(fb: Framebuffer, cx: number, y: number, color: number): void {
  fb.fillRect(cx - 1, y, 3, 4, color);
  fb.fillRect(cx - 1, y + 5, 3, 2, color);
}

function drawPlayerMarker(fb: Framebuffer, cx: number, feet: number): void {
  const x = cx - 2;
  const y = feet - 8;
  fb.fillRect(x - 1, y - 1, 7, 10, C.BLACK);
  fb.fillRect(x + 1, y, 3, 3, C.PEACH); // head
  fb.fillRect(x, y + 3, 5, 4, C.WHITE); // coat
  fb.fillRect(x + 1, y + 7, 1, 1, C.WHITE);
  fb.fillRect(x + 3, y + 7, 1, 1, C.WHITE);
}

function legendSwatch(fb: Framebuffer, x: number, y: number, status: StoreStatus): void {
  const fill = FILL[status];
  if (fill === null) fb.strokeRect(x, y, 9, 7, C.MDGRAY);
  else {
    fb.fillRect(x, y, 9, 7, fill);
    fb.strokeRect(x, y, 9, 7, status === 'package' ? C.SALMON : status === 'powerup' ? C.CYAN : C.LTGRAY);
  }
}

/** Lines the inventory occupies (wrapped, at most 3; the last one ends with "..." when it overflows). */
export function inventoryLines(inventory: string): string[] {
  const all = wrapText(`${SCREEN_TEXT.map.items} ${inventory}`, W - 16);
  if (all.length <= 3) return all;
  const lines = all.slice(0, 3);
  let last = lines[2]!;
  while (textWidth(`${last}...`) > W - 16) last = last.slice(0, -1);
  lines[2] = `${last}...`;
  return lines;
}

export function drawMapView(fb: Framebuffer, data: MapData): void {
  const T = SCREEN_TEXT.map;
  const frame = data.frame;
  fb.clear(C.BLACK);

  // ---- title bar
  fb.fillRect(0, 0, W, 14, C.DKBLUE);
  fb.hLine(0, 14, W, C.SKY);
  drawText(fb, UI.directory, W / 2, 3, C.WHITE, { align: 'center', shadow: C.BLACK });
  drawText(fb, T.close, W - 4, 5, C.PALEBLUE, { font: FONT_TINY, align: 'right' });
  if (data.blackFriday && blinkOn(frame, 24, 14)) drawText(fb, UI.blackFriday, 4, 5, C.YELLOW, { font: FONT_TINY });

  // ---- mall shell
  const left = mapX(0);
  const right = mapX(LEVEL_W);
  for (let f = 0; f < NUM_FLOORS; f++) {
    const y = lineY(f);
    fb.fillRect(left, y - 1, right - left, 2, f === 0 ? C.WHITE : C.LTGRAY);
    drawText(fb, FLOOR_NAMES[f]!, 3, y - 13, f === 0 ? C.CYAN : C.YELLOW);
  }
  fb.vLine(left, lineY(0) - 19, lineY(NUM_FLOORS - 1) - lineY(0) + 19, C.GRAY);
  fb.vLine(right - 1, lineY(0) - 19, lineY(NUM_FLOORS - 1) - lineY(0) + 19, C.GRAY);
  // ground below P
  fb.fillRect(left, lineY(NUM_FLOORS - 1) + 1, right - left, 3, C.BROWN);

  // roof clutter and parking pillars (from the real feature table)
  for (const ft of FEATURES) {
    if (ft.kind === 'ac') fb.fillRect(mapX(ft.x), lineY(0) - 5, Math.round(ft.w * MAP_XS), 4, C.GRAY);
    if (ft.kind === 'post') fb.fillRect(mapX(ft.x), lineY(0) - 9, 2, 8, C.AMBER);
    if (ft.kind === 'pillar') fb.fillRect(mapX(ft.x), lineY(5) - 17, Math.max(2, Math.round(ft.w * MAP_XS)), 16, C.MDGRAY);
  }

  // ---- elevator shafts + cars
  for (const s of SHAFTS) {
    const x = mapX(s.x);
    const top = lineY(s.top) - BOX_H - 2;
    const bot = lineY(s.bottom);
    fb.fillRect(x, top, Math.round(s.w * MAP_XS), bot - top, C.DKTEAL);
    fb.strokeRect(x - 1, top - 1, Math.round(s.w * MAP_XS) + 2, bot - top + 2, C.TEAL);
    drawText(fb, s.id, x + 1, s.bottom === NUM_FLOORS - 1 ? bot + 4 : bot + 3, C.CYAN);
  }
  for (const c of data.cars) {
    const s = SHAFTS.find((x) => x.id === c.shaft);
    if (!s) continue;
    const lo = lineY(s.top);
    const hi = lineY(s.bottom);
    const bottom = Math.max(lo, Math.min(hi, mapY(c.y)));
    drawElevatorCar(fb, mapX(s.x), bottom);
  }

  // ---- escalators
  for (const e of ESCALATORS) {
    thickLine(fb, mapX(e.xLow), lineY(e.lower) - 2, mapX(e.xHigh), lineY(e.upper) - 2, C.ORANGE);
  }

  // ---- getaway car on P
  drawGetawayCar(fb, mapX(WAGON.x), lineY(NUM_FLOORS - 1));

  // ---- stores
  const blinkNow = blinkOn(frame, 24, 14);
  for (const b of storeBoxes()) {
    const def = STORES.find((s) => s.id === b.id)!;
    const status = data.statuses[b.id];
    const flash = data.player.inStore === b.id && blinkNow;
    drawStoreBox(fb, b, status, def.name, flash, data.radar && status === 'package', frame);
  }

  // ---- player
  if (data.player.inStore === null && blinkNow) {
    const px = Math.max(left + 3, Math.min(right - 4, mapX(data.player.x)));
    const feet = Math.max(lineY(0) - 1, Math.min(lineY(NUM_FLOORS - 1), mapY(data.player.y) - 1));
    drawPlayerMarker(fb, px, feet);
  }

  // ---- legend
  let ly = 172;
  const items: Array<[StoreStatus, string]> = [
    ['package', T.legendPackage],
    ['cleared', T.legendCleared],
    ['powerup', T.legendPowerup],
    ['closed', T.legendClosed],
  ];
  const total = items.reduce((n, [, t]) => n + 12 + textWidth(t), 0) + 6 * (items.length - 1);
  let lx = Math.floor((W - total) / 2);
  for (const [st, text] of items) {
    legendSwatch(fb, lx, ly, st);
    drawText(fb, text, lx + 12, ly, C.WHITE);
    lx += 12 + textWidth(text) + 6;
  }
  ly += 11;
  // row 2: you / package marker / elevator
  lx = 12;
  drawPlayerMarker(fb, lx + 3, ly + 8);
  drawText(fb, T.legendYou, lx + 12, ly, C.WHITE);
  lx += 12 + textWidth(T.legendYou) + 12;
  drawBang(fb, lx + 3, ly, data.radar ? C.YELLOW : C.MDGRAY);
  drawText(fb, T.legendRadar, lx + 10, ly, data.radar ? C.WHITE : C.MDGRAY);
  lx += 10 + textWidth(T.legendRadar) + 12;
  drawElevatorCar(fb, lx, ly + 8, 9);
  drawText(fb, T.legendCar, lx + 11, ly, C.WHITE);
  ly += 11;
  // row 3: getaway car / escalator
  lx = 12;
  drawGetawayCar(fb, lx, ly + 8);
  drawText(fb, T.legendGetaway, lx + 26, ly, C.WHITE);
  lx += 26 + textWidth(T.legendGetaway) + 12;
  thickLine(fb, lx, ly + 7, lx + 8, ly, C.ORANGE);
  drawText(fb, T.legendEscalator, lx + 14, ly, C.WHITE);

  // ---- inventory
  const lines = inventoryLines(data.inventory);
  fb.hLine(8, 206, W - 16, C.DKBLUE);
  lines.forEach((l, i) => drawText(fb, l, 8, 210 + i * 8, i === 0 ? C.PALEYELLOW : C.LTGRAY));
}
