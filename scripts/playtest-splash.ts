import { open, shot } from './playtest-lib';
const ok = (n: string, c: boolean, x = ''): void => console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`);
// real time, NO debug flag: the studio splash runs by itself
const s = await open('http://localhost:4173/mall-action/play/?seed=2');
const p = s.page;
await p.waitForTimeout(250);
await shot(s, 'playtest-out/sp1-flicker-a.png');
await p.waitForTimeout(16);
await shot(s, 'playtest-out/sp1-flicker-b.png');
await p.waitForTimeout(1000);
await shot(s, 'playtest-out/sp2-settled.png');
await p.waitForTimeout(1000);
await shot(s, 'playtest-out/sp3-presents.png');
await p.waitForTimeout(1500);
await shot(s, 'playtest-out/sp4-title.png');
const url = await p.evaluate(() => document.title);
ok('page title', url === 'MALL ACTION', url);
console.log('errors', s.errors.filter((e) => !/GPU stall/.test(e)));
await s.browser.close();

// skipping the splash with any button
const s2 = await open('http://localhost:4173/mall-action/play/?seed=2');
await s2.page.waitForTimeout(400);
await s2.page.keyboard.press('Space');
await s2.page.waitForTimeout(300);
await shot(s2, 'playtest-out/sp5-skipped.png');
await s2.browser.close();

// alarm
const s3 = await open('http://localhost:4173/mall-action/play/?debug=1&seed=5&start=1&skipintro=1');
await s3.page.waitForFunction(() => !!(window as any).__mall);
await s3.page.evaluate('window.__mall.realtime = false');
await s3.page.evaluate('window.__mall.game.run.levelFrames = 150 * 60 - 2; window.__mall.step(5, 0)');
await s3.page.evaluate('window.__mall.step(40, 0)');
await shot(s3, 'playtest-out/al1-alarm.png');
console.log('alarm state', JSON.stringify(await s3.page.evaluate('window.__mall.state().run.alarm + " music=" + window.__mall.state().music')));
await s3.browser.close();
