/**
 * Browser entry point: wires input, the fixed-step loop, audio and rendering around the pure game rules.
 * URL options: ?seed=N  ?debug=1  ?gallery=1
 */
import { FixedLoop } from './core/loop';
import { VirtualPad, readGamepad, BUTTONS, type Button, type PadFrame } from './core/input';
import { createGame, step, musicFor, humOn } from './game/game';
import type { GameState } from './game/state';
import { Gfx } from './render/gfx';
import { Presenter, webglAvailable } from './render/crt';
import { render, type Toast } from './render/render';
import { drawGallery } from './render/gallery';
import { Synth } from './audio/synth';
import { playSplashJingle } from './splash/jingle';
import { BANNERS } from './game/copy';
import { roomFor } from './game/rooms';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const GALLERY = params.get('gallery') === '1';
const seedParam = params.get('seed');
const SEED = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : (Date.now() ^ (Math.random() * 1e9)) >>> 0;

function load(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function save(key: string, v: boolean): void {
  try {
    localStorage.setItem(key, v ? '1' : '0');
  } catch {
    /* storage blocked: the choice just won't persist */
  }
}

function showNoWebGL(app: HTMLElement): void {
  app.innerHTML =
    '<div id="nogl"><b>MALL ACTION needs WebGL.</b><br>Your browser or device has WebGL turned off or unsupported. ' +
    'Please enable hardware acceleration or try a current Chrome, Firefox, Safari or Edge.</div>';
}

function boot(): void {
  const app = document.getElementById('app')!;
  if (!webglAvailable()) {
    showNoWebGL(app);
    return;
  }
  let presenter: Presenter;
  try {
    presenter = new Presenter(app);
  } catch {
    showNoWebGL(app);
    return;
  }
  const gx = new Gfx();
  const pad = new VirtualPad();
  const synth = new Synth();
  let crt = load('mallaction.crt', true);
  synth.muted = load('mallaction.mute', false);
  let toast: Toast | null = null;
  const g: GameState = createGame({ seed: SEED, skipSplash: DEBUG });

  // ---------------------------------------------------------------- input
  const unlock = () => synth.unlock();
  window.addEventListener('keydown', (e) => {
    unlock();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const sys = pad.keyDown(e.key, e.code);
    if (sys === 'crt') {
      crt = !crt;
      save('mallaction.crt', crt);
      toast = { text: crt ? BANNERS.crtOn : BANNERS.crtOff, t: 90 };
    } else if (sys === 'mute') {
      synth.setMuted(!synth.muted);
      save('mallaction.mute', synth.muted);
      toast = { text: synth.muted ? BANNERS.soundOff : BANNERS.soundOn, t: 90 };
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Enter', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => pad.keyUp(e.key, e.code));
  window.addEventListener('blur', () => pad.releaseAll());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pad.releaseAll();
  });
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('gamepaddisconnected', (e) => pad.dropPad((e as GamepadEvent).gamepad.index));
  window.addEventListener('resize', () => presenter.resize());

  const knownPads = new Set<number>();
  function pollGamepads(): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const seen = new Set<number>();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      seen.add(gp.index);
      const down = readGamepad(gp.buttons, gp.axes);
      if (down.size) unlock();
      for (const b of BUTTONS) pad.setPadButton(b, gp.index, down.has(b));
    }
    for (const i of knownPads) if (!seen.has(i)) pad.dropPad(i);
    knownPads.clear();
    for (const i of seen) knownPads.add(i);
  }

  // ---------------------------------------------------------------- audio events
  function drainEvents(): void {
    for (const ev of g.events) {
      if (ev.t === 'sfx') synth.sfx(ev.id);
      else if (ev.t === 'jingle') synth.jingle(ev.id);
      else if (ev.t === 'splashJingle') {
        const out = synth.output();
        if (synth.ctx && out) playSplashJingle(synth.ctx, out);
      }
    }
    g.events.length = 0;
  }
  function syncAudio(): void {
    synth.song(musicFor(g));
    synth.setDuck(g.overlay ? 0.3 : 1);
    synth.hum(humOn(g));
  }

  function draw(): void {
    render(gx, g, toast);
    presenter.present(gx.canvas, crt, performance.now() / 1000);
  }

  let frozen = false;
  // ---------------------------------------------------------------- debug API (?debug=1)
  if (DEBUG) {
    let prev = new Set<Button>();
    (window as unknown as { __mall: unknown }).__mall = {
      game: g,
      seed: SEED,
      roomFor,
      /** Step the game n frames holding the given buttons (new ones count as pressed on the first frame). */
      step(n: number, held: Button[] = []): GameState {
        for (let i = 0; i < n; i++) {
          const frame: PadFrame = { held: new Set(held), pressed: new Set(held.filter((b) => !prev.has(b))) };
          prev = new Set(held);
          step(g, frame);
          drainEvents();
        }
        syncAudio();
        draw();
        return g;
      },
      /** Press and release buttons for a single frame. */
      tap(buttons: Button[]): GameState {
        prev = new Set();
        const frame: PadFrame = { held: new Set(buttons), pressed: new Set(buttons) };
        step(g, frame);
        prev = new Set();
        drainEvents();
        draw();
        return g;
      },
      crt: (on: boolean) => {
        crt = on;
      },
      /** Freeze (true) or resume (false) the real-time loop, so scripted steps are the only input. */
      freeze: (on: boolean) => {
        frozen = on;
      },
    };
  }

  // ---------------------------------------------------------------- main loop
  if (GALLERY) {
    let t = 0;
    let scroll = 0;
    const tick = () => {
      t++;
      pollGamepads();
      const f = pad.sample();
      if (f.held.has('down')) scroll += 3;
      if (f.held.has('up')) scroll = Math.max(0, scroll - 3);
      drawGallery(gx, t, scroll);
      presenter.present(gx.canvas, crt, performance.now() / 1000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return;
  }

  const loop = new FixedLoop();
  let last = performance.now();
  const frame = (now: number) => {
    const n = frozen ? 0 : loop.advance(now - last);
    last = now;
    pollGamepads();
    for (let i = 0; i < n; i++) {
      step(g, pad.sample());
      drainEvents();
      if (toast && --toast.t <= 0) toast = null;
    }
    syncAudio();
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
