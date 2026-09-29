import type { RoomTheme } from '../core/storeDefs';
import { C } from './palette';
import { blank, disc, frame, hline, px, rect, ring, vline, type ColorTriple, type Sprite } from './pixels';

/**
 * Store room tiles, 16x16, one set per visual theme.
 *
 * Every theme provides: floor, wall, fixture (closed), fixture (opened /
 * rummaged), counter and decor. Generated from source like everything else.
 */

export interface ThemeTiles {
  floor: Sprite;
  wall: Sprite;
  fixture: Sprite;
  fixtureOpen: Sprite;
  counter: Sprite;
  decor: Sprite;
  /** Wall colour used for the room border shading. */
  accent: number;
}

const T = 16;
const t = (colors: ColorTriple): Sprite => blank(T, T, colors);

/** A checker/speckle floor, common shape with per-theme colours. */
function floorTile(colors: ColorTriple, style: 'checker' | 'speckle' | 'stripe' | 'carpet'): Sprite {
  const s = t(colors);
  rect(s, 0, 0, T, T, 1);
  switch (style) {
    case 'checker':
      rect(s, 0, 0, 8, 8, 2);
      rect(s, 8, 8, 8, 8, 2);
      break;
    case 'speckle':
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) if ((x * 5 + y * 11) % 7 === 0) px(s, x, y, 2);
      }
      break;
    case 'stripe':
      for (let x = 0; x < T; x += 4) vline(s, x, 0, T, 2);
      break;
    case 'carpet':
      for (let y = 0; y < T; y += 2) hline(s, 0, y, T, 2);
      for (let y = 1; y < T; y += 4) hline(s, 0, y, T, 3);
      break;
  }
  return s;
}

function wallTile(colors: ColorTriple, brick: boolean): Sprite {
  const s = t(colors);
  rect(s, 0, 0, T, T, 1);
  if (brick) {
    for (let y = 0; y < T; y += 4) {
      hline(s, 0, y, T, 2);
      vline(s, (y / 4) % 2 === 0 ? 4 : 12, y, 4, 2);
    }
  } else {
    hline(s, 0, 0, T, 2);
    hline(s, 0, T - 1, T, 3);
    for (let y = 2; y < T - 1; y += 3) hline(s, 1, y, T - 2, 3);
  }
  return s;
}

function counterTile(colors: ColorTriple): Sprite {
  const s = t(colors);
  rect(s, 0, 2, T, 12, 1);
  hline(s, 0, 2, T, 2);
  hline(s, 0, 3, T, 2);
  rect(s, 2, 6, 5, 5, 3);
  rect(s, 9, 6, 5, 5, 3);
  hline(s, 0, 13, T, 3);
  return s;
}

/** Shelf-style fixture: closed then rummaged. */
function shelf(colors: ColorTriple, goods: (s: Sprite) => void, open: boolean): Sprite {
  const s = t(colors);
  rect(s, 0, 1, T, 14, 1);
  frame(s, 0, 1, T, 14, 2);
  if (open) {
    // Rummaged: doors hanging, goods gone, a dark empty interior.
    rect(s, 2, 3, 12, 10, 3);
    for (let y = 4; y < 13; y += 3) hline(s, 2, y, 12, 2);
    px(s, 3, 12, 2);
    px(s, 12, 4, 2);
  } else {
    goods(s);
  }
  return s;
}

