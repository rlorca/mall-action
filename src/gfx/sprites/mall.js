import { C } from '../palette.js';
import { pad, grid, stamp, disc, blank } from './util.js';
import { tinyText } from './tiny.js';

// deterministic noise for TV static etc.
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) & 255; };
const box = (w, h, x0, y0, x1, y1, ch) => grid(w, h, (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 ? ch : '.'));
const frameRect = (w, h, x0, y0, x1, y1, ch) => grid(w, h, (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 && (x === x0 || x === x1 || y === y0 || y === y1) ? ch : '.'));
const layers = (w, h, ...ls) => ls.reduce((acc, l) => stamp(acc, l), blank(w, h));
const fill = (w, h, ch) => grid(w, h, () => ch);

// ---------------------------------------------------------------- tiles 8×8
const TILES = {
  floorTop: { pal: [C.brown, C.orange, C.paleYellow], frames: [grid(8, 8, (x, y) => (y === 0 ? '3' : x === 7 || y === 7 ? '1' : '2'))] },
  floorSlab: { pal: [C.brown, C.darkRed, C.orange], frames: [grid(8, 8, (x, y) => (y === 0 ? '3' : y === 7 ? '2' : (x + y) % 4 === 0 ? '2' : '1'))] },
  wallBack: { pal: [C.paleYellow, C.skin, C.orange], frames: [grid(8, 8, (x, y) => (x === 7 ? '3' : y === 3 && x < 7 ? '2' : '1'))] },
  ceiling: { pal: [C.darkGrey, C.grey, C.lightGrey], frames: [grid(8, 8, (x, y) => (y === 7 ? '3' : y === 6 ? '2' : x % 4 === 0 && y === 3 ? '2' : '1'))] },
  railing: { pal: [C.brown, C.yellow, C.sky], frames: [grid(8, 8, (x, y) => (y === 0 ? '2' : y === 1 ? '1' : x === 0 ? '2' : y > 1 && y < 7 && (x + y) % 5 === 0 ? '3' : '.'))] },
  roofTile: { pal: [C.darkGrey, C.grey, C.black], frames: [grid(8, 8, (x, y) => (y === 0 ? '2' : (x + (y >> 2) * 4) % 8 === 0 ? '3' : '1'))] },
  sky: { pal: [C.navy, C.white], frames: [grid(8, 8, (x, y) => (x === 3 && y === 2 ? '2' : '1'))] },
  parkingFloor: { pal: [C.darkGrey, C.grey, C.yellow], frames: [grid(8, 8, (x, y) => (y === 0 ? '3' : (x * 3 + y * 5) % 11 === 0 ? '2' : '1'))] },
  parkingWall: { pal: [C.grey, C.lightGrey, C.darkGrey], frames: [grid(8, 8, (x, y) => (y === 7 || x === 7 ? '3' : y === 0 ? '2' : '1'))] },
  pillar: { pal: [C.lightGrey, C.white, C.grey], frames: [grid(8, 8, (x) => (x === 1 ? '2' : x === 6 ? '3' : x === 7 || x === 0 ? '.' : '1'))] },
  shaftBg: { pal: [C.black, C.darkGrey], frames: [grid(8, 8, (x, y) => (x === 1 || x === 6 ? '2' : y === 4 && x > 1 && x < 6 ? '2' : '1'))] },
  escStep: { pal: [C.grey, C.lightGrey, C.black], frames: [0, 2].map((o) => grid(8, 8, (x, y) => (y === 7 ? '3' : (x + o) % 4 === 0 ? '3' : y < 2 ? '2' : '1'))) },
  escRail: { pal: [C.black, C.darkGrey], frames: [grid(8, 8, (x, y) => (y < 2 ? '1' : y < 4 ? '2' : '.'))] },
  zipline: { pal: [C.darkGrey], frames: [grid(8, 8, (x, y) => (x === y ? '1' : '.'))] },
  lampCord: { pal: [C.darkGrey], frames: [Array(8).fill('1')] },
};

