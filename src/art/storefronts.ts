// Procedural storefront renderer: 80x44 facades with animated window displays.
// Everything is drawn through Surface (rect/px/hline/text) with master palette indices so it can animate.
import { C } from '../core/palette';
import type { StoreId } from '../core/events';
import { STORE_BY_ID } from '../data/stores';
import { DOOR_H, DOOR_W, STOREFRONT_H, STOREFRONT_W } from '../game/geometry';
import { drawShutter, hash2 } from './backdrops';
import type { Surface } from './surface';

export interface StorefrontState {
  /** Animation clock in frames. */
  tick: number;
  /** Package taken: door goes dark, windows dim, no blink. (Only affects target stores.) */
  cleared: boolean;
  /** Show the "70% OFF" tag (open stores only). */
  blackFriday: boolean;
}

/** Layout constants (offsets from the storefront's top-left). */
export const STOREFRONT_INSET = {
  signH: 14,
  awningY: 14,
  awningH: 2,
  winY: 17,
  winH: 24,
  winW: 28,
  winLX: 2,
  winRX: 50,
  /** Interior of a window is (winW-2) x (winH-2) at +1,+1 inside the frame. */
  innerW: 26,
  innerH: 22,
  sillY: 41,
} as const;

export function storefrontDoorRect(x: number, y: number): { x: number; y: number; w: number; h: number } {
  return { x: x + (STOREFRONT_W - DOOR_W) / 2, y: y + STOREFRONT_H - DOOR_H, w: DOOR_W, h: DOOR_H };
}

const BLINK_PERIOD = 60; // frames: 30 bright, 30 dark (about 1 Hz)

/** Door body colour for the given state (bright red / dark red for blinking targets, blue for shops). */
export function storefrontDoorColour(id: StoreId, st: StorefrontState): number {
  const role = STORE_BY_ID[id].role;
  if (role === 'powerup') return C.BLUE;
  if (role === 'closed') return C.GRAY_DD;
  if (st.cleared) return C.BLACK;
  return st.tick % BLINK_PERIOD < BLINK_PERIOD / 2 ? C.RED : C.RED_D;
}

// ---------------------------------------------------------------- facade styles

interface Style {
  wall: number;
  awning: number;
  sill: number;
}
const STYLE: Record<StoreId, Style> = {
  forever12: { wall: 0x04, awning: C.PINK, sill: 0x03 },
  radioshock: { wall: 0x2d, awning: C.RED, sill: C.BLACK },
  crookstone: { wall: 0x07, awning: C.TAN, sill: 0x06 },
  gamestonk: { wall: 0x02, awning: C.GREEN_L, sill: 0x01 },
  kgbtoys: { wall: 0x0c, awning: C.YELLOW, sill: 0x01 },
  blockblustervideo: { wall: 0x2d, awning: C.GRAY_D, sill: C.BLACK },
  spendersgifts: { wall: 0x03, awning: C.MAGENTA, sill: 0x02 },
  sambaddy: { wall: 0x05, awning: C.CYAN, sill: 0x06 },
  sharperimagine: { wall: 0x00, awning: C.GRAY_L, sill: C.GRAY_DD },
  hotspy: { wall: 0x06, awning: C.YELLOW, sill: 0x07 },
  circuitpity: { wall: 0x2d, awning: C.GRAY_D, sill: C.BLACK },
  footlockpicker: { wall: 0x0a, awning: C.WHITE, sill: 0x09 },
  borderlinebooks: { wall: 0x07, awning: C.GRAY_D, sill: C.BLACK },
};

// ---------------------------------------------------------------- window drawing helper (local coordinates)

