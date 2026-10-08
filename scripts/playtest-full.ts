import { open, shot } from './playtest-lib';

const s = await open('http://localhost:4173/mall-action/play/?debug=1&seed=21');
const p = s.page;
await p.waitForFunction(() => !!(window as any).__mall && (window as any).__mall.bot.lib);
await p.evaluate(() => ((window as any).__mall.realtime = false));
const ev = <T>(fn: () => T | Promise<T>): Promise<T> => p.evaluate(fn as any) as Promise<T>;

// title -> level, skip the arrival
await ev(async () => {
  const m = (window as any).__mall;
  m.tap('START');
  for (let i = 0; i < 700 && m.game.level.mall.intro; i++) {
    m.step(1, 0);
    if (m.game.level.mall.intro?.phase === 'selfie' && m.game.level.mall.intro.t > 20) m.tap('B');
  }
});
await shot(s, 'playtest-out/g1-control.png');

const order = ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlock'];
let n = 0;
for (const id of order) {
  n++;
  const r = await ev(async () => {
    const m = (window as any).__mall;
    const { rig, lib } = m.bot;
    return 'ok';
  });
  void r;
  await p.evaluate(async (storeId) => {
    const m = (window as any).__mall;
    const { rig, lib } = m.bot;
    lib.enterStoreDoor(rig, storeId);
    for (let i = 0; i < 100 && !(m.game.level.store && !m.game.level.fade); i++) rig.hold(0, 1);
  }, id);
  await shot(s, `playtest-out/g2-${n}-${id}-enter.png`);
  const got = await p.evaluate(() => {
    const m = (window as any).__mall;
    const { rig, lib } = m.bot;
    return lib.searchStoreForPackage(rig);
  });
  await shot(s, `playtest-out/g2-${n}-${id}-found.png`);
  await p.evaluate(() => {
    const m = (window as any).__mall;
    const { rig, lib } = m.bot;
    lib.leaveStore(rig);
    for (let i = 0; i < 100 && (m.game.level.store || m.game.level.fade); i++) rig.hold(0, 1);
  });
  const st = await p.evaluate(() => (window as any).__mall.state());
  console.log(id, 'package?', got, 'packages', st.run.packages, 'floor', st.player.floor, 'errors', s.errors.filter((e) => !/GPU stall/.test(e)).length);
}
// map + pause
await p.evaluate(() => (window as any).__mall.tap('SELECT'));
await shot(s, 'playtest-out/g3-map.png');
await p.evaluate(() => (window as any).__mall.tap('SELECT'));
await p.evaluate(() => (window as any).__mall.tap('START'));
await p.evaluate(() => (window as any).__mall.step(30, 0));
await shot(s, 'playtest-out/g4-pause.png');
await p.evaluate(() => (window as any).__mall.tap('START'));
// to the parking level and drive away
await p.evaluate(() => {
  const m = (window as any).__mall;
  const { rig, lib } = m.bot;
  lib.goToFloor(rig, 5);
});
await shot(s, 'playtest-out/g5-parking.png');
await p.evaluate(() => {
  const m = (window as any).__mall;
  const { rig, lib } = m.bot;
  lib.walkTo(rig, 250 + 30);
  rig.tap(1); // UP
});
const after = await p.evaluate(() => (window as any).__mall.state());
console.log('scene after exit', after.scene, 'score', after.run && after.run.score);
for (const label of ['drive', 'tally', 'news', 'spygram']) {
  await p.evaluate((frames) => (window as any).__mall.step(frames, 0), label === 'drive' ? 120 : label === 'tally' ? 200 : 40);
  await shot(s, `playtest-out/g6-clear-${label}.png`);
  await p.evaluate(() => (window as any).__mall.tap('START'));
}
const end = await p.evaluate(() => (window as any).__mall.state());
console.log('end', JSON.stringify(end).slice(0, 300));
console.log('errors', s.errors.filter((e) => !/GPU stall/.test(e)));
await s.browser.close();
