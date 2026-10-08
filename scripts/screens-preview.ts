/**
 * Render the key moments of every non-gameplay screen to PNG contact sheets so you can LOOK at them.
 *
 *   npx tsx scripts/screens-preview.ts [outDir] [scale]
 *
 * Writes <outDir>/<screen>.png (default playtest-out/screens, scale 2). Each sheet tiles several frames
 * of one screen. A screen that cannot be drawn yet (for example the storefront art is still a stub) is
 * reported and skipped, the rest are still written.
 */
import '../src/art/index';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Framebuffer } from '../src/engine/framebuffer';
import { C } from '../src/engine/palette';
import { NO_PAD, Btn, type Pad } from '../src/engine/pad';
import { Rng } from '../src/engine/rng';
import { encodePng } from './png';
import { FlickerSplash } from '../src/flickersoft/splash';
import { TitleScreen } from '../src/game/screens/title';
import { LevelClearScreen } from '../src/game/screens/levelclear';
import { ContinueScreen } from '../src/game/screens/continue';
import { GameOverScreen } from '../src/game/screens/gameover';
import { KONAMI_CODE } from '../src/game/screens/konami';
import { STORES, type StoreId } from '../src/content/stores';
import { SPYGRAM_ARRIVAL } from '../src/content/copy';
import { drawTitle } from '../src/render/titleView';
import { drawMapView } from '../src/render/mapView';
import { drawPauseOverlay } from '../src/render/pauseView';
import { drawLevelClear } from '../src/render/levelClearView';
import { drawSpygram, spygramLikes } from '../src/render/spygramView';
import { drawContinue } from '../src/render/continueView';
import { drawGameOver } from '../src/render/gameOverView';
import { drawHud } from '../src/render/hud';
import type { HudData } from '../src/game/hud';
import type { MapData } from '../src/game/screens/mapdata';
import type { StoreStatus } from '../src/game/levelstate';
import { floorY } from '../src/content/layout';

const outDir = process.argv[2] ?? 'playtest-out/screens';
const scale = Number(process.argv[3] ?? 2);
mkdirSync(outDir, { recursive: true });

const press = (mask: number): Pad => ({ held: mask, pressed: mask, released: 0 });

/** Tile framebuffers into a grid PNG with a 2 px gutter. */
function sheet(name: string, fbs: Framebuffer[], cols: number): void {
  const rows = Math.ceil(fbs.length / cols);
  const gut = 2;
  const W = cols * (256 * scale + gut) - gut;
  const H = rows * (240 * scale + gut) - gut;
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 40;
    out[i + 1] = 40;
    out[i + 2] = 40;
    out[i + 3] = 255;
  }
  fbs.forEach((fb, n) => {
    const rgba = new Uint8ClampedArray(256 * 240 * 4);
    fb.toRGBA(rgba);
    const ox = (n % cols) * (256 * scale + gut);
    const oy = Math.floor(n / cols) * (240 * scale + gut);
    for (let y = 0; y < 240 * scale; y++) {
      const sy = Math.floor(y / scale);
      for (let x = 0; x < 256 * scale; x++) {
        const sx = Math.floor(x / scale);
        const si = (sy * 256 + sx) * 4;
        const di = ((oy + y) * W + ox + x) * 4;
        out[di] = rgba[si]!;
        out[di + 1] = rgba[si + 1]!;
        out[di + 2] = rgba[si + 2]!;
        out[di + 3] = 255;
      }
    }
  });
  writeFileSync(`${outDir}/${name}.png`, encodePng(out, W, H));
  console.log('wrote', `${outDir}/${name}.png`, `(${fbs.length} frames)`);
}

function attempt(name: string, fn: () => Framebuffer[], cols = 2): void {
  try {
    sheet(name, fn(), cols);
  } catch (e) {
    console.log(`SKIPPED ${name}: ${(e as Error).message}`);
  }
}

const shot = (draw: (fb: Framebuffer) => void): Framebuffer => {
  const fb = new Framebuffer();
  fb.clear(C.BLACK);
  draw(fb);
  return fb;
};

// ---------------------------------------------------------------- splash
attempt('splash', () => {
  const s = new FlickerSplash();
  const frames: Framebuffer[] = [];
  for (const f of [10, 11, 40, 70, 80, 150]) {
    while (s.frame < f) s.step(NO_PAD);
    frames.push(shot((fb) => s.draw(fb)));
  }
  return frames;
}, 3);

// ---------------------------------------------------------------- title
attempt('title', () => {
  const t = new TitleScreen({ hiScore: 12340 });
  const frames: Framebuffer[] = [];
  for (let i = 0; i < 100; i++) t.step(NO_PAD);
  frames.push(shot((fb) => drawTitle(fb, t)));
  for (let i = 0; i < 180; i++) t.step(NO_PAD);
  frames.push(shot((fb) => drawTitle(fb, t)));
  const bf = new TitleScreen({ hiScore: 12340 });
  for (const b of [Btn.UP, ...KONAMI_CODE]) {
    bf.step(press(b));
    bf.step(NO_PAD);
  }
  frames.push(shot((fb) => drawTitle(fb, bf)));
  for (let i = 0; i < 20; i++) bf.step(NO_PAD);
  frames.push(shot((fb) => drawTitle(fb, bf)));
  return frames;
});

