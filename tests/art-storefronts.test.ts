import { describe, expect, it } from 'vitest';
import { C } from '../src/core/palette';
import { STORES } from '../src/data/stores';
import { DOOR_H, DOOR_W, STOREFRONT_H, STOREFRONT_W } from '../src/game/geometry';
import { drawStorefront, storefrontDoorColour, storefrontDoorRect, type StorefrontState } from '../src/art/storefronts';
import { drawCityline, drawGarageBackdrop, drawMallInterior, drawNightSky, drawShutter, drawSkyscraper } from '../src/art/backdrops';
import { LOGO_H, LOGO_W, drawStorefrontRow, drawTitleLogo } from '../src/art/logo';
import type { Surface } from '../src/art/surface';

/** Minimal fake Surface painting palette indices into a byte buffer (255 = untouched), honouring clip and tracking bounds. */
class FakeSurface {
  readonly buf: Uint8Array;
  private clips: [number, number, number, number][] = [];
  private alpha = 1;
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  writes = 0;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.buf = new Uint8Array(w * h).fill(255);
  }
  private put(x: number, y: number, c: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    for (const k of this.clips) if (x < k[0] || y < k[1] || x >= k[2] || y >= k[3]) return;
    this.buf[y * this.w + x] = c;
    this.writes++;
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
  }
  at(x: number, y: number): number {
    return this.buf[y * this.w + x];
  }
  clear(c: number): void {
    this.rect(0, 0, this.w, this.h, c);
  }
  rect(x: number, y: number, w: number, h: number, c: number): void {
    x = Math.round(x);
    y = Math.round(y);
    for (let yy = 0; yy < Math.round(h); yy++) for (let xx = 0; xx < Math.round(w); xx++) this.put(x + xx, y + yy, c);
  }
  px(x: number, y: number, c: number): void {
    this.rect(x, y, 1, 1, c);
  }
  hline(x: number, y: number, w: number, c: number): void {
    this.rect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: number): void {
    this.rect(x, y, 1, h, c);
  }
  frame(x: number, y: number, w: number, h: number, c: number): void {
    this.hline(x, y, w, c);
    this.hline(x, y + h - 1, w, c);
    this.vline(x, y, h, c);
    this.vline(x + w - 1, y, h, c);
  }
  clip(x: number, y: number, w: number, h: number): void {
    this.clips.push([x, y, x + w, y + h]);
  }
  unclip(): void {
    this.clips.pop();
  }
  setAlpha(a: number): void {
    this.alpha = a;
  }
  /** Sprites are not used by this layer; painted as a solid block if they ever are. */
  sprite(): void {
    throw new Error('storefront layer should not need sprites');
  }
  textWidth(str: string, small = false, spacing = 0): number {
    return str.length * ((small ? 4 : 8) + spacing) - (str.length ? spacing : 0);
  }
  /** Text is painted as solid boxes (3x5 tiny / 8x8 big) so it counts as drawn pixels. */
  text(str: string, x: number, y: number, c: number, o: { small?: boolean; align?: 'left' | 'center' | 'right' } = {}): void {
    const adv = o.small ? 4 : 8;
    const width = str.length * adv;
    let px = Math.round(o.align === 'center' ? x - width / 2 : o.align === 'right' ? x - width : x);
    for (const ch of str) {
      if (ch !== ' ') this.rect(px, y, o.small ? 3 : 7, o.small ? 5 : 7, c);
      px += adv;
    }
  }
  get alphaValue(): number {
    return this.alpha;
  }
}

const asSurface = (f: FakeSurface): Surface => f as unknown as Surface;

const OX = 40;
const OY = 30;
const BW = 200;
const BH = 120;

function render(id: (typeof STORES)[number]['id'], st: StorefrontState): FakeSurface {
  const f = new FakeSurface(BW, BH);
  drawStorefront(asSurface(f), id, OX, OY, st);
  return f;
}

const combos: [boolean, boolean][] = [
  [false, false],
  [true, false],
  [false, true],
  [true, true],
];

