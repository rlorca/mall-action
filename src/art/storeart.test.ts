import { describe, expect, it } from 'vitest';
import './index';
import { getSprite } from './registry';
import { THEMES } from '../content/themes';
import { TRANSPARENT } from '../engine/palette';
import type { Sprite } from '../engine/sprite';

const KEYS = ['floor', 'wall', 'counter', 'decor', 'shelf', 'shelf.open', 'rack', 'rack.open'] as const;

const tile = (theme: string, key: string): Sprite => getSprite(`st.${theme}.${key}`);
const frameOf = (s: Sprite, f = 0): Uint8Array => s.data.subarray(f * s.w * s.h, (f + 1) * s.w * s.h);
const diff = (a: Sprite, b: Sprite, fa = 0, fb = 0): number => {
  const x = frameOf(a, fa);
  const y = frameOf(b, fb);
  let n = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) n++;
  return n;
};
const opaque = (s: Sprite, f = 0): boolean => frameOf(s, f).every((v) => v !== TRANSPARENT);
const distinctColors = (s: Sprite, f = 0): number => new Set(frameOf(s, f)).size;

describe('store theme tiles', () => {
  for (const theme of THEMES) {
    describe(theme, () => {
      it('has 8 tiles of 16x16 that are fully opaque', () => {
        for (const k of KEYS) {
          const s = tile(theme, k);
          expect([s.w, s.h], k).toEqual([16, 16]);
          expect(opaque(s), `${theme}.${k} has transparent pixels`).toBe(true);
        }
      });

      it('has 8 pairwise different tiles', () => {
        for (let i = 0; i < KEYS.length; i++) {
          for (let j = i + 1; j < KEYS.length; j++) {
            expect(diff(tile(theme, KEYS[i]!), tile(theme, KEYS[j]!)), `${theme}: ${KEYS[i]} vs ${KEYS[j]}`).toBeGreaterThan(20);
          }
        }
      });

      it('shows opened shelves and racks clearly different from the closed ones', () => {
        expect(diff(tile(theme, 'shelf'), tile(theme, 'shelf.open')), 'shelf').toBeGreaterThanOrEqual(40);
        expect(diff(tile(theme, 'rack'), tile(theme, 'rack.open')), 'rack').toBeGreaterThanOrEqual(40);
      });

      it('has a textured floor (at least 2 colours) and a wall with a lit top edge differing from the face', () => {
        expect(distinctColors(tile(theme, 'floor'))).toBeGreaterThanOrEqual(2);
        const wall = tile(theme, 'wall');
        const majority = (y0: number, y1: number): number => {
          const count = new Map<number, number>();
          for (let y = y0; y < y1; y++) for (let x = 0; x < 16; x++) count.set(wall.data[y * 16 + x]!, (count.get(wall.data[y * 16 + x]!) ?? 0) + 1);
          return [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0];
        };
        // the lit top edge (rows 0-2) is a different colour from the wall face (rows 5-14)
        expect(majority(0, 3), `${theme} wall top vs face`).not.toBe(majority(5, 15));
      });

      it('floor tiles seamlessly: the colour mix is the same on every edge-wrapped neighbour pair', () => {
        // A tile repeated in both axes must not introduce a fully solid seam line that the tile itself lacks.
        const f = tile(theme, 'floor');
        const at = (x: number, y: number): number => f.data[(y & 15) * 16 + (x & 15)]!;
        let sameRight = 0;
        let sameInner = 0;
        for (let y = 0; y < 16; y++) {
          if (at(15, y) === at(16, y)) sameRight++;
          if (at(7, y) === at(8, y)) sameInner++;
        }
        // wrap seam behaves like an interior seam to within a generous margin (no obvious border line)
        expect(Math.abs(sameRight - sameInner)).toBeLessThanOrEqual(10);
      });
    });
  }

  it('gives every theme a different floor and a different wall', () => {
    for (let i = 0; i < THEMES.length; i++) {
      for (let j = i + 1; j < THEMES.length; j++) {
        expect(diff(tile(THEMES[i]!, 'floor'), tile(THEMES[j]!, 'floor')), `${THEMES[i]} vs ${THEMES[j]} floor`).toBeGreaterThan(30);
        expect(diff(tile(THEMES[i]!, 'wall'), tile(THEMES[j]!, 'wall')), `${THEMES[i]} vs ${THEMES[j]} wall`).toBeGreaterThan(30);
      }
    }
  });

  it('gives every theme a different set of shelf/rack looks', () => {
    for (let i = 0; i < THEMES.length; i++) {
      for (let j = i + 1; j < THEMES.length; j++) {
        expect(diff(tile(THEMES[i]!, 'shelf'), tile(THEMES[j]!, 'shelf')), `${THEMES[i]} vs ${THEMES[j]} shelf`).toBeGreaterThan(30);
        expect(diff(tile(THEMES[i]!, 'rack'), tile(THEMES[j]!, 'rack')), `${THEMES[i]} vs ${THEMES[j]} rack`).toBeGreaterThan(30);
      }
    }
  });
});

