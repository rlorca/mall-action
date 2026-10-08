import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { floorY } from '../content/layout';
import { Btn } from '../engine/pad';
import { makeXRig, parkCop, type XRig } from '../game/mall/modules/testrig';
import { place } from '../game/mall/testutil';
import { drawMallActors, drawMallFurniture } from './mallActorsView';

const BG = C.OFFWHITE;
const HUD_MARK = C.LTGRAY;

function rig(floor = 4, x = 200): XRig {
  const r = makeXRig({ floor, x });
  parkCop(r, 1, 60);
  r.x.janitor.janitor.nextMop = 1e9;
  r.x.janitor.janitor.x = 30;
  return r;
}

function camFor(r: XRig, floor: number, camX: number): { camX: number; camY: number } {
  void r;
  return { camX, camY: floorY(floor) - 150 };
}

function draw(r: XRig, camX: number, camY: number, frame = 0, bg = BG): Framebuffer {
  const fb = new Framebuffer();
  fb.clear(bg);
  fb.fillRect(0, 0, 256, 16, HUD_MARK);
  drawMallFurniture(fb, r.w, camX, camY, frame);
  drawMallActors(fb, r.w, camX, camY, frame);
  return fb;
}

/** Number of pixels in a screen rect that are not `bg`. */
function inked(fb: Framebuffer, x: number, y: number, w: number, h: number, bg = BG): number {
  let n = 0;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (fb.getPixel(xx, yy) !== bg) n++;
  return n;
}

