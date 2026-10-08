import { describe, expect, it } from 'vitest';
import './index';
import { Framebuffer } from '../engine/framebuffer';
import { C, darken } from '../engine/palette';
import { FONT_TINY, textWidth } from '../engine/font';
import { CLOSED_STORES, OPEN_STORES, STORES, STORE_W, TARGET_STORES, type StoreDef } from '../content/stores';
import { drawStorefront, STOREFRONT_H, type StorefrontOpts } from './storefront';
import { windowFrameIndex } from './storefronts';
import { getSprite } from './registry';

const SENTINEL = 0x3f;
const X0 = 20;
const Y0 = 30;

function render(s: StoreDef, opts: StorefrontOpts, x = X0, y = Y0): Framebuffer {
  const fb = new Framebuffer();
  fb.clear(SENTINEL);
  drawStorefront(fb, x, y, s.id, opts);
  return fb;
}

/** Hash of one rectangle of the framebuffer. */
function rectHash(fb: Framebuffer, x: number, y: number, w: number, h: number): number {
  let hash = 0x811c9dc5;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      hash ^= fb.getPixel(x + xx, y + yy);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return hash >>> 0;
}

const DOOR = { x: X0 + 30, y: Y0 + 10, w: 20, h: 28 };
const WIN_L = { x: X0 + 2, y: Y0 + 10, w: 28, h: 28 };
const WIN_R = { x: X0 + 50, y: Y0 + 10, w: 28, h: 28 };
const doorHash = (fb: Framebuffer): number => rectHash(fb, DOOR.x, DOOR.y, DOOR.w, DOOR.h);

