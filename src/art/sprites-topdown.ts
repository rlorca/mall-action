import { Bitmap, Pal3, defSprite } from './pixel';
import { C } from './palette';
import type { Theme } from '../core/stores-data';
import { THEMES } from '../core/stores-data';

/** Top-down (Zelda-style) store art: 9 themes x (floor, wall, fixture closed/open, counter, decor) + people + props. */

interface ThemeColours {
  floor: Pal3;
  wall: Pal3;
  fix: Pal3;
  counter: Pal3;
  decor: Pal3;
}
const T: Record<Theme, ThemeColours> = {
  fashion: { floor: [C.pink, C.ppink, C.tan], wall: [C.pink, C.magenta, C.white], fix: [C.pink, C.lblue, C.dgrey], counter: [C.white, C.lgrey, C.pink], decor: [C.tan, C.pink, C.dgrey] },
  electronics: { floor: [C.dgrey, C.grey, C.black], wall: [C.lgrey, C.dgrey, C.black], fix: [C.lgrey, C.dgrey, C.lgreen], counter: [C.grey, C.dgrey, C.lgrey], decor: [C.lgrey, C.black, C.lgreen] },
  toys: { floor: [C.lblue, C.yellow, C.red], wall: [C.red, C.yellow, C.white], fix: [C.brown, C.red, C.yellow], counter: [C.yellow, C.brown, C.white], decor: [C.red, C.yellow, C.lblue] },
  food: { floor: [C.red, C.white, C.dred], wall: [C.yellow, C.orange, C.red], fix: [C.lgrey, C.white, C.red], counter: [C.white, C.lgrey, C.red], decor: [C.orange, C.yellow, C.red] },
  sports: { floor: [C.tan, C.orange, C.brown], wall: [C.blue, C.white, C.red], fix: [C.lgrey, C.blue, C.red], counter: [C.brown, C.tan, C.dbrown], decor: [C.orange, C.black, C.white] },
  music: { floor: [C.navy, C.dpurple, C.black], wall: [C.dpurple, C.magenta, C.black], fix: [C.black, C.red, C.white], counter: [C.dgrey, C.black, C.red], decor: [C.black, C.lgrey, C.red] },
  gadgets: { floor: [C.dblue, C.navy, C.cyan], wall: [C.lgrey, C.cyan, C.dblue], fix: [C.dgrey, C.cyan, C.white], counter: [C.lgrey, C.dgrey, C.cyan], decor: [C.lgrey, C.cyan, C.dblue] },
  novelty: { floor: [C.black, C.dpurple, C.magenta], wall: [C.dpurple, C.lpurple, C.pink], fix: [C.dpurple, C.pink, C.lgreen], counter: [C.black, C.lpurple, C.lgreen], decor: [C.dpurple, C.lgreen, C.pink] },
  games: { floor: [C.navy, C.purple, C.cyan], wall: [C.dgrey, C.red, C.white], fix: [C.dgrey, C.lgrey, C.lgreen], counter: [C.dgrey, C.red, C.white], decor: [C.dgrey, C.lgreen, C.red] },
};

function floorTile(theme: Theme, b: Bitmap): void {
  b.rect(0, 0, 16, 16, 1);
  switch (theme) {
    case 'fashion':
    case 'food':
      for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) if ((x + y) % 16 === 0) b.rect(x, y, 8, 8, 2);
      break;
    case 'electronics':
      b.hline(0, 0, 16, 2);
      b.vline(0, 0, 16, 2);
      b.px(8, 8, 2);
      break;
    case 'toys':
      b.rect(0, 0, 8, 8, 2);
      b.rect(8, 8, 8, 8, 3);
      b.px(12, 3, 1);
      break;
    case 'sports':
      for (let x = 0; x < 16; x += 4) b.vline(x, 0, 16, 3);
      b.hline(0, 7, 16, 2);
      b.hline(0, 15, 16, 2);
      break;
    case 'music':
      for (let y = 0; y < 16; y += 4) b.hline(0, y, 16, 2);
      b.px(3, 2, 3);
      break;
    case 'gadgets':
      b.hline(0, 0, 16, 2);
      b.vline(0, 0, 16, 2);
      b.px(8, 8, 3);
      break;
    case 'novelty':
      b.hline(0, 7, 16, 2);
      b.vline(7, 0, 16, 2);
      b.px(3, 3, 3);
      b.px(12, 11, 3);
      b.px(12, 2, 2);
      break;
    case 'games':
      b.rect(4, 4, 2, 2, 2);
      b.rect(11, 10, 2, 2, 2);
      b.px(10, 3, 3);
      b.px(3, 12, 3);
      break;
  }
}

