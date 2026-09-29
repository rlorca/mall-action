// Dev-only harness (see /mall-preview.html): draws the mall view at 3x with a plain canvas.
// URL params: seed=N, arrival=1 (start with the zip-line), floor=4F, x=300, run=N (frames to simulate first),
//             pause=1 (start paused), scale=3. Keys: arrows, Z (shoot), X (jump), P (pause), N (step 1 frame).
// window.mp exposes { w, step(n, held), place(floor, x), cam(x, y), spy(floor, x), draw() } for automated screenshots.
import { Surface } from '../art/surface';
import { emptyPad, PadTracker, type Buttons } from '../core/pad';
import { EventBuffer } from '../core/events';
import { createMall, type MallWorld } from '../game/mall';
import { newProgress } from '../game/progress';
import { FLOOR_Y } from '../game/geometry';
import type { Floor } from '../data/stores';
import { drawMall } from './mallView';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? 1);
const scale = Number(q.get('scale') ?? 3);
const progress = newProgress(seed, q.get('bf') === '1');
const w: MallWorld = createMall({ seed, progress, skipArrival: q.get('arrival') !== '1' });
const surf = new Surface(256, 240);
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = 256 * scale;
canvas.height = 240 * scale;
const out = canvas.getContext('2d')!;
const info = document.getElementById('info')!;
const sink = new EventBuffer();
const tracker = new PadTracker();
const keys = new Set<string>();
let paused = q.get('pause') === '1';
let tick = 0;

function held(): Partial<Buttons> {
  return {
    up: keys.has('ArrowUp'),
    down: keys.has('ArrowDown'),
    left: keys.has('ArrowLeft'),
    right: keys.has('ArrowRight'),
    a: keys.has('z'),
    b: keys.has('x'),
    start: keys.has('Enter'),
  };
}
function step(n = 1, h: Partial<Buttons> = {}): void {
  for (let i = 0; i < n; i++) {
    w.step(tracker.next(h), sink);
    sink.drain();
    tick++;
  }
}
function place(floor: Floor, x: number): void {
  const p = w.s.player;
  p.x = x;
  p.y = FLOOR_Y[floor];
  p.floor = floor;
  p.safeX = x;
  p.safeFloor = floor;
  p.mode = 'walk';
  p.vx = 0;
  p.vy = 0;
  p.hidden = false;
  w.s.phase = 'play';
  cam(Math.round(x - 128), Math.round(p.y - 12 - 112));
}
function cam(x: number, y: number): void {
  w.s.camera.x = Math.max(0, Math.min(768 - 256, x));
  w.s.camera.y = Math.max(0, Math.min(400 - 224, y));
}
function draw(): void {
  surf.clear(0x0f);
  drawMall(surf, w, tick);
  out.imageSmoothingEnabled = false;
  out.drawImage(surf.canvas, 0, 0, 256 * scale, 240 * scale);
  info.textContent = `phase ${w.s.phase} mode ${w.s.player.mode} floor ${w.s.player.floor} x ${Math.round(w.s.player.x)} y ${Math.round(w.s.player.y)} cam ${w.s.camera.x},${w.s.camera.y} frame ${w.s.frame}`;
}

addEventListener('keydown', (e) => {
  keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (e.key === 'p') paused = !paused;
  if (e.key === 'n') step(1, held());
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));

const fl = q.get('floor') as Floor | null;
if (fl) place(fl, Number(q.get('x') ?? 300));
const run = Number(q.get('run') ?? 0);
if (run) step(run);
if (fl) cam(w.s.camera.x, w.s.camera.y);

(window as unknown as Record<string, unknown>).mp = { w, step, place, cam, draw, spy: (f: Floor, x: number) => w.spawnSpy(f, x, { emerge: false }), pad: emptyPad, setPaused: (b: boolean) => (paused = b) };

const js = q.get('js');
if (js) new Function('mp', 'w', 'step', 'place', 'cam', js)((window as unknown as Record<string, unknown>).mp, w, step, place, cam);

let acc = 0;
let last = performance.now();
function frame(now: number): void {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    if (!paused) step(1, held());
    else tick++;
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
