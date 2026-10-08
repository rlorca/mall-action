import { open } from './playtest-lib';
const s = await open('http://localhost:4173/mall-action/play/?debug=1&seed=8&start=1&skipintro=1');
const p = s.page;
await p.waitForFunction(() => !!(window as any).__mall && (window as any).__mall.bot.lib);
await p.evaluate(() => ((window as any).__mall.realtime = false));
const r = await p.evaluate(`(() => {
  var m = window.__mall; var rig = m.bot.rig;
  function t(n, render) { m.bot.renderEvery = render; var a = performance.now(); rig.hold(0, n); return (performance.now() - a) / n; }
  var sim = t(600, false);
  var both = t(600, true);
  return { simMsPerFrame: sim, simPlusDrawPlusUploadMsPerFrame: both };
})()`);
console.log(JSON.stringify(r), '(16.7 ms is the 60 fps budget)');
await s.browser.close();