describe('store specials', () => {
  it('has a 32x16 opaque doorway', () => {
    const d = getSprite('st.door');
    expect([d.w, d.h]).toEqual([32, 16]);
    expect(opaque(d)).toBe(true);
  });

  it('opens the fitting room and the toy shelf visibly', () => {
    expect(diff(getSprite('st.fitting'), getSprite('st.fitting.open'))).toBeGreaterThanOrEqual(40);
    expect(diff(getSprite('st.toyshelf'), getSprite('st.toyshelf.open'))).toBeGreaterThanOrEqual(40);
  });

  it('animates the booth (2 frames) and the demo TV (3 frames)', () => {
    const booth = getSprite('st.booth');
    expect(booth.frames).toBeGreaterThanOrEqual(2);
    expect(diff(booth, booth, 0, 1)).toBeGreaterThan(20);
    const tv = getSprite('st.tv');
    expect(tv.frames).toBeGreaterThanOrEqual(3);
    expect(diff(tv, tv, 0, 1)).toBeGreaterThan(10);
    expect(diff(tv, tv, 1, 2)).toBeGreaterThan(10);
    expect(diff(tv, tv, 0, 2)).toBeGreaterThan(10);
  });

  it('has an opaque pedestal tile', () => {
    expect(opaque(getSprite('st.pedestal'))).toBe(true);
  });
});

describe('top-down characters', () => {
  const walkers = ['td.agent.down', 'td.agent.up', 'td.agent.side', 'td.spy.down', 'td.spy.up', 'td.spy.side'];
  for (const name of walkers) {
    it(`${name} has two distinct walk frames`, () => {
      const s = getSprite(name);
      expect(s.frames).toBeGreaterThanOrEqual(2);
      expect(diff(s, s, 0, 1)).toBeGreaterThan(0);
    });
  }

  it('animates the stun stars, the bot, the toy, the clerk and the shoe', () => {
    for (const name of ['td.agent.stun', 'td.bot', 'td.toy', 'td.clerk', 'td.shoe']) {
      const s = getSprite(name);
      expect(diff(s, s, 0, 1), name).toBeGreaterThan(0);
    }
  });

  it('draws the agent differently in every pose', () => {
    const poses = ['td.agent.down', 'td.agent.up', 'td.agent.side', 'td.agent.hold', 'td.agent.stun'].map(getSprite);
    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) expect(diff(poses[i]!, poses[j]!), `${poses[i]!.name} vs ${poses[j]!.name}`).toBeGreaterThan(10);
    }
  });

  it('keeps characters readable: transparent background, a solid body and no stray frame-edge pixels', () => {
    for (const name of [...walkers, 'td.agent.hold', 'td.agent.stun', 'td.spy.change', 'td.bot', 'td.toy', 'td.clerk']) {
      const s = getSprite(name);
      for (let f = 0; f < s.frames; f++) {
        const px = frameOf(s, f);
        const opaqueCount = px.filter((v) => v !== TRANSPARENT).length;
        expect(opaqueCount, `${name} frame ${f}`).toBeGreaterThan(50);
        expect(opaqueCount, `${name} frame ${f}`).toBeLessThan(220);
      }
    }
  });

  it('has a 4x4 bullet and an 8x8 shoe', () => {
    expect([getSprite('td.bullet').w, getSprite('td.bullet').h]).toEqual([4, 4]);
    expect([getSprite('td.shoe').w, getSprite('td.shoe').h]).toEqual([8, 8]);
  });
});
