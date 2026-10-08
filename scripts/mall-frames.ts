/**
 * Render key moments of the mall to PNGs (no browser needed):  npx tsx scripts/mall-frames.ts
 * Writes playtest-out/mall-*.png so layout / art problems can be looked at.
 */
import { Framebuffer } from '../src/engine/framebuffer';
import { padFromHeld, Btn } from '../src/engine/pad';
import { Rng } from '../src/engine/rng';
import { Run } from '../src/game/run';
import { Level } from '../src/game/level';
import { newSpy } from '../src/game/mall/spies';
import { floorY, SHAFTS, ARRIVAL } from '../src/content/layout';
import { drawMall } from '../src/render/mallView';
import { drawHud } from '../src/render/hud';
import { writeFramebufferPng } from './png';
import '../src/art/index';

let held = 0;
function mk(skip: boolean): Level {
  const run = new Run(3);
  return new Level(run, new Rng(3), { skipIntro: skip });
}
function step(lv: Level, n: number, mask = 0): void {
  for (let i = 0; i < n; i++) {
    lv.step(padFromHeld(held, mask));
    held = mask;
  }
}
function shot(lv: Level, name: string, hooks = {}): void {
  const fb = new Framebuffer();
  fb.clear(0x0f);
  drawMall(fb, lv, lv.frame, hooks);
  drawHud(fb, lv.hud());
  writeFramebufferPng(fb, `playtest-out/mall-${name}.png`, 3);
  console.log('wrote', name);
}

// arrival
let lv = mk(false);
step(lv, 5);
shot(lv, '1-zip-start');
step(lv, 40);
shot(lv, '1-zip-mid');
while (lv.mall.intro?.phase === 'zip' || lv.mall.intro?.phase === 'drop') step(lv, 1);
step(lv, 10);
shot(lv, '2-crouch');
step(lv, 40);
shot(lv, '3-selfie');
step(lv, 120, Btn.B);
// 4F corridor with spies
lv = mk(true);
const w = lv.mall;
w.player.x = 300;
w.player.y = floorY(1);
w.player.floor = 1;
w.player.peakY = w.player.y;
w.snapCamera();
w.nextSpy = 1e9;
w.spies.push(newSpy(w, 380, 1, 'walk'));
const s2 = newSpy(w, 220, 1, 'walk');
s2.mode = 'aim';
s2.aimHigh = true;
w.spies.push(s2);
step(lv, 3);
shot(lv, '4-4F-corridor');
// shooting
step(lv, 2, Btn.A);
shot(lv, '5-shooting');
// elevator ride
lv = mk(true);
const w2 = lv.mall;
w2.nextSpy = 1e9;
w2.player.x = SHAFTS[0]!.x + 12;
step(lv, 5);
step(lv, 2, Btn.DOWN);
step(lv, 60, Btn.DOWN);
shot(lv, '6-riding-A');
// parking
lv = mk(true);
const w3 = lv.mall;
w3.player.x = 300;
w3.player.y = floorY(5);
w3.player.floor = 5;
w3.player.peakY = w3.player.y;
w3.snapCamera();
w3.nextSpy = 1e9;
step(lv, 3);
shot(lv, '7-parking');
// roof
lv = mk(true);
lv.mall.nextSpy = 1e9;
step(lv, 90);
shot(lv, '8-roof');
console.log('arrival', ARRIVAL.postX);