function makeTheme(theme: RoomTheme): ThemeTiles {
  switch (theme) {
    case 'fashion': {
      const fx: ColorTriple = [C.MAGENTA, C.PALEPINK, C.PURPLE];
      return {
        floor: floorTile([C.PALEPINK, C.WHITE, C.PINK], 'checker'),
        wall: wallTile([C.PURPLE, C.MAGENTA, C.VIOLET], false),
        fixture: shelf(fx, (s) => {
          // A rail of hanging clothes.
          hline(s, 2, 4, 12, 3);
          for (let i = 0; i < 4; i++) rect(s, 2 + i * 3, 5, 2, 7, i % 2 ? 2 : 3);
        }, false),
        fixtureOpen: shelf(fx, () => {}, true),
        counter: counterTile([C.PURPLE, C.PALEPINK, C.MAGENTA]),
        decor: (() => {
          const s = t([C.TAN, C.MAGENTA, C.PURPLE]);
          disc(s, 8, 4, 2, 1);
          rect(s, 5, 6, 7, 6, 2);
          rect(s, 6, 12, 5, 3, 1);
          hline(s, 4, 15, 9, 3);
          return s;
        })(),
        accent: C.MAGENTA,
      };
    }
    case 'electronics': {
      const fx: ColorTriple = [C.GREY, C.LIGHTGREY, C.DARKGREY];
      return {
        floor: floorTile([C.GREY, C.LIGHTGREY, C.WHITE], 'checker'),
        wall: wallTile([C.DARKBLUE, C.BLUE, C.INDIGO], false),
        fixture: shelf(fx, (s) => {
          for (let i = 0; i < 2; i++) {
            rect(s, 2, 3 + i * 6, 12, 5, 3);
            rect(s, 3, 4 + i * 6, 10, 3, 2);
          }
        }, false),
        fixtureOpen: shelf(fx, () => {}, true),
        counter: counterTile([C.DARKGREY, C.LIGHTGREY, C.CYAN]),
        decor: (() => {
          const s = t([C.DARKGREY, C.CYAN, C.LIGHTGREY]);
          rect(s, 1, 2, 14, 11, 1);
          rect(s, 3, 4, 10, 7, 2);
          for (let y = 4; y < 11; y += 2) hline(s, 3, y, 10, 3);
          rect(s, 5, 13, 6, 3, 3);
          return s;
        })(),
        accent: C.BLUE,
      };
    }
    case 'toys': {
      const fx: ColorTriple = [C.RED, C.PALEYELLOW, C.BLUE];
      return {
        floor: floorTile([C.PALEYELLOW, C.WHITE, C.YELLOW], 'checker'),
        wall: wallTile([C.RED, C.SALMON, C.PALERED], true),
        fixture: shelf(fx, (s) => {
          for (let i = 0; i < 3; i++) {
            disc(s, 4 + (i % 2) * 7, 5 + i * 3, 2, i % 2 ? 2 : 3);
          }
          hline(s, 2, 8, 12, 2);
        }, false),
        fixtureOpen: shelf(fx, () => {}, true),
        counter: counterTile([C.BLUE, C.PALEBLUE, C.YELLOW]),
        decor: (() => {
          const s = t([C.BROWN, C.TAN, C.BLACK]);
          disc(s, 8, 9, 5, 2);
          disc(s, 8, 4, 3, 2);
          disc(s, 4, 2, 2, 1);
          disc(s, 12, 2, 2, 1);
          px(s, 7, 4, 3);
          px(s, 10, 4, 3);
          return s;
        })(),
        accent: C.RED,
      };
    }
    case 'foodcourt': {
      const fx: ColorTriple = [C.LIGHTORANGE, C.PALEYELLOW, C.RED];
      return {
        floor: floorTile([C.TAN, C.PALEYELLOW, C.BROWN], 'checker'),
        wall: wallTile([C.RED, C.SALMON, C.PALEYELLOW], true),
        fixture: shelf(fx, (s) => {
          // A warming cabinet of corn dogs.
          rect(s, 2, 3, 12, 9, 3);
          for (let i = 0; i < 3; i++) rect(s, 3 + i * 4, 5, 2, 6, 2);
        }, false),
        fixtureOpen: shelf(fx, () => {}, true),
        counter: counterTile([C.RED, C.PALEYELLOW, C.WHITE]),
        decor: (() => {
          const s = t([C.WHITE, C.PALEYELLOW, C.OLIVE]);
          rect(s, 3, 4, 10, 10, 1);
          rect(s, 4, 6, 8, 7, 2);
          disc(s, 6, 9, 1, 3);
          disc(s, 10, 11, 1, 3);
          hline(s, 2, 3, 12, 3);
          return s;
        })(),
        accent: C.RED,
      };
    }
    case 'sports': {
      const fx: ColorTriple = [C.WHITE, C.RED, C.BLUE];
      return {
        floor: floorTile([C.BROWN, C.TAN, C.DARKBROWN], 'stripe'),
        wall: wallTile([C.FOREST, C.GREEN, C.LIGHTGREEN], false),
        fixture: shelf(fx, (s) => {
          for (let i = 0; i < 3; i++) {
            rect(s, 2, 3 + i * 4, 12, 3, i % 2 ? 2 : 3);
            hline(s, 2, 6 + i * 4, 12, 1);
          }
        }, false),
        fixtureOpen: shelf(fx, () => {}, true),
        counter: counterTile([C.FOREST, C.LIGHTGREEN, C.WHITE]),
        decor: (() => {
          const s = t([C.BLACK, C.ORANGE, C.WHITE]);
          disc(s, 8, 8, 6, 2);
          ring(s, 8, 8, 6, 1);
          vline(s, 8, 2, 13, 1);
          hline(s, 2, 8, 13, 1);
          return s;
        })(),
        accent: C.GREEN,
      };
    }
    case 'music': {
      const fx: ColorTriple = [C.BLACK, C.LIGHTGREY, C.ORANGE];
      return {
        floor: floorTile([C.DARKGREY, C.GREY, C.BLACK], 'checker'),
        wall: wallTile([C.INDIGO, C.PURPLE, C.VIOLET], false),
        fixture: shelf(fx, (s) => {
          // A crate of records, seen edge-on.
          for (let i = 0; i < 6; i++) vline(s, 3 + i * 2, 3, 9, i % 2 ? 2 : 3);
          hline(s, 2, 12, 12, 2);
        }, false),
        fixtureOpen: shelf(fx, () => {}, true),
        counter: counterTile([C.INDIGO, C.LIGHTGREY, C.ORANGE]),
        decor: (() => {
          const s = t([C.BLACK, C.LIGHTGREY, C.ORANGE]);
          disc(s, 8, 8, 6, 1);
          ring(s, 8, 8, 6, 2);
          ring(s, 8, 8, 4, 2);
          disc(s, 8, 8, 2, 3);
          return s;
        })(),
        accent: C.PURPLE,
      };
    }
    case 'gadgets': {
      const fx: ColorTriple = [C.DARKGREY, C.LIGHTGREY, C.CYAN];
      return {
        floor: floorTile([C.LIGHTGREY, C.WHITE, C.GREY], 'speckle'),
        wall: wallTile([C.DARKTEAL, C.TEAL, C.CYAN], false),
        fixture: shelf(fx, (s) => {
          disc(s, 8, 7, 3, 3);
          ring(s, 8, 7, 4, 2);
          hline(s, 2, 12, 12, 2);
        }, false),
        fixtureOpen: shelf(fx, () => {}, true),
        counter: counterTile([C.DARKTEAL, C.LIGHTGREY, C.CYAN]),
        decor: (() => {
          const s = t([C.DARKGREY, C.LIGHTGREY, C.CYAN]);
          rect(s, 3, 5, 10, 9, 2);
          rect(s, 2, 3, 12, 3, 1);
          disc(s, 8, 9, 2, 3);
          return s;
        })(),
        accent: C.TEAL,
      };
    }
    case 'novelty': {
      // Black-light: deep purple room, glowing fixtures.
      const fx: ColorTriple = [C.PURPLE, C.MAGENTA, C.LIGHTGREEN];
      return {
        floor: floorTile([C.NAVY, C.INDIGO, C.PURPLE], 'carpet'),
        wall: wallTile([C.BLACK, C.PURPLE, C.MAGENTA], false),
        fixture: shelf(fx, (s) => {
          for (let i = 0; i < 3; i++) {
            disc(s, 4 + i * 4, 5 + (i % 2) * 4, 2, 3);
          }
          hline(s, 2, 11, 12, 2);
        }, false),
        fixtureOpen: shelf(fx, () => {}, true),
        counter: counterTile([C.BLACK, C.MAGENTA, C.LIGHTGREEN]),
        decor: (() => {
          const s = t([C.PURPLE, C.LIGHTORANGE, C.MAGENTA]);
          rect(s, 6, 13, 4, 3, 1);
          for (let y = 3; y < 13; y++) {
            const w = 6 - Math.abs(y - 8) / 2;
            rect(s, 8 - w / 2, y, w, 1, 3);
          }
          disc(s, 8, 7, 2, 2);
          return s;
        })(),
        accent: C.PURPLE,
      };
    }
    case 'games': {
      const fx: ColorTriple = [C.DARKGREY, C.LIGHTGREEN, C.RED];
      return {
        floor: floorTile([C.DARKGREY, C.GREY, C.LIGHTGREY], 'checker'),
        wall: wallTile([C.DARKGREEN, C.GREEN, C.LIGHTGREEN], false),
        fixture: shelf(fx, (s) => {
          for (let i = 0; i < 4; i++) {
            rect(s, 2 + (i % 2) * 7, 3 + Math.floor(i / 2) * 5, 5, 4, i % 2 ? 2 : 3);
          }
        }, false),
        fixtureOpen: shelf(fx, () => {}, true),
        counter: counterTile([C.DARKGREEN, C.LIGHTGREEN, C.WHITE]),
        decor: (() => {
          const s = t([C.DARKGREY, C.PALECYAN, C.LIGHTGREY]);
          rect(s, 1, 2, 14, 11, 3);
          rect(s, 3, 4, 10, 7, 2);
          for (let y = 4; y < 11; y += 2) hline(s, 3, y, 10, 1);
          rect(s, 5, 13, 6, 3, 1);
          return s;
        })(),
        accent: C.GREEN,
      };
    }
  }
}