// ---------------------------------------------------------------- shafts & cars
const CAR_OPEN = layers(24, 40, fill(24, 40, '2'), frameRect(24, 40, 0, 0, 23, 39, '1'), box(24, 40, 2, 2, 21, 3, '3'), box(24, 40, 0, 36, 23, 39, '1'));
const CAR_CLOSED = layers(24, 40, CAR_OPEN, box(24, 40, 2, 5, 11, 35, '1'), box(24, 40, 12, 5, 21, 35, '1'), box(24, 40, 3, 6, 10, 34, '2'), box(24, 40, 13, 6, 20, 34, '2'));
const SHAFT_DOOR_FRAME = layers(32, 40,
  frameRect(32, 40, 0, 0, 31, 39, '1'), frameRect(32, 40, 1, 1, 30, 39, '2'),
  box(32, 40, 0, 0, 31, 5, '1'), box(32, 40, 12, 1, 19, 4, '3'));

const SHAFTS = {
  shaftGrate: { pal: [C.grey, C.darkGrey], frames: [grid(24, 4, (x, y) => (y === 0 || y === 3 || x % 4 === 0 ? '1' : '2'))] },
  carBody: { pal: [C.darkGrey, C.lightGrey, C.yellow], frames: [CAR_CLOSED, CAR_OPEN] },
  carRoof: { pal: [C.darkGrey, C.grey], frames: [grid(24, 4, (x, y) => (y === 0 ? '2' : x === 11 || x === 12 ? '2' : '1'))] },
  shaftDoorFrame: { pal: [C.darkGrey, C.lightGrey, C.red], frames: [SHAFT_DOOR_FRAME] },
};

// ---------------------------------------------------------------- lights & decor
const LAMP = (dx) => layers(16, 12,
  box(16, 12, 7 + dx, 0, 8 + dx, 2, '3'),
  grid(16, 12, (x, y) => (y >= 3 && y <= 7 && Math.abs(x + 0.5 - 8 - dx) <= 2 + (y - 3) ? '1' : '.')),
  box(16, 12, 5 + dx, 8, 10 + dx, 9, '2'), box(16, 12, 6 + dx, 10, 9 + dx, 10, '2'));
const DISCO = (o) => grid(12, 12, (x, y) => ((x + 0.5 - 6) ** 2 + (y + 0.5 - 6) ** 2 <= 30 ? (((x >> 1) + (y >> 1) + o) % 2 ? '1' : (x + y + o) % 5 === 0 ? '3' : '2') : '.'));
const SHARDS = (a, b) => grid(16, 8, (x, y) => (y > 3 && hash(x, y, 7) % 3 === 0 ? a : y > 5 && hash(x, y, 9) % 4 === 0 ? b : '.'));
const FOUNTAIN = (f) => layers(48, 24,
  box(48, 24, 2, 16, 45, 23, '3'), box(48, 24, 0, 14, 47, 16, '3'), box(48, 24, 4, 17, 43, 19, '1'),
  grid(48, 24, (x, y) => {
    const cx = 24, sp = [[-10, 4], [0, 0], [10, 4]];
    for (const [ox, top] of sp) {
      const t = (y - top - f * 2 + 30) % 6;
      const arc = Math.abs(x - cx - ox - (y < 8 ? 0 : Math.sign(ox) * (y - 8) / 2));
      if (y >= top && y < 16 && arc < 1.2) return t < 3 ? '2' : '1';
    }
    return '.';
  }));
const WAGON = (spin) => layers(48, 24,
  box(48, 24, 2, 6, 45, 18, '3'), box(48, 24, 8, 1, 40, 6, '3'), box(48, 24, 10, 2, 22, 6, '1'), box(48, 24, 25, 2, 38, 6, '1'),
  box(48, 24, 2, 11, 45, 14, '2'), box(48, 24, 0, 15, 2, 17, '1'),
  disc(48, 24, 11, 19, 4.5, '1'), disc(48, 24, 37, 19, 4.5, '1'),
  spin ? box(48, 24, 10, 18, 12, 20, '3') : box(48, 24, 11, 17, 11, 21, '3'),
  spin ? box(48, 24, 36, 18, 38, 20, '3') : box(48, 24, 37, 17, 37, 21, '3'));

