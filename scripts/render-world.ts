// Render-parity fixture generator (R2). Run: $S/node_modules/.bin/tsx gen-render-world.ts <out.json>
// Drives the TS Game / StoreWorld / MallWorld with scripted pads and dumps framebuffer FNV-1a hashes.
import { writeFileSync } from 'node:fs';
const S = '/Users/rodrigo/code/mall-action/.worktrees/sonnet-5-5-fable-5-1/src';
const imp = (p: string) => import(`${S}/${p}`);

const { Btn, padFromHeld, maskOf } = await imp('engine/pad');
const { Framebuffer } = await imp('engine/framebuffer');
await imp('art/index');
const { Game } = await imp('game/game');
const { renderGame } = await imp('render/gameView');
const { drawHud } = await imp('render/hud');
const { drawStoreView } = await imp('render/storeView');
const { drawMall } = await imp('render/mallView');
const { drawMallActors, drawMallFurniture } = await imp('render/mallActorsView');
const { makeWorld } = await imp('game/store/testutil');
const { makeXRig } = await imp('game/mall/modules/testrig');
const { OPEN_STORES, STORES } = await imp('content/stores');

const fnv = (px: Uint8Array): number => { let h = 0x811c9dc5; for (let i = 0; i < px.length; i++) { h ^= px[i]!; h = Math.imul(h, 0x01000193); } return h >>> 0; };
const out: Record<string, number> = {};
const emit = (key: string, fb: { px: Uint8Array }): void => { if (key in out) throw new Error('dup ' + key); out[key] = fnv(fb.px); };
const lcgNext = (s: number): number => (Math.imul(s, 1664525) + 1013904223) >>> 0;
const stats: Record<string, number> = {};
const bump = (k: string): void => { stats[k] = (stats[k] ?? 0) + 1; };

// ---------------------------------------------------------------- HUD
{
  const hud = (over: Record<string, unknown> = {}) => ({ score: 12340, packages: 3, lives: 3, timed: null, armor: false, radar: false, alarm: false, floor: 0, marquee: null, frame: 0, ...over });
  const WORST = hud({ score: 999999, packages: 6, lives: 99, timed: { name: 'ORANGE JULI-OOZE', frac: 0.2 }, armor: true, radar: true, alarm: true, floor: 5 });
  const states = [
    hud(), WORST, { ...WORST, floor: null, marquee: 'BLOCKBLUSTER VIDEO' }, hud({ floor: null }),
    hud({ timed: { name: 'AN EXTREMELY LONG POWER UP NAME', frac: 1 } }), hud({ score: 0, packages: 0, lives: 0 }),
    hud({ score: 12345678, packages: 9, lives: 250, timed: { name: 'RAPID FIRE', frac: 7 } }),
    hud({ timed: { name: 'RAPID FIRE', frac: 0.4 }, floor: 3, alarm: true }), hud({ timed: { name: 'SNEAKERS', frac: 0.1 }, floor: 2, armor: true }),
  ];
  states.forEach((h, i) => {
    for (const frame of [0, 5, 9, 11, 20, 40, 61, 77, 123]) {
      const fb = new Framebuffer(); fb.clear(0x3d); drawHud(fb, { ...h, frame }); emit(`hud/${i}/${frame}`, fb);
    }
  });
  for (const s of STORES) {
    for (const frame of [0, 30, 77, 301]) {
      const fb = new Framebuffer(); fb.clear(0x3d); drawHud(fb, hud({ floor: null, marquee: s.name, frame })); emit(`hud/marquee/${s.id}/${frame}`, fb);
    }
  }
}

