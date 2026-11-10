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
function snap(g: Game, name: string) {
  if (only && !name.includes(only)) return;
  drawGame(fb, g);
  savePng(fb, `${out}/${name}.png`, 2);
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
console.log('done');