const CACHE = new Map<RoomTheme, ThemeTiles>();

export function themeTiles(theme: RoomTheme): ThemeTiles {
  let v = CACHE.get(theme);
  if (!v) {
    v = makeTheme(theme);
    CACHE.set(theme, v);
  }
  return v;
}

export const ALL_THEMES: readonly RoomTheme[] = [
  'fashion', 'electronics', 'toys', 'foodcourt', 'sports', 'music', 'gadgets', 'novelty', 'games',
];

/** Special tiles shared by every theme. */
export const SPECIAL_TILES = {
  door: (() => {
    const s = t([C.DARKBROWN, C.BROWN, C.BLACK]);
    rect(s, 0, 0, T, T, 3);
    rect(s, 1, 0, 14, 13, 1);
    rect(s, 2, 1, 12, 11, 2);
    hline(s, 0, 14, T, 1);
    return s;
  })(),
  booth: (() => {
    const s = t([C.INDIGO, C.CYAN, C.WHITE]);
    rect(s, 0, 0, T, T, 1);
    frame(s, 1, 1, 14, 14, 2);
    // Headphones.
    ring(s, 8, 9, 4, 3);
    rect(s, 3, 6, 2, 5, 3);
    rect(s, 11, 6, 2, 5, 3);
    hline(s, 4, 5, 8, 3);
    return s;
  })(),
  pedestal: (() => {
    const s = t([C.DARKGREY, C.GREY, C.PALEYELLOW]);
    rect(s, 0, 0, T, T, 1);
    rect(s, 3, 5, 10, 9, 2);
    rect(s, 2, 3, 12, 3, 3);
    return s;
  })(),
  fitting: (() => {
    const s = t([C.PURPLE, C.MAGENTA, C.PALEPINK]);
    rect(s, 0, 0, T, T, 1);
    frame(s, 0, 0, T, 15, 3);
    // A closed curtain.
    for (let x = 2; x < 15; x += 3) vline(s, x, 2, 12, 2);
    hline(s, 1, 1, 14, 3);
    return s;
  })(),
  fittingOpen: (() => {
    const s = t([C.PURPLE, C.BLACK, C.PALEPINK]);
    rect(s, 0, 0, T, T, 1);
    frame(s, 0, 0, T, 15, 3);
    rect(s, 4, 2, 8, 12, 2);
    vline(s, 2, 2, 12, 3);
    vline(s, 13, 2, 12, 3);
    return s;
  })(),
  toyShelf: (() => {
    const s = t([C.RED, C.PALEYELLOW, C.BLUE]);
    rect(s, 0, 1, T, 14, 1);
    frame(s, 0, 1, T, 14, 2);
    for (let i = 0; i < 4; i++) {
      rect(s, 2 + (i % 2) * 7, 3 + Math.floor(i / 2) * 5, 5, 4, i % 2 ? 2 : 3);
    }
    return s;
  })(),
  toyShelfOpen: (() => {
    const s = t([C.RED, C.DARKGREY, C.BLUE]);
    rect(s, 0, 1, T, 14, 1);
    frame(s, 0, 1, T, 14, 3);
    rect(s, 2, 3, 12, 10, 2);
    return s;
  })(),
};
