# Mall Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-playable vertical slice of *Mall Action*, an Elevator Action successor set in a shopping mall (side-scrolling mall + top-down Zelda-style stores).

**Architecture:** Vite + vanilla ES modules. All game rules live in pure modules (`src/logic`, `src/world`, `src/game`) with Vitest coverage; PixiJS v8 is used only by `src/gfx`, `src/scenes`, `src/ui` and `src/main.js`. A fixed 60 Hz step drives a scene stack; the scene renders a 256×240 world that is integer-scaled and passed through a toggleable CRT filter. All art is pixel grids in source; all audio is a WebAudio NES-style synth.

**Tech Stack:** Node 20+, Vite 6, PixiJS 8, pixi-filters 6, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-28-mall-action-design.md` — read it before every task; section numbers below (§x.y) refer to it.

## Global Constraints

- Internal resolution **256×240**; HUD strip **16 px** at top (y 0..15). Mall view: world viewport 256×224 at y=16. Store view: room 256×176 at y=16..191; bottom strip y=192..239 shows store name, prompts and dialogue text.
- Nearest-neighbour scaling, integer scale factor, integer render positions (`roundPixels: true`).
- Fixed timestep **60 Hz**; all durations in this plan are in **frames** (60 = 1 s).
- No external image/audio/font files. Art = pixel-grid strings; sound = WebAudio.
- Each sprite uses **≤ 3 colours + transparent**, colours taken from `src/gfx/palette.js`.
- Store names are parody puns exactly as in spec §3.2 table (plus GameStonk); no real logos.
- `src/logic`, `src/world`, `src/game`, `src/audio/notes.js` must not import `pixi.js` or touch `window`/`document`.
- Mall world: width **768**, 6 floors (`R,4F,3F,2F,1F,P` = indices 0..5), floor pitch **48**, sky **32**; `feetY(i) = 72 + 48*i`.
- Controls exactly as spec §9. `C` toggles CRT, `M` mutes.
- Commit after every task with a conventional message.

## Review Focus

1. **Walking into an elevator shaft while the car is 2+ floors below** — player must die (fall > 48 px), not land or clip; car one floor below (8 px drop to its roof) must be a safe landing. (Task 5 test `fall distance`.)
2. **Car released between floors** — must glide to the next floor in its direction and stop exactly aligned, firing one `stopped` event (ding); holding a direction at the end of the shaft must not spam dings. (Task 5 tests.)
3. **Reaching P without all packages** — car must not start, message shows remaining count; with all 6 it must trigger Level Clear exactly once. (Task 6 `canExit` + Task 15 wiring.)
4. **Konami code with extra leading ups** (`↑↑↑↓↓…`) must still unlock Black Friday. (Task 7 test.)
5. **Re-entering a store** whose package is still inside must respawn guards and keep already-searched fixtures opened; a cleared store must be closed to entry. (Task 4 setup keeps `searched` per fixture; Task 13 test `store re-entry`.)

---

## File Map

```
index.html                     page shell, #app container, pixel CSS
vite.config.js                 vitest config (environment node)
package.json
src/main.js                    boot Pixi, scaling, CRT, hotkeys, loop, scene manager, debug hook
src/core/loop.js               fixed-step accumulator (pure)
src/core/rng.js                seeded RNG (pure)
src/core/input.js              Pad (pure) + keyboard/gamepad adapters
src/core/scenes.js             SceneManager: replace/push/pop + fades
src/audio/notes.js             note parsing (pure)
src/audio/synth.js             WebAudio engine: channels, sequencer, sfx player
src/audio/music.js             track data
src/audio/sfx.js               sfx definitions
src/gfx/palette.js             NES-like master palette + named colours
src/gfx/grid.js                pixel-grid → RGBA (pure)
src/gfx/textures.js            RGBA → Pixi textures, sprite registry, animation helper
src/gfx/font.js                8×8 font glyph grids + makeText()
src/gfx/sprites/characters.js  agent (mall 16×24 + top-down 16×16), spies, bot, NPCs
src/gfx/sprites/mall.js        floor/wall tiles, shafts, cars, escalators, lights, decor, storefronts, displays
src/gfx/sprites/store.js       per-theme room tiles & fixtures
src/gfx/sprites/items.js       power-ups, package, coins, joke items, bullets, smoke
src/world/constants.js         dimensions + feetY/floorTop
src/world/mallLevel.js         shafts, escalators, stores, lights, kiosks, fountains, booth, car
src/world/storeRooms.js        10 room templates + parseRoom()
src/world/levelSetup.js        per-level fixture contents (pure)
src/world/reachability.js      floor connectivity (pure)
src/logic/physics.js           AABB, air motion, landing, room movement
src/logic/elevator.js          cars, doorway states, crush
src/logic/rules.js             scores, exit rule, difficulty, alarm, bonus
src/logic/powerups.js          power-up state machine
src/logic/loot.js              weighted rolls
src/logic/npcs.js              wet floor, mall cop, walkers, kiosk target
src/logic/secrets.js           Konami, joke items
src/game/state.js              GameState create / next loop / death reset
src/entities/*.js              per-entity update + view (Pixi) — see tasks
src/scenes/*.js                Title, Mall, Store, MapOverlay, PauseOverlay, LevelClear, GameOver
src/ui/hud.js                  HUD strip
tests/*.test.js                Vitest
```

---

### Task 1: Project scaffold, fixed-step loop, Pixi boot with integer scaling + CRT

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/core/loop.js`, `src/world/constants.js`, `.gitignore`
- Test: `tests/loop.test.js`

**Interfaces:**
- Produces: `createFixedStep(stepMs = 1000/60, maxSteps = 5) → { advance(dtMs, update: () => void): number }`
- Produces: constants `SCREEN_W=256, SCREEN_H=240, HUD_H=16, MALL_W=768, SKY=32, PITCH=48, FLOORS=6, FLOOR_NAMES, MALL_H=320, feetY(i), floorTop(i)`

- [ ] **Step 1: Init project and install deps**

```bash
cd /Users/rodrigo/code/mall-action
npm init -y
npm i pixi.js@^8 pixi-filters@^6
npm i -D vite@^6 vitest@^3
printf "node_modules\ndist\n.DS_Store\n" > .gitignore
```

Then edit `package.json` so it contains:

```json
{
  "name": "mall-action",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```
(keep the `dependencies`/`devDependencies` npm wrote).

`vite.config.js`:

```js
import { defineConfig } from 'vite';
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
```

- [ ] **Step 2: Write failing loop test** — `tests/loop.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createFixedStep } from '../src/core/loop.js';

describe('createFixedStep', () => {
  it('runs one update per 1/60 s', () => {
    const fs = createFixedStep(); let n = 0;
    fs.advance(1000 / 60, () => n++);
    expect(n).toBe(1);
  });
  it('accumulates partial frames', () => {
    const fs = createFixedStep(); let n = 0;
    fs.advance(10, () => n++); expect(n).toBe(0);
    fs.advance(10, () => n++); expect(n).toBe(1);
  });
  it('caps catch-up steps and drops the backlog', () => {
    const fs = createFixedStep(1000 / 60, 5); let n = 0;
    fs.advance(1000, () => n++); expect(n).toBe(5);
    n = 0; fs.advance(1000 / 60, () => n++); expect(n).toBe(1);
  });
});
```

- [ ] **Step 3: Run it, expect FAIL** — `npx vitest run tests/loop.test.js` → "Failed to load ../src/core/loop.js".

- [ ] **Step 4: Implement** `src/core/loop.js`

```js
export function createFixedStep(stepMs = 1000 / 60, maxSteps = 5) {
  let acc = 0;
  return {
    advance(dtMs, update) {
      acc += dtMs;
      let n = 0;
      while (acc >= stepMs && n < maxSteps) { update(); acc -= stepMs; n++; }
      if (n === maxSteps) acc = 0;
      return n;
    },
  };
}
```

`src/world/constants.js`

```js
export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const HUD_H = 16;
export const MALL_W = 768;
export const SKY = 32;
export const PITCH = 48;
export const FLOORS = 6;
export const FLOOR_NAMES = ['R', '4F', '3F', '2F', '1F', 'P'];
export const MALL_H = SKY + FLOORS * PITCH; // 320
export const floorTop = (i) => SKY + i * PITCH;      // top of floor i's space
export const feetY = (i) => floorTop(i) + 40;        // walking surface of floor i
export const WALL_L = 8;
export const WALL_R = MALL_W - 8;
```

- [ ] **Step 5: Run test, expect PASS** — `npx vitest run tests/loop.test.js`.

- [ ] **Step 6: Boot Pixi** — `index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mall Action</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    #app { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; color: #fff; font: 16px monospace; }
    canvas { image-rendering: pixelated; display: block; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

`src/main.js` (initial version; later tasks extend it where marked):

```js
import { Application, Container, Graphics, TextureStyle } from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { SCREEN_W, SCREEN_H } from './world/constants.js';
import { createFixedStep } from './core/loop.js';

TextureStyle.defaultOptions.scaleMode = 'nearest';

function fitScale() {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H)));
}

async function boot() {
  const host = document.getElementById('app');
  const app = new Application();
  try {
    await app.init({ width: SCREEN_W, height: SCREEN_H, background: '#000000', antialias: false, roundPixels: true, resolution: 1, preference: 'webgl' });
  } catch (err) {
    host.textContent = 'WebGL is required to play Mall Action.';
    throw err;
  }
  host.appendChild(app.canvas);

  const root = new Container();       // everything at native 256×240 lives here
  app.stage.addChild(root);

  const crt = new CRTFilter({ curvature: 2, lineWidth: 1.5, lineContrast: 0.2, noise: 0.06, noiseSize: 1, vignetting: 0.25, vignettingAlpha: 0.5 });
  let crtOn = true;
  const applyFilters = () => { app.stage.filters = crtOn ? [crt] : []; };
  applyFilters();

  const resize = () => {
    const s = fitScale();
    app.renderer.resize(SCREEN_W * s, SCREEN_H * s);
    root.scale.set(s);
    crt.lineWidth = Math.max(1, s * 0.5);
  };
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC') { crtOn = !crtOn; applyFilters(); }
  });

  // TEMP test pattern (removed in Task 9)
  root.addChild(new Graphics().rect(0, 0, SCREEN_W, 16).fill(0x2038ec).rect(120, 100, 16, 24).fill(0xfc7460));

  const fixed = createFixedStep();
  app.ticker.add((t) => {
    fixed.advance(t.deltaMS, () => { /* update(): wired in Task 9 */ });
    crt.time += 0.5; crt.seed = Math.random();
  });
}

boot();
```

- [ ] **Step 7: Verify in browser** — run `npx vite --port 5173` (background), open `http://localhost:5173`: black page with a blue bar and a salmon rectangle, crisp pixels, scaled up; pressing `C` toggles scanlines/curvature. Stop server. Run `npm run build` → succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite+Pixi app with fixed-step loop, integer scaling and CRT filter"
```

---

### Task 2: Seeded RNG and input (virtual NES pad, keyboard, gamepad)

**Files:**
- Create: `src/core/rng.js`, `src/core/input.js`
- Test: `tests/rng.test.js`, `tests/input.test.js`

**Interfaces:**
- Produces: `createRng(seed:number) → { next():[0,1), int(min,max) inclusive, pick(arr), chance(p):bool, shuffle(arr):arr(copy) }`
- Produces: `BUTTONS`, `KEYMAP`, `class Pad { step(heldSet:Set<string>); held(b); pressed(b); released(b); pressedList():string[] }`, `mapGamepad(gp) → Set<string>`, `createInput(target = window) → { pad, poll(), onHotkey(code, fn), destroy() }`

- [ ] **Step 1: Failing tests**

`tests/rng.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng.js';

describe('createRng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42), b = createRng(42);
    const xs = Array.from({ length: 5 }, () => a.next());
    const ys = Array.from({ length: 5 }, () => b.next());
    expect(xs).toEqual(ys);
  });
  it('int is inclusive and in range', () => {
    const r = createRng(1); const seen = new Set();
    for (let i = 0; i < 500; i++) { const v = r.int(2, 4); expect(v).toBeGreaterThanOrEqual(2); expect(v).toBeLessThanOrEqual(4); seen.add(v); }
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });
  it('shuffle returns a permutation without mutating', () => {
    const r = createRng(7); const src = [1, 2, 3, 4, 5];
    const out = r.shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
```

`tests/input.test.js`

```js
import { describe, it, expect } from 'vitest';
import { Pad, mapGamepad, KEYMAP } from '../src/core/input.js';

describe('Pad', () => {
  it('tracks held / pressed / released edges', () => {
    const p = new Pad();
    p.step(new Set(['a']));
    expect(p.held('a')).toBe(true); expect(p.pressed('a')).toBe(true);
    p.step(new Set(['a']));
    expect(p.pressed('a')).toBe(false); expect(p.held('a')).toBe(true);
    p.step(new Set());
    expect(p.released('a')).toBe(true); expect(p.held('a')).toBe(false);
  });
  it('lists pressed buttons in BUTTONS order', () => {
    const p = new Pad(); p.step(new Set(['b', 'up']));
    expect(p.pressedList()).toEqual(['up', 'b']);
  });
});

describe('KEYMAP', () => {
  it('maps spec §9 keys', () => {
    expect(KEYMAP.KeyZ).toBe('a'); expect(KEYMAP.KeyX).toBe('b');
    expect(KEYMAP.ShiftLeft).toBe('select'); expect(KEYMAP.Tab).toBe('select');
    expect(KEYMAP.Enter).toBe('start'); expect(KEYMAP.KeyW).toBe('up');
  });
});

describe('mapGamepad', () => {
  const gp = (pressed = [], axes = [0, 0]) => ({
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })), axes,
  });
  it('maps standard buttons', () => {
    expect([...mapGamepad(gp([0, 1, 8, 9]))].sort()).toEqual(['a', 'b', 'select', 'start']);
    expect([...mapGamepad(gp([12, 15]))].sort()).toEqual(['right', 'up']);
  });
  it('maps left stick with deadzone', () => {
    expect([...mapGamepad(gp([], [-0.9, 0.2]))]).toEqual(['left']);
    expect([...mapGamepad(gp([], [0.3, 0.3]))]).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/rng.test.js tests/input.test.js`.

- [ ] **Step 3: Implement** `src/core/rng.js`

```js
// mulberry32
export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
      return out;
    },
  };
}
```

`src/core/input.js`

```js
export const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'];

export const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b',
  ShiftLeft: 'select', ShiftRight: 'select', Tab: 'select', Enter: 'start',
};

export class Pad {
  constructor() { this.cur = new Set(); this.prev = new Set(); }
  step(heldSet) { this.prev = this.cur; this.cur = new Set(heldSet); }
  held(b) { return this.cur.has(b); }
  pressed(b) { return this.cur.has(b) && !this.prev.has(b); }
  released(b) { return !this.cur.has(b) && this.prev.has(b); }
  pressedList() { return BUTTONS.filter((b) => this.pressed(b)); }
}

const GP_BUTTONS = { 0: 'a', 1: 'b', 8: 'select', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

export function mapGamepad(gp) {
  const out = new Set();
  if (!gp) return out;
  for (const [i, name] of Object.entries(GP_BUTTONS)) if (gp.buttons[i]?.pressed) out.add(name);
  const [ax = 0, ay = 0] = gp.axes;
  if (ax < -0.5) out.add('left'); if (ax > 0.5) out.add('right');
  if (ay < -0.5) out.add('up'); if (ay > 0.5) out.add('down');
  return out;
}

export function createInput(target = window) {
  const pad = new Pad();
  const keys = new Set();
  const hotkeys = new Map();
  const down = (e) => {
    const b = KEYMAP[e.code];
    if (b) { keys.add(b); e.preventDefault(); }
    if (!e.repeat && hotkeys.has(e.code)) hotkeys.get(e.code)();
  };
  const up = (e) => { const b = KEYMAP[e.code]; if (b) keys.delete(b); };
  const blur = () => keys.clear();
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  return {
    pad,
    poll() {
      const held = new Set(keys);
      const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) if (gp) for (const b of mapGamepad(gp)) held.add(b);
      pad.step(held);
    },
    onHotkey(code, fn) { hotkeys.set(code, fn); },
    destroy() { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); target.removeEventListener('blur', blur); },
  };
}
```

- [ ] **Step 4: Run tests, expect PASS.**

- [ ] **Step 5: Wire into main.js** — create `const input = createInput(window);` in `boot()`, replace the raw `keydown` CRT listener with `input.onHotkey('KeyC', () => { crtOn = !crtOn; applyFilters(); });`, and call `input.poll()` as the first line inside the fixed-step update callback.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: seeded rng and keyboard/gamepad virtual pad"`

---

### Task 3: Palette, pixel-grid textures, 8×8 font

**Files:**
- Create: `src/gfx/palette.js`, `src/gfx/grid.js`, `src/gfx/textures.js`, `src/gfx/font.js`
- Test: `tests/grid.test.js`, `tests/font.test.js`

**Interfaces:**
- Produces: `NES: string[64]` (hex `#rrggbb`), `C` (named colours object, see code)
- Produces: `gridToRGBA(rows:string[], pal:string[]) → { w, h, data: Uint8ClampedArray }` — `'.'` transparent, `'1'..'9','a'..'z'` = `pal[parseInt(ch,36)-1]`; throws `Error('ragged grid')` or `Error('bad pixel "x"')`.
- Produces: `defineSprites(defs)`, `tex(name, frame=0) → Texture`, `frames(name) → Texture[]`, `makeSprite(name, frame=0) → Sprite`, `setFrame(sprite, name, frame)`. Sprite def shape: `{ pal: string[], frames: string[][] }` (every frame same size).
- Produces: `GLYPHS` (object char → 8 strings of 8), `makeText(str, color = C.white) → Container` (8 px per char, `\n` new line), `measure(str) → {w,h}`.

- [ ] **Step 1: Failing tests**

`tests/grid.test.js`

```js
import { describe, it, expect } from 'vitest';
import { gridToRGBA } from '../src/gfx/grid.js';

describe('gridToRGBA', () => {
  it('maps palette slots and transparency', () => {
    const { w, h, data } = gridToRGBA(['.1', '2.'], ['#ff0000', '#00ff00']);
    expect([w, h]).toEqual([2, 2]);
    expect([...data.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...data.slice(4, 8)]).toEqual([255, 0, 0, 255]);
    expect([...data.slice(8, 12)]).toEqual([0, 255, 0, 255]);
  });
  it('supports base-36 slots', () => {
    const pal = Array.from({ length: 10 }, (_, i) => `#0000${(i * 10).toString(16).padStart(2, '0')}`);
    const { data } = gridToRGBA(['a'], pal);
    expect(data[2]).toBe(90);
  });
  it('rejects ragged grids and unknown pixels', () => {
    expect(() => gridToRGBA(['..', '.'], ['#000000'])).toThrow('ragged grid');
    expect(() => gridToRGBA(['2'], ['#000000'])).toThrow('bad pixel');
  });
});
```

`tests/font.test.js`

```js
import { describe, it, expect } from 'vitest';
import { GLYPHS } from '../src/gfx/font.js';

const REQUIRED = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !?.,:;'\"-+/()%&#@*<>=_$^";

describe('GLYPHS', () => {
  it('has every required glyph as 8 rows of 8', () => {
    for (const ch of REQUIRED) {
      const g = GLYPHS[ch];
      expect(g, `glyph ${ch}`).toBeDefined();
      expect(g.length).toBe(8);
      for (const row of g) expect(row).toMatch(/^[.1]{8}$/);
    }
  });
});
```

(`^` is used as the "↑" arrow glyph, `<`/`>` as ←/→, `_` as ↓ — for control hints and the map.)

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/gfx/grid.js`

```js
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function gridToRGBA(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const data = new Uint8ClampedArray(w * h * 4);
  const cache = pal.map(hexToRgb);
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error('ragged grid');
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      const idx = parseInt(ch, 36) - 1;
      const rgb = cache[idx];
      if (!rgb || Number.isNaN(idx)) throw new Error(`bad pixel "${ch}"`);
      const o = (y * w + x) * 4;
      data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255;
    }
  }
  return { w, h, data };
}
```

`src/gfx/palette.js` — the 64-entry 2C02-style NES palette, plus names used across the game:

```js
export const NES = [
  '#7c7c7c','#0000fc','#0000bc','#4428bc','#940084','#a80020','#a81000','#881400','#503000','#007800','#006800','#005800','#004058','#000000','#000000','#000000',
  '#bcbcbc','#0078f8','#0058f8','#6844fc','#d800cc','#e40058','#f83800','#e45c10','#ac7c00','#00b800','#00a800','#00a844','#008888','#000000','#000000','#000000',
  '#f8f8f8','#3cbcfc','#6888fc','#9878f8','#f878f8','#f85898','#f87858','#fca044','#f8b800','#b8f818','#58d854','#58f898','#00e8d8','#787878','#000000','#000000',
  '#fcfcfc','#a4e4fc','#b8b8f8','#d8b8f8','#f8b8f8','#f8a4c0','#f0d0b0','#fce0a8','#f8d878','#d8f878','#b8f8b8','#b8f8d8','#00fcfc','#f8d8f8','#000000','#000000',
];
export const C = {
  black: NES[13], white: NES[48], grey: NES[0], lightGrey: NES[16], darkGrey: NES[45],
  red: NES[22], darkRed: NES[5], pink: NES[37], salmon: NES[38], skin: NES[54], orange: NES[39], brown: NES[8],
  yellow: NES[40], paleYellow: NES[56], green: NES[26], lime: NES[41], darkGreen: NES[10],
  blue: NES[18], navy: NES[2], sky: NES[33], cyan: NES[44], teal: NES[28], purple: NES[19], magenta: NES[20],
};
```

