import { describe, expect, it } from 'vitest';
import { hasGlyph3, hasGlyph8, glyph3, glyph8 } from '../src/art/font';
import { usedColors } from '../src/art/pixel';
import { SPRITES_CHARACTERS } from '../src/art/sprites-characters';
import * as copy from '../src/data/copy';
import { STORES } from '../src/data/stores';

// name -> [w, h, minFrames]
const REQUIRED: Record<string, [number, number, number]> = {
  agent_stand: [16, 24, 1], agent_walk: [16, 24, 4], agent_jump: [16, 24, 1], agent_kick: [16, 24, 1],
  agent_duck: [16, 24, 1], agent_shoot: [16, 24, 1], agent_shoot_duck: [16, 24, 1], agent_die: [16, 24, 3],
  agent_crouch: [16, 24, 1], agent_hang: [16, 24, 2], agent_selfie: [16, 24, 2],
  spy_stand: [16, 24, 1], spy_walk: [16, 24, 4], spy_aim_high: [16, 24, 1], spy_aim_low: [16, 24, 1],
  spy_duck: [16, 24, 1], spy_die: [16, 24, 4],
  janitor_walk: [16, 24, 4], janitor_mop: [24, 24, 3], walker_a: [16, 24, 4], walker_b: [16, 24, 4],
  walker_hey: [16, 24, 1], cop_segway: [24, 24, 2], cop_whistle: [24, 24, 1],
  agent_top_down: [16, 16, 2], agent_top_up: [16, 16, 2], agent_top_side: [16, 16, 2], agent_top_hold: [16, 16, 1],
  agent_top_search: [16, 16, 2], agent_top_die: [16, 16, 2], agent_top_stun: [16, 16, 1],
  spytop_down: [16, 16, 2], spytop_up: [16, 16, 2], spytop_side: [16, 16, 2],
  spytop_aim_down: [16, 16, 1], spytop_aim_up: [16, 16, 1], spytop_aim_side: [16, 16, 1], spytop_die: [16, 16, 2],
  bot_top: [16, 16, 2], bot_top_hit: [16, 16, 1], clerk_top: [16, 16, 1],
  windup_toy: [8, 8, 2], spy_fitting: [16, 16, 2], shoe: [8, 8, 1],
};

describe('character sprites', () => {
  it('has every required sprite with the right size and frame count', () => {
    const by = new Map(SPRITES_CHARACTERS.map((s) => [s.name, s]));
    for (const [name, [w, h, frames]] of Object.entries(REQUIRED)) {
      const s = by.get(name);
      expect(s, `missing ${name}`).toBeDefined();
      expect([s!.w, s!.h], `${name} size`).toEqual([w, h]);
      expect(s!.frames.length, `${name} frames`).toBeGreaterThanOrEqual(frames);
    }
  });

  it('has unique names', () => {
    const names = SPRITES_CHARACTERS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every sprite is well formed and uses at most 3 colours', () => {
    for (const s of SPRITES_CHARACTERS) {
      expect(s.frames.length, s.name).toBeGreaterThanOrEqual(1);
      expect(s.colors.length, s.name).toBeGreaterThanOrEqual(1);
      expect(s.colors.length, s.name).toBeLessThanOrEqual(3);
      expect(usedColors(s), s.name).toBeLessThanOrEqual(3);
      for (const f of s.frames) {
        expect(f.length, s.name).toBe(s.w * s.h);
        expect(
          f.some((v) => v > 0),
          `${s.name} has an empty frame`,
        ).toBe(true);
        for (const v of f) expect(v).toBeLessThanOrEqual(s.colors.length);
      }
    }
  });

  it('animation frames differ from each other', () => {
    for (const s of SPRITES_CHARACTERS) {
      const keys = s.frames.map((f) => Array.from(f).join(''));
      expect(new Set(keys).size, `${s.name} has duplicate frames`).toBe(keys.length);
    }
  });
});

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe('fonts', () => {
  it('glyph shapes are well formed', () => {
    for (const ch of 'ABCXYZ0189.,!?:;\'"-+*/%#$&()<>=_♥') {
      const g8 = glyph8(ch)!;
      expect(g8.length).toBe(8);
      for (const r of g8) expect(r).toMatch(/^[.#]{8}$/);
    }
    for (const ch of 'AZ09\'.!-:%&') {
      const g3 = glyph3(ch)!;
      expect(g3.length).toBe(5);
      for (const r of g3) expect(r).toMatch(/^[.#]{3}$/);
    }
  });

  it('has an 8x8 glyph for every character in copy.ts', () => {
    const missing = new Set<string>();
    for (const str of strings(copy)) for (const ch of str) if (!hasGlyph8(ch)) missing.add(ch);
    expect([...missing]).toEqual([]);
  });

  it('has 8x8 and 3x5 glyphs for all store names and sign lines', () => {
    for (const st of STORES) {
      for (const str of [st.name, ...st.signLines]) {
        for (const ch of str) {
          expect(hasGlyph8(ch), `8x8 '${ch}' in ${str}`).toBe(true);
          expect(hasGlyph3(ch), `3x5 '${ch}' in ${str}`).toBe(true);
        }
      }
    }
  });

  it('maps lowercase onto uppercase', () => {
    expect(glyph8('a')).toEqual(glyph8('A'));
    expect(glyph3('z')).toEqual(glyph3('Z'));
  });
});
