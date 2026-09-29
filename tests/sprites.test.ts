import { describe, expect, it } from 'vitest';
import { REQUIRED_SPRITES, STORE_IDS } from '../src/art/manifest';
import { SPRITE_DEFS } from '../src/art/sprites';
import { countColors, parseSprite } from '../src/core/pixelart';
import { NES_PALETTE } from '../src/core/palette';

describe('sprites', () => {
  it.each(REQUIRED_SPRITES.map((r) => [r.name, r] as const))('%s exists at the right size with <= 3 colours', (name, req) => {
    const def = SPRITE_DEFS[name];
    expect(def, `missing sprite ${name}`).toBeDefined();
    expect([def.w, def.h]).toEqual([req.w, req.h]);
    const s = parseSprite(def, name);
    expect(countColors(s)).toBeLessThanOrEqual(3);
    expect(countColors(s)).toBeGreaterThan(0);
  });

  it('every defined sprite parses and uses only master-palette colours', () => {
    for (const [name, def] of Object.entries(SPRITE_DEFS)) {
      const s = parseSprite(def, name);
      expect(s.colors.length).toBeLessThanOrEqual(3);
      for (const c of s.colors) expect(NES_PALETTE[c], `${name} colour ${c}`).toBeDefined();
    }
  });

  it('each window display has 1 to 3 animation frames, all the same size', () => {
    for (const store of STORE_IDS) {
      for (const side of ['a', 'b']) {
        let n = 0;
        while (SPRITE_DEFS[`disp_${store}_${side}_${n}`]) {
          const d = SPRITE_DEFS[`disp_${store}_${side}_${n}`];
          expect([d.w, d.h]).toEqual([24, 20]);
          n++;
        }
        expect(n, `disp_${store}_${side}`).toBeGreaterThanOrEqual(1);
        expect(n, `disp_${store}_${side}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('animation frames of one base share a size', () => {
    const groups = new Map<string, string[]>();
    for (const name of Object.keys(SPRITE_DEFS)) {
      const m = /^(.*)_(\d+)$/.exec(name);
      if (m) groups.set(m[1], [...(groups.get(m[1]) ?? []), name]);
    }
    for (const [, names] of groups) {
      const sizes = new Set(names.map((n) => `${SPRITE_DEFS[n].w}x${SPRITE_DEFS[n].h}`));
      expect(sizes.size, names.join(',')).toBe(1);
    }
  });
});