function wallTile(theme: Theme, b: Bitmap): void {
  b.rect(0, 0, 16, 16, 1);
  b.rect(0, 0, 16, 3, 3); // top light edge
  b.rect(0, 13, 16, 3, 2); // baseboard shadow
  switch (theme) {
    case 'toys':
    case 'food':
      for (let x = 0; x < 16; x += 4) b.vline(x, 3, 10, 2);
      break;
    case 'sports':
      b.hline(0, 7, 16, 3);
      break;
    case 'gadgets':
    case 'electronics':
      b.rect(2, 5, 12, 6, 2);
      b.px(4, 7, 3);
      b.px(7, 7, 1);
      break;
    case 'music':
      b.hline(0, 6, 16, 2);
      b.px(5, 9, 3);
      b.px(10, 8, 3);
      break;
    case 'novelty':
      b.px(3, 6, 3);
      b.px(10, 9, 2);
      b.hline(2, 8, 5, 2);
      break;
    case 'games':
      b.rect(5, 5, 6, 6, 2);
      b.rect(6, 6, 4, 4, 1);
      break;
    default:
      b.hline(0, 7, 16, 2);
  }
}

function fixtureTile(theme: Theme, open: boolean, b: Bitmap): void {
  // base cabinet (everything is 16x16; the top 2 rows are the "lid")
  const base = () => {
    b.rect(1, 2, 14, 13, 1);
    b.box(1, 2, 14, 13, 3);
    b.rect(1, 14, 14, 2, 3);
  };
  switch (theme) {
    case 'fashion': // clothes rack
      b.hline(1, 3, 14, 3);
      b.vline(1, 3, 12, 3);
      b.vline(14, 3, 12, 3);
      for (let i = 0; i < 5; i++) {
        const x = 3 + i * 2;
        b.rect(x, 4, 2, open ? 4 + (i % 2) : 9, i % 2 ? 1 : 2);
      }
      if (open) b.rect(6, 9, 4, 5, 0);
      b.rect(1, 14, 14, 1, 3);
      break;
    case 'electronics':
      base();
      for (let y = 4; y < 12; y += 4) {
        b.rect(3, y, 10, 3, 2);
        b.px(11, y + 1, 3);
        b.px(4 + (open ? 2 : 0), y + 1, 3);
      }
      if (open) b.rect(3, 4, 10, 3, 3);
      break;
    case 'toys':
      base();
      b.rect(3, 4, 4, 4, 2);
      b.rect(9, 4, 4, 4, 3);
      b.rect(5, 9, 6, 4, 2);
      if (open) {
        b.rect(3, 4, 10, 9, 1);
        b.px(5, 6, 3);
      }
      break;
    case 'food':
      base();
      b.rect(3, 4, 10, 6, 2);
      b.rect(6, 5, 4, 4, 3);
      b.hline(3, 11, 10, 2);
      if (open) {
        b.rect(3, 3, 10, 3, 1);
        b.rect(3, 6, 10, 4, 3);
      }
      break;
    case 'sports':
      base();
      b.vline(8, 3, 11, 3);
      b.px(6, 8, 2);
      b.px(10, 8, 2);
      b.rect(3, 4, 3, 2, 2);
      b.rect(10, 4, 3, 2, 3);
      if (open) {
        b.rect(2, 3, 6, 11, 3);
        b.vline(8, 3, 11, 1);
      }
      break;
    case 'music':
      base();
      for (let i = 0; i < 6; i++) b.rect(3 + i * 2, open ? 6 : 4, 1, 8, i % 2 ? 2 : 3);
      if (open) {
        b.rect(3, 3, 10, 3, 2);
        b.rect(5, 4, 6, 1, 3);
      }
      break;
    case 'gadgets':
      b.rect(3, 9, 10, 6, 1);
      b.box(3, 9, 10, 6, 3);
      if (!open) {
        b.oval(8, 6, 3, 3, 2);
        b.px(7, 5, 3);
      } else b.rect(5, 11, 6, 2, 2);
      break;
    case 'novelty':
      base();
      b.oval(8, 7, 3, 4, 2);
      b.px(7, 5, 3);
      b.hline(4, 12, 8, 3);
      if (open) b.rect(5, 4, 6, 8, 1);
      break;
    case 'games':
      base();
      for (let i = 0; i < 4; i++) {
        b.rect(3 + i * 3, 4, 2, 8, 2);
        b.px(3 + i * 3, 5, 3);
      }
      if (open) b.rect(6, 4, 2, 8, 1);
      break;
  }
  if (open) {
    // searched fixtures look rummaged: a darker rim
    b.hline(1, 15, 14, 3);
  }
}

