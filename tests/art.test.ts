import { describe, expect, it } from 'vitest';
import '../src/art/index';
import { Bitmap, allSprites, defSprite, frameOf, hasSprite, spriteDef, toRGBA } from '../src/art/pixel';
import { NES, nesRgb } from '../src/art/palette';
import { requiredSprites } from '../src/art/required';
import { FONT3, FONT5, textWidth } from '../src/art/font';

describe('pixel-art pipeline', () => {
  it('a bitmap is made of 3 palette slots + transparent and draws with simple primitives', () => {
    const b = new Bitmap(8, 8, [0x16, 0x0f, 0x37]);
    b.rect(1, 1, 3, 3, 1).px(0, 0, 2).line(0, 7, 7, 7, 3).oval(5, 3, 2, 2, 2);
    expect(b.get(1, 1)).toBe(1);
    expect(b.get(0, 0)).toBe(2);
    expect(b.get(4, 7)).toBe(3);
    expect(b.get(-1, 0)).toBe(0);
    expect(b.usedSlots().size).toBe(3);
    expect(b.usedColours().sort()).toEqual([0x0f, 0x16, 0x37]);
  });
  it('ASCII rows stamp slots; flipping mirrors; clone is independent', () => {
    const b = new Bitmap(4, 2, [1, 2, 3]).rows(0, 0, ['1.2.', '.3..']);
    expect([b.get(0, 0), b.get(1, 0), b.get(2, 0), b.get(1, 1)]).toEqual([1, 0, 2, 3]);
    const f = b.flipped();
    expect(f.get(3, 0)).toBe(1);
    expect(f.get(1, 0)).toBe(2);
    const c = b.clone();
    c.px(0, 0, 3);
    expect(b.get(0, 0)).toBe(1);
  });
  it('rasterises to RGBA using the fixed NES master palette, transparent where empty', () => {
    const b = new Bitmap(2, 1, [0x16, 0x0f, 0x30]).px(0, 0, 1);
    const px = toRGBA(b);
    expect(Array.from(px.slice(0, 4))).toEqual([...NES[0x16], 255]);
    expect(px[7]).toBe(0);
    expect(Array.from(toRGBA(b, true).slice(4, 8))).toEqual([...NES[0x16], 255]);
    expect(NES.length).toBe(64);
    expect(nesRgb(0x0f)).toEqual([0, 0, 0]);
  });
  it('the registry stores frames and wraps frame numbers', () => {
    defSprite('test.sprite', 4, 4, [1, 2, 3], (b, f) => b.px(f, 0, 1), 3);
    expect(hasSprite('test.sprite')).toBe(true);
    expect(spriteDef('test.sprite').frames.length).toBe(3);
    expect(frameOf('test.sprite', 4).get(1, 0)).toBe(1);
    expect(() => spriteDef('nope.nope')).toThrow();
  });
});

describe('sprites', () => {
  it('every required sprite exists with the right size (and frame count)', () => {
    const req = requiredSprites();
    expect(req.length).toBeGreaterThan(180);
    for (const r of req) {
      expect(hasSprite(r.name), `missing ${r.name}`).toBe(true);
      const d = spriteDef(r.name);
      expect([d.w, d.h], r.name).toEqual([r.w, r.h]);
      if (r.frames) expect(d.frames.length, r.name).toBe(r.frames);
      for (const f of d.frames) expect([f.w, f.h]).toEqual([r.w, r.h]);
    }
  });
  it('every sprite uses at most 3 colours plus transparent, from the master palette, and is not empty', () => {
    for (const s of allSprites()) {
      for (const f of s.frames) {
        expect(f.pal.length).toBe(3);
        for (const c of f.pal) expect(c >= 0 && c < 64, `${s.name} palette`).toBe(true);
        expect(f.usedColours().length, s.name).toBeLessThanOrEqual(3);
        for (const v of f.data) expect(v >= 0 && v <= 3).toBe(true);
        expect(f.usedSlots().size, `${s.name} is empty`).toBeGreaterThan(0);
      }
    }
  });
  it('mall characters are 16x24, store characters 16x16', () => {
    for (const s of allSprites()) {
      if (/^(agent|spy|janitor|walker\d)\./.test(s.name)) expect([s.w, s.h], s.name).toEqual([16, 24]);
      if (/^td\.(agent|spy)\./.test(s.name)) expect([s.w, s.h], s.name).toEqual([16, 16]);
    }
  });
  it('each storefront has two window displays and the animated ones have 2-3 frames', () => {
    let animated = 0;
    for (const s of allSprites().filter((x) => x.name.startsWith('win.'))) {
      expect(s.frames.length).toBeLessThanOrEqual(3);
      if (s.frames.length > 1) animated++;
    }
    expect(animated).toBeGreaterThanOrEqual(12);
  });
  it('the agent wears a red coat and the spy a black suit', () => {
    expect(spriteDef('agent.stand').frames[0].pal[0]).toBe(0x16);
    expect(spriteDef('spy.stand').frames[0].pal[0]).toBe(0x0f);
  });
  it('the sprite animations differ between frames (walk cycle, windows)', () => {
    const a = Array.from(frameOf('agent.walk0', 0).data).join();
    const b = Array.from(frameOf('agent.walk2', 0).data).join();
    expect(a).not.toBe(b);
    const tv = spriteDef('win.radioshock.l');
    expect(Array.from(tv.frames[0].data).join()).not.toBe(Array.from(tv.frames[1].data).join());
  });
});

describe('fonts', () => {
  it('the UI font is 5x7 on a 6 px advance and the sign font 3x5 on a 4 px advance', () => {
    expect(FONT5.advance).toBe(6);
    expect(FONT3.advance).toBe(4);
    for (const g of FONT5.glyphs.values()) {
      expect(g.length).toBe(7);
      for (const r of g) expect(r.length).toBe(5);
    }
    for (const g of FONT3.glyphs.values()) {
      expect(g.length).toBe(5);
      for (const r of g) expect(r.length).toBe(3);
    }
    expect(textWidth(FONT5, 'ABC')).toBe(17);
    expect(textWidth(FONT5, '')).toBe(0);
  });
});
