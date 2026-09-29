// Dev harness (see /screens-preview.html): shows one screen at 3x with keyboard-driven state.
//   ?screen=title|map|pause|levelclear|continue|gameover|spygram   &frame=N (fast-forward)  &konami=1  &radar=1
//   &store=kgbtoys (map: inside a store)  &score=N  &idx=N (spygram index)
// window.__prev.step(n, ['start', ...]) drives the state from automation.
import { EventBuffer } from '../core/events';
import { PadTracker, type Buttons, emptyButtons } from '../core/pad';
import { Rng } from '../core/rng';
import { newProgress } from '../game/progress';
import { createMall } from '../game/mall';
import type { StoreId } from '../core/events';
import { SPYGRAM_ARRIVAL, SPYGRAM_COMPLETE } from '../data/copy';
import { Surface } from '../art/surface';
import { TitleState, drawTitle } from './title';
import { drawMap } from './map';
import { drawPause } from './pause';
import { LevelClearState, drawLevelClear } from './levelclear';
import { ContinueState, drawContinue } from './continue';
import { GameOverState, drawGameOver } from './gameover';
import { drawSpygramCard, SPYGRAM_CARD_H, SPYGRAM_CARD_W } from './spygram';
import { C } from '../core/palette';

const q = new URLSearchParams(location.search);
const screen = q.get('screen') ?? 'title';
const SCALE = 3;
const surf = new Surface();
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = 256 * SCALE;
canvas.height = 240 * SCALE;
const out = canvas.getContext('2d')!;
const logEl = document.getElementById('log')!;
const bar = document.getElementById('bar')!;
for (const n of ['title', 'map', 'pause', 'levelclear', 'continue', 'gameover', 'spygram']) {
  const a = document.createElement('a');
  a.href = `?screen=${n}`;
  a.textContent = n;
  bar.appendChild(a);
}

const progress = newProgress(7);
progress.packages = ['forever12', 'kgbtoys'];
progress.inventory = ['PET ROCK', 'EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE'];
progress.photoStrip = true;
progress.score = Number(q.get('score') ?? 4200);
progress.levelFrames = 60 * 140;
if (q.get('radar') === '1') progress.power.radar = true;
if (q.get('full') === '1') progress.packages = ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlockpicker'];
const rng = new Rng(Number(q.get('seed') ?? 3));

const title = new TitleState(12345);
let lc = new LevelClearState(progress, rng);
const cont = new ContinueState(progress);
const over = new GameOverState(progress.score, 3000);
const world = createMall({ seed: 1, progress, skipArrival: true });
let spyIdx = Number(q.get('idx') ?? 0);
let spyFrames = 0;
let tick = 0;

const tracker = new PadTracker();
const buf = new EventBuffer();
const held: Buttons = emptyButtons();
const KEYS: Record<string, keyof Buttons> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'a', x: 'b', Shift: 'select', Enter: 'start',
};
addEventListener('keydown', (e) => {
  const b = KEYS[e.key];
  if (b) {
    held[b] = true;
    e.preventDefault();
  }
});
addEventListener('keyup', (e) => {
  const b = KEYS[e.key];
  if (b) held[b] = false;
});

function stepOnce(h: Partial<Buttons>): void {
  const pad = tracker.next(h);
  tick++;
  switch (screen) {
    case 'title':
    case 'pause':
      title.update(pad, buf);
      break;
    case 'levelclear':
      lc.update(pad, buf);
      break;
    case 'continue':
      cont.update(pad, buf);
      break;
    case 'gameover':
      over.update(pad, buf);
      break;
    case 'spygram':
      spyFrames++;
      if (pad.pressed.start) {
        spyIdx++;
        spyFrames = 0;
      }
      break;
    default:
      break;
  }
  const ev = buf.drain();
  if (ev.length) logEl.textContent = ev.map((e) => (e.t === 'sfx' ? 'sfx:' + e.name : e.t === 'music' ? 'music:' + e.name : e.t)).join(' ');
}

function draw(): void {
  switch (screen) {
    case 'title':
      drawTitle(surf, title);
      break;
    case 'pause':
      drawTitle(surf, title);
      drawPause(surf, tick);
      break;
    case 'map': {
      const snap = world.mapSnapshot();
      const store = q.get('store') as StoreId | null;
      drawMap(surf, snap, { progress, inStore: store, tick });
      break;
    }
    case 'levelclear':
      drawLevelClear(surf, lc);
      break;
    case 'continue':
      drawContinue(surf, cont);
      break;
    case 'gameover':
      drawGameOver(surf, over);
      break;
    case 'spygram': {
      surf.clear(C.PURPLE_D);
      const list = q.get('set') === 'arrival' ? SPYGRAM_ARRIVAL : SPYGRAM_COMPLETE;
      drawSpygramCard(surf, list[spyIdx % list.length], { x: (256 - SPYGRAM_CARD_W) >> 1, y: (240 - SPYGRAM_CARD_H) >> 1, frames: spyFrames });
      break;
    }
  }
  out.imageSmoothingEnabled = false;
  out.drawImage(surf.canvas, 0, 0, 256 * SCALE, 240 * SCALE);
}

const KON: (keyof Buttons)[] = ['up', 'up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
if (q.get('konami') === '1') for (const b of KON) { stepOnce({ [b]: true }); stepOnce({}); }
const ff = Number(q.get('frame') ?? 0);
for (let i = 0; i < ff; i++) stepOnce({});

(window as unknown as Record<string, unknown>).__prev = {
  step(n: number, names: (keyof Buttons)[] = []): void {
    const h: Partial<Buttons> = {};
    for (const b of names) h[b] = true;
    for (let i = 0; i < n; i++) stepOnce(h);
    draw();
  },
  newLevelClear(): void {
    lc = new LevelClearState(progress, new Rng(Math.floor(Math.random() * 1e6)));
  },
  state: { title, get lc() { return lc; }, cont, over, progress },
};

let acc = 0;
let last = performance.now();
function frame(now: number): void {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    stepOnce(held);
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
