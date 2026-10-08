import { Btn, padFromHeld } from '../src/engine/pad';
import { Game } from '../src/game/game';
import { enterStoreDoor, searchStoreForPackage, leaveStore } from '../src/game/bot';

/** A vulnerable, non-shooting, non-dodging player: how often does he reach a 4F store (and find its package) on loop 1? */
let reached = 0;
let died = 0;
let found = 0;
const seeds = 40;
let totalFrames = 0;
for (let seed = 1; seed <= seeds; seed++) {
  const g = new Game({ seed, skipSplash: true });
  let held = 0;
  const bot: any = {
    get w() { return g.level!.mall; },
    get world() { return g.level!.store!; },
    hold(mask: number, n = 1) { for (let i = 0; i < n; i++) { g.step(padFromHeld(held, mask)); held = mask; } },
    tap(b: number) { this.hold(b, 1); this.hold(0, 1); },
  };
  bot.tap(Btn.START);
  for (let i = 0; i < 700 && g.level!.mall.intro; i++) { bot.hold(0, 1); if (g.level!.mall.intro?.phase === 'selfie' && g.level!.mall.intro.t > 20) bot.tap(Btn.B); }
  const lives0 = g.run!.lives;
  const t0 = g.frame;
  try {
    enterStoreDoor(bot, 'radioshock');
    for (let i = 0; i < 100 && !(g.level!.store && !g.level!.fade); i++) bot.hold(0, 1);
    if (g.level!.store) {
      reached++;
      if (g.run!.lives < lives0) died++;
      if (searchStoreForPackage(bot)) found++;
    }
  } catch {
    if (g.run!.lives < lives0) died++;
  }
  totalFrames += g.frame - t0;
  if (g.run!.lives < lives0 && !g.level!.store) died += 0;
}
console.log(`reached the 4F store: ${reached}/${seeds}; lost a life on the way: ${died}; found its package without help: ${found}; avg ${(totalFrames / seeds / 60).toFixed(1)} s`);
