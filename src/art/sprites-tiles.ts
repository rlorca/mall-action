// Store interior tiles (16x16, fully opaque). 9 themes x 9 kinds plus the unthemed special tiles.
// Slot 1 is always black (outline/shadow); slots 2 and 3 are the theme's main and accent colours.
import type { SpriteDef } from './pixel';
import { C } from '../core/palette';
import { G, mk } from './sprites-objects';

type Painter = (g: G) => void;
interface Theme {
  colors: number[];
  floor: Painter;
  wall: Painter;
  counter: Painter;
  decor: Painter;
  decor2: Painter;
  fix: (g: G, open: boolean) => void;
  fix2: (g: G, open: boolean) => void;
}

const K = C.BLACK;

/** Draw an object with an automatic 1px black outline on top of the theme floor. */
function over(g: G, floor: Painter | null, fn: Painter): void {
  if (floor) floor(g);
  const o = new G(g.w, g.h);
  fn(o);
  o.outline('1');
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (o.d[y][x] !== '.') g.d[y][x] = o.d[y][x];
}
const fill = (g: G, c: string): void => g.r(0, 0, 16, 16, c);
function checker(g: G, sz: number, a: string, b: string): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, ((x / sz | 0) + (y / sz | 0)) % 2 ? b : a);
}
const hash = (x: number, y: number): number => ((x * 73856093) ^ (y * 19349663)) >>> 0;

// =================================================================== FASHION  [black, pink, white]
const fashion: Theme = {
  colors: [K, C.PINK, C.WHITE],
  floor: (g) => checker(g, 8, '3', '2'),
  wall: (g) => {
    fill(g, '2');
    for (let x = 1; x < 16; x += 4) g.vl(x, 3, 10, '3');
    g.r(0, 0, 16, 2, '3');
    g.hl(0, 2, 16, '1');
    g.hl(0, 13, 16, '3');
    g.r(0, 14, 16, 2, '1');
  },
  counter: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 4, '3');
    g.hl(0, 4, 16, '1');
    g.hl(0, 15, 16, '1');
    for (let x = 1; x < 16; x += 5) g.stamp(x, 8, ['.3.', '333', '.3.']);
    g.hl(0, 5, 16, '3');
  },
  decor: (g) => {
    over(g, fashion.floor, (o) => {
      o.ell(8, 3, 2, 2.3, '3');
      o.r(7, 5, 2, 1, '3');
      o.hl(6, 6, 4, '2');
      o.hl(5, 8, 6, '2');
      o.hl(5, 9, 6, '3');
      o.r(4, 10, 8, 3, '2');
      o.hl(7, 6, 2, '3');
      o.vl(8, 13, 1, '3');
      o.hl(5, 14, 6, '3');
    });
  },
  decor2: (g) => {
    over(g, fashion.floor, (o) => {
      // shoe display: round table with two shoes
      o.ell(8, 8, 6, 2.6, '2');
      o.r(6, 10, 4, 4, '2');
      o.hl(4, 14, 8, '2');
      o.r(4, 4, 4, 3, '3');
      o.r(4, 6, 5, 1, '2');
      o.r(9, 3, 4, 3, '3');
      o.r(9, 5, 4, 1, '2');
      o.set(4, 4, '.');
    });
  },
  fix: (g, open) => {
    over(g, fashion.floor, (o) => {
      o.hl(1, 2, 14, '3');
      o.vl(1, 2, 12, '3');
      o.vl(14, 2, 12, '3');
      o.hl(0, 14, 3, '3');
      o.hl(13, 14, 3, '3');
      if (!open) for (let i = 0; i < 4; i++) o.r(3 + i * 3, 3, 2, 7 + (i % 2) * 2, i % 2 ? '3' : '2');
      else {
        o.r(3, 3, 2, 7, '2');
        o.r(12, 3, 2, 5, '3');
        o.r(3, 11, 5, 3, '2');
        o.r(8, 12, 4, 2, '3');
        o.set(9, 11, '3');
      }
    });
  },
  fix2: (g, open) => {
    over(g, fashion.floor, (o) => {
      o.r(4, 1, 8, 6, '3');
      o.set(5, 2, '2');
      o.set(6, 3, '2');
      o.set(10, 5, '2');
      o.r(2, 8, 12, 2, '3');
      o.r(3, 10, 10, 4, '2');
      o.r(3, 14, 1, 1, '3');
      o.r(12, 14, 1, 1, '3');
      o.r(3, 6, 1, 2, '2');
      o.r(12, 5, 1, 3, '2');
      if (!open) {
        o.hl(4, 11, 8, '3');
        o.set(7, 12, '3');
        o.set(8, 12, '3');
      } else {
        o.r(3, 11, 10, 4, '3');
        o.r(4, 12, 8, 2, '2');
        o.hl(4, 10, 3, '2');
        o.set(9, 10, '3');
        o.set(10, 9, '3');
        o.set(1, 13, '2');
        o.set(14, 12, '3');
      }
    });
  },
};