// ---------------------------------------------------------------- store rooms, scripted pad
{
  const MASKS = [0, Btn.RIGHT, Btn.LEFT, Btn.UP, Btn.DOWN, Btn.RIGHT | Btn.UP, Btn.LEFT | Btn.DOWN, Btn.B, Btn.A, Btn.A | Btn.RIGHT, Btn.B | Btn.LEFT, Btn.B | Btn.UP, Btn.A | Btn.DOWN, 0];
  OPEN_STORES.forEach((def: { id: string }, idx: number) => {
    const seed = 7 + idx;
    const m = makeWorld(def.id, { seed, guards: true, seen: idx % 2 === 0, egg: def.id === 'gamestonk' });
    if (idx % 2 === 1) m.run.givePower('radar');
    if (idx % 3 === 1) m.run.givePower('cinnabomb');
    if (idx % 4 === 2) m.run.givePower('armor');
    let lcg = (500 + idx) >>> 0; let held = 0; let prev = 0;
    for (let f = 0; f < 900; f++) {
      if (f % 12 === 0) { lcg = lcgNext(lcg); held = MASKS[(lcg >>> 16) % MASKS.length]!; }
      m.world.step(padFromHeld(prev, held)); prev = held;
      if (f % 30 === 29 || (f < 120 && f % 6 === 5)) {
        const fb = new Framebuffer(); fb.clear(0x0d); drawStoreView(fb, m.world, m.world.frame); emit(`store/${def.id}/${f}`, fb);
        if (m.world.search) bump('store.search'); if (m.world.banner) bump('store.banner'); if (m.world.bubbles.length) bump('store.bubbles');
        if (m.world.bullets.length) bump('store.bullets'); if (m.world.agent.hold) bump('store.hold'); if (m.world.toys.length) bump('store.toys');
        if (m.world.puffs.length) bump('store.puffs'); if (m.world.typewriter !== null) bump('store.typewriter'); if (m.world.agent.dying > 0) bump('store.dying');
        if (m.world.guards.some((g: { aim: number }) => g.aim > 0)) bump('store.aim'); if (m.world.guards.some((g: { stun: number }) => g.stun > 0)) bump('store.gstun');
        if (m.world.agent.stun > 0) bump('store.astun'); if (m.world.peeked.size) bump('store.peeked'); if (m.world.onBooth) bump('store.booth');
      }
    }
  });
}

// ---------------------------------------------------------------- mall with extras, scripted pad
{
  const HOOKS = { furniture: drawMallFurniture, actors: drawMallActors };
  const MASKS = [0, Btn.RIGHT, Btn.LEFT, Btn.RIGHT | Btn.B, Btn.LEFT | Btn.B, Btn.A, Btn.RIGHT | Btn.A, Btn.UP, Btn.DOWN, Btn.B, Btn.UP | Btn.RIGHT, Btn.DOWN | Btn.RIGHT, Btn.A | Btn.B, 0];
  const draw = (r: { w: unknown; run: unknown }, frame: number) => { const fb = new Framebuffer(); fb.clear(0x0d); drawMall(fb, { mall: r.w, run: r.run } as never, frame, HOOKS); return fb; };
  const SCN: Array<[number, number, number]> = [[3, 0, 100], [5, 3, 300], [9, 4, 150], [11, 2, 500], [13, 1, 200], [17, 4, 600]];
  for (const [seed, floor, x] of SCN) {
    const r = makeXRig({ seed, floor, x, spies: true });
    r.run.lives = 9999;
    let lcg = (1000 + seed) >>> 0; let held = 0;
    for (let f = 0; f < 3000; f++) {
      if (f % 12 === 0) { lcg = lcgNext(lcg); held = MASKS[(lcg >>> 16) % MASKS.length]!; }
      r.hold(held, 1);
      if (f % 40 === 39) {
        emit(`mall/s${seed}/${f}`, draw(r, r.w.frame));
        if (r.w.spies.length) bump('mall.spies'); if (r.w.bullets.length) bump('mall.bullets'); if (r.w.pickups.length) bump('mall.pickups');
        if (r.w.shake > 0) bump('mall.shake'); if (r.w.banner) bump('mall.banner'); if (r.w.popups.length) bump('mall.popups'); if (r.w.bubbles.length) bump('mall.bubbles');
        if (r.w.player.mode !== 'ground') bump('mall.mode.' + r.w.player.mode); if (r.run.alarmOn) bump('mall.alarm');
        if (r.x.janitor.patch) bump('mall.patch'); if (r.x.kiosks.panel) bump('mall.panel'); if (r.x.booth.strip) bump('mall.strip'); if (r.x.fx.items.length) bump('mall.fx');
        if (r.x.lamps.dark.length) bump('mall.dark'); if (r.x.lamps.lamps.some((l: { mode: string }) => l.mode !== 'hung')) bump('mall.lampsdown');
        if (r.w.player.frozen > 0) bump('mall.frozen'); if (r.w.player.invuln > 0) bump('mall.invuln');
      }
    }
    // poked states on top of the final world
    r.x.janitor.patch = { x: r.w.player.x + 30, t: 80 };
    r.x.booth.strip = { x: r.w.player.x, y: r.w.player.y, t: 30, total: 200 };
    r.x.kiosks.panel = { kiosk: 1, target: 'crookstone', t: 100, total: 240 };
    for (const f of [3, 10, 17, 24]) emit(`mall/poke/s${seed}/${f}`, draw(r, f));
    r.w.shake = 10; r.run.alarmOn = true;
    for (const f of [16, 17, 18, 19, 34]) emit(`mall/shake/s${seed}/${f}`, draw(r, f));
    r.run.givePower('cinnabomb'); r.w.player.frozen = 30; r.w.player.invuln = 50;
    for (const f of [0, 1, 2, 3, 4, 5]) emit(`mall/flash/s${seed}/${f}`, draw(r, f));
  }
}

