import { open, shot } from './playtest-lib';
const s = await open('http://localhost:4173/mall-action/play/?gallery=1');
await s.page.waitForTimeout(600);
await shot(s, 'playtest-out/gallery-1.png');
await s.page.keyboard.press('ArrowRight');
await s.page.waitForTimeout(200);
await shot(s, 'playtest-out/gallery-2.png');
console.log('errors', s.errors.filter((e) => !/GPU stall/.test(e)));
await s.browser.close();