// =================================================================== ELECTRONICS  [black, navy, cyan]
const electronics: Theme = {
  colors: [K, C.BLUE_D, C.CYAN],
  floor: (g) => {
    fill(g, '2');
    g.hl(0, 0, 16, '1');
    g.vl(0, 0, 16, '1');
    g.hl(0, 8, 16, '1');
    g.vl(8, 0, 16, '1');
    for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) g.set(x, y, '3');
    g.set(4, 4, '1');
    g.set(12, 12, '1');
  },
  wall: (g) => {
    fill(g, '1');
    g.r(0, 0, 16, 2, '2');
    g.r(1, 3, 14, 8, '2');
    for (let x = 2; x < 14; x += 3) g.hl(x, 6, 2, '3');
    g.hl(2, 8, 12, '1');
    g.hl(0, 13, 16, '3');
    g.hl(0, 12, 16, '2');
  },
  counter: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 3, '3');
    g.hl(0, 3, 16, '1');
    g.hl(0, 15, 16, '1');
    for (let x = 2; x < 16; x += 4) g.set(x, 7, '3');
    g.hl(0, 10, 16, '1');
    for (let x = 1; x < 16; x += 4) g.hl(x, 12, 2, '3');
  },
  decor: (g) => {
    over(g, electronics.floor, (o) => {
      o.r(2, 2, 12, 9, '2');
      o.r(4, 4, 8, 5, '3');
      for (let i = 0; i < 14; i++) o.set(4 + ((i * 5) % 8), 4 + ((i * 3) % 5), '1');
      o.r(6, 11, 4, 2, '2');
      o.hl(4, 13, 8, '2');
      o.set(12, 10, '3');
    });
  },
  decor2: (g) => {
    over(g, electronics.floor, (o) => {
      o.r(4, 1, 8, 14, '2');
      o.ell(8, 10, 3, 3, '1');
      o.ring(8, 10, 2.2, 1.0, '3');
      o.ell(8, 4, 1.6, 1.6, '1');
      o.set(8, 4, '3');
      o.vl(4, 1, 14, '3');
    });
  },
  fix: (g, open) => {
    over(g, electronics.floor, (o) => {
      o.r(1, 1, 14, 12, '1');
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 2; c++) {
          const x = 2 + c * 6;
          const y = 2 + r * 3;
          o.r(x, y, 5, 2, '2');
          o.set(x + 2, y, '3');
        }
      // strip the outline colour from inside: keep frame
      o.r(1, 13, 14, 1, '2');
      if (open) {
        o.r(1, 5, 6, 2, '3');
        o.r(2, 7, 5, 1, '1');
        o.r(9, 8, 6, 2, '3');
        o.r(8, 10, 5, 1, '1');
        o.set(3, 14, '3');
        o.set(6, 14, '3');
        o.set(11, 14, '3');
        o.set(13, 15, '3');
        o.set(5, 15, '3');
      }
    });
  },
  fix2: (g, open) => {
    over(g, electronics.floor, (o) => {
      o.r(1, 1, 14, 13, '2');
      o.hl(2, 7, 12, '1');
      o.hl(2, 12, 12, '1');
      const tv = (x: number, y: number, w: number, h: number, on: boolean): void => {
        o.r(x, y, w, h, '1');
        o.r(x + 1, y + 1, w - 2, h - 2, on ? '3' : '2');
        if (on) o.set(x + 2, y + 2, '1');
      };
      if (!open) {
        tv(2, 2, 5, 5, true);
        tv(9, 2, 5, 5, true);
        tv(2, 8, 5, 4, true);
        tv(9, 8, 5, 4, true);
      } else {
        tv(2, 2, 5, 5, false);
        o.line(9, 6, 13, 2, '3');
        tv(2, 8, 5, 4, true);
        o.r(9, 9, 4, 3, '2');
        o.line(8, 13, 4, 15, '3');
        o.line(10, 13, 14, 15, '3');
      }
    });
  },
};

// =================================================================== TOYS  [black, blue, amber]
const toys: Theme = {
  colors: [K, C.BLUE, C.ORANGE],
  floor: (g) => {
    checker(g, 8, '2', '3');
    g.set(3, 3, '1');
    g.set(4, 3, '1');
    g.set(11, 11, '1');
    g.set(12, 11, '1');
  },
  wall: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 2, '3');
    for (const [x, y] of [[3, 5], [11, 6], [7, 10], [14, 12], [1, 11]]) g.stamp(x - 1, y - 1, ['.3.', '333', '.3.']);
    g.r(0, 14, 16, 2, '1');
  },
  counter: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 4, '3');
    g.hl(0, 4, 16, '1');
    g.hl(0, 15, 16, '1');
    g.r(1, 7, 4, 4, '3');
    g.r(6, 7, 4, 4, '1');
    g.r(11, 7, 4, 4, '3');
    g.set(2, 8, '1');
    g.set(12, 8, '1');
  },
  decor: (g) => {
    over(g, toys.floor, (o) => {
      o.ell(5, 3, 1.6, 1.6, '3');
      o.ell(11, 3, 1.6, 1.6, '3');
      o.ell(8, 6, 4, 3.4, '3');
      o.ell(8, 12, 4.4, 3.2, '3');
      o.ell(3, 12, 1.6, 2, '3');
      o.ell(13, 12, 1.6, 2, '3');
      o.ell(8, 7, 1.6, 1.2, '2');
      o.set(6, 5, '1');
      o.set(10, 5, '1');
      o.hl(6, 9, 4, '2');
      o.hl(7, 10, 2, '2');
    });
    g.set(8, 7, '1');
  },
  decor2: (g) => {
    over(g, toys.floor, (o) => {
      o.r(2, 9, 6, 5, '2');
      o.r(8, 9, 6, 5, '3');
      o.r(5, 3, 6, 6, '3');
      o.r(5, 3, 6, 1, '2');
      o.set(4, 11, '3');
      o.set(6, 11, '1');
      o.set(10, 11, '2');
      o.set(7, 6, '1');
      o.set(8, 6, '1');
      o.r(4, 11, 2, 1, '3');
    });
  },
  fix: (g, open) => {
    over(g, toys.floor, (o) => {
      o.r(1, 6, 14, 9, '2');
      o.hl(1, 6, 14, '3');
      o.hl(1, 7, 14, '3');
      o.r(3, 9, 10, 2, '3');
      if (!open) {
        o.ell(5, 4, 2.3, 2.3, '3');
        o.r(9, 3, 4, 3, '2');
        o.vl(7, 2, 4, '3');
      } else {
        o.r(9, 4, 4, 2, '2');
        o.ell(13, 13, 1.8, 1.8, '3');
        o.r(0, 14, 1, 1, '2');
      }
    });
    if (open) {
      g.ell(12.5, 14, 1.8, 1.4, '3');
      g.r(1, 14, 3, 2, '2');
      g.set(9, 14, '3');
    }
  },
  fix2: (g, open) => {
    over(g, toys.floor, (o) => {
      o.r(1, 8, 14, 7, '2');
      o.r(1, 10, 14, 2, '3');
      if (!open) {
        o.r(3, 2, 10, 6, '3');
        o.r(7, 2, 2, 6, '2');
        o.set(4, 4, '1');
      } else {
        o.r(3, 4, 10, 4, '3');
        o.r(4, 5, 8, 3, '1');
        o.line(2, 3, 13, 1, '3', 1);
        o.r(6, 4, 2, 2, '2');
        o.set(11, 6, '2');
      }
    });
  },
};

