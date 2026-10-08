import { Btn, padFromHeld } from '../src/engine/pad';
import { Game } from '../src/game/game';
import { goToFloor, mallReflexes, walkTo } from '../src/game/bot';
import { STORES, DOOR_X, DOOR_W } from '../src/content/stores';

/**
 * Mall-only fairness: a VULNERABLE agent (never shoots, never dodges, no armour) travels the whole mall on loop 1:
 * R -> 4F -> 3F -> 2F -> 1F -> P, standing at a store door on each floor. Counts deaths and their causes.
 */
const mode = process.argv[2] ?? 'passive';
const causes: Record<string, number> = {};
let deaths = 0, finished = 0, seconds = 0;
const seeds = 40;
for (let seed = 1; seed <= seeds; seed++) {
  const g = new Game({ seed, skipSplash: true });
  let held = 0;
  let prev = '';
  const bot: any = {
    get w() { return g.level!.mall; },
    hold(mask: number, n = 1) {
      for (let i = 0; i < n; i++) {
        if (!g.level) {
          g.step(padFromHeld(held, mask));
          held = mask;
          continue;
        }
        const w = g.level.mall;
        const m = mode === 'reflex' ? mallReflexes(w, mask) : mask;
        g.step(padFromHeld(held, m));
        held = m;
        const pm = g.level!.mall.player.mode;
        if (pm === 'dying' && prev !== 'dying') {
          deaths++;
          const c = String(g.level!.mall.player.cause);
          causes[c] = (causes[c] ?? 0) + 1;
        }
        prev = pm;
      }
    },
    tap(b: number) { this.hold(b, 1); this.hold(0, 1); },
  };
  bot.tap(Btn.START);
  for (let i = 0; i < 700 && g.level!.mall.intro; i++) { bot.hold(0, 1); if (g.level!.mall.intro?.phase === 'selfie' && g.level!.mall.intro.t > 20) bot.tap(Btn.B); }
  const t0 = g.frame;
  try {
    for (const floor of [1, 2, 3, 4, 5]) {
      goToFloor(bot, floor);
      const st = STORES.find((s) => s.floor === floor && s.role !== 'closed');
      if (st) walkTo(bot, st.x + DOOR_X + DOOR_W / 2);
      bot.hold(0, 60);
    }
    finished++;
  } catch { /* a bot error (usually after dying mid-route) */ }
  seconds += (g.frame - t0) / 60;
}
console.log(`${mode}: ${deaths} deaths over ${seeds} full-mall routes (${(deaths / seeds).toFixed(2)} per route), routes completed ${finished}/${seeds}, avg ${(seconds / seeds).toFixed(0)} s; causes ${JSON.stringify(causes)}`);
