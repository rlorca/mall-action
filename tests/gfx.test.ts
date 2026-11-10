import { describe, expect, it } from 'vitest';
import { art, colorsOf, flipX, recolor, stack } from '../src/gfx/pixelart';
import { BLACK, DARK, PALETTE_RGB, T, darker, nearestIndex } from '../src/gfx/palette';
import { Fb } from '../src/gfx/fb';
import { FONT, hasGlyph, hasTinyGlyph, wrap } from '../src/gfx/font';
import { SPRITES, SPRITE_SIZES } from '../src/gfx/sprites';
import { PROPS, THEME_TILES } from '../src/gfx/props';
import { STORES } from '../src/game/level';

describe('pixel-art pipeline', () => {
  it('turns ASCII rows into an indexed sprite', () => {
    const s = art(['a.b', '.a.'], { a: 0x16, b: 0x30 });
    expect([s.w, s.h]).toEqual([3, 2]);
    expect([...s.px]).toEqual([0x16, T, 0x30, T, 0x16, T]);
    expect(colorsOf(s).sort()).toEqual([0x16, 0x30]);
  });
  it('rejects unknown colour characters', () => {
    expect(() => art(['ax'], { a: 1 })).toThrow();
  });
  it('stacks, flips and recolours', () => {
    const a = art(['ab'], { a: 1, b: 2 });
    const st = stack(a, a);
    expect([st.w, st.h]).toEqual([2, 2]);
    expect([...flipX(a).px]).toEqual([2, 1]);
    expect([...recolor(a, { 1: 9 }).px]).toEqual([9, 2]);
  });
  it('has a 64-entry master palette with NES-style darkening', () => {
    expect(PALETTE_RGB.length).toBe(64);
    expect(darker(0x30)).toBe(0x20);
    expect(darker(0x06)).toBe(BLACK);
    expect(DARK[4].every((c) => c === BLACK)).toBe(true);
    expect(nearestIndex(0x000000)).toBe(0x0d);
    expect(PALETTE_RGB[nearestIndex(0xf83800)]).toBe(0xf83800);
  });
});

describe('framebuffer', () => {
  it('clips drawing and converts to RGBA', () => {
    const fb = new Fb(8, 8);
    fb.clear(BLACK);
    fb.clip(2, 2, 4, 4);
    fb.rect(0, 0, 8, 8, 0x30);
    expect(fb.px[0]).toBe(BLACK);
    expect(fb.px[2 * 8 + 2]).toBe(0x30);
    expect(fb.px[6 * 8 + 6]).toBe(BLACK);
    const out = new Uint8Array(8 * 8 * 4);
    fb.toRGBA(out);
    expect([...out.slice((2 * 8 + 2) * 4, (2 * 8 + 2) * 4 + 4)]).toEqual([0xfc, 0xfc, 0xfc, 0xff]);
  });
  it('draws sprites flipped, off-screen safely, and text', () => {
    const fb = new Fb(16, 16);
    fb.clear(BLACK);
    const s = art(['ab'], { a: 1, b: 2 });
    fb.spr(s, -1, 0);
    fb.spr(s, 15, 0, true);
    fb.spr(s, 100, 100);
    expect(fb.px[0]).toBe(2);
    expect(fb.px[15]).toBe(2);
    expect(fb.text('A', 0, 8, 0x30)).toBe(8);
  });
});

describe('fonts', () => {
  it('covers digits, letters and the punctuation the copy uses', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?:;\'"-+/()&#$%*♥…@') expect(hasGlyph(ch), ch).toBe(true);
    for (const g of Object.values(FONT)) expect([g.w, g.h]).toEqual([5, 7]);
  });
  it('the tiny sign font covers every store name and sign text', () => {
    for (const st of STORES) for (const ch of st.name) expect(hasTinyGlyph(ch), st.name + ':' + ch).toBe(true);
    for (const ch of 'FOR LEASE CLOSING SALE TO THE MOON 70% OFF PHOTO') expect(hasTinyGlyph(ch)).toBe(true);
  });
  it('wraps text', () => {
    expect(wrap('AAA BBB CCC', 7)).toEqual(['AAA BBB', 'CCC']);
  });
});

describe('sprites', () => {
  it('every required sprite exists at the right size', () => {
    const required = [
      'ag_stand', 'ag_walk1', 'ag_walk2', 'ag_shoot', 'ag_jump', 'ag_kick', 'ag_duck', 'ag_duckshoot', 'ag_hang', 'ag_selfie', 'ag_dead',
      'sp_stand', 'sp_walk1', 'sp_walk2', 'sp_aim', 'sp_aimlow', 'sp_duck', 'sp_dead1', 'sp_dead2',
      'wk_walk1', 'wk_walk2', 'wk2_walk1', 'jn_walk1', 'jn_walk2', 'cop1', 'cop2',
      'sag_down1', 'sag_down2', 'sag_up1', 'sag_up2', 'sag_side1', 'sag_side2', 'sag_hold',
      'ssp_down1', 'ssp_up1', 'ssp_side1', 'bot1', 'bot2', 'clerk', 'toy1', 'toy2', 'pkg',
      'pu_rapid', 'pu_spread', 'pu_armor', 'pu_sneakers', 'pu_radar', 'pu_oneup', 'pu_cinnabomb', 'pu_juliooze', 'pu_pretzel', 'pu_joke',
      'coin', 'coin_gold', 'bullet_p', 'bullet_e', 'lamp', 'disco1', 'disco2', 'wet_sign', 'puff1', 'puff2', 'shoe',
    ];
    for (const name of required) expect(SPRITES[name], name).toBeDefined();
    for (const [name, [w, h]] of Object.entries(SPRITE_SIZES)) expect([SPRITES[name].w, SPRITES[name].h], name).toEqual([w, h]);
    expect(SPRITE_SIZES.ag_stand).toEqual([16, 24]);
    expect(SPRITE_SIZES.sp_stand).toEqual([16, 24]);
    expect(SPRITE_SIZES.sag_down1).toEqual([16, 16]);
  });
  it('every sprite and prop uses at most 3 colours plus transparent', () => {
    for (const [name, s] of Object.entries({ ...SPRITES, ...PROPS })) {
      const n = colorsOf(s).length;
      expect(n, name).toBeGreaterThan(0);
      expect(n, name).toBeLessThanOrEqual(3);
    }
  });
  it('has 9 store themes, each with floor, wall, counter and closed + opened fixtures', () => {
    const themes = Object.keys(THEME_TILES);
    expect(themes.sort()).toEqual(['electronics', 'fashion', 'food', 'gadgets', 'games', 'music', 'novelty', 'sports', 'toys']);
    for (const t of Object.values(THEME_TILES)) {
      for (const s of [t.floor, t.wall, t.fixture, t.fixtureOpen, t.counter, t.decor]) expect([s.w, s.h]).toEqual([16, 16]);
      expect([...t.fixture.px]).not.toEqual([...t.fixtureOpen.px]);
    }
    expect(PROPS.wagon.w).toBe(64);
    for (const st of STORES) if (st.role !== 'closed') expect(THEME_TILES[st.theme!]).toBeDefined();
  });
});
