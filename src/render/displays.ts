import { C } from './palette';
import { blank, disc, frame, hline, px, rect, ring, vline, type ColorTriple, type Sprite } from './pixels';
import type { WindowDisplay } from '../core/storeDefs';

/**
 * Storefront window displays. 24x20 each, 1-3 frames of idle animation.
 *
 * The rule these exist for: you must be able to tell what a store sells from
 * its window WITHOUT reading the sign. Keep that true when editing.
 */

export const DISPLAY_W = 24;
export const DISPLAY_H = 20;

const d = (colors: ColorTriple): Sprite => blank(DISPLAY_W, DISPLAY_H, colors);

/** A mannequin torso on a stand. */
function mannequin(s: Sprite, x: number, c: number, outfit: number): void {
  disc(s, x, 4, 2, c);
  rect(s, x - 3, 7, 7, 6, outfit);
  rect(s, x - 4, 7, 2, 4, outfit);
  rect(s, x + 3, 7, 2, 4, outfit);
  rect(s, x - 2, 13, 2, 4, c);
  rect(s, x + 1, 13, 2, 4, c);
  hline(s, x - 4, 18, 9, c);
}

function makeFrames(kind: WindowDisplay): Sprite[] {
  switch (kind) {
    case 'mannequins': {
      return [0, 1].map((f) => {
        const s = d([C.TAN, C.MAGENTA, C.CYAN]);
        mannequin(s, 6, 1, 2);
        mannequin(s, 17, 1, 3);
        // A blinking spotlight.
        if (f === 0) hline(s, 2, 0, 20, 2);
        return s;
      });
    }
    case 'clothingRack': {
      return [0, 1].map((f) => {
        const s = d([C.GREY, C.PINK, C.LIGHTBLUE]);
        hline(s, 2, 3, 20, 1);
        vline(s, 3, 3, 16, 1);
        vline(s, 20, 3, 16, 1);
        for (let i = 0; i < 5; i++) {
          const x = 4 + i * 4;
          const sway = (i + f) % 2;
          vline(s, x, 3, 2, 1);
          rect(s, x - 1 + sway, 5, 3, 9, i % 2 ? 2 : 3);
        }
        return s;
      });
    }
    case 'tvStatic': {
      // Stacked TVs flickering with static.
      return [0, 1, 2].map((f) => {
        const s = d([C.DARKGREY, C.LIGHTGREY, C.WHITE]);
        for (let i = 0; i < 4; i++) {
          const x = (i % 2) * 12 + 1;
          const y = Math.floor(i / 2) * 10 + 1;
          rect(s, x, y, 10, 8, 1);
          rect(s, x + 1, y + 1, 8, 5, 2);
          for (let sy = 0; sy < 5; sy++) {
            for (let sx = 0; sx < 8; sx++) {
              if ((sx * 7 + sy * 13 + f * 5 + i * 3) % 3 === 0) px(s, x + 1 + sx, y + 1 + sy, 3);
            }
          }
        }
        return s;
      });
    }
    case 'walkieTalkies': {
      return [0, 1].map((f) => {
        const s = d([C.DARKGREY, C.OLIVE, C.RED]);
        for (const x of [5, 16]) {
          rect(s, x - 3, 5, 7, 13, 2);
          frame(s, x - 3, 5, 7, 13, 1);
          rect(s, x - 2, 7, 5, 3, 1);
          vline(s, x + 2, 0, 5, 1);
          if (f === 0) px(s, x + 2, 0, 3);
          rect(s, x - 2, 12, 5, 4, 1);
        }
        return s;
      });
    }
    case 'massageChair': {
      return [0, 1].map((f) => {
        const s = d([C.DARKBROWN, C.BROWN, C.TAN]);
        // Reclined chair.
        rect(s, 4, 6 + f, 12, 9, 2);
        rect(s, 3, 4 + f, 5, 11, 1);
        rect(s, 15, 12, 6, 3, 1);
        rect(s, 5, 8 + f, 9, 2, 3);
        hline(s, 3, 16, 18, 1);
        rect(s, 5, 17, 2, 3, 1);
        rect(s, 17, 17, 2, 3, 1);
        return s;
      });
    }
    case 'gadgetPedestals': {
      return [0, 1, 2].map((f) => {
        const s = d([C.GREY, C.LIGHTGREY, C.CYAN]);
        for (let i = 0; i < 3; i++) {
          const x = 4 + i * 8;
          rect(s, x - 2, 13, 5, 7, 1);
          rect(s, x - 3, 11, 7, 2, 2);
          if (i === f % 3) disc(s, x, 7, 3, 3);
          else disc(s, x, 8, 2, 2);
        }
        return s;
      });
    }
    case 'consoleStack': {
      return [0, 1].map((f) => {
        const s = d([C.DARKGREY, C.LIGHTGREY, C.RED]);
        // A console with cartridges stacked beside it.
        rect(s, 1, 12, 12, 6, 2);
        frame(s, 1, 12, 12, 6, 1);
        rect(s, 3, 14, 8, 2, 1);
        if (f === 0) px(s, 11, 13, 3);
        for (let i = 0; i < 4; i++) {
          rect(s, 15, 17 - i * 4, 8, 3, i % 2 ? 2 : 3);
          frame(s, 15, 17 - i * 4, 8, 3, 1);
        }
        return s;
      });
    }
    case 'rocketPoster': {
      return [0, 1, 2].map((f) => {
        const s = d([C.NAVY, C.WHITE, C.ORANGE]);
        rect(s, 0, 0, 13, 20, 1);
        // "TO THE MOON" rocket.
        rect(s, 5, 4, 3, 8, 2);
        px(s, 6, 2, 2);
        px(s, 5, 3, 2);
        px(s, 7, 3, 2);
        rect(s, 4, 10, 1, 3, 2);
        rect(s, 8, 10, 1, 3, 2);
        for (let i = 0; i < 3 + f; i++) rect(s, 5, 12 + i, 3, 1, 3);
        // Demo TV beside it.
        rect(s, 15, 6, 9, 8, 2);
        frame(s, 15, 6, 9, 8, 1);
        for (let y = 7; y < 13; y += 2) hline(s, 16, y + (f % 2), 7, 1);
        return s;
      });
    }
    case 'teddyBears': {
      return [0, 1].map((f) => {
        const s = d([C.DARKBROWN, C.BROWN, C.RED]);
        for (const x of [6, 17]) {
          disc(s, x, 9, 4, 2);
          disc(s, x - 3, 5, 2, 2);
          disc(s, x + 3, 5, 2, 2);
          // Fur hats.
          rect(s, x - 4, 2, 9, 3, 1);
          rect(s, x - 3, 1, 7, 2, 3);
          px(s, x - 2, 8 + (f % 2), 1);
          px(s, x + 2, 8 + (f % 2), 1);
          rect(s, x - 1, 11, 3, 1, 1);
          rect(s, x - 5, 13, 11, 5, 2);
        }
        return s;
      });
    }
    case 'robotRocket': {
      return [0, 1, 2].map((f) => {
        const s = d([C.GREY, C.LIGHTGREY, C.RED]);
        // Tin robot.
        rect(s, 2, 6, 9, 9, 2);
        frame(s, 2, 6, 9, 9, 1);
        rect(s, 4, 8, 2, 2, f % 2 ? 3 : 1);
        rect(s, 8, 8, 2, 2, f % 2 ? 3 : 1);
        rect(s, 4, 12, 5, 1, 1);
        vline(s, 6, 3, 3, 1);
        px(s, 6, 2, 3);
        rect(s, 1, 15, 3, 5, 1);
        rect(s, 9, 15, 3, 5, 1);
        // Toy rocket.
        rect(s, 17, 6, 4, 9, 3);
        px(s, 18, 4, 3);
        px(s, 19, 3, 3);
        rect(s, 16, 13, 1, 3, 1);
        rect(s, 21, 13, 1, 3, 1);
        rect(s, 17, 15, 4, 1 + f, 2);
        return s;
      });
    }
    case 'forLease': {
      const s = d([C.DARKGREY, C.WHITE, C.RED]);
      rect(s, 0, 0, DISPLAY_W, DISPLAY_H, 1);
      rect(s, 4, 5, 16, 10, 2);
      frame(s, 4, 5, 16, 10, 3);
      hline(s, 6, 8, 12, 3);
      hline(s, 6, 11, 8, 3);
      return [s];
    }
    case 'vhsPoster': {
      const s = d([C.DARKGREY, C.OLIVE, C.TAN]);
      rect(s, 0, 0, DISPLAY_W, DISPLAY_H, 1);
      // A faded VHS box.
      rect(s, 6, 3, 12, 15, 2);
      frame(s, 6, 3, 12, 15, 3);
      rect(s, 8, 6, 8, 5, 3);
      hline(s, 8, 14, 8, 3);
      return [s];
    }
    case 'lavaLamp': {
      return [0, 1, 2].map((f) => {
        const s = d([C.PURPLE, C.MAGENTA, C.LIGHTORANGE]);
        rect(s, 8, 17, 8, 3, 1);
        rect(s, 8, 1, 8, 2, 1);
        // Glass body.
        for (let y = 3; y < 17; y++) {
          const w = 8 - Math.abs(y - 10) / 3;
          rect(s, 12 - w / 2, y, w, 1, 2);
        }
        disc(s, 12, 6 + f * 3, 2, 3);
        disc(s, 11, 14 - f * 2, 1, 3);
        return s;
      });
    }
    case 'plasmaBall': {
      return [0, 1, 2].map((f) => {
        const s = d([C.DARKGREY, C.VIOLET, C.PALEPINK]);
        rect(s, 9, 16, 6, 4, 1);
        ring(s, 12, 10, 7, 2);
        ring(s, 12, 10, 6, 2);
        disc(s, 12, 10, 2, 3);
        for (let a = 0; a < 5; a++) {
          const t = ((a + f * 0.3) / 5) * Math.PI * 2;
          for (let r = 2; r < 7; r++) {
            px(s, Math.round(12 + Math.cos(t + r * 0.2) * r), Math.round(10 + Math.sin(t + r * 0.2) * r), 3);
          }
        }
        return s;
      });
    }
    case 'tapesVinyl': {
      return [0, 1].map((f) => {
        const s = d([C.BLACK, C.LIGHTGREY, C.ORANGE]);
        // Vinyl records.
        for (const x of [6, 17]) {
          disc(s, x, 6, 5, 1);
          ring(s, x, 6, 5, 2);
          disc(s, x, 6, 2, 3);
          px(s, x, 6, 2);
        }
        // Cassette tapes.
        for (let i = 0; i < 3; i++) {
          const y = 13 + (i % 2);
          rect(s, 2 + i * 7, y, 6, 5, 2);
          frame(s, 2 + i * 7, y, 6, 5, 1);
          px(s, 3 + i * 7 + (f % 2), y + 2, 1);
          px(s, 6 + i * 7, y + 2, 1);
        }
        return s;
      });
    }
    case 'boombox': {
      return [0, 1, 2].map((f) => {
        const s = d([C.DARKGREY, C.LIGHTGREY, C.RED]);
        rect(s, 1, 5, 22, 12, 2);
        frame(s, 1, 5, 22, 12, 1);
        // Bouncing speakers.
        const r = 4 + (f === 1 ? 1 : 0);
        disc(s, 6, 11, r, 1);
        ring(s, 6, 11, r, 3);
        disc(s, 18, 11, r, 1);
        ring(s, 18, 11, r, 3);
        rect(s, 10, 7, 5, 4, 1);
        rect(s, 10, 13, 5, 2, 1);
        // Handle.
        hline(s, 8, 3, 9, 1);
        px(s, 8, 4, 1);
        px(s, 16, 4, 1);
        return s;
      });
    }
    case 'robotVacuum': {
      return [0, 1, 2].map((f) => {
        const s = d([C.DARKGREY, C.LIGHTGREY, C.LIGHTGREEN]);
        const x = 5 + f * 6;
        disc(s, x, 14, 5, 2);
        ring(s, x, 14, 5, 1);
        px(s, x, 12, 3);
        // Dust trail it just cleaned.
        for (let i = 0; i < x - 2; i += 3) px(s, i, 19, 1);
        hline(s, 0, 19, DISPLAY_W, 1);
        return s;
      });
    }
    case 'glowingOrb': {
      return [0, 1, 2].map((f) => {
        const s = d([C.DARKGREY, C.CYAN, C.PALECYAN]);
        rect(s, 10, 16, 4, 4, 1);
        const r = 5 + (f % 3);
        disc(s, 12, 9, r, 2);
        disc(s, 12, 9, Math.max(1, r - 2), 3);
        ring(s, 12, 9, 7, 1);
        return s;
      });
    }
    case 'lemonadeTub': {
      return [0, 1, 2].map((f) => {
        const s = d([C.WHITE, C.PALEYELLOW, C.OLIVE]);
        // The tub.
        rect(s, 3, 7, 18, 11, 2);
        frame(s, 3, 7, 18, 11, 3);
        // The pump handle, pumping.
        const py = 2 + (f === 1 ? 2 : 0);
        rect(s, 11, py, 3, 6, 3);
        hline(s, 8, py, 9, 1);
        // Lemon slices floating.
        disc(s, 7, 10 + (f % 2), 2, 1);
        disc(s, 17, 12 - (f % 2), 2, 1);
        return s;
      });
    }
    case 'cornDogs': {
      return [0, 1].map((f) => {
        const s = d([C.BROWN, C.LIGHTORANGE, C.PALEYELLOW]);
        for (let i = 0; i < 4; i++) {
          const x = 3 + i * 6;
          const y = 3 + ((i + f) % 2);
          rect(s, x, y, 4, 10, 2);
          rect(s, x + 1, y + 1, 2, 8, 3);
          vline(s, x + 1, y + 10, 5, 1);
          vline(s, x + 2, y + 10, 5, 1);
        }
        return s;
      });
    }
    case 'deadTvs': {
      const s = d([C.DARKGREY, C.GREY, C.BLACK]);
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * 12 + 1;
        const y = Math.floor(i / 2) * 10 + 1;
        rect(s, x, y, 10, 8, 2);
        rect(s, x + 1, y + 1, 8, 5, 3);
        frame(s, x, y, 10, 8, 1);
      }
      return [s];
    }
    case 'sneakerWall': {
      return [0, 1].map((f) => {
        const s = d([C.WHITE, C.RED, C.BLUE]);
        for (let row = 0; row < 3; row++) {
          hline(s, 0, 6 + row * 6, DISPLAY_W, 1);
          for (let i = 0; i < 4; i++) {
            const x = 1 + i * 6;
            const y = 2 + row * 6;
            const c = (i + row + f) % 2 ? 2 : 3;
            rect(s, x, y + 2, 5, 2, c);
            rect(s, x, y, 3, 3, 1);
            px(s, x + 1, y + 1, c);
          }
        }
        return s;
      });
    }
    case 'basketballs': {
      return [0, 1].map((f) => {
        const s = d([C.BLACK, C.ORANGE, C.WHITE]);
        for (let i = 0; i < 2; i++) {
          const cx = 5 + i * 7;
          const cy = 13 - (i === f % 2 ? 2 : 0);
          disc(s, cx, cy, 4, 2);
          ring(s, cx, cy, 4, 1);
          vline(s, cx, cy - 4, 9, 1);
          hline(s, cx - 4, cy, 9, 1);
        }
        // A hanging jersey.
        rect(s, 15, 2, 8, 12, 3);
        rect(s, 13, 3, 3, 4, 3);
        rect(s, 22, 3, 2, 4, 3);
        rect(s, 17, 6, 4, 5, 1);
        return s;
      });
    }
    case 'closingSale': {
      const s = d([C.DARKGREY, C.YELLOW, C.RED]);
      rect(s, 0, 0, DISPLAY_W, DISPLAY_H, 1);
      rect(s, 1, 6, 22, 8, 2);
      frame(s, 1, 6, 22, 8, 3);
      hline(s, 3, 9, 18, 3);
      hline(s, 3, 11, 12, 3);
      return [s];
    }
  }
}

const CACHE = new Map<WindowDisplay, Sprite[]>();

/** All animation frames for a display kind. */
export function displayFrames(kind: WindowDisplay): Sprite[] {
  let f = CACHE.get(kind);
  if (!f) {
    f = makeFrames(kind);
    CACHE.set(kind, f);
  }
  return f;
}

export const ALL_DISPLAY_KINDS: readonly WindowDisplay[] = [
  'mannequins', 'clothingRack', 'tvStatic', 'walkieTalkies', 'massageChair', 'gadgetPedestals',
  'consoleStack', 'rocketPoster', 'teddyBears', 'robotRocket', 'forLease', 'vhsPoster',
  'lavaLamp', 'plasmaBall', 'tapesVinyl', 'boombox', 'robotVacuum', 'glowingOrb',
  'lemonadeTub', 'cornDogs', 'deadTvs', 'sneakerWall', 'basketballs', 'closingSale',
];