// =================================================================== FOOD  [black, red, white]
const food: Theme = {
  colors: [K, C.RED, C.WHITE],
  floor: (g) => checker(g, 4, '3', '2'),
  wall: (g) => {
    fill(g, '3');
    for (let y = 3; y < 16; y += 4) g.hl(0, y, 16, '2');
    for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 6; x < 16; x += 8) g.vl(x, y, 3, '2');
    g.r(0, 6, 16, 3, '2');
    g.hl(0, 5, 16, '1');
    g.hl(0, 9, 16, '1');
    g.r(0, 14, 16, 2, '1');
  },
  counter: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 3, '3');
    g.hl(0, 3, 16, '1');
    g.hl(0, 15, 16, '1');
    for (let x = 1; x < 16; x += 4) g.vl(x, 5, 9, '3');
    g.hl(0, 4, 16, '3');
  },
  decor: (g) => {
    over(g, food.floor, (o) => {
      o.r(3, 1, 10, 14, '2');
      o.r(4, 2, 8, 7, '3');
      for (let x = 5; x < 11; x += 2) {
        o.r(x, 3, 1, 2, '1');
        o.r(x, 6, 1, 2, '2');
      }
      o.hl(4, 10, 8, '1');
      o.r(4, 11, 4, 2, '3');
      o.set(10, 11, '3');
      o.set(10, 13, '3');
      o.hl(4, 14, 8, '1');
    });
  },
  decor2: (g) => {
    over(g, food.floor, (o) => {
      o.ell(8, 6, 6, 3, '3');
      o.ell(8, 6, 3.5, 1.6, '2');
      o.r(7, 8, 2, 4, '3');
      o.hl(5, 12, 6, '3');
      o.ell(2.5, 12.5, 2, 1.3, '2');
      o.ell(13.5, 12.5, 2, 1.3, '2');
    });
  },
  fix: (g, open) => {
    over(g, food.floor, (o) => {
      o.r(1, 4, 14, 11, '3');
      o.r(2, 5, 5, 4, '1');
      o.r(9, 5, 5, 4, '1');
      o.hl(2, 5, 5, '2');
      o.hl(9, 5, 5, '2');
      o.hl(1, 10, 14, '1');
      for (let x = 3; x < 14; x += 3) o.set(x, 12, '2');
      o.r(6, 2, 1, 3, '3');
      o.r(13, 2, 1, 3, '3');
      if (open) {
        o.r(3, 0, 4, 3, '2');
        o.hl(4, 1, 2, '3');
        o.set(9, 0, '3');
        o.set(10, 1, '3');
        o.set(12, 0, '3');
      } else {
        o.r(3, 3, 4, 2, '2');
        o.r(10, 3, 4, 2, '2');
      }
    });
    if (open) {
      g.r(3, 14, 2, 1, '2');
      g.r(8, 15, 2, 1, '2');
      g.r(12, 14, 2, 1, '2');
    }
  },
  fix2: (g, open) => {
    over(g, food.floor, (o) => {
      o.r(3, 1, 10, 14, '3');
      o.hl(3, 1, 10, '2');
      if (!open) {
        o.r(4, 3, 8, 9, '1');
        for (const y of [4, 7, 10]) for (let x = 5; x < 11; x += 3) o.r(x, y, 2, 2, '2');
        o.vl(11, 4, 5, '3');
        o.set(5, 3, '3');
      } else {
        o.r(4, 3, 3, 9, '2');
        o.r(8, 3, 4, 9, '3');
        for (const y of [4, 7, 10]) o.r(9, y, 2, 2, '2');
        o.r(13, 3, 2, 10, '2');
      }
      o.hl(4, 13, 8, '1');
    });
    if (open) {
      g.r(1, 13, 3, 1, '2');
      g.r(0, 14, 2, 1, '2');
    }
  },
};

