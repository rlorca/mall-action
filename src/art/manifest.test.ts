import { describe, expect, it } from 'vitest';
import './index';
import { getSprite, hasSprite, allSprites } from './registry';
import { REQUIRED_SPRITES } from './manifest';
import { MAX_SPRITE_COLORS } from '../engine/sprite';

describe('sprite manifest', () => {
  it('has a unique required name list', () => {
    const names = REQUIRED_SPRITES.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
  for (const owner of ['characters', 'items', 'mallprops', 'storefronts', 'storeart'] as const) {
    it(`every required ${owner} sprite exists with the right size, frames and <= 3 colours`, () => {
      const problems: string[] = [];
      for (const r of REQUIRED_SPRITES.filter((x) => x.owner === owner)) {
        if (!hasSprite(r.name)) {
          problems.push(`missing ${r.name}`);
          continue;
        }
        const s = getSprite(r.name);
        if (s.w !== r.w || s.h !== r.h) problems.push(`${r.name}: size ${s.w}x${s.h}, expected ${r.w}x${r.h}`);
        if (s.frames < r.frames) problems.push(`${r.name}: ${s.frames} frames, expected >= ${r.frames}`);
      }
      expect(problems).toEqual([]);
    });
  }
  it('every registered sprite uses at most 3 colours plus transparent and has no empty frame', () => {
    for (const s of allSprites()) {
      expect(s.colors.length, s.name).toBeLessThanOrEqual(MAX_SPRITE_COLORS);
      for (let f = 0; f < s.frames; f++) {
        let opaque = 0;
        for (let i = 0; i < s.w * s.h; i++) if (s.data[f * s.w * s.h + i] !== 255) opaque++;
        expect(opaque, `${s.name} frame ${f} is empty`).toBeGreaterThan(0);
      }
    }
  });
});
