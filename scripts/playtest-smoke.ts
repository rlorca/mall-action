import { open, shot, state, step } from './playtest-lib';

const s = await open('http://localhost:4173/mall-action/play/?debug=1&seed=3');
await s.page.waitForFunction(() => !!(window as any).__mall, null, { timeout: 15000 });
(await s.page.evaluate(() => ((window as any).__mall.realtime = false)));
console.log('title state', JSON.stringify(await state(s)));
await step(s, 30);
await shot(s, 'playtest-out/pt-title.png');
// real keyboard: press Enter
await s.page.keyboard.press('Enter');
await s.page.evaluate(() => ((window as any).__mall.realtime = true));
await s.page.waitForTimeout(600);
console.log('after enter', JSON.stringify((await state(s)).scene));
await s.page.waitForTimeout(2500);
await shot(s, 'playtest-out/pt-arrival.png');
console.log('errors', s.errors);
await s.browser.close();
