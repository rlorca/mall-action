import { open, shot } from './playtest-lib';
const ok = (n: string, c: boolean, x = ''): void => console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`);

const s = await open('http://localhost:4173/mall-action/play/?debug=1&seed=33');
const p = s.page;
await p.waitForFunction(() => !!(window as any).__mall && (window as any).__mall.bot.lib);
const ev = (code: string): Promise<any> => p.evaluate(code);
await ev('window.__mall.realtime = false');
// Konami with real keys: extra leading Ups, then B (x) and A (z)
for (const k of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'x', 'z']) {
  await p.keyboard.down(k);
  await ev('window.__mall.pump(2)');
  await p.keyboard.up(k);
  await ev('window.__mall.pump(2)');
}
await ev('window.__mall.pump(40)');
await shot(s, 'playtest-out/h1-black-friday-title.png');
ok('Konami code unlocks Black Friday on the title', await ev('window.__mall.game.title.blackFriday'));
await p.keyboard.press('Enter');
await ev('window.__mall.pump(4)');
ok('run is in Black Friday Mode', await ev('window.__mall.game.run.blackFriday'));
await ev(`(() => { var m = window.__mall; for (var i = 0; i < 700 && m.game.level.mall.intro; i++) { m.step(1, 0); if (m.game.level.mall.intro && m.game.level.mall.intro.phase === 'selfie' && m.game.level.mall.intro.t > 20) m.tap('B'); } })()`);
await ev('window.__mall.step(5, 0)');
await shot(s, 'playtest-out/h2-black-friday-mall.png');
const cap = await ev('window.__mall.game.level.mall.diff.spyCap');
ok('Black Friday doubles the spy cap', cap === 8, String(cap));
// continue: last life lost
await ev(`(() => { var m = window.__mall; var g = m.game; g.run.lives = 1; g.run.addScore(1234); g.run.givePower('rapid'); var w = g.level.mall; w.player.invuln = 0; w.player.invincible = 0; g.run.power.invincible = 0; w.bullets.push({ x: w.player.x - 1, y: w.player.y - 12, vx: 2, vy: 0, owner: 'spy', age: 0 }); m.step(140, 0); })()`);
const sc1 = await ev('window.__mall.state()');
ok('last life lost shows CONTINUE?', sc1.scene === 'continue', sc1.scene);
await ev('window.__mall.step(70, 0)');
await shot(s, 'playtest-out/h3-continue.png');
await ev("window.__mall.tap('START')");
const sc2 = await ev('window.__mall.state()');
ok('Start continues with 3 fresh lives, score kept, powers reset', sc2.scene === 'level' && sc2.run.lives === 3 && sc2.run.score >= 1234 && sc2.run.power.weapon === null && sc2.run.continuesLeft === 2, JSON.stringify([sc2.scene, sc2.run.lives, sc2.run.score, sc2.run.continuesLeft]));
// game over: no more continues
await ev(`(() => { var m = window.__mall; var g = m.game; g.run.lives = 1; g.run.continuesLeft = 0; var w = g.level.mall; w.player.invuln = 0; g.run.power.invincible = 0; w.bullets.push({ x: w.player.x - 1, y: w.player.y - 12, vx: 2, vy: 0, owner: 'spy', age: 0 }); m.step(140, 0); })()`);
ok('no continues left -> game over scene', (await ev('window.__mall.state().scene')) === 'gameover');
await ev('window.__mall.step(70, 0)');
await shot(s, 'playtest-out/h4-gameover-typewriter.png');
await ev('window.__mall.step(260, 0)');
await shot(s, 'playtest-out/h5-gameover-shutters.png');
await ev('window.__mall.step(100, 0)');
await shot(s, 'playtest-out/h6-gameover-final.png');
await ev("window.__mall.tap('START')");
await ev('window.__mall.step(5, 0)');
ok('game over returns to the title', (await ev('window.__mall.state().scene')) === 'title');
console.log('errors', s.errors.filter((e) => !/GPU stall/.test(e)));
await s.browser.close();
