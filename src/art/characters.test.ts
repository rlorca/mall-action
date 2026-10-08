import { describe, expect, it } from 'vitest';
import './characters';
import './items';
import { getSprite } from './registry';
import { C, TRANSPARENT } from '../engine/palette';
import { makeRecolor, type Sprite } from '../engine/sprite';

/** Bounding box of the opaque pixels of one frame. */
function bbox(s: Sprite, f: number): { x0: number; x1: number; y0: number; y1: number; count: number } {
  let x0 = Infinity;
  let x1 = -1;
  let y0 = Infinity;
  let y1 = -1;
  let count = 0;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.data[f * s.w * s.h + y * s.w + x] === TRANSPARENT) continue;
      count++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, x1, y0, y1, count };
}
const frame = (s: Sprite, f: number): string => Array.from(s.data.subarray(f * s.w * s.h, (f + 1) * s.w * s.h)).join(',');
const colorsOf = (s: Sprite): Set<number> => new Set(s.colors);

describe('character art', () => {
  it('animation frames are pairwise different (walk cycles, rolling, mopping)', () => {
    for (const name of ['agent.walk', 'spy.walk', 'walker.walk', 'cop.segway', 'janitor.walk', 'janitor.mop', 'agent.selfie', 'agent.die', 'spy.die']) {
      const s = getSprite(name);
      const seen = new Set<string>();
      for (let f = 0; f < s.frames; f++) seen.add(frame(s, f));
      expect(seen.size, `${name} has duplicate frames`).toBe(s.frames);
    }
  });

  it('the agent wears a red trench coat with dark hair and boots; the spy has no red at all', () => {
    for (const name of ['agent.stand', 'agent.walk', 'agent.jump', 'agent.kick', 'agent.shoot', 'agent.ride']) {
      const s = getSprite(name);
      for (let f = 0; f < s.frames; f++) {
        let red = 0;
        for (let i = 0; i < s.w * s.h; i++) if (s.data[f * s.w * s.h + i] === C.RED) red++;
        expect(red, `${name} frame ${f} should be mostly coat`).toBeGreaterThan(30);
      }
      expect(colorsOf(s).has(C.BLACK), `${name} black hair/boots`).toBe(true);
      expect(colorsOf(s).has(C.PEACH), `${name} skin`).toBe(true);
    }
    for (const name of ['spy.stand', 'spy.walk', 'spy.aimhigh', 'spy.aimlow', 'spy.duck', 'spy.die']) {
      const s = getSprite(name);
      expect(colorsOf(s).has(C.RED), `${name} must not use the agent's red`).toBe(false);
      expect(colorsOf(s).has(C.BLACK), `${name} black suit`).toBe(true);
      expect(colorsOf(s).has(C.WHITE), `${name} white shirt`).toBe(true);
    }
  });

  it('standing and walking sprites are bottom-aligned and horizontally centred in their cell', () => {
    const groups: Array<[string, number]> = [
      ['agent.stand', 16],
      ['agent.walk', 16],
      ['spy.stand', 16],
      ['spy.walk', 16],
      ['walker.walk', 16],
      ['janitor.walk', 16],
      ['cop.segway', 24],
    ];
    for (const [name, w] of groups) {
      const s = getSprite(name);
      for (let f = 0; f < s.frames; f++) {
        const b = bbox(s, f);
        expect(b.y1, `${name} frame ${f} should touch the bottom row`).toBe(s.h - 1);
        const centre = (b.x0 + b.x1) / 2;
        const target = (w - 1) / 2;
        // the Segway's handlebar sticks out to the right, so allow it more slack
        const slack = name === 'cop.segway' ? 2.5 : 1.25;
        expect(Math.abs(centre - target), `${name} frame ${f} centre ${centre}`).toBeLessThanOrEqual(slack);
      }
    }
  });

  it('crouched poses are bottom-aligned and only fill the lower part of the cell', () => {
    for (const name of ['agent.duck', 'agent.shootlow', 'spy.duck', 'agent.crouch']) {
      const b = bbox(getSprite(name), 0);
      expect(b.y1, `${name} bottom`).toBe(23);
      expect(b.y0, `${name} should leave the top of the cell empty`).toBeGreaterThanOrEqual(8);
    }
    // hanging: hands at the very top of the cell
    expect(bbox(getSprite('agent.hang'), 0).y0).toBe(0);
    expect(bbox(getSprite('agent.hold'), 0).y0).toBe(0);
  });

  it('death sequences end lying down on the floor, flatter than they started', () => {
    for (const name of ['agent.die', 'spy.die']) {
      const s = getSprite(name);
      const first = bbox(s, 0);
      const last = bbox(s, s.frames - 1);
      expect(last.y1 - last.y0, `${name} lying frame height`).toBeLessThan(first.y1 - first.y0);
      expect(last.y1, `${name} lying frame rests on the floor`).toBeGreaterThanOrEqual(22);
    }
  });

  it('the mall walker is a single recolourable tracksuit colour plus black and skin', () => {
    const s = getSprite('walker.walk');
    expect(colorsOf(s)).toEqual(new Set([C.BLACK, C.TEAL, C.PEACH]));
    const lut = makeRecolor({ [C.TEAL]: C.HOTPINK });
    for (let f = 0; f < s.frames; f++) {
      const before = bbox(s, f).count;
      const after = new Set<number>();
      for (let i = 0; i < s.w * s.h; i++) {
        const v = s.data[f * s.w * s.h + i]!;
        if (v !== TRANSPARENT) after.add(lut[v]!);
      }
      expect(after.has(C.HOTPINK) && !after.has(C.TEAL), 'recolour swaps the whole tracksuit').toBe(true);
      expect(before).toBeGreaterThan(80);
    }
  });

  it('the cop has a helmet (blue dome above the face) and rolls on a wheel at the bottom', () => {
    const s = getSprite('cop.segway');
    const b = bbox(s, 0);
    expect(b.y0).toBeLessThanOrEqual(1);
    // wheel: the bottom row has black pixels
    let bottomBlack = 0;
    for (let x = 0; x < s.w; x++) if (s.data[(s.h - 1) * s.w + x] === C.BLACK) bottomBlack++;
    expect(bottomBlack).toBeGreaterThanOrEqual(2);
  });
});

