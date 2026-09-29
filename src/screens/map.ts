// MALL DIRECTORY: full-screen schematic of the whole mall (Select). Stateless: everything comes from the snapshot.
import { C } from '../core/palette';
import type { StoreId } from '../core/events';
import { FLOORS, STORE_BY_ID, type Floor } from '../data/stores';
import { FLOOR_Y, LEVEL_W } from '../game/geometry';
import { ESCALATORS, SHAFT_BY_ID } from '../game/mall/layout';
import type { MapSnapshot } from '../game/api';
import type { Progress } from '../game/progress';
import type { Surface } from '../art/surface';
import { blinkOn, wrapTruncate } from './util';

export interface MapOpts {
  progress: Progress;
  inStore: StoreId | null;
  tick: number;
}

/** Horizontal scale of the schematic (level px -> screen px). 1/3.37. */
export const MAP_SCALE = 228 / LEVEL_W;
export const MAP_X0 = 22;
const FLOOR_PITCH = 24;
const ROW0_Y = 40; // screen y of the R floor line
const STORE_H = 14;

/** Short store codes for the tiny font inside the store boxes. */
export const STORE_CODES: Readonly<Record<StoreId, string>> = {
  forever12: 'F12',
  radioshock: 'RAD',
  crookstone: 'CRK',
  gamestonk: 'GMS',
  kgbtoys: 'KGB',
  blockblustervideo: 'BBV',
  spendersgifts: 'SPG',
  sambaddy: 'SAM',
  sharperimagine: 'SHP',
  hotspy: 'HOT',
  circuitpity: 'CPT',
  footlockpicker: 'FLK',
  borderlinebooks: 'BRD',
};

const floorLineY = (f: Floor): number => ROW0_Y + FLOORS.indexOf(f) * FLOOR_PITCH;
/** World y (floor plane) -> map y. */
const worldToMapY = (wy: number): number => ROW0_Y + ((wy - FLOOR_Y.R) / 48) * FLOOR_PITCH;
const mapX = (wx: number): number => MAP_X0 + Math.round(wx * MAP_SCALE);

/** Inventory line(s): "ITEMS: a, b, c" wrapped to at most 2 lines of 32 columns; PHOTO STRIP included when taken. */
export function inventoryLines(p: Progress): string[] {
  const items = [...p.inventory];
  if (p.photoStrip && !items.includes('PHOTO STRIP')) items.push('PHOTO STRIP');
  return wrapTruncate(items.length ? `ITEMS: ${items.join(', ')}` : 'ITEMS: NONE', 30, 2);
}

function line(s: Surface, x0: number, y0: number, x1: number, y1: number, color: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) s.px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), color);
}