// =================================================================== SPORTS  [black, brown, tan]
const sports: Theme = {
  colors: [K, C.ORANGE_D, C.TAN],
  floor: (g) => {
    fill(g, '3');
    for (let b = 0; b < 4; b++) {
      g.hl(0, b * 4, 16, '2');
      g.vl((b * 5 + 3) % 16, b * 4 + 1, 3, '2');
    }
  },
  wall: (g) => {
    fill(g, '2');
    for (let x = 0; x < 16; x += 4) g.vl(x, 0, 13, '1');
    g.r(0, 5, 16, 4, '3');
    g.hl(0, 4, 16, '1');
    g.hl(0, 9, 16, '1');
    for (let x = 2; x < 16; x += 4) g.set(x, 7, '2');
    g.r(0, 13, 16, 3, '1');
  },
  counter: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 3, '3');
    g.hl(0, 3, 16, '1');
    g.hl(0, 15, 16, '1');
    for (let x = 0; x < 16; x += 4) g.vl(x, 4, 11, '1');
    g.ell(8, 9, 2.4, 2.4, '3');
    g.hl(5, 9, 6, '1');
    g.vl(8, 6, 6, '1');
  },
  decor: (g) => {
    over(g, sports.floor, (o) => {
      o.r(2, 8, 12, 7, '2');
      o.hl(2, 8, 12, '3');
      o.ell(5, 7, 2.4, 2.4, '3');
      o.ell(9, 6, 2.4, 2.4, '3');
      o.ell(12, 7.5, 2, 2, '3');
      o.r(2, 10, 12, 4, '2');
      o.hl(4, 12, 8, '1');
    });
    g.hl(4, 7, 3, '1');
    g.vl(9, 4, 4, '1');
  },
  decor2: (g) => {
    over(g, sports.floor, (o) => {
      o.r(4, 2, 8, 3, '3');
      o.poly(5, 8, (y) => [4 + (y - 5), 11 - (y - 5)], '3');
      o.r(1, 3, 2, 3, '3');
      o.r(13, 3, 2, 3, '3');
      o.r(7, 9, 2, 3, '3');
      o.r(4, 12, 8, 3, '2');
      o.set(6, 3, '2');
      o.hl(7, 5, 2, '2');
    });
  },
  fix: (g, open) => {
    over(g, sports.floor, (o) => {
      o.r(1, 1, 14, 14, '1');
      o.hl(1, 5, 14, '2');
      o.hl(1, 10, 14, '2');
      o.hl(1, 14, 14, '2');
      const shoe = (x: number, y: number, c: string): void => {
        o.r(x, y, 4, 2, c);
        o.set(x + 3, y, '.');
        o.hl(x, y + 2, 4, '2');
      };
      for (let i = 0; i < 3; i++) {
        if (!open || i !== 1) shoe(2 + i * 4, 3, i % 2 ? '3' : '2');
        if (!open || i !== 0) shoe(2 + i * 4, 8, i % 2 ? '2' : '3');
        if (!open) shoe(2 + i * 4, 12, i % 2 ? '3' : '2');
      }
    });
    if (open) {
      g.r(2, 11, 4, 2, '3');
      g.r(9, 12, 4, 2, '2');
      g.hl(2, 13, 4, '1');
      g.hl(9, 14, 4, '1');
    }
  },
  fix2: (g, open) => {
    over(g, sports.floor, (o) => {
      o.r(1, 1, 6, 14, '2');
      o.r(9, 1, 6, 14, '2');
      o.hl(2, 3, 4, '1');
      o.hl(2, 5, 4, '1');
      o.r(5, 8, 1, 2, '3');
      o.hl(10, 3, 4, '1');
      o.hl(10, 5, 4, '1');
      o.r(10, 8, 1, 2, '3');
      o.hl(1, 1, 6, '3');
      o.hl(9, 1, 6, '3');
    });
    if (open) {
      g.r(9, 1, 7, 14, '1');
      g.r(10, 3, 4, 3, '3');
      g.r(10, 8, 3, 4, '2');
      g.r(14, 1, 2, 14, '2');
      g.vl(14, 1, 14, '1');
      g.r(0, 14, 1, 1, '3');
    }
  },
};

// =================================================================== MUSIC  [black, crimson, amber]
const music: Theme = {
  colors: [K, 0x05, C.ORANGE],
  floor: (g) => {
    fill(g, '2');
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const h = hash(x, y) % 23;
        if (h === 0) g.set(x, y, '1');
        else if (h === 1) g.set(x, y, '3');
      }
  },
  wall: (g) => {
    fill(g, '2');
    for (let x = 0; x < 16; x += 3) g.vl(x, 0, 13, '1');
    for (let x = 1; x < 16; x += 3) g.vl(x, 2, 9, '3');
    g.hl(0, 0, 16, '3');
    g.hl(0, 11, 16, '3');
    g.r(0, 13, 16, 3, '1');
    g.hl(0, 12, 16, '2');
  },
  counter: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 3, '3');
    g.hl(0, 3, 16, '1');
    g.hl(0, 15, 16, '1');
    for (let y = 5; y < 14; y += 2) for (let x = (y % 4 === 1 ? 0 : 1); x < 16; x += 2) g.set(x, y, '1');
    g.hl(0, 4, 16, '3');
  },
  decor: (g) => {
    over(g, music.floor, (o) => {
      o.r(7, 1, 2, 7, '3');
      o.r(6, 0, 4, 2, '3');
      o.ell(8, 11, 4.4, 3.4, '3');
      o.ell(8, 7.5, 3, 2.2, '3');
      o.ell(8, 11, 1.6, 1.6, '1');
      o.hl(6, 12, 4, '2');
      o.hl(4, 13, 8, '2');
      o.hl(5, 15, 6, '3');
    });
    g.ell(8, 11, 1.6, 1.6, '1');
    g.vl(8, 8, 2, '1');
  },
  decor2: (g) => {
    over(g, music.floor, (o) => {
      o.r(2, 1, 12, 6, '2');
      o.r(2, 8, 12, 7, '2');
      o.set(4, 3, '3');
      o.set(6, 3, '3');
      o.set(8, 3, '3');
      o.hl(10, 3, 3, '3');
      o.ell(8, 11.5, 3.2, 3.2, '1');
      o.ring(8, 11.5, 2.4, 1.3, '3');
      o.hl(2, 7, 12, '3');
    });
  },
  fix: (g, open) => {
    over(g, music.floor, (o) => {
      o.r(1, 8, 14, 7, '3');
      o.hl(1, 8, 14, '2');
      o.hl(2, 12, 12, '2');
      for (let x = 2; x < 14; x++) {
        if (open && x % 4 === 1) continue;
        const y = 2 + ((x * 5) % 3);
        o.vl(x, y, 8 - (y - 2), x % 2 ? '3' : '2');
        if (x % 3 === 0) o.set(x, y + 1, '1');
      }
    });
    if (open) {
      g.ell(4, 14, 2.2, 1.2, '1');
      g.ell(4, 14, 0.8, 0.6, '3');
      g.ell(12, 14.5, 2.2, 1.2, '1');
      g.r(6, 13, 4, 2, '2');
      g.hl(6, 13, 4, '1');
    }
  },
  fix2: (g, open) => {
    over(g, music.floor, (o) => {
      o.r(1, 1, 14, 14, '1');
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 3; c++) {
          if (open && ((r + c) % 3 === 0)) continue;
          const x = 2 + c * 4;
          const y = 2 + r * 3;
          o.r(x, y, 4, 3, '2');
          o.hl(x + 1, y + 1, 2, '3');
        }
    });
    if (open) {
      g.r(3, 14, 5, 2, '2');
      g.hl(4, 14, 3, '3');
      g.line(9, 13, 13, 15, '3');
    }
  },
};

