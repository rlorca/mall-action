import { describe, expect, it } from 'vitest';
import { MASTER_PALETTE } from '../src/render/palette';
import { Framebuffer, isValidSprite, sprite, usedColors, flipX } from '../src/render/pixels';
import { POWERUP_ICONS, SPRITES } from '../src/render/sprites';
import { FONT, TINY, textWidth, drawText } from '../src/render/font';
import { ALL_POWERUP_IDS } from '../src/core/powerups';
import { MALL_SPRITE_H, MALL_SPRITE_W, STORE_SPRITE_H, STORE_SPRITE_W } from '../src/core/constants';

describe('the pixel-art pipeline', () => {
  it('parses ASCII art into indexed pixels', () => {
    const s = sprite([1, 2, 3], ['.1.', '23.']);
    expect(s.w).toBe(3);
    expect(s.h).toBe(2);
    expect(Array.from(s.data)).toEqual([0, 1, 0, 2, 3, 0]);
  });

  it('rejects ragged art rather than drawing garbage', () => {
    expect(() => sprite([1, 2, 3], ['..', '...'])).toThrow();
  });

  it('mirrors sprites so left and right facings share one source', () => {
    const s = sprite([1, 2, 3], ['12.']);
    expect(Array.from(flipX(s).data)).toEqual([0, 2, 1]);
  });

  it('blits only non-transparent pixels, at whole-pixel positions', () => {
    const fb = new Framebuffer(4, 2);
    fb.clear(9);
    fb.blit(sprite([5, 6, 7], ['.1', '2.']), 1, 0);
    expect(Array.from(fb.data)).toEqual([9, 9, 5, 9, 9, 6, 9, 9]);
  });

  it('clips sprites to the framebuffer and to the playfield', () => {
    const fb = new Framebuffer(4, 4);
    fb.clear(0);
    fb.setClip(2, 4);
    fb.blit(sprite([5, 6, 7], ['11', '11']), 0, 0);
    expect(Array.from(fb.data.slice(0, 8))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('converts to RGBA through the master palette', () => {
    const fb = new Framebuffer(1, 1);
    fb.clear(0x16);
    const out = new Uint8ClampedArray(4);
    const rgba = new Uint8Array(MASTER_PALETTE.length * 4);
    MASTER_PALETTE.forEach((c, i) => {
      rgba[i * 4] = (c >> 16) & 0xff;
      rgba[i * 4 + 1] = (c >> 8) & 0xff;
      rgba[i * 4 + 2] = c & 0xff;
    });
    fb.toRGBA(rgba, out);
    expect([out[0], out[1], out[2], out[3]]).toEqual([0xbd, 0x3c, 0x30, 255]);
  });
});

describe('the sprite catalogue', () => {
  const entries = Object.entries(SPRITES);

  it('is not empty', () => {
    expect(entries.length).toBeGreaterThan(50);
  });

  it('uses at most 3 colours plus transparent, everywhere', () => {
    for (const [name, s] of entries) {
      expect(isValidSprite(s), `${name} is malformed`).toBe(true);
      expect(usedColors(s), `${name} uses too many colours`).toBeLessThanOrEqual(3);
      for (const c of s.colors) {
        expect(c, `${name} colour out of the master palette`).toBeLessThan(MASTER_PALETTE.length);
      }
    }
  });

  it('draws something in every sprite', () => {
    for (const [name, s] of entries) {
      expect(usedColors(s), `${name} is blank`).toBeGreaterThan(0);
    }
  });

  it('sizes the mall characters 16x24', () => {
    const mall = [
      'agentIdle', 'agentWalk1', 'agentWalk2', 'agentDuck', 'agentJump', 'agentShoot',
      'agentShootDuck', 'agentDead', 'agentZip', 'agentSelfie', 'agentHold',
      'spyIdle', 'spyWalk', 'spyAim', 'spyAimLow', 'spyDuck', 'spyDead',
      'janitor', 'walker', 'copSegway', 'clerk',
    ] as const;
    for (const name of mall) {
      const s = SPRITES[name];
      expect(s.w, `${name} width`).toBe(MALL_SPRITE_W);
      expect(s.h, `${name} height`).toBe(MALL_SPRITE_H);
    }
  });

  it('sizes the store characters 16x16', () => {
    const store = [
      'sAgentDown', 'sAgentDown2', 'sAgentUp', 'sAgentUp2', 'sAgentRight', 'sAgentRight2',
      'sAgentHold', 'sSpyDown', 'sSpyUp', 'sSpyRight', 'sBot', 'sBot2', 'windUpToy',
    ] as const;
    for (const name of store) {
      expect(SPRITES[name].w, `${name} width`).toBe(STORE_SPRITE_W);
      expect(SPRITES[name].h, `${name} height`).toBe(STORE_SPRITE_H);
    }
  });

  it('sizes the elevator car to the geometry the rules use', () => {
    expect(SPRITES.carOpen.w).toBe(32);
    expect(SPRITES.carOpen.h).toBe(40);
    expect(SPRITES.carClosed.w).toBe(32);
    expect(SPRITES.carClosed.h).toBe(40);
  });

  it('has an icon for every power-up', () => {
    for (const id of ALL_POWERUP_IDS) {
      expect(POWERUP_ICONS[id], `no icon for ${id}`).toBeDefined();
      expect(usedColors(POWERUP_ICONS[id])).toBeGreaterThan(0);
    }
  });

  it('has the props the mall layout places', () => {
    for (const name of ['kiosk', 'photoBooth', 'fountain', 'bench', 'plant', 'pillar', 'stationWagon', 'anchorPost'] as const) {
      expect(SPRITES[name]).toBeDefined();
    }
  });
});

describe('fonts', () => {
  it('covers A-Z and 0-9 in both faces', () => {
    const need = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
    for (const ch of need) {
      expect(FONT.glyphs.has(ch), `FONT missing '${ch}'`).toBe(true);
      expect(TINY.glyphs.has(ch), `TINY missing '${ch}'`).toBe(true);
    }
  });

  it('covers the punctuation the copy uses', () => {
    for (const ch of ".,:!?'-/()&%#<>+*") {
      expect(FONT.glyphs.has(ch), `FONT missing '${ch}'`).toBe(true);
    }
  });

  it('measures text at 6 px per character', () => {
    expect(textWidth(FONT, 'AB')).toBe(11);
    expect(textWidth(FONT, '')).toBe(0);
    expect(textWidth(FONT, 'AB', 2)).toBe(22);
  });

  it('draws a glyph and renders unknown characters as blanks', () => {
    const fb = new Framebuffer(16, 8);
    fb.clear(0);
    drawText(fb, FONT, 'A', 0, 0, 5);
    expect(fb.data.some((v) => v === 5)).toBe(true);
    const fb2 = new Framebuffer(16, 8);
    fb2.clear(0);
    drawText(fb2, FONT, '☃', 0, 0, 5);
    expect(fb2.data.every((v) => v === 0)).toBe(true);
  });

  it('every glyph has at least one lit pixel except space', () => {
    for (const [ch, bits] of FONT.glyphs) {
      if (ch === ' ') continue;
      expect(bits.some((b) => b === 1), `FONT '${ch}' is blank`).toBe(true);
    }
    for (const [ch, bits] of TINY.glyphs) {
      if (ch === ' ') continue;
      expect(bits.some((b) => b === 1), `TINY '${ch}' is blank`).toBe(true);
    }
  });
});

describe('window displays and store tiles', () => {
  it('provides animated frames for every display kind the storefronts use', async () => {
    const { ALL_DISPLAY_KINDS, displayFrames, DISPLAY_W, DISPLAY_H } = await import('../src/render/displays');
    const { STORES } = await import('../src/core/storeDefs');
    for (const kind of ALL_DISPLAY_KINDS) {
      const frames = displayFrames(kind);
      expect(frames.length, `${kind} frames`).toBeGreaterThanOrEqual(1);
      expect(frames.length, `${kind} frames`).toBeLessThanOrEqual(3);
      for (const f of frames) {
        expect(f.w).toBe(DISPLAY_W);
        expect(f.h).toBe(DISPLAY_H);
        expect(isValidSprite(f)).toBe(true);
        expect(usedColors(f), `${kind} is blank`).toBeGreaterThan(0);
      }
    }
    // Every storefront window references a kind that exists.
    for (const s of STORES) {
      for (const w of s.windows) expect(ALL_DISPLAY_KINDS).toContain(w);
    }
  });

  it('most displays have idle animation', async () => {
    const { ALL_DISPLAY_KINDS, displayFrames } = await import('../src/render/displays');
    const animated = ALL_DISPLAY_KINDS.filter((k) => displayFrames(k).length > 1);
    expect(animated.length).toBeGreaterThan(ALL_DISPLAY_KINDS.length / 2);
  });

  it('gives every theme a full, valid 16x16 tile set with distinct open/closed fixtures', async () => {
    const { ALL_THEMES, themeTiles, SPECIAL_TILES } = await import('../src/render/tiles');
    expect(ALL_THEMES).toHaveLength(9);
    for (const theme of ALL_THEMES) {
      const tt = themeTiles(theme);
      for (const key of ['floor', 'wall', 'fixture', 'fixtureOpen', 'counter', 'decor'] as const) {
        const s = tt[key];
        expect(s.w, `${theme}.${key}`).toBe(16);
        expect(s.h, `${theme}.${key}`).toBe(16);
        expect(isValidSprite(s)).toBe(true);
        expect(usedColors(s), `${theme}.${key} is blank`).toBeGreaterThan(0);
      }
      // A rummaged fixture must look different from a closed one.
      expect(Array.from(tt.fixture.data)).not.toEqual(Array.from(tt.fixtureOpen.data));
    }
    for (const s of Object.values(SPECIAL_TILES)) {
      expect(s.w).toBe(16);
      expect(s.h).toBe(16);
      expect(isValidSprite(s)).toBe(true);
    }
  });
});
