import { open } from './playtest-lib';

/** Captures the README screenshots from the real build in real Chrome (CRT on):  npm run build && node scripts/serve-dist.mjs & npx tsx scripts/screenshots.ts */
const URL = 'http://localhost:4173/mall-action/play/?debug=1&seed=21';
const s = await open(URL, { width: 800, height: 750 });
const p = s.page;
await p.waitForFunction(() => !!(window as any).__mall && (window as any).__mall.bot.lib);
const ev = (code: string): Promise<any> => p.evaluate(code);
const KEEP = new Set(['title', 'arrival-zipline', 'spygram-selfie', 'mall-4f', 'store-radioshock', 'map', 'level-clear-garage', 'newspaper']);
const snap = async (name: string): Promise<void> => {
  await ev('window.__mall.game.run && (window.__mall.game.run.power.invincible = 0)');
  await ev('window.__mall.render()');
  if (KEEP.has(name)) await p.locator('#screen').screenshot({ path: `docs/screens/${name}.jpg`, type: 'jpeg', quality: 82 });
};
await ev('window.__mall.realtime = false');
await ev('window.__mall.step(40, 0)');
await snap('title');
await ev("window.__mall.tap('START')");
await ev(`(() => { var m = window.__mall; for (var i = 0; i < 700 && m.game.level.mall.intro && m.game.level.mall.intro.phase !== 'zip'; i++) m.step(1, 0); m.step(30, 0); })()`);
await snap('arrival-zipline');
await ev(`(() => { var m = window.__mall; for (var i = 0; i < 700 && m.game.level.mall.intro && m.game.level.mall.intro.phase !== 'selfie'; i++) m.step(1, 0); m.step(50, 0); })()`);
await snap('spygram-selfie');
await ev(`(() => { var m = window.__mall; for (var i = 0; i < 700 && m.game.level.mall.intro; i++) { m.step(1, 0); if (m.game.level.mall.intro && m.game.level.mall.intro.phase === 'selfie') m.tap('B'); } })()`);
// ride down to 4F and walk to the Radioshock door
await ev(`(() => { var m = window.__mall; var b = m.bot; b.immortal = true; b.renderEvery = false; var rig = b.rig; b.lib.goToFloor(rig, 1); b.lib.walkTo(rig, 205); })()`);
await ev(`(() => { var m = window.__mall; var w = m.game.level.mall; var spy = m.bot.lib; })()`);
await snap('mall-4f');
await ev(`(() => { var m = window.__mall; var b = m.bot; b.lib.enterStoreDoor(b.rig, 'radioshock'); for (var i = 0; i < 60; i++) b.rig.hold(0, 1); b.rig.hold(0, 120); })()`);
await snap('store-radioshock');
await ev(`(() => { var m = window.__mall; var b = m.bot; b.lib.searchStoreForPackage(b.rig); b.lib.leaveStore(b.rig); for (var i = 0; i < 100 && (m.game.level.store || m.game.level.fade); i++) b.rig.hold(0, 1); })()`);
await ev("window.__mall.tap('SELECT')");
await snap('map');
await ev("window.__mall.tap('SELECT')");
await ev("window.__mall.tap('START')");
await ev('window.__mall.step(40, 0)');
await snap('pause');
await ev("window.__mall.tap('START')");
// level clear: all packages, drive away, then the tally and the newspaper
await ev(`(() => { var m = window.__mall; var g = m.game; for (var k in g.run.level.stores) g.run.level.stores[k].packageTaken = true; var b = m.bot; b.immortal = true; b.lib.goToFloor(b.rig, 5); b.lib.walkTo(b.rig, 280); b.rig.tap(1); m.step(110, 0); })()`);
await snap('level-clear-garage');
await ev("window.__mall.tap('START')");
await ev('window.__mall.step(160, 0)');
await snap('level-clear-tally');
await ev("window.__mall.tap('START')");
await ev('window.__mall.step(90, 0)');
await snap('newspaper');
await ev("window.__mall.tap('START')");
await ev('window.__mall.step(120, 0)');
await snap('spygram-complete');
console.log('errors', s.errors.filter((e) => !/GPU stall/.test(e)));
await s.browser.close();