// =================================================================== GADGETS  [black, light gray, teal]
const gadgets: Theme = {
  colors: [K, C.GRAY_L, C.TEAL],
  floor: (g) => {
    fill(g, '2');
    g.hl(0, 0, 16, '3');
    g.vl(0, 0, 16, '3');
    g.hl(0, 8, 16, '3');
    g.vl(8, 0, 16, '3');
    g.set(3, 3, '1');
    g.set(11, 11, '1');
  },
  wall: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 2, '3');
    g.hl(0, 2, 16, '1');
    g.hl(0, 7, 16, '3');
    for (let x = 1; x < 16; x += 5) g.r(x, 9, 3, 2, '3');
    g.r(0, 13, 16, 3, '1');
    g.hl(0, 13, 16, '3');
  },
  counter: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 3, '3');
    g.hl(0, 3, 16, '1');
    g.r(1, 5, 14, 8, '1');
    g.line(3, 12, 8, 6, '2');
    g.line(9, 12, 13, 7, '2');
    for (let x = 3; x < 14; x += 4) g.set(x, 10, '3');
    g.hl(0, 15, 16, '1');
  },
  decor: (g) => {
    over(g, gadgets.floor, (o) => {
      o.r(4, 11, 8, 4, '2');
      o.hl(4, 11, 8, '3');
      o.ell(8, 6, 4.4, 4.4, '3');
      o.ell(8, 6, 2.6, 4.4, '2');
      o.ell(8, 6, 4.4, 1.6, '2');
      o.r(7, 9, 2, 2, '3');
    });
  },
  decor2: (g) => {
    over(g, gadgets.floor, (o) => {
      o.vl(8, 8, 6, '3');
      o.hl(5, 14, 6, '2');
      o.ell(8, 6, 2.6, 1.6, '2');
      o.set(8, 6, '3');
      o.line(2, 3, 5, 5, '3');
      o.line(14, 3, 11, 5, '3');
      o.line(2, 9, 5, 7, '3');
      o.line(14, 9, 11, 7, '3');
      o.ell(2, 3, 1.2, 0.8, '2');
      o.ell(14, 3, 1.2, 0.8, '2');
      o.ell(2, 9, 1.2, 0.8, '2');
      o.ell(14, 9, 1.2, 0.8, '2');
    });
  },
  fix: (g, open) => {
    over(g, gadgets.floor, (o) => {
      o.r(4, 10, 8, 5, '2');
      o.hl(4, 10, 8, '3');
      o.vl(5, 11, 4, '3');
      if (!open) {
        o.ell(8, 6, 4.4, 4.4, '3');
        o.r(3, 8, 10, 3, '.');
        o.ell(8, 6, 3.4, 3.4, '2');
        o.r(7, 4, 2, 5, '1');
      } else {
        o.r(6, 8, 4, 2, '3');
        o.set(7, 6, '1');
        o.set(9, 7, '1');
      }
    });
    if (open) {
      g.ell(12.5, 13.5, 3.2, 1.6, '3');
      g.hl(10, 14, 6, '2');
    }
  },
  fix2: (g, open) => {
    over(g, gadgets.floor, (o) => {
      o.r(1, 6, 14, 9, '2');
      o.hl(1, 6, 14, '3');
      o.r(2, 7, 12, 4, '1');
      o.hl(2, 12, 12, '3');
      if (!open) {
        o.set(4, 9, '3');
        o.set(7, 8, '3');
        o.r(9, 8, 3, 2, '3');
        o.set(13, 9, '3');
        o.r(2, 7, 12, 1, '3');
      } else {
        o.r(2, 1, 12, 3, '3');
        o.hl(2, 4, 12, '1');
        o.r(2, 7, 12, 4, '1');
        o.line(3, 10, 6, 8, '3');
        o.set(9, 9, '3');
        o.set(11, 8, '3');
        o.set(13, 10, '3');
      }
    });
  },
};

