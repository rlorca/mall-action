import { Btn, padFromHeld } from '../src/engine/pad';
import { Game } from '../src/game/game';
import { enterStoreDoor, goToFloor, leaveStore, searchStoreForPackage, walkTo } from '../src/game/bot';
import { openingState } from '../src/game/mall/geometry';
import { floorY } from '../src/content/layout';

const g = new Game({ seed: Number(process.argv[2] ?? 21), skipSplash: true });
let held = 0;
const bot: any = {
  get w() { return g.level!.mall; },
  get world() { return g.level!.store!; },
  hold(mask: number, n = 1) { for (let i = 0; i < n; i++) { g.run && (g.run.power.invincible = 1e6); g.step(padFromHeld(held, mask)); held = mask; } },
  tap(b: number) { this.hold(b, 1); this.hold(0, 1); },
};
bot.tap(Btn.START);
for (let i = 0; i < 700 && g.level!.mall.intro; i++) { bot.hold(0, 1); if (g.level!.mall.intro?.phase === 'selfie' && g.level!.mall.intro.t > 20) bot.tap(Btn.B); }
for (const id of ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlock'] as const) {
  try {
    enterStoreDoor(bot, id);
    for (let i = 0; i < 100 && !(g.level!.store && !g.level!.fade); i++) bot.hold(0, 1);
    const got = searchStoreForPackage(bot);
    leaveStore(bot);
    for (let i = 0; i < 100 && (g.level!.store || g.level!.fade); i++) bot.hold(0, 1);
    console.log(id, got, 'frame', g.frame);
  } catch (e) {
    const w = g.level!.mall;
    const p = w.player;
    console.log('FAILED at', id, (e as Error).message, 'player', p.x, p.y, p.floor, p.mode, 'idle', p.idle, 'frozen', p.frozen);
    for (const c of w.cars) console.log(' car', c.id, c.y, 'dir', c.dir, 'goal', c.goal, 'protect', c.protectFloor, 'state@floor', p.floor !== null && c.def.top <= p.floor && p.floor <= c.def.bottom ? openingState(c, p.floor) : '-');
    console.log(' spies', w.spies.map((s) => [s.id, Math.round(s.x), s.floor, s.mode]));
    break;
  }
}
{
  const w = g.level!.mall;
  const p = w.player;
  console.log('--- stepping right from', p.x, p.mode, p.floor, 'slide', p.slide, 'ducking', p.ducking, 'overlay', g.level!.overlay, 'fade', g.level!.fade && g.level!.fade.dir, 'scene', g.scene);
  for (let i = 0; i < 6; i++) { bot.hold(Btn.RIGHT, 1); console.log(i, 'x', p.x, 'vx', p.vx, 'mode', p.mode, 'ducking', p.ducking); }
}
{
  const w = g.level!.mall;
  const p = w.player;
  const log: string[] = [];
  const t0 = g.frame;
  for (let i = 0; i < 400; i++) {
    const dx = 386 - p.x;
    if (Math.abs(dx) <= 0.6) break;
    bot.hold(dx > 0 ? Btn.RIGHT : Btn.LEFT, 1);
    if (i % 25 === 0) log.push(`${i}:x=${p.x.toFixed(1)} mode=${p.mode} y=${p.y} floor=${p.floor}`);
  }
  console.log('walk log', log.join(' | '));
  console.log('final', p.x, p.mode, p.floor, 'A', openingState(w.car('A'), 3), 'B', openingState(w.car('B'), 3), 'C', openingState(w.car('C'), 3), 'frames', g.frame - t0);
}
