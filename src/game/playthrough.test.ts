import { describe, expect, it } from 'vitest';
import { Btn, padFromHeld } from '../engine/pad';
import { WAGON } from '../content/layout';
import { TARGET_STORES, PACKAGES_TOTAL } from '../content/stores';
import { Game } from './game';
import { enterStoreDoor, goToFloor, leaveStore, searchStoreForPackage, walkTo, type BotRig, type StoreBot } from './bot';

/** Drives a real Game with button presses only. The agent is kept invincible so routing, not spies, is what's tested. */
class GameBot implements BotRig, StoreBot {
  held = 0;
  constructor(readonly g: Game, readonly immortal = true) {}
  get w() {
    return this.g.level!.mall;
  }
  get world() {
    return this.g.level!.store!;
  }
  hold(mask: number, n = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.immortal && this.g.run) this.g.run.power.invincible = 1e6;
      this.g.step(padFromHeld(this.held, mask));
      this.held = mask;
    }
  }
  tap(btn: number): void {
    this.hold(btn, 1);
    this.hold(0, 1);
  }
  waitFor(cond: () => boolean, max = 200): void {
    for (let i = 0; i < max && !cond(); i++) this.hold(0, 1);
    const lv = this.g.level;
    expect(cond(), `scene=${this.g.scene} store=${lv?.store?.storeId} fade=${lv?.fade?.dir}/${lv?.fade?.t} p=${lv?.mall.player.x},${lv?.mall.player.floor},${lv?.mall.player.mode} enter=${lv?.mall.enterStore} res=${lv?.result}`).toBe(true);
  }
}

describe('full playthrough with real controls', () => {
  for (const seed of [11, 12]) {
    it(`seed ${seed}: title -> arrival -> 6 packages -> parking -> level clear -> loop 2`, () => {
      const g = new Game({ seed, skipSplash: true });
      const bot = new GameBot(g);
      bot.tap(Btn.START);
      expect(g.scene).toBe('level');
      // arrival: zip line, drop, crouch, selfie (any button skips the selfie)
      for (let i = 0; i < 700 && g.level!.mall.intro; i++) {
        bot.hold(0, 1);
        if (g.level!.mall.intro?.phase === 'selfie' && g.level!.mall.intro.t > 20) bot.tap(Btn.B);
      }
      expect(g.level!.mall.intro).toBeNull();
      const lv = g.level!;
      // visit the six package stores, nearest-floor first
      const order = [...TARGET_STORES].sort((a, b) => a.floor - b.floor || a.x - b.x);
      for (const st of order) {
        enterStoreDoor(bot, st.id);
        bot.waitFor(() => lv.store !== null && lv.fade === null, 120);
        expect(lv.store!.storeId).toBe(st.id);
        const got = searchStoreForPackage(bot);
        expect(got, `${st.id}: package not found`).toBe(true);
        leaveStore(bot);
        bot.waitFor(() => lv.store === null && lv.fade === null, 120);
        expect(g.run!.packages).toBe(order.indexOf(st) + 1);
        expect(lv.mall.player.floor).toBe(st.floor);
      }
      expect(g.run!.packages).toBe(PACKAGES_TOTAL);
      // the cleared stores can not be entered again
      const first = order[0]!;
      enterStoreDoor(bot, first.id);
      bot.hold(0, 40);
      expect(lv.store).toBeNull();
      // to the parking level and the getaway car
      goToFloor(bot, 5);
      walkTo(bot, WAGON.x + 30);
      const before = g.run!.score;
      bot.tap(Btn.UP);
      expect(g.scene).toBe('clear');
      expect(g.run!.score).toBeGreaterThan(before);
      // the clear screen runs to the next loop
      let guard = 0;
      while (g.scene === 'clear' && guard++ < 6000) bot.tap(Btn.START);
      expect(g.scene).toBe('level');
      expect(g.run!.loop).toBe(2);
      expect(g.run!.packages).toBe(0);
      expect(g.run!.lives).toBeGreaterThanOrEqual(3);
    });
  }
});