// ---------------------------------------------------------------- whole Game, scripted pad (all scenes + overlays + fades)
{
  const MASKS = [0, Btn.RIGHT, Btn.LEFT, Btn.RIGHT | Btn.B, Btn.LEFT | Btn.B, Btn.A, Btn.RIGHT | Btn.A, Btn.UP, Btn.DOWN, Btn.B, Btn.UP | Btn.RIGHT, Btn.DOWN | Btn.RIGHT, Btn.START, Btn.SELECT, Btn.A | Btn.B, 0];
  const GAMES = [
    { name: 'g1', seed: 5, opts: { autostart: true, skipIntro: true }, frames: 7000, inputSeed: 71, start: 0 },
    { name: 'g2', seed: 77, opts: { autostart: true }, frames: 4000, inputSeed: 73, start: 0 },
    { name: 'g3', seed: 2024, opts: { autostart: true, skipIntro: true, blackFriday: true }, frames: 7000, inputSeed: 79, start: 0 },
    { name: 'g4', seed: 31, opts: { autostart: true, skipIntro: true }, frames: 7000, inputSeed: 83, start: 0 },
    { name: 'g5', seed: 8, opts: { skipSplash: true }, frames: 2500, inputSeed: 89, start: 30 },
  ];
  for (const s of GAMES) {
    const g = new Game({ seed: s.seed, ...s.opts } as never);
    const fb = new Framebuffer();
    let held = 0; let prev = 0; let lcg = s.inputSeed >>> 0;
    for (let f = 0; f < s.frames; f++) {
      if (f % 15 === 0) { lcg = lcgNext(lcg); held = MASKS[(lcg >>> 16) % 16]!; }
      let m = held; if (f === s.start && s.start > 0) m = Btn.START; else if (m & Btn.START && f % 15 !== 0) m &= ~Btn.START;
      g.step(padFromHeld(prev, m)); prev = m; g.drainSfx();
      if (f % 20 === 19 || (f < 200 && f % 4 === 3)) {
        renderGame(fb, g);
        emit(`game/${s.name}/${f}`, fb);
        bump('game.scene.' + g.scene);
        if (g.scene === 'level') { const lv = g.level; if (lv.overlay) bump('game.overlay.' + lv.overlay); if (lv.store) bump('game.store'); if (lv.fadeSteps() > 0) bump('game.fade'); if (lv.mall.intro) bump('game.intro.' + lv.mall.intro.phase); }
      }
    }
  }
}

const lines = Object.entries(out).map(([k, v]) => `${JSON.stringify(k)}:${v}`);
writeFileSync(process.argv[2] ?? 'render-world.json', '{\n' + lines.join(',\n') + '\n}\n');
console.log(Object.keys(out).length + ' hashes');
console.log(JSON.stringify(stats, null, 1));
void maskOf;