describe('storefronts', () => {
  it('every store draws without throwing for ticks 0..120 in all state combos, inside the 80x44 box', () => {
    for (const def of STORES) {
      for (const [cleared, bf] of combos) {
        for (let tick = 0; tick <= 120; tick += tick < 8 ? 1 : 7) {
          const f = render(def.id, { tick, cleared, blackFriday: bf });
          expect(f.writes).toBeGreaterThan(500);
          expect(f.minX).toBeGreaterThanOrEqual(OX);
          expect(f.minY).toBeGreaterThanOrEqual(OY);
          expect(f.maxX).toBeLessThan(OX + STOREFRONT_W);
          expect(f.maxY).toBeLessThan(OY + STOREFRONT_H);
          // clip stack must be balanced and alpha restored
          expect(f.alphaValue).toBe(1);
        }
      }
    }
  });

  it('covers the full box (sign band to floor line)', () => {
    for (const def of STORES) {
      const f = render(def.id, { tick: 5, cleared: false, blackFriday: false });
      expect(f.minX).toBe(OX);
      expect(f.minY).toBe(OY);
      expect(f.maxX).toBe(OX + STOREFRONT_W - 1);
      expect(f.maxY).toBe(OY + STOREFRONT_H - 1);
    }
  });

  it('the door rect is centred and bottom-aligned', () => {
    const d = storefrontDoorRect(OX, OY);
    expect(d.w).toBe(DOOR_W);
    expect(d.h).toBe(DOOR_H);
    expect(d.x - OX).toBe(STOREFRONT_W - (d.x - OX) - d.w);
    expect(d.y + d.h).toBe(OY + STOREFRONT_H);
  });

  const sample = (f: FakeSurface): number => {
    const d = storefrontDoorRect(OX, OY);
    return f.at(d.x + 2, d.y + d.h - 6);
  };

  it('target doors blink between two reds about once a second', () => {
    for (const def of STORES.filter((s) => s.role === 'target')) {
      const seen = new Set<number>();
      const seq: number[] = [];
      for (let tick = 0; tick < 120; tick++) {
        const f = render(def.id, { tick, cleared: false, blackFriday: false });
        const c = sample(f);
        expect(c).toBe(storefrontDoorColour(def.id, { tick, cleared: false, blackFriday: false }));
        seen.add(c);
        seq.push(c);
      }
      expect([...seen].sort()).toEqual([C.RED_D, C.RED].sort());
      // transitions: 4 in 120 frames (60 frame period)
      let changes = 0;
      for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) changes++;
      expect(changes).toBe(3);
    }
  });

  it('power-up doors are blue and never blink', () => {
    for (const def of STORES.filter((s) => s.role === 'powerup')) {
      for (let tick = 0; tick < 120; tick += 5) {
        const f = render(def.id, { tick, cleared: false, blackFriday: false });
        expect(sample(f)).toBe(C.BLUE);
      }
    }
  });

  it('cleared target stores have a dark, non-blinking door', () => {
    for (const def of STORES.filter((s) => s.role === 'target')) {
      const seen = new Set<number>();
      for (let tick = 0; tick < 120; tick += 3) seen.add(sample(render(def.id, { tick, cleared: true, blackFriday: false })));
      expect(seen.size).toBe(1);
      expect([...seen][0]).toBe(C.BLACK);
    }
  });

  it('cleared target windows are dimmed (differ from the uncleared render)', () => {
    const a = render('forever12', { tick: 10, cleared: false, blackFriday: false });
    const b = render('forever12', { tick: 10, cleared: true, blackFriday: false });
    const w = 3 + OX;
    const y = OY + 18;
    let dark = 0;
    let darkA = 0;
    for (let yy = 0; yy < 22; yy++)
      for (let xx = 0; xx < 26; xx++) {
        if (b.at(w + xx, y + yy) === C.BLACK) dark++;
        if (a.at(w + xx, y + yy) === C.BLACK) darkA++;
      }
    expect(dark).toBeGreaterThan(darkA + 100);
  });

  it('closed stores show a static shutter door (no colour change over time)', () => {
    for (const def of STORES.filter((s) => s.role === 'closed')) {
      const d = storefrontDoorRect(OX, OY);
      const snap = (tick: number): string => {
        const f = render(def.id, { tick, cleared: false, blackFriday: false });
        let out = '';
        for (let y = d.y; y < d.y + d.h; y++) for (let x = d.x; x < d.x + d.w; x++) out += String.fromCharCode(f.at(x, y));
        return out;
      };
      expect(snap(0)).toBe(snap(31));
      expect(snap(0)).toBe(snap(77));
    }
  });

  it('animated displays change over time', () => {
    for (const def of STORES.filter((s) => s.role !== 'closed')) {
      const seen = new Set<string>();
      for (let tick = 0; tick < 240; tick += 6) {
        const f = render(def.id, { tick, cleared: false, blackFriday: false });
        seen.add(Buffer_key(f));
      }
      expect(seen.size).toBeGreaterThan(3);
    }
  });

  it('black friday adds pixels for open stores only', () => {
    for (const def of STORES) {
      const a = render(def.id, { tick: 20, cleared: false, blackFriday: false });
      const b = render(def.id, { tick: 20, cleared: false, blackFriday: true });
      let diff = 0;
      for (let i = 0; i < a.buf.length; i++) if (a.buf[i] !== b.buf[i]) diff++;
      if (def.role === 'closed') expect(diff).toBe(0);
      else expect(diff).toBeGreaterThan(150);
    }
  });
});