`src/gfx/textures.js`

```js
import { Texture, Sprite } from 'pixi.js';
import { gridToRGBA } from './grid.js';

const registry = new Map(); // name → Texture[]

export function textureFromGrid(rows, pal) {
  const { w, h, data } = gridToRGBA(rows, pal);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}

export function defineSprites(defs) {
  for (const [name, def] of Object.entries(defs)) {
    registry.set(name, def.frames.map((f) => textureFromGrid(f, def.pal)));
  }
}
export function hasSprite(name) { return registry.has(name); }
export function frames(name) {
  const f = registry.get(name);
  if (!f) throw new Error(`unknown sprite ${name}`);
  return f;
}
export const tex = (name, frame = 0) => frames(name)[frame % frames(name).length];
export function makeSprite(name, frame = 0) { const s = new Sprite(tex(name, frame)); s.roundPixels = true; return s; }
export function setFrame(sprite, name, frame = 0) { sprite.texture = tex(name, frame); }
// frame index for a looping animation: `ticks` frames per image
export const animFrame = (t, ticks, count) => Math.floor(t / ticks) % count;
```

`src/gfx/font.js` — define `GLYPHS` for every char in the test's REQUIRED string as 8 strings of 8 using `.`/`1`, in a chunky NES style (glyph body in the top 7 rows, 1 px right gap). Example of the required format (write all glyphs in this style):

```js
export const GLYPHS = {
  A: ['..111...', '.11.11..', '11...11.', '11...11.', '1111111.', '11...11.', '11...11.', '........'],
  B: ['111111..', '11...11.', '11...11.', '111111..', '11...11.', '11...11.', '111111..', '........'],
  ' ': ['........', '........', '........', '........', '........', '........', '........', '........'],
  // … every other required glyph, same shape …
};
```

Then the renderer part of the same file:

```js
import { Container, Sprite } from 'pixi.js';
import { textureFromGrid } from './textures.js';
import { C } from './palette.js';

const cache = new Map(); // `${ch}|${color}` → Texture
function glyphTex(ch, color) {
  const key = `${ch}|${color}`;
  if (!cache.has(key)) cache.set(key, textureFromGrid(GLYPHS[ch] ?? GLYPHS['?'], [color]));
  return cache.get(key);
}
export function measure(str) {
  const lines = String(str).split('\n');
  return { w: Math.max(...lines.map((l) => l.length)) * 8, h: lines.length * 8 };
}
export function makeText(str, color = C.white) {
  const c = new Container();
  String(str).toUpperCase().split('\n').forEach((line, row) => {
    [...line].forEach((ch, col) => {
      const s = new Sprite(glyphTex(ch, color));
      s.position.set(col * 8, row * 8); c.addChild(s);
    });
  });
  return c;
}
export function setText(container, str, color) {
  container.removeChildren().forEach((ch) => ch.destroy());
  const fresh = makeText(str, color);
  for (const ch of [...fresh.children]) container.addChild(ch);
}
```

- [ ] **Step 4: Run tests, expect PASS** — `npx vitest run tests/grid.test.js tests/font.test.js`.

- [ ] **Step 5: Visual check** — in `main.js` replace the TEMP rectangle with `root.addChild(makeText('MALL ACTION\nPRESS START 0123'))` positioned at (40,100). Browser: crisp readable text. Commit.

```bash
git add -A && git commit -m "feat: NES palette, pixel-grid textures, 8x8 font"
```

---

### Task 4: World data — mall layout, store rooms, level setup, reachability

**Files:**
- Create: `src/world/mallLevel.js`, `src/world/storeRooms.js`, `src/world/levelSetup.js`, `src/world/reachability.js`, `src/logic/loot.js`
- Test: `tests/world.test.js`, `tests/loot.test.js`

**Interfaces:**
- Consumes: `createRng` (Task 2), constants (Task 1).
- Produces (mallLevel): `SHAFT_W=24`, `SHAFTS`, `ESC_RUN=48`, `ESCALATORS`, `STORE_W=80`, `STORES`, `doorX(store)` (door centre x), `LIGHTS`, `KIOSKS`, `FOUNTAINS`, `PHOTO_BOOTH`, `GETAWAY_CAR`, `ROOF_ENTRY_X`, `JANITOR_FLOOR`, `WALKER_FLOOR`, `COP_FLOORS`, `FLOOR_ANNOUNCE`.
- Produces (storeRooms): `ROOM_COLS=16`, `ROOM_ROWS=11`, `TILE=16`, `TEMPLATES` (key → string[11]), `parseRoom(template) → Room`, `roomFor(store) → Room` (cached), where
  `Room = { cols, rows, tiles: string[][] /* 'wall'|'floor'|'door'|'solid'|'booth' */, fixtures: {col,row,kind:'F'|'R'|'T'}[], guards: {col,row,type:'spy'|'bot'}[], door:{col,row}[], oldMan:{col,row}|null, pedestal:{col,row}|null, booth:{col,row}|null, tvs:{col,row}[] }`
- Produces (loot): `SHOP_TABLE`, `FOOD_TABLE`, `weighted(rng, table)`, `rollPowerup(rng, {food})`, `rollFixture(rng, store, {blackFriday})`, `rollSpyDrop(rng)`
- Produces (levelSetup): `setupLevel(rng, {loop, blackFriday}) → { stores: { [id]: { role, fixtures: {type:'package'|'powerup'|'empty'|'trap', id?, searched:false}[] } } }` — fixture i corresponds to `roomFor(store).fixtures[i]`.
- Produces (reachability): `floorGraph() → Map<floor, Set<floor>>`, `reachableFloors(start=0) → Set<floor>`

- [ ] **Step 1: Failing tests** — `tests/world.test.js`

```js
import { describe, it, expect } from 'vitest';
import { STORES, SHAFTS, ESCALATORS, STORE_W, SHAFT_W, ESC_RUN, KIOSKS, doorX } from '../src/world/mallLevel.js';
import { TEMPLATES, parseRoom, roomFor, ROOM_COLS, ROOM_ROWS } from '../src/world/storeRooms.js';
import { setupLevel } from '../src/world/levelSetup.js';
import { reachableFloors } from '../src/world/reachability.js';
import { createRng } from '../src/core/rng.js';
import { MALL_W } from '../src/world/constants.js';

const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

describe('mall layout', () => {
  it('has 13 stores: 6 target, 4 powerup, 3 closed', () => {
    const count = (r) => STORES.filter((s) => s.role === r).length;
    expect(STORES).toHaveLength(13);
    expect([count('target'), count('powerup'), count('closed')]).toEqual([6, 4, 3]);
  });
  it('places stores on 4F..1F inside the mall without overlapping shafts, escalators or each other', () => {
    for (const s of STORES) {
      expect(s.floor).toBeGreaterThanOrEqual(1); expect(s.floor).toBeLessThanOrEqual(4);
      expect(s.x).toBeGreaterThanOrEqual(8); expect(s.x + STORE_W).toBeLessThanOrEqual(MALL_W - 8);
      for (const sh of SHAFTS) if (s.floor >= sh.minFloor && s.floor <= sh.maxFloor)
        expect(overlaps(s.x, s.x + STORE_W, sh.x, sh.x + SHAFT_W), `${s.id} vs shaft ${sh.id}`).toBe(false);
      for (const e of ESCALATORS) if (s.floor === e.bottomFloor || s.floor === e.topFloor)
        expect(overlaps(s.x, s.x + STORE_W, e.x - 8, e.x + ESC_RUN + 8), `${s.id} vs ${e.id}`).toBe(false);
      for (const o of STORES) if (o !== s && o.floor === s.floor)
        expect(overlaps(s.x, s.x + STORE_W, o.x, o.x + STORE_W)).toBe(false);
    }
  });
  it('every floor is reachable from the roof', () => {
    expect([...reachableFloors(0)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('has a kiosk on every shopping floor and door x at facade centre', () => {
    expect(KIOSKS.map((k) => k.floor).sort()).toEqual([1, 2, 3, 4]);
    expect(doorX(STORES[0])).toBe(STORES[0].x + 40);
  });
});

describe('store rooms', () => {
  it('every template is 16×11 with a 2-tile door on the bottom row and 1–3 guards', () => {
    for (const [key, t] of Object.entries(TEMPLATES)) {
      expect(t, key).toHaveLength(ROOM_ROWS);
      for (const row of t) expect(row, key).toHaveLength(ROOM_COLS);
      const room = parseRoom(t);
      expect(room.door.map((d) => d.row)).toEqual([10, 10]);
      expect(room.guards.length, key).toBeGreaterThanOrEqual(1);
      expect(room.guards.length, key).toBeLessThanOrEqual(3);
      expect(room.fixtures.length, key).toBeGreaterThanOrEqual(4);
    }
  });
  it('every open store has a room; special tiles exist where the spec needs them', () => {
    for (const s of STORES.filter((x) => x.role !== 'closed')) expect(roomFor(s).fixtures.length).toBeGreaterThan(0);
    expect(roomFor(STORES.find((s) => s.id === 'gamestonk')).oldMan).not.toBeNull();
    expect(roomFor(STORES.find((s) => s.id === 'gamestonk')).pedestal).not.toBeNull();
    expect(roomFor(STORES.find((s) => s.id === 'sambaddy')).booth).not.toBeNull();
    expect(roomFor(STORES.find((s) => s.id === 'forever12')).fixtures.some((f) => f.kind === 'R')).toBe(true);
    expect(roomFor(STORES.find((s) => s.id === 'kgbtoys')).fixtures.some((f) => f.kind === 'T')).toBe(true);
  });
});

describe('setupLevel', () => {
  it('puts exactly one package in each target store and none elsewhere', () => {
    for (let seed = 1; seed < 30; seed++) {
      const { stores } = setupLevel(createRng(seed), { loop: 1 });
      for (const s of STORES) {
        const pk = stores[s.id].fixtures.filter((f) => f.type === 'package').length;
        expect(pk, s.id).toBe(s.role === 'target' ? 1 : 0);
        expect(stores[s.id].fixtures).toHaveLength(s.role === 'closed' ? 0 : roomFor(s).fixtures.length);
      }
    }
  });
  it('power-up shops hold only power-ups or nothing', () => {
    const { stores } = setupLevel(createRng(3), { loop: 1 });
    for (const s of STORES.filter((x) => x.role === 'powerup'))
      for (const f of stores[s.id].fixtures) expect(['powerup', 'empty']).toContain(f.type);
  });
  it('black friday fills every non-package fixture with a power-up', () => {
    const { stores } = setupLevel(createRng(5), { loop: 1, blackFriday: true });
    for (const s of STORES.filter((x) => x.role !== 'closed'))
      for (const f of stores[s.id].fixtures) expect(['powerup', 'package']).toContain(f.type);
  });
});
```

`tests/loot.test.js`

```js
import { describe, it, expect } from 'vitest';
import { weighted, rollPowerup, rollSpyDrop, FOOD_TABLE } from '../src/logic/loot.js';
import { createRng } from '../src/core/rng.js';

describe('loot', () => {
  it('weighted never picks zero-weight entries and covers others', () => {
    const r = createRng(9); const seen = new Set();
    for (let i = 0; i < 2000; i++) seen.add(weighted(r, [['a', 1], ['b', 0], ['c', 3]]));
    expect([...seen].sort()).toEqual(['a', 'c']);
  });
  it('food rolls only return food', () => {
    const r = createRng(2); const food = FOOD_TABLE.map(([id]) => id);
    for (let i = 0; i < 200; i++) expect(food).toContain(rollPowerup(r, { food: true }));
  });
  it('spy drops happen roughly 5% of the time', () => {
    const r = createRng(11); let n = 0;
    for (let i = 0; i < 10000; i++) if (rollSpyDrop(r)) n++;
    expect(n).toBeGreaterThan(350); expect(n).toBeLessThan(650);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/world/mallLevel.js`

```js
export const SHAFT_W = 24;
export const SHAFTS = [
  { id: 'A', x: 112, minFloor: 0, maxFloor: 3, startFloor: 0, ai: false },
  { id: 'B', x: 376, minFloor: 1, maxFloor: 5, startFloor: 1, ai: false },
  { id: 'C', x: 632, minFloor: 0, maxFloor: 4, startFloor: 2, ai: true },
];

export const ESC_RUN = 48; // escalator rises 48 px over 48 px, rising to the right
export const ESCALATORS = [
  { id: 'E1', x: 280, bottomFloor: 2, topFloor: 1 }, // 3F (x=280) ↔ 4F (x=328)
  { id: 'E2', x: 480, bottomFloor: 4, topFloor: 3 }, // 1F (x=480) ↔ 2F (x=528)
];

export const STORE_W = 80;
export const STORES = [
  { id: 'forever12', name: 'FOREVER 12', floor: 1, x: 16, role: 'target', theme: 'fashion' },
  { id: 'radioshock', name: 'RADIOSHOCK', floor: 1, x: 176, role: 'target', theme: 'electronics' },
  { id: 'crookstone', name: 'CROOKSTONE', floor: 1, x: 416, role: 'powerup', theme: 'gadgets', layout: 'gadgetsA' },
  { id: 'gamestonk', name: 'GAMESTONK', floor: 1, x: 520, role: 'powerup', theme: 'games' },
  { id: 'kgbtoys', name: 'KGB TOYS', floor: 2, x: 16, role: 'target', theme: 'toys' },
  { id: 'blockbluster', name: 'BLOCKBLUSTER VIDEO', floor: 2, x: 480, role: 'closed', theme: null },
  { id: 'spenders', name: "SPENDER'S GIFTS", floor: 2, x: 672, role: 'powerup', theme: 'novelty' },
  { id: 'sambaddy', name: 'SAM BADDY', floor: 3, x: 16, role: 'target', theme: 'music' },
  { id: 'sharperimagine', name: 'SHARPER IMAGINE', floor: 3, x: 176, role: 'powerup', theme: 'gadgets', layout: 'gadgetsB' },
  { id: 'hotspy', name: 'HOT SPY ON A STICK', floor: 3, x: 544, role: 'target', theme: 'food' },
  { id: 'circuitpity', name: 'CIRCUIT PITY', floor: 3, x: 672, role: 'closed', theme: null },
  { id: 'footlockpicker', name: 'FOOT LOCKPICKER', floor: 4, x: 16, role: 'target', theme: 'sports' },
  { id: 'borderline', name: 'BORDERLINE BOOKS', floor: 4, x: 176, role: 'closed', theme: null },
];
export const doorX = (s) => s.x + STORE_W / 2;

// hanging lights (ceiling), one per ~screen on each shopping floor; 2F = disco balls
export const LIGHTS = [1, 2, 3, 4].flatMap((floor) =>
  [64, 304, 584].map((x) => ({ floor, x, kind: floor === 3 ? 'disco' : 'lamp' })));

export const KIOSKS = [{ floor: 1, x: 690 }, { floor: 2, x: 150 }, { floor: 3, x: 440 }, { floor: 4, x: 420 }];
export const FOUNTAINS = [{ floor: 2, x: 408, w: 48 }, { floor: 4, x: 272, w: 48 }];
export const PHOTO_BOOTH = { floor: 2, x: 200, w: 24 };
export const GETAWAY_CAR = { floor: 5, x: 680, w: 48 };
export const ROOF_ENTRY_X = 200;
export const JANITOR_FLOOR = 4;
export const WALKER_FLOOR = 3;
export const COP_FLOORS = [1, 2, 3, 4];
export const FLOOR_ANNOUNCE = [
  'R - ROOF. MIND THE HELICOPTER',
  "4F - FASHION & GADGETS, SPIES",
  "3F - TOYS & GIFTS, MORE SPIES",
  '2F - MUSIC & FOOD COURT',
  '1F - SPORTS. NO RUNNING',
  'P - PARKING. DRIVE SAFE',
];
```

(`FOUNTAINS` on 3F spans 408–456 and Blockbluster starts at 480 — no overlap; check the test catches any mistake.)

`src/world/reachability.js`

```js
import { SHAFTS, ESCALATORS } from './mallLevel.js';
import { FLOORS } from './constants.js';

export function floorGraph() {
  const g = new Map(Array.from({ length: FLOORS }, (_, i) => [i, new Set()]));
  const link = (a, b) => { g.get(a).add(b); g.get(b).add(a); };
  for (const s of SHAFTS) for (let f = s.minFloor; f < s.maxFloor; f++) link(f, f + 1);
  for (const e of ESCALATORS) link(e.bottomFloor, e.topFloor);
  return g;
}
export function reachableFloors(start = 0) {
  const g = floorGraph(); const seen = new Set([start]); const q = [start];
  while (q.length) for (const n of g.get(q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  return seen;
}
```

`src/world/storeRooms.js` — tile legend: `#` wall, `.` floor, `D` door, `F` searchable fixture, `R` fitting room (searchable), `T` toy shelf (searchable + shootable), `c` counter (solid), `V` demo TV (solid decor), `G` spy guard spawn (floor), `B` security bot spawn (floor), `L` listening booth (walkable), `O` old man spot (solid while present), `I` item pedestal (floor).

```js
export const ROOM_COLS = 16, ROOM_ROWS = 11, TILE = 16;

export const TEMPLATES = {
  fashion: [
    '################',
    '#R.R.R....F..F.#',
    '#..............#',
    '#.F..F.....G...#',
    '#..............#',
    '#....cccc......#',
    '#.F..........F.#',
    '#.....G........#',
    '#.F...........F#',
    '#..............#',
    '#######DD#######',
  ],
  electronics: [
    '################',
    '#VVV..F..F..VVV#',
    '#..............#',
    '#.cc.......cc..#',
    '#.F..........F.#',
    '#......G.......#',
    '#.F...cc.....F.#',
    '#..........B...#',
    '#..F........F..#',
    '#..............#',
    '#######DD#######',
  ],
  toys: [
    '################',
    '#T.T.T....T.T.T#',
    '#..............#',
    '#..............#',
    '#.F..cc..cc..F.#',
    '#.....G....G...#',
    '#..............#',
    '#.T..........T.#',
    '#......B.......#',
    '#..............#',
    '#######DD#######',
  ],
  food: [
    '################',
    '#cccccccccccccc#',
    '#F.F.F....F.F.F#',
    '#..............#',
    '#..............#',
    '#.cc...G....cc.#',
    '#.F..........F.#',
    '#..............#',
    '#..cc......cc..#',
    '#..............#',
    '#######DD#######',
  ],
  sports: [
    '################',
    '#FFFF......FFFF#',
    '#..............#',
    '#..G........G..#',
    '#..............#',
    '#....F.cc.F....#',
    '#..............#',
    '#.B............#',
    '#..F........F..#',
    '#..............#',
    '#######DD#######',
  ],
  music: [
    '################',
    '#F.F.F.F.....L.#',
    '#..............#',
    '#.cc.cc...G....#',
    '#..............#',
    '#.F........F...#',
    '#..............#',
    '#....cc..cc....#',
    '#..F........F..#',
    '#..............#',
    '#######DD#######',
  ],
  gadgetsA: [
    '################',
    '#..F...cc...F..#',
    '#..............#',
    '#.F....G.....F.#',
    '#..............#',
    '#....F....F....#',
    '#..............#',
    '#..cc......cc..#',
    '#..............#',
    '#..............#',
    '#######DD#######',
  ],
  gadgetsB: [
    '################',
    '#F............F#',
    '#..cc......cc..#',
    '#..............#',
    '#......F.......#',
    '#..F.......F...#',
    '#.....B........#',
    '#..............#',
    '#.F..........F.#',
    '#..............#',
    '#######DD#######',
  ],
  novelty: [
    '################',
    '#F..F..cc..F..F#',
    '#..............#',
    '#..............#',
    '#.F....G.....F.#',
    '#..............#',
    '#...cc....cc...#',
    '#..............#',
    '#.F..........F.#',
    '#..............#',
    '#######DD#######',
  ],
  games: [
    '################',
    '#FF..V.O.V...FF#',
    '#..............#',
    '#......I.......#',
    '#..............#',
    '#.F..........F.#',
    '#.....G........#',
    '#..cc......cc..#',
    '#.F..........F.#',
    '#..............#',
    '#######DD#######',
  ],
};

const TILE_OF = { '#': 'wall', '.': 'floor', D: 'door', F: 'solid', R: 'solid', T: 'solid', c: 'solid', V: 'solid', G: 'floor', B: 'floor', L: 'booth', O: 'solid', I: 'floor' };

export function parseRoom(template) {
  const room = { cols: template[0].length, rows: template.length, tiles: [], fixtures: [], guards: [], door: [], oldMan: null, pedestal: null, booth: null, tvs: [] };
  template.forEach((line, row) => {
    room.tiles.push([...line].map((ch, col) => {
      if (!(ch in TILE_OF)) throw new Error(`bad room tile "${ch}"`);
      if (ch === 'F' || ch === 'R' || ch === 'T') room.fixtures.push({ col, row, kind: ch });
      if (ch === 'G') room.guards.push({ col, row, type: 'spy' });
      if (ch === 'B') room.guards.push({ col, row, type: 'bot' });
      if (ch === 'D') room.door.push({ col, row });
      if (ch === 'O') room.oldMan = { col, row };
      if (ch === 'I') room.pedestal = { col, row };
      if (ch === 'L') room.booth = { col, row };
      if (ch === 'V') room.tvs.push({ col, row });
      return TILE_OF[ch];
    }));
  });
  return room;
}

const cache = new Map();
export function roomFor(store) {
  const key = store.layout ?? store.theme;
  if (!cache.has(key)) cache.set(key, parseRoom(TEMPLATES[key]));
  return cache.get(key);
}
```

