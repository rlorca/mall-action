import { describe, expect, it } from 'vitest';
import { drawHud, drawHudElements, hudLayout, HUD_H, type HudRect } from './hud';
import { Framebuffer } from '../engine/framebuffer';
import type { HudData } from '../game/hud';
import { C } from '../engine/palette';
import { STORES } from '../content/stores';
import { FLOOR_NAMES } from '../content/layout';

const SENTINEL = 0x3d;

function hud(over: Partial<HudData> = {}): HudData {
  return {
    score: 12340,
    packages: 3,
    lives: 3,
    timed: null,
    armor: false,
    radar: false,
    alarm: false,
    floor: 0,
    marquee: null,
    frame: 0,
    ...over,
  };
}

const WORST: HudData = hud({
  score: 999999,
  packages: 6,
  lives: 99,
  timed: { name: 'ORANGE JULI-OOZE', frac: 0.2 },
  armor: true,
  radar: true,
  alarm: true,
  floor: 5,
});

function overlap(a: HudRect, b: HudRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function strayBelow(fb: Framebuffer): number {
  let n = 0;
  for (let y = HUD_H; y < fb.h; y++) for (let x = 0; x < fb.w; x++) if (fb.getPixel(x, y) !== SENTINEL) n++;
  return n;
}

function unpaintedInStrip(fb: Framebuffer): number {
  let n = 0;
  for (let y = 0; y < HUD_H; y++) for (let x = 0; x < fb.w; x++) if (fb.getPixel(x, y) === SENTINEL) n++;
  return n;
}

function fresh(): Framebuffer {
  const fb = new Framebuffer();
  fb.clear(SENTINEL);
  return fb;
}

describe('HUD layout', () => {
  const states: Array<[string, HudData]> = [
    ['plain', hud()],
    ['worst case (everything on, floor panel)', WORST],
    ['worst case inside a store (marquee)', { ...WORST, floor: null, marquee: 'BLOCKBLUSTER VIDEO' }],
    ['no floor and no marquee', hud({ floor: null })],
    ['long power-up name', hud({ timed: { name: 'AN EXTREMELY LONG POWER UP NAME', frac: 1 } })],
    ['zero everything', hud({ score: 0, packages: 0, lives: 0 })],
    ['out of range values', hud({ score: 12345678, packages: 9, lives: 250, timed: { name: 'RAPID FIRE', frac: 7 } })],
  ];

  for (const [name, h] of states) {
    it(`${name}: every element is inside the 256x16 strip and no two overlap`, () => {
      const rects = hudLayout(h);
      for (const r of rects) {
        expect(r.x, `${r.id}.x`).toBeGreaterThanOrEqual(0);
        expect(r.y, `${r.id}.y`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, `${r.id} right edge`).toBeLessThanOrEqual(256);
        expect(r.y + r.h, `${r.id} bottom edge`).toBeLessThanOrEqual(HUD_H);
      }
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(overlap(rects[i]!, rects[j]!), `${rects[i]!.id} vs ${rects[j]!.id}`).toBe(false);
        }
      }
    });

    it(`${name}: draws only inside y 0..15 and paints the whole strip`, () => {
      for (const frame of [0, 5, 11, 40, 77, 123]) {
        const fb = fresh();
        drawHud(fb, { ...h, frame });
        expect(strayBelow(fb), `frame ${frame}: pixels drawn below the strip`).toBe(0);
        expect(unpaintedInStrip(fb), `frame ${frame}: unpainted pixels in the strip`).toBe(0);
      }
    });

    it(`${name}: each element draws only inside its own rectangle`, () => {
      for (const frame of [0, 9, 20, 61]) {
        for (const r of hudLayout({ ...h, frame })) {
          const fb = fresh();
          drawHudElements(fb, { ...h, frame }, r.id);
          let outside = 0;
          for (let y = 0; y < fb.h; y++) {
            for (let x = 0; x < fb.w; x++) {
              if (fb.getPixel(x, y) === SENTINEL) continue;
              if (!(x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) outside++;
            }
          }
          expect(outside, `${r.id} drew pixels outside its rect (frame ${frame})`).toBe(0);
        }
      }
    });
  }

  it('the store marquee fits the panel for every store name and scrolls', () => {
    for (const s of STORES) {
      const a = fresh();
      const b = fresh();
      drawHud(a, hud({ floor: null, marquee: s.name, frame: 0 }));
      drawHud(b, hud({ floor: null, marquee: s.name, frame: 30 }));
      for (const fb of [a, b]) expect(strayBelow(fb)).toBe(0);
      expect(a.hash(), s.name).not.toBe(b.hash());
    }
  });
});

