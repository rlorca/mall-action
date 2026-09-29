// Dev-only harness (see /store-preview.html). ?store=<id> &seed=N &radar=1 &power=rapid|spread|sneakers|cinnabomb|juice
// &armor=1 &alarm=1 &pkgs=3 &scale=3 &opened=1 (open everything). Keys: arrows/WASD move, Z shoot, X/Space search.
// Debug hook: window.__p = { w, step(n, held), banner(lines,kind), ... }.
import { Surface } from '../art/surface';
import { EventBuffer } from '../core/events';
import type { StoreId } from '../core/events';
import { PadTracker, type Buttons } from '../core/pad';
import { OPEN_STORES, STORE_BY_ID, TARGET_STORES } from '../data/stores';
import { createStore, type StoreWorld } from '../game/store';
import { applyPowerup, newProgress, type PowerupKind } from '../game/progress';
import { drawHud } from './hud';
import { Overlay, drawFade } from './overlay';
import { drawStore } from './storeView';

const q = new URLSearchParams(location.search);
const id = (q.get('store') ?? 'forever12') as StoreId;
const scale = Number(q.get('scale') ?? 3);
const seed = Number(q.get('seed') ?? 1234);
const progress = newProgress(seed, q.get('bf') === '1');
const pw = q.get('power');
if (pw) for (const k of pw.split(',')) applyPowerup(progress, k as PowerupKind);
if (q.get('armor')) applyPowerup(progress, 'armor');
if (q.get('radar')) applyPowerup(progress, 'radar');
const npk = Number(q.get('pkgs') ?? 0);
progress.packages = TARGET_STORES.filter((t) => t !== id).slice(0, npk);
progress.score = Number(q.get('score') ?? 12340);
progress.lives = Number(q.get('lives') ?? 3);
if (q.get('visited')) progress.visited = OPEN_STORES.slice();
if (q.get('egg') === '0') progress.gamestonkEggDone = true;

let w: StoreWorld = createStore({ id, seed, progress });
if (q.get('opened')) for (const f of w.fixtures) f.open = true;

const tp = q.get('tp');
if (tp) { const [x, y] = tp.split(',').map(Number); w.player.x = x; w.player.y = y; }
const find = q.get('find');
if (find) {
  const i = w.fixtures.findIndex((f, k) => ((w.debugContent(k) as { kind: string }).kind === find || f.kind === find) && !f.open);
  if (i >= 0) { const f = w.fixtures[i]; w.player.x = f.tx * 16; w.player.y = (f.ty + 1) * 16; w.player.facing = 'up'; }
}
const nav = document.getElementById('nav')!;
nav.innerHTML = OPEN_STORES.map((s) => `<a href="?store=${s}${location.search.replace(/[?&]store=[^&]*/, '').replace(/^\?/, '&')}">${s}</a>`).join('');

const surf = new Surface(256, 240);
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = 256 * scale;
canvas.height = 240 * scale;
const out = canvas.getContext('2d')!;
const overlay = new Overlay();
const tracker = new PadTracker();
const sink = new EventBuffer();
const held: Partial<Buttons> = {};
const KEYS: Record<string, keyof Buttons> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
  z: 'a', j: 'a', x: 'b', k: 'b', ' ': 'b', Enter: 'start', Shift: 'select',
};
addEventListener('keydown', (e) => {
  const b = KEYS[e.key];
  if (b) { held[b] = true; e.preventDefault(); }
});
addEventListener('keyup', (e) => {
  const b = KEYS[e.key];
  if (b) held[b] = false;
});

let tick = 0;
let fade = 0;
const plan = q.get('plan');
function step(n = 1, hold: Partial<Buttons> = held): void {
  for (let i = 0; i < n; i++) {
    const pad = tracker.next(hold);
    w.step(pad, sink);
    for (const ev of sink.drain()) overlay.handle(ev);
    overlay.update();
    tick++;
  }
}
function render(): void {
  const off = overlay.shakeOffset();
  surf.clear(0x0f);
  drawStore(surf, w, tick);
  drawHud(surf, {
    progress,
    floorLabel: STORE_BY_ID[id].floor,
    marquee: q.get('nomarquee') ? null : STORE_BY_ID[id].name,
    alarm: q.get('alarm') === '1',
    tick,
  });
  overlay.draw(surf, w.camera);
  const fa = overlay.flashAlpha();
  if (fa > 0) { surf.setAlpha(fa); surf.rect(0, 0, 256, 240, 0x30); surf.setAlpha(1); }
  if (fade > 0) drawFade(surf, fade);
  out.imageSmoothingEnabled = false;
  out.fillStyle = '#000';
  out.fillRect(0, 0, canvas.width, canvas.height);
  out.drawImage(surf.canvas, off.x * scale, off.y * scale, 256 * scale, 240 * scale);
}
if (plan) {
  // plan=up:30,b:2,idle:60 (held buttons joined by +) runs before the first render, then the world runs normally.
  for (const seg of plan.split(',')) {
    const [names, n] = seg.split(':');
    const hold: Partial<Buttons> = {};
    for (const nm of names.split('+')) if (nm !== 'idle') hold[nm as keyof Buttons] = true;
    step(Number(n), hold);
  }
}
let last = performance.now();
let acc = 0;
function frame(now: number): void {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    if (!q.get('freeze')) step();
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { __p: unknown }).__p = {
  get w() { return w; },
  progress,
  overlay,
  step: (n: number, hold: Partial<Buttons> = {}) => { step(n, hold); render(); },
  setFade: (f: number) => { fade = f; },
  toast: (t: string) => overlay.toast(t),
  banner: (lines: string[], kind?: string) => overlay.handle({ t: 'banner', lines, kind: kind as never }),
  tp: (x: number, y: number) => { w.player.x = x; w.player.y = y; },
  reload: () => { w = createStore({ id, seed, progress }); },
};
