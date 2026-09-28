import { C } from '../palette.js';
import { grid, stamp, disc, blank } from './util.js';

const box = (x0, y0, x1, y1, ch) => grid(16, 16, (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 ? ch : '.'));
const outline = (x0, y0, x1, y1, ch) => grid(16, 16, (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 && (x === x0 || x === x1 || y === y0 || y === y1) ? ch : '.'));
const L = (...ls) => ls.reduce((a, l) => stamp(a, l), blank(16, 16));

// floors & walls — patterns
const checker = (a, b, s = 8) => grid(16, 16, (x, y) => (((x / s | 0) + (y / s | 0)) % 2 ? a : b));
const brick = (a, b) => grid(16, 16, (x, y) => (y % 4 === 3 || (x + (y >> 2) % 2 * 4) % 8 === 0 ? a : b));
const stripes = (a, b, c) => grid(16, 16, (x, y) => (y === 15 ? c : x % 4 < 2 ? a : b));
const tiles = (a, b) => grid(16, 16, (x, y) => (x % 8 === 0 || y % 8 === 0 ? a : b));
const carpet = (a, b, c) => grid(16, 16, (x, y) => ((x * 7 + y * 3) % 13 === 0 ? c : (x + y) % 6 === 0 ? b : a));

// fixtures: closed = full of goods; opened = rummaged (dark interior + a few items)
const cabinet = (details) => L(box(1, 2, 14, 15, '2'), outline(1, 2, 14, 15, '1'), details);
const opened = (closed) => stamp(closed, L(box(3, 5, 12, 12, '1'), box(4, 11, 6, 12, '3')));

const FIX = {
  fashion: L(box(1, 2, 14, 2, '1'), box(2, 3, 2, 15, '1'), box(13, 3, 13, 15, '1'), ...[3, 6, 9].map((x, i) => box(x, 4, x + 2, 12 - i, i % 2 ? '3' : '2'))),
  electronics: cabinet(L(box(3, 4, 7, 8, '3'), box(9, 4, 12, 8, '3'), box(3, 10, 12, 13, '3'), box(4, 5, 6, 7, '1'))),
  toys: cabinet(L(disc(16, 16, 5, 7, 2, '3'), box(9, 5, 12, 9, '3'), box(3, 11, 7, 13, '3'), disc(16, 16, 11, 12, 1.5, '3'))),
  food: cabinet(L(box(3, 4, 12, 8, '3'), box(3, 10, 12, 13, '3'), box(5, 5, 6, 6, '1'), box(9, 11, 10, 12, '1'))),
  sports: cabinet(L(...[4, 10].flatMap((y) => [3, 8].map((x) => L(box(x, y + 1, x + 4, y + 3, '3'), box(x, y, x + 1, y, '3')))))),
  music: cabinet(L(...[3, 6, 9, 12].map((x) => box(x, 4, x + 1, 14, '3')))),
  gadgets: L(box(4, 9, 11, 15, '1'), box(5, 10, 10, 14, '2'), disc(16, 16, 8, 5, 3.5, '3'), disc(16, 16, 8, 5, 1.5, '1')),
  novelty: cabinet(L(disc(16, 16, 5, 8, 2, '3'), box(4, 10, 6, 13, '3'), disc(16, 16, 11, 7, 2.5, '3'), box(10, 10, 12, 13, '3'))),
  games: cabinet(L(...[3, 6, 9, 12].map((x, i) => box(x, 4 + (i % 2), x + 1, 13, i % 2 ? '3' : '1')))),
};