export function drawMap(s: Surface, snap: MapSnapshot, o: MapOpts): void {
  const { progress, inStore, tick } = o;
  const blink = blinkOn(tick, 30);
  s.clear(C.BLACK);
  // board
  s.rect(2, 2, 252, 236, C.INDIGO_D);
  s.frame(2, 2, 252, 236, C.GRAY_L);
  s.frame(4, 4, 248, 232, C.GRAY_D);
  // title
  s.rect(60, 6, 136, 12, C.BLACK);
  s.frame(60, 6, 136, 12, C.YELLOW);
  s.text('MALL DIRECTORY', 128, 9, C.YELLOW_L, { align: 'center' });

  const right = MAP_X0 + Math.round(LEVEL_W * MAP_SCALE);
  // building shell
  s.rect(MAP_X0 - 1, floorLineY('R') - 22, right - MAP_X0 + 2, floorLineY('P') - floorLineY('R') + 22 + 3, C.BLACK);

  // floor rows: labels, slabs
  for (const f of FLOORS) {
    const fy = floorLineY(f);
    const here = !inStore && snap.playerFloor === f;
    s.text(f, 3, fy - 8, here && blink ? C.YELLOW_L : C.GRAY_L);
    s.rect(MAP_X0 - 1, fy, right - MAP_X0 + 2, 2, C.GRAY_M);
    s.hline(MAP_X0 - 1, fy + 2, right - MAP_X0 + 2, C.GRAY_DD);
  }
  // roof: skyscraper stub where the zip line starts
  s.rect(MAP_X0, floorLineY('R') - 18, 10, 18, C.INDIGO);
  for (let k = 0; k < 3; k++) s.px(MAP_X0 + 2 + (k % 2) * 4, floorLineY('R') - 14 + k * 5, C.YELLOW);
  // parking hatch under P
  for (let x = MAP_X0; x < right; x += 4) s.px(x, floorLineY('P') + 3, C.GRAY_D);

  // shafts + cars
  for (const car of snap.cars) {
    const sh = SHAFT_BY_ID[car.shaft];
    const x = mapX(sh.x);
    const w = Math.max(8, Math.round(sh.w * MAP_SCALE));
    const top = floorLineY(sh.topFloor) - 16;
    const bot = floorLineY(sh.bottomFloor) + 1;
    s.rect(x, top, w, bot - top, C.GRAY_DD);
    s.frame(x, top, w, bot - top, C.TEAL);
    s.text(car.shaft, x + Math.floor(w / 2) + 1, top - 6, C.CYAN, { small: true, align: 'center' });
    const cy = worldToMapY(car.y);
    s.rect(x + 1, cy - 8, w - 2, 8, C.BLACK);
    s.rect(x + 2, cy - 7, w - 4, 6, car.floor ? C.YELLOW : C.ORANGE);
    s.hline(x + 2, cy - 4, w - 4, C.BLACK);
  }
  // escalators
  for (const e of ESCALATORS) {
    const xa = mapX(e.x0);
    const xb = mapX(e.x1);
    const yLow = floorLineY(e.lower);
    const yUp = floorLineY(e.upper);
    if (e.dir === 1) line(s, xa, yLow - 1, xb, yUp - 1, C.WHITE);
    else line(s, xb, yLow - 1, xa, yUp - 1, C.WHITE);
    if (e.dir === 1) line(s, xa, yLow - 2, xb, yUp - 2, C.GRAY_L);
    else line(s, xb, yLow - 2, xa, yUp - 2, C.GRAY_L);
    s.text('ESC', xb + 2, (yLow + yUp) / 2 - 3, C.GRAY_L, { small: true });
  }
  // getaway car
  {
    const gx = mapX(snap.getawayCar.x);
    const gy = floorLineY('P');
    s.rect(gx, gy - 8, 20, 7, C.BROWN_L);
    s.rect(gx + 4, gy - 11, 11, 3, C.TAN);
    s.hline(gx, gy - 8, 20, C.BLACK);
    s.px(gx + 3, gy - 1, C.BLACK);
    s.px(gx + 16, gy - 1, C.BLACK);
    s.rect(gx + 2, gy - 2, 3, 2, C.BLACK);
    s.rect(gx + 15, gy - 2, 3, 2, C.BLACK);
    s.text('EXIT', gx + 10, gy - 20, C.GREEN_L, { small: true, align: 'center' });
  }

  // stores
  const radar = progress.power.radar;
  for (const st of snap.stores) {
    const def = STORE_BY_ID[st.id];
    const x = mapX(st.x);
    const w = Math.round(st.w * MAP_SCALE);
    const fy = floorLineY(st.floor);
    const y = fy - STORE_H;
    const isTarget = def.role === 'target';
    const cleared = isTarget && progress.packages.includes(st.id);
    let fill: number = C.BLACK;
    let edge: number = C.GRAY_D;
    let txt: number = C.GRAY_D;
    if (def.role === 'closed') {
      fill = C.BLACK;
      edge = C.GRAY_D;
      txt = C.GRAY_D;
    } else if (def.role === 'powerup') {
      fill = C.BLUE;
      edge = C.SKY_L;
      txt = C.WHITE;
    } else if (cleared) {
      fill = C.GRAY_M;
      edge = C.GRAY_L;
      txt = C.GRAY_DD;
    } else {
      fill = C.RED;
      edge = C.RED_L;
      txt = C.WHITE;
    }
    const isCurrent = inStore === st.id;
    if (isCurrent && blink) {
      fill = C.WHITE;
      edge = C.YELLOW_L;
      txt = C.BLACK;
    }
    s.rect(x, y, w, STORE_H, fill);
    s.frame(x, y, w, STORE_H, edge);
    s.text(STORE_CODES[st.id], x + Math.floor(w / 2), y + 5, txt, { small: true, align: 'center' });
    if (def.role === 'closed') s.hline(x + 1, y + 2, w - 2, C.GRAY_D); // shutter line
    if (radar && isTarget && !cleared) s.text('!', x + Math.floor(w / 2) - 3, y - 9, blink ? C.YELLOW_L : C.WHITE);
  }

  // player blip
  if (!inStore) {
    const px = mapX(snap.playerX);
    const py = floorLineY(snap.playerFloor);
    if (blink) {
      s.rect(px - 2, py - 9, 5, 9, C.BLACK);
      s.rect(px - 1, py - 8, 3, 3, C.WHITE);
      s.rect(px - 1, py - 4, 3, 4, C.RED_L);
    }
  }

  // legend
  const ly = floorLineY('P') + 12;
  s.hline(8, ly - 3, 240, C.GRAY_D);
  const sw = (x: number, y: number, fill: number, edge: number): void => {
    s.rect(x, y, 8, 8, fill);
    s.frame(x, y, 8, 8, edge);
  };
  sw(8, ly, C.RED, C.RED_L);
  s.text('PACKAGE', 20, ly, C.WHITE);
  sw(88, ly, C.GRAY_M, C.GRAY_L);
  s.text('CLEARED', 100, ly, C.WHITE);
  sw(168, ly, C.BLUE, C.SKY_L);
  s.text('POWER-UP', 180, ly, C.WHITE);
  sw(8, ly + 10, C.BLACK, C.GRAY_D);
  s.text('CLOSED', 20, ly + 10, C.WHITE);
  sw(88, ly + 10, blink ? C.WHITE : C.INDIGO_D, C.GRAY_L);
  s.text('YOU', 100, ly + 10, C.WHITE);
  sw(168, ly + 10, C.YELLOW, C.BLACK);
  s.text('ELEVATOR', 180, ly + 10, C.WHITE);
  if (radar) s.text('! = PACKAGE (RADAR)', 128, ly + 20, C.YELLOW_L, { align: 'center' });
  // inventory
  const iy = ly + 31;
  s.hline(8, iy - 3, 240, C.GRAY_D);
  inventoryLines(progress).forEach((l, i) => s.text(l, 8, iy + i * 9, C.CYAN_L));
  // hint
  s.text('SELECT: CLOSE', 128, 223, blink ? C.WHITE : C.GRAY_L, { align: 'center' });
}