// ---------------------------------------------------------------- map + pause
const statuses = {} as Record<StoreId, StoreStatus>;
for (const s of STORES) statuses[s.id] = s.role === 'closed' ? 'closed' : s.role === 'powerup' ? 'powerup' : 'package';
statuses.forever12 = 'cleared';
statuses.kgbtoys = 'cleared';
const mapBase: MapData = {
  frame: 0,
  cars: [
    { shaft: 'A', y: floorY(1) + 10 },
    { shaft: 'B', y: floorY(3) },
    { shaft: 'C', y: floorY(4) - 20 },
  ],
  player: { x: 380, y: floorY(2), inStore: null },
  statuses,
  radar: false,
  inventory: 'EXPIRED COUPON, PRE-OWNED STRATEGY GUIDE, PET ROCK, MOOD RING, 1 SHARE (DOWN 99%), PHOTO STRIP',
  blackFriday: false,
};
attempt('map', () => [
  shot((fb) => drawMapView(fb, { ...mapBase, frame: 0 })),
  shot((fb) => drawMapView(fb, { ...mapBase, frame: 20, radar: true, player: { x: 500, y: floorY(5), inStore: null } })),
  shot((fb) => drawMapView(fb, { ...mapBase, frame: 0, radar: true, player: { x: 0, y: 0, inStore: 'hotspy' }, inventory: 'NONE YET', blackFriday: true })),
  shot((fb) => drawMapView(fb, { ...mapBase, frame: 0, player: { x: 60, y: floorY(0), inStore: null }, inventory: 'NONE YET' })),
]);

attempt('pause', () => [
  shot((fb) => {
    drawMapView(fb, mapBase);
    drawPauseOverlay(fb, 0);
  }),
  shot((fb) => {
    drawMapView(fb, mapBase);
    drawPauseOverlay(fb, 50);
  }),
]);

// ---------------------------------------------------------------- level clear
attempt('levelclear-drive', () => {
  const s = new LevelClearScreen({ rng: new Rng(5), packages: 6, timeBonus: 1840, clearBonus: 1000, loop: 2, score: 8200 });
  const frames: Framebuffer[] = [];
  for (const f of [10, 60, 90, 120, 160, 215]) {
    while (s.phaseFrame < f) s.step(NO_PAD);
    frames.push(shot((fb) => drawLevelClear(fb, s)));
  }
  return frames;
}, 3);

attempt('levelclear-tally', () => {
  const s = new LevelClearScreen({ rng: new Rng(5), packages: 6, timeBonus: 1840, clearBonus: 1000, loop: 2, score: 8200 });
  s.step(press(Btn.START));
  const frames: Framebuffer[] = [];
  for (const f of [12, 60, 140, 230, 300, 380]) {
    while (s.phaseFrame < f) s.step(NO_PAD);
    frames.push(shot((fb) => drawLevelClear(fb, s)));
  }
  return frames;
}, 3);

attempt('levelclear-news-spygram', () => {
  const frames: Framebuffer[] = [];
  for (const seed of [1, 2, 3]) {
    const s = new LevelClearScreen({ rng: new Rng(seed), packages: 6, timeBonus: 1840, clearBonus: 1000, loop: 2, score: 8200 });
    s.step(press(Btn.START));
    s.step(press(Btn.START));
    while (s.phaseFrame < 60) s.step(NO_PAD);
    frames.push(shot((fb) => drawLevelClear(fb, s)));
    s.step(press(Btn.START));
    while (s.phaseFrame < 160) s.step(NO_PAD);
    frames.push(shot((fb) => drawLevelClear(fb, s)));
  }
  return frames;
}, 3);

attempt('spygram-standalone', () => {
  const post = SPYGRAM_ARRIVAL[0]!;
  return [
    shot((fb) => {
      fb.clear(C.SKY);
      drawSpygram(fb, post, spygramLikes(10, 4), 10);
    }),
    shot((fb) => {
      fb.clear(C.SKY);
      drawSpygram(fb, SPYGRAM_ARRIVAL[3]!, spygramLikes(150, 4), 150, { x: 4, y: 30 });
    }),
  ];
});

// ---------------------------------------------------------------- continue + game over
attempt('continue', () => {
  const frames: Framebuffer[] = [];
  for (const f of [3, 130, 400, 500]) {
    const s = new ContinueScreen({ continuesLeft: 2 });
    while (s.frame < f) s.step(NO_PAD);
    frames.push(shot((fb) => drawContinue(fb, s)));
  }
  return frames;
});

attempt('gameover', () => {
  const frames: Framebuffer[] = [];
  const s = new GameOverScreen({ score: 41230, hiScore: 41230 });
  for (const f of [70, 150, 200, 260, 330, 400]) {
    while (s.frame < f) s.step(NO_PAD);
    frames.push(shot((fb) => drawGameOver(fb, s)));
  }
  return frames;
}, 3);

// ---------------------------------------------------------------- HUD
const hudBase: HudData = { score: 12340, packages: 3, lives: 3, timed: null, armor: false, radar: false, alarm: false, floor: 2, marquee: null, frame: 0 };
attempt('hud', () => {
  const variants: HudData[] = [
    hudBase,
    { ...hudBase, packages: 6, floor: 0, armor: true },
    { ...hudBase, score: 999999, lives: 9, timed: { name: 'ORANGE JULI-OOZE', frac: 0.6 }, armor: true, radar: true, alarm: true, floor: 5 },
    { ...hudBase, timed: { name: 'RAPID FIRE', frac: 0.2 }, radar: true, floor: null, marquee: 'BLOCKBLUSTER VIDEO', frame: 60 },
    { ...hudBase, floor: null, marquee: 'FOREVER 12', frame: 10, alarm: true },
    { ...hudBase, floor: 1, timed: { name: 'CINNABOMB', frac: 1 }, frame: 4 },
  ];
  return variants.map((h) =>
    shot((fb) => {
      fb.clear(C.GRAY);
      drawHud(fb, h);
    }),
  );
}, 2);

