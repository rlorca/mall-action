import { describe, expect, it } from 'vitest';
import { SPRITES_OBJECTS } from '../src/art/sprites-objects';
import { SPRITES_TILES } from '../src/art/sprites-tiles';
import { usedColors, type SpriteDef } from '../src/art/pixel';
import { THEMES } from '../src/data/stores';

// [name, w, h, minFrames]
const OBJECTS: [string, number, number, number][] = [
  ['bullet_p', 4, 2, 1], ['bullet_e', 4, 2, 1], ['bullet_top', 4, 4, 2], ['spark_hit', 8, 8, 2], ['puff', 16, 16, 4], ['star_pop', 8, 8, 3],
  ['elev_car_closed', 32, 36, 1], ['elev_car_open', 32, 36, 1], ['elev_car_roof', 32, 4, 1], ['elev_shaft_wall', 32, 16, 1],
  ['elev_grate', 32, 4, 1], ['elev_pit', 32, 8, 1], ['elev_button', 8, 12, 2], ['elev_led', 24, 10, 1],
  ['esc_step', 8, 8, 4], ['esc_rail', 8, 8, 1], ['esc_landing', 16, 8, 1],
  ['lamp_shade', 16, 12, 1], ['lamp_cord', 2, 8, 1], ['lamp_shatter', 16, 12, 3], ['disco_ball', 16, 16, 4], ['disco_ball_hang', 16, 24, 1],
  ['fountain', 32, 24, 3], ['fountain_spray', 8, 16, 3], ['coin', 8, 8, 4], ['coin_gold', 8, 8, 4],
  ['kiosk', 24, 32, 2], ['photobooth', 24, 32, 1], ['photobooth_open', 24, 32, 1], ['bench', 24, 12, 1], ['plant', 16, 24, 1], ['plant_big', 16, 32, 1],
  ['trashcan', 10, 12, 1], ['pillar', 16, 48, 1], ['getaway_wagon', 48, 24, 2], ['getaway_wagon_lights', 48, 24, 1],
  ['wet_sign', 12, 14, 1], ['wet_patch', 48, 4, 2], ['anchor_post', 8, 16, 1], ['roof_ac', 24, 16, 1], ['antenna', 8, 24, 2],
  ['parking_sign', 16, 16, 1], ['exit_sign', 16, 8, 1], ['security_cam', 8, 8, 1],
  ['item_package', 16, 16, 2], ['item_rapid', 16, 16, 1], ['item_spread', 16, 16, 1], ['item_armor', 16, 16, 1], ['item_sneakers', 16, 16, 1],
  ['item_radar', 16, 16, 1], ['item_oneup', 16, 16, 1], ['item_cinnabomb', 16, 16, 1], ['item_juice', 16, 16, 1], ['item_pretzel', 16, 16, 1],
  ['item_coupon', 16, 16, 1], ['item_guide', 16, 16, 1], ['item_rock', 16, 16, 1], ['item_moodring', 16, 16, 1], ['item_share', 16, 16, 1], ['item_photo', 16, 16, 1],
  ['icon_armor', 8, 8, 1], ['icon_radar', 8, 8, 1], ['icon_head', 8, 8, 1], ['icon_pkg', 8, 8, 1],
  ['bubble_tail', 6, 4, 1], ['alarm_light', 16, 8, 2], ['zip_cable_pulley', 16, 8, 1], ['speaker_note', 8, 8, 2],
];

const SPECIAL_TILES: [string, number][] = [
  ['tile_fitting', 1], ['tile_fitting_open', 1], ['tile_toyshelf', 1], ['tile_toyshelf_empty', 1], ['tile_booth', 2],
  ['tile_demotv', 3], ['tile_pedestal', 2], ['tile_door', 1], ['tile_door_mat', 1],
];
const KINDS = ['floor', 'wall', 'fixture', 'fixture_open', 'fixture2', 'fixture2_open', 'counter', 'decor', 'decor2'];

const byName = new Map<string, SpriteDef>();
for (const s of [...SPRITES_OBJECTS, ...SPRITES_TILES]) {
  if (byName.has(s.name)) throw new Error(`duplicate ${s.name}`);
  byName.set(s.name, s);
}

describe('object sprites', () => {
  for (const [name, w, h, frames] of OBJECTS) {
    it(`${name} is ${w}x${h} with >= ${frames} frames and <= 3 colours`, () => {
      const s = byName.get(name);
      expect(s, `missing ${name}`).toBeDefined();
      expect(s!.w).toBe(w);
      expect(s!.h).toBe(h);
      expect(s!.frames.length).toBeGreaterThanOrEqual(frames);
      expect(usedColors(s!)).toBeLessThanOrEqual(3);
      expect(s!.frames.some((f) => f.some((v) => v !== 0))).toBe(true);
    });
  }
});

describe('store tiles', () => {
  it('has every theme x kind tile at 16x16', () => {
    for (const theme of THEMES)
      for (const kind of KINDS) {
        const s = byName.get(`tile_${theme}_${kind}`);
        expect(s, `missing tile_${theme}_${kind}`).toBeDefined();
        expect(s!.w).toBe(16);
        expect(s!.h).toBe(16);
        expect(usedColors(s!)).toBeLessThanOrEqual(3);
      }
  });
  it('opened fixtures differ from closed ones', () => {
    for (const theme of THEMES)
      for (const k of ['fixture', 'fixture2']) {
        const a = byName.get(`tile_${theme}_${k}`)!.frames[0];
        const b = byName.get(`tile_${theme}_${k}_open`)!.frames[0];
        expect(Array.from(a).join('')).not.toBe(Array.from(b).join(''));
      }
  });
  for (const [name, frames] of SPECIAL_TILES) {
    it(`${name} is 16x16 with >= ${frames} frames`, () => {
      const s = byName.get(name);
      expect(s, `missing ${name}`).toBeDefined();
      expect(s!.w).toBe(16);
      expect(s!.h).toBe(16);
      expect(s!.frames.length).toBeGreaterThanOrEqual(frames);
      expect(usedColors(s!)).toBeLessThanOrEqual(3);
    });
  }
});