describe('drawStorefront', () => {
  it('draws every store, many frames and option combinations, without throwing', () => {
    for (const s of STORES) {
      for (const frame of [0, 1, 7, 16, 31, 32, 59, 600, 12345]) {
        for (const cleared of [false, true]) {
          for (const blackFriday of [false, true]) {
            expect(() => render(s, { frame, cleared, blackFriday }), `${s.id} f${frame}`).not.toThrow();
          }
        }
      }
    }
  });

  it('is deterministic', () => {
    for (const s of STORES) {
      expect(render(s, { frame: 37 }).hash(), s.id).toBe(render(s, { frame: 37 }).hash());
    }
  });

  it('never draws outside its 80x40 box, even with every overlay on', () => {
    for (const s of STORES) {
      const fb = render(s, { frame: 21, cleared: true, blackFriday: true });
      let stray = 0;
      for (let y = 0; y < fb.h; y++) {
        for (let x = 0; x < fb.w; x++) {
          const inside = x >= X0 && x < X0 + STORE_W && y >= Y0 && y < Y0 + STOREFRONT_H;
          if (!inside && fb.getPixel(x, y) !== SENTINEL) stray++;
        }
      }
      expect(stray, s.id).toBe(0);
      // and the box itself is fully painted (no holes through to the mall behind)
      let holes = 0;
      for (let y = Y0; y < Y0 + STOREFRONT_H; y++) for (let x = X0; x < X0 + STORE_W; x++) if (fb.getPixel(x, y) === SENTINEL) holes++;
      expect(holes, s.id).toBe(0);
    }
  });

  it('copes with storefronts that are partly or fully off screen (the mall scrolls)', () => {
    for (const s of STORES) {
      for (const [x, y] of [[-30, 10], [-79, 10], [200, 100], [250, 230], [-200, -200], [20.4, 30.6]] as const) {
        expect(() => render(s, { frame: 5, blackFriday: true }, x, y), `${s.id} @${x},${y}`).not.toThrow();
      }
    }
    // a partly clipped storefront must not leak into the other side of the screen
    const fb = new Framebuffer();
    fb.clear(SENTINEL);
    drawStorefront(fb, -40, 100, 'forever12', { frame: 0 });
    for (let y = 0; y < fb.h; y++) for (let x = 40; x < fb.w; x++) expect(fb.getPixel(x, y)).toBe(SENTINEL);
  });

  it('respects an existing clip rectangle', () => {
    const fb = new Framebuffer();
    fb.clear(SENTINEL);
    fb.pushClip(0, 0, X0 + 10, 256);
    drawStorefront(fb, X0, Y0, 'kgbtoys', { frame: 0 });
    fb.popClip();
    for (let y = 0; y < fb.h; y++) for (let x = X0 + 10; x < fb.w; x++) expect(fb.getPixel(x, y)).toBe(SENTINEL);
  });

  it('colours the sign by role, with the name centred and inside the plate', () => {
    const plate: Record<StoreDef['role'], number> = { target: C.RED, powerup: C.BLUE, closed: C.BLACK };
    const text: Record<StoreDef['role'], number> = { target: C.WHITE, powerup: C.WHITE, closed: C.GRAY };
    for (const s of STORES) {
      expect(textWidth(s.name, { font: FONT_TINY }), s.name).toBeLessThanOrEqual(STORE_W - 4);
      const fb = render(s, { frame: 0 });
      expect(fb.getPixel(X0 + 2, Y0 + 8), `${s.id} plate colour`).toBe(plate[s.role]);
      let left = Infinity;
      let right = -Infinity;
      for (let y = Y0 + 2; y <= Y0 + 6; y++) {
        for (let x = X0 + 1; x < X0 + STORE_W - 1; x++) {
          if (fb.getPixel(x, y) === text[s.role]) {
            left = Math.min(left, x - X0);
            right = Math.max(right, x - X0);
          }
        }
      }
      expect(left, `${s.id} has text`).toBeGreaterThan(0);
      const leftMargin = left;
      const rightMargin = STORE_W - 1 - right;
      expect(leftMargin, `${s.id} left margin`).toBeGreaterThanOrEqual(2);
      expect(rightMargin, `${s.id} right margin`).toBeGreaterThanOrEqual(2);
      expect(Math.abs(leftMargin - rightMargin), `${s.id} centred`).toBeLessThanOrEqual(3);
    }
  });

  it('target doors blink between two clearly different looks; other doors do not', () => {
    for (const s of TARGET_STORES) {
      const seen = new Set<number>();
      for (let f = 0; f < 64; f++) seen.add(doorHash(render(s, { frame: f })));
      expect(seen.size, `${s.id} door blinks`).toBe(2);
      // dim for 16 frames, bright for 16 frames
      expect(doorHash(render(s, { frame: 0 }))).toBe(doorHash(render(s, { frame: 15 })));
      expect(doorHash(render(s, { frame: 0 }))).not.toBe(doorHash(render(s, { frame: 16 })));
      expect(doorHash(render(s, { frame: 16 }))).toBe(doorHash(render(s, { frame: 31 })));
      expect(doorHash(render(s, { frame: 0 }))).toBe(doorHash(render(s, { frame: 32 })));
      // the Black Friday tag must not hide the blink
      expect(doorHash(render(s, { frame: 0, blackFriday: true })), `${s.id} blinks on black friday`).not.toBe(
        doorHash(render(s, { frame: 16, blackFriday: true })),
      );
    }
    for (const s of STORES.filter((x) => x.role === 'powerup')) {
      const seen = new Set<number>();
      for (let f = 0; f < 64; f++) seen.add(doorHash(render(s, { frame: f })));
      expect(seen.size, `${s.id} door is steady`).toBe(1);
    }
  });

  it('closed storefronts never change: no blinking, no animation, no Black Friday sign, no clearing', () => {
    for (const s of CLOSED_STORES) {
      const base = render(s, { frame: 0 }).hash();
      for (const f of [1, 7, 16, 17, 33, 100, 999]) expect(render(s, { frame: f }).hash(), `${s.id} f${f}`).toBe(base);
      expect(render(s, { frame: 40, blackFriday: true }).hash(), `${s.id} black friday`).toBe(base);
      expect(render(s, { frame: 40, cleared: true }).hash(), `${s.id} cleared`).toBe(base);
    }
  });

  it('cleared targets look different: dark door, dimmed windows, no blinking', () => {
    for (const s of TARGET_STORES) {
      const normal = render(s, { frame: 0 });
      const cleared = render(s, { frame: 0, cleared: true });
      expect(cleared.hash(), s.id).not.toBe(normal.hash());
      expect(doorHash(cleared), `${s.id} door`).not.toBe(doorHash(normal));
      // door stays dark through both blink phases
      expect(doorHash(render(s, { frame: 16, cleared: true })), `${s.id} cleared door steady`).toBe(doorHash(cleared));
      // every window pixel is exactly the normal pixel, one luminance step darker
      for (const win of [WIN_L, WIN_R]) {
        for (let y = win.y; y < win.y + win.h; y++) {
          for (let x = win.x; x < win.x + win.w; x++) {
            expect(cleared.getPixel(x, y), `${s.id} @${x},${y}`).toBe(darken(normal.getPixel(x, y), 1));
          }
        }
      }
    }
  });

  it('only targets can be cleared', () => {
    for (const s of STORES.filter((x) => x.role === 'powerup')) {
      expect(render(s, { frame: 3, cleared: true }).hash(), s.id).toBe(render(s, { frame: 3 }).hash());
    }
  });

  it('Black Friday adds a 70% OFF sign to every open storefront and nothing to closed ones', () => {
    for (const s of OPEN_STORES) {
      const normal = render(s, { frame: 9 });
      const bf = render(s, { frame: 9, blackFriday: true });
      expect(bf.hash(), s.id).not.toBe(normal.hash());
      // the sign is yellow and sits under the name plate; the plate itself is untouched
      let yellow = 0;
      for (let y = Y0 + 10; y < Y0 + 30; y++) for (let x = X0 + 20; x < X0 + 60; x++) if (bf.getPixel(x, y) === C.YELLOW) yellow++;
      expect(yellow, `${s.id} yellow sign`).toBeGreaterThan(60);
      expect(rectHash(bf, X0, Y0, STORE_W, 10), `${s.id} plate`).toBe(rectHash(normal, X0, Y0, STORE_W, 10));
      // it must not hide the door's handle area (the door can still be read and entered)
      expect(rectHash(bf, DOOR.x, DOOR.y + 20, DOOR.w, 8), `${s.id} lower door`).toBe(rectHash(normal, DOOR.x, DOOR.y + 20, DOOR.w, 8));
    }
    for (const s of CLOSED_STORES) {
      expect(render(s, { frame: 9, blackFriday: true }).hash(), s.id).toBe(render(s, { frame: 9 }).hash());
    }
  });

  it('the Black Friday sign also appears on cleared target stores (still open)', () => {
    for (const s of TARGET_STORES) {
      expect(render(s, { frame: 0, cleared: true, blackFriday: true }).hash(), s.id).not.toBe(render(s, { frame: 0, cleared: true }).hash());
    }
  });
});