const DECOR = {
  lamp: { pal: [C.yellow, C.paleYellow, C.darkGrey], frames: [LAMP(0), LAMP(1)] },
  lampBroken: { pal: [C.yellow, C.darkGrey], frames: [SHARDS('1', '2')] },
  disco: { pal: [C.lightGrey, C.white, C.sky], frames: [DISCO(0), DISCO(1)] },
  discoBroken: { pal: [C.lightGrey, C.sky], frames: [SHARDS('1', '2')] },
  bench: { pal: [C.brown, C.orange, C.darkGrey], frames: [layers(32, 12, box(32, 12, 0, 0, 31, 2, '2'), box(32, 12, 0, 4, 31, 6, '2'), box(32, 12, 0, 3, 31, 3, '1'), box(32, 12, 2, 7, 3, 11, '3'), box(32, 12, 28, 7, 29, 11, '3'))] },
  plant: { pal: [C.darkGreen, C.green, C.brown], frames: [layers(16, 24,
    grid(16, 24, (x, y) => (y < 16 && ((x - 8) ** 2) / 36 + ((y - 8) ** 2) / 64 <= 1 ? (hash(x, y, 3) % 3 ? '2' : '1') : '.')),
    box(16, 24, 4, 16, 11, 23, '3'), box(16, 24, 3, 16, 12, 17, '3'))] },
  fountain: { pal: [C.sky, C.white, C.lightGrey], frames: [FOUNTAIN(0), FOUNTAIN(1), FOUNTAIN(2)] },
  kiosk: { pal: [C.navy, C.blue, C.white], frames: [layers(16, 32, box(16, 32, 1, 0, 14, 22, '1'), box(16, 32, 3, 2, 12, 20, '2'),
    box(16, 32, 7, 4, 8, 5, '3'), box(16, 32, 7, 7, 8, 14, '3'), box(16, 32, 6, 22, 9, 31, '1'), box(16, 32, 3, 30, 12, 31, '1'))] },
  photoBooth: { pal: [C.red, C.yellow, C.black], frames: [
    layers(24, 40, box(24, 40, 0, 0, 23, 39, '1'), box(24, 40, 0, 0, 23, 6, '2'), pad(tinyText('FOTO', '1'), 24, 40).map((r) => '....' + r.slice(0, 20)), box(24, 40, 3, 9, 20, 39, '1'), grid(24, 40, (x, y) => (y > 8 && x > 2 && x < 21 && x % 3 === 0 ? '2' : '.'))),
    layers(24, 40, box(24, 40, 0, 0, 23, 39, '1'), box(24, 40, 0, 0, 23, 6, '2'), pad(tinyText('FOTO', '1'), 24, 40).map((r) => '....' + r.slice(0, 20)), box(24, 40, 3, 9, 20, 39, '3'), box(24, 40, 3, 9, 6, 39, '1'))] },
  wetSign: { pal: [C.yellow, C.black], frames: [pad(['...11', '..1221', '..1221', '.122221', '.122121', '1222222', '1221221', '1222222', '1111111', '1.....1', '1.....1', '1.....1'], 8, 12)] },
  puddle: { pal: [C.sky, C.white], frames: [pad(['..1111111111', '.11112111111111', '11111111121111', '..1111111111'], 16, 4), pad(['..1111111111', '.11111111211111', '11121111111111', '..1111111111'], 16, 4)] },
  stationWagon: { pal: [C.black, C.brown, C.paleYellow], frames: [WAGON(false), WAGON(true)] },
};

// ---------------------------------------------------------------- storefronts
const FACADE = layers(80, 40,
  fill(80, 40, '1'), box(80, 40, 2, 1, 77, 11, '2'), frameRect(80, 40, 2, 1, 77, 11, '1'),
  box(80, 40, 4, 14, 27, 33, '3'), box(80, 40, 52, 14, 75, 33, '3'), box(80, 40, 32, 16, 47, 39, '3'),
  box(80, 40, 0, 36, 79, 39, '1'));
const DOOR = (hi) => layers(16, 24, fill(16, 24, '2'), frameRect(16, 24, 0, 0, 15, 23, '1'), box(16, 24, 7, 1, 8, 23, '1'),
  box(16, 24, 2, 3, 5, 14, hi ? '3' : '2'), box(16, 24, 10, 3, 13, 14, hi ? '3' : '2'), box(16, 24, 5, 12, 5, 13, '1'), box(16, 24, 10, 12, 10, 13, '1'));
