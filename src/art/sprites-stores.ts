import { Bitmap, defSprite, textInto } from './pixel';
import { FONT3 } from './font';
import { C } from './palette';

/**
 * Storefront window displays (28 x 32, transparent = the dark glass behind) and doors (24 x 32).
 * The displays show what the store sells so you can read a store without reading its sign.
 */
const W = 28;
const H = 32;
function win(name: string, pal: [number, number, number], frames: number, paint: (b: Bitmap, f: number) => void): void {
  defSprite(`win.${name}`, W, H, pal, paint, frames);
}
/** Deterministic noise for TV static. */
function noise(x: number, y: number, f: number): number {
  let h = (x * 374761393 + y * 668265263 + f * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function shutter(b: Bitmap, x: number, y: number, w: number, h: number): void {
  b.rect(x, y, w, h, 1);
  for (let yy = y + 2; yy < y + h; yy += 3) b.hline(x, yy, w, 2);
  b.hline(x, y + h - 1, w, 3);
}

// ---- FOREVER 12: mannequins / clothing rack
function mannequin(b: Bitmap, x: number, top: number, bottom: number): void {
  b.oval(x + 4, 7, 2, 3, 3);
  b.vline(x + 4, 10, 2, 3);
  b.rect(x + 1, 12, 7, 8, top);
  b.rect(x, 12, 9, 2, top);
  b.rect(x + 1, 20, 7, 2, bottom);
  b.rect(x, 22, 9, 6, bottom);
  b.vline(x + 4, 28, 3, 3);
  b.rect(x + 1, 31, 7, 1, 3);
}
win('forever12.l', [C.pink, C.lblue, C.tan], 1, (b) => {
  mannequin(b, 3, 1, 2);
  mannequin(b, 16, 2, 1);
});
win('forever12.r', [C.pink, C.lblue, C.tan], 2, (b, f) => {
  b.hline(2, 6, 24, 3);
  b.vline(2, 6, 26, 3);
  b.vline(25, 6, 26, 3);
  b.hline(0, 31, 28, 3);
  const cols = [1, 2, 1, 3, 2, 1];
  for (let i = 0; i < 6; i++) {
    const x = 4 + i * 4;
    const sway = f && i % 2 ? 1 : 0;
    b.px(x + 1, 7, 3);
    b.rect(x, 8, 3, 2, cols[i]);
    b.rect(x - 1 + sway, 10, 5, 12 + (i % 3) * 2, cols[i]);
  }
});

// ---- RADIOSHOCK: stacked TVs with static / walkie-talkies
win('radioshock.l', [C.lgrey, C.white, C.dgrey], 3, (b, f) => {
  for (let i = 0; i < 3; i++) {
    const y = 2 + i * 10;
    const x = 3 + (i === 1 ? 2 : 0);
    b.rect(x, y, 22, 10, 1);
    b.box(x, y, 22, 10, 3);
    for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 15; xx++) if (noise(xx + i * 7, yy, f) > 0.5) b.px(x + 2 + xx, y + 2 + yy, 2);
    b.px(x + 19, y + 3, 3);
    b.px(x + 19, y + 6, 3);
  }
});
win('radioshock.r', [C.dgrey, C.red, C.lgrey], 1, (b) => {
  for (const [x, y] of [
    [4, 6],
    [15, 2],
  ]) {
    b.rect(x + 3, y - 4, 1, 6, 3); // antenna
    b.rect(x, y + 2, 9, 20, 1);
    b.box(x, y + 2, 9, 20, 3);
    b.rect(x + 2, y + 5, 5, 6, 3); // speaker grille
    for (let yy = y + 6; yy < y + 11; yy += 2) b.hline(x + 2, yy, 5, 1);
    b.rect(x + 2, y + 13, 5, 3, 2); // screen
    b.rect(x + 2, y + 18, 2, 2, 3);
    b.rect(x + 5, y + 18, 2, 2, 3);
  }
});

// ---- CROOKSTONE: massage chair / gadgets on pedestals
win('crookstone.l', [C.brown, C.tan, C.dbrown], 2, (b, f) => {
  b.rect(4, 8, 6, 18, 1); // chair back
  b.rect(4, 8, 6, 2, 2);
  b.rect(4, 22, 18, 5, 1); // seat
  b.rect(20, 14, 6, 13, 1); // leg rest
  b.rect(8, 18, 12, 2, 3); // arm
  b.rect(5, 27, 3, 4, 3);
  b.rect(20, 27, 3, 4, 3);
  // massage rollers travelling up and down
  const y = 11 + f * 6;
  b.rect(5, y, 4, 2, 3);
});
win('crookstone.r', [C.lgrey, C.cyan, C.yellow], 1, (b) => {
  for (let i = 0; i < 3; i++) {
    const x = 1 + i * 9;
    b.rect(x + 1, 24, 6, 8, 1);
    b.hline(x, 24, 8, 3);
  }
  b.oval(5, 18, 3, 3, 2); // globe
  b.hline(2, 18, 6, 1);
  b.rows(10, 14, ['...1....', '..111...', '.11111..', '1111111.'].map((r) => r.replace(/1/g, '3'))); // pyramid
  b.oval(23, 19, 3, 3, 2); // gadget orb
  b.px(22, 18, 1);
});

// ---- GAMESTONK: console stack + cartridges / rocket poster + demo TV
win('gamestonk.l', [C.dgrey, C.lgrey, C.green], 1, (b) => {
  for (let i = 0; i < 3; i++) {
    const y = 5 + i * 6;
    b.rect(2 + (i % 2) * 2, y, 22, 5, 1);
    b.rect(4 + (i % 2) * 2, y + 1, 12, 1, 2);
    b.px(21 + (i % 2) * 2, y + 2, 3);
  }
  const cols = [1, 2, 3, 2, 3, 1, 2];
  for (let i = 0; i < 7; i++) {
    b.rect(2 + i * 3, 24, 3, 7, 1);
    b.rect(3 + i * 3, 26, 1, 3, cols[i]);
  }
});
win('gamestonk.r', [C.navy, C.white, C.red], 2, (b, f) => {
  b.rect(1, 2, 16, 22, 1);
  b.box(1, 2, 16, 22, 2);
  textInto(b, FONT3, 'TO', 5, 4, 2);
  textInto(b, FONT3, 'THE', 3, 9, 2);
  textInto(b, FONT3, 'MOON', 1, 14, 2);
  b.rows(7, 19, ['..2..', '.222.', '.2.2.', '.323.']);
  // demo TV
  b.rect(18, 16, 9, 8, 2);
  b.rect(19, 17, 7, 5, f ? 3 : 1);
  b.px(21, 19, f ? 1 : 3);
  b.rect(20, 24, 5, 1, 2);
});

// ---- KGB TOYS: teddy bears in fur hats / robot + toy rocket
win('kgbtoys.l', [C.brown, C.lgrey, C.tan], 2, (b, f) => {
  for (const x of [2, 15]) {
    b.oval(x + 5, 20, 5, 6, 1); // body
    b.oval(x + 5, 12, 4, 4, 1); // head
    b.oval(x + 2, 9, 2, 2, 1);
    b.oval(x + 8, 9, 2, 2, 1); // ears
    b.rect(x + 2, 5, 7, 4, 2); // ushanka
    b.rect(x + 1, 8, 2, 4 + f, 2);
    b.rect(x + 8, 8, 2, 4 + f, 2);
    b.oval(x + 5, 14, 2, 1, 3);
    b.px(x + 3, 12, 3);
    b.px(x + 7, 12, 3);
    b.rect(x + 3, 26, 2, 4, 1);
    b.rect(x + 7, 26, 2, 4, 1);
  }
});
win('kgbtoys.r', [C.lgrey, C.red, C.yellow], 2, (b, f) => {
  // robot
  b.rect(3, 8, 10, 8, 1);
  b.rect(4, 16, 8, 8, 1);
  b.rect(2, 17, 2, 6, 1);
  b.rect(12, 17, 2, 6, 1);
  b.rect(5, 24, 2, 6, 1);
  b.rect(9, 24, 2, 6, 1);
  b.vline(8, 4, 4, 1);
  b.px(8, 3, f ? 3 : 2);
  b.rect(5, 10, 2, 2, 3);
  b.rect(9, 10, 2, 2, 3);
  b.rect(6, 19, 4, 3, 2);
  // toy rocket
  b.rect(19, 8, 5, 16, 1);
  b.rows(19, 3, ['..2..', '.222.', '22222'].map((r) => r));
  b.rect(19, 12, 5, 2, 2);
  b.px(21, 17, 3);
  b.rect(17, 20, 2, 6, 2);
  b.rect(24, 20, 2, 6, 2);
  b.rect(20, 24, 3, 3 + f, 3);
});

// ---- BLOCKBLUSTER (closed): shutter + FOR LEASE / faded VHS poster
win('blockblustar.l', [C.dgrey, C.grey, C.lgrey], 1, (b) => {
  shutter(b, 0, 0, 28, 32);
  b.rect(3, 10, 22, 12, 3);
  b.box(3, 10, 22, 12, 1);
  textInto(b, FONT3, 'FOR', 9, 12, 1);
  textInto(b, FONT3, 'LEASE', 4, 17, 1);
});
win('blockblustar.r', [C.dblue, C.grey, C.lgrey], 1, (b) => {
  b.rect(3, 3, 22, 26, 2);
  b.box(3, 3, 22, 26, 1);
  b.rect(7, 7, 14, 10, 1);
  b.oval(14, 12, 3, 3, 3);
  textInto(b, FONT3, 'VHS', 9, 20, 3);
  b.rect(8, 25, 12, 2, 1);
});

// ---- SPENDER'S GIFTS: lava lamp / plasma ball
win('spenders.l', [C.dpurple, C.orange, C.lgrey], 3, (b, f) => {
  b.rect(8, 6, 12, 22, 1);
  b.rect(10, 2, 8, 4, 1);
  b.rect(6, 27, 16, 5, 3);
  b.rect(10, 25, 8, 3, 3);
  const ys = [20 - f * 4, 12 + ((f * 5) % 9), 8 + (f % 2) * 6];
  b.oval(14, ys[0], 3, 2, 2);
  b.oval(13, ys[1], 2, 3, 2);
  b.oval(15, ys[2], 2, 2, 2);
  b.oval(14, 26, 4, 1, 2);
});
win('spenders.r', [C.navy, C.lpurple, C.lgrey], 3, (b, f) => {
  b.oval(14, 13, 11, 11, 1);
  b.rect(8, 26, 12, 6, 3);
  b.rect(11, 24, 6, 3, 3);
  // plasma tendrils crawl from the centre; they change every frame
  const angles = [0, 60, 120, 180, 240, 300];
  angles.forEach((a, i) => {
    const ang = ((a + f * 37 + i * 11) * Math.PI) / 180;
    const len = 7 + ((i + f) % 3) * 2;
    b.line(14, 13, 14 + Math.round(Math.cos(ang) * len), 13 + Math.round(Math.sin(ang) * len), 2);
  });
  b.px(14, 13, 3);
  b.px(13, 13, 3);
  b.px(15, 13, 3);
});

// ---- SAM BADDY: tapes and vinyl / boombox
win('sambaddy.l', [C.black, C.red, C.white], 1, (b) => {
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * 8;
    b.oval(x + 3, 9, 4, 4, 1);
    b.oval(x + 3, 9, 1, 1, 2);
    b.rect(x - 1, 14, 9, 1, 3);
  }
  for (let i = 0; i < 3; i++) {
    const y = 18 + i * 5;
    b.rect(2, y, 24, 4, 3);
    b.rect(5, y + 1, 4, 2, 1);
    b.rect(17, y + 1, 4, 2, 1);
    b.px(7, y + 1, 2);
    b.px(19, y + 1, 2);
  }
});
win('sambaddy.r', [C.dgrey, C.lgrey, C.red], 2, (b, f) => {
  b.rect(1, 8, 26, 18, 1);
  b.box(1, 8, 26, 18, 2);
  b.rect(6, 4, 16, 4, 1);
  b.hline(6, 4, 16, 2);
  for (const cx of [8, 20]) {
    b.oval(cx, 17, 5 + f, 5 + f, 2);
    b.oval(cx, 17, 2 + f, 2 + f, 1);
    b.px(cx, 17, 3);
  }
  b.rect(11, 12, 6, 6, 2);
  b.rect(12, 13, 4, 2, 3);
});