`src/logic/loot.js`

```js
export const SHOP_TABLE = [['rapid', 3], ['spread', 3], ['armor', 2], ['sneakers', 2], ['radar', 1], ['oneup', 0.5]];
export const FOOD_TABLE = [['cinnabomb', 2], ['juliooze', 3], ['pretzel', 3]];

export function weighted(rng, table) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [id, w] of table) { if (w > 0 && r < w) return id; r -= w; }
  return table.filter(([, w]) => w > 0).at(-1)[0];
}
export const rollPowerup = (rng, { food = false } = {}) => weighted(rng, food ? FOOD_TABLE : SHOP_TABLE);

export function rollFixture(rng, store, { blackFriday = false } = {}) {
  const food = store.theme === 'food';
  if (blackFriday) return { type: 'powerup', id: rollPowerup(rng, { food }) };
  const r = rng.next();
  if (store.role === 'powerup') return r < 0.6 ? { type: 'powerup', id: rollPowerup(rng) } : { type: 'empty' };
  if (r < 0.25) return { type: 'powerup', id: rollPowerup(rng, { food: food || rng.chance(0.2) }) };
  if (r < 0.45) return { type: 'trap' };
  return { type: 'empty' };
}

export function rollSpyDrop(rng) {
  if (!rng.chance(0.05)) return null;
  return rollPowerup(rng, { food: rng.chance(0.5) });
}
```

`src/world/levelSetup.js`

```js
import { STORES } from './mallLevel.js';
import { roomFor } from './storeRooms.js';
import { rollFixture } from '../logic/loot.js';

export function setupLevel(rng, { loop = 1, blackFriday = false } = {}) {
  const stores = {};
  for (const s of STORES) {
    if (s.role === 'closed') { stores[s.id] = { role: 'closed', fixtures: [] }; continue; }
    const n = roomFor(s).fixtures.length;
    const pkg = s.role === 'target' ? rng.int(0, n - 1) : -1;
    const fixtures = [];
    for (let i = 0; i < n; i++) {
      const c = i === pkg ? { type: 'package' } : rollFixture(rng, s, { blackFriday });
      fixtures.push({ ...c, searched: false });
    }
    stores[s.id] = { role: s.role, fixtures };
  }
  return { loop, stores };
}
```