const SHUTTER = grid(80, 28, (x, y) => (y % 3 === 2 ? '3' : y % 3 === 0 ? '2' : '1'));
const shutterWith = (...extras) => layers(80, 28, SHUTTER, ...extras);

const STORE_FRONT = {
  facade: { pal: [C.darkGrey, C.lightGrey, C.black], frames: [FACADE] },
  doorRed: { pal: [C.darkRed, C.red, C.pink], frames: [DOOR(true), DOOR(false)] },
  doorBlue: { pal: [C.navy, C.blue, C.sky], frames: [DOOR(true)] },
  doorDark: { pal: [C.black, C.darkGrey, C.grey], frames: [DOOR(false)] },
  shutter: { pal: [C.grey, C.lightGrey, C.darkGrey], frames: [SHUTTER] },
  windowLightOff: { pal: [C.black], frames: [grid(24, 20, (x, y) => ((x + y) % 2 ? '1' : '.'))] },
  saleSign: { pal: [C.red, C.white], frames: [layers(24, 8, fill(24, 8, '1'), pad(['', ...tinyText('70%OFF', '2').map((r) => '.' + r)], 24, 8))] },
  disp_blockbluster: { pal: [C.grey, C.lightGrey, C.navy], frames: [shutterWith(
    box(80, 28, 26, 7, 53, 19, '2'), frameRect(80, 28, 26, 7, 53, 19, '3'), stamp(blank(80, 28), tinyText('FOR', '3'), 34, 8), stamp(blank(80, 28), tinyText('LEASE', '3'), 30, 14))] },
  disp_circuitpity: { pal: [C.grey, C.lightGrey, C.black], frames: [layers(80, 28,
    stamp(blank(80, 28), SHUTTER.slice(0, 16)),
    box(80, 28, 6, 18, 21, 27, '3'), box(80, 28, 26, 20, 37, 27, '3'), box(80, 28, 44, 17, 61, 27, '3'), box(80, 28, 66, 20, 77, 27, '3'),
    box(80, 28, 8, 20, 19, 25, '1'), box(80, 28, 46, 19, 59, 25, '1'))] },
  disp_borderline: { pal: [C.grey, C.red, C.white], frames: [shutterWith(
    box(80, 28, 4, 9, 75, 17, '2'), stamp(blank(80, 28), tinyText('CLOSING SALE', '3'), 16, 11))] },
};

// ---------------------------------------------------------------- window displays 24×20
// slot 1 = window background (lit), 2/3 = merchandise
const W = (fn) => grid(24, 20, fn);
const bg = () => fill(24, 20, '1');
const shelf = (y) => box(24, 20, 0, y, 23, y, '3');

const mannequin = (cx) => layers(24, 20, disc(24, 20, cx, 4, 2, '2'), grid(24, 20, (x, y) => (y >= 6 && y <= 15 && Math.abs(x + 0.5 - cx) <= 1 + (y - 6) / 3 ? '3' : '.')), box(24, 20, cx - 1, 16, cx, 19, '2'));
const tvStack = (seed) => layers(24, 20, bg(),
  ...[[1, 1], [12, 1], [1, 10], [12, 10]].map(([x, y]) => layers(24, 20, box(24, 20, x, y, x + 10, y + 8, '2'),
    W((px, py) => (px > x && px < x + 10 && py > y && py < y + 8 ? (hash(px, py, seed) % 2 ? '3' : '1') : '.')))));