function counterTile(theme: Theme, b: Bitmap): void {
  b.rect(0, 3, 16, 12, 1);
  b.hline(0, 3, 16, 3);
  b.rect(0, 11, 16, 4, 2);
  b.hline(0, 14, 16, 3);
  b.px(3, 7, 3);
  b.px(11, 6, 2);
  if (theme === 'food') b.rect(5, 5, 6, 3, 3);
  if (theme === 'electronics') b.rect(5, 4, 6, 4, 3);
}

function decorTile(theme: Theme, b: Bitmap): void {
  switch (theme) {
    case 'fashion': // mannequin
      b.oval(8, 4, 2, 2, 1);
      b.rect(5, 7, 6, 6, 2);
      b.vline(8, 13, 2, 3);
      b.rect(5, 15, 6, 1, 3);
      break;
    case 'sports': // trophy / bench ball
      b.oval(8, 7, 5, 5, 1);
      b.hline(3, 7, 10, 2);
      b.vline(8, 2, 11, 2);
      break;
    default: // potted plant / generic pillar
      b.rect(4, 10, 8, 5, 3);
      b.oval(8, 6, 5, 5, 2);
      b.oval(6, 5, 2, 2, 1);
      b.px(10, 8, 1);
  }
}

for (const theme of THEMES) {
  const tc = T[theme];
  defSprite(`td.${theme}.floor`, 16, 16, tc.floor, (b) => floorTile(theme, b));
  defSprite(`td.${theme}.wall`, 16, 16, tc.wall, (b) => wallTile(theme, b));
  defSprite(`td.${theme}.fixture`, 16, 16, tc.fix, (b) => fixtureTile(theme, false, b));
  defSprite(`td.${theme}.fixture.open`, 16, 16, tc.fix, (b) => fixtureTile(theme, true, b));
  defSprite(`td.${theme}.counter`, 16, 16, tc.counter, (b) => counterTile(theme, b));
  defSprite(`td.${theme}.decor`, 16, 16, tc.decor, (b) => decorTile(theme, b));
}

