/**
 * Visual check of the mall extras (lamps, disco balls, darkness, janitor + wet patch, walkers, cop, kiosk panel,
 * photo booth + strip, fountains) drawn with drawMallFurniture / drawMallActors over a plain corridor background.
 *
 *   npx tsx scripts/mall-actors-preview.ts [out-dir] [scale]
 *
 * Builds a real MallWorld (with the extras installed), steps it into each interesting state with the real rules,
 * and writes one PNG per scene.
 */
import { Framebuffer } from '../src/engine/framebuffer';
import { C } from '../src/engine/palette';
import { Btn } from '../src/engine/pad';
import { floorY } from '../src/content/layout';
import { writeFramebufferPng } from './png';
import '../src/art/index';
import { getSprite } from '../src/art/registry';
import { makeRig, place, type Rig } from '../src/game/mall/testutil';
import { newSpy } from '../src/game/mall/spies';
import { installExtras, type MallExtras } from '../src/game/mall/modules';
import { drawMallActors, drawMallFurniture } from '../src/render/mallActorsView';
import { drawBubbles, drawBanner, drawPopups } from '../src/render/widgets';

const outDir = process.argv[2] ?? 'playtest-out';
const scale = Number(process.argv[3] ?? 3);

interface Scene {
  r: Rig;
  x: MallExtras;
}

function rig(floor: number, px: number, seed = 1): Scene {
  const r = makeRig({ seed, floor, x: px });
  const x = installExtras(r.w);
  r.w.nextSpy = 1e9;
  // keep the NPCs of other scenes out of the picture
  x.cop.cop.floor = 1;
  x.cop.cop.x = 60;
  x.cop.cop.pauseT = 1e9;
  x.cop.cop.nextHop = 1e9;
  x.janitor.janitor.nextMop = 1e9;
  x.janitor.janitor.x = 30;
  x.walkers.walkers[0]!.x = 300;
  x.walkers.walkers[1]!.x = 500;
  place(r, floor, px);
  return { r, x };
}

/** A plain corridor background: wall tiles and slabs for every floor in view. */
function background(fb: Framebuffer, camX: number, camY: number): void {
  fb.clear(C.BLACK);
  const wall = getSprite('mall.wall');
  const slab = getSprite('mall.slab');
  for (let f = 0; f < 6; f++) {
    const fy = floorY(f) - camY + 16;
    if (fy < -8 || fy > 260) continue;
    for (let x = -((camX | 0) % 16); x < 256; x += 16) {
      for (let y = fy - 48 + 8; y < fy; y += 16) fb.sprite(wall, x, y - 0, { frame: ((x + y) >> 4) % 5 === 2 ? 1 : 0 });
      fb.sprite(slab, x, fy);
    }
  }
}

function drawPeople(fb: Framebuffer, s: Scene, camX: number, camY: number, frame: number): void {
  const w = s.r.w;
  for (const sp of w.spies) {
    const name = sp.mode === 'dying' ? 'spy.die' : 'spy.stand';
    fb.sprite(getSprite(name), Math.round(sp.x - camX) - 8, Math.round(sp.y - camY) + 16 - 24, { flipX: sp.face < 0, frame: sp.mode === 'dying' ? Math.min(2, sp.deathT >> 3) : 0 });
  }
  const p = w.player;
  if (p.mode !== 'hidden') {
    const name = p.kick ? 'agent.kick' : p.mode === 'dying' ? 'agent.die' : p.mode === 'air' ? 'agent.jump' : p.slide !== 0 ? 'agent.stand' : 'agent.stand';
    fb.sprite(getSprite(name), Math.round(p.x - camX) - 8, Math.round(p.y - camY) + 16 - 24, { flipX: p.face < 0, frame: name === 'agent.die' ? 2 : 0 });
  }
  void frame;
  for (const b of w.bullets) fb.fillRect(Math.round(b.x - camX) - 2, Math.round(b.y - camY) + 16, 4, 2, b.owner === 'player' ? C.YELLOW : C.WHITE);
  for (const k of w.pickups) {
    const sp = getSprite(k.kind === 'goldcoin' ? 'item.goldcoin' : 'item.coin');
    fb.sprite(sp, Math.round(k.x - camX) - 4, Math.round(k.y - camY) + 16 - 8, { frame: (w.frame >> 3) & 3 });
  }
}

function hud(fb: Framebuffer, label: string): void {
  fb.fillRect(0, 0, 256, 16, C.BLACK);
  void label;
}

function render(name: string, s: Scene, camX: number, floor: number): void {
  const w = s.r.w;
  const camY = floorY(floor) - 150;
  const fb = new Framebuffer();
  background(fb, camX, camY);
  const frame = w.frame;
  drawMallFurniture(fb, w, camX, camY, frame);
  drawPeople(fb, s, camX, camY, frame);
  drawMallActors(fb, w, camX, camY, frame);
  fb.pushClip(0, 16, 256, 224);
  drawBubbles(fb, w.bubbles.map((b) => ({ ...b, y: b.y + 16 })), camX, camY);
  drawPopups(fb, w.popups.map((p) => ({ ...p, y: p.y + 16 })), camX, camY);
  fb.popClip();
  if (w.banner) drawBanner(fb, w.banner, 20);
  hud(fb, name);
  writeFramebufferPng(fb, `${outDir}/mall-actors-${name}.png`, scale);
  console.log('wrote', `${outDir}/mall-actors-${name}.png`);
}

function run(s: Scene, n: number, held = 0): void {
  s.r.hold(held, n);
}

/** Step until a condition holds (fail loudly instead of hanging when a scene did not set up as planned). */
function until(s: Scene, what: string, cond: () => boolean, max = 600): void {
  let n = 0;
  while (!cond()) {
    if (n++ > max) throw new Error(`scene setup never reached: ${what}`);
    run(s, 1);
  }
}