const teddy = (cx) => layers(24, 20, box(24, 20, cx - 3, 3, cx + 3, 5, '3'), disc(24, 20, cx, 8, 3, '2'), disc(24, 20, cx, 14, 4, '2'), box(24, 20, cx - 1, 8, cx - 1, 8, '3'), box(24, 20, cx + 1, 8, cx + 1, 8, '3'));
const pump = (f) => layers(24, 20, bg(), box(24, 20, 4, 8, 19, 19, '2'), box(24, 20, 5, 9, 18, 11, '1'), box(24, 20, 11, 2 + f * 2, 12, 9, '3'), box(24, 20, 8, 2 + f * 2, 15, 3 + f * 2, '3'));
const cornDogs = (f) => layers(24, 20, bg(), ...[4, 11, 18].map((x, i) => layers(24, 20, box(24, 20, x - 1, 3 + ((i + f) % 3), x + 1, 11 + ((i + f) % 3), '2'), box(24, 20, x, 12 + ((i + f) % 3), x, 18, '3'))));
const sneakers = () => layers(24, 20, bg(), ...[2, 9, 16].flatMap((x) => [3, 11].map((y) => layers(24, 20, box(24, 20, x, y + 2, x + 5, y + 4, '2'), box(24, 20, x, y + 4, x + 5, y + 4, '3'), box(24, 20, x, y, x + 2, y + 2, '2')))), shelf(8), shelf(16));
const records = (f) => layers(24, 20, bg(), disc(24, 20, 6, 6, 5, '2'), disc(24, 20, 6, 6, 1.5, '3'), disc(24, 20, 17, 12, 6, '2'), disc(24, 20, 17 + (f ? 1 : 0), 12, 2, '3'), box(24, 20, 1, 13, 9, 19, '3'), box(24, 20, 3, 15, 7, 17, '2'));
const boombox = (f) => layers(24, 20, bg(), box(24, 20, 1, 5, 22, 17, '2'), box(24, 20, 6, 2, 17, 4, '2'), disc(24, 20, 6, 12, f ? 4 : 3, '3'), disc(24, 20, 18, 12, f ? 4 : 3, '3'), disc(24, 20, 6, 12, 1, '2'), disc(24, 20, 18, 12, 1, '2'), box(24, 20, 10, 7, 13, 9, '3'));
const lava = (f) => layers(24, 20, bg(), grid(24, 20, (x, y) => (x >= 8 && x <= 15 && y >= 3 && y <= 15 && Math.abs(x + 0.5 - 12) <= 2 + (y - 3) / 5 ? '2' : '.')),
  disc(24, 20, 12, 6 + f * 3, 1.8, '3'), disc(24, 20, 11, 13 - f * 2, 1.5, '3'), box(24, 20, 8, 16, 15, 19, '3'), box(24, 20, 9, 1, 14, 2, '3'));
const plasma = (f) => layers(24, 20, bg(), disc(24, 20, 12, 9, 7, '2'), grid(24, 20, (x, y) => ((x - 12) ** 2 + (y - 9) ** 2 < 42 && hash(x >> 1, y >> 1, f + 50) % 5 === 0 ? '3' : '.')), disc(24, 20, 12, 9, 1.5, '3'), box(24, 20, 9, 16, 14, 19, '3'));
const consoles = (f) => layers(24, 20, bg(), box(24, 20, 2, 12, 12, 18, '2'), box(24, 20, 3, 6, 11, 11, '2'), box(24, 20, 4, 13, 10, 14, '3'), box(24, 20, 4, 7, 10, 8, '3'),
  ...[14, 17, 20].map((x, i) => box(24, 20, x, 4 + ((i + f) % 2), x + 2, 18, i % 2 ? '3' : '2')));
const moonPoster = (f) => layers(24, 20, bg(), frameRect(24, 20, 0, 0, 23, 19, '2'), stamp(blank(24, 20), tinyText('MOON', '2'), 5, 13),
  grid(24, 20, (x, y) => (y >= 2 && y <= 10 && Math.abs(x + 0.5 - 12) <= (y - 2) / 3 + 0.5 ? '3' : '.')), box(24, 20, 11, 11, 12, 11 + f, '3'));