// ---------------------------------------------------------------- special props
defSprite('td.fitting', 16, 16, [C.pink, C.dgrey, C.white], (b) => {
  b.rect(0, 1, 16, 15, 2);
  b.rect(1, 2, 14, 13, 1);
  for (let x = 2; x < 15; x += 3) b.vline(x, 3, 12, 3);
  b.rect(0, 0, 16, 2, 3);
});
defSprite('td.fitting.open', 16, 16, [C.pink, C.dgrey, C.white], (b) => {
  b.rect(0, 1, 16, 15, 2);
  b.rect(4, 3, 8, 12, 3);
  b.rect(5, 4, 6, 6, 2);
  b.rect(0, 2, 4, 13, 1);
  b.rect(12, 2, 4, 13, 1);
  b.rect(0, 0, 16, 2, 3);
});
defSprite('td.toyshelf', 16, 16, [C.brown, C.red, C.yellow], (b) => {
  b.rect(0, 1, 16, 15, 1);
  b.box(0, 1, 16, 15, 2);
  b.hline(1, 8, 14, 2);
  // plush and blocks
  b.rect(2, 3, 4, 4, 2);
  b.rect(8, 4, 3, 3, 3);
  b.oval(13, 5, 1, 2, 2);
  b.rect(3, 10, 3, 4, 3);
  b.rect(8, 10, 5, 4, 2);
});
defSprite('td.toyshelf.open', 16, 16, [C.brown, C.red, C.yellow], (b) => {
  b.rect(0, 1, 16, 15, 1);
  b.box(0, 1, 16, 15, 2);
  b.hline(1, 8, 14, 2);
  b.px(4, 6, 3);
  b.px(11, 12, 2);
});
defSprite('td.booth', 16, 16, [C.dpurple, C.magenta, C.black], (b) => {
  b.rect(0, 0, 16, 16, 1);
  b.box(1, 1, 14, 14, 2);
  // headphones icon
  b.hline(4, 4, 8, 2);
  b.vline(4, 4, 6, 2);
  b.vline(11, 4, 6, 2);
  b.rect(3, 9, 3, 4, 3);
  b.rect(10, 9, 3, 4, 3);
});
defSprite(
  'td.tv',
  16,
  16,
  [C.dgrey, C.lgrey, C.pcyan],
  (b, f) => {
    b.rect(1, 2, 14, 11, 1);
    b.box(1, 2, 14, 11, 2);
    b.rect(3, 4, 10, 7, f ? 3 : 2);
    if (f) b.hline(3, 7, 10, 1);
    b.rect(5, 13, 6, 2, 1);
  },
  2,
);
defSprite(
  'td.clerk',
  16,
  16,
  [C.dgrey, C.lgrey, C.skin],
  (b, f) => {
    // the old man in the cave: hooded robe, white beard, holding the item hand out
    b.rect(3, 2, 10, 14, 1);
    b.rect(5, 1, 6, 2, 1);
    b.rect(5, 3, 6, 4, 3);
    b.rect(5, 6, 6, 3, 2);
    b.px(6, 4, 1);
    b.px(9, 4, 1);
    b.rect(6, 9, 4, 1, 1);
    b.rect(2 - f, 8, 2, 4, 1);
    b.rect(12 + f, 8, 2, 4, 1);
  },
  2,
);
defSprite('td.pedestal', 16, 16, [C.lgrey, C.dgrey, C.white], (b) => {
  b.rect(3, 8, 10, 6, 1);
  b.hline(3, 8, 10, 3);
  b.hline(2, 14, 12, 2);
  b.rect(5, 5, 6, 3, 2);
});
defSprite('td.doormat', 16, 16, [C.brown, C.dbrown, C.tan], (b) => {
  b.rect(0, 0, 16, 16, 2);
  b.rect(2, 3, 12, 11, 1);
  b.hline(2, 8, 12, 3);
  b.px(1, 1, 3);
  b.px(14, 1, 3);
});
defSprite('td.exit', 16, 16, [C.green, C.black, C.white], (b) => {
  b.rect(0, 0, 16, 16, 2);
  b.rows(3, 4, ['..11....', '..111...', '1111111.', '..111...', '..11....']);
  b.hline(3, 11, 9, 3);
});