class Win {
  constructor(
    readonly s: Surface,
    readonly ox: number,
    readonly oy: number,
    readonly t: number,
  ) {}
  r(x: number, y: number, w: number, h: number, c: number): void {
    this.s.rect(this.ox + x, this.oy + y, w, h, c);
  }
  p(x: number, y: number, c: number): void {
    this.s.px(this.ox + x, this.oy + y, c);
  }
  h(x: number, y: number, w: number, c: number): void {
    this.s.hline(this.ox + x, this.oy + y, w, c);
  }
  v(x: number, y: number, h: number, c: number): void {
    this.s.vline(this.ox + x, this.oy + y, h, c);
  }
  /** Filled disc with slightly squared-off pixel circle shape. */
  disc(cx: number, cy: number, rad: number, c: number): void {
    for (let dy = -rad; dy <= rad; dy++) {
      const half = Math.floor(Math.sqrt(rad * rad + rad - dy * dy));
      this.r(cx - half, cy + dy, half * 2 + 1, 1, c);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 64; i++) {
      this.p(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  frame(x: number, y: number, ww: number, hh: number, c: number): void {
    this.s.frame(this.ox + x, this.oy + y, ww, hh, c);
  }
  txt(str: string, x: number, y: number, c: number): void {
    this.s.text(str, this.ox + x, this.oy + y, c, { small: true });
  }
  /** Background + floor strip. */
  base(bg: number, floor: number, floorHi: number): void {
    this.r(0, 0, 26, 22, bg);
    this.r(0, 19, 26, 3, floor);
    this.h(0, 19, 26, floorHi);
  }
}

const tri = (t: number, period: number): number => {
  const m = (t % period) / period;
  return m < 0.5 ? m * 2 : 2 - m * 2;
};

// ---------------------------------------------------------------- displays

type Display = (w: Win) => void;

const mannequin = (w: Win, cx: number, top: number, top1: number, skirt: number, pants: boolean): void => {
  const skin = C.TAN;
  w.r(cx - 1, top, 3, 3, skin);
  w.p(cx - 1, top, C.GRAY_L);
  w.p(cx, top + 3, C.GRAY_M);
  w.r(cx - 4, top + 5, 1, 5, skin);
  w.r(cx + 4, top + 5, 1, 5, skin);
  w.r(cx - 3, top + 4, 7, 6, top1);
  w.v(cx - 3, top + 4, 6, C.WHITE);
  w.p(cx, top + 4, skin);
  if (pants) {
    w.r(cx - 3, top + 10, 3, 7, skirt);
    w.r(cx + 1, top + 10, 3, 7, skirt);
  } else {
    w.r(cx - 3, top + 10, 7, 3, skirt);
    w.r(cx - 2, top + 13, 2, 4, skin);
    w.r(cx + 1, top + 13, 2, 4, skin);
  }
  w.r(cx - 3, top + 17, 7, 1, C.GRAY_DD);
};

const MANNEQ_TOPS = [C.PINK, C.YELLOW, C.CYAN, C.LIME, C.VIOLET_L, C.ORANGE];
const MANNEQ_BOTTOMS = [C.CYAN, C.BLUE, C.PINK_L, C.MAGENTA, C.BLUE, C.TEAL];

const DISPLAYS: Record<string, Display> = {
  mannequins(w) {
    w.base(0x04, C.BLACK, C.GRAY_DD);
    const shift = Math.floor(w.t / 100);
    for (let i = 0; i < 3; i++) {
      const k = (i + shift) % 6;
      mannequin(w, 5 + i * 8, 1, MANNEQ_TOPS[k], MANNEQ_BOTTOMS[k], i === 1);
    }
    // spotlight sparkle
    const sp = (w.t >> 3) % 8;
    if (sp < 3) {
      const sx = 2 + sp * 10;
      w.p(sx, 2, C.WHITE);
      w.p(sx - 1, 2, C.GRAY_D);
      w.p(sx + 1, 2, C.GRAY_D);
      w.p(sx, 1, C.GRAY_D);
      w.p(sx, 3, C.GRAY_D);
    }
  },

  clothesrack(w) {
    w.base(0x04, C.BLACK, C.GRAY_DD);
    w.r(1, 4, 24, 1, C.GRAY_L);
    w.v(1, 4, 15, C.GRAY_M);
    w.v(24, 4, 15, C.GRAY_M);
    w.r(0, 18, 4, 1, C.GRAY_M);
    w.r(22, 18, 4, 1, C.GRAY_M);
    const cols = [C.PINK, C.CYAN, C.YELLOW, C.LIME, C.VIOLET_L];
    const len = [10, 12, 9, 11, 10];
    for (let i = 0; i < 5; i++) {
      const sway = (((w.t >> 4) + i) & 3) < 2 ? 0 : 1;
      const gx = 3 + i * 4 + sway;
      w.p(gx + 1, 5, C.GRAY_L);
      w.r(gx, 6, 4, len[i], cols[i]);
      w.v(gx, 6, len[i], C.WHITE);
      w.r(gx, 5 + len[i], 4, 1, C.GRAY_DD);
      w.p(gx + 2, 6, C.BLACK);
    }
  },

  staticTvs(w) {
    w.base(0x0c, C.BLACK, C.GRAY_DD);
    const tv = (x: number, y: number, i: number): void => {
      w.r(x, y, 11, 8, C.BROWN_L);
      w.h(x, y, 11, C.ORANGE);
      w.r(x + 1, y + 1, 9, 6, C.BLACK);
      const f = (w.t >> 1) + i * 7;
      for (let yy = 0; yy < 6; yy++) {
        for (let xx = 0; xx < 9; xx++) {
          const v = hash2(xx, yy, f) & 3;
          if (v === 0) continue;
          w.p(x + 1 + xx, y + 1 + yy, v === 1 ? C.WHITE : v === 2 ? C.GRAY_L : C.GRAY_D);
        }
      }
      const roll = (w.t + i * 5) % 12;
      if (roll < 6) w.h(x + 1, y + 1 + roll, 9, C.GRAY_L);
      w.p(x + 9, y + 7, C.RED_L);
    };
    tv(1, 11, 0);
    tv(14, 11, 1);
    // top TV shows colour bars now and then
    const bars = w.t % 150 >= 110;
    w.line(12, 3, 8, 0, C.GRAY_L);
    w.line(13, 3, 17, 0, C.GRAY_L);
    w.r(7, 3, 11, 8, C.BROWN_L);
    w.h(7, 3, 11, C.ORANGE);
    w.r(8, 4, 9, 6, C.BLACK);
    if (bars) {
      const cs = [C.WHITE, C.YELLOW, C.CYAN, C.GREEN_L, C.MAGENTA, C.RED, C.BLUE];
      for (let i = 0; i < 7; i++) w.r(8 + i + (i > 4 ? 0 : 0), 4, 1, 6, cs[i]);
      w.r(15, 4, 2, 6, C.BLACK);
    } else {
      for (let yy = 0; yy < 6; yy++) {
        for (let xx = 0; xx < 9; xx++) {
          const v = hash2(xx, yy, (w.t >> 1) + 21) & 3;
          if (v === 0) continue;
          w.p(8 + xx, 4 + yy, v === 1 ? C.WHITE : v === 2 ? C.GRAY_L : C.GRAY_D);
        }
      }
    }
  },

  walkieTalkies(w) {
    w.base(0x0c, C.BLACK, C.GRAY_DD);
    const xs = [3, 10, 17];
    const hs = [11, 13, 11];
    for (let i = 0; i < 3; i++) {
      const x = xs[i];
      const hgt = hs[i];
      const top = 18 - hgt;
      w.r(x + 4, top - 5, 1, 5, C.GRAY_M);
      w.r(x, top, 6, hgt, C.GRAY_DD);
      w.v(x, top, hgt, C.GRAY_D);
      w.r(x + 1, top + 2, 4, 3, C.GREEN_D);
      w.h(x + 1, top + 2, 4, ((w.t >> 4) + i) & 1 ? C.LIME : C.GREEN_L);
      for (let k = 0; k < 3; k++) w.h(x + 1, top + 6 + k * 2, 4, C.BLACK);
      w.r(x + 6, top + 3, 1, 3, C.ORANGE);
      const led = ((w.t / 20) | 0) % 3 === i;
      w.p(x + 1, top + 1, led ? C.RED_L : C.RED_D);
    }
    const ph = (w.t >> 3) % 3;
    if (ph > 0) {
      w.p(13 + 4 + ph, 4, C.CYAN);
      w.p(14 + 4 + ph, 3, C.CYAN);
      w.p(14 + 4 + ph, 5, C.CYAN);
    }
  },

  massageChair(w) {
    w.base(0x07, 0x06, 0x17);
    const dy = (w.t >> 1) & 1;
    const y = 2 + dy;
    w.r(6, y + 1, 14, 11, C.BROWN_L);
    w.r(8, y, 10, 3, C.ORANGE);
    w.r(7, y + 3, 1, 8, C.ORANGE);
    w.r(4, y + 8, 3, 8, C.BROWN);
    w.r(19, y + 8, 3, 8, C.BROWN);
    w.r(4, y + 8, 3, 2, C.BROWN_L);
    w.r(19, y + 8, 3, 2, C.BROWN_L);
    w.r(6, y + 11, 14, 4, C.ORANGE);
    w.r(8, y + 15, 10, 2, C.BROWN_L);
    w.r(7, y + 14, 3, 2, C.BLACK);
    w.r(16, y + 14, 3, 2, C.BLACK);
    // massage rollers travelling up and down the back
    const ry = y + 3 + ((w.t >> 2) % 7);
    w.r(11, ry, 4, 2, C.YELLOW_L);
    w.p(10, ry, C.YELLOW);
    w.p(15, ry, C.YELLOW);
    // vibration marks
    if ((w.t >> 3) & 1) {
      w.p(2, 8, C.GRAY_L);
      w.p(1, 9, C.GRAY_L);
      w.p(2, 10, C.GRAY_L);
      w.p(23, 8, C.GRAY_L);
      w.p(24, 9, C.GRAY_L);
      w.p(23, 10, C.GRAY_L);
    } else {
      w.p(1, 8, C.GRAY_L);
      w.p(2, 9, C.GRAY_L);
      w.p(1, 10, C.GRAY_L);
      w.p(24, 8, C.GRAY_L);
      w.p(23, 9, C.GRAY_L);
      w.p(24, 10, C.GRAY_L);
    }
  },

  gadgetPedestals(w) {
    w.base(0x0c, C.BLACK, C.GRAY_DD);
    const ped = (x: number, top: number): void => {
      w.r(x, top, 6, 19 - top, C.GRAY_L);
      w.r(x + 5, top, 1, 19 - top, C.GRAY_M);
      w.r(x - 1, top, 8, 1, C.WHITE);
      w.r(x - 1, 18, 8, 1, C.GRAY_M);
    };
    ped(2, 13);
    ped(10, 10);
    ped(18, 13);
    // glowing sphere
    const pu = ((w.t >> 4) & 1) === 0;
    w.disc(5, 10, 2, pu ? C.CYAN : C.SKY);
    w.p(4, 9, C.WHITE);
    if (pu) {
      w.p(2, 7, C.CYAN_L);
      w.p(8, 7, C.CYAN_L);
    }
    // gizmo cube with blinking LED
    w.r(11, 4, 5, 5, C.GRAY_DD);
    w.h(11, 4, 5, C.GRAY_L);
    w.r(12, 6, 3, 2, C.GREEN);
    w.p(14, 5, w.t % 40 < 20 ? C.RED_L : C.RED_D);
    // light pen
    w.r(20, 5, 2, 8, C.CYAN);
    w.p(20, 4, C.WHITE);
    w.p(21, 4, C.WHITE);
    w.r(20, 12, 2, 1, C.GRAY_DD);
    if ((w.t >> 3) % 6 === 0) {
      w.p(19, 3, C.WHITE);
      w.p(22, 3, C.WHITE);
    }
  },

  consoleStack(w) {
    w.base(0x03, C.BLACK, C.GRAY_DD);
    const led = (w.t >> 4) & 1;
    w.r(1, 15, 15, 4, C.GRAY_L);
    w.h(1, 15, 15, C.WHITE);
    w.r(3, 17, 8, 1, C.GRAY_D);
    w.p(13, 16, led ? C.GREEN_L : C.GREEN_D);
    w.r(2, 12, 13, 3, C.BLACK);
    w.h(2, 12, 13, C.GRAY_DD);
    w.r(4, 13, 5, 1, C.BLUE);
    w.p(12, 13, led ? C.RED_L : C.RED_D);
    w.r(3, 9, 11, 3, C.WHITE);
    w.r(3, 11, 11, 1, C.GRAY_M);
    w.r(5, 10, 3, 1, C.RED);
    // controller on top
    w.r(4, 7, 9, 2, C.GRAY_DD);
    w.p(5, 7, C.GRAY_L);
    w.p(11, 7, C.RED_L);
    w.p(10, 7, C.GREEN_L);
    // cartridges standing up
    const cart = (x: number, col: number): void => {
      w.r(x, 12, 4, 7, col);
      w.r(x + 1, 13, 2, 3, C.WHITE);
      w.r(x, 18, 4, 1, C.BLACK);
      w.v(x, 12, 6, C.WHITE);
    };
    cart(18, C.RED);
    cart(22, C.BLUE);
    // NEW tag
    const on = (w.t >> 4) & 1;
    w.r(17, 2, 9, 7, on ? C.YELLOW : C.YELLOW_L);
    w.frame(17, 2, 9, 7, C.RED);
    w.txt('NEW', 18, 3, C.RED_D);
  },

  moonPoster(w) {
    w.r(0, 0, 26, 22, 0x03);
    // poster
    w.r(0, 0, 26, 13, C.WHITE);
    w.r(1, 1, 24, 11, 0x01);
    for (let i = 0; i < 8; i++) w.p(1 + (hash2(i, 5) % 24), 1 + (hash2(i, 6) % 5), i === (w.t >> 4) % 8 ? C.WHITE : C.GRAY_D);
    w.disc(20, 4, 2, C.YELLOW_L);
    w.p(19, 3, C.YELLOW);
    // rocket
    w.p(6, 1, C.RED_L);
    w.r(5, 2, 3, 3, C.WHITE);
    w.p(6, 3, C.CYAN);
    w.r(4, 4, 1, 1, C.RED);
    w.r(8, 4, 1, 1, C.RED);
    w.p(6, 5, (w.t >> 1) & 1 ? C.YELLOW_L : C.ORANGE);
    // caption alternates
    const cap = ((w.t / 45) | 0) & 1 ? 'MOON' : 'TO THE';
    w.txt(cap, 13 - ((cap.length * 4 - 1) >> 1), 6, ((w.t >> 3) & 1) && cap === 'MOON' ? C.YELLOW_L : C.WHITE);
    // demo TV
    w.r(1, 14, 13, 8, C.GRAY_DD);
    w.r(2, 15, 11, 6, C.BLACK);
    const bx = 3 + Math.round(tri(w.t, 40) * 8);
    const by = 16 + Math.round(tri(w.t, 27) * 3);
    w.p(bx, by, C.WHITE);
    w.v(3, 16 + ((w.t >> 3) % 3), 2, C.GREEN_L);
    w.v(11, 17 + ((w.t >> 4) % 3), 2, C.GREEN_L);
    w.p(11, 21, C.GRAY_M);
    // controller
    w.r(16, 17, 9, 4, C.GRAY_L);
    w.r(16, 17, 9, 1, C.WHITE);
    w.p(18, 18, C.BLACK);
    w.p(17, 19, C.BLACK);
    w.p(19, 19, C.BLACK);
    w.p(18, 20, C.BLACK);
    w.p(22, 18, C.RED);
    w.p(23, 19, C.YELLOW);
  },

  furHatBears(w) {
    w.base(0x1c, 0x07, 0x17);
    for (let i = 0; i < 2; i++) {
      const cx = 7 + i * 11;
      const dy = (((w.t >> 4) + i) & 1) === 0 ? 0 : -1;
      bear(w, cx, dy, (w.t >> 4) & 1);
    }
  },

  robotRocket(w) {
    w.base(0x1c, 0x07, 0x17);
    // tin robot
    const arm = ((w.t >> 4) & 1) === 0;
    w.p(8, 1, C.RED_L);
    w.v(8, 2, 2, C.GRAY_M);
    w.r(5, 4, 7, 5, C.GRAY_L);
    w.r(5, 4, 7, 1, C.WHITE);
    w.r(6, 5, 2, 2, C.BLACK);
    w.r(9, 5, 2, 2, C.BLACK);
    w.p(((w.t >> 5) & 1) === 0 ? 7 : 6, 6, C.YELLOW_L);
    w.p(((w.t >> 5) & 1) === 0 ? 10 : 9, 6, C.YELLOW_L);
    w.h(6, 8, 5, C.GRAY_DD);
    w.r(4, 9, 9, 7, C.GRAY_M);
    w.v(4, 9, 7, C.GRAY_L);
    w.r(6, 10, 5, 4, C.BLACK);
    const lc = ((w.t / 12) | 0) % 3;
    w.p(7, 11, lc === 0 ? C.RED_L : C.RED_D);
    w.p(8, 12, lc === 1 ? C.YELLOW_L : C.ORANGE_D);
    w.p(9, 11, lc === 2 ? C.GREEN_L : C.GREEN_D);
    w.r(2, arm ? 8 : 10, 2, 5, C.GRAY_L);
    w.r(13, arm ? 10 : 8, 2, 5, C.GRAY_L);
    w.r(5, 16, 3, 3, C.GRAY_DD);
    w.r(9, 16, 3, 3, C.GRAY_DD);
    // toy rocket on a stand
    w.p(20, 2, C.RED_L);
    w.r(19, 3, 3, 3, C.RED);
    w.r(18, 6, 5, 8, C.WHITE);
    w.v(22, 6, 8, C.GRAY_L);
    w.r(20, 8, 2, 2, C.CYAN);
    w.r(16, 11, 2, 4, C.RED);
    w.r(23, 11, 2, 4, C.RED);
    w.r(17, 14, 7, 1, C.GRAY_L);
    const fl = (w.t >> 1) & 1;
    w.r(19, 15, 3, 2, fl ? C.YELLOW_L : C.ORANGE);
    w.r(20, 17, 1, fl ? 2 : 1, C.RED_L);
    w.r(17, 18, 7, 1, C.GRAY_D);
  },

  lavaLamp(w) {
    w.r(0, 0, 26, 22, 0x03);
    // blacklight sparkles
    for (let i = 0; i < 6; i++) {
      const on = ((w.t >> 4) + i * 3) % 5 !== 0;
      if (on) w.p(hash2(i, 41) % 26, hash2(i, 42) % 15, i & 1 ? C.MAGENTA_L : C.VIOLET_L);
    }
    w.r(0, 19, 26, 3, C.BLACK);
    w.h(0, 19, 26, 0x02);
    // glow behind the lamp
    for (let y = 2; y < 18; y++) for (let x = 5; x < 22; x++) if (((x + y) & 1) === 0 && Math.abs(x - 13) + Math.abs(y - 10) < 12) w.p(x, y, 0x04);
    // lamp
    w.r(11, 1, 5, 2, C.GRAY_M);
    w.r(8, 17, 11, 2, C.GRAY_M);
    w.r(10, 15, 7, 2, C.GRAY_D);
    const widths = [6, 7, 8, 8, 8, 8, 8, 8, 7, 7, 6, 5];
    for (let i = 0; i < widths.length; i++) {
      const wd = widths[i];
      w.r(13 - (wd >> 1), 3 + i, wd, 1, C.MAGENTA);
      w.p(13 - (wd >> 1), 3 + i, C.MAGENTA_L);
    }
    // pool of wax at the bottom + rising blobs
    w.r(11, 14, 5, 1, C.YELLOW);
    w.r(10, 13, 7, 1, C.ORANGE);
    for (let b = 0; b < 3; b++) {
      const ph = w.t * 0.035 + b * 2.1;
      const y = 5 + Math.round(((Math.sin(ph) + 1) / 2) * 7);
      const x = 13 + Math.round(Math.sin(ph * 0.7 + b) * 1.5);
      w.disc(x, y, b === 1 ? 2 : 1, b === 0 ? C.YELLOW : C.ORANGE);
      w.p(x - 1, y - 1, C.YELLOW_L);
    }
  },

  plasmaBall(w) {
    w.r(0, 0, 26, 22, C.BLACK);
    for (let i = 0; i < 5; i++) {
      const on = ((w.t >> 4) + i * 2) % 4 !== 0;
      if (on) w.p(hash2(i, 51) % 26, hash2(i, 52) % 12, i & 1 ? C.MAGENTA_L : 0x03);
    }
    w.r(0, 19, 26, 3, 0x03);
    w.h(0, 19, 26, C.PURPLE);
    w.r(10, 17, 7, 2, C.GRAY_DD);
    w.r(12, 15, 3, 2, C.GRAY_D);
    w.disc(13, 8, 8, C.PURPLE);
    w.disc(13, 8, 7, 0x03);
    w.disc(13, 8, 6, C.BLACK);
    w.p(8, 3, C.VIOLET_L);
    w.p(7, 4, C.VIOLET_L);
    w.p(9, 2, C.PURPLE);
    // tendrils
    const seedT = w.t >> 2;
    for (let k = 0; k < 6; k++) {
      const hh = hash2(k, seedT, 3);
      const ang = ((hh % 360) * Math.PI) / 180;
      const ex = 13 + Math.round(Math.cos(ang) * 6);
      const ey = 8 + Math.round(Math.sin(ang) * 6);
      const mx = 13 + Math.round((ex - 13) * 0.5) + ((hh >> 9) % 3) - 1;
      const my = 8 + Math.round((ey - 8) * 0.5) + ((hh >> 11) % 3) - 1;
      const col = k % 3 === 0 ? C.PINK_L : k % 3 === 1 ? C.CYAN : C.VIOLET_L;
      w.line(13, 8, mx, my, col);
      w.line(mx, my, ex, ey, col);
      w.p(ex, ey, C.WHITE);
    }
    w.r(12, 7, 3, 3, C.MAGENTA);
    w.p(13, 8, C.WHITE);
  },

  tapesVinyl(w) {
    w.base(0x05, C.BLACK, C.GRAY_DD);
    // record
    w.disc(8, 9, 7, C.BLACK);
    w.disc(8, 9, 5, C.GRAY_DD);
    w.disc(8, 9, 4, C.BLACK);
    w.disc(8, 9, 2, C.YELLOW);
    w.p(8, 9, C.BLACK);
    const q = (w.t >> 3) & 3;
    const sheen = [
      [4, 4, 5, 3],
      [12, 4, 11, 3],
      [12, 14, 11, 15],
      [4, 14, 5, 15],
    ][q];
    w.p(sheen[0], sheen[1], C.GRAY_L);
    w.p(sheen[2], sheen[3], C.GRAY_L);
    // cassettes
    const tape = (x: number, y: number, col: number, i: number): void => {
      w.r(x, y, 10, 6, col);
      w.r(x + 1, y + 1, 8, 3, C.WHITE);
      w.h(x + 1, y + 1, 8, C.RED_L);
      w.r(x + 2, y + 2, 2, 2, C.BLACK);
      w.r(x + 6, y + 2, 2, 2, C.BLACK);
      w.p(x + 2 + (((w.t >> 3) + i) & 1), y + 2, C.WHITE);
      w.p(x + 6 + (((w.t >> 3) + i) & 1), y + 3, C.WHITE);
      w.h(x + 2, y + 5, 6, C.BLACK);
    };
    tape(15, 12, C.BLUE, 0);
    tape(16, 6, C.YELLOW, 1);
    w.h(15, 18, 10, C.GRAY_D);
  },

  boombox(w) {
    w.r(0, 0, 26, 22, 0x03);
    w.r(0, 19, 26, 3, C.BLACK);
    w.h(0, 19, 26, 0x02);
    const beat = w.t % 16 < 4;
    const dy = beat ? -1 : 0;
    const y = 6 + dy;
    // handle + antenna
    w.h(7, y - 3, 12, C.GRAY_D);
    w.v(6, y - 2, 2, C.GRAY_D);
    w.v(19, y - 2, 2, C.GRAY_D);
    w.line(21, y, 24, y - 5, C.GRAY_L);
    // body
    w.r(1, y, 24, 12, C.GRAY_M);
    w.h(1, y, 24, C.GRAY_L);
    w.h(1, y + 11, 24, C.GRAY_D);
    const speaker = (cx: number): void => {
      w.disc(cx, y + 6, 4, C.BLACK);
      w.disc(cx, y + 6, beat ? 3 : 2, C.GRAY_DD);
      w.disc(cx, y + 6, 1, beat ? C.GRAY_L : C.GRAY_D);
    };
    speaker(6);
    speaker(20);
    // deck
    w.r(10, y + 2, 7, 4, C.BLACK);
    w.r(11, y + 3, 5, 2, C.CYAN);
    w.p(12 + ((w.t >> 3) & 1), y + 4, C.BLACK);
    w.p(14 + ((w.t >> 3) & 1), y + 4, C.BLACK);
    w.h(10, y + 8, 7, C.YELLOW);
    w.p(10 + ((w.t >> 2) % 7), y + 8, C.RED);
    const bc = [C.RED, C.YELLOW, C.GREEN, C.CYAN];
    for (let i = 0; i < 4; i++) w.p(10 + i * 2, y + 10, bc[i]);
    // rising notes
    for (let i = 0; i < 2; i++) {
      const ny = 12 - ((((w.t >> 2) + i * 5) % 10) | 0);
      if (ny >= 0 && ny < 5) {
        const nx = i === 0 ? 1 : 22;
        w.r(nx, ny, 2, 1, C.YELLOW_L);
        w.r(nx + 1, ny + 1, 1, 1, C.YELLOW_L);
      }
    }
  },

  robotVacuum(w) {
    w.r(0, 0, 26, 22, 0x0c);
    // spotlights
    for (let i = 0; i < 2; i++) {
      const sx = 4 + i * 14;
      for (let y = 0; y < 5; y++) w.h(sx - y, y, 5 + y * 2, ((y + i) & 1) === 0 ? 0x1c : 0x0c);
    }
    w.r(0, 17, 26, 5, C.GRAY_L);
    w.h(0, 17, 26, C.WHITE);
    w.h(0, 21, 26, C.GRAY_M);
    // product box
    w.r(17, 4, 8, 13, C.WHITE);
    w.r(18, 5, 6, 4, C.CYAN);
    w.r(19, 7, 4, 2, C.GRAY_DD);
    w.r(18, 11, 6, 1, C.GRAY_M);
    w.r(18, 13, 4, 1, C.GRAY_M);
    // vacuum
    const v = ((w.t / 6) | 0) % 16;
    const px = v < 8 ? v : 16 - v;
    const right = v < 8;
    const x = 2 + px;
    w.r(x, 14, 12, 3, C.GRAY_DD);
    w.r(x + 1, 13, 10, 1, C.GRAY_L);
    w.h(x + 1, 12, 10, C.GRAY_M);
    w.h(x, 17, 12, C.BLACK);
    w.p(x + 5, 12, C.BLACK);
    w.p(x + 6, 12, ((w.t >> 4) & 1) === 0 ? C.GREEN_L : C.CYAN);
    w.p(right ? x + 11 : x, 14, C.RED_L);
    w.p(right ? x + 12 : x - 1, 17, (w.t >> 1) & 1 ? C.GRAY_D : C.BLACK);
    w.p(x + 2, 15, C.GRAY_L);
    w.h(x + 3, 15, 6, C.GRAY_D);
    // clean trail
    w.h(right ? 0 : x + 12, 20, right ? x : 26 - (x + 12), C.WHITE);
  },

  glowOrb(w) {
    w.r(0, 0, 26, 22, C.BLACK);
    const k = Math.floor(tri(w.t, 90) * 2.999);
    const cols = [C.BLUE, C.SKY, C.CYAN];
    const ring = 6 + k;
    for (let y = 0; y < 19; y++) {
      for (let x = 0; x < 26; x++) {
        const d = Math.hypot(x - 13, y - 8.5);
        if (d > 5.5 && d < ring + 1 && ((x + y) & 1) === 0) w.p(x, y, k === 2 ? C.SKY : C.BLUE_D);
      }
    }
    w.disc(13, 9, 5, cols[k]);
    w.disc(13, 9, 3, C.CYAN_L);
    w.disc(13, 9, 1, C.WHITE);
    w.p(10, 6, C.WHITE);
    // orbiting satellites
    for (let i = 0; i < 3; i++) {
      const a = w.t * 0.07 + i * 2.09;
      const sx = 13 + Math.round(Math.cos(a) * 10);
      const sy = 9 + Math.round(Math.sin(a) * 3.5);
      w.r(sx, sy, 2, 2, Math.sin(a) < 0 ? C.SKY : C.WHITE);
    }
    w.r(9, 16, 9, 3, C.GRAY_L);
    w.h(9, 16, 9, C.WHITE);
    w.r(8, 19, 11, 3, C.GRAY_M);
    w.h(8, 19, 11, C.GRAY_L);
  },

  lemonadeTub(w) {
    w.base(0x07, 0x06, 0x17);
    const pump = tri(w.t, 40);
    // tub
    w.r(1, 7, 19, 2, C.GRAY_L);
    w.r(2, 9, 17, 9, C.YELLOW);
    w.r(3, 18, 15, 1, C.ORANGE);
    w.r(2, 9, 17, 2, C.YELLOW_L);
    w.v(2, 9, 9, C.WHITE);
    w.v(18, 9, 9, C.ORANGE);
    for (let i = 0; i < 3; i++) {
      const lx = 5 + i * 5;
      const ly = 10 + (((w.t >> 5) + i) & 1);
      w.disc(lx, ly, 1, C.LIME);
      w.p(lx, ly, C.YELLOW_L);
    }
    // bubbles
    for (let i = 0; i < 3; i++) {
      const by = 17 - (((w.t >> 2) + i * 4) % 9);
      w.p(4 + i * 5, by, C.WHITE);
    }
    // pump: piston through a red handle
    const hy = 1 + Math.round(pump * 5);
    w.r(21, 6, 3, 12, C.GRAY_M);
    w.v(21, 6, 12, C.GRAY_L);
    w.r(20, 17, 5, 2, C.GRAY_D);
    w.r(20, 9, 6, 1, C.GRAY_D); // spout arm
    w.r(22, hy, 1, 7, C.GRAY_L);
    w.r(19, hy - 1, 7, 2, C.RED);
    w.h(19, hy - 1, 7, C.RED_L);
    if (pump > 0.7) {
      w.p(19, 6, C.YELLOW_L);
      w.p(18, 5, C.YELLOW_L);
      w.p(6, 7, C.YELLOW_L);
      w.p(13, 6, C.YELLOW_L);
    }
  },

  corndogs(w) {
    w.base(0x06, 0x07, 0x17);
    const xs = [4, 9, 14, 19];
    const tops = [5, 3, 5, 4];
    for (let i = 0; i < 4; i++) {
      const cx = xs[i];
      const top = tops[i];
      w.r(cx, top + 8, 1, 8, C.TAN);
      w.r(cx - 1, top + 1, 3, 9, C.ORANGE);
      w.r(cx, top, 1, 1, C.ORANGE);
      w.v(cx - 1, top + 1, 9, C.YELLOW);
      w.v(cx + 1, top + 1, 9, C.ORANGE_D);
      for (let k = 0; k < 4; k++) w.p(cx - 1 + ((k + i) & 1) * 2, top + 2 + k * 2, C.YELLOW_L);
      w.p(cx, top + 3 + i, C.YELLOW_L);
      // steam
      const sy = top - 2 - ((((w.t >> 3) + i) % 3) | 0);
      if (sy >= 0) w.p(cx + (((w.t >> 4) + i) & 1), sy, C.GRAY_L);
    }
    // cup
    w.r(2, 14, 20, 5, C.WHITE);
    for (let x = 2; x < 22; x += 4) w.r(x, 14, 2, 5, C.RED);
    w.h(2, 14, 20, C.RED_D);
    w.h(2, 18, 20, C.GRAY_M);
  },

  sneakerWall(w) {
    w.r(0, 0, 26, 22, 0x0a);
    const rows = [
      [C.RED, C.BLUE],
      [C.YELLOW, C.PINK],
      [C.CYAN, C.LIME],
    ];
    const ys = [8, 15, 21];
    const spark = ((w.t / 40) | 0) % 6;
    for (let r = 0; r < 3; r++) {
      w.h(0, ys[r], 26, C.WHITE);
      if (ys[r] + 1 < 22) w.h(0, ys[r] + 1, 26, C.BLACK);
      for (let c = 0; c < 2; c++) {
        const x = 1 + c * 13;
        const y = ys[r] - 5;
        shoe(w, x, y, rows[r][c]);
        if (spark === r * 2 + c && (w.t >> 2) % 3 !== 0) {
          w.p(x + 9, y - 1, C.WHITE);
          w.p(x + 8, y - 1, C.GRAY_L);
          w.p(x + 10, y - 1, C.GRAY_L);
          w.p(x + 9, y - 2, C.GRAY_L);
        }
      }
    }
  },

  basketballsJersey(w) {
    w.base(0x0a, 0x07, 0x17);
    // jersey on a hanger
    w.p(6, 0, C.GRAY_L);
    w.r(2, 1, 3, 3, C.RED);
    w.r(9, 1, 3, 3, C.RED);
    w.r(1, 4, 12, 14, C.RED);
    w.r(5, 3, 4, 1, C.RED);
    w.r(5, 1, 4, 2, 0x0a);
    w.v(1, 4, 14, C.WHITE);
    w.v(12, 4, 14, C.WHITE);
    w.h(1, 17, 12, C.WHITE);
    w.h(1, 16, 12, C.RED_D);
    w.txt('23', 3, 8, C.WHITE);
    // balls
    const ball = (cx: number, cy: number): void => {
      w.disc(cx, cy, 3, C.ORANGE);
      w.v(cx, cy - 3, 7, C.BLACK);
      w.h(cx - 3, cy, 7, C.BLACK);
      w.p(cx - 2, cy - 2, C.BLACK);
      w.p(cx + 2, cy - 2, C.BLACK);
      w.p(cx - 2, cy + 2, C.BLACK);
      w.p(cx + 2, cy + 2, C.BLACK);
      w.p(cx - 1, cy - 2, C.YELLOW);
    };
    ball(16, 15);
    const hgt = Math.round(Math.abs(Math.sin(w.t * 0.09)) * 8);
    w.r(20 + (hgt > 3 ? 1 : 0), 19, 5 - (hgt > 3 ? 2 : 0), 1, C.BLACK);
    ball(22, 15 - hgt);
  },

  forLease(w) {
    w.r(0, 0, 26, 22, C.GRAY_DD);
    dustyFloor(w);
    // cobweb
    w.line(0, 0, 6, 6, C.GRAY_D);
    w.line(0, 3, 4, 7, C.GRAY_D);
    w.line(3, 0, 7, 4, C.GRAY_D);
    w.line(0, 6, 3, 3, C.GRAY_D);
    // hanging sign
    const sw = ((w.t / 50) | 0) & 1;
    w.v(5 + sw, 0, 4, C.GRAY_M);
    w.v(20 + sw, 0, 4, C.GRAY_M);
    w.r(1 + sw, 4, 24, 14, C.WHITE);
    w.frame(1 + sw, 4, 24, 14, C.RED);
    w.txt('FOR', 8 + sw, 6, C.RED_D);
    w.txt('LEASE', 3 + sw + 0, 12, C.RED_D);
  },

  fadedVhsPoster(w) {
    w.r(0, 0, 26, 22, C.GRAY_DD);
    dustyFloor(w);
    // poster with a torn corner
    w.r(4, 1, 18, 18, C.GRAY_L);
    w.r(5, 2, 16, 3, C.GRAY_M);
    w.txt('REWIND', 2 + 4 + 1, 2 - 0, C.GRAY_L);
    w.disc(13, 10, 3, C.PINK_L);
    w.r(9, 13, 8, 4, C.GRAY_M);
    w.r(11, 8, 4, 5, C.GRAY_M);
    w.r(5, 17, 16, 2, C.GRAY_M);
    w.r(18, 1, 4, 3, C.GRAY_DD);
    w.p(18, 4, C.GRAY_DD);
    w.p(19, 4, C.GRAY_DD);
    w.line(3, 20, 6, 17, C.GRAY_D);
    // dust motes
    const d = (w.t >> 4) % 4;
    w.p(2 + d, 9, C.GRAY_D);
    w.p(23 - d, 14, C.GRAY_D);
  },

  deadTvsShutter(w) {
    w.r(0, 0, 26, 22, C.BLACK);
    w.r(0, 19, 26, 3, C.GRAY_DD);
    const tv = (x: number, y: number, tilt: boolean): void => {
      w.r(x, y, 11, 9, C.GRAY_DD);
      w.h(x, y, 11, C.GRAY_D);
      w.r(x + 1, y + 1, 9, 7, C.BLACK);
      w.line(x + 2, y + 6, x + 5, y + 2, C.GRAY_DD);
      if (tilt) {
        w.line(x + 5, y + 1, x + 7, y + 4, C.GRAY_D);
        w.line(x + 7, y + 4, x + 6, y + 7, C.GRAY_D);
      }
    };
    tv(1, 12, false);
    tv(14, 12, true);
    tv(7, 3, false);
    w.p(13 + ((w.t >> 5) & 1), 10, C.GRAY_D);
    // shutter rolled half way down
    drawShutter(w.s, w.ox, w.oy, 26, 22, 0.5);
  },

  closingSale(w) {
    w.r(0, 0, 26, 22, C.BLACK);
    drawShutter(w.s, w.ox, w.oy, 26, 22, 1);
  },
};

// helper: dusty floor + shelf ghost lines for closed stores
function dustyFloor(w: Win): void {
  w.r(0, 19, 26, 3, C.GRAY_D);
  w.h(0, 19, 26, C.GRAY_M);
  w.p(4, 20, C.GRAY_DD);
  w.p(15, 21, C.GRAY_DD);
}

function shoe(w: Win, x: number, y: number, col: number): void {
  // profile facing right: high heel, low toe box, white sole
  w.r(x, y, 4, 2, col);
  w.r(x, y + 2, 10, 2, col);
  w.r(x + 4, y + 1, 3, 1, col);
  w.p(x + 1, y, C.WHITE);
  w.r(x, y + 4, 10, 1, C.WHITE);
  w.p(x + 5, y + 2, C.WHITE);
  w.p(x + 7, y + 3, C.WHITE);
  w.p(x + 8, y + 2, C.BLACK);
  w.h(x + 4, y, 2, 0x0f);
}

function bear(w: Win, cx: number, dy: number, arm: number): void {
  const y = dy;
  const fur = C.ORANGE_D;
  // body + belly
  w.r(cx - 4, y + 14, 9, 5, fur);
  w.r(cx - 2, y + 15, 5, 3, C.TAN);
  w.r(cx - 5, y + 14 + arm, 2, 3, fur);
  w.r(cx + 4, y + 14 + (1 - arm), 2, 3, fur);
  w.r(cx - 4, y + 18, 3, 1, C.BROWN);
  w.r(cx + 2, y + 18, 3, 1, C.BROWN);
  // head
  w.r(cx - 3, y + 9, 7, 5, fur);
  w.r(cx - 2, y + 8, 5, 1, fur);
  w.r(cx - 5, y + 9, 2, 2, fur);
  w.r(cx + 4, y + 9, 2, 2, fur);
  w.r(cx - 1, y + 12, 3, 2, C.TAN);
  w.p(cx, y + 12, C.BLACK);
  w.p(cx - 2, y + 10, C.BLACK);
  w.p(cx + 2, y + 10, C.BLACK);
  // ushanka: grey fur with ear flaps and a red star
  w.r(cx - 4, y + 5, 9, 4, C.GRAY_L);
  w.r(cx - 3, y + 4, 7, 1, C.WHITE);
  w.r(cx - 5, y + 8, 2, 4, C.GRAY_L);
  w.r(cx + 4, y + 8, 2, 4, C.GRAY_L);
  w.p(cx - 3, y + 8, C.GRAY_M);
  w.p(cx + 3, y + 7, C.GRAY_M);
  w.r(cx - 1, y + 6, 2, 2, C.RED);
  w.p(cx - 3, y + 5, C.GRAY_M);
  w.p(cx + 3, y + 5, C.GRAY_M);
}

// ---------------------------------------------------------------- facade pieces

function drawSign(s: Surface, x: number, y: number, id: StoreId, st: StorefrontState): void {
  const def = STORE_BY_ID[id];
  let fill: number;
  let border: number;
  let text: number;
  if (def.role === 'target') {
    fill = C.RED;
    border = C.RED_D;
    text = C.WHITE;
  } else if (def.role === 'powerup') {
    fill = C.BLUE;
    border = C.BLUE_D;
    text = C.WHITE;
  } else {
    fill = C.GRAY_DD;
    border = C.BLACK;
    text = C.GRAY_M;
  }
  s.rect(x, y, STOREFRONT_W, 14, fill);
  s.hline(x, y + 13, STOREFRONT_W, border);
  s.vline(x, y, 14, border);
  s.vline(x + STOREFRONT_W - 1, y, 14, border);
  s.hline(x, y, STOREFRONT_W, border);
  if (def.role !== 'closed' && !(def.role === 'target' && st.cleared)) {
    // marquee bulbs on the top border, chasing
    for (let i = 0; i < 19; i++) {
      const on = (i + (st.tick >> 3)) % 3 === 0;
      s.px(x + 2 + i * 4, y, on ? C.YELLOW_L : def.role === 'target' ? C.RED_D : C.BLUE_D);
    }
  }
  const lines = def.signLines;
  if (lines.length === 1) s.text(lines[0], x + 40, y + 5, text, { small: true, align: 'center' });
  else {
    s.text(lines[0], x + 40, y + 1, text, { small: true, align: 'center' });
    s.text(lines[1], x + 40, y + 7, text, { small: true, align: 'center' });
  }
}

function drawAwning(s: Surface, x: number, y: number, accent: number): void {
  for (let i = 0; i < 20; i++) {
    const c = (i & 1) === 0 ? accent : C.WHITE;
    s.rect(x + i * 4, y + 14, 4, 1, c);
    s.rect(x + i * 4, y + 15, 4, 1, (i & 1) === 0 ? C.GRAY_DD : C.GRAY_M);
  }
}

function drawDoor(s: Surface, x: number, y: number, id: StoreId, st: StorefrontState): void {
  const def = STORE_BY_ID[id];
  const d = storefrontDoorRect(x, y);
  // casing
  s.vline(d.x - 1, d.y, d.h, C.BLACK);
  s.vline(d.x + d.w, d.y, d.h, C.BLACK);
  if (def.role === 'closed') {
    if (id === 'circuitpity') {
      // dark glass door behind a half-open shutter
      s.rect(d.x, d.y, d.w, d.h, C.BLACK);
      s.frame(d.x + 2, d.y + 14, d.w - 4, d.h - 14, C.GRAY_DD);
      s.vline(d.x + 8, d.y + 14, d.h - 14, C.GRAY_DD);
      s.hline(d.x + 2, d.y + 22, d.w - 4, C.GRAY_DD);
      drawShutter(s, d.x, d.y, d.w, d.h, 0.5);
    } else {
      s.rect(d.x, d.y, d.w, d.h, C.BLACK);
      drawShutter(s, d.x, d.y, d.w, d.h, 1);
      // padlock
      s.rect(d.x + 6, d.y + d.h - 4, 4, 2, C.YELLOW);
      s.px(d.x + 7, d.y + d.h - 5, C.YELLOW);
      s.px(d.x + 8, d.y + d.h - 5, C.YELLOW);
    }
    return;
  }
  const fill = storefrontDoorColour(id, st);
  let hi: number;
  let lo: number;
  let handle: number;
  if (def.role === 'powerup') {
    hi = C.SKY;
    lo = C.BLUE_D;
    handle = C.YELLOW_L;
  } else if (st.cleared) {
    hi = C.GRAY_DD;
    lo = C.BLACK;
    handle = C.GRAY_DD;
  } else if (fill === C.RED) {
    hi = C.RED_L;
    lo = C.RED_D;
    handle = C.YELLOW_L;
  } else {
    hi = C.RED;
    lo = C.BLACK;
    handle = C.YELLOW;
  }
  s.rect(d.x, d.y, d.w, d.h, fill);
  s.hline(d.x, d.y, d.w, hi);
  s.vline(d.x, d.y, d.h, hi);
  s.vline(d.x + d.w - 1, d.y, d.h, lo);
  s.hline(d.x, d.y + d.h - 1, d.w, lo);
  // upper glass
  s.rect(d.x + 3, d.y + 3, 10, 11, C.BLACK);
  s.rect(d.x + 4, d.y + 4, 8, 9, st.cleared && def.role === 'target' ? C.BLACK : def.role === 'powerup' ? 0x0c : fill === C.RED ? 0x0c : C.BLACK);
  if (!(st.cleared && def.role === 'target')) {
    s.px(d.x + 5, d.y + 5, C.WHITE);
    s.px(d.x + 6, d.y + 6, C.GRAY_L);
    s.px(d.x + 9, d.y + 11, C.GRAY_L);
  }
  // lower raised panel
  s.hline(d.x + 3, d.y + 17, 10, hi);
  s.hline(d.x + 3, d.y + 24, 10, lo);
  s.vline(d.x + 3, d.y + 17, 8, hi);
  s.vline(d.x + 12, d.y + 17, 8, lo);
  s.rect(d.x + 11, d.y + 14, 2, 2, handle);
  // step
  s.hline(d.x - 1, d.y + d.h - 1, d.w + 2, lo);
}

function drawWindowFrame(s: Surface, x: number, y: number, wx: number): void {
  const wy = y + STOREFRONT_INSET.winY;
  s.frame(x + wx, wy, STOREFRONT_INSET.winW, STOREFRONT_INSET.winH, C.GRAY_M);
  s.hline(x + wx + 1, wy + STOREFRONT_INSET.winH - 1, STOREFRONT_INSET.winW - 2, C.GRAY_D);
}

function drawGlass(s: Surface, ix: number, iy: number, t: number): void {
  // glare streaks
  s.setAlpha(0.28);
  const off = (t >> 5) % 6 === 0 ? 1 : 0;
  for (let k = 0; k < 5; k++) s.px(ix + 4 + k + off, iy + 8 - k, C.WHITE);
  for (let k = 0; k < 3; k++) s.px(ix + 7 + k + off, iy + 8 - k, C.WHITE);
  s.setAlpha(1);
}

function drawDim(s: Surface, ix: number, iy: number, w: number, h: number): void {
  s.setAlpha(0.62);
  s.rect(ix, iy, w, h, C.BLACK);
  s.setAlpha(1);
  // ordered dither on top so it still reads as a pixel pattern
  for (let r = 0; r < h; r += 2) s.hline(ix, iy + r, w, C.BLACK);
}

function drawBlackFridayTag(s: Surface, x: number, y: number, tick: number): void {
  const bx = x + 52;
  const by = y + 19;
  const hot = (tick >> 3) & 1;
  const outer = hot ? C.YELLOW_L : C.YELLOW;
  // starburst: overlapping rects
  s.rect(bx + 3, by, 18, 18, outer);
  s.rect(bx, by + 3, 24, 12, outer);
  s.rect(bx + 1, by + 1, 22, 16, outer);
  s.px(bx + 11, by - 1, outer);
  s.px(bx + 12, by - 1, outer);
  s.px(bx + 11, by + 18, outer);
  s.px(bx + 12, by + 18, outer);
  s.rect(bx + 2, by + 3, 20, 12, C.BLACK);
  s.rect(bx + 3, by + 4, 18, 10, C.RED);
  s.text('70%', bx + 12, by + 4, C.WHITE, { small: true, align: 'center' });
  s.text('OFF', bx + 12, by + 9, C.YELLOW_L, { small: true, align: 'center' });
}

function drawBanner(s: Surface, x: number, y: number, tick: number): void {
  // CLOSING SALE banner strung across the whole facade
  const by = y + 24 + (((tick >> 5) & 1) === 0 ? 0 : 1);
  s.rect(x + 2, by, 76, 10, C.YELLOW);
  s.hline(x + 2, by, 76, C.YELLOW_L);
  s.hline(x + 2, by + 9, 76, C.ORANGE);
  s.hline(x + 2, by + 1, 76, C.RED);
  s.hline(x + 2, by + 8, 76, C.RED);
  s.text('CLOSING SALE', x + 40, by + 2, C.RED_D, { small: true, align: 'center' });
  s.px(x + 3, by - 1, C.GRAY_L);
  s.px(x + 76, by - 1, C.GRAY_L);
  for (let i = 0; i < 6; i++) {
    s.px(x + 6 + i * 13, by + 5, i & 1 ? C.RED : C.YELLOW);
  }
}

// ---------------------------------------------------------------- main entry

/** Draw the 80x44 storefront with its top-left at (x, y). Never draws outside that box. */
export function drawStorefront(s: Surface, id: StoreId, x: number, y: number, st: StorefrontState): void {
  const def = STORE_BY_ID[id];
  const style = STYLE[id];
  const inset = STOREFRONT_INSET;
  const targetCleared = def.role === 'target' && st.cleared;

  // wall
  s.rect(x, y + 14, STOREFRONT_W, STOREFRONT_H - 14, style.wall);
  s.vline(x, y + 16, 28, C.BLACK);
  s.vline(x + STOREFRONT_W - 1, y + 16, 28, C.BLACK);
  drawSign(s, x, y, id, st);
  drawAwning(s, x, y, style.awning);

  // windows
  const sides: [string, number][] = [
    [def.windowL, inset.winLX],
    [def.windowR, inset.winRX],
  ];
  for (const [disp, wx] of sides) {
    drawWindowFrame(s, x, y, wx);
    const ix = x + wx + 1;
    const iy = y + inset.winY + 1;
    s.clip(ix, iy, inset.innerW, inset.innerH);
    const fn = DISPLAYS[disp];
    if (fn) fn(new Win(s, ix, iy, st.tick));
    else s.rect(ix, iy, inset.innerW, inset.innerH, C.BLACK);
    if (def.role !== 'closed') drawGlass(s, ix, iy, st.tick);
    if (targetCleared) drawDim(s, ix, iy, inset.innerW, inset.innerH);
    // inner top shadow for depth
    s.hline(ix, iy, inset.innerW, C.BLACK);
    s.unclip();
  }

  // sill / kick plate
  s.rect(x, y + inset.sillY, STOREFRONT_W, 3, style.sill);
  s.hline(x, y + inset.sillY, STOREFRONT_W, C.GRAY_D);
  s.hline(x, y + inset.sillY + 2, STOREFRONT_W, C.BLACK);

  drawDoor(s, x, y, id, st);

  if (id === 'borderlinebooks') drawBanner(s, x, y, st.tick);
  if (st.blackFriday && def.role !== 'closed') drawBlackFridayTag(s, x, y, st.tick);
}
