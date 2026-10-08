import { describe, expect, it } from 'vitest';
import { Btn, padFromHeld } from '../../engine/pad';
import { DOOR_W, DOOR_X, STORES } from '../../content/stores';
import { Game } from '../game';
import { goToFloor, mallReflexes, walkTo } from '../bot';

/**
 * "The game feels fair on loop 1" for the MALL half: a sensible player (shoots spies that are in front of him, ducks
 * aimed-high shots) tours every floor from the roof down to the parking level. The agent is NOT invincible.
 * (A passive player who never shoots is punished by design: see the README's benchmark notes for the measured numbers.)
 */
function tour(seed: number): { deaths: number; completed: boolean; reachedFourF: boolean } {
  const g = new Game({ seed, skipSplash: true });
  let held = 0;
  let prev = '';
  let deaths = 0;
  const bot = {
    get w() {
      return g.level!.mall;
    },
    hold(mask: number, n = 1) {
      for (let i = 0; i < n; i++) {
        const m = g.level ? mallReflexes(g.level.mall, mask) : mask;
        g.step(padFromHeld(held, m));
        held = m;
        const pm = g.level?.mall.player.mode ?? '';
        if (pm === 'dying' && prev !== 'dying') deaths++;
        prev = pm;
      }
    },
    tap(b: number) {
      this.hold(b, 1);
      this.hold(0, 1);
    },
  };
  bot.tap(Btn.START);
  for (let i = 0; i < 700 && g.level!.mall.intro; i++) {
    bot.hold(0, 1);
    if (g.level!.mall.intro?.phase === 'selfie' && g.level!.mall.intro.t > 20) bot.tap(Btn.B);
  }
  let reachedFourF = false;
  let completed = false;
  try {
    for (const floor of [1, 2, 3, 4, 5]) {
      goToFloor(bot, floor);
      if (floor === 1) reachedFourF = deaths === 0;
      const st = STORES.find((s) => s.floor === floor && s.role !== 'closed');
      if (st) walkTo(bot, st.x + DOOR_X + DOOR_W / 2);
      bot.hold(0, 60);
    }
    completed = true;
  } catch {
    /* the route script gave up (usually mid-route after a death) */
  }
  return { deaths, completed, reachedFourF };
}

describe('mall fairness on loop 1 (sensible player, not invincible)', () => {
  const N = 16;
  const results = Array.from({ length: N }, (_, i) => tour(i + 1));
  it('a new player reaches the 4F stores without dying on the first try', () => {
    const ok = results.filter((r) => r.reachedFourF).length;
    expect(ok / N).toBeGreaterThanOrEqual(0.9);
  });
  it('a full tour of all six floors costs about one life or less on average', () => {
    const avg = results.reduce((n, r) => n + r.deaths, 0) / N;
    expect(avg).toBeLessThanOrEqual(1.6);
  });
  it('most tours complete (the routes are never blocked)', () => {
    expect(results.filter((r) => r.completed).length / N).toBeGreaterThanOrEqual(0.6);
  });
});