- [ ] **Step 4: Run tests, expect PASS** — `npx vitest run`. If a template row-length assertion fails, fix the template row (keep the layout's intent).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: mall layout, store room templates, level setup and loot"`

---

### Task 5: Physics and elevators (pure)

**Files:**
- Create: `src/logic/physics.js`, `src/logic/elevator.js`
- Test: `tests/physics.test.js`, `tests/elevator.test.js`

**Interfaces:**
- Consumes: constants, `SHAFTS`, `SHAFT_W`.
- Mall entity shape (used by every mall entity from here on): `{ x /*centre*/, y /*feet*/, w, h, vx, vy, facing: -1|1, floor: number|null, grounded: bool, riding: carId|null, onRoof: carId|null, fallFromY: number|null }`
- Produces (physics): `GRAVITY=0.25`, `MAX_FALL_V=4`, `MAX_SAFE_FALL=48`, `aabb(a,b)`, `rectOf(e)`, `stepAir(e)`, `supportedAt(x, floor, cars) → bool`, `findLanding(x, prevY, y, cars) → { y, floor: number|null, roof: carId|null } | null`, `moveInRoom(box, dx, dy, isSolidAt(px,py)) → { hitX, hitY }` (box `{x,y,w,h}` top-left, float coords).
- Produces (elevator): `CAR_SPEED=1`, `CAR_H=40`, `createCar(shaft)`, `carFloor(car) → number|null`, `inShaftX(car, x)`, `doorwayState(car, floor) → 'none'|'car'|'solid'|'pit'`, `updateCar(car, cmd:-1|0|1) → { dy, stopped: number|null }`, `aiCommand(car, rng) → -1|0|1`, `crushVictims(car, dy, entities) → entity[]`, `carAtX(cars, x) → car|null`.

Rules (spec §4.3, made concrete): at floor f, a shaft's doorway is **car** if the car is aligned at f (walk in), **solid** if the car is above f (a grate you can stand on — and be crushed on), **pit** if the car is below f (you fall onto the roof). Falls longer than 48 px (measured from the feet y where the entity left the ground, stored in `fallFromY`) kill. A car descending onto someone standing on a solid doorway crushes them; a roof rider is crushed when the car rises into the top of its shaft.

- [ ] **Step 1: Failing tests**

`tests/elevator.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createCar, carFloor, updateCar, doorwayState, crushVictims, aiCommand, CAR_H } from '../src/logic/elevator.js';
import { feetY } from '../src/world/constants.js';
import { createRng } from '../src/core/rng.js';

const shaft = { id: 'T', x: 100, minFloor: 1, maxFloor: 4, startFloor: 2, ai: false };

describe('car movement', () => {
  it('starts aligned at startFloor', () => {
    const c = createCar(shaft); expect(carFloor(c)).toBe(2);
  });
  it('moves 1 px per frame while commanded', () => {
    const c = createCar(shaft); const r = updateCar(c, 1);
    expect(r.dy).toBe(1); expect(carFloor(c)).toBeNull();
  });
  it('glides to the next floor after release and stops once', () => {
    const c = createCar(shaft);
    for (let i = 0; i < 10; i++) updateCar(c, 1);
    const stops = [];
    for (let i = 0; i < 60; i++) { const r = updateCar(c, 0); if (r.stopped !== null) stops.push(r.stopped); }
    expect(c.y).toBe(feetY(3)); expect(stops).toEqual([3]);
  });
  it('does not stop at intermediate floors while held, and clamps at the end once', () => {
    const c = createCar(shaft); const stops = [];
    for (let i = 0; i < 200; i++) { const r = updateCar(c, 1); if (r.stopped !== null) stops.push(r.stopped); }
    expect(c.y).toBe(feetY(4)); expect(stops).toEqual([4]);
  });
  it('AI car picks another floor, travels, waits', () => {
    const c = createCar({ ...shaft, ai: true }); const rng = createRng(3); const stops = [];
    for (let i = 0; i < 600; i++) { const r = updateCar(c, aiCommand(c, rng)); if (r.stopped !== null) stops.push(r.stopped); }
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[0]).not.toBe(2);
  });
});

describe('doorways', () => {
  it('reports car / solid / pit / none', () => {
    const c = createCar(shaft); // at floor 2
    expect(doorwayState(c, 2)).toBe('car');
    expect(doorwayState(c, 3)).toBe('solid'); // car above floor 3
    expect(doorwayState(c, 1)).toBe('pit');   // car below floor 1
    expect(doorwayState(c, 0)).toBe('none');  // shaft doesn't reach
  });
});

describe('crush', () => {
  const ent = (o) => ({ x: 112, y: feetY(3), w: 12, h: 24, riding: null, onRoof: null, ...o });
  it('descending car crushes someone standing in the doorway below', () => {
    const c = createCar(shaft); const victim = ent();
    let hit = [];
    for (let i = 0; i < 48 && !hit.length; i++) { const { dy } = updateCar(c, 1); hit = crushVictims(c, dy, [victim]); }
    expect(hit).toEqual([victim]);
    expect(c.y).toBeLessThan(feetY(3));
  });
  it('does not crush passengers or people outside the shaft', () => {
    const c = createCar(shaft);
    const rider = ent({ y: c.y, riding: 'T' }); const outside = ent({ x: 140 });
    for (let i = 0; i < 48; i++) { const { dy } = updateCar(c, 1); expect(crushVictims(c, dy, [rider, outside])).toEqual([]); rider.y = c.y; }
  });
  it('roof rider is crushed near the top of the shaft', () => {
    const c = createCar({ ...shaft, startFloor: 2 });
    const rider = ent({ y: c.y - CAR_H, onRoof: 'T' });
    let hit = [];
    for (let i = 0; i < 48 && !hit.length; i++) { const { dy } = updateCar(c, -1); rider.y = c.y - CAR_H; hit = crushVictims(c, dy, [rider]); }
    expect(hit).toEqual([rider]);
  });
});
```

`tests/physics.test.js`

```js
import { describe, it, expect } from 'vitest';
import { aabb, stepAir, findLanding, supportedAt, moveInRoom, MAX_SAFE_FALL } from '../src/logic/physics.js';
import { createCar, CAR_H } from '../src/logic/elevator.js';
import { feetY } from '../src/world/constants.js';

const shaft = { id: 'T', x: 100, minFloor: 1, maxFloor: 4, startFloor: 3, ai: false };

describe('aabb', () => {
  it('detects overlap, not touching edges', () => {
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });
});

describe('jump arc', () => {
  it('JUMP -3.2 peaks about 20 px up', () => {
    const e = { x: 0, y: 100, vx: 0, vy: -3.2 }; let top = 100;
    for (let i = 0; i < 30; i++) { stepAir(e); top = Math.min(top, e.y); }
    expect(100 - top).toBeGreaterThanOrEqual(18); expect(100 - top).toBeLessThanOrEqual(22);
  });
});

describe('support and landing', () => {
  it('pit doorway is unsupported, plain floor is supported', () => {
    const c = createCar(shaft); // car at floor 3 → floor 2 doorway is a pit
    expect(supportedAt(112, 2, [c])).toBe(false);
    expect(supportedAt(50, 2, [c])).toBe(true);
    expect(supportedAt(112, 3, [c])).toBe(true); // inside car
  });
  it('falling through a pit lands on the roof of the car below', () => {
    const c = createCar(shaft);
    const land = findLanding(112, feetY(2), feetY(2) + 20, [c]);
    expect(land).toEqual({ y: c.y - CAR_H, floor: null, roof: 'T' });
  });
  it('falling past a floor line on plain floor lands on that floor', () => {
    expect(findLanding(50, feetY(2) - 5, feetY(2) + 3, [])).toEqual({ y: feetY(2), floor: 2, roof: null });
  });
  it('fall distance: car one floor down is safe (8 px), two floors down is fatal (56 px)', () => {
    expect(feetY(3) - CAR_H - feetY(2)).toBe(8);
    expect(feetY(3) - CAR_H - feetY(2)).toBeLessThanOrEqual(MAX_SAFE_FALL);
    expect(feetY(4) - CAR_H - feetY(2)).toBeGreaterThan(MAX_SAFE_FALL);
  });
});

describe('moveInRoom', () => {
  const solid = (px, py) => px < 16 || py < 16; // wall at left/top
  it('moves freely and stops at walls per axis', () => {
    const b = { x: 20, y: 20, w: 12, h: 12 };
    const r = moveInRoom(b, -5, 0, solid);
    expect(b.x).toBe(20 - 4); expect(r.hitX).toBe(true);
    moveInRoom(b, 0, 2, solid); expect(b.y).toBe(22);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/logic/elevator.js`

```js
import { feetY } from '../world/constants.js';
import { SHAFT_W } from '../world/mallLevel.js';

export const CAR_SPEED = 1;
export const CAR_H = 40;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createCar(shaft) {
  return { id: shaft.id, x: shaft.x, w: SHAFT_W, minFloor: shaft.minFloor, maxFloor: shaft.maxFloor, y: feetY(shaft.startFloor), dir: 0, ai: shaft.ai, target: null, aiTimer: 120 };
}
export function carFloor(car) {
  for (let f = car.minFloor; f <= car.maxFloor; f++) if (car.y === feetY(f)) return f;
  return null;
}
export const inShaftX = (car, x) => x >= car.x && x < car.x + car.w;
export const carAtX = (cars, x) => cars.find((c) => inShaftX(c, x)) ?? null;

export function doorwayState(car, floor) {
  if (floor < car.minFloor || floor > car.maxFloor) return 'none';
  const fy = feetY(floor);
  if (car.y === fy) return 'car';
  return car.y < fy ? 'solid' : 'pit';
}

export function updateCar(car, cmd) {
  const top = feetY(car.minFloor), bottom = feetY(car.maxFloor);
  const prevY = car.y, wasMoving = car.dir !== 0;
  if (cmd !== 0) car.dir = cmd;
  else if (carFloor(car) !== null) car.dir = 0;
  car.y = clamp(car.y + car.dir * CAR_SPEED, top, bottom);
  if ((car.y === top && car.dir < 0) || (car.y === bottom && car.dir > 0)) car.dir = 0;
  const f = carFloor(car);
  const stopped = wasMoving && car.dir === 0 && f !== null ? f : null;
  return { dy: car.y - prevY, stopped };
}

export function aiCommand(car, rng) {
  if (car.target == null) {
    if (car.aiTimer > 0) { car.aiTimer--; return 0; }
    const here = carFloor(car);
    let t; do { t = rng.int(car.minFloor, car.maxFloor); } while (t === here);
    car.target = t;
  }
  const ty = feetY(car.target);
  if (car.y === ty) { car.target = null; car.aiTimer = 120; return 0; }
  return car.y < ty ? 1 : -1;
}

export function crushVictims(car, dy, entities) {
  if (dy === 0) return [];
  const top = feetY(car.minFloor);
  return entities.filter((e) => {
    if (!inShaftX(car, e.x) || e.riding === car.id) return false;
    if (dy > 0) return e.onRoof !== car.id && e.y > car.y && car.y + 8 > e.y - e.h;
    return e.onRoof === car.id && car.y < top + 24;
  });
}
```

`src/logic/physics.js`

```js
import { feetY, FLOORS } from '../world/constants.js';
import { doorwayState, inShaftX, CAR_H } from './elevator.js';

export const GRAVITY = 0.25;
export const MAX_FALL_V = 4;
export const MAX_SAFE_FALL = 48;

export const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const rectOf = (e) => ({ x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h });

export function stepAir(e) {
  e.vy = Math.min(e.vy + GRAVITY, MAX_FALL_V);
  e.y += e.vy; e.x += e.vx;
}

export function supportedAt(x, floor, cars) {
  for (const c of cars) if (inShaftX(c, x) && doorwayState(c, floor) === 'pit') return false;
  return true;
}

// Entity feet moved from prevY down to y this frame; return the first surface crossed.
export function findLanding(x, prevY, y, cars) {
  let best = null;
  for (const c of cars) {
    if (!inShaftX(c, x)) continue;
    const roof = c.y - CAR_H;
    if (prevY <= roof && y >= roof) best = { y: roof, floor: null, roof: c.id };
  }
  for (let f = 0; f < FLOORS; f++) {
    const fy = feetY(f);
    if (prevY <= fy && y >= fy && supportedAt(x, f, cars) && (!best || fy < best.y)) best = { y: fy, floor: f, roof: null };
  }
  return best;
}

export function moveInRoom(box, dx, dy, isSolidAt) {
  const blocked = (b) => {
    const pts = [[b.x, b.y], [b.x + b.w - 1, b.y], [b.x, b.y + b.h - 1], [b.x + b.w - 1, b.y + b.h - 1]];
    return pts.some(([px, py]) => isSolidAt(Math.floor(px), Math.floor(py)));
  };
  let hitX = false, hitY = false;
  const stepAxis = (axis, d) => {
    const s = Math.sign(d); let rem = Math.abs(d);
    while (rem > 0) {
      const inc = Math.min(1, rem) * s;
      box[axis] += inc;
      if (blocked(box)) { box[axis] -= inc; return true; }
      rem -= Math.abs(inc);
    }
    return false;
  };
  if (dx) hitX = stepAxis('x', dx);
  if (dy) hitY = stepAxis('y', dy);
  return { hitX, hitY };
}
```

Note: in the `moveInRoom` test the box starts at x=20, and `solid` is `px < 16`, so it can move to x=16 (4 px) then blocks — `b.x === 16`.

- [ ] **Step 4: Run tests, expect PASS.** If the roof-crush or crush-timing test fails, fix the logic, not the test — the tests encode spec §4.3.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: mall physics and elevator logic with crush rules"`

---

### Task 6: Rules, power-ups, game state (pure)

**Files:**
- Create: `src/logic/rules.js`, `src/logic/powerups.js`, `src/game/state.js`
- Test: `tests/rules.test.js`, `tests/powerups.test.js`, `tests/state.test.js`

**Interfaces:**
- Produces (rules): `TARGET_COUNT=6`, `START_LIVES=3`, `EXTRA_LIFE_AT=20000`, `SCORES`, `addScore(state, key) → {pts, extraLife}`, `addPoints(state, n) → {pts, extraLife}`, `packagesLeft(state)`, `canExit(state)`, `difficulty(loop, {blackFriday, alarm}) → {spySpeed, spawnInterval, fireInterval, alarmAt, spyCap}`, `isAlarm(levelFrames, loop)`, `timeBonus(levelFrames)`.
- Produces (powerups): `POWERUPS` (id → `{slot, frames?, label}`), `createPowerState()`, `applyPowerup(ps, id) → {extraLife}`, `tickPowerups(ps)`, `resolveHit(ps) → 'ignored'|'absorbed'|'dead'`, `walkSpeed(ps)`, `jumpVelocity(ps)`, `searchFrames(ps)`, `fireCooldown(ps)`, `maxBullets(ps)`, `resetOnDeath(ps)`, `activeLabel(ps) → {label, frac}|null` (for HUD).
- Produces (state): `createGameState({seed, blackFriday, highScore})`, `nextLoop(state)`, `loseLife(state) → livesLeft`.
  `GameState = { rng, seed, score, lives, loop, packages:Set<storeId>, cleared:Set<storeId>, power, levelFrames, extraLifeGiven, inventory:string[], gameStonkDone, photoTaken, blackFriday, highScore, setup }`

- [ ] **Step 1: Failing tests**

`tests/rules.test.js`

```js
import { describe, it, expect } from 'vitest';
import { addScore, addPoints, canExit, packagesLeft, difficulty, isAlarm, timeBonus, SCORES } from '../src/logic/rules.js';

const st = () => ({ score: 0, lives: 3, extraLifeGiven: false, packages: new Set() });

describe('scoring', () => {
  it('adds spec scores and never goes below zero', () => {
    const s = st(); addScore(s, 'spyShot'); expect(s.score).toBe(100);
    addScore(s, 'detained'); expect(s.score).toBe(0);
    expect(SCORES).toMatchObject({ spyCrushed: 300, spyLight: 300, package: 500, powerup: 50, levelClear: 1000, coin: 50, slideKill: 300, discoKill: 300, walkerShot: -200, detained: -500, jokeItem: 1 });
  });
  it('awards exactly one extra life at 20 000', () => {
    const s = st(); s.score = 19950;
    expect(addScore(s, 'powerup').extraLife).toBe(true); expect(s.lives).toBe(4);
    s.score = 39990; expect(addPoints(s, 50).extraLife).toBe(false); expect(s.lives).toBe(4);
  });
});

describe('exit rule', () => {
  it('needs all 6 packages', () => {
    const s = st(); ['a', 'b', 'c', 'd', 'e'].forEach((p) => s.packages.add(p));
    expect(canExit(s)).toBe(false); expect(packagesLeft(s)).toBe(1);
    s.packages.add('f'); expect(canExit(s)).toBe(true);
  });
});

describe('difficulty', () => {
  it('loop 1 base values', () => {
    expect(difficulty(1)).toEqual({ spySpeed: 0.75, spawnInterval: 240, fireInterval: 90, alarmAt: 9000, spyCap: 4 });
  });
  it('scales per loop with caps', () => {
    const d2 = difficulty(2);
    expect(d2.spySpeed).toBeCloseTo(0.825); expect(d2.spawnInterval).toBe(204); expect(d2.fireInterval).toBe(78); expect(d2.alarmAt).toBe(130 * 60);
    const d20 = difficulty(20);
    expect(d20.spySpeed).toBe(1.5); expect(d20.spawnInterval).toBe(90); expect(d20.fireInterval).toBe(40); expect(d20.alarmAt).toBe(3600);
  });
  it('alarm and black friday modifiers', () => {
    const a = difficulty(1, { alarm: true });
    expect(a.spySpeed).toBeCloseTo(0.9375); expect(a.spawnInterval).toBe(168);
    const bf = difficulty(1, { blackFriday: true });
    expect(bf.spyCap).toBe(8); expect(bf.spawnInterval).toBe(120);
  });
  it('alarm triggers at alarmAt and time bonus decays', () => {
    expect(isAlarm(8999, 1)).toBe(false); expect(isAlarm(9000, 1)).toBe(true);
    expect(timeBonus(0)).toBe(3000); expect(timeBonus(60 * 100)).toBe(2000); expect(timeBonus(60 * 400)).toBe(0);
  });
});
```

`tests/powerups.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createPowerState, applyPowerup, tickPowerups, resolveHit, walkSpeed, jumpVelocity, searchFrames, fireCooldown, maxBullets, resetOnDeath, activeLabel } from '../src/logic/powerups.js';

describe('power-ups', () => {
  it('weapons replace each other and expire', () => {
    const p = createPowerState();
    applyPowerup(p, 'rapid'); expect(fireCooldown(p)).toBe(8); expect(maxBullets(p)).toBe(4);
    applyPowerup(p, 'spread'); expect(p.weapon).toBe('spread'); expect(fireCooldown(p)).toBe(16);
    for (let i = 0; i < 1200; i++) tickPowerups(p);
    expect(p.weapon).toBeNull(); expect(maxBullets(p)).toBe(2);
  });
  it('sneakers and juli-ooze share the speed slot; only sneakers boosts jump & search', () => {
    const p = createPowerState();
    applyPowerup(p, 'juliooze'); expect(walkSpeed(p)).toBe(1.5); expect(jumpVelocity(p)).toBe(-3.2); expect(searchFrames(p)).toBe(45);
    applyPowerup(p, 'sneakers'); expect(p.speed).toBe('sneakers'); expect(jumpVelocity(p)).toBe(-3.6); expect(searchFrames(p)).toBe(24);
  });
  it('armor and pretzel absorb one hit; cinnabomb ignores hits', () => {
    const p = createPowerState();
    applyPowerup(p, 'pretzel'); expect(resolveHit(p)).toBe('absorbed'); expect(resolveHit(p)).toBe('dead');
    applyPowerup(p, 'cinnabomb'); applyPowerup(p, 'armor');
    expect(resolveHit(p)).toBe('ignored'); expect(p.armor).toBe('armor');
  });
  it('stacks armor + speed + radar with a weapon', () => {
    const p = createPowerState();
    ['spread', 'armor', 'sneakers', 'radar'].forEach((id) => applyPowerup(p, id));
    expect(p).toMatchObject({ weapon: 'spread', armor: 'armor', speed: 'sneakers', radar: true });
  });
  it('1-up reports an extra life', () => {
    expect(applyPowerup(createPowerState(), 'oneup').extraLife).toBe(1);
  });
  it('death clears everything except radar', () => {
    const p = createPowerState(); ['rapid', 'armor', 'sneakers', 'radar'].forEach((id) => applyPowerup(p, id));
    resetOnDeath(p);
    expect(p).toMatchObject({ weapon: null, armor: null, speed: null, radar: true, invincibleT: 0 });
  });
  it('activeLabel shows the timed power-up with remaining fraction', () => {
    const p = createPowerState(); applyPowerup(p, 'rapid'); for (let i = 0; i < 600; i++) tickPowerups(p);
    expect(activeLabel(p)).toEqual({ label: 'RAPID', frac: 0.5 });
  });
});
```

`tests/state.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createGameState, nextLoop, loseLife } from '../src/game/state.js';

describe('game state', () => {
  it('starts with 3 lives, loop 1, fresh setup', () => {
    const s = createGameState({ seed: 1 });
    expect(s).toMatchObject({ score: 0, lives: 3, loop: 1, blackFriday: false });
    expect(Object.keys(s.setup.stores)).toHaveLength(13);
  });
  it('nextLoop resets packages, clears radar, re-rolls setup and keeps score', () => {
    const s = createGameState({ seed: 1 }); s.score = 5000; s.packages.add('x'); s.cleared.add('x'); s.power.radar = true; s.levelFrames = 99;
    nextLoop(s);
    expect(s).toMatchObject({ loop: 2, score: 5000, levelFrames: 0 });
    expect(s.packages.size).toBe(0); expect(s.cleared.size).toBe(0); expect(s.power.radar).toBe(false);
    expect(s.setup.loop).toBe(2);
  });
  it('loseLife decrements and resets power-ups', () => {
    const s = createGameState({ seed: 1 }); s.power.weapon = 'rapid';
    expect(loseLife(s)).toBe(2); expect(s.power.weapon).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/logic/rules.js`

```js
export const TARGET_COUNT = 6;
export const START_LIVES = 3;
export const EXTRA_LIFE_AT = 20000;
export const SCORES = {
  spyShot: 100, spyCrushed: 300, spyLight: 300, package: 500, powerup: 50, levelClear: 1000,
  coin: 50, slideKill: 300, discoKill: 300, walkerShot: -200, detained: -500, jokeItem: 1,
};

export function addPoints(state, pts) {
  state.score = Math.max(0, state.score + pts);
  if (!state.extraLifeGiven && state.score >= EXTRA_LIFE_AT) { state.extraLifeGiven = true; state.lives++; return { pts, extraLife: true }; }
  return { pts, extraLife: false };
}
export const addScore = (state, key) => addPoints(state, SCORES[key]);
export const packagesLeft = (state) => TARGET_COUNT - state.packages.size;
export const canExit = (state) => packagesLeft(state) === 0;

export function difficulty(loop, { blackFriday = false, alarm = false } = {}) {
  const n = loop - 1;
  let spySpeed = Math.min(0.75 * 1.1 ** n, 1.5);
  let spawnInterval = Math.max(90, Math.round(240 * 0.85 ** n));
  const fireInterval = Math.max(40, Math.round(90 / 1.15 ** n));
  const alarmAt = Math.max(60 * 60, (150 - 20 * n) * 60);
  let spyCap = 4;
  if (blackFriday) { spyCap = 8; spawnInterval = Math.round(spawnInterval / 2); }
  if (alarm) { spySpeed *= 1.25; spawnInterval = Math.round(spawnInterval * 0.7); }
  return { spySpeed, spawnInterval, fireInterval, alarmAt, spyCap };
}
export const isAlarm = (levelFrames, loop) => levelFrames >= difficulty(loop).alarmAt;
export const timeBonus = (levelFrames) => Math.max(0, 300 - Math.floor(levelFrames / 60)) * 10;
```

(Check: loop 2 → 240·0.85 = 204; 90/1.15 = 78.26 → 78. Alarm loop 1: 240·0.7 = 168.)

`src/logic/powerups.js`

```js
export const POWERUPS = {
  rapid: { slot: 'weapon', frames: 1200, label: 'RAPID' },
  spread: { slot: 'weapon', frames: 1200, label: 'SPREAD' },
  armor: { slot: 'armor', label: 'VEST' },
  pretzel: { slot: 'armor', label: 'PRETZEL' },
  sneakers: { slot: 'speed', frames: 1200, label: 'SNEAKERS' },
  juliooze: { slot: 'speed', frames: 720, label: 'JULI-OOZE' },
  radar: { slot: 'radar', label: 'RADAR' },
  oneup: { slot: 'instant', label: '1UP' },
  cinnabomb: { slot: 'invincible', frames: 360, label: 'CINNABOMB' },
};

export const createPowerState = () => ({ weapon: null, weaponT: 0, armor: null, speed: null, speedT: 0, radar: false, invincibleT: 0 });

export function applyPowerup(ps, id) {
  const p = POWERUPS[id];
  switch (p.slot) {
    case 'weapon': ps.weapon = id; ps.weaponT = p.frames; break;
    case 'armor': ps.armor = id; break;
    case 'speed': ps.speed = id; ps.speedT = p.frames; break;
    case 'radar': ps.radar = true; break;
    case 'invincible': ps.invincibleT = p.frames; break;
    case 'instant': return { extraLife: 1 };
  }
  return { extraLife: 0 };
}

export function tickPowerups(ps) {
  if (ps.weaponT > 0 && --ps.weaponT === 0) ps.weapon = null;
  if (ps.speedT > 0 && --ps.speedT === 0) ps.speed = null;
  if (ps.invincibleT > 0) ps.invincibleT--;
}

export function resolveHit(ps) {
  if (ps.invincibleT > 0) return 'ignored';
  if (ps.armor) { ps.armor = null; return 'absorbed'; }
  return 'dead';
}

export const walkSpeed = (ps) => (ps.speed ? 1.5 : 1);
export const jumpVelocity = (ps) => (ps.speed === 'sneakers' ? -3.6 : -3.2);
export const searchFrames = (ps) => (ps.speed === 'sneakers' ? 24 : 45);
export const fireCooldown = (ps) => (ps.weapon === 'rapid' ? 8 : 16);
export const maxBullets = (ps) => (ps.weapon === 'rapid' ? 4 : ps.weapon === 'spread' ? 6 : 2);

export function resetOnDeath(ps) {
  Object.assign(ps, { weapon: null, weaponT: 0, armor: null, speed: null, speedT: 0, invincibleT: 0 });
}

export function activeLabel(ps) {
  if (ps.invincibleT > 0) return { label: POWERUPS.cinnabomb.label, frac: ps.invincibleT / POWERUPS.cinnabomb.frames };
  if (ps.weapon) return { label: POWERUPS[ps.weapon].label, frac: ps.weaponT / POWERUPS[ps.weapon].frames };
  if (ps.speed) return { label: POWERUPS[ps.speed].label, frac: ps.speedT / POWERUPS[ps.speed].frames };
  return null;
}
```

`src/game/state.js`

```js
import { createRng } from '../core/rng.js';
import { setupLevel } from '../world/levelSetup.js';
import { createPowerState, resetOnDeath } from '../logic/powerups.js';
import { START_LIVES } from '../logic/rules.js';

export function createGameState({ seed = Date.now() >>> 0, blackFriday = false, highScore = 0 } = {}) {
  const rng = createRng(seed);
  return {
    rng, seed, score: 0, lives: START_LIVES, loop: 1,
    packages: new Set(), cleared: new Set(), power: createPowerState(),
    levelFrames: 0, extraLifeGiven: false, inventory: [], gameStonkDone: false, photoTaken: false,
    blackFriday, highScore, setup: setupLevel(rng, { loop: 1, blackFriday }),
  };
}

export function nextLoop(state) {
  state.loop++;
  state.packages.clear(); state.cleared.clear();
  state.levelFrames = 0; state.power.radar = false;
  state.setup = setupLevel(state.rng, { loop: state.loop, blackFriday: state.blackFriday });
}

export function loseLife(state) {
  state.lives--;
  resetOnDeath(state.power);
  return state.lives;
}
```

- [ ] **Step 4: Run tests, expect PASS.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: scoring, difficulty, power-ups and game state"`

---

### Task 7: NPC rules and secrets (pure)

**Files:**
- Create: `src/logic/npcs.js`, `src/logic/secrets.js`
- Test: `tests/npcs.test.js`, `tests/secrets.test.js`

**Interfaces:**
- Consumes: `feetY`, `WALL_L/WALL_R`, `STORES`, `doorX`, `aabb`, `rectOf`.
- Produces (npcs): `WET_FRAMES=600`, `WET_W=48`, `COP_RANGE=128`, `COP_CHASE_FRAMES=600`, `DETAIN_FRAMES=180`, `createWetPatch(x, floor)`, `tickWet(patches) → patches`, `onWet(patches, e)`, `slideStep(patches, e, speed) → bool` (sets `e.vx`, `e.slideDir`), `createCop(floor, x)`, `copSeesShot(cop, shooter)`, `startChase(cop)`, `stepCop(cop, player, walk)`, `copCatches(cop, player)`, `createWalker(floor, x, dir)`, `stepWalker(w, lo, hi)`, `walkerBlocking(walkers, bulletRect, floor) → walker|null`, `nearestTarget(player, cleared) → store|null`.
- Produces (secrets): `KONAMI`, `createKonami() → { push(btn) → bool }`, `JOKE_ITEMS`, `pickJokeItem(rng)`.

- [ ] **Step 1: Failing tests**

`tests/npcs.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createWetPatch, tickWet, slideStep, createCop, copSeesShot, startChase, stepCop, copCatches, createWalker, stepWalker, walkerBlocking, nearestTarget, WET_FRAMES } from '../src/logic/npcs.js';
import { feetY } from '../src/world/constants.js';

describe('wet floor', () => {
  it('expires after WET_FRAMES', () => {
    let ps = [createWetPatch(100, 4)];
    for (let i = 0; i < WET_FRAMES - 1; i++) ps = tickWet(ps);
    expect(ps).toHaveLength(1); ps = tickWet(ps); expect(ps).toHaveLength(0);
  });
  it('locks slide direction on entry and releases when off the patch', () => {
    const ps = [createWetPatch(100, 4)];
    const e = { x: 101, floor: 4, grounded: true, facing: 1, vx: 0, slideDir: 0 };
    expect(slideStep(ps, e, 1)).toBe(true); expect(e.vx).toBe(1);
    e.facing = -1; slideStep(ps, e, 1); expect(e.vx).toBe(1); // can't turn
    e.x = 160; expect(slideStep(ps, e, 1)).toBe(false); expect(e.slideDir).toBe(0);
  });
  it('airborne entities do not slide', () => {
    const e = { x: 101, floor: 4, grounded: false, facing: 1, vx: 0, slideDir: 0 };
    expect(slideStep([createWetPatch(100, 4)], e, 1)).toBe(false);
  });
});

describe('mall cop', () => {
  it('notices shots in front within range on same floor only', () => {
    const cop = createCop(2, 300); cop.facing = 1;
    expect(copSeesShot(cop, { x: 400, floor: 2 })).toBe(true);
    expect(copSeesShot(cop, { x: 200, floor: 2 })).toBe(false); // behind
    expect(copSeesShot(cop, { x: 500, floor: 2 })).toBe(false); // too far
    expect(copSeesShot(cop, { x: 350, floor: 3 })).toBe(false); // other floor
  });
  it('chases at 1.25× for 600 frames and catches on contact', () => {
    const cop = createCop(2, 300); startChase(cop);
    const player = { x: 350, floor: 2 };
    stepCop(cop, player, 1); expect(cop.x).toBeCloseTo(301.25);
    cop.x = 345; expect(copCatches(cop, player)).toBe(true);
    for (let i = 0; i < 600; i++) stepCop(cop, { x: 700, floor: 3 }, 1);
    expect(cop.state).toBe('patrol'); expect(copCatches(cop, player)).toBe(false);
  });
});

describe('mall walkers', () => {
  it('reverse at bounds', () => {
    const w = createWalker(3, 99, 1);
    for (let i = 0; i < 5; i++) stepWalker(w, 20, 100);
    expect(w.facing).toBe(-1);
  });
  it('block bullets on their floor', () => {
    const w = createWalker(3, 200, 1);
    expect(walkerBlocking([w], { x: 198, y: feetY(3) - 16, w: 4, h: 2 }, 3)).toBe(w);
    expect(walkerBlocking([w], { x: 198, y: feetY(3) - 16, w: 4, h: 2 }, 2)).toBeNull();
  });
});

describe('kiosk', () => {
  it('points to the nearest uncleared target, preferring same floor', () => {
    expect(nearestTarget({ x: 700, floor: 1 }, new Set()).id).toBe('radioshock');
    expect(nearestTarget({ x: 700, floor: 1 }, new Set(['radioshock', 'forever12'])).floor).not.toBe(1);
    const all = new Set(['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlockpicker']);
    expect(nearestTarget({ x: 0, floor: 1 }, all)).toBeNull();
  });
});
```

`tests/secrets.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createKonami, KONAMI, JOKE_ITEMS, pickJokeItem } from '../src/logic/secrets.js';
import { createRng } from '../src/core/rng.js';

const feed = (k, seq) => seq.map((b) => k.push(b)).some(Boolean);

describe('konami', () => {
  it('detects the exact code', () => expect(feed(createKonami(), KONAMI)).toBe(true));
  it('detects the code after extra leading ups', () => expect(feed(createKonami(), ['up', ...KONAMI])).toBe(true));
  it('detects after garbage', () => expect(feed(createKonami(), ['a', 'left', 'up', 'b', ...KONAMI])).toBe(true));
  it('rejects a wrong sequence', () => expect(feed(createKonami(), ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'a', 'b'])).toBe(false));
});

describe('joke items', () => {
  it('has the five spec items and picks one of them', () => {
    expect(JOKE_ITEMS).toEqual(['EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)']);
    expect(JOKE_ITEMS).toContain(pickJokeItem(createRng(1)));
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/logic/npcs.js`

```js
import { feetY, WALL_L, WALL_R } from '../world/constants.js';
import { STORES, doorX } from '../world/mallLevel.js';
import { aabb, rectOf } from './physics.js';

export const WET_FRAMES = 600, WET_W = 48;
export const COP_RANGE = 128, COP_CHASE_FRAMES = 600, DETAIN_FRAMES = 180;

export const createWetPatch = (x, floor) => ({ x0: x, x1: x + WET_W, floor, t: WET_FRAMES });
export const tickWet = (patches) => patches.filter((p) => --p.t > 0);
export const onWet = (patches, e) => patches.some((p) => p.floor === e.floor && e.x >= p.x0 && e.x < p.x1);

export function slideStep(patches, e, speed) {
  if (!e.grounded || !onWet(patches, e)) { e.slideDir = 0; return false; }
  if (!e.slideDir) e.slideDir = e.facing;
  e.vx = e.slideDir * speed;
  return true;
}

export const createCop = (floor, x) => ({ x, y: feetY(floor), floor, w: 14, h: 24, facing: 1, state: 'patrol', t: 0 });
export function copSeesShot(cop, shooter) {
  const dx = shooter.x - cop.x;
  return cop.state === 'patrol' && shooter.floor === cop.floor && Math.abs(dx) <= COP_RANGE && (dx === 0 || Math.sign(dx) === cop.facing);
}
export function startChase(cop) { cop.state = 'chase'; cop.t = COP_CHASE_FRAMES; }
export function stepCop(cop, player, walk = 1) {
  if (cop.state === 'chase') {
    if (--cop.t <= 0) { cop.state = 'patrol'; return; }
    if (player.floor === cop.floor) { cop.facing = player.x < cop.x ? -1 : 1; cop.x += cop.facing * walk * 1.25; }
    return;
  }
  cop.x += cop.facing * 0.5;
  if (cop.x < WALL_L + 8 || cop.x > WALL_R - 8) { cop.facing *= -1; cop.x = Math.min(WALL_R - 8, Math.max(WALL_L + 8, cop.x)); }
}
export const copCatches = (cop, player) => cop.state === 'chase' && player.floor === cop.floor && Math.abs(player.x - cop.x) < 10;

export const createWalker = (floor, x, dir) => ({ x, y: feetY(floor), floor, w: 12, h: 22, facing: dir, heyT: 0 });
export function stepWalker(w, lo, hi) {
  w.x += w.facing * 0.6;
  if (w.x <= lo || w.x >= hi) { w.facing *= -1; w.x = Math.min(hi, Math.max(lo, w.x)); }
  if (w.heyT > 0) w.heyT--;
}
export const walkerBlocking = (walkers, bulletRect, floor) =>
  walkers.find((w) => w.floor === floor && aabb(rectOf(w), bulletRect)) ?? null;

export function nearestTarget(player, cleared) {
  let best = null, bestCost = Infinity;
  for (const s of STORES) {
    if (s.role !== 'target' || cleared.has(s.id)) continue;
    const cost = Math.abs(s.floor - player.floor) * 400 + Math.abs(doorX(s) - player.x);
    if (cost < bestCost) { bestCost = cost; best = s; }
  }
  return best;
}
```

`src/logic/secrets.js`

```js
export const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

export function createKonami() {
  let i = 0;
  return {
    push(btn) {
      if (btn === KONAMI[i]) {
        i++;
        if (i === KONAMI.length) { i = 0; return true; }
      } else if (btn === 'up') {
        i = i === 2 ? 2 : 1; // "up up up" keeps the "up up" prefix
      } else {
        i = 0;
      }
      return false;
    },
  };
}

export const JOKE_ITEMS = ['EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)'];
export const pickJokeItem = (rng) => rng.pick(JOKE_ITEMS);
```

- [ ] **Step 4: Run all tests, expect PASS** — `npm test`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: NPC rules (wet floor, mall cop, walkers, kiosk) and secrets"`

---

### Task 8: Audio — note parsing (pure), NES-style synth, music & SFX

**Files:**
- Create: `src/audio/notes.js`, `src/audio/synth.js`, `src/audio/music.js`, `src/audio/sfx.js`
- Modify: `src/main.js` (create synth, unlock on first input, `M` hotkey)
- Test: `tests/notes.test.js`, `tests/music.test.js`

**Interfaces:**
- Produces (notes): `noteToFreq('A4') → 440`, `parseTrack(str) → {note:string|null, freq:number|null, len:number}[]` — tokens separated by whitespace, `NOTE[:len]`, `NOTE` = `C4`, `F#3`, `-` (rest), or for noise `x` (hat) / `X` (snare) / `K` (kick); `len` in 16th-note steps (default 1); `|` tokens are bar lines and ignored.
- Produces (music): `TRACKS = { [name]: { bpm, loop: bool, p1, p2, tri, noise } }` (channel strings in parseTrack format). Required names: `title, mall, mallAlarm, store, muzak, booth, levelClear, gameOver, itemGet`.
- Produces (sfx): `SFX = { [name]: (ctx, out, t, lib) => void }`. Required names: `shot, enemyShot, jump, ding, hum, crush, lightFall, glass, searchTick, package, powerup, hurt, death, door, blip, whistle, ping, coin, slide, paChime, smoke, shriek, buzzer, pause`.
- Produces (synth): `createSynth() → { unlock(), playMusic(name), stopMusic(), musicName, sfx(name), toggleMute(), muted, duck(on:boolean) }` — every method is a safe no-op if WebAudio is unavailable.

- [ ] **Step 1: Failing tests**

`tests/notes.test.js`

```js
import { describe, it, expect } from 'vitest';
import { noteToFreq, parseTrack } from '../src/audio/notes.js';

describe('notes', () => {
  it('converts notes to frequencies', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440); expect(noteToFreq('C5')).toBeCloseTo(523.25, 1); expect(noteToFreq('F#3')).toBeCloseTo(185.0, 1);
    expect(noteToFreq('-')).toBeNull();
  });
  it('parses lengths, rests, noise hits and bar lines', () => {
    expect(parseTrack('C4:2 - | x E4')).toEqual([
      { note: 'C4', freq: noteToFreq('C4'), len: 2 }, { note: null, freq: null, len: 1 },
      { note: 'x', freq: null, len: 1 }, { note: 'E4', freq: noteToFreq('E4'), len: 1 },
    ]);
  });
  it('rejects malformed tokens', () => expect(() => parseTrack('H4')).toThrow('bad token'));
});
```

`tests/music.test.js`

```js
import { describe, it, expect } from 'vitest';
import { TRACKS } from '../src/audio/music.js';
import { parseTrack } from '../src/audio/notes.js';

const REQUIRED = ['title', 'mall', 'mallAlarm', 'store', 'muzak', 'booth', 'levelClear', 'gameOver', 'itemGet'];
const steps = (s) => parseTrack(s ?? '').reduce((n, t) => n + t.len, 0);

describe('TRACKS', () => {
  it('defines every required track with equal-length channels', () => {
    for (const name of REQUIRED) {
      const t = TRACKS[name]; expect(t, name).toBeDefined();
      const lens = ['p1', 'p2', 'tri', 'noise'].map((c) => steps(t[c])).filter((n) => n > 0);
      expect(new Set(lens).size, `${name} channel lengths ${lens}`).toBe(1);
    }
  });
  it('loops the level music but not jingles', () => {
    expect(TRACKS.mall.loop).toBe(true); expect(TRACKS.levelClear.loop).toBe(false); expect(TRACKS.itemGet.loop).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/audio/notes.js`

```js
const SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export function noteToFreq(n) {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return null;
  const midi = (Number(m[2]) + 1) * 12 + SEMI[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}
export function parseTrack(str) {
  const out = [];
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [name, lenStr] = tok.split(':');
    const len = lenStr ? Number(lenStr) : 1;
    if (!(len > 0)) throw new Error(`bad token ${tok}`);
    if (name === '-') out.push({ note: null, freq: null, len });
    else if (name === 'x' || name === 'X' || name === 'K') out.push({ note: name, freq: null, len });
    else { const f = noteToFreq(name); if (f === null) throw new Error(`bad token ${tok}`); out.push({ note: name, freq: f, len }); }
  }
  return out;
}
```

`src/audio/synth.js`

```js
import { parseTrack } from './notes.js';
import { TRACKS } from './music.js';
import { SFX } from './sfx.js';

function pulseWave(ctx, duty) {
  const n = 64, real = new Float32Array(n), imag = new Float32Array(n);
  for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}
function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function createSynth() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  const noop = { unlock() {}, playMusic() {}, stopMusic() {}, sfx() {}, toggleMute() {}, duck() {}, muted: false, musicName: null };
  if (!AC) return noop;
  let ctx;
  try { ctx = new AC(); } catch { return noop; }

  const master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  const musicBus = ctx.createGain(); musicBus.connect(master);
  const sfxBus = ctx.createGain(); sfxBus.connect(master);
  const lib = { pulse12: pulseWave(ctx, 0.125), pulse25: pulseWave(ctx, 0.25), pulse50: pulseWave(ctx, 0.5), noise: noiseBuffer(ctx) };

  function tone(wave, freq, t, dur, vol, out = musicBus) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (wave === 'triangle') o.type = 'triangle'; else o.setPeriodicWave(lib[wave]);
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  function hit(kind, t, out = musicBus) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = lib.noise; f.type = kind === 'K' ? 'lowpass' : 'highpass'; f.frequency.value = kind === 'K' ? 200 : kind === 'X' ? 1500 : 7000;
    const dur = kind === 'x' ? 0.04 : 0.12;
    g.gain.setValueAtTime(kind === 'x' ? 0.15 : 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur);
  }

  let song = null, timer = null;
  const CH = { p1: ['pulse25', 0.12], p2: ['pulse12', 0.08], tri: ['triangle', 0.25] };

  function schedule() {
    if (!song) return;
    const stepDur = 60 / song.track.bpm / 4;
    for (const ch of song.channels) {
      while (ch.next < ctx.currentTime + 0.15) {
        if (ch.i >= ch.notes.length) {
          if (!song.track.loop) { ch.done = true; break; }
          ch.i = 0;
        }
        const n = ch.notes[ch.i++]; const dur = n.len * stepDur;
        if (ch.name === 'noise') { if (n.note) hit(n.note, ch.next); }
        else if (n.freq) tone(CH[ch.name][0], n.freq, ch.next, dur * 0.95, CH[ch.name][1]);
        ch.next += dur;
      }
    }
    if (song.channels.every((c) => c.done)) stopMusic();
  }

  function playMusic(name) {
    if (song?.name === name) return;
    stopMusic();
    const track = TRACKS[name]; if (!track) return;
    const t0 = ctx.currentTime + 0.05;
    const channels = ['p1', 'p2', 'tri', 'noise'].filter((c) => track[c]).map((c) => ({ name: c, notes: parseTrack(track[c]), i: 0, next: t0, done: false }));
    song = { name, track, channels };
    api.musicName = name;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
    timer = setInterval(schedule, 25); schedule();
  }
  function stopMusic() { clearInterval(timer); timer = null; song = null; api.musicName = null; }

  const api = {
    muted: false, musicName: null,
    unlock() { if (ctx.state === 'suspended') ctx.resume(); },
    playMusic, stopMusic,
    sfx(name) { const f = SFX[name]; if (f && ctx.state === 'running') f(ctx, sfxBus, ctx.currentTime, { ...lib, tone: (w, fr, t, d, v) => tone(w, fr, t, d, v, sfxBus), hit: (k, t) => hit(k, t, sfxBus) }); },
    toggleMute() { api.muted = !api.muted; master.gain.value = api.muted ? 0 : 0.35; },
    duck(on) { musicBus.gain.setTargetAtTime(on ? 0.25 : 1, ctx.currentTime, 0.05); },
  };
  return api;
}
```

`src/audio/sfx.js` — each entry schedules short sounds via `lib.tone(wave, freq, t, dur, vol)` / `lib.hit(kind, t)` or raw nodes for sweeps. Implement every required name; reference shapes:

```js
function sweep(ctx, out, t, wave, lib, f0, f1, dur, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (wave === 'triangle') o.type = 'triangle'; else o.setPeriodicWave(lib[wave]);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
export const SFX = {
  shot: (ctx, out, t, lib) => { sweep(ctx, out, t, 'pulse50', lib, 1200, 200, 0.08, 0.2); lib.hit('x', t); },
  enemyShot: (ctx, out, t, lib) => sweep(ctx, out, t, 'pulse25', lib, 700, 150, 0.1, 0.15),
  jump: (ctx, out, t, lib) => sweep(ctx, out, t, 'pulse25', lib, 250, 700, 0.12, 0.15),
  ding: (ctx, out, t, lib) => { lib.tone('triangle', 1318.5, t, 0.5, 0.3); lib.tone('pulse12', 1318.5, t, 0.08, 0.05); },
  hum: (ctx, out, t, lib) => lib.tone('triangle', 55, t, 0.14, 0.08),
  blip: (ctx, out, t, lib) => lib.tone('pulse50', 880, t, 0.025, 0.08),
  coin: (ctx, out, t, lib) => { lib.tone('pulse25', 987.8, t, 0.06, 0.15); lib.tone('pulse25', 1318.5, t + 0.06, 0.2, 0.15); },
  paChime: (ctx, out, t, lib) => ['E5', 'C5', 'G4', 'C5'].forEach((n, i) => lib.tone('triangle', { E5: 659.3, C5: 523.3, G4: 392 }[n], t + i * 0.35, 0.5, 0.3)),
  // … crush (noise K + low sweep), lightFall (descending sweep + glass), glass (noise x burst ×3), searchTick, package
  //   (rising arpeggio C5-E5-G5-C6), powerup (fast up-sweep ×3), hurt, death (long descending sweep), door, whistle
  //   (pulse12 2.5 kHz trill 0.3 s), ping (1.8 kHz pulse12 0.05 s), slide (noise highpass 0.3 s), smoke (noise lowpass),
  //   shriek (pulse12 sweep 1.5→2.5 kHz), buzzer (pulse50 110 Hz 0.3 s), pause (two blips)
};
```
(Write out every "…" entry fully — no stubs.)

`src/audio/music.js` — compose original chiptunes in the parseTrack format, 16th-note steps. Style targets: `mall` = upbeat minor-key spy groove (A minor, 150 bpm, 8+ bars, walking triangle bass, pulse lead); `mallAlarm` = same melody transposed up a semitone at 175 bpm with a pulse siren figure in p2; `muzak` = the mall melody re-harmonised in A major at 90 bpm, triangle only + soft p2 pads (elevator muzak); `store` = tense 4-bar loop in D minor, 130 bpm; `booth` = a bouncy 80s pop loop (C major, 140 bpm); `title` = heroic 8-bar theme; `levelClear` 2-bar fanfare (no loop); `gameOver` 2-bar sad descending (no loop); `itemGet` = 1-bar ascending jingle in the spirit of an item-get fanfare but original notes (no loop). Every channel in a track must have the same total step count (the test enforces it). Example structure:

```js
export const TRACKS = {
  levelClear: {
    bpm: 150, loop: false,
    p1: 'C5:2 E5:2 G5:2 C6:6 | G5:2 C6:14',
    p2: 'E4:2 G4:2 C5:2 E5:6 | E5:2 G5:14',
    tri: 'C3:4 G3:4 C4:4 | C3:16',
    noise: 'X:4 x:4 X:4 | K:16',
  },
  // … all other required tracks …
};
```

- [ ] **Step 4: Run tests, expect PASS.**

- [ ] **Step 5: Wire into main.js** — `const audio = createSynth();` on `window` `keydown`/`pointerdown` (once) call `audio.unlock()`; `input.onHotkey('KeyM', () => audio.toggleMute())`. Temporarily call `audio.playMusic('mall')` on first keypress and listen in the browser: all four channels audible, loops seamlessly. Remove the temporary call.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: WebAudio NES-style synth with music and sfx"`

---

### Task 9: Scene manager, HUD, Title scene (with Black Friday), debug hook

**Files:**
- Create: `src/core/scenes.js`, `src/ui/hud.js`, `src/scenes/TitleScene.js`
- Modify: `src/main.js`
- Test: `tests/scenes.test.js`

**Interfaces:**
- Scene contract (every scene/overlay): `{ container: Container, enter(ctx, params), update(ctx), exit(ctx) }`.
- `ctx = { scenes: SceneManager, pad: Pad, input, audio, state: GameState|null, konami, debug: bool, seed: number|null }`.
- Produces: `FADE_FRAMES = 12`, `class SceneManager({ layer, overlayLayer, setFade(alpha) }, ctx)` with `replace(scene, params)`, `push(overlay, params)`, `pop()`, `update()`, getters `scene`, `overlays`, `fading`.
- Produces: `createHud() → { container, update(state, { floorLabel, marquee, alarm, frame }) }` — 16 px strip.
- Produces: `class TitleScene` — Start → new game → `ctx.scenes.replace(new MallScene(), { newLevel: true })` (MallScene exists from Task 13; until then, replace with a placeholder scene that shows "MALL" text).

- [ ] **Step 1: Failing test** — `tests/scenes.test.js`

```js
import { describe, it, expect } from 'vitest';
import { SceneManager, FADE_FRAMES } from '../src/core/scenes.js';

const layer = () => ({ kids: [], addChild(c) { this.kids.push(c); }, removeChild(c) { this.kids = this.kids.filter((k) => k !== c); } });
const scene = (log, name) => ({ container: { name }, enter: () => log.push(`enter ${name}`), exit: () => log.push(`exit ${name}`), update: () => log.push(`update ${name}`) });

describe('SceneManager', () => {
  it('replace fades out, swaps at the midpoint, fades in, and suppresses updates meanwhile', () => {
    const log = []; let alpha = 0;
    const m = new SceneManager({ layer: layer(), overlayLayer: layer(), setFade: (a) => { alpha = a; } }, {});
    m.replace(scene(log, 'A'), {}, { fade: false });
    expect(log).toEqual(['enter A']);
    m.replace(scene(log, 'B'));
    for (let i = 0; i < FADE_FRAMES; i++) m.update();
    expect(log).toEqual(['enter A', 'exit A', 'enter B']); expect(alpha).toBe(1);
    for (let i = 0; i < FADE_FRAMES; i++) m.update();
    expect(alpha).toBe(0); expect(m.fading).toBe(false);
    m.update(); expect(log.at(-1)).toBe('update B');
  });
  it('overlays receive updates instead of the scene until popped', () => {
    const log = [];
    const m = new SceneManager({ layer: layer(), overlayLayer: layer(), setFade() {} }, {});
    m.replace(scene(log, 'A'), {}, { fade: false });
    m.push(scene(log, 'Map')); m.update();
    expect(log.at(-1)).toBe('update Map');
    m.pop(); m.update();
    expect(log.slice(-2)).toEqual(['exit Map', 'update A']);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/core/scenes.js`

```js
export const FADE_FRAMES = 12;

export class SceneManager {
  constructor({ layer, overlayLayer, setFade }, ctx) {
    Object.assign(this, { layer, overlayLayer, setFade, ctx });
    this.scene = null; this.overlays = []; this.pending = null; this.fadeT = 0; this.fadeDir = 0;
  }
  get fading() { return this.fadeDir !== 0; }
  _swap() {
    const { scene, params } = this.pending; this.pending = null;
    if (this.scene) { this.scene.exit(this.ctx); this.layer.removeChild(this.scene.container); }
    this.scene = scene; this.layer.addChild(scene.container); scene.enter(this.ctx, params);
  }
  replace(scene, params = {}, { fade = true } = {}) {
    while (this.overlays.length) this.pop();
    this.pending = { scene, params };
    if (!fade) { this._swap(); return; }
    this.fadeDir = 1; this.fadeT = 0;
  }
  push(overlay, params = {}) { this.overlays.push(overlay); this.overlayLayer.addChild(overlay.container); overlay.enter(this.ctx, params); }
  pop() { const o = this.overlays.pop(); if (!o) return; o.exit(this.ctx); this.overlayLayer.removeChild(o.container); }
  update() {
    if (this.fadeDir === 1) {
      this.fadeT++; this.setFade(this.fadeT / FADE_FRAMES);
      if (this.fadeT >= FADE_FRAMES) { this._swap(); this.fadeDir = -1; }
      return;
    }
    if (this.fadeDir === -1) {
      this.fadeT--; this.setFade(this.fadeT / FADE_FRAMES);
      if (this.fadeT <= 0) this.fadeDir = 0;
      return;
    }
    (this.overlays.at(-1) ?? this.scene)?.update(this.ctx);
  }
}
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: HUD** `src/ui/hud.js` — black 256×16 strip. Row y=0: `SCORE` + 6-digit zero-padded score at x=0; `PKG n/6` at x=112 (red while n<6, green when 6/6). Row y=8: agent-head icon (8×8 sprite `hudLife`, Task 10) + `x3` at x=0; active power-up label (from `activeLabel(state.power)`, max 9 chars) at x=40 with a 40×3 px bar under-row timer at x=120 (width `40*frac`); armor/radar small icons at x=164/174 when active; `ALARM` blinking red (on 16 frames / off 16) at x=176 on row 0 when `alarm`. **Elevator panel** at x=208..255: grey 1-px frame, black inside, red LED text centred: `floorLabel` (`R`, `4F`…`P`); when `marquee` is set (store name), scroll it right-to-left 1 px every 2 frames inside the 46 px window (use a mask). Build text once and only rebuild when a value changes.

- [ ] **Step 6: Title scene** `src/scenes/TitleScene.js`
  - Sky-blue gradient bands (3 NES blues), a scrolling mall facade row along the bottom (reuse storefront sprites from Task 11 when available; before then, coloured rectangles) scrolling 0.5 px/frame.
  - Logo: `MALL ACTION` drawn with `makeText` at 2× scale (`scale.set(2)`), white with a 1 px red drop shadow copy offset (1,1), centred at y=40. Subtitle `A SHOPPING MALL ESPIONAGE` at y=64.
  - `PRESS START` blinking (32 on / 16 off) at y=150; controls hint at y=176: `^_<> MOVE  Z SHOOT  X JUMP`, y=186: `SHIFT MAP  ENTER PAUSE  C CRT`; `HI 012345` at y=210; `© 2026 MALL ACTION` at y=226.
  - Each frame: `for (const b of ctx.pad.pressedList()) if (ctx.konami.push(b)) { this.blackFriday = true; ctx.audio.sfx('powerup'); }`. When `blackFriday`, show `BLACK FRIDAY!` flashing red/yellow at y=100 and `70% OFF EVERYTHING` at y=112.
  - On `pad.pressed('start')` (and not just completing the code with 'a'): `ctx.state = createGameState({ seed: ctx.seed ?? undefined, blackFriday: this.blackFriday, highScore: ctx.highScore })`; `ctx.scenes.replace(new MallScene(), { newLevel: true })`.
  - Plays `title` music on enter.

- [ ] **Step 7: Wire main.js** — root gets three child containers `sceneLayer`, `overlayLayer`, `fadeLayer` (a 256×240 black `Graphics` with alpha controlled by `setFade`). Build `ctx` (with `konami: createKonami()`, `highScore: 0`, `debug`, `seed` from `new URLSearchParams(location.search)`: `?debug=1`, `?seed=123`). Fixed update: `input.poll(); scenes.update();`. Start with `scenes.replace(new TitleScene(), {}, { fade: false })`. If `debug`, set `window.__mall = ctx`. Remove the TEMP text.

- [ ] **Step 8: Verify in browser** — Title shows, music plays after first key, `↑↑↓↓←→←→XZ` shows BLACK FRIDAY, Enter fades to the placeholder. `npm test` passes. Commit.

```bash
git add -A && git commit -m "feat: scene manager with fades, HUD, title screen with Black Friday code"
```

---

### Task 10: Character & item sprites + sprite gallery

**Files:**
- Create: `src/gfx/sprites/characters.js`, `src/gfx/sprites/items.js`, `src/gfx/sprites/index.js`, `src/scenes/GalleryScene.js`
- Modify: `src/main.js` (`?gallery=1` opens GalleryScene instead of Title; call `registerAllSprites()` at boot)
- Test: `tests/sprites.test.js`

**Interfaces:**
- Each sprite module exports a plain-data `DEFS` object `{ name: { pal: string[≤3], frames: string[][] } }` (no Pixi import) so tests can validate it.
- `src/gfx/sprites/index.js` exports `ALL_DEFS` (merged) and `registerAllSprites()` (calls `defineSprites(ALL_DEFS)`).
- Required character names (mall sprites 16×24, top-down 16×16):
  - Agent mall: `agentStand, agentWalk (2 frames), agentDuck, agentJump, agentKick, agentShoot, agentDuckShoot, agentDie (3 frames), agentZip` (hanging from zipline).
  - Agent top-down: `agentTopDown, agentTopUp, agentTopSide` (each 2 frames, side faces right), `agentTopHold` (holding item overhead, 1 frame).
  - Spy mall (black suit, hat, sunglasses — Elevator Action look): `spyStand, spyWalk (2), spyDuck, spyAimHigh, spyAimLow, spyDie (3)`; top-down `spyTopDown, spyTopUp, spyTopSide` (2 each); `spyChanging` (fitting-room surprise, 2 frames, 16×16).
  - `bot` (security bot, 16×16, 2 frames), `janitorWalk (2), janitorMop (2)`, `walker (2)` (tracksuit retiree), `copSegway (2)`, `oldMan` (16×16, 1 frame, robed clerk), `windupToy (2, 8×8)`.
  - `hudLife` (8×8 agent head).
- Required item names (16×16 unless noted): `package` (brown box with red tape), `pu_rapid, pu_spread, pu_armor, pu_sneakers, pu_radar, pu_oneup, pu_cinnabomb, pu_juliooze, pu_pretzel`, `coin (4 frames, 8×8), coinGold (4 frames, 8×8)`, `bullet (4×2)`, `enemyBullet (4×2)`, `shoe (8×8, 2 frames)`, `smoke (3 frames)`, `sparkle (3 frames, 8×8)`, `nothingPuff (2 frames)`, `joke_coupon, joke_guide, joke_rock, joke_ring, joke_share`, `photoStrip (8×24)`, `bang` (exclamation "!" marker 8×8).

- [ ] **Step 1: Failing test** — `tests/sprites.test.js`

```js
import { describe, it, expect } from 'vitest';
import { ALL_DEFS } from '../src/gfx/sprites/index.js';
import { gridToRGBA } from '../src/gfx/grid.js';

const REQUIRED = {
  agentStand: [16, 24, 1], agentWalk: [16, 24, 2], agentDuck: [16, 24, 1], agentJump: [16, 24, 1], agentKick: [16, 24, 1],
  agentShoot: [16, 24, 1], agentDuckShoot: [16, 24, 1], agentDie: [16, 24, 3], agentZip: [16, 24, 1],
  agentTopDown: [16, 16, 2], agentTopUp: [16, 16, 2], agentTopSide: [16, 16, 2], agentTopHold: [16, 16, 1],
  spyStand: [16, 24, 1], spyWalk: [16, 24, 2], spyDuck: [16, 24, 1], spyAimHigh: [16, 24, 1], spyAimLow: [16, 24, 1], spyDie: [16, 24, 3],
  spyTopDown: [16, 16, 2], spyTopUp: [16, 16, 2], spyTopSide: [16, 16, 2], spyChanging: [16, 16, 2],
  bot: [16, 16, 2], janitorWalk: [16, 24, 2], janitorMop: [16, 24, 2], walker: [16, 24, 2], copSegway: [16, 24, 2],
  oldMan: [16, 16, 1], windupToy: [8, 8, 2], hudLife: [8, 8, 1],
  package: [16, 16, 1], pu_rapid: [16, 16, 1], pu_spread: [16, 16, 1], pu_armor: [16, 16, 1], pu_sneakers: [16, 16, 1],
  pu_radar: [16, 16, 1], pu_oneup: [16, 16, 1], pu_cinnabomb: [16, 16, 1], pu_juliooze: [16, 16, 1], pu_pretzel: [16, 16, 1],
  coin: [8, 8, 4], coinGold: [8, 8, 4], bullet: [4, 2, 1], enemyBullet: [4, 2, 1], shoe: [8, 8, 2], smoke: [16, 16, 3],
  sparkle: [8, 8, 3], nothingPuff: [16, 16, 2], joke_coupon: [16, 16, 1], joke_guide: [16, 16, 1], joke_rock: [16, 16, 1],
  joke_ring: [16, 16, 1], joke_share: [16, 16, 1], photoStrip: [8, 24, 1], bang: [8, 8, 1],
};

describe('character & item sprites', () => {
  for (const [name, [w, h, n]] of Object.entries(REQUIRED)) {
    it(`${name} is ${w}×${h} with ${n} frame(s) and ≤3 colours`, () => {
      const d = ALL_DEFS[name]; expect(d, name).toBeDefined();
      expect(d.pal.length).toBeLessThanOrEqual(3); expect(d.frames).toHaveLength(n);
      for (const f of d.frames) { const r = gridToRGBA(f, d.pal); expect([r.w, r.h]).toEqual([w, h]); }
    });
  }
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Author the sprites** — pixel grids using `.`, `1`, `2`, `3`. Art direction: SMB3/Zelda-quality readability — 1 px dark outline (slot 1 is usually the darkest colour), strong silhouettes, 2–3 frame walk cycles. Agent: red/white trench-coat agent with dark hair (`[C.black, C.red, C.skin]`). Spies: black suit & fedora with white shirt stripe and sunglasses (`[C.black, C.darkGrey, C.white]`). Keep feet on the bottom row of each mall frame (sprite anchor is bottom-centre). Food icons must read as food (cinnamon roll swirl, orange cup with straw, pretzel knot). Example format (agentStand, first rows):

```js
import { C } from '../palette.js';
export const DEFS = {
  agentStand: { pal: [C.black, C.red, C.skin], frames: [[
    '.....1111.......',
    '....111111......',
    '....133331......',
    // … 24 rows total, 16 chars each …
  ]] },
};
```

`src/gfx/sprites/index.js`:

```js
import { DEFS as characters } from './characters.js';
import { DEFS as items } from './items.js';
export const ALL_DEFS = { ...characters, ...items };
export async function registerAllSprites() {
  const { defineSprites } = await import('../textures.js');
  defineSprites(ALL_DEFS);
}
```
(Tasks 11 adds `mall.js` and `store.js` to this merge.)

- [ ] **Step 4: Run tests, expect PASS.**

- [ ] **Step 5: GalleryScene** — draws every registered sprite in a grid (name under each in the 8×8 font would be too wide, so print names on a side list keyed by index), animating multi-frame sprites at 8 frames/tick; Left/Right pages through when more than one screen. Open `http://localhost:5173/?gallery=1` and review: every sprite readable at 1× and on CRT. Iterate on art that doesn't read.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: character and item pixel art with sprite gallery"`

---

### Task 11: Mall & store environment art (tiles, storefronts, displays, fixtures)

**Files:**
- Create: `src/gfx/sprites/mall.js`, `src/gfx/sprites/store.js`
- Modify: `src/gfx/sprites/index.js` (merge), `src/scenes/GalleryScene.js` (already generic)
- Test: extend `tests/sprites.test.js` with a second `REQUIRED_ENV` table

**Interfaces:**
- Mall names (sizes w×h×frames):
  - Tiles 8×8: `floorTop` (floor slab surface), `floorSlab`, `wallBack` (mall back wall pattern), `ceiling`, `railing`, `roofTile`, `sky`, `parkingFloor`, `parkingWall`, `pillar`.
  - Shafts: `shaftBg` 8×8 (dark shaft wall), `shaftGrate` 24×4, `carBody` 24×40 ×2 (doors closed/open), `carRoof` 24×4, `shaftDoorFrame` 32×40.
  - Escalator: `escStep` 8×8 ×2 (animated), `escRail` 8×8.
  - Lights: `lamp` 16×12 ×2 (swing), `lampBroken` 16×8, `disco` 12×12 ×2, `discoBroken` 16×8, `lampCord` 1×8.
  - Decor: `bench` 32×12, `plant` 16×24, `fountain` 48×24 ×3, `kiosk` 16×32, `photoBooth` 24×40 ×2 (curtain open/closed), `wetSign` 8×12, `puddle` 16×4 ×2, `stationWagon` 48×24 ×2, `zipline` 8×8.
  - Storefronts: `facade` 80×40 (frame with sign plate area at top 12 px, two window openings 24×20, door opening 16×24), `doorRed` 16×24 ×2 (blink), `doorBlue` 16×24, `doorDark` 16×24, `shutter` 80×28, `windowLightOff` 24×20 (dim overlay), `saleSign` 24×8 (`70% OFF`).
  - Window displays 24×20 (one per side per store; frames = idle animation): `disp_forever12_L/R` (mannequins / clothing rack), `disp_radioshock_L/R` ×2 (TV static flicker / walkie-talkies), `disp_kgbtoys_L/R` (ushanka teddies / robot + rocket), `disp_hotspy_L/R` ×3 (lemonade pump / corn dogs), `disp_footlockpicker_L/R` (sneaker wall / balls + jersey), `disp_sambaddy_L/R` ×2 (tapes & vinyl / boombox speakers bounce), `disp_crookstone_L/R` (massage chair / gadgets), `disp_sharperimagine_L/R` ×2 (robot vacuum / glowing orb pulse), `disp_spenders_L/R` ×3 (lava lamp / plasma ball), `disp_gamestonk_L/R` ×2 (console stack + cartridges / "TO THE MOON" rocket poster + demo TV), `disp_blockbluster` 80×28 (shutter with FOR LEASE sign + faded VHS poster), `disp_circuitpity` 80×28 (shutter + dead TVs peeking), `disp_borderline` 80×28 (shutter + CLOSING SALE banner).
- Store names (16×16 unless noted), per theme `T` in `fashion, electronics, toys, food, sports, music, gadgets, novelty, games`: `floor_T`, `wall_T`, `fixture_T` ×2 (closed/opened), `counter_T`. Plus `fittingRoom` ×2, `toyShelf` ×2, `demoTv` ×2, `boothTile`, `pedestal`, `doorMat`, `trapSmoke` reuses `smoke`.

- [ ] **Step 1: Extend test** — append to `tests/sprites.test.js`:

```js
const THEMES = ['fashion', 'electronics', 'toys', 'food', 'sports', 'music', 'gadgets', 'novelty', 'games'];
const DISPLAY_STORES = { forever12: 1, radioshock: 2, kgbtoys: 1, hotspy: 3, footlockpicker: 1, sambaddy: 2, crookstone: 1, sharperimagine: 2, spenders: 3, gamestonk: 2 };
const REQUIRED_ENV = {
  floorTop: [8, 8, 1], floorSlab: [8, 8, 1], wallBack: [8, 8, 1], ceiling: [8, 8, 1], railing: [8, 8, 1], roofTile: [8, 8, 1],
  sky: [8, 8, 1], parkingFloor: [8, 8, 1], parkingWall: [8, 8, 1], pillar: [8, 8, 1], shaftBg: [8, 8, 1], shaftGrate: [24, 4, 1],
  carBody: [24, 40, 2], carRoof: [24, 4, 1], shaftDoorFrame: [32, 40, 1], escStep: [8, 8, 2], escRail: [8, 8, 1],
  lamp: [16, 12, 2], lampBroken: [16, 8, 1], disco: [12, 12, 2], discoBroken: [16, 8, 1], lampCord: [1, 8, 1],
  bench: [32, 12, 1], plant: [16, 24, 1], fountain: [48, 24, 3], kiosk: [16, 32, 1], photoBooth: [24, 40, 2], wetSign: [8, 12, 1],
  puddle: [16, 4, 2], stationWagon: [48, 24, 2], zipline: [8, 8, 1],
  facade: [80, 40, 1], doorRed: [16, 24, 2], doorBlue: [16, 24, 1], doorDark: [16, 24, 1], shutter: [80, 28, 1],
  windowLightOff: [24, 20, 1], saleSign: [24, 8, 1],
  disp_blockbluster: [80, 28, 1], disp_circuitpity: [80, 28, 1], disp_borderline: [80, 28, 1],
  fittingRoom: [16, 16, 2], toyShelf: [16, 16, 2], demoTv: [16, 16, 2], boothTile: [16, 16, 1], pedestal: [16, 16, 1], doorMat: [16, 16, 1],
};
for (const [id, n] of Object.entries(DISPLAY_STORES)) { REQUIRED_ENV[`disp_${id}_L`] = [24, 20, n]; REQUIRED_ENV[`disp_${id}_R`] = [24, 20, n]; }
for (const t of THEMES) Object.assign(REQUIRED_ENV, { [`floor_${t}`]: [16, 16, 1], [`wall_${t}`]: [16, 16, 1], [`fixture_${t}`]: [16, 16, 2], [`counter_${t}`]: [16, 16, 1] });

describe('environment sprites', () => {
  for (const [name, [w, h, n]] of Object.entries(REQUIRED_ENV)) {
    it(`${name} is ${w}×${h} ×${n}, ≤3 colours`, () => {
      const d = ALL_DEFS[name]; expect(d, name).toBeDefined();
      expect(d.pal.length).toBeLessThanOrEqual(3); expect(d.frames).toHaveLength(n);
      for (const f of d.frames) { const r = gridToRGBA(f, d.pal); expect([r.w, r.h]).toEqual([w, h]); }
    });
  }
});
```

(`DISPLAY_STORES` frame counts: the per-side count applies to both L and R; for stores where only one side animates, repeat the static frame.)

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Author the art.** Direction: SMB3-style chunky tiles with bold outlines. Mall interior palette: warm cream/tan back wall, teal/terracotta floor slab, brass railings; roof = dark blue night sky with stars and roof tiles; parking = grey concrete with yellow stripes. Storefront sign plates are drawn by the scene with the font on top of the `facade` plate area (so names are text, not art). Window displays must make the store readable without the sign (spec §3.2 display table). Store themes: each `floor_T` / `wall_T` pair gets its own palette (fashion pink/white, electronics blue/grey, toys primary colours, food red/white stripes, sports green turf/wood, music purple/black checker, gadgets chrome/black, novelty black-light purple, games dark carpet with neon). Large sprites (80×40 facade, 80×28 shutters) can be authored as string arrays generated by small helper functions in the same file (e.g. `repeatRow`, `box`) as long as the exported `DEFS` value is plain data.

- [ ] **Step 4: Run tests, expect PASS; review in `?gallery=1`.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: mall, storefront, display and store theme pixel art"`

---

### Task 12: Mall player movement model (pure)

**Files:**
- Create: `src/game/mallWorld.js`, `src/game/mallPlayer.js`
- Test: `tests/mallPlayer.test.js`

**Interfaces:**
- Consumes: physics, elevator, powerups (`walkSpeed`, `jumpVelocity`), npcs (`slideStep`), world data, rules (`canExit`, `packagesLeft`).
- Pad-like input for pure code: `{ held(b): bool, pressed(b): bool }`.
- Produces: `createPlayer() → Player` (mall entity shape from Task 5 plus `mode: 'intro'|'ground'|'air'|'car'|'esc'|'hidden'|'dying'`, `duck`, `kick`, `esc: {e, dir}|null`, `frozenT`, `invulnT`, `hiddenT`, `dieT`, `lastSafe: {x, floor}`, `slideDir`, `shootT`, `introT`).
- Produces: `STAND_H=24`, `DUCK_H=14`, `stepPlayer(p, pad, world, state) → Event[]`.
- Produces: `createMallWorld(state) → World` = `{ frame, cars, player, playerCarCmd, spies:[], bullets:[], enemyBullets:[], pickups:[], coins:[], fx:[], lights, wet:[], janitor:null, walkers:[], cop:null, kioskCooldown:[0,0,0,0], fountainCooldown:[0,0], spawnT:120, alarm:false, banner:null }` (Tasks 14/15 fill janitor/walkers/cop/lights behaviour) and `stepMall(world, pad, state, rng) → Event[]` which for now: increments `state.levelFrames`, `tickPowerups`, steps cars (player's car uses `world.playerCarCmd`, AI cars `aiCommand`), carries roof riders, applies crushes to the player, then `stepPlayer`.
- Event shapes: `{type:'sfx', name}`, `{type:'enterStore', storeId}`, `{type:'announce', floor}`, `{type:'music', name}`, `{type:'playerHit', cause}`, `{type:'playerDied', cause}`, `{type:'exitBlocked', left}`, `{type:'levelClear'}`, `{type:'kiosk', storeId}`, `{type:'photo'}`, `{type:'banner', text}`, `{type:'shake', frames}`, `{type:'score', pts, x, y}`.

Player rules (spec §4.1 + Task 5 doorway rules):
- `intro`: agent slides down a zipline from (x=ROOF_ENTRY_X-80, y=0) to (ROOF_ENTRY_X, feetY(0)) over 60 frames; then `ground` on floor 0.
- `ground`: if `frozenT>0` decrement and do nothing else. Wet floor: `slideStep(world.wet, p, walkSpeed)` overrides horizontal input. Otherwise Left/Right set `vx=±walkSpeed`, `facing`; `duck = held('down') && !actionAvailableForDown`. `pressed('b')` → jump: `vy=jumpVelocity`, `vx` = current vx ×1.5, `kick = vx !== 0`, `fallFromY = y`, mode `air`, sfx `jump`. `pressed('up')` actions in priority: car doorway (`doorwayState === 'car'` at `p.x` → mode `car`, `riding`, `x` = car centre, music `muzak`); escalator bottom landing (`|x - e.x| ≤ 6` on `e.bottomFloor`) → mode `esc` dir up; store door (`|x - doorX(s)| ≤ 8` on `s.floor`): open only if role `powerup`, or role `target` and not in `state.cleared` → event `enterStore` + sfx `door`; kiosk / photo booth / getaway car handled in Task 15/18 (leave a hook: `world.upHooks` array of `(p, world, state) => Event[]|null`, tried after the above). `pressed('down')`: car doorway `car` → enter car; escalator top landing (`|x - (e.x+ESC_RUN)| ≤ 6` on `e.topFloor`) → mode `esc` dir down. Walls clamp `x` to `[WALL_L+6, WALL_R-6]`. After moving: on a floor, if `!supportedAt(x, floor, cars)` → mode `air`, `vy=0`, `fallFromY=y`; on a roof, follow the car (`y = car.y - CAR_H`); leaving the roof x-range → if a floor surface lies in `[y-8, y]` snap onto it, else fall. When grounded on a floor and not inside any shaft x-range, update `lastSafe`.
- `air`: `stepAir`; `findLanding(x, prevY, y, cars)` while `vy > 0`; on landing: if `y - fallFromY > MAX_SAFE_FALL` → die (`fall`); else set `floor`/`onRoof`, mode `ground`, `kick=false`. `y > MALL_H` → die.
- `car`: `world.playerCarCmd = held('up') ? -1 : held('down') ? 1 : 0`; `y = car.y`; `floor = carFloor(car)`; Left/Right pressed while `carFloor !== null` → step out: mode `ground`, `x = car centre ± 16`, `riding=null`, music back to `mall` (or `mallAlarm`).
- `esc`: move 1 px x (+1 up / −1 down) and 1 px y per frame; on reaching the other landing set floor and mode `ground`.
- `dying`: `dieT` counts down from 90; at 0 emit `playerDied` once.
- `invulnT` counts down every frame (respawn blink).

- [ ] **Step 1: Failing tests** — `tests/mallPlayer.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall } from '../src/game/mallWorld.js';
import { createGameState } from '../src/game/state.js';
import { feetY } from '../src/world/constants.js';
import { STORES, doorX, ESCALATORS, ESC_RUN } from '../src/world/mallLevel.js';
import { CAR_H } from '../src/logic/elevator.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
function setup() {
  const state = createGameState({ seed: 1 });
  const world = createMallWorld(state);
  world.cars.find((c) => c.id === 'C').ai = false; // deterministic tests
  const p = world.player; p.mode = 'ground'; p.introT = 0;
  return { state, world, p, rng: state.rng };
}
const place = (p, x, floor) => Object.assign(p, { x, floor, y: feetY(floor), mode: 'ground', onRoof: null, riding: null });
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };

describe('mall player', () => {
  it('intro zipline lands on the roof', () => {
    const state = createGameState({ seed: 1 }); const world = createMallWorld(state);
    run(world, state, NONE, 61);
    expect(world.player).toMatchObject({ mode: 'ground', floor: 0, y: feetY(0) });
  });
  it('walks and is clamped by walls', () => {
    const { state, world, p } = setup(); place(p, 20, 1);
    run(world, state, pad(['left']), 30);
    expect(p.x).toBe(14);
  });
  it('jump returns to the same floor', () => {
    const { state, world, p } = setup(); place(p, 60, 1);
    run(world, state, pad([], ['b']), 1); expect(p.mode).toBe('air');
    run(world, state, NONE, 60);
    expect(p).toMatchObject({ mode: 'ground', floor: 1, y: feetY(1) });
  });
  it('walking into a pit with the car one floor below lands on the roof', () => {
    const { state, world, p } = setup();
    const carA = world.cars.find((c) => c.id === 'A'); carA.y = feetY(2); // A at 3F
    place(p, 100, 1);
    run(world, state, pad(['right']), 30); run(world, state, NONE, 30);
    expect(p.mode).toBe('ground'); expect(p.onRoof).toBe('A'); expect(p.y).toBe(feetY(2) - CAR_H);
  });
  it('walking into a pit with the car two floors below kills', () => {
    const { state, world, p } = setup();
    world.cars.find((c) => c.id === 'A').y = feetY(3);
    place(p, 100, 1);
    const ev = run(world, state, pad(['right']), 200);
    expect(ev.some((e) => e.type === 'playerDied' && e.cause === 'fall')).toBe(true);
  });
  it('enters a car with up, rides it, and exits at another floor', () => {
    const { state, world, p } = setup();
    const carB = world.cars.find((c) => c.id === 'B'); // at 4F
    place(p, 388, 1);
    run(world, state, pad([], ['up']), 1); expect(p.mode).toBe('car');
    run(world, state, pad(['down']), 48); run(world, state, NONE, 5);
    expect(carB.y).toBe(feetY(2)); expect(p.y).toBe(feetY(2));
    run(world, state, pad([], ['right']), 1);
    expect(p).toMatchObject({ mode: 'ground', floor: 2, riding: null });
  });
  it('rides an escalator up in 48 frames', () => {
    const { state, world, p } = setup(); const e = ESCALATORS[0];
    place(p, e.x, e.bottomFloor);
    run(world, state, pad([], ['up']), 1); run(world, state, NONE, 48);
    expect(p).toMatchObject({ mode: 'ground', floor: e.topFloor, x: e.x + ESC_RUN, y: feetY(e.topFloor) });
  });
  it('up at an open target door enters; closed or cleared stores stay shut', () => {
    const { state, world, p } = setup();
    const t = STORES.find((s) => s.id === 'radioshock'); place(p, doorX(t), t.floor);
    expect(run(world, state, pad([], ['up']), 1)).toContainEqual({ type: 'enterStore', storeId: 'radioshock' });
    state.cleared.add('radioshock');
    expect(run(world, state, pad([], ['up']), 1).some((e) => e.type === 'enterStore')).toBe(false);
    const closed = STORES.find((s) => s.role === 'closed'); place(p, doorX(closed), closed.floor);
    expect(run(world, state, pad([], ['up']), 1).some((e) => e.type === 'enterStore')).toBe(false);
  });
  it('a descending car crushes the player standing in the doorway below', () => {
    const { state, world, p } = setup();
    const carA = world.cars.find((c) => c.id === 'A'); carA.y = feetY(1) + 1; carA.dir = 1; // gliding down toward 3F
    place(p, 124, 2); // in A's doorway at 3F, car above → solid grate
    world.playerCarCmd = 0;
    const ev = run(world, state, NONE, 150);
    expect(ev.some((e) => e.type === 'playerDied' && e.cause === 'crush')).toBe(true);
  });
});
```

(The crush test starts car A 1 px below 4F: an unaligned car with no command keeps gliding in its direction until the next floor, so it descends onto the player standing on the 3F grate.)

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/game/mallPlayer.js` (`createPlayer`, `stepPlayer`, `STAND_H`, `DUCK_H`) and `src/game/mallWorld.js` (`createMallWorld`, `stepMall`) following the rules above. Kill helper used across the mall: `killPlayer(p, cause, events)` → if `p.mode === 'dying'` or `p.invulnT > 0` return; `resolveHit(state.power)` for `'shot'`/`'contact'` causes (armor may absorb → sfx `hurt`, `invulnT = 60`); `'crush'`, `'fall'`, `'light'` always kill; set mode `dying`, `dieT = 90`, sfx `death`. Export it from `mallPlayer.js` for Task 14.

- [ ] **Step 4: Run tests, expect PASS** (`npm test`).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: mall player movement, elevators, escalators, doors (pure model)"`

---

### Task 13: MallScene rendering, camera, HUD, store-entry transition stub

**Files:**
- Create: `src/scenes/MallScene.js`, `src/scenes/mallView.js` (static background builder + entity views)
- Modify: `src/scenes/TitleScene.js` (start → MallScene)

**Interfaces:**
- Consumes: `createMallWorld`, `stepMall`, all mall sprites, HUD, `FLOOR_NAMES`, `STORES`, `LIGHTS`, `KIOSKS`, `FOUNTAINS`, `PHOTO_BOOTH`, `GETAWAY_CAR`.
- Produces: `class MallScene` — `enter(ctx, { newLevel?, fromStore?: storeId })`; keeps `this.world` across store visits (the same MallScene instance is stored in `ctx.mallScene` and re-used when returning from a store). `buildMallBackground() → Container` (static, `cacheAsTexture()`), `class EntityViews` (sprite pool keyed by entity object → Sprite; `sync(list, spriteFn)` adds/removes/updates).

Rendering requirements:
- Layers (world container, offset by camera): sky/roof → back wall tiles → storefronts (facade + windows + door + sign text centred on the plate; closed stores get their `disp_*` shutter art; Black Friday adds `saleSign` over each open facade) → shaft backgrounds + door frames → escalators → decor (benches, plants, kiosks, fountains, photo booth, getaway car at P) → lights (+cords) → cars → pickups/coins → NPCs → spies → player → bullets → fx. HUD on top (not scrolled).
- Floor slabs drawn across the whole width at `feetY(f)..feetY(f)+8`, **except** shaft columns (`SHAFT_W`) for floors within the shaft's range: there draw `shaftBg`; draw `shaftGrate` at `feetY(f)` only when `doorwayState === 'solid'` (dynamic, per frame), leaving pits visibly open.
- Red target doors blink (`doorRed` frames, 30-frame period) until the store is in `state.cleared` → `doorDark` + `windowLightOff` overlays; power-up shops `doorBlue`.
- Window displays animate at 12 frames/image.
- Camera: `camX = clamp(round(p.x) - 128, 0, MALL_W - 256)`, `camY = clamp(round(p.y) - 150, 0, MALL_H - 224)`; world container at `(-camX, 16 - camY)`. Screen shake: offset by ±1–2 px random while `shakeT > 0`.
- Player sprite: pick by mode/state (`agentZip` intro, `agentWalk` frames by `floor(x/6)%2`, `agentDuck`, `agentJump`/`agentKick`, `agentShoot` for 8 frames after a shot, `agentDie` frames), `scale.x = facing`, anchor (0.5, 1). Blink (visible every other 4 frames) while `invulnT > 0`. Hidden in photo booth → invisible.
- HUD `floorLabel` = `FLOOR_NAMES[p.floor ?? carFloor(car) ?? nearest]`.
- Events handled here: `sfx` → `ctx.audio.sfx`; `music` → `ctx.audio.playMusic`; `enterStore` → `ctx.mallScene = this; ctx.scenes.replace(new StoreScene(), { storeId })` (StoreScene from Task 16 — until then log and ignore); `shake`; `banner` (centred text box for 120 frames at y=40 of the view); `announce` → banner `FLOOR_ANNOUNCE[floor]` + sfx `ding`; `score` → floating score text (rises 16 px over 40 frames).
- `enter` with `fromStore`: place player at that store's door (`x=doorX`, floor), mode `ground`, `invulnT=60`, remove spies within 48 px; music `mall` or `mallAlarm`.
- Start → `ctx.scenes.push(new PauseOverlay())`, Select → `ctx.scenes.push(new MapOverlay())` (Task 18; until then no-op).

- [ ] **Step 1: Implement** MallScene + mallView per the requirements (no unit test — pure logic is already covered; this is a view).
- [ ] **Step 2: Verify in browser** (`npm run dev`, `?debug=1&seed=1`): intro zipline → roof; walk to shaft A, ride down (ding + banner on stop), step out on 4F, see Forever 12 / RadioShock facades with blinking red doors and readable window displays; walk into an open pit with car far below → death animation; escalator E1 works; camera clamps at edges; CRT toggle still works; no console errors.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: mall scene rendering, camera, storefronts, HUD"`

---

### Task 14: Spies, combat, lights & disco balls, deaths and respawn

**Files:**
- Create: `src/game/spies.js`, `src/game/combat.js`, `src/game/lights.js`
- Modify: `src/game/mallWorld.js` (call order), `src/scenes/MallScene.js` (views, death → lives), `src/scenes/mallView.js`
- Test: `tests/combat.test.js`

**Interfaces:**
- Produces (spies): `createSpy(x, floor, from) → Spy` (mall entity shape + `state: 'emerge'|'walk'|'aim'|'duck'|'wait'|'dead'`, `t`, `fireT`, `aimHigh`, `from`, `dodge: true` — when false the spy never ducks; tests use it for determinism), `stepSpies(world, state, rng, diff) → Event[]` (AI + spawner), `killSpy(world, spy, scoreKey, state, events)`.
- Produces (combat): `firePlayer(world, state) → Event[]` (A pressed handling incl. spread & rapid, cop notice), `stepBullets(world, state, rng) → Event[]`, `playerContacts(world, state) → Event[]`, bullet shape `{x, y, vx, vy, floor, w:4, h:2, owner:'player'|'enemy', life}`.
- Produces (lights): `stepLights(world, state) → Event[]`, light shape `{id, floor, x, kind:'lamp'|'disco', state:'hanging'|'falling'|'rolling'|'broken', y, vy, rollDir, t}`, `hitLight(light, dir)`.
- Updates `stepMall` order: time/power → cars (+crush of spies: `killSpy(…, 'spyCrushed')`) → player → `firePlayer` → `stepSpies` → `stepBullets` → `stepLights` → `playerContacts` → pickups.

Rules:
- **Player fire** (spec §4.1, §6): A pressed, `shootT` cooldown `fireCooldown(power)`, count of player bullets `< maxBullets(power)`; bullet at `y - 16` standing / `y - 8` ducking, `vx = 3*facing`; Spread adds two more with `vy = ±0.6`. Not in modes `esc`, `hidden`, `dying`, `intro`. Emits sfx `shot`; if `world.cop && copSeesShot(cop, p)` → `startChase`, sfx `whistle`, banner `HEY! STOP RIGHT THERE!`.
- **Bullets**: move; `life` 90 frames; removed at walls (`WALL_L..WALL_R`) or when leaving their floor band (`y` outside `floorTop(floor)..feetY(floor)`). Player bullets hit: spies (rect; a ducking spy has `h = DUCK_H`), lights in `hanging` state (hit box per the lamp rule below) → `hitLight`, walkers → blocked, `walkerShot` score + `heyT=60` + sfx `buzzer`, cop → blocked + sfx `ping`, fountains → Task 15 hook. Enemy bullets hit walkers (blocked) and the player (rect with current `h`; skip if `hidden` or `invulnT>0`) → `killPlayer(p,'shot')`.
- **Spies**: spawn every `diff.spawnInterval` frames when `spies.length < diff.spyCap`: candidate doors = open stores (`target` not cleared, or `powerup`) on the player's floor or ±1, with `|doorX - p.x|` in `[40, 200]`; spy appears in the doorway in `emerge` (20 frames, door-open anim) then `walk`. Also when a non-player car `stopped` on the player's floor within 200 px, 40% chance a spy steps out of it. **walk**: if on player's floor and `|dx| < 160` and player not hidden → face player; move `diff.spySpeed` unless `|dx| < 40`; `fireT--`, at 0 → `aim` (`t=20`, `aimHigh = rng.chance(0.5)`), else wander (turn at walls, at pits `!supportedAt(x + facing*6)`, and randomly every 120–240 frames); 1% per frame when a doorway at the same floor is `solid` within 64 px → walk to it and `wait` 180 frames (these are the crush victims). **aim**: telegraph pose, then enemy bullet (`y-18` high / `y-6` low, `vx = 2*facing`), sfx `enemyShot`, `fireT = diff.fireInterval`. **duck**: if `dodge` and a player bullet on the same floor is approaching within 40 px and `rng.chance(0.03)` → duck 30 frames (`h = DUCK_H`). Wet floor `slideStep` applies. Dead spies play `spyDie` 24 frames then are removed; drop `rollSpyDrop(rng)` as a pickup that falls to the floor.
- **Contacts**: player (not dying/hidden/invuln) overlapping a live spy: if `kick` in `air` mode or `power.invincibleT > 0` → `killSpy(…, 'spyShot')`; if the player is sliding on wet floor with `kick` → `'slideKill'`; else `killPlayer(p,'contact')`. Pickups: overlap → `applyPowerup` (`extraLife` → `lives++`), `addScore('powerup')`, sfx `powerup`.
- **Lights** (spec §3.2): `hitLight` → `falling` (`vy` += 0.2/frame from 0); lands on `feetY(floor)` → lamps: `broken`, sfx `glass`, `shake 8`, kill spies/player overlapping `x±8` during the fall and on landing (`spyLight` score); set `world.dark = {floor, x0: x-64, x1: x+64, t: 120}` (view draws a 60%-black rect over that section). Disco balls: on landing become `rolling` with `rollDir` = bullet direction, speed 2 px/frame, kill everything they touch (`discoKill`), sfx `glass` + roll rumble, become `broken` at walls or when `!supportedAt(x + rollDir*6)` (falls into pit → broken).
- **Death & respawn (MallScene)**: on `playerDied` → `loseLife(state)`; if `lives > 0`: clear spies & bullets, place player at `lastSafe` (mode `ground`, `invulnT = 120`), music restart; else `ctx.scenes.replace(new GameOverScene())` (Task 18; until then back to Title).

- [ ] **Step 1: Failing tests** — `tests/combat.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall } from '../src/game/mallWorld.js';
import { createSpy } from '../src/game/spies.js';
import { createGameState } from '../src/game/state.js';
import { feetY } from '../src/world/constants.js';
import { applyPowerup } from '../src/logic/powerups.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
function setup() {
  const state = createGameState({ seed: 2 }); const world = createMallWorld(state);
  world.cars.forEach((c) => { c.ai = false; });
  world.spawnT = 1e9; world.cop = null; world.walkers = []; world.janitor = null;
  const p = world.player; Object.assign(p, { mode: 'ground', introT: 0, x: 200, floor: 1, y: feetY(1) });
  return { state, world, p };
}
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };

describe('combat', () => {
  it('shooting a standing spy kills it and scores 100', () => {
    const { state, world, p } = setup(); p.facing = 1;
    const s = createSpy(260, 1, 'door'); Object.assign(s, { state: 'walk', fireT: 999, dodge: false }); world.spies.push(s);
    run(world, state, pad([], ['a']), 1); run(world, state, NONE, 30);
    expect(s.state).toBe('dead'); expect(state.score).toBe(100);
  });
  it('max two bullets without rapid fire', () => {
    const { state, world } = setup();
    for (let i = 0; i < 40; i++) run(world, state, pad([], ['a']), 1);
    expect(world.bullets.filter((b) => b.owner === 'player').length).toBeLessThanOrEqual(2);
  });
  it('ducking dodges a high shot; standing does not', () => {
    const { state, world, p } = setup();
    world.enemyBullets.push({ x: 230, y: p.y - 18, vx: -2, vy: 0, floor: 1, w: 4, h: 2, owner: 'enemy', life: 90 });
    const ev = run(world, state, pad(['down']), 30);
    expect(ev.some((e) => e.type === 'sfx' && e.name === 'death')).toBe(false);
    world.enemyBullets.push({ x: 230, y: p.y - 18, vx: -2, vy: 0, floor: 1, w: 4, h: 2, owner: 'enemy', life: 90 });
    const ev2 = run(world, state, NONE, 30);
    expect(ev2.some((e) => e.type === 'sfx' && e.name === 'death')).toBe(true);
  });
  it('armor absorbs one shot', () => {
    const { state, world, p } = setup(); applyPowerup(state.power, 'armor');
    world.enemyBullets.push({ x: 230, y: p.y - 10, vx: -2, vy: 0, floor: 1, w: 4, h: 2, owner: 'enemy', life: 90 });
    run(world, state, NONE, 30);
    expect(p.mode).toBe('ground'); expect(state.power.armor).toBeNull();
  });
  it('shooting a lamp drops it on a spy below for 300', () => {
    const { state, world, p } = setup();
    const lamp = world.lights.find((l) => l.floor === 1 && l.x === 304);
    Object.assign(p, { x: 250, facing: 1 });
    // spy stands just past the lamp so the bullet reaches the lamp first, but the falling lamp (±8 px) still lands on him
    const s = createSpy(310, 1, 'door'); Object.assign(s, { state: 'wait', t: 999, fireT: 999, dodge: false }); world.spies.push(s);
    run(world, state, pad([], ['a']), 1);
    run(world, state, NONE, 90);
    expect(lamp.state).toBe('broken'); expect(s.state).toBe('dead'); expect(state.score).toBe(300);
  });
});
```

**Lamp hit box rule:** a hanging lamp's hit box is the cord + lamp column, 6 px wide (`x-3..x+3`), spanning `floorTop(floor)+2 .. feetY(floor)-14`, so a standing shot (y−16) hits it and a ducking shot (y−8) passes under — keeping Elevator Action's "shoot the light" move easy to perform.

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** spies.js, combat.js, lights.js and wire into `stepMall`; add views (spies, bullets, lights falling/rolling, dark overlay, pickups, score popups) and death/respawn handling in MallScene.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Browser check** — spies emerge from red/blue doors, shoot high/low with a visible aim pose, duck bullets; lamp drop and disco-ball roll on 2F look and sound good; ride car down onto a waiting spy → crush + 300.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: spies, combat, falling lights and disco balls, respawn"`

---

### Task 15: Mall NPCs & interactables, elevator flavour, alarm

**Files:**
- Create: `src/game/mallNpcs.js`
- Modify: `src/game/mallWorld.js`, `src/game/combat.js` (fountain & janitor bullet rules), `src/scenes/MallScene.js`, `src/scenes/mallView.js`
- Test: `tests/mallNpcs.test.js`

**Interfaces:**
- Consumes: `npcs.js` (Task 7), `KIOSKS`, `FOUNTAINS`, `PHOTO_BOOTH`, `JANITOR_FLOOR`, `WALKER_FLOOR`, `COP_FLOORS`, `nearestTarget`, `difficulty`, `isAlarm`.
- Produces: `createNpcs(world, rng)` (fills `janitor`, `walkers`, `cop`), `stepNpcs(world, state, rng) → Event[]`, up-hooks `kioskHook`, `boothHook` registered in `world.upHooks`, `fountainHit(world, fountainIdx, rng, events)`.
- Janitor `{x, floor: JANITOR_FLOOR, facing, state:'walk'|'mop', t}`: walks 0.4 px/f between x 40..460 (1F, avoiding shafts B/C), every 900 frames stops, `mop` 60 frames, then `world.wet.push(createWetPatch(x - 24, floor))` + wet sign; bullets pass through him. Wet patches tick via `tickWet`.
- Walkers: two on `WALKER_FLOOR` with bounds `[150, 360]` and `[410, 620]`; `stepWalker`; overlapping the player pushes `p.x += facing * 0.6` (walls respected); `heyT > 0` → view shows a `HEY!` bubble.
- Cop: `createCop(rng.pick(COP_FLOORS), 440)`; `stepCop(cop, p, walkSpeed(power))`; cop ignores pits (Segway). `copCatches` → `p.frozenT = DETAIN_FRAMES`, `addScore('detained')`, banner `DETAINED! -500`, sfx `whistle`, cop back to `patrol`.
- Kiosk hook: player within 8 px of a kiosk on its floor, `pressed('up')`, cooldown 0 → event `{type:'kiosk', storeId}` (from `nearestTarget(p, state.cleared)`), cooldown 1200. MallScene shows a 3-second mini-map panel (reuse MapOverlay's drawing function from Task 18 in a small 128×80 box, or until then a text panel `YOU ARE HERE — NEAREST: RADIOSHOCK 4F`).
- Photo booth hook: within booth x-range on its floor, `pressed('up')` → mode `hidden`, `hiddenT = 300`; any direction pressed or timer end → exit to `ground`; first exit per game: `state.photoTaken = true`, `state.inventory.push('PHOTO STRIP')`, event `photo` (view shows `photoStrip` enlarged ×2 for 120 frames with the 4 agent poses). Spies ignore a hidden player (no aim, walk past); enemy bullets miss.
- Fountains: player bullet hits fountain rect (`x..x+w`, `feetY-16..feetY`) with cooldown 0 → spawn `rng.int(3,5)` coins (`vx = rng.next()*3-1.5`, `vy = -2 - rng.next()`, bounce on floor ×0.5, life 300), one of them gold if `rng.chance(0.05)`; cooldown 900. Coin pickup: `addScore('coin')`, sfx `coin`; gold → `lives++`, banner `1UP!`.
- Elevator flavour: when a car stops with the player riding → event `announce` (MallScene: ding + banner `FLOOR_ANNOUNCE[floor]`); any car stop within 128 px of the player → sfx `ding`; while the player's car moves, sfx `hum` every 8 frames. Entering a car → music `muzak`; leaving → `mall`/`mallAlarm`.
- Alarm: each frame `world.alarm = isAlarm(state.levelFrames, state.loop)`; on the frame it becomes true → music `mallAlarm`, banner `ALARM! SECURITY ALERTED`, HUD `ALARM` blink; `difficulty(loop, {blackFriday, alarm})` used by spies.

- [ ] **Step 1: Failing tests** — `tests/mallNpcs.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall } from '../src/game/mallWorld.js';
import { createGameState } from '../src/game/state.js';
import { feetY } from '../src/world/constants.js';
import { KIOSKS, PHOTO_BOOTH, FOUNTAINS } from '../src/world/mallLevel.js';
import { createWetPatch } from '../src/logic/npcs.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
function setup(seed = 4) {
  const state = createGameState({ seed }); const world = createMallWorld(state);
  world.cars.forEach((c) => { c.ai = false; }); world.spawnT = 1e9;
  const p = world.player; Object.assign(p, { mode: 'ground', introT: 0 });
  return { state, world, p };
}
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };
const at = (p, x, floor) => Object.assign(p, { x, floor, y: feetY(floor) });

describe('mall NPCs', () => {
  it('player slides across a wet patch without stopping', () => {
    const { state, world, p } = setup(); world.janitor = null; world.cop = null;
    at(p, 60, 4); p.facing = 1; world.wet.push(createWetPatch(62, 4));
    run(world, state, pad(['right']), 3);           // 60→61→62, third frame enters the patch → 63
    run(world, state, pad(['left']), 20);           // input ignored, keeps sliding right
    expect(p.x).toBe(83);
  });
  it('shooting in front of the cop starts a chase; being caught freezes and costs 500', () => {
    const { state, world, p } = setup(); state.score = 1000;
    Object.assign(world.cop, { floor: 1, x: 300, y: feetY(1), facing: -1, state: 'patrol' });
    at(p, 250, 1); p.facing = -1;
    run(world, state, pad([], ['a']), 1);
    expect(world.cop.state).toBe('chase');
    run(world, state, NONE, 60);
    expect(p.frozenT).toBeGreaterThan(0); expect(state.score).toBe(500);
  });
  it('kiosk points to a target store and then cools down', () => {
    const { state, world, p } = setup(); world.cop = null;
    const k = KIOSKS[0]; at(p, k.x, k.floor);
    const ev = run(world, state, pad([], ['up']), 1);
    expect(ev.find((e) => e.type === 'kiosk').storeId).toBeTruthy();
    expect(run(world, state, pad([], ['up']), 1).some((e) => e.type === 'kiosk')).toBe(false);
  });
  it('photo booth hides the player and awards the strip once', () => {
    const { state, world, p } = setup(); world.cop = null;
    at(p, PHOTO_BOOTH.x + 12, PHOTO_BOOTH.floor);
    run(world, state, pad([], ['up']), 1); expect(p.mode).toBe('hidden');
    const ev = run(world, state, NONE, 301);
    expect(p.mode).toBe('ground'); expect(ev.some((e) => e.type === 'photo')).toBe(true);
    expect(state.inventory).toEqual(['PHOTO STRIP']);
  });
  it('shooting a fountain sprays 3–5 coins', () => {
    const { state, world, p } = setup(); world.cop = null; world.walkers = [];
    const f = FOUNTAINS[1]; at(p, f.x - 60, f.floor); p.facing = 1;
    run(world, state, pad([], ['a']), 1); run(world, state, NONE, 40);
    expect(world.coins.length).toBeGreaterThanOrEqual(3); expect(world.coins.length).toBeLessThanOrEqual(5);
  });
  it('alarm switches on at the loop-1 threshold', () => {
    const { state, world } = setup(); world.cop = null; state.levelFrames = 8998;
    const ev = run(world, state, NONE, 2);
    expect(world.alarm).toBe(true); expect(ev).toContainEqual({ type: 'music', name: 'mallAlarm' });
  });
});
```

(Fountain test: the player at 1F x = 212 fires right at the fountain at 272; coins fly ≤ ~35 px in the remaining frames so none reach the player. Walkers are on 2F; cleared anyway.)

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** and add views: janitor (walk/mop), wet sign + animated puddle, walkers with `HEY!` bubble, cop on Segway (flashing light when chasing), kiosk mini-map panel, photo-booth curtain + photo strip popup, fountain animation + coins, announcements banner, dark-section overlay, ALARM tint (subtle red flash of the back wall every 60 frames).
- [ ] **Step 4: Run tests, expect PASS; browser check** each NPC once.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: janitor wet floors, mall walkers, mall cop, kiosks, photo booth, fountains, alarm"`

---

### Task 16: Store view — rooms, top-down movement, searching, guards, exit

**Files:**
- Create: `src/game/storeWorld.js`, `src/scenes/StoreScene.js`
- Modify: `src/scenes/MallScene.js` (enterStore → StoreScene)
- Test: `tests/storeWorld.test.js`

**Interfaces:**
- Consumes: `roomFor`, `TILE`, `moveInRoom`, powerups (`walkSpeed`, `searchFrames`, `fireCooldown`, `maxBullets`, `resolveHit`, `applyPowerup`), rules (`addScore`, `difficulty`), `STORES`.
- Produces: `createStoreWorld(storeId, state, rng) → StoreWorld`, `stepStore(world, pad, state, rng) → Event[]`, `isSolidAt(world, px, py)`, `fixtureInFront(world) → index|null`.
- `StoreWorld = { store, room, fixtures /* = state.setup.stores[id].fixtures (shared, so searched flags persist) */, player: { x, y, w:12, h:12, facing:'up'|'down'|'left'|'right', shootT, stunT, holdT, holdItem, invulnT, dead:false, dieT }, guards: [{type:'spy'|'bot', x, y, w:12, h:12, dir, t, fireT, stunT, dead}], bullets: [], enemyBullets: [], search: {idx, t}|null, pops: [] /* reveal fx */, frozen: false, egg: null, toys: [], booth: false }`
- Coordinates: room pixel space (0..255, 0..175); the scene draws it at y=16. Player spawns at `x = 7.5*16 - 6`, `y = 9*16 + 2` (just above the door), facing up.
- Rules (spec §5): 4-way movement at `walkSpeed(power)` px/frame, vertical input wins over horizontal; walls, fixtures, counters, TVs and (while present) the old man are solid; door tiles are walkable. **Exit** when the player's box bottom goes below `10*16 + 4` → event `exitStore`. **Shoot** A: bullet speed 3 in facing direction (Spread: + two at 30° angles), cooldown/limits from powerups; bullets die on solid tiles. **Search**: holding B with `fixtureInFront` unsearched → `search.t++`; at `searchFrames(power)` → reveal: `package` → `state.packages.add(id)`, `state.cleared.add(id)`, `addScore('package')`, `holdT = 60`, `holdItem='package'`, sfx `package` (fanfare), banner `PACKAGE n/6`; `powerup` → `applyPowerup`, `addScore('powerup')`, `holdT = 30`, `holdItem = id`, sfx `powerup`; `trap` → `stunT = 60`, smoke pop, sfx `smoke`; `empty` → `nothingPuff`, sfx `searchTick`. Releasing B or moving resets `search`. Each search tick every 8 frames → sfx `searchTick`. During `holdT` the player is frozen showing `agentTopHold`.
- **Radar**: when `state.power.radar`, the scene draws `bang` above the unsearched package fixture.
- **Guards**: from `room.guards`; spies move 0.75×`difficulty.spySpeed`-scaled px/frame along the tile grid (choose a new direction at tile centres: toward the player on the longer axis 60% of the time, random otherwise, never into solids), shoot when aligned within 4 px on either axis and no solid tile between (bullet speed 2, `fireT = difficulty.fireInterval`); bots move horizontally at 0.8 px/frame and reverse at solids (vertical if spawned in a column with walls left/right). Guards die to one bullet (`addScore('spyShot')`), bots take 3 hits. Player contact with a guard, or an enemy bullet → `resolveHit` → `'dead'` → player `dieT = 90`, event `playerDied` when it runs out; `'absorbed'` → `invulnT = 60`.
- **Re-entry**: guards are rebuilt from the template each time `createStoreWorld` is called (spec: respawn), fixtures come from `state.setup` so searched ones stay open.
- **StoreScene** view: tiles from `floor_T`/`wall_T`/`counter_T`/`fixture_T` (frame 1 when searched)/`fittingRoom`/`toyShelf`/`demoTv`/`boothTile`/`pedestal`/`doorMat`; bottom strip y=192..239: store name centred (white), prompts (`HOLD X TO SEARCH` when facing an unsearched fixture, `SEARCHING…` with a 64 px progress bar), and dialogue box for the egg. HUD with `marquee = store.name`. Music `store` on enter. Events: `exitStore` → `ctx.scenes.replace(ctx.mallScene, { fromStore: id })`; `playerDied` → `loseLife`; lives > 0 → recreate the store world (respawn inside at the door) else GameOver. Select/Start → map/pause overlays as in the mall.

- [ ] **Step 1: Failing tests** — `tests/storeWorld.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createStoreWorld, stepStore, fixtureInFront } from '../src/game/storeWorld.js';
import { createGameState } from '../src/game/state.js';
import { searchFrames } from '../src/logic/powerups.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepStore(w, pd, s, s.rng)); return ev; };
function setup(id = 'radioshock') {
  const state = createGameState({ seed: 5 });
  const w = createStoreWorld(id, state, state.rng); w.guards = [];
  return { state, w };
}
// put the player just below fixture i, facing up
function faceFixture(w, i) {
  const f = w.room.fixtures[i];
  Object.assign(w.player, { x: f.col * 16 + 2, y: (f.row + 1) * 16 + 1, facing: 'up' });
}

describe('store world', () => {
  it('spawns above the door and walls block movement', () => {
    const { state, w } = setup();
    expect(w.player.y).toBe(146);
    run(w, state, pad(['left']), 200);
    expect(w.player.x).toBe(16);
  });
  it('walking down onto the door exits', () => {
    const { state, w } = setup();
    expect(run(w, state, pad(['down']), 40)).toContainEqual({ type: 'exitStore', storeId: 'radioshock' });
  });
  it('searching takes searchFrames and reveals once', () => {
    const { state, w } = setup(); faceFixture(w, 0);
    expect(fixtureInFront(w)).toBe(0);
    run(w, state, pad(['b']), searchFrames(state.power) - 1);
    expect(w.fixtures[0].searched).toBe(false);
    run(w, state, pad(['b']), 1);
    expect(w.fixtures[0].searched).toBe(true);
  });
  it('finding the package collects and clears the store', () => {
    const { state, w } = setup();
    const i = w.fixtures.findIndex((f) => f.type === 'package'); faceFixture(w, i);
    run(w, state, pad(['b']), 60);
    expect(state.packages.has('radioshock')).toBe(true); expect(state.cleared.has('radioshock')).toBe(true); expect(state.score).toBe(500);
  });
  it('a trap stuns the player', () => {
    const { state, w } = setup(); w.fixtures[0].type = 'trap'; faceFixture(w, 0);
    run(w, state, pad(['b']), 45);
    const x = w.player.x; run(w, state, pad(['left']), 10);
    expect(w.player.x).toBe(x);
  });
  it('re-entry respawns guards but keeps searched fixtures', () => {
    const { state, w } = setup(); faceFixture(w, 0); run(w, state, pad(['b']), 45);
    const again = createStoreWorld('radioshock', state, state.rng);
    expect(again.fixtures[0].searched).toBe(true); expect(again.guards.length).toBe(2);
  });
  it('touching a bot without armor kills', () => {
    const { state, w } = setup();
    w.guards = [{ type: 'bot', x: w.player.x, y: w.player.y, w: 12, h: 12, dir: 'down', t: 0, fireT: 999, stunT: 0, dead: false, hp: 3 }];
    const ev = run(w, state, NONE, 120);
    expect(ev.some((e) => e.type === 'playerDied')).toBe(true);
  });
});
```

(RadioShock template has 1 `G` + 1 `B` → 2 guards. In `faceFixture`, fixture 0 of electronics is at row 1 col 6 → player at x=98, y=33 facing up; tile above is the fixture.)

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `storeWorld.js` and `StoreScene.js`; switch MallScene's `enterStore` to the real StoreScene.
- [ ] **Step 4: Run tests, expect PASS; browser check** — enter RadioShock, walls/fixtures solid, guard shoots when aligned, search bar, package fanfare + `PKG 1/6`, walk out → back in the mall at the door with a dark door.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: top-down store rooms with searching, guards and exits"`

---

### Task 17: Store extras — fitting rooms, wind-up toys, listening booth, GameStonk easter egg

**Files:**
- Create: `src/game/storeExtras.js`
- Modify: `src/game/storeWorld.js`, `src/scenes/StoreScene.js`
- Test: `tests/storeExtras.test.js`

**Interfaces:**
- Consumes: `pickJokeItem`, `addScore('jokeItem')`, store world.
- Produces: `fittingRoomSurprise(world, idx, rng) → bool` (called before revealing an `R` fixture), `releaseToys(world, idx, rng)` (called when a player bullet hits an unreleased `T` fixture), `stepToys(world, rng, events)`, `stepBooth(world, events)`, `createEgg(world, state, rng)`, `stepEgg(world, pad, state, events)`, `EGG_TEXT = "IT'S DANGEROUS TO GO ALONE! TAKE THIS."`.
- Fitting room: on completing a search of an `R` fixture not yet `surprised`: `rng.chance(0.25)` → mark `surprised`, keep `searched=false`, spawn a spy guard on the tile in front of the fixture in state `shriek` (30 frames, `spyChanging` sprite, sfx `shriek`) that then throws a `shoe` (enemy bullet 1 px/frame toward the player) and becomes a normal guard.
- Toys: each `T` fixture releases at most once per visit: 3 toys (`windupToy`, 8×8) at the fixture's front tile, directions distinct from `up/down/left/right` (random order), 0.75 px/frame, turn clockwise at solids, life 480. A toy touching a guard → guard `stunT = 120`. A toy touching an unsearched `trap` fixture's front tile → fixture `searched = true`, smoke pop at that tile stunning guards within 24 px (`stunT = 60`).
- Booth: player centre on the `L` tile → first time per visit event `{type:'music', name:'booth'}` + banner `NOW PLAYING: SIDE B`; music stays until exit.
- Egg (spec §5): on `createStoreWorld('gamestonk')` when `!state.gameStonkDone` → `world.egg = { phase: 'type', i: 0, t: 0, item: pickJokeItem(rng) }`, `world.frozen = true` (guards and player input frozen), the old man tile is solid. `type`: every 3 frames `i++` + sfx `blip` until `i === EGG_TEXT.length`, then phase `offer` (item sprite on the pedestal). `offer`: player moves normally (guards still frozen); overlapping the pedestal → phase `get`, `t = 90`, music `itemGet`, `player.holdItem = item`. `get` countdown → `state.inventory.push(item)`, `addScore('jokeItem')`, banner `YOU GOT: <ITEM>`, `state.gameStonkDone = true`, old man disappears in a `smoke` pop (tile becomes floor), `world.frozen = false`, `egg = null`, music `store`.

- [ ] **Step 1: Failing tests** — `tests/storeExtras.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createStoreWorld, stepStore } from '../src/game/storeWorld.js';
import { EGG_TEXT, releaseToys } from '../src/game/storeExtras.js';
import { createGameState } from '../src/game/state.js';
import { JOKE_ITEMS } from '../src/logic/secrets.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepStore(w, pd, s, s.rng)); return ev; };

describe('GameStonk easter egg', () => {
  it('types the line, offers a joke item, awards it once', () => {
    const state = createGameState({ seed: 8 });
    const w = createStoreWorld('gamestonk', state, state.rng);
    expect(w.frozen).toBe(true);
    const ev = run(w, state, NONE, EGG_TEXT.length * 3 + 2);
    expect(ev.filter((e) => e.type === 'sfx' && e.name === 'blip').length).toBe(EGG_TEXT.length);
    expect(w.egg.phase).toBe('offer');
    const ped = w.room.pedestal; Object.assign(w.player, { x: ped.col * 16 + 2, y: ped.row * 16 + 2 });
    run(w, state, NONE, 100);
    expect(state.gameStonkDone).toBe(true); expect(JOKE_ITEMS).toContain(state.inventory[0]);
    expect(state.score).toBe(1); expect(w.frozen).toBe(false);
    const again = createStoreWorld('gamestonk', state, state.rng);
    expect(again.egg).toBeNull();
  });
});

describe('store extras', () => {
  it('toy shelves release three toys once', () => {
    const state = createGameState({ seed: 8 }); const w = createStoreWorld('kgbtoys', state, state.rng);
    const idx = w.room.fixtures.findIndex((f) => f.kind === 'T');
    releaseToys(w, idx, state.rng); releaseToys(w, idx, state.rng);
    expect(w.toys).toHaveLength(3);
  });
  it('listening booth switches music once per visit', () => {
    const state = createGameState({ seed: 8 }); const w = createStoreWorld('sambaddy', state, state.rng); w.guards = [];
    const b = w.room.booth; Object.assign(w.player, { x: b.col * 16 + 2, y: b.row * 16 + 2 });
    const ev = run(w, state, NONE, 10);
    expect(ev.filter((e) => e.type === 'music' && e.name === 'booth')).toHaveLength(1);
  });
  it('fitting room surprise keeps the contents unsearched', () => {
    const state = createGameState({ seed: 8 }); const w = createStoreWorld('forever12', state, state.rng); w.guards = [];
    const idx = w.room.fixtures.findIndex((f) => f.kind === 'R');
    const f = w.room.fixtures[idx]; Object.assign(w.player, { x: f.col * 16 + 2, y: (f.row + 1) * 16 + 1, facing: 'up' });
    let surprised = false;
    for (let tries = 0; tries < 40 && !surprised; tries++) {
      w.fixtures[idx].searched = false; w.fixtures[idx].surprised = false; w.guards = [];
      run(w, state, pad(['b']), 46);
      surprised = w.fixtures[idx].surprised === true;
    }
    expect(surprised).toBe(true); expect(w.fixtures[idx].searched).toBe(false); expect(w.guards.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** and add views: Zelda-cave tableau (old man between two flickering `demoTv`s, black text box in the bottom strip with typewriter text, item on `pedestal`, agent holding item overhead), fitting-room spy shriek, toys, booth headphones glow.
- [ ] **Step 4: Run tests, expect PASS; browser check** GameStonk on 4F.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: fitting-room surprise, wind-up toys, listening booth, GameStonk easter egg"`

---

### Task 18: Map & pause overlays, level flow, level clear, game over, Black Friday signage

**Files:**
- Create: `src/scenes/MapOverlay.js`, `src/scenes/PauseOverlay.js`, `src/scenes/LevelClearScene.js`, `src/scenes/GameOverScene.js`, `src/game/exitHook.js`
- Modify: `src/game/mallWorld.js` (register exit hook), `src/scenes/MallScene.js`, `src/scenes/StoreScene.js`
- Test: `tests/levelFlow.test.js`

**Interfaces:**
- Produces: `exitHook(p, world, state) → Event[]|null` — at P within the getaway car's x-range (`GETAWAY_CAR.x..x+w`) on `pressed('up')`: `canExit(state)` → `[{type:'levelClear'}]` once (sets `world.exiting = true`, player hidden in the car); else `[{type:'exitBlocked', left: packagesLeft(state)}, {type:'sfx', name:'buzzer'}]`.
- `MapOverlay(params: { storeId? })`: black background; title `MALL DIRECTORY`; floors as 6 bands at y = 40 + i*24 (label `R 4F 3F 2F 1F P` at x=8), mall x mapped `16 + x*224/768`; shaft columns with the car drawn at its current y; escalator diagonals; each store a rect coloured red (target, not cleared) / grey (cleared) / blue (power-up) / dark grey (closed); when `power.radar`, `!` over uncleared target stores; the player (or the current store) blinks; footer `INVENTORY: PHOTO STRIP, PET ROCK` (or `INVENTORY: -`) and `SELECT: CLOSE`. Select pops. Exposes `drawMallMap(container, state, world, {x,y,w,h, highlightStoreId})` reused by the kiosk mini-map.
- `PauseOverlay`: 50% black veil, `PAUSE` blinking, sfx `pause`, `audio.duck(true)`; Start pops (`duck(false)`).
- `LevelClearScene(params: { levelFrames })`: P-level backdrop; station wagon drives off right over 120 frames while a spy runs after it waving a receipt (small white rectangle), then tally lines appearing every 30 frames: `PACKAGES 6/6`, `TIME BONUS <timeBonus>`, `CLEAR BONUS 1000` (apply `addPoints`/`addScore('levelClear')` as they appear, with coin sfx), then `LOOP <n+1>` → on Start or after 240 frames: `nextLoop(state)`, `ctx.mallScene = null`, `replace(new MallScene(), { newLevel: true })`. Music `levelClear`.
- `GameOverScene`: sfx `paChime`, typewriter `ATTENTION SHOPPERS:` / `THE MALL IS NOW CLOSED` (2 frames per char, blip), meanwhile 3 `shutter` graphics roll down over a frozen agent sprite (1 px/frame), then `GAME OVER` + score + `HI` (update `ctx.highScore = max`); Start or 480 frames → Title. Music `gameOver`.
- Black Friday: MallScene draws `saleSign` over every open storefront; `difficulty(loop, { blackFriday: true, alarm })`; Title flag passes through `createGameState`.
- Select/Start wiring in MallScene and StoreScene: `pressed('select')` → `push(new MapOverlay(), { storeId })`; `pressed('start')` → `push(new PauseOverlay())`. The world does not step while an overlay is up (power-up timers pause automatically).

- [ ] **Step 1: Failing test** — `tests/levelFlow.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall } from '../src/game/mallWorld.js';
import { createGameState } from '../src/game/state.js';
import { feetY } from '../src/world/constants.js';
import { GETAWAY_CAR } from '../src/world/mallLevel.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
function setup() {
  const state = createGameState({ seed: 6 }); const world = createMallWorld(state);
  world.cars.forEach((c) => { c.ai = false; }); world.spawnT = 1e9; world.cop = null;
  Object.assign(world.player, { mode: 'ground', introT: 0, x: GETAWAY_CAR.x + 20, floor: 5, y: feetY(5) });
  return { state, world };
}
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };

describe('level exit', () => {
  it('is blocked with packages left', () => {
    const { state, world } = setup(); state.packages.add('a');
    expect(run(world, state, pad([], ['up']), 1)).toContainEqual({ type: 'exitBlocked', left: 5 });
  });
  it('clears exactly once with all six packages', () => {
    const { state, world } = setup(); ['a', 'b', 'c', 'd', 'e', 'f'].forEach((p) => state.packages.add(p));
    const ev = [...run(world, state, pad([], ['up']), 1), ...run(world, state, pad([], ['up']), 1)];
    expect(ev.filter((e) => e.type === 'levelClear')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** all overlays/scenes and wiring.
- [ ] **Step 4: Run all tests, expect PASS** (`npm test`).
- [ ] **Step 5: Browser check** — `?debug=1` then in the console `__mall.state.packages = new Set(['forever12','radioshock','kgbtoys','sambaddy','hotspy','footlockpicker'])`, ride B to P, press up at the wagon → Level Clear → Loop 2 (faster spies). Lose all lives → Game Over sequence → Title with updated HI. Map from mall and from a store; Radar `!` markers; Pause ducks music. Black Friday signs visible.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: map and pause overlays, level clear, game over, black friday"`

---

### Task 19: Full playtest, polish, README

**Files:**
- Create: `README.md`
- Modify: whatever the playtest finds

- [ ] **Step 1: Automated checks** — `npm test` (all green), `npm run build` (succeeds), `npx vite preview` serves `dist/` correctly.
- [ ] **Step 2: Browser playtest via Chrome automation** (claude-in-chrome): load `http://localhost:5173/?debug=1&seed=1`; read console (no errors/warnings from our code); drive keys: Enter (start) → wait for intro → walk right to shaft A → Up, hold Down to 4F, step out → walk to RadioShock door → Up → in store: walk to a fixture, hold X to search, open map with Shift, close, walk out → mall. Screenshot Title, Mall (4F storefronts), Store, Map, Game Over. Record a GIF of an elevator crush on a waiting spy (use `__mall` to place a spy in a doorway if needed).
- [ ] **Step 3: Feel pass** — tune (in constants, not tests): walk speed, jump arc, spy aggression on loop 1 (a new player should reach 4F stores without dying on the first attempt), store search time, music volumes vs SFX, CRT intensity (text must stay readable at 3× scale). Keep all tests green.
- [ ] **Step 4: README** — how to run (`npm install`, `npm run dev`), controls table (spec §9), secrets hint ("try a famous code on the title screen"), URL params (`?seed=`, `?debug=1`, `?gallery=1`), project structure summary.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "chore: playtest polish and README"`

---

## Spec Coverage Map

| Spec | Tasks |
|---|---|
| §2 Tech (Vite, Pixi 8, CRT, 256×240, 60 Hz, WebAudio) | 1, 8 |
| §3.1 Flow | 9, 13, 16, 18 |
| §3.2 Layout, names, storefront displays, lights/disco, decor | 4, 11, 13, 14 |
| §3.3 Rules (exit, lives, alarm, scores, difficulty) | 6, 14, 15, 18 |
| §4.1–4.3 Player, spies, elevators | 5, 12, 14 |
| §4.4 Elevator flavour (ding, announcements, muzak) | 8, 13, 15 |
| §4.5 NPCs (wet floor, walkers, cop, kiosks, booth, fountains) | 7, 15 |
| §5 Store view, fixtures, guards, themes, extras, easter egg | 4, 11, 16, 17 |
| §6 Power-ups incl. food | 4, 6, 14, 16 |
| §7 Map, HUD, Pause, Title, Black Friday, Level Clear, Game Over | 9, 15, 18 |
| §8 Graphics & audio | 3, 8, 10, 11 |
| §9 Controls | 2, 9 |
| §10 Anchor stores (future) | room model in 4/16 supports arbitrary sizes (`parseRoom` has no fixed size; camera clamp in StoreScene uses `room.cols/rows`) |
| §12 Error handling | 1 (WebGL), 2 (gamepad live), 8 (audio non-fatal), 1 (resize) |
| §13 Testing | every task + 19 |