// ---- SHARPER IMAGINE: robot vacuum / glowing orb
win('sharper.l', [C.lgrey, C.dgrey, C.lgreen], 2, (b, f) => {
  b.oval(14, 22, 11, 4, 1);
  b.oval(14, 21, 9, 3, 2);
  b.rect(11, 19, 6, 2, 1);
  b.px(f ? 11 : 17, 20, 3);
  b.px(14, 21, 3);
  b.hline(2, 28, 24, 2);
  b.px(4 + f * 3, 26, 1);
  b.px(24 - f * 3, 27, 1);
});
win('sharper.r', [C.cyan, C.white, C.dblue], 3, (b, f) => {
  b.rect(10, 25, 8, 7, 3);
  b.rect(8, 30, 12, 2, 3);
  const r = 5 + f;
  b.oval(14, 14, r + 3, r + 3, 3);
  b.oval(14, 14, r, r, 1);
  b.oval(14, 14, r - 2, r - 2, 2);
  b.px(11, 11, 2);
});

// ---- HOT SPY ON A STICK: lemonade tub being pumped / corn dogs
win('hotspy.l', [C.yellow, C.white, C.dred], 2, (b, f) => {
  b.oval(14, 20, 11, 9, 1);
  b.rect(3, 12, 22, 16, 1);
  b.hline(3, 12, 22, 2);
  b.rect(4, 13, 20, 3, 2);
  b.rect(9, 18, 10, 6, 3);
  textInto(b, FONT3, 'LEM', 9, 19, 2);
  // pump handle bobs
  b.vline(14, 2 + f * 4, 10, 3);
  b.rect(11, 1 + f * 4, 6, 2, 3);
});
win('hotspy.r', [C.orange, C.yellow, C.red], 1, (b) => {
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * 8;
    b.vline(x + 3, 20, 11, 1);
    b.rect(x + 1, 4, 5, 17, 1);
    b.rect(x + 2, 3, 3, 1, 1);
    b.rect(x + 2, 5, 1, 15, 2);
    for (let y = 7; y < 18; y += 3) {
      b.px(x + 3, y, 3);
      b.px(x + 4, y + 1, 3);
    }
  }
});