describe('mall furniture and actors view', () => {
  it('draws every extra without throwing, the same way twice, and never changes the rules state', () => {
    const r = rig(3, 340);
    r.x.janitor.patch = { x: 200, t: 300 };
    r.x.booth.strip = { x: 150, y: floorY(2), t: 40, total: 200 };
    r.tap(Btn.UP);
    const before = JSON.stringify([r.w.player, r.w.spies, r.w.pickups, r.x.cop.cop, r.x.walkers.walkers, r.x.lamps.lamps]);
    const a = draw(r, 300, floorY(3) - 150, 5);
    const b = draw(r, 300, floorY(3) - 150, 5);
    expect(a.hash()).toBe(b.hash());
    expect(JSON.stringify([r.w.player, r.w.spies, r.w.pickups, r.x.cop.cop, r.x.walkers.walkers, r.x.lamps.lamps])).toBe(before);
    expect(a.countNot(BG)).toBeGreaterThan(200);
  });

  it('does nothing without the extras', () => {
    const r = rig();
    r.w.extras = null;
    const fb = draw(r, 100, floorY(4) - 150);
    expect(fb.countNot(BG)).toBe(256 * 16); // only the HUD strip stand-in
  });

  it('draws a wet patch with a yellow sign only while it exists', () => {
    const r = rig(4, 100);
    const { camX, camY } = camFor(r, 4, 100);
    const dry = draw(r, camX, camY);
    r.x.janitor.patch = { x: 200, t: 500 };
    const wet = draw(r, camX, camY);
    const y = floorY(4) - camY + 16;
    expect(inked(dry, 76, y - 14, 48, 16)).toBe(0);
    expect(inked(wet, 76, y - 14, 48, 16)).toBeGreaterThan(40);
    // the sign (sprite colours include yellow) stands inside the patch
    let yellow = 0;
    for (let yy = y - 14; yy < y; yy++) for (let xx = 76; xx < 124; xx++) if (wet.getPixel(xx, yy) === C.YELLOW) yellow++;
    expect(yellow).toBeGreaterThan(3);
    // and it lines up with the patch: nothing is drawn outside its 48 px (+ the dome)
    expect(inked(wet, 64, y - 14, 12, 16)).toBe(0);
    expect(inked(wet, 124, y - 14, 20, 16)).toBe(0);
  });

  it('shows the kiosk screen only while it is being used, and the curtain of the booth while someone is inside', () => {
    const r = rig(2, 200);
    const { camX, camY } = camFor(r, 2, 600);
    const idle = draw(r, camX, camY);
    r.x.kiosks.panel = { kiosk: r.x.kiosks.kiosks.findIndex((k) => k.floor === 2), target: null, t: 100, total: 240 };
    const used = draw(r, camX, camY);
    // compare only the kiosk's own rect (the panel is drawn elsewhere)
    const kx = 650 - camX;
    const ky = floorY(2) - camY + 16 - 32;
    let differ = 0;
    for (let yy = ky; yy < ky + 32; yy++) for (let xx = kx; xx < kx + 24; xx++) if (idle.getPixel(xx, yy) !== used.getPixel(xx, yy)) differ++;
    expect(differ).toBeGreaterThan(10);
    const open = draw(r, 20, camY);
    r.tap(Btn.UP);
    place(r, 2, 132);
    r.tap(Btn.UP);
    expect(r.x.booth.occupied).toBe(true);
    const shut = draw(r, 20, camY);
    expect(shut.hash()).not.toBe(open.hash());
  });

  it('the directory panel lists the floors and flashes the target store', () => {
    const r = rig(2, 662);
    r.tap(Btn.UP);
    expect(r.x.kiosks.panel).not.toBeNull();
    r.hold(0, 20);
    const a = draw(r, 520, floorY(2) - 150, 0);
    const b = draw(r, 520, floorY(2) - 150, 10);
    expect(a.hash()).not.toBe(b.hash()); // the highlight blinks
    // the panel sits at the top of the play view, centred, in a black box
    expect(a.getPixel(128, 40)).not.toBe(BG);
    expect(inked(a, 64, 22, 128, 60)).toBeGreaterThan(2000);
  });

  it('a shattered lamp darkens about 96 px of its floor for ~2 s, not the HUD, and then it is light again', () => {
    const r = rig(1, 100);
    const lamp = r.x.lamps.lamps.find((l) => l.floor === 1 && l.homeX === 374)!;
    r.x.lamps.release(r.w, lamp, 1);
    let n = 0;
    while (lamp.mode !== 'broken' && n++ < 100) r.hold(0, 1);
    r.hold(0, 10);
    expect(r.x.lamps.dark.length).toBe(1);
    // a camera that puts this corridor right under the HUD, so an unclipped overlay would hit it
    const camX = 250;
    const camY = floorY(1) - 40 - 3; // the corridor's top edge lands at screen y 19
    r.x.lamps.lamps.forEach((l) => {
      if (l !== lamp) l.mode = 'broken';
    });
    const fb = new Framebuffer();
    fb.clear(C.WHITE);
    fb.fillRect(0, 0, 256, 16, HUD_MARK);
    drawMallActors(fb, r.w, camX, camY, 0);
    const y = floorY(1) - camY + 16 - 12;
    const lx = 374 - camX;
    expect(fb.getPixel(lx, y)).not.toBe(C.WHITE);
    expect(fb.getPixel(lx + 30, y + 1)).not.toBe(C.WHITE);
    expect(fb.getPixel(lx + 70, y)).toBe(C.WHITE); // outside the +-48 px (+ soft edge)
    expect(fb.getPixel(lx - 70, y)).toBe(C.WHITE);
    for (let xx = 0; xx < 256; xx++) for (let yy = 0; yy < 16; yy++) expect(fb.getPixel(xx, yy)).toBe(HUD_MARK);
    // after its 2 s the darkness is gone
    r.hold(0, 125);
    const fb2 = new Framebuffer();
    fb2.clear(C.WHITE);
    drawMallActors(fb2, r.w, camX, camY, 0);
    expect(fb2.getPixel(lx, y)).toBe(C.WHITE);
  });

  it('the two mall walkers wear different tracksuits', () => {
    const r = rig(3, 340);
    const [a, b] = r.x.walkers.walkers;
    a!.x = 300;
    b!.x = 400;
    const fb = draw(r, 250, floorY(3) - 150);
    const left = (x0: number, c: number): number => {
      let n = 0;
      for (let yy = 100; yy < 200; yy++) for (let xx = x0 - 50; xx < x0 - 50 + 100; xx++) if (fb.getPixel(xx, yy) === c) n++;
      return n;
    };
    const ax = 300 - 250;
    const bx = 400 - 250;
    // each walker is within its own window; the second is recoloured
    expect(left(ax, C.TEAL) + left(bx, C.TEAL)).toBeGreaterThan(20);
    expect(left(bx, C.PINKRED)).toBeGreaterThan(20);
    expect(left(ax, C.PINKRED)).toBe(0);
  });

  it('the photo strip pops up with its four photos taken one after the other', () => {
    const r = rig(2, 132);
    const camY = floorY(2) - 150;
    const hashes = new Set<number>();
    for (const t of [0, 10, 26, 44, 55, 100]) {
      r.x.booth.strip = { x: 132, y: floorY(2), t, total: 200 };
      hashes.add(draw(r, 40, camY).hash());
    }
    expect(hashes.size).toBe(6);
    r.x.booth.strip = null;
    const none = draw(r, 40, camY).hash();
    expect(hashes.has(none)).toBe(false);
  });
});