describe('storefront window displays', () => {
  it('every open store has two distinct, animated windows', () => {
    for (const s of OPEN_STORES) {
      for (const side of ['L', 'R'] as const) {
        const spr = getSprite(`win.${s.id}.${side}`);
        expect(spr.frames, `${s.id}.${side}`).toBeGreaterThanOrEqual(2);
        expect(spr.frames, `${s.id}.${side}`).toBeLessThanOrEqual(3);
        const shown = new Set<number>();
        for (let f = 0; f < 600; f++) {
          const idx = windowFrameIndex(s.id, side, f);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(spr.frames);
          shown.add(idx);
        }
        expect(shown.size, `${s.id}.${side} animates`).toBeGreaterThanOrEqual(2);
        // the frames really differ
        const size = spr.w * spr.h;
        const first = spr.data.subarray(0, size);
        let differs = false;
        for (let fr = 1; fr < spr.frames && !differs; fr++) {
          const other = spr.data.subarray(fr * size, (fr + 1) * size);
          for (let i = 0; i < size; i++) if (other[i] !== first[i]) differs = true;
        }
        expect(differs, `${s.id}.${side} frames differ`).toBe(true);
      }
    }
  });

  it('closed stores show frozen windows', () => {
    for (const s of CLOSED_STORES) {
      for (const side of ['L', 'R'] as const) {
        const spr = getSprite(`win.${s.id}.${side}`);
        const size = spr.w * spr.h;
        for (let fr = 1; fr < spr.frames; fr++) {
          expect(Array.from(spr.data.subarray(fr * size, (fr + 1) * size)), `${s.id}.${side}`).toEqual(Array.from(spr.data.subarray(0, size)));
        }
      }
    }
  });

  it('no two windows are the same picture', () => {
    const seen = new Map<string, string>();
    for (const s of STORES) {
      for (const side of ['L', 'R'] as const) {
        const spr = getSprite(`win.${s.id}.${side}`);
        const key = `${spr.colors.join(',')}|${Array.from(spr.data.subarray(0, spr.w * spr.h)).join(',')}`;
        expect(seen.get(key), `${s.id}.${side} duplicates ${seen.get(key)}`).toBeUndefined();
        seen.set(key, `${s.id}.${side}`);
      }
    }
    expect(seen.size).toBe(26);
  });

  it('the windows of neighbouring stores do not animate in lockstep', () => {
    const phase = (id: (typeof STORES)[number]['id']): number => {
      for (let f = 0; f < 200; f++) if (windowFrameIndex(id, 'L', f) !== windowFrameIndex(id, 'L', 0)) return f;
      return -1;
    };
    const phases = new Set(OPEN_STORES.map((s) => phase(s.id)));
    expect(phases.size).toBeGreaterThan(3);
  });
});