const THEMES = {
  fashion: { floor: [checker('1', '2', 4), [C.pink, C.white]], wall: [stripes('1', '2', '3'), [C.magenta, C.pink, C.white]], fix: [C.black, C.pink, C.sky], counter: [C.magenta, C.white, C.pink] },
  electronics: { floor: [tiles('1', '2'), [C.grey, C.lightGrey]], wall: [brick('1', '2'), [C.navy, C.blue]], fix: [C.black, C.grey, C.cyan], counter: [C.navy, C.lightGrey, C.cyan] },
  toys: { floor: [checker('1', '2'), [C.yellow, C.sky]], wall: [stripes('1', '2', '3'), [C.red, C.yellow, C.blue]], fix: [C.navy, C.blue, C.yellow], counter: [C.red, C.yellow, C.white] },
  food: { floor: [checker('1', '2', 4), [C.red, C.white]], wall: [stripes('1', '2', '3'), [C.red, C.white, C.yellow]], fix: [C.darkGrey, C.lightGrey, C.sky], counter: [C.darkRed, C.red, C.white] },
  sports: { floor: [grid(16, 16, (x, y) => (y === 8 ? '2' : (x + y * 3) % 7 === 0 ? '3' : '1')), [C.darkGreen, C.white, C.green]], wall: [brick('1', '2'), [C.brown, C.orange]], fix: [C.brown, C.orange, C.white], counter: [C.brown, C.orange, C.yellow] },
  music: { floor: [checker('1', '2'), [C.black, C.purple]], wall: [brick('1', '2'), [C.black, C.purple]], fix: [C.black, C.purple, C.white], counter: [C.black, C.magenta, C.white] },
  gadgets: { floor: [tiles('1', '2'), [C.darkGrey, C.black]], wall: [stripes('1', '2', '3'), [C.darkGrey, C.lightGrey, C.cyan]], fix: [C.black, C.lightGrey, C.cyan], counter: [C.black, C.lightGrey, C.cyan] },
  novelty: { floor: [carpet('1', '2', '3'), [C.black, C.purple, C.lime]], wall: [stripes('1', '2', '3'), [C.purple, C.black, C.magenta]], fix: [C.black, C.purple, C.lime], counter: [C.black, C.magenta, C.lime] },
  games: { floor: [carpet('1', '2', '3'), [C.navy, C.black, C.magenta]], wall: [brick('1', '2'), [C.black, C.purple]], fix: [C.black, C.red, C.cyan], counter: [C.black, C.purple, C.cyan] },
};

const COUNTER = L(box(0, 3, 15, 15, '1'), box(0, 3, 15, 5, '2'), box(1, 7, 14, 14, '3'), box(0, 15, 15, 15, '1'));

const themed = {};
for (const [t, d] of Object.entries(THEMES)) {
  themed[`floor_${t}`] = { pal: d.floor[1], frames: [d.floor[0]] };
  themed[`wall_${t}`] = { pal: d.wall[1], frames: [d.wall[0]] };
  themed[`fixture_${t}`] = { pal: d.fix, frames: [FIX[t], opened(FIX[t])] };
  themed[`counter_${t}`] = { pal: d.counter, frames: [COUNTER] };
}

const FITTING = L(box(1, 0, 14, 15, '1'), box(2, 1, 13, 1, '3'), ...[3, 6, 9, 12].map((x) => box(x, 2, x + 1, 15, '2')));
const FITTING_OPEN = L(box(1, 0, 14, 15, '1'), box(2, 1, 13, 1, '3'), ...[2, 3, 12, 13].map((x) => box(x, 2, x, 15, '2')));
const TOYSHELF = L(box(0, 1, 15, 15, '1'), box(1, 5, 14, 5, '3'), box(1, 10, 14, 10, '3'), ...[2, 7, 11].map((x) => box(x, 2, x + 2, 4, '2')), ...[3, 9].map((x) => box(x, 7, x + 3, 9, '2')), box(2, 12, 13, 14, '2'));
const TOYSHELF_EMPTY = L(box(0, 1, 15, 15, '1'), box(1, 5, 14, 5, '3'), box(1, 10, 14, 10, '3'));
const TV = (on) => L(box(1, 2, 14, 13, '1'), box(3, 4, 12, 11, on ? '3' : '2'), grid(16, 16, (x, y) => (on && x > 2 && x < 13 && y > 3 && y < 12 && (x * 5 + y * 3 + (on === 2 ? 1 : 0)) % 4 === 0 ? '2' : '.')), box(6, 14, 9, 15, '1'));

export const DEFS = {
  ...themed,
  fittingRoom: { pal: [C.darkRed, C.red, C.yellow], frames: [FITTING, FITTING_OPEN] },
  toyShelf: { pal: [C.brown, C.red, C.orange], frames: [TOYSHELF, TOYSHELF_EMPTY] },
  demoTv: { pal: [C.black, C.cyan, C.white], frames: [TV(1), TV(2)] },
  boothTile: { pal: [C.purple, C.magenta, C.white], frames: [L(box(0, 0, 15, 15, '1'), outline(1, 1, 14, 14, '2'), disc(16, 16, 5, 8, 2.5, '3'), disc(16, 16, 11, 8, 2.5, '3'), box(5, 3, 11, 4, '3'))] },
  pedestal: { pal: [C.brown, C.orange, C.yellow], frames: [L(box(2, 8, 13, 15, '1'), box(3, 9, 12, 14, '2'), box(1, 7, 14, 8, '3'))] },
  doorMat: { pal: [C.darkGrey, C.grey], frames: [grid(16, 16, (x, y) => (y < 2 || y > 13 ? '1' : (x + y) % 3 === 0 ? '1' : '2'))] },
};