// =================================================================== NOVELTY (black light)  [black, purple, magenta]
const novelty: Theme = {
  colors: [K, C.PURPLE_D, C.MAGENTA_L],
  floor: (g) => {
    fill(g, '1');
    g.hl(0, 0, 16, '2');
    g.vl(0, 0, 16, '2');
    g.hl(0, 8, 16, '2');
    g.vl(8, 0, 16, '2');
    for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) g.set(x, y, '3');
    g.set(4, 12, '2');
    g.set(12, 4, '2');
  },
  wall: (g) => {
    fill(g, '2');
    for (let y = 0; y < 13; y += 4) {
      g.hl(0, y, 16, '1');
      for (let x = (y / 4) % 2 ? 2 : 6; x < 16; x += 8) g.vl(x, y, 4, '1');
    }
    g.hl(0, 6, 16, '3');
    g.hl(0, 7, 16, '1');
    g.set(3, 8, '3');
    g.set(3, 9, '3');
    g.set(11, 8, '3');
    g.r(0, 13, 16, 3, '1');
    g.hl(0, 13, 16, '2');
  },
  counter: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 3, '3');
    g.hl(0, 3, 16, '1');
    g.hl(0, 15, 16, '1');
    for (let x = 1; x < 16; x += 4) g.stamp(x, 7, ['.3.', '333', '.3.']);
    g.hl(0, 12, 16, '1');
  },
  decor: (g) => {
    over(g, novelty.floor, (o) => {
      o.r(5, 12, 6, 3, '2');
      o.hl(4, 11, 8, '2');
      o.ell(8, 6.5, 5, 5, '2');
    });
    g.ell(8, 6.5, 4.2, 4.2, '1');
    for (const [x, y] of [[3, 3], [13, 4], [2, 8], [12, 10], [8, 1], [5, 10]]) g.line(8, 6, x, y, '3');
    g.ell(8, 6.5, 1.3, 1.3, '3');
  },
  decor2: (g) => {
    over(g, novelty.floor, (o) => {
      o.r(4, 1, 8, 14, '2');
      o.hl(3, 5, 10, '2');
      o.hl(3, 10, 10, '2');
    });
    g.hl(5, 2, 2, '3');
    g.hl(9, 2, 2, '3');
    g.r(6, 3, 4, 1, '1');
    g.r(5, 6, 2, 2, '3');
    g.r(9, 6, 2, 2, '3');
    g.set(6, 7, '1');
    g.set(10, 7, '1');
    g.hl(6, 8, 4, '1');
    g.hl(6, 11, 4, '3');
    g.hl(5, 13, 6, '3');
  },
  fix: (g, open) => {
    over(g, novelty.floor, (o) => {
      o.r(1, 3, 14, 12, '2');
      for (let c = 0; c < 3; c++) {
        o.r(2 + c * 4 + (c > 0 ? 1 : 0), 6, 3, 8, '1');
      }
      for (let c = 0; c < 3; c++) {
        const x = 2 + c * 4 + (c > 0 ? 1 : 0);
        if (open && c === 1) continue;
        o.r(x, 3 + (c % 2), 3, 5, c % 2 ? '3' : '2');
        o.set(x + 1, 5, '1');
      }
    });
    if (open) {
      g.line(6, 8, 10, 12, '3', 2);
      g.line(10, 6, 13, 9, '3', 1);
      g.r(5, 11, 4, 2, '2');
      g.set(12, 14, '3');
    }
  },
  fix2: (g, open) => {
    over(g, novelty.floor, (o) => {
      o.r(1, 12, 14, 3, '2');
      o.hl(1, 12, 14, '3');
      const lamp = (x: number, tipped: boolean): void => {
        if (tipped) {
          o.r(x - 3, 13, 8, 2, '1');
          o.r(x - 3, 13, 2, 2, '2');
          o.ell(x + 1, 14, 2, 0.8, '3');
          return;
        }
        o.r(x, 10, 4, 2, '2');
        o.r(x, 2, 4, 8, '1');
        o.hl(x, 1, 4, '2');
        o.ell(x + 2, 8, 1.6, 1.4, '3');
        o.ell(x + 2, 4.5, 1.2, 1.2, '3');
      };
      lamp(2, false);
      lamp(6, open);
      lamp(10, false);
    });
    if (open) {
      g.set(7, 15, '3');
      g.set(8, 15, '3');
    }
  },
};

