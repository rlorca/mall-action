import { chromium } from 'playwright-core';
import { open, shot, state } from './playtest-lib';

const URL = 'http://localhost:4173/mall-action/play/?debug=1&seed=9';
const ok = (name: string, cond: boolean, extra = ''): void => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);

// ---- CRT toggle + OSD + persistence, mute OSD
{
  const s = await open(URL);
  const p = s.page;
  await p.waitForFunction(() => !!(window as any).__mall);
  await p.evaluate(() => ((window as any).__mall.realtime = false));
  await p.evaluate(() => (window as any).__mall.step(5, 0));
  const crtDefault = await p.evaluate(() => localStorage.getItem('mall-action:crt'));
  ok('CRT defaults to ON (nothing stored yet)', crtDefault === null);
  await p.keyboard.press('c');
  await p.waitForTimeout(150);
  await shot(s, 'playtest-out/m1-crt-off.png');
  ok('CRT preference persisted as off', (await p.evaluate(() => localStorage.getItem('mall-action:crt'))) === '0');
  await p.keyboard.press('m');
  await p.waitForTimeout(150);
  await shot(s, 'playtest-out/m2-mute.png');
  ok('mute persisted', (await p.evaluate(() => localStorage.getItem('mall-action:mute'))) === '1');
  await p.reload();
  await p.waitForFunction(() => !!(window as any).__mall);
  ok('CRT stays off after reload', (await p.evaluate(() => localStorage.getItem('mall-action:crt'))) === '0');
  await p.evaluate(() => ((window as any).__mall.audio.isMuted()));
  ok('muted after reload', await p.evaluate(() => (window as any).__mall.audio.isMuted()));
  await p.keyboard.press('c');
  await p.keyboard.press('m');
  await p.waitForTimeout(200);
  await shot(s, 'playtest-out/m3-crt-on-again.png');
  ok('no console errors', s.errors.filter((e) => !/GPU stall/.test(e)).length === 0, JSON.stringify(s.errors.filter((e) => !/GPU stall/.test(e))));
  await s.browser.close();
}

// ---- resize, device pixel ratio: the canvas is always an exact integer multiple of 256x240 in device pixels
{
  for (const [w, h, dpr] of [[1280, 800, 1], [800, 600, 1], [1920, 1080, 1], [1440, 900, 2], [300, 300, 1], [2560, 1300, 2]] as const) {
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).__mall);
    const m = await page.evaluate(() => {
      const c = document.getElementById('screen') as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      return { bw: c.width, bh: c.height, cw: r.width, ch: r.height, x: r.x, y: r.y, dpr: window.devicePixelRatio };
    });
    const scale = m.bw / 256;
    ok(`${w}x${h}@${dpr}x: integer scale ${scale}`, Number.isInteger(scale) && m.bh === 240 * scale && Math.abs(m.cw * m.dpr - m.bw) < 0.01, JSON.stringify(m));
    await page.setViewportSize({ width: 700, height: 500 });
    await page.waitForTimeout(150);
    const m2 = await page.evaluate(() => (document.getElementById('screen') as HTMLCanvasElement).width);
    ok(`  after live resize to 700x500: width ${m2}`, m2 % 256 === 0);
    await browser.close();
  }
}

// ---- fake gamepad connecting / disconnecting while the game runs
{
  const s = await open(URL);
  const p = s.page;
  await p.evaluate(() => {
    (window as any).__pad = null;
    navigator.getGamepads = () => [(window as any).__pad] as any;
  });
  await p.waitForFunction(() => !!(window as any).__mall);
  await p.evaluate(() => ((window as any).__mall.realtime = true));
  const mkPad = (pressed: number[], axes = [0, 0]) => ({
    connected: true,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
    axes,
  });
  // Start on the pad (button 9)
  await p.evaluate((pad) => ((window as any).__pad = pad), mkPad([9]));
  await p.waitForTimeout(150);
  await p.evaluate((pad) => ((window as any).__pad = pad), mkPad([]));
  await p.waitForTimeout(150);
  ok('gamepad Start begins the game', (await state(s)).scene === 'level');
  for (let i = 0; i < 400; i++) {
    const st = await state(s);
    if (!st.level.intro) break;
    await p.evaluate((pad) => ((window as any).__pad = pad), mkPad([1]));
    await p.waitForTimeout(40);
    await p.evaluate((pad) => ((window as any).__pad = pad), mkPad([]));
    await p.waitForTimeout(40);
  }
  const x0 = (await state(s)).player.x;
  await p.evaluate((pad) => ((window as any).__pad = pad), mkPad([], [0.9, 0]));
  await p.waitForTimeout(400);
  const x1 = (await state(s)).player.x;
  ok('left stick walks right', x1 > x0 + 10, `${x0} -> ${x1}`);
  await p.evaluate(() => ((window as any).__pad = null)); // unplugged mid-walk
  await p.waitForTimeout(300);
  const x2 = (await state(s)).player.x;
  await p.waitForTimeout(300);
  const x3 = (await state(s)).player.x;
  ok('unplugging the pad releases the stick (no stuck input)', Math.abs(x3 - x2) < 0.5, `${x2} -> ${x3}`);
  await p.evaluate((pad) => ((window as any).__pad = pad), mkPad([15])); // plugged back in: d-pad right
  await p.waitForTimeout(300);
  ok('reconnected pad works', (await state(s)).player.x > x3 + 5);
  await s.browser.close();
}

// ---- no WebGL: a clear message instead of a black page
{
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-3d-apis', '--disable-gpu', '--disable-webgl'] });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(500);
  const txt = await page.evaluate(() => ({ fb: (document.getElementById('fallback') as HTMLElement).textContent, display: getComputedStyle(document.getElementById('fallback')!).display, canvas: getComputedStyle(document.getElementById('screen')!).display }));
  ok('missing WebGL shows a clear message', /WEBGL/i.test(txt.fb ?? '') && txt.display === 'block' && txt.canvas === 'none', JSON.stringify(txt));
  ok('  and throws no errors', errors.length === 0, errors.join(';'));
  await browser.close();
}
