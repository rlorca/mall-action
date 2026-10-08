import { describe, expect, it } from 'vitest';
import { floorY } from '../../../content/layout';
import { FEATURES } from '../../../content/layout';
import { Btn } from '../../../engine/pad';
import { place } from '../testutil';
import { newSpy } from '../spies';
import { BOOTH_FRAMES, STRIP_CELLS, STRIP_FRAMES } from './booth';
import { calmJanitor, makeXRig, parkCop, parkWalkers, type XRig } from './testrig';

const booth = FEATURES.find((f) => f.kind === 'booth')!;
const FLOOR = booth.floor; // 3F

function rig(): XRig {
  const r = makeXRig({ floor: FLOOR, x: 100 });
  calmJanitor(r);
  parkCop(r, 1, 60);
  parkWalkers(r, 300, 500);
  place(r, FLOOR, booth.x + 12);
  return r;
}

function enter(r: XRig): void {
  r.tap(Btn.UP);
}

describe('the photo booth (3F)', () => {
  it('is on 3F', () => {
    expect(FLOOR).toBe(2);
  });

  it('Up hides the agent; spies ignore him', () => {
    const r = rig();
    enter(r);
    expect(r.w.player.mode).toBe('hidden');
    expect(r.x.booth.occupied).toBe(true);
    expect(r.w.playerVisible()).toBe(false);
    // a spy that would love to shoot him (long past its first-shot delay)
    r.w.nextSpy = 1e9;
    const s = newSpy(r.w, booth.x + 90, FLOOR, 'walk');
    s.age = 1000;
    s.fireCd = 0;
    r.w.spies.push(s);
    for (let i = 0; i < 100; i++) {
      r.hold(0, 1);
      expect(s.mode).not.toBe('aim');
    }
    expect(r.w.bullets.filter((b) => b.owner === 'spy').length).toBe(0);
    expect(r.causes).toEqual([]);
  });

  it('he stays hidden for at most 5 s', () => {
    expect(BOOTH_FRAMES).toBe(300);
    const r = rig();
    enter(r);
    let frames = 0;
    while (r.w.player.mode === 'hidden' && frames < 1000) {
      r.hold(0, 1);
      frames++;
    }
    expect(frames).toBeLessThanOrEqual(300);
    expect(frames).toBeGreaterThan(290);
    expect(r.w.player.mode).toBe('ground');
    expect(r.x.booth.occupied).toBe(false);
  });

  it('Down, Left or Right gets him out early; Up and Shoot do not', () => {
    for (const [btn, out] of [
      [Btn.DOWN, true],
      [Btn.LEFT, true],
      [Btn.RIGHT, true],
      [Btn.UP, false],
      [Btn.A, false],
    ] as const) {
      const r = rig();
      enter(r);
      r.hold(0, 20);
      expect(r.w.player.mode).toBe('hidden');
      r.hold(btn, 3);
      expect(r.w.player.mode === 'hidden').toBe(!out);
    }
  });

  it('the key that went in cannot also pop him straight back out', () => {
    const r = rig();
    r.hold(Btn.UP | Btn.RIGHT, 1);
    r.hold(Btn.RIGHT, 3);
    expect(r.w.player.mode).toBe('hidden');
    r.hold(Btn.RIGHT, 20);
    expect(r.w.player.mode).toBe('ground');
  });

  it('the FIRST time he comes out each game a 4-frame photo strip pops up and joins the inventory; never again', () => {
    expect(STRIP_CELLS).toBe(4);
    const r = rig();
    expect(r.run.photoStrip).toBe(false);
    enter(r);
    r.hold(0, 20);
    r.sfx.length = 0;
    r.hold(Btn.LEFT, 2);
    expect(r.run.photoStrip).toBe(true);
    expect(r.run.inventoryLine()).toContain('PHOTO STRIP');
    expect(r.sfx).toContain('camera');
    const strip = r.x.booth.strip!;
    expect(strip).not.toBeNull();
    expect(strip.total).toBe(STRIP_FRAMES);
    r.hold(0, STRIP_FRAMES + 5);
    expect(r.x.booth.strip).toBeNull();
    // second visit
    place(r, FLOOR, booth.x + 12);
    enter(r);
    r.hold(0, 20);
    r.sfx.length = 0;
    r.hold(Btn.LEFT, 2);
    expect(r.x.booth.strip).toBeNull();
    expect(r.sfx).not.toContain('camera');
    expect(r.run.inventory.filter((i) => i === 'PHOTO STRIP').length).toBe(0);
  });

  it('timing out inside the booth also counts as coming out', () => {
    const r = rig();
    enter(r);
    r.hold(0, 305);
    expect(r.run.photoStrip).toBe(true);
    expect(r.x.booth.strip).not.toBeNull();
  });

  it('only works at the booth', () => {
    const r = rig();
    place(r, FLOOR, booth.x + 80);
    r.tap(Btn.UP);
    expect(r.w.player.mode).toBe('ground');
    place(r, 1, booth.x + 12);
    r.tap(Btn.UP);
    expect(r.w.player.mode).toBe('ground');
    expect(floorY(FLOOR)).toBeGreaterThan(0);
  });
});
