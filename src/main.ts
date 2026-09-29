import { MusicPlayer } from './audio/music';
import { playSfx } from './audio/sfx';
import { AudioEngine } from './audio/synth';
import { FPS } from './core/constants';
import { gotoTitle, newGame, showToast, stepGame, currentMusic, debugReadyToExit } from './core/game';
import {
  Button,
  InputSource,
  Pad,
  gamepadMask,
  resolveKey,
  type SystemKey,
} from './core/input';
import { FixedLoop } from './core/loop';
import { parseSeed } from './core/rng';
import type { GameState } from './core/types';
import { Display } from './render/display';
import { drawGallery } from './render/gallery';
import { Renderer } from './render/renderer';

/**
 * The shell. It owns the browser: the canvas, the clock, the listeners and the
 * audio device. It runs the rules, drains their events, and draws the result.
 * No game rule lives in this file.
 */

// ---------------------------------------------------------------------------
// Options from the query string
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const GALLERY = params.get('gallery') === '1';
const SEED = parseSeed(params.get('seed'), (Date.now() ^ 0x5eed) >>> 0);

const STORAGE_CRT = 'mallaction.crt';
const STORAGE_MUTE = 'mallaction.mute';
const STORAGE_HIGH = 'mallaction.highscore';

function loadFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function saveFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Private mode / blocked storage: the choice just will not persist.
  }
}

function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(STORAGE_HIGH)) || 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Fatal message
// ---------------------------------------------------------------------------

