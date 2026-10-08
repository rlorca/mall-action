/**
 * Compose a sample corridor from the mallprops art (tiled wall + slab, a shaft with an open car,
 * kiosk, plant, fountain, lamp, escalator...) so you can LOOK at how the pieces sit together.
 *
 *   npx tsx scripts/mall-preview.ts [out.png] [scale]
 *
 * Only imports the mallprops module, so it keeps working while other art modules are mid-edit.
 */
import { Framebuffer } from '../src/engine/framebuffer';
import { C } from '../src/engine/palette';
import { writeFramebufferPng } from './png';
import '../src/art/mallprops';
import { getSprite } from '../src/art/registry';

const out = process.argv[2] ?? 'playtest-out/mall-preview.png';
const scale = Number(process.argv[3] ?? 4);

const fb = new Framebuffer();
fb.clear(C.BLACK);

const FLOORS = [64, 112, 160, 208]; // walking-surface y of each floor in this sample

function tileWall(y0: number, y1: number): void {
  const wall = getSprite('mall.wall');
  for (let y = y0; y < y1; y += 16) {
    for (let x = 0; x < fb.w; x += 16) {
      // mix the variants every few tiles, like the renderer might
      const variant = (x / 16 + (y - y0) / 16) % 5 === 2 ? 1 : 0;
      fb.sprite(wall, x, y, { frame: variant });
    }
  }
}

function tileSlab(y: number, skipX0 = -1, skipX1 = -1): void {
  const slab = getSprite('mall.slab');
  fb.pushClip(0, y, skipX0 < 0 ? fb.w : skipX0, 8);
  for (let x = 0; x < fb.w; x += 16) fb.sprite(slab, x, y);
  fb.popClip();
  if (skipX0 >= 0) {
    fb.pushClip(skipX1, y, fb.w - skipX1, 8);
    for (let x = 0; x < fb.w; x += 16) fb.sprite(slab, x, y);
    fb.popClip();
  }
}

const SHAFT_X = 104;
const shaftTop = FLOORS[0]! - 40;
const shaftBottom = FLOORS[3]!;

// corridors
for (const f of FLOORS) {
  fb.pushClip(0, f - 40, fb.w, 40);
  tileWall(f - 40, f);
  fb.popClip();
}
// shaft interior, tiled vertically through the slabs
const shaft = getSprite('shaft.wall');
for (let y = shaftTop; y < shaftBottom; y += 16) fb.sprite(shaft, SHAFT_X, y);
// slabs (each floor's slab is the 8 px under its surface), openings cut at the shaft
for (const f of FLOORS) tileSlab(f, SHAFT_X, SHAFT_X + 24);
tileSlab(FLOORS[0]! - 48);
// the structure between corridors and the very top
fb.fillRect(0, 0, fb.w, 16, C.BLACK);

// elevator: car at floor 2 (open), grate on floor 3 (car above), pit on floor 1 (car below)
const car = getSprite('car.open');
fb.sprite(car, SHAFT_X, FLOORS[1]! - 32);
fb.sprite(getSprite('grate'), SHAFT_X, FLOORS[3]!);

// floor 1: kiosk, plant, bench, lamp
fb.sprite(getSprite('kiosk'), 40, FLOORS[0]! - 32, { frame: 1 });
fb.sprite(getSprite('plant'), 176, FLOORS[0]! - 24);
fb.sprite(getSprite('bench'), 200, FLOORS[0]! - 12);
const lampY = FLOORS[0]! - 40;
fb.vLine(76, lampY, 8, C.BLACK);
fb.sprite(getSprite('lamp.shade'), 70, lampY + 8, { frame: 0 });
fb.vLine(228, lampY, 8, C.BLACK);
fb.sprite(getSprite('lamp.shade'), 222, lampY + 8, { frame: 1 });

// floor 2: booth, fountain, broken lamp
fb.sprite(getSprite('booth'), 24, FLOORS[1]! - 32, { frame: 0 });
fb.sprite(getSprite('booth'), 56, FLOORS[1]! - 32, { frame: 1 });
fb.sprite(getSprite('fountain'), 150, FLOORS[1]! - 24, { frame: 1 });
fb.sprite(getSprite('lamp.broken'), 232, FLOORS[1]! - 10);

// floor 3: disco ball on a cord, escalator run, pillar
const ballY = FLOORS[2]! - 40;
fb.vLine(40, ballY, 10, C.LTGRAY);
for (let i = 0; i < 4; i++) fb.sprite(getSprite('disco.ball'), 34 + i * 14, ballY + 10, { frame: i });
// escalator: 12 steps along a 45 degree diagonal with handrail dots above
const step = getSprite('esc.step');
const rail = getSprite('esc.rail');
for (let i = 0; i < 12; i++) {
  fb.sprite(step, 168 + i * 4, FLOORS[2]! - 4 - i * 4, { frame: i % 4 });
  fb.sprite(rail, 168 + i * 4 + 2, FLOORS[2]! - 4 - i * 4 - 14);
}
fb.sprite(getSprite('pillar'), 140, FLOORS[3]! - 48);
// parking floor (bottom): wagon
fb.sprite(getSprite('wagon'), 16, FLOORS[3]! - 28, { frame: 1 });
fb.sprite(getSprite('post'), 96, FLOORS[3]! - 16);
fb.sprite(getSprite('ac'), 196, FLOORS[3]! - 16);
fb.sprite(getSprite('pigeon'), 226, FLOORS[3]! - 8, { frame: 0 });
fb.sprite(getSprite('pigeon'), 238, FLOORS[3]! - 8, { frame: 1 });

writeFramebufferPng(fb, out, scale);
console.log('wrote', out);
