import { Btn, padFromHeld } from '../src/engine/pad';
import { Game } from '../src/game/game';
import { enterStoreDoor } from '../src/game/bot';

const causes: Record<string, number> = {};
const times: number[] = [];
for (let seed = 1; seed <= 40; seed++) {
  const g = new Game({ seed, skipSplash: true });
  let held = 0;
  let prevMode = '';
  let ctl = 0;
  const bot: any = {
    get w() { return g.level!.mall; },
    hold(mask: number, n = 1) {
      for (let i = 0; i < n; i++) {
        g.step(padFromHeld(held, mask)); held = mask;
        const p = g.level?.mall.player;
        if (p && p.mode === 'dying' && prevMode !== 'dying') {
          const w = g.level!.mall;
          const key = `${p.cause} floor=${p.floor ?? 'x'} mode@${w.intro ? 'intro' : 'play'} t=${w.frame - w.controlFrame}`;
          causes[p.cause ?? '?'] = (causes[p.cause ?? '?'] ?? 0) + 1;
          if (seed <= 12) console.log(`seed ${seed}: died ${key} x=${Math.round(p.x)} spies=${w.spies.map((s) => `${s.mode}@${Math.round(s.x)}f${s.floor}`).join(',')}`);
          times.push(w.frame - w.controlFrame);
        }
        prevMode = p?.mode ?? '';
      }
    },
    tap(b: number) { this.hold(b, 1); this.hold(0, 1); },
  };
  bot.tap(Btn.START);
  for (let i = 0; i < 700 && g.level!.mall.intro; i++) { bot.hold(0, 1); if (g.level!.mall.intro?.phase === 'selfie' && g.level!.mall.intro.t > 20) bot.tap(Btn.B); }
  try { enterStoreDoor(bot, 'radioshock'); } catch (e) { /* ignore */ }
}
console.log(JSON.stringify(causes), 'median control-frame of death', times.sort((a, b) => a - b)[Math.floor(times.length / 2)]);