function fatal(title: string, detail: string): void {
  const el = document.getElementById('fatal');
  const canvas = document.getElementById('screen');
  if (canvas) (canvas as HTMLElement).style.display = 'none';
  if (el) {
    el.style.display = 'block';
    el.innerHTML = `<b>${title}</b>${detail}`;
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
if (!canvas) {
  fatal('MALL ACTION could not start', 'The page is missing its canvas element.');
} else {
  boot(canvas);
}

function boot(canvas: HTMLCanvasElement): void {
  const display = new Display(canvas);
  if (!display.init()) {
    fatal(
      'GRAPHICS NOT SUPPORTED',
      'MALL ACTION needs WebGL or a 2D canvas, and this browser provides neither. ' +
        'Try a current desktop version of Chrome, Firefox, Edge or Safari, and check that ' +
        'hardware acceleration is enabled.',
    );
    return;
  }

  display.crtEnabled = loadFlag(STORAGE_CRT, true); // ON by default
  display.resize();
  window.addEventListener('resize', () => display.resize());

  const audio = new AudioEngine();
  audio.muted = loadFlag(STORAGE_MUTE, false);
  const music = new MusicPlayer(audio);

  const g: GameState = newGame({
    seed: SEED,
    highScore: loadHighScore(),
    skipSplash: DEBUG, // ?debug=1 also skips the studio splash
    debug: DEBUG,
  });

  const renderer = new Renderer();
  const input = new InputSource();
  const pad = new Pad();
  const loop = new FixedLoop();

  let galleryPage = 0;

  // --- keyboard ----------------------------------------------------------
  const onKeyDown = (e: KeyboardEvent) => {
    const r = resolveKey(e.key, e.code);
    if (r.system) {
      if (!e.repeat) input.pushSystem(r.system);
      e.preventDefault();
      return;
    }
    if (r.mask !== 0) {
      input.pressCode(e.code, r.mask);
      // Arrows, space and tab would otherwise scroll the page or move focus.
      e.preventDefault();
    }
    audio.unlock();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    // Release by CODE, always: the mask captured at keydown is the one cleared,
    // so a key can never get stuck if the layout or modifiers changed.
    input.releaseCode(e.code);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // Losing focus with a key held would otherwise leave it stuck down.
  window.addEventListener('blur', () => input.clearAll());
  window.addEventListener('pointerdown', () => audio.unlock());

  // --- gamepad -----------------------------------------------------------
  window.addEventListener('gamepadconnected', () => {});
  window.addEventListener('gamepaddisconnected', () => {
    input.external = 0;
  });

  function pollGamepads(): number {
    if (typeof navigator.getGamepads !== 'function') return 0;
    let mask = 0;
    for (const gp of navigator.getGamepads()) {
      if (!gp) continue;
      mask |= gamepadMask(gp);
    }
    return mask;
  }

  // --- system toggles ----------------------------------------------------
  function applySystem(key: SystemKey): void {
    audio.unlock();
    if (key === 'crt') {
      display.crtEnabled = !display.crtEnabled;
      saveFlag(STORAGE_CRT, display.crtEnabled);
      showToast(g, display.crtEnabled ? 'CRT ON' : 'CRT OFF');
      playSfx(audio, 'select');
    } else {
      audio.setMuted(!audio.muted);
      saveFlag(STORAGE_MUTE, audio.muted);
      showToast(g, audio.muted ? 'SOUND OFF' : 'SOUND ON');
      if (!audio.muted) playSfx(audio, 'select');
    }
  }

  // --- one simulation step -----------------------------------------------
  function step(): void {
    input.external = pollGamepads();
    for (const key of input.drainSystem()) applySystem(key);

    pad.update(input.sample());

    if (GALLERY) {
      if (pad.pressed(Button.Right)) galleryPage++;
      if (pad.pressed(Button.Left)) galleryPage--;
      renderer.clock++;
      return;
    }

    const anyPressed = pad.anyPressed();
    const r = renderer.tick(g, anyPressed);
    if (r.playJingle) music.play('splash');

    stepGame(g, pad);

    // The splash module owns its own timing; keep the game state in step.
    if (g.screen === 'splash' && r.splashDone) gotoTitle(g);

    // Music is ducked, not stopped, while paused; all timers are already
    // frozen by the rules.
    music.setDucked(g.overlay !== 'none');
    music.tick();

    drainEvents();
  }

  function drainEvents(): void {
    for (const e of g.bus.drain()) {
      switch (e.t) {
        case 'sfx':
          playSfx(audio, e.id);
          break;
        case 'music':
          music.play(e.id === 'none' ? 'none' : e.id);
          break;
        case 'shake':
          renderer.shake(e.frames, e.power);
          break;
        case 'flash':
          renderer.flash(e.frames);
          break;
        case 'toast':
          showToast(g, e.text);
          break;
      }
    }
  }

  // --- the frame loop ----------------------------------------------------
  let last = performance.now();
  let savedHigh = g.highScore;

  function frame(now: number): void {
    const steps = loop.advance(now - last);
    last = now;
    for (let i = 0; i < steps; i++) step();

    if (GALLERY) {
      drawGallery(renderer.fb, renderer.clock, galleryPage);
      display.present(renderer.fb);
    } else {
      display.present(renderer.draw(g));
    }

    // Persist the high score when it changes.
    if (g.highScore > savedHigh) {
      savedHigh = g.highScore;
      try {
        localStorage.setItem(STORAGE_HIGH, String(savedHigh));
      } catch {
        /* ignore */
      }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- ?debug=1 ----------------------------------------------------------
  if (DEBUG) {
    /**
     * Exposed for automated playtests:
     *   MALLACTION.state                 the live game state
     *   MALLACTION.step(n, buttons)      run n frames with `buttons` held
     *   MALLACTION.press(button, n)      tap a button for n frames
     *   MALLACTION.Button                the button flags
     */
    const api = {
      get state() {
        return g;
      },
      Button,
      display,
      audio,
      renderer,
      music,
      step(frames = 1, buttons = 0): GameState {
        for (let i = 0; i < frames; i++) {
          for (const key of input.drainSystem()) applySystem(key);
          input.external = buttons;
          pad.update(input.sample());
          const r = renderer.tick(g, pad.anyPressed());
          if (r.playJingle) music.play('splash');
          stepGame(g, pad);
          if (g.screen === 'splash' && r.splashDone) gotoTitle(g);
          music.tick();
          drainEvents();
        }
        input.external = 0;
        return g;
      },
      press(button: number, frames = 2): GameState {
        api.step(frames, button);
        return api.step(2, 0);
      },
      readyToExit(): void {
        debugReadyToExit(g);
      },
      music_: () => currentMusic(g),
      fps: FPS,
    };
    (window as unknown as { MALLACTION: typeof api }).MALLACTION = api;
    console.log('[MALL ACTION] debug API on window.MALLACTION, seed =', SEED);
  }
}