// =================================================================== GAMES  [black, dark green, neon green]
function invader(g: G, x: number, y: number, c: string): void {
  g.stamp(x, y, ['..3.....3..', '...3...3...', '..3333333..', '.33.333.33.', '33333333333', '3.3333333.3', '3.3.....3.3', '...33.33...']
    .map((r) => r.replace(/3/g, c)));
}
const games: Theme = {
  colors: [K, C.GREEN_D, C.GREEN_L],
  floor: (g) => {
    checker(g, 8, '1', '2');
    g.set(0, 0, '3');
    g.set(8, 8, '3');
    g.set(12, 3, '3');
  },
  wall: (g) => {
    fill(g, '1');
    g.box(0, 0, 16, 13, '2', '1');
    invader(g, 2, 2, '3');
    g.r(0, 13, 16, 3, '2');
    g.hl(0, 13, 16, '3');
  },
  counter: (g) => {
    fill(g, '2');
    g.r(0, 0, 16, 2, '3');
    g.hl(0, 2, 16, '1');
    g.hl(0, 15, 16, '1');
    g.r(2, 6, 4, 6, '1');
    g.r(10, 6, 4, 6, '1');
    g.hl(3, 8, 2, '3');
    g.hl(11, 8, 2, '3');
    g.vl(8, 4, 10, '1');
  },
  decor: (g) => {
    over(g, games.floor, (o) => {
      o.r(3, 1, 10, 14, '2');
      o.r(4, 2, 8, 2, '3');
      o.r(4, 5, 8, 5, '1');
      o.r(4, 11, 8, 2, '3');
      o.set(6, 12, '1');
      o.set(9, 12, '1');
      o.hl(3, 14, 10, '1');
    });
    g.stamp(5, 6, ['3.3.3', '.333.', '3.3.3']);
    g.set(6, 12, '1');
    g.set(6, 11, '1');
  },
  decor2: (g) => {
    over(g, games.floor, (o) => {
      o.r(2, 1, 12, 14, '2');
      o.r(3, 2, 10, 8, '1');
      o.r(4, 11, 5, 3, '1');
      o.set(11, 12, '3');
      o.set(12, 12, '3');
    });
    g.vl(8, 3, 2, '3');
    g.hl(6, 5, 5, '3');
    g.set(6, 6, '3');
    g.set(10, 6, '3');
    g.r(4, 8, 3, 2, '3');
    g.r(9, 8, 3, 2, '3');
    g.set(5, 8, '1');
    g.set(10, 8, '1');
  },
  fix: (g, open) => {
    over(g, games.floor, (o) => {
      o.r(1, 1, 14, 14, '2');
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 4; c++) {
          if (open && (r * 4 + c) % 3 === 1) continue;
          o.r(2 + c * 3 + (c > 1 ? 1 : 0) - (c > 1 ? 1 : 0), 2 + r * 4, 2, 3, '1');
          o.r(2 + c * 3, 3 + r * 4, 2, 2, '3');
        }
    });
    if (open) {
      g.r(4, 14, 3, 2, '3');
      g.r(4, 14, 3, 1, '1');
      g.r(11, 13, 3, 2, '3');
      g.set(12, 14, '1');
    }
  },
  fix2: (g, open) => {
    over(g, games.floor, (o) => {
      o.r(1, 1, 14, 14, '2');
      o.hl(1, 7, 14, '1');
      o.hl(1, 14, 14, '1');
      o.r(2, 2, 5, 5, '3');
      o.r(3, 3, 3, 2, '1');
      o.r(9, 3, 5, 4, '1');
      o.hl(10, 4, 3, '3');
      o.r(2, 10, 6, 3, '1');
      o.r(4, 11, 2, 1, '3');
      o.r(10, 10, 4, 3, '3');
    });
    if (open) {
      g.r(1, 1, 14, 6, '1');
      g.r(3, 2, 5, 3, '3');
      g.r(9, 2, 3, 2, '2');
      g.r(1, 10, 14, 2, '1');
      g.r(3, 13, 5, 2, '3');
      g.hl(8, 14, 6, '3');
    }
  },
};

const THEME_DEFS: Record<string, Theme> = { fashion, electronics, toys, food, sports, music, gadgets, novelty, games };

const themed: SpriteDef[] = [];
for (const [name, t] of Object.entries(THEME_DEFS)) {
  const add = (kind: string, fn: Painter): void => {
    themed.push(mk(`tile_${name}_${kind}`, 16, 16, t.colors, 1, fn));
  };
  add('floor', t.floor);
  add('wall', t.wall);
  add('counter', t.counter);
  add('decor', t.decor);
  add('decor2', t.decor2);
  add('fixture', (g) => t.fix(g, false));
  add('fixture_open', (g) => t.fix(g, true));
  add('fixture2', (g) => t.fix2(g, false));
  add('fixture2_open', (g) => t.fix2(g, true));
}