const disp = (name, pal, L, R) => ({ [`disp_${name}_L`]: { pal, frames: L }, [`disp_${name}_R`]: { pal, frames: R } });
const DISPLAYS = {
  ...disp('forever12', [C.white, C.black, C.pink], [layers(24, 20, bg(), mannequin(6), mannequin(17))],
    [layers(24, 20, bg(), box(24, 20, 1, 2, 22, 2, '2'), ...[3, 8, 13, 18].map((x, i) => layers(24, 20, box(24, 20, x + 1, 3, x + 1, 4, '2'), box(24, 20, x - 1, 5, x + 3, 14 - (i % 2) * 3, i % 2 ? '2' : '3'))))]),
  ...disp('radioshock', [C.lightGrey, C.black, C.white], [tvStack(1), tvStack(2)],
    [layers(24, 20, bg(), ...[3, 10, 17].map((x) => layers(24, 20, box(24, 20, x, 7, x + 4, 17, '2'), box(24, 20, x + 3, 2, x + 3, 6, '2'), box(24, 20, x + 1, 9, x + 3, 11, '3')))),
      layers(24, 20, bg(), ...[3, 10, 17].map((x, i) => layers(24, 20, box(24, 20, x, 7, x + 4, 17, '2'), box(24, 20, x + 3, 2, x + 3, 6, '2'), box(24, 20, x + 1, 9, x + 3, 11, i === 1 ? '1' : '3'))))]),
  ...disp('kgbtoys', [C.paleYellow, C.brown, C.black], [layers(24, 20, bg(), teddy(6), teddy(17))],
    [layers(24, 20, bg(), box(24, 20, 2, 6, 9, 17, '3'), box(24, 20, 3, 2, 8, 6, '3'), box(24, 20, 4, 3, 4, 3, '1'), box(24, 20, 7, 3, 7, 3, '1'),
      grid(24, 20, (x, y) => (y >= 2 && y <= 16 && Math.abs(x + 0.5 - 17) <= Math.min(3, (y - 2) / 2) ? '2' : '.')), box(24, 20, 14, 16, 20, 18, '2'))]),
  ...disp('hotspy', [C.white, C.yellow, C.red], [pump(0), pump(1), pump(2)], [cornDogs(0), cornDogs(1), cornDogs(2)]),
  ...disp('footlockpicker', [C.lightGrey, C.white, C.red], [sneakers()],
    [layers(24, 20, bg(), disc(24, 20, 6, 14, 4.5, '3'), disc(24, 20, 14, 15, 3.5, '3'), box(24, 20, 14, 2, 22, 10, '2'), box(24, 20, 12, 2, 13, 5, '2'), box(24, 20, 17, 4, 19, 8, '3'))]),
  ...disp('sambaddy', [C.purple, C.black, C.red], [records(0), records(1)], [boombox(0), boombox(1)]),
  ...disp('crookstone', [C.white, C.brown, C.black],
    [layers(24, 20, bg(), box(24, 20, 3, 2, 8, 16, '2'), box(24, 20, 3, 11, 20, 16, '2'), box(24, 20, 17, 8, 20, 11, '2'), box(24, 20, 5, 17, 6, 19, '3'), box(24, 20, 17, 17, 18, 19, '3'), box(24, 20, 4, 4, 7, 9, '3'))],
    [layers(24, 20, bg(), ...[4, 12, 19].map((x, i) => layers(24, 20, box(24, 20, x - 2, 12, x + 2, 19, '3'), i === 1 ? disc(24, 20, x + 0.5, 8, 3, '2') : box(24, 20, x - 2, 6 + i, x + 2, 11, '2'))))]),
  ...disp('sharperimagine', [C.lightGrey, C.black, C.cyan],
    [0, 1].map((f) => layers(24, 20, bg(), disc(24, 20, 8 + f * 6, 15, 5, '2'), disc(24, 20, 8 + f * 6, 15, 1.5, '3'), box(24, 20, 0, 19, 23, 19, '2'))),
    [0, 1].map((f) => layers(24, 20, bg(), disc(24, 20, 12, 8, f ? 6.5 : 5, '3'), disc(24, 20, 12, 8, 3, '1'), box(24, 20, 9, 15, 14, 19, '2')))),
  ...disp('spenders', [C.black, C.magenta, C.lime], [lava(0), lava(1), lava(2)], [plasma(0), plasma(1), plasma(2)]),
  ...disp('gamestonk', [C.navy, C.lightGrey, C.red], [consoles(0), consoles(1)], [moonPoster(0), moonPoster(1)]),
};

export const DEFS = { ...TILES, ...SHAFTS, ...DECOR, ...STORE_FRONT, ...DISPLAYS };