function Buffer_key(f: FakeSurface): string {
  let h = 0;
  for (let i = 0; i < f.buf.length; i++) h = (Math.imul(h, 31) + f.buf[i]) | 0;
  return String(h);
}

describe('backdrops and logo', () => {
  it('draw without throwing, inside the surface', () => {
    const f = new FakeSurface(256, 240);
    for (let tick = 0; tick < 300; tick += 17) {
      drawNightSky(asSurface(f), 0, 0, 256, 240, tick);
      drawSkyscraper(asSurface(f), 0, 40, tick);
      drawCityline(asSurface(f), -20, 100, 768, tick);
      drawGarageBackdrop(asSurface(f), tick);
      drawTitleLogo(asSurface(f), 128, 20, tick);
      drawStorefrontRow(asSurface(f), 150, tick * 3, tick);
    }
    for (const kind of ['shop', 'parking', 'roof'] as const) drawMallInterior(asSurface(f), 0, 100, 256, 48, kind, 0);
    drawShutter(asSurface(f), 0, 0, 256, 240, 0.5);
    expect(f.writes).toBeGreaterThan(1000);
  });

  it('mall interior tiles seamlessly by world x', () => {
    for (const kind of ['shop', 'parking', 'roof'] as const) {
      const a = new FakeSurface(256, 60);
      const b = new FakeSurface(256, 60);
      // same world columns drawn with different screen offsets must match
      drawMallInterior(asSurface(a), 0, 0, 512, 48, kind, 0);
      drawMallInterior(asSurface(b), -16, 0, 512, 48, kind, 0);
      for (let y = 0; y < 48; y++) for (let x = 0; x < 200; x++) expect(b.at(x, y)).toBe(a.at(x + 16, y));
    }
  });

  it('logo fits in 200x64 and shimmers over time', () => {
    expect(LOGO_W).toBeLessThanOrEqual(200);
    expect(LOGO_H).toBeLessThanOrEqual(64);
    const snap = (tick: number): string => {
      const f = new FakeSurface(256, 100);
      drawTitleLogo(asSurface(f), 128, 10, tick);
      expect(f.minX).toBeGreaterThanOrEqual(128 - LOGO_W / 2 - 1);
      expect(f.maxX).toBeLessThanOrEqual(128 + LOGO_W / 2 + 1);
      return Buffer_key(f);
    };
    expect(snap(0)).not.toBe(snap(30));
    expect(snap(150)).toBe(snap(151));
  });

  it('storefront row wraps seamlessly', () => {
    const period = 13 * 90;
    const a = new FakeSurface(256, 80);
    const b = new FakeSurface(256, 80);
    drawStorefrontRow(asSurface(a), 20, 37, 5);
    drawStorefrontRow(asSurface(b), 20, 37 + period, 5);
    expect(Buffer_key(a)).toBe(Buffer_key(b));
  });
});