// ------------------------------------------------------------------ 1. 3F: lamp falling, shattered lamp + darkness, fountain spraying
{
  const s = rig(2, 360);
  const lamps = s.x.lamps.lamps;
  const left = lamps.find((l) => l.floor === 2 && l.homeX === 156)!;
  const mid = lamps.find((l) => l.floor === 2 && l.homeX === 296)!;
  // the left lamp is shot from the right and shatters
  place(s.r, 2, 180);
  s.r.w.player.face = -1;
  s.r.w.bullets.push({ x: 190, y: floorY(2) - 16, vx: -4, vy: 0, owner: 'player', age: 0 });
  until(s, 'left lamp broken', () => left.mode === 'broken');
  run(s, 8);
  // the middle one comes down (a spy is standing a little to the side)
  const sp = newSpy(s.r.w, 316, 2, 'walk');
  sp.fireCd = 9999;
  sp.wanderT = 9999;
  sp.wanderDir = 0;
  s.r.w.spies.push(sp);
  s.r.w.bullets.push({ x: 270, y: floorY(2) - 16, vx: 4, vy: 0, owner: 'player', age: 0 });
  until(s, 'mid lamp falling', () => mid.mode === 'falling');
  run(s, 4);
  place(s.r, 2, 240);
  s.r.w.player.face = 1;
  render('1a-3F-lamp-falling', s, 100, 2);
  until(s, 'mid lamp broken', () => mid.mode === 'broken');
  run(s, 5);
  render('1b-3F-lamp-shattered-dark', s, 100, 2);
  run(s, 60);
  // fountain
  s.x.fountains.sprayCoins(s.r.w, s.x.fountains.fountains[0]!);
  run(s, 12);
  render('1c-3F-fountain-spray', s, 100, 2);
}

// ------------------------------------------------------------------ 2. 3F: photo booth, curtain closed, then the strip
{
  const s = rig(2, 132);
  s.r.tap(Btn.UP);
  run(s, 30);
  render('2a-booth-closed', s, 40, 2);
  s.r.hold(Btn.LEFT, 2);
  place(s.r, 2, 150);
  for (const t of [10, 26, 44, 60, 90]) {
    s.x.booth.strip = s.x.booth.strip ?? { x: 150, y: floorY(2), t: 0, total: 200 };
    s.x.booth.strip.t = t;
    s.x.booth.strip.x = 150;
    render(`2b-strip-t${t}`, s, 40, 2);
  }
}

// ------------------------------------------------------------------ 3. 2F: walkers, hung disco balls, one rolling, glass
{
  const s = rig(3, 330);
  const [a, b] = s.x.walkers.walkers;
  a!.x = 280;
  a!.face = 1;
  b!.x = 470;
  b!.face = -1;
  const ball = s.x.lamps.lamps.find((l) => l.floor === 3 && l.homeX === 556)!;
  s.r.w.player.face = 1;
  s.r.w.bullets.push({ x: 520, y: floorY(3) - 16, vx: 4, vy: 0, owner: 'player', age: 0 });
  place(s.r, 3, 440);
  until(s, 'ball rolling', () => ball.mode === 'rolling');
  run(s, 14);
  place(s.r, 3, 440);
  s.r.w.bubbles.push({ text: 'HEY!', x: a!.x, y: floorY(3) - 28, t: 99 });
  render('3-2F-walkers-disco', s, 340, 3);
}

// ------------------------------------------------------------------ 4. 1F: janitor mopping, a patch with the sign, the agent sliding, a spy slipping
{
  const s = rig(4, 170);
  s.x.janitor.janitor.x = 232;
  s.x.janitor.janitor.face = -1;
  s.x.janitor.janitor.mode = 'mop';
  s.x.janitor.janitor.t = 20;
  s.x.janitor.patch = { x: 210, t: 400 };
  const sp = newSpy(s.r.w, 235, 4, 'walk');
  sp.face = -1;
  sp.fireCd = 9999;
  s.r.w.spies.push(sp);
  s.r.hold(Btn.RIGHT, 10);
  run(s, 6, Btn.RIGHT);
  s.r.w.player.x = 200;
  s.x.janitor.janitor.x = 244;
  render('4-1F-wet-patch', s, 100, 4);
}

// ------------------------------------------------------------------ 5. 4F: cop whistling and chasing
{
  const s = rig(1, 300);
  const c = s.x.cop.cop;
  c.floor = 1;
  c.x = 330;
  c.face = -1;
  c.pauseT = 0;
  s.x.cop.provoke(s.r.w);
  s.r.w.player.face = 1;
  run(s, 3);
  render('5a-cop-whistle', s, 220, 1);
  run(s, 60);
  s.r.w.player.x = 250;
  render('5b-cop-chase', s, 220, 1);
  // caught
  s.x.cop.arrest(s.r.w);
  run(s, 2);
  render('5c-cop-detained', s, 220, 1);
}

// ------------------------------------------------------------------ 6. 3F kiosk with the directory panel
{
  const s = rig(2, 662);
  s.r.run.level.stores.kgbtoys!.packageTaken = true;
  s.r.tap(Btn.UP);
  run(s, 30);
  render('6a-kiosk-panel', s, 520, 2);
  const t = rig(4, 148);
  t.r.tap(Btn.UP);
  run(t, 60);
  render('6b-kiosk-1F', t, 40, 4);
}

// ------------------------------------------------------------------ 7. a ready fountain (4 water frames) and the 1F fountain after a spray
{
  const s = rig(4, 400);
  s.r.w.player.face = -1;
  place(s.r, 4, 385);
  s.r.hold(Btn.A, 1);
  run(s, 11);
  render('7-1F-fountain', s, 270, 4);
}
