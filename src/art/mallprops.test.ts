import { describe, expect, it } from 'vitest';
import './mallprops';
import { getSprite } from './registry';
import { REQUIRED_SPRITES } from './manifest';
import { C, TRANSPARENT } from '../engine/palette';
import { spritePixel, type Sprite } from '../engine/sprite';

const frameData = (s: Sprite, f: number): Uint8Array => s.data.subarray(f * s.w * s.h, (f + 1) * s.w * s.h);
const frameKey = (s: Sprite, f: number): string => Array.from(frameData(s, f)).join(',');
const opaqueCount = (s: Sprite, f: number): number => frameData(s, f).reduce((n, v) => n + (v !== TRANSPARENT ? 1 : 0), 0);
const column = (s: Sprite, f: number, x: number): number[] => Array.from({ length: s.h }, (_, y) => spritePixel(s, x, y, f));
const row = (s: Sprite, f: number, y: number): number[] => Array.from({ length: s.w }, (_, x) => spritePixel(s, x, y, f));

function expectFramesPairwiseDiffer(name: string): void {
  const s = getSprite(name);
  const keys = Array.from({ length: s.frames }, (_, f) => frameKey(s, f));
  expect(new Set(keys).size, `${name} frames must all differ`).toBe(s.frames);
}

describe('mallprops art', () => {
  it('defines every mallprops manifest entry at its exact size with enough frames', () => {
    const mine = REQUIRED_SPRITES.filter((r) => r.owner === 'mallprops');
    expect(mine.length).toBeGreaterThan(20);
    for (const r of mine) {
      const s = getSprite(r.name);
      expect([r.name, s.w, s.h]).toEqual([r.name, r.w, r.h]);
      expect(s.frames, r.name).toBeGreaterThanOrEqual(r.frames);
      expect(s.colors.length, r.name).toBeLessThanOrEqual(3);
    }
  });

  describe('tiles', () => {
    it('mall.wall, mall.slab and shaft.wall are fully opaque (no holes when tiled)', () => {
      for (const [name, frames] of [['mall.wall', 2], ['mall.slab', 1], ['shaft.wall', 1]] as const) {
        const s = getSprite(name);
        for (let f = 0; f < frames; f++) expect(opaqueCount(s, f), `${name} frame ${f}`).toBe(s.w * s.h);
      }
    });

    it('mall.wall variants share their edge rows and columns, so any mix of them tiles without a seam', () => {
      const w = getSprite('mall.wall');
      expect(w.frames).toBeGreaterThanOrEqual(2);
      expect(column(w, 0, 0)).toEqual(column(w, 1, 0));
      expect(column(w, 0, 15)).toEqual(column(w, 1, 15));
      expect(row(w, 0, 0)).toEqual(row(w, 1, 0));
      expect(row(w, 0, 15)).toEqual(row(w, 1, 15));
      expect(frameKey(w, 0)).not.toBe(frameKey(w, 1));
    });

    it('mall.wall is vertically periodic in its structure: first and last row use only the plain colours', () => {
      const w = getSprite('mall.wall');
      for (let f = 0; f < 2; f++) {
        // no accent flecks on the top/bottom rows (they would double up where tiles meet)
        const accent = new Set<number>([C.TEAL]);
        for (const y of [0, 15]) for (const v of row(w, f, y)) expect(accent.has(v)).toBe(false);
      }
    });

    it('mall.slab: the top row is one continuous walking-surface colour and wraps without a step', () => {
      const s = getSprite('mall.slab');
      const top = row(s, 0, 0);
      expect(new Set(top).size).toBe(1);
      // underside row is dark and continuous too
      expect(new Set(row(s, 0, 7)).size).toBe(1);
      expect(top[0]).not.toBe(row(s, 0, 7)[0]);
    });

    it('wall and slab colours fade gracefully with darken() (no hue nibble >= 0x0d)', () => {
      for (const name of ['mall.wall', 'mall.slab']) {
        for (const c of getSprite(name).colors) expect(c & 0x0f, `${name} colour ${c.toString(16)}`).toBeLessThan(0x0d);
      }
    });

    it('shaft.wall is dark (mostly black) so the lit car pops', () => {
      const s = getSprite('shaft.wall');
      let dark = 0;
      for (const v of frameData(s, 0)) if (v === C.BLACK) dark++;
      expect(dark / (s.w * s.h)).toBeGreaterThan(0.5);
    });

    it('esc.step phases all differ, stay opaque and keep the same silhouette', () => {
      const s = getSprite('esc.step');
      expect(s.frames).toBe(4);
      expectFramesPairwiseDiffer('esc.step');
      for (let f = 0; f < 4; f++) expect(opaqueCount(s, f)).toBe(s.w * s.h);
    });
  });

  describe('elevator', () => {
    it('car.open differs from car.closed and shows a bright, readable interior', () => {
      const closed = getSprite('car.closed');
      const open = getSprite('car.open');
      expect(frameKey(open, 0)).not.toBe(frameKey(closed, 0));
      // interior behind the agent (x 7..16, y 10..21) is mostly the lit cream wall
      let cream = 0;
      let total = 0;
      for (let y = 10; y < 22; y++) {
        for (let x = 7; x < 17; x++) {
          total++;
          if (spritePixel(open, x, y) === C.CREAM) cream++;
        }
      }
      expect(cream / total).toBeGreaterThan(0.6);
      // closed car: no cream-dominated interior (it is brass doors)
      let amber = 0;
      for (let y = 10; y < 26; y++) for (let x = 3; x < 21; x++) if (spritePixel(closed, x, y) === C.AMBER) amber++;
      expect(amber).toBeGreaterThan(80);
    });

    it('both cars are solid slabs on top (standable roof) and end in a floor line', () => {
      for (const name of ['car.closed', 'car.open']) {
        const s = getSprite(name);
        expect(row(s, 0, 0).every((v) => v !== TRANSPARENT), `${name} roof row`).toBe(true);
        expect(row(s, 0, s.h - 1).every((v) => v !== TRANSPARENT), `${name} floor row`).toBe(true);
        expect(opaqueCount(s, 0)).toBe(s.w * s.h);
      }
    });

    it('grate is a solid bar the agent can stand on', () => {
      const g = getSprite('grate');
      expect(row(g, 0, 0).every((v) => v !== TRANSPARENT)).toBe(true);
    });
  });

  describe('animated props', () => {
    it('fountain has 4 frames that pairwise differ and keep their silhouette base', () => {
      const f = getSprite('fountain');
      expect(f.frames).toBe(4);
      expectFramesPairwiseDiffer('fountain');
      // the basin (bottom rows) is identical in every frame; only water and spray move
      for (let fr = 1; fr < 4; fr++) {
        for (let y = 15; y < 24; y++) expect(row(f, fr, y)).toEqual(row(f, 0, y));
      }
    });

    it('disco.ball is round, rotates (4 distinct frames) and sparkles', () => {
      const b = getSprite('disco.ball');
      expect(b.frames).toBe(4);
      expectFramesPairwiseDiffer('disco.ball');
      for (let f = 0; f < 4; f++) {
        expect(spritePixel(b, 0, 0, f)).toBe(TRANSPARENT);
        expect(spritePixel(b, 11, 11, f)).toBe(TRANSPARENT);
        expect(spritePixel(b, 6, 6, f)).not.toBe(TRANSPARENT);
        expect(frameData(b, f).filter((v) => v === C.WHITE).length, `sparkles in frame ${f}`).toBeGreaterThanOrEqual(3);
      }
    });

    it('frame 1 of kiosk, booth, wagon and lamp.shade differs from frame 0', () => {
      for (const name of ['kiosk', 'booth', 'wagon', 'lamp.shade', 'pigeon', 'mall.wall']) {
        const s = getSprite(name);
        expect(s.frames, name).toBeGreaterThanOrEqual(2);
        expect(frameKey(s, 1), name).not.toBe(frameKey(s, 0));
      }
    });

    it('kiosk screen glows in frame 1 only', () => {
      const k = getSprite('kiosk');
      const glow = (f: number): number => frameData(k, f).filter((v) => v === C.CYAN).length;
      expect(glow(1)).toBeGreaterThan(glow(0) + 40);
    });

    it('booth frame 1 draws the curtain and shows feet under it', () => {
      const b = getSprite('booth');
      const pink = (f: number): number => frameData(b, f).filter((v) => v === C.PINK).length;
      expect(pink(1)).toBeGreaterThan(pink(0));
      // under the hem: black shoes against teal wall
      const under = new Set<number>();
      for (let y = 26; y < 30; y++) for (let x = 5; x < 19; x++) under.add(spritePixel(b, x, y, 1));
      expect(under.has(C.BLACK)).toBe(true);
      expect(under.has(C.TEAL)).toBe(true);
    });

    it('lamp.shade frame 0 is lit (pale yellow glow), frame 1 is dark', () => {
      const l = getSprite('lamp.shade');
      const glow = (f: number): number => frameData(l, f).filter((v) => v === C.PALEYELLOW).length;
      expect(glow(0)).toBeGreaterThan(8);
      expect(glow(1)).toBe(0);
    });

    it('wagon: frame 1 adds headlight beams to the right of the body', () => {
      const w = getSprite('wagon');
      const rightEdge = (f: number): number => {
        let n = 0;
        for (let y = 0; y < w.h; y++) for (let x = 67; x < w.w; x++) if (spritePixel(w, x, y, f) !== TRANSPARENT) n++;
        return n;
      };
      expect(rightEdge(1)).toBeGreaterThan(rightEdge(0));
      expect(opaqueCount(w, 1)).toBeGreaterThan(opaqueCount(w, 0));
    });
  });

  describe('roof and parking props', () => {
    it('pillar has hazard stripes (yellow) near its base and plain concrete above', () => {
      const p = getSprite('pillar');
      const yellowRows = new Set<number>();
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (spritePixel(p, x, y) === C.YELLOW) yellowRows.add(y);
      expect(Math.min(...yellowRows)).toBeGreaterThanOrEqual(30);
      expect(yellowRows.size).toBeGreaterThanOrEqual(8);
    });

    it('plant is green on top of an orange pot', () => {
      const p = getSprite('plant');
      expect(p.colors).toContain(C.ORANGE);
      expect(p.colors).toContain(C.LTGREEN);
    });

    it('post carries its cable eyebolt at sprite (4, 2) like ARRIVAL.postX / postTopY expect', () => {
      const p = getSprite('post');
      // ring around an empty hole: black above, left and right of (4, 2) but nothing at the hole itself
      expect(spritePixel(p, 4, 1)).toBe(C.BLACK);
      expect(spritePixel(p, 3, 2)).toBe(C.BLACK);
      expect(spritePixel(p, 5, 2)).toBe(C.BLACK);
      expect(spritePixel(p, 4, 2)).toBe(TRANSPARENT);
    });
  });
});