// ---- CIRCUIT PITY (closed): shutter half down, dead TVs behind
win('circuitpity.l', [C.dgrey, C.black, C.lgrey], 1, (b) => {
  for (let i = 0; i < 2; i++) {
    b.rect(2 + i * 13, 4, 11, 10, 1);
    b.box(2 + i * 13, 4, 11, 10, 3);
    b.rect(4 + i * 13, 6, 7, 6, 2);
  }
  shutter(b, 0, 14, 28, 18);
});
win('circuitpity.r', [C.dgrey, C.black, C.lgrey], 1, (b) => {
  b.rect(5, 3, 18, 12, 1);
  b.box(5, 3, 18, 12, 3);
  b.rect(7, 5, 14, 8, 2);
  b.px(9, 7, 1);
  shutter(b, 0, 14, 28, 18);
});

// ---- FOOT LOCKPICKER: wall of sneakers / basketballs + jersey
function sneaker(b: Bitmap, x: number, y: number, body: number, sole: number, lace: number): void {
  b.rect(x, y, 4, 3, body);
  b.rect(x + 3, y + 2, 5, 2, body);
  b.rect(x, y + 4, 9, 1, sole);
  b.px(x + 1, y, lace);
  b.px(x + 2, y + 1, lace);
}
win('footlock.l', [C.white, C.red, C.lblue], 1, (b) => {
  const cols = [1, 2, 3, 2, 3, 1, 3, 1, 2];
  for (let row = 0; row < 5; row++) {
    b.hline(1, 6 + row * 6, 26, 2);
    for (let i = 0; i < 2; i++) sneaker(b, 2 + i * 13, 1 + row * 6, cols[(row * 2 + i) % cols.length], 1, 2);
  }
});
win('footlock.r', [C.orange, C.black, C.white], 1, (b) => {
  for (const [cx, cy] of [
    [6, 25],
    [14, 27],
  ]) {
    b.oval(cx, cy, 4, 4, 1);
    b.hline(cx - 4, cy, 9, 2);
    b.vline(cx, cy - 4, 9, 2);
  }
  // jersey
  b.rect(16, 3, 10, 16, 3);
  b.rect(16, 3, 2, 4, 1);
  b.rect(24, 3, 2, 4, 1);
  b.rect(19, 3, 4, 2, 2);
  textInto(b, FONT3, '23', 19, 9, 2);
  b.hline(16, 17, 10, 1);
});

