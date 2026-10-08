import { open, shot, state } from './playtest-lib';

const s = await open('http://localhost:4173/mall-action/play/?seed=5&debug=1');
const p = s.page;
await p.waitForFunction(() => !!(window as any).__mall);
// debug skips the splash; go to a fresh no-debug tab for the splash later. First: real-time title -> arrival.
await p.waitForTimeout(500);
await shot(s, 'playtest-out/f1-title.png');
await p.keyboard.press('Enter');
// zip line
await p.waitForTimeout(1000);
await shot(s, 'playtest-out/f2-zip.png');
await p.waitForTimeout(1500);
await shot(s, 'playtest-out/f3-drop.png');
await p.waitForTimeout(2200);
console.log('arrival state', JSON.stringify((await state(s)).level));
await p.keyboard.press('x'); // skip selfie
await p.waitForTimeout(300);
await shot(s, 'playtest-out/f4-control.png');
// walk right to the elevator A with the real keyboard
await p.keyboard.down('ArrowRight');
await p.waitForTimeout(1300);
await p.keyboard.up('ArrowRight');
console.log('at', JSON.stringify((await state(s)).player));
await p.keyboard.press('ArrowDown'); // board
await p.waitForTimeout(100);
await p.keyboard.down('ArrowDown');
await p.waitForTimeout(700);
await shot(s, 'playtest-out/f5-ride.png');
await p.waitForTimeout(500);
await p.keyboard.up('ArrowDown');
await p.waitForTimeout(1500);
console.log('after ride', JSON.stringify(await state(s)));
await shot(s, 'playtest-out/f6-4F.png');
// get out and shoot
await p.keyboard.down('ArrowRight');
await p.waitForTimeout(500);
await p.keyboard.down('z');
await p.waitForTimeout(400);
await shot(s, 'playtest-out/f7-shoot.png');
await p.keyboard.up('z');
await p.keyboard.up('ArrowRight');
console.log('errors', s.errors.filter((e) => !/GPU stall/.test(e)));
await s.browser.close();