// ---------------------------------------------------------------- people (16 x 16)
interface TdStyle {
  coat: number;
  dark: number;
  skin: number;
  accent: number;
  hat?: boolean;
}
function tdPerson(b: Bitmap, dir: 'up' | 'down' | 'left' | 'right', f: number, s: TdStyle): void {
  const step = f % 2;
  // legs
  if (dir === 'left' || dir === 'right') {
    b.rect(5 + step, 13, 3, 3, s.dark);
    b.rect(8 - step, 13, 3, 3, s.dark);
  } else {
    b.rect(5, 13, 2, 3 - step * 0, s.dark);
    b.rect(9, 13, 2, 3, s.dark);
    if (step) b.rect(5, 15, 2, 1, 0);
    else b.rect(9, 15, 2, 1, 0);
  }
  // body
  b.rect(4, 7, 8, 7, s.coat);
  b.hline(3, 8, 10, s.coat);
  if (dir === 'down') {
    b.vline(8, 8, 6, s.dark);
    b.rect(7, 7, 2, 2, s.accent);
  } else if (dir === 'up') {
    b.hline(4, 11, 8, s.dark);
  } else b.hline(4, 11, 8, s.dark);
  // head
  b.oval(8, 4, 3, 3, s.skin);
  if (dir === 'up') {
    b.oval(8, 4, 3, 3, s.dark);
  } else if (dir === 'down') {
    b.rect(5, 1, 6, 2, s.dark);
    b.px(6, 4, s.dark);
    b.px(10, 4, s.dark);
  } else {
    const fx = dir === 'right' ? 1 : -1;
    b.rect(5, 1, 6, 2, s.dark);
    b.rect(dir === 'right' ? 4 : 9, 2, 3, 4, s.dark);
    b.px(8 + fx * 2, 4, s.dark);
  }
  if (s.hat) {
    b.rect(3, 2, 10, 1, s.dark);
    b.rect(5, 0, 6, 2, s.dark);
    if (dir === 'down') b.rect(5, 4, 6, 1, s.dark);
  }
}
const DIRS = ['up', 'down', 'left', 'right'] as const;
for (const d of DIRS) {
  defSprite(`td.agent.${d}`, 16, 16, [C.red, C.black, C.skin], (b, f) => tdPerson(b, d, f, { coat: 1, dark: 2, skin: 3, accent: 2 }), 2);
  defSprite(`td.spy.${d}`, 16, 16, [C.black, C.white, C.skin], (b, f) => tdPerson(b, d, f, { coat: 1, dark: 1, skin: 3, accent: 2, hat: true }), 2);
}
defSprite('td.agent.hold', 16, 16, [C.red, C.black, C.skin], (b) => {
  tdPerson(b, 'down', 0, { coat: 1, dark: 2, skin: 3, accent: 2 });
  b.rect(1, 3, 2, 6, 1);
  b.rect(13, 3, 2, 6, 1);
  b.px(1, 2, 3);
  b.px(14, 2, 3);
});
defSprite('td.agent.dead', 16, 16, [C.red, C.black, C.skin], (b) => {
  b.rect(1, 8, 4, 5, 3);
  b.rect(0, 7, 5, 2, 2);
  b.rect(5, 8, 8, 5, 1);
  b.rect(13, 9, 3, 4, 2);
  b.px(2, 10, 2);
});
defSprite('td.spy.dead', 16, 16, [C.black, C.white, C.skin], (b) => {
  b.rect(1, 8, 4, 5, 3);
  b.rect(0, 6, 5, 2, 1);
  b.rect(5, 8, 8, 5, 1);
  b.rect(13, 9, 3, 4, 1);
});
defSprite(
  'td.bot',
  16,
  16,
  [C.lgrey, C.red, C.dgrey],
  (b, f) => {
    b.rect(3, 3, 10, 9, 1);
    b.box(3, 3, 10, 9, 3);
    b.rect(5, 5, 6, 3, 3);
    b.rect(f ? 6 : 8, 6, 2, 1, 2);
    b.rect(7, 1, 2, 2, 3);
    b.px(8, 0, 2);
    b.rect(2, 12, 4, 3, 3);
    b.rect(10, 12, 4, 3, 3);
    b.px(f ? 3 : 4, 13, 1);
    b.px(f ? 11 : 12, 13, 1);
    b.rect(1, 6, 2, 4, 3);
    b.rect(13, 6, 2, 4, 3);
  },
  2,
);
defSprite(
  'td.toy',
  16,
  16,
  [C.red, C.yellow, C.black],
  (b, f) => {
    b.rect(5, 4, 6, 6, 1);
    b.rect(6, 2, 4, 3, 1);
    b.px(7, 3, 3);
    b.px(9, 3, 3);
    b.rect(5 - f, 10, 2, 3, 3);
    b.rect(9 + f, 10, 2, 3, 3);
    b.rect(11, 6, 3, 1, 2); // wind-up key
    b.rect(13, 4 + f * 2, 1, 5, 2);
    b.rect(5, 6, 6, 1, 2);
  },
  2,
);
defSprite('td.shoe', 8, 8, [C.white, C.red, C.black], (b) => {
  b.rect(0, 2, 4, 3, 1);
  b.rect(3, 4, 5, 2, 1);
  b.rect(0, 6, 8, 1, 3);
  b.px(1, 3, 2);
});
defSprite('td.bullet.p', 4, 4, [C.yellow, C.white, C.orange], (b) => {
  b.rect(0, 1, 4, 2, 1);
  b.px(1, 0, 2);
  b.px(2, 3, 2);
});
defSprite('td.bullet.e', 4, 4, [C.lred, C.white, C.red], (b) => {
  b.rect(0, 1, 4, 2, 1);
  b.px(1, 0, 2);
  b.px(2, 3, 2);
});