// ---- BORDERLINE BOOKS (closed): shutter + CLOSING SALE banner
win('borderline.l', [C.dgrey, C.red, C.white], 1, (b) => {
  shutter(b, 0, 0, 28, 32);
  b.rect(0, 11, 28, 9, 2);
  textInto(b, FONT3, 'CLOSING', 0, 13, 3);
});
win('borderline.r', [C.dgrey, C.red, C.white], 1, (b) => {
  shutter(b, 0, 0, 28, 32);
  b.rect(0, 11, 28, 9, 2);
  textInto(b, FONT3, 'SALE!', 4, 13, 3);
});

// ---------------------------------------------------------------- doors (24 x 32)
function door(b: Bitmap, bright: boolean, accent: number): void {
  const body = bright ? 3 : 1;
  b.rect(0, 0, 24, 32, 2); // frame
  b.rect(2, 2, 20, 30, body);
  b.rect(5, 5, 14, 12, 2); // glass
  b.hline(5, 5, 14, 2);
  b.px(6, 6, accent);
  b.px(7, 7, accent);
  b.rect(17, 20, 3, 2, accent); // handle
  b.hline(2, 19, 15, 2);
}
defSprite('door.target', 24, 32, [C.red, C.dred, C.lred], (b, f) => door(b, f === 1, 3), 2);
defSprite('door.shop', 24, 32, [C.blue, C.dblue, C.lblue], (b) => door(b, false, 3));
defSprite('door.dark', 24, 32, [C.dgrey, C.black, C.grey], (b) => {
  door(b, false, 3);
  b.rect(5, 5, 14, 12, 2);
});
defSprite('shutter', 24, 32, [C.dgrey, C.grey, C.lgrey], (b) => shutter(b, 0, 0, 24, 32));
defSprite('shutter.half', 24, 32, [C.dgrey, C.grey, C.lgrey], (b) => {
  shutter(b, 0, 14, 24, 18);
  b.rect(5, 3, 14, 10, 2);
});
defSprite('sign.bf', 28, 9, [C.yellow, C.red, C.white], (b) => {
  b.rect(0, 0, 28, 9, 2);
  b.box(0, 0, 28, 9, 1);
  textInto(b, FONT3, '70% OFF', 0, 2, 3);
});
