import { open } from './playtest-lib';
const ok = (n: string, c: boolean, x = ''): void => console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`);

const s = await open('http://localhost:4173/mall-action/play/?debug=1&seed=4');
const p = s.page;
await p.waitForFunction(() => !!(window as any).__mall);
await p.evaluate(() => ((window as any).__mall.realtime = false));
const playing = (): Promise<string | null> => p.evaluate(() => (window as any).__mall.audio.musicPlaying());
const ctxState = (): Promise<string> => p.evaluate(() => { const a = (window as any).__mall.audio; return a.ctx ? a.ctx.state : 'none'; });

await p.evaluate(() => (window as any).__mall.step(3, 0));
ok('silent before any user input (no AudioContext running)', (await ctxState()) !== 'running', await ctxState());
await p.keyboard.press('Shift'); // first user input (Select): unlocks audio
await p.waitForTimeout(300);
ok('AudioContext running after the first key', (await ctxState()) === 'running', await ctxState());
await p.evaluate(() => (window as any).__mall.step(2, 0));
ok('title music', (await playing()) === 'title', String(await playing()));
await p.evaluate(() => (window as any).__mall.tap('START'));
await p.evaluate(() => (window as any).__mall.step(100, 0));
console.log('  music during arrival:', await playing());
await p.evaluate(() => { const m = (window as any).__mall; for (let i = 0; i < 700 && m.game.level.mall.intro; i++) m.step(1, 0); });
await p.evaluate(() => (window as any).__mall.step(3, 0));
ok('mall ambient bed after the arrival', (await playing()) === 'mall', String(await playing()));
// elevator muzak while riding
await p.evaluate(() => {
  const m = (window as any).__mall;
  const { rig, lib } = m.bot;
  lib.walkTo(rig, 180);
  rig.tap(2); // DOWN: board
  rig.hold(2, 30);
});
ok('elevator muzak while riding', (await playing()) === 'elevator', String(await playing()));
await p.evaluate(() => { const m = (window as any).__mall; m.bot.rig.hold(0, 120); m.bot.rig.hold(8, 40); });
// store song
await p.evaluate(() => {
  const m = (window as any).__mall;
  const { rig, lib } = m.bot;
  lib.enterStoreDoor(rig, 'forever12');
  for (let i = 0; i < 60; i++) rig.hold(0, 1);
});
ok('store song (disco) inside Forever 12', (await playing()) === 'store.forever12', String(await playing()));
await p.keyboard.press('m');
await p.waitForTimeout(100);
ok('mute toggles', await p.evaluate(() => (window as any).__mall.audio.isMuted()));
await p.keyboard.press('m');
// pause ducks
await p.evaluate(() => (window as any).__mall.tap('START'));
ok('pause ducks the music', await p.evaluate(() => (window as any).__mall.game.duck()));
console.log('errors', s.errors.filter((e) => !/GPU stall/.test(e)));
await s.browser.close();