describe('HUD content', () => {
  it('PKG is red until all six are found, then green', () => {
    const probe = (packages: number): Set<number> => {
      const fb = fresh();
      drawHud(fb, hud({ packages }));
      const r = hudLayout(hud({ packages })).find((x) => x.id === 'pkg')!;
      const cols = new Set<number>();
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cols.add(fb.getPixel(x, y));
      return cols;
    };
    expect(probe(5).has(C.RED)).toBe(true);
    expect(probe(5).has(C.GREEN)).toBe(false);
    expect(probe(6).has(C.GREEN)).toBe(true);
    expect(probe(6).has(C.RED)).toBe(false);
  });

  it('ALARM blinks', () => {
    const shown = new Set<boolean>();
    const r = hudLayout(hud({ alarm: true })).find((x) => x.id === 'alarm')!;
    for (let frame = 0; frame < 32; frame++) {
      const fb = fresh();
      drawHud(fb, hud({ alarm: true, frame }));
      shown.add(fb.getPixel(r.x + 1, r.y + 1) === C.RED);
    }
    expect(shown.has(true)).toBe(true);
    expect(shown.has(false)).toBe(true);
    // and it is absent when not alarmed
    expect(hudLayout(hud({ alarm: false })).some((x) => x.id === 'alarm')).toBe(false);
  });

  it('the LED floor panel lights exactly the current floor', () => {
    const lit = (floor: number): number[] => {
      const fb = fresh();
      drawHud(fb, hud({ floor }));
      // sample the top-left pixel of each cell: lit cells are filled red
      const out: number[] = [];
      const panel = hudLayout(hud()).find((x) => x.id === 'panel')!;
      const cellsW = FLOOR_NAMES.length * 9 + (FLOOR_NAMES.length - 1);
      const x0 = panel.x + Math.floor((panel.w - cellsW) / 2);
      for (let i = 0; i < FLOOR_NAMES.length; i++) if (fb.getPixel(x0 + i * 10, panel.y + 2) === C.RED) out.push(i);
      return out;
    };
    for (let f = 0; f < 6; f++) expect(lit(f)).toEqual([f]);
  });

  it('timed power-up bar drains', () => {
    const filled = (frac: number): number => {
      const fb = fresh();
      drawHud(fb, hud({ timed: { name: 'RAPID FIRE', frac } }));
      const bar = hudLayout(hud({ timed: { name: 'RAPID FIRE', frac } })).find((x) => x.id === 'timedBar')!;
      let n = 0;
      for (let x = bar.x + 1; x < bar.x + bar.w - 1; x++) if ([C.GREEN, C.YELLOW, C.RED, C.SALMON].includes(fb.getPixel(x, bar.y + 1) as never)) n++;
      return n;
    };
    expect(filled(1)).toBeGreaterThan(filled(0.5));
    expect(filled(0.5)).toBeGreaterThan(filled(0.1));
    expect(filled(0)).toBe(0);
  });

  it('is deterministic for the same input', () => {
    const a = fresh();
    const b = fresh();
    drawHud(a, WORST);
    drawHud(b, WORST);
    expect(a.hash()).toBe(b.hash());
  });
});
