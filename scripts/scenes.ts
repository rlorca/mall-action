/** Dev helper: render a set of scenes straight from the rules to PNGs (no browser needed). */
import { Fb } from '../src/gfx/fb';
import { newGame } from '../src/game/setup';
import { stepGame } from '../src/game/game';
import { drawGame } from '../src/render/draw';
import { Btn } from '../src/core/input';
import { FLOOR_Y, STORES, doorX } from '../src/game/level';
import { savePng } from './png';
import type { Game } from '../src/game/types';

const out = process.argv[2] ?? 'shots';
const only = process.argv[3];
const fb = new Fb();
function run(g: Game, n: number, held = 0, pressedFirst = 0) {
  for (let i = 0; i < n; i++) stepGame(g, { held, pressed: i === 0 ? pressedFirst | held : 0 });
}
// Scenes are also packed four to a contact sheet (sheet-NN.png) for quick review.
const sheet = new Fb(512, 480);
let sheetN = 0, sheetI = 0;
function flush() {
  if (sheetI === 0) return;
  savePng(sheet, `${out}/sheet-${String(sheetN++).padStart(2, '0')}.png`, 1);
  sheet.clear(0x0f);
  sheetI = 0;
}
function snap(g: Game, name: string) {
  if (only && !name.includes(only)) return;
  drawGame(fb, g);
  savePng(fb, `${out}/${name}.png`, 2);
  const ox = (sheetI % 2) * 256, oy = Math.floor(sheetI / 2) * 240;
  for (let y = 0; y < 240; y++) sheet.px.set(fb.px.subarray(y * 256, y * 256 + 256), (oy + y) * 512 + ox);
  if (++sheetI === 4) flush();
}
function toMall(seed = 7): Game {
  const g = newGame(seed);
  run(g, 1, 0, Btn.A); // skip splash
  run(g, 30);
  run(g, 1, 0, Btn.Start);
  run(g, 400);
  return g;
}
function teleport(g: Game, floor: number, x: number) {
  const P = g.level!.player;
  P.x = x; P.y = FLOOR_Y[floor]; P.onGround = true; P.vy = 0;
  run(g, 40);
}
{
  const g = newGame(1);
  run(g, 30); snap(g, '01-splash-flicker');
  run(g, 100); snap(g, '02-splash');
  run(g, 200); run(g, 60); snap(g, '03-title');
  for (const b of [Btn.Up, Btn.Up, Btn.Down, Btn.Down, Btn.Left, Btn.Right, Btn.Left, Btn.Right, Btn.B, Btn.A]) { run(g, 1, 0, b); run(g, 2); }
  run(g, 9); snap(g, '04-title-bf');
  run(g, 1, 0, Btn.Start);
  run(g, 60); snap(g, '05-arrive');
  run(g, 110); snap(g, '06-selfie');
  run(g, 200); snap(g, '07-roof');
}
{
  const g = toMall();
  for (const [name, floor, x] of [['4f-a', 1, 110], ['4f-b', 1, 300], ['4f-c', 1, 500], ['4f-d', 1, 680], ['3f-a', 2, 100], ['3f-b', 2, 330], ['3f-c', 2, 640], ['2f-a', 3, 100], ['2f-b', 3, 300], ['2f-c', 3, 480], ['2f-d', 3, 680], ['1f-a', 4, 120], ['1f-b', 4, 300], ['1f-c', 4, 480], ['p', 5, 430]] as [string, number, number][]) {
    teleport(g, floor, x);
    snap(g, '10-mall-' + name);
  }
  run(g, 1, 0, Btn.Select); run(g, 10); snap(g, '20-map');
  run(g, 1, 0, Btn.Select); run(g, 2); run(g, 1, 0, Btn.Start); run(g, 20); snap(g, '21-pause');
}
for (const st of STORES) {
  if (st.role === 'closed') continue;
  const g = toMall(11 + st.id);
  g.level!.spawnT = 99999;
  teleport(g, st.floor, doorX(st));
  run(g, 1, 0, Btn.Up);
  run(g, 60);
  snap(g, '30-store-' + st.key);
  if (st.key === 'gamestonk') { run(g, 200); snap(g, '31-store-gamestonk-item'); }
}
{
  const g = toMall(3);
  g.pkgs = 6;
  teleport(g, 5, 432);
  run(g, 1, 0, Btn.Up);
  run(g, 150); snap(g, '40-clear-tally');
  run(g, 300); snap(g, '41-clear-paper');
  run(g, 330); snap(g, '42-clear-post');
}
{
  const g = toMall(4);
  g.lives = 1;
  g.level!.player.dying = 2;
  run(g, 5); run(g, 200); snap(g, '50-continue');
  run(g, 600); snap(g, '51-gameover');
  run(g, 100); snap(g, '52-gameover2');
}
{
  // things that only show up in special situations
  const g = toMall(5);
  const L = g.level!;
  L.spawnT = 99999;
  for (const st of L.stores) if (st.def.key !== 'hotspy' && st.def.role === 'target') st.cleared = true;
  teleport(g, 3, 144);
  run(g, 1, 0, Btn.Up); run(g, 10); snap(g, '60-kiosk-panel');
  const g2 = toMall(6);
  const M = g2.level!;
  M.spawnT = 99999;
  M.powers.weapon = 'spread'; M.powers.weaponT = 700; M.powers.armor = true; M.powers.radar = true; M.alarm = true; g2.score = 123450; g2.pkgs = 6; g2.lives = 12;
  M.wets = [{ x0: 200, t: 500 }];
  M.cop.floor = 4; M.cop.x = 150; M.cop.dir = 1; M.cop.cool = 0;
  teleport(g2, 4, 250);
  g2.frame = 16;
  run(g2, 1, Btn.Left, Btn.A); run(g2, 6); snap(g2, '61-hud-full-wet-cop');
  M.powers.speed = 'juliooze'; M.powers.speedT = 300; M.powers.weapon = 'none';
  M.photoStripT = 150; M.banner = { lines: ['WILL THE OWNER OF A BLACK VAN', "MARKED 'NOT SPIES' PLEASE", 'MOVE IT.'], t: 100 };
  M.spies.push({ id: 5, x: 330, y: 256, face: -1, state: 'aim', t: 22, shootT: 0, aimLow: true, goalX: 330, pause: 0, volley: -1, car: -1, far: 0, slide: 0, seen: 99 });
  M.bubbles.push({ x: 330, y: 226, text: "WHAT'S YOUR RETURN POLICY?!", t: 50 });
  g2.frame = 21;
  drawGame(fb, g2); snap(g2, '62-banner-strip-bubble');
  const g3 = toMall(7);
  g3.blackFriday = true;
  teleport(g3, 1, 300); snap(g3, '63-black-friday');
  const g4 = toMall(8);
  g4.level!.powers.radar = true;
  teleport(g4, 1, 64); run(g4, 1, 0, Btn.Up); run(g4, 200); g4.frame = 8; snap(g4, '64-store-radar');
  g4.inventory = ['PET ROCK', 'PRE-OWNED STRATEGY GUIDE']; g4.photoStrip = true;
  run(g4, 1, 0, Btn.Select); g4.frame = 8; snap(g4, '65-map-in-store-radar-items');
}
flush();
console.log('done');