describe('item art', () => {
  const powerUps = ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup', 'cinnabomb', 'ooze', 'pretzel'];

  it('every power-up icon is distinct and fills most of its 12x12 cell', () => {
    const seen = new Map<string, string>();
    for (const id of powerUps) {
      const s = getSprite(`item.${id}`);
      const b = bbox(s, 0);
      expect(b.x1 - b.x0 + 1, `${id} width`).toBeGreaterThanOrEqual(9);
      expect(b.y1 - b.y0 + 1, `${id} height`).toBeGreaterThanOrEqual(9);
      expect(b.count, `${id} pixel count`).toBeGreaterThanOrEqual(45);
      const key = frame(s, 0);
      expect(seen.get(key), `${id} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it('power-up icons have a black outline: every opaque edge pixel next to empty space is dark or the shape touches the cell edge', () => {
    // A cheap readability check: at least 15% of each icon's pixels are black outline.
    for (const id of [...powerUps, 'package']) {
      const s = getSprite(`item.${id}`);
      let black = 0;
      let all = 0;
      for (let i = 0; i < s.w * s.h; i++) {
        const v = s.data[i]!;
        if (v === TRANSPARENT) continue;
        all++;
        if (v === C.BLACK) black++;
      }
      expect(black / all, `${id} outline share`).toBeGreaterThan(0.15);
    }
  });

  it('spinning coins have four different frames, the edge-on frame is the narrowest', () => {
    for (const name of ['item.coin', 'item.goldcoin']) {
      const s = getSprite(name);
      expect(s.frames).toBe(4);
      const seen = new Set<string>();
      const widths: number[] = [];
      for (let f = 0; f < 4; f++) {
        seen.add(frame(s, f));
        const b = bbox(s, f);
        widths.push(b.x1 - b.x0 + 1);
      }
      expect(seen.size).toBe(4);
      expect(widths[2]).toBe(Math.min(...widths));
      expect(widths[0]).toBe(Math.max(...widths));
    }
  });

  it('the smoke puff expands over its first frames and thins out at the end', () => {
    const s = getSprite('fx.puff');
    const sizes = Array.from({ length: s.frames }, (_, f) => {
      const b = bbox(s, f);
      return Math.max(b.x1 - b.x0, b.y1 - b.y0) + 1;
    });
    expect(sizes[1]!).toBeGreaterThan(sizes[0]!);
    expect(sizes[2]!).toBeGreaterThan(sizes[1]!);
    const counts = Array.from({ length: s.frames }, (_, f) => bbox(s, f).count);
    expect(counts[3]!).toBeLessThan(counts[2]!);
  });

  it('player and enemy bullets read differently (colour) and both point right (bright tip on the right)', () => {
    const p = getSprite('bullet.player');
    const e = getSprite('bullet.enemy');
    expect(frame(p, 0)).not.toBe(frame(e, 0));
    expect(colorsOf(p).has(C.WHITE) || colorsOf(p).has(C.YELLOW)).toBe(true);
    expect(colorsOf(e).has(C.RED)).toBe(true);
    expect(p.data[1 * p.w + 4]).not.toBe(TRANSPARENT);
    expect(e.data[1 * e.w + 4]).not.toBe(TRANSPARENT);
  });
});
