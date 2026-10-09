import { Game } from './core/game';
import { FixedStepLoop } from './core/loop';
import { InputMapper, isCrtKey, isMuteKey, padFromGamepads } from './core/input';
import { PadState, frameFrom, emptyPad } from './core/pad';
import { Gfx } from './render/gfx';
import { Crt } from './render/crt';
import { FrameRenderer } from './render/frame';
import { GameAudio } from './audio/index';
import { drawGallery } from './render/gallery';
import { UI } from './core/copy';

const params = new URLSearchParams(location.search);
const debug = params.get('debug') === '1';
const seedParam = params.get('seed');
const seed = seedParam !== null && /^-?\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : (Date.now() & 0xffffff) >>> 0;

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const nogl = document.getElementById('nogl') as HTMLDivElement;

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode etc: the choice just won't persist */
  }
}

function boot(): void {
  let gfx: Gfx;
  let crt: Crt;
  try {
    gfx = new Gfx();
    crt = new Crt(canvas, 256, 240, params.get('webgl') === '0');
  } catch (e) {
    nogl.style.display = 'block';
    nogl.textContent = 'MALL ACTION needs a browser with HTML canvas support. Please use a recent desktop Chrome, Firefox, Edge or Safari.';
    throw e;
  }
  if (!crt.ok) {
    nogl.style.display = 'block';
    nogl.textContent = 'WebGL is not available in this browser, so the CRT screen effect is disabled and the game runs in plain mode. Turn on hardware acceleration / WebGL (or try a recent Chrome, Firefox, Edge or Safari) for the full arcade look.';
  }
  const stored = safeGet('mallaction.crt');
  crt.enabled = stored === null ? true : stored === '1';
  const urlCrt = params.get('crt');
  if (urlCrt === '0') crt.enabled = false;
  if (urlCrt === '1') crt.enabled = true;

  const audio = new GameAudio();
  const muteStored = safeGet('mallaction.mute');
  if (muteStored === '1') audio.muted = true;

  if (params.get('gallery') === '1') {
    runGallery(gfx, crt);
    return;
  }

  // The high score lives only as long as the page ("per session"); only the CRT / mute choices persist.
  const game = new Game({ seed, skipSplash: debug });
  const renderer = new FrameRenderer(gfx);
  const input = new InputMapper();
  input.onAnyPress = () => audio.unlock();
  const loop = new FixedStepLoop();

  // ---- keyboard
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isCrtKey(e)) {
      if (!e.repeat) {
        if (crt.ok) {
          crt.enabled = !crt.enabled;
          safeSet('mallaction.crt', crt.enabled ? '1' : '0');
          renderer.showToast(crt.enabled ? UI.crtOn : UI.crtOff);
        } else renderer.showToast(UI.crtNeedsWebgl);
        audio.unlock();
      }
      e.preventDefault();
      return;
    }
    if (isMuteKey(e)) {
      if (!e.repeat) {
        audio.unlock();
        const m = audio.toggleMute();
        safeSet('mallaction.mute', m ? '1' : '0');
        renderer.showToast(m ? UI.soundOff : UI.soundOn);
      }
      e.preventDefault();
      return;
    }
    const btn = input.keyDown(e);
    if (btn) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    input.keyUp(e);
  });
  window.addEventListener('blur', () => input.releaseAll());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) input.releaseAll();
  });
  window.addEventListener('resize', () => crt.resize());
  window.addEventListener('gamepadconnected', () => renderer.showToast(UI.gamepadConnected));
  window.addEventListener('gamepaddisconnected', () => {
    input.releaseAll();
    renderer.showToast(UI.gamepadLost);
  });

  // ---- debug hooks (?debug=1)
  let paused = false;
  if (debug) {
    let prev: PadState = emptyPad();
    const api = {
      game,
      seed,
      audio,
      crt,
      renderer,
      /** Step the game N frames with the given buttons held (e.g. {right:true}). Returns the screen name. */
      step(n = 1, held: Partial<PadState> = {}): string {
        for (let i = 0; i < n; i++) {
          const fr = frameFrom(held, prev);
          prev = fr.held;
          game.step(fr);
          const evs = game.events.drain();
          renderer.onEvents(evs);
          audio.handle(evs);
        }
        return game.screen;
      },
      /** Stop / resume the real-time loop (so scripted stepping is deterministic). */
      pause(p = true): void {
        paused = p;
      },
      render(): void {
        renderer.draw(game);
        crt.present(gfx.canvas, performance.now() / 1000);
      },
    };
    (window as unknown as { __game: typeof api }).__game = api;
  }

  // ---- main loop (rendering is decoupled from the fixed 60 Hz simulation)
  let last = performance.now();
  const frame = (now: number) => {
    const dt = now - last;
    last = now;
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    input.setGamepad(padFromGamepads(pads as never));
    if (!paused) {
      const steps = loop.advance(dt);
      for (let i = 0; i < steps; i++) game.step(input.sample());
    }
    const evs = game.events.drain();
    renderer.onEvents(evs);
    audio.handle(evs);
    audio.update(game);
    renderer.draw(game);
    crt.present(gfx.canvas, now / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function runGallery(gfx: Gfx, crt: Crt): void {
  window.addEventListener('resize', () => crt.resize());
  let page = 0;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') page++;
    if (e.key === 'ArrowLeft') page = Math.max(0, page - 1);
    if (isCrtKey(e)) crt.enabled = !crt.enabled;
  });
  let f = 0;
  const loop = () => {
    f++;
    page = drawGallery(gfx, f, page);
    crt.present(gfx.canvas, performance.now() / 1000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot();
