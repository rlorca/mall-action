import { open, state } from './playtest-lib';
const s = await open('http://localhost:4173/mall-action/play/?seed=5&debug=1');
const p = s.page;
await p.waitForFunction(() => !!(window as any).__mall);
await p.waitForTimeout(500);
await p.keyboard.press('Enter');
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(250);
  const st = await state(s);
  console.log(i, st.scene, st.frame, st.level && JSON.stringify([st.level.intro, st.level.overlay, st.level.spies]), st.run && JSON.stringify([st.run.lives, st.run.score]), st.player && JSON.stringify([st.player.x, st.player.y, st.player.mode]));
}
console.log('errors', s.errors.filter((e) => !/GPU stall/.test(e)));
await s.browser.close();