// =================================================================== unthemed special tiles
const special: SpriteDef[] = [
  // Forever 12 fitting room: curtained booth
  mk('tile_fitting', 16, 16, [K, C.PINK, C.WHITE], 1, (g) => {
    fill(g, '3');
    g.r(0, 0, 16, 3, '1');
    g.hl(0, 3, 16, '2');
    g.r(0, 3, 3, 13, '3');
    g.r(13, 3, 3, 13, '3');
    g.vl(2, 3, 13, '1');
    g.vl(13, 3, 13, '1');
    g.r(3, 4, 10, 10, '2');
    for (let x = 4; x < 13; x += 3) {
      g.vl(x, 4, 10, '1');
      g.vl(x + 1, 5, 8, '3');
    }
    g.r(3, 14, 10, 2, '1');
    g.r(5, 14, 2, 2, '3');
    g.r(9, 14, 2, 2, '3');
    g.hl(0, 0, 16, '2');
  }),
  mk('tile_fitting_open', 16, 16, [K, C.PINK, C.WHITE], 1, (g) => {
    fill(g, '3');
    g.r(0, 0, 16, 3, '1');
    g.hl(0, 3, 16, '2');
    g.r(0, 3, 3, 13, '3');
    g.r(13, 3, 3, 13, '3');
    g.vl(2, 3, 13, '1');
    g.vl(13, 3, 13, '1');
    g.r(3, 4, 10, 12, '1');
    g.r(4, 5, 5, 6, '3');
    g.set(5, 6, '2');
    g.set(6, 7, '2');
    g.r(3, 11, 10, 2, '2');
    g.r(3, 4, 2, 11, '2');
    g.vl(4, 4, 11, '1');
    g.r(10, 8, 3, 3, '2');
    g.hl(0, 0, 16, '2');
  }),
  // KGB Toys shelf
  mk('tile_toyshelf', 16, 16, [K, C.RED, C.ORANGE], 1, (g) => toyshelf(g, true)),
  mk('tile_toyshelf_empty', 16, 16, [K, C.RED, C.ORANGE], 1, (g) => toyshelf(g, false)),
  // Sam Baddy listening booth: floor pad with big headphones, pulsing
  mk('tile_booth', 16, 16, [K, C.PURPLE_D, C.CYAN], 2, (g, f) => {
    fill(g, '1');
    g.ell(8, 8, 7.4, 7.4, '2');
    g.ell(8, 8, 6, 6, '1');
    g.ring(8, 8, 5.4, 4.2, f ? '3' : '2');
    g.r(3, 8, 3, 5, '3');
    g.r(10, 8, 3, 5, '3');
    g.hl(4, 4, 8, '3');
    g.set(3, 5, '3');
    g.set(12, 5, '3');
    g.r(3, 7, 3, 1, '3');
    g.r(4, 9, 1, 3, '1');
    g.r(11, 9, 1, 3, '1');
    g.set(3, 6, '3');
    g.set(12, 6, '3');
    if (f) {
      g.set(1, 3, '3');
      g.set(14, 3, '3');
      g.set(1, 12, '3');
      g.set(14, 12, '3');
    } else {
      g.set(0, 8, '3');
      g.set(15, 8, '3');
    }
  }),
  mk('tile_demotv', 16, 16, [K, C.GRAY_M, C.CYAN], 3, (g, f) => {
    fill(g, '1');
    g.r(1, 1, 14, 11, '2');
    g.hl(1, 1, 14, '3');
    g.r(3, 3, 10, 7, '1');
    if (f === 0) {
      g.r(4, 4, 8, 5, '3');
      g.hl(4, 6, 8, '1');
      g.set(6, 5, '1');
    } else if (f === 1) {
      for (let y = 4; y < 9; y++) for (let x = 4; x < 12; x++) if (hash(x + 3, y * 2) % 3 === 0) g.set(x, y, '3');
    } else {
      g.r(4, 4, 8, 5, '1');
      g.hl(4, 8, 8, '3');
      g.line(5, 5, 10, 7, '3');
    }
    g.set(13, 11, '3');
    g.r(6, 12, 4, 2, '2');
    g.r(3, 14, 10, 2, '2');
    g.hl(3, 14, 10, '3');
  }),
  mk('tile_pedestal', 16, 16, [K, C.GRAY_M, C.ORANGE], 2, (g, f) => {
    fill(g, '1');
    g.ell(8, 12, 6.5, 3.2, '2');
    g.ell(8, 11, 5.2, 2.4, '3');
    g.ell(8, 11, 3.6, 1.5, '1');
    g.hl(3, 12, 10, '2');
    g.r(5, 12, 6, 3, '2');
    g.hl(5, 14, 6, '1');
    if (f) {
      g.vl(8, 1, 5, '3');
      g.vl(5, 4, 4, '3');
      g.vl(11, 4, 4, '3');
      g.set(3, 2, '3');
      g.set(13, 2, '3');
      g.set(8, 0, '3');
    } else {
      g.set(8, 3, '3');
      g.set(8, 5, '3');
      g.set(6, 5, '3');
      g.set(10, 5, '3');
      g.set(4, 3, '3');
      g.set(12, 3, '3');
    }
  }),
  // doorway seen from above, in the bottom wall
  mk('tile_door', 16, 16, [K, C.BROWN_L, C.TAN], 1, (g) => {
    fill(g, '2');
    for (let y = 0; y < 16; y += 4) g.hl(0, y, 16, '1');
    g.r(0, 0, 2, 16, '3');
    g.r(14, 0, 2, 16, '3');
    g.vl(2, 0, 16, '1');
    g.vl(13, 0, 16, '1');
    g.r(3, 11, 10, 5, '1');
    g.hl(3, 10, 10, '3');
    g.r(4, 13, 8, 3, '3');
    g.hl(3, 12, 10, '2');
    g.set(5, 14, '1');
    g.set(10, 14, '1');
  }),
  mk('tile_door_mat', 16, 16, [K, C.RED, C.TAN], 1, (g) => {
    g.r(0, 4, 16, 9, '1');
    g.r(1, 5, 14, 7, '2');
    g.box(2, 6, 12, 5, '3', '2');
    for (let x = 4; x < 12; x += 2) g.set(x, 8, '3');
    for (let x = 3; x < 13; x += 2) g.set(x, 9, '3');
    for (let x = 1; x < 15; x += 2) {
      g.set(x, 13, '2');
      g.set(x, 3, '2');
    }
  }),
];

function toyshelf(g: G, full: boolean): void {
  fill(g, '1');
  for (const y of [5, 10, 15]) {
    g.hl(0, y, 16, '3');
    g.hl(0, y - 1, 16, '2');
  }
  g.vl(0, 0, 16, '2');
  g.vl(15, 0, 16, '2');
  if (!full) {
    g.set(4, 12, '2');
    g.set(11, 7, '2');
    g.set(8, 2, '2');
    return;
  }
  // top shelf: wind-up robot and duck
  g.r(2, 1, 4, 3, '3');
  g.set(3, 2, '1');
  g.set(4, 2, '1');
  g.r(3, 3, 2, 1, '2');
  g.r(9, 2, 3, 2, '2');
  g.r(11, 1, 2, 2, '2');
  g.set(13, 2, '3');
  // middle shelf: rocket and blocks
  g.r(3, 6, 2, 3, '3');
  g.set(3, 5, '.');
  g.r(4, 5, 1, 1, '3');
  g.r(3, 8, 4, 1, '2');
  g.r(9, 6, 3, 3, '2');
  g.r(12, 7, 2, 2, '3');
  // bottom shelf: ball and truck
  g.ell(4.5, 12.5, 2, 2, '3');
  g.r(8, 11, 5, 3, '2');
  g.r(12, 12, 2, 2, '3');
  g.hl(8, 14, 6, '1');
}

export const SPRITES_TILES: SpriteDef[] = [...themed, ...special];
