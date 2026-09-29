// Browser bootstrap for MALL ACTION: DOM, fixed-step loop, presenter (WebGL + CRT), audio, input, debug hooks.
import { App } from './app';
import { createAudio, createNullAudio, type AudioApi } from './audio';
import { Presenter, showUnsupportedMessage } from './core/crt';
import { installDebugHooks, parseQuery } from './core/debug';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { loadCrt, loadHighScore, saveCrt, saveHighScore } from './core/storage';
import { mountGallery } from './art/gallery';

function start(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  const msg = document.getElementById('msg');
  if (!canvas) return;
  const q = parseQuery(window.location.search);

  if (q.gallery) {
    mountGallery(canvas);
    return;
  }
  if (!Presenter.isSupported()) {
    showUnsupportedMessage(msg);
    canvas.style.display = 'none';
    return;
  }
  let presenter: Presenter;
  try {
    presenter = new Presenter(canvas);
  } catch {
    showUnsupportedMessage(msg);
    canvas.style.display = 'none';
    return;
  }

  // The only place the wall clock is read to make a seed.
  const seed = q.seed ?? (Date.now() & 0x7fffffff);
  let highScore = loadHighScore();
  const app = new App({
    seed,
    highScore,
    skipSplash: q.debug,
    onHighScore: (n) => {
      highScore = n;
      saveHighScore(n);
    },
  });
  const overlay = app.overlay;

  let audio: AudioApi;
  try {
    audio = createAudio();
  } catch {
    audio = createNullAudio();
  }
  app.audio = audio;

  let crt = loadCrt();
  const input = new Input({
    onCrtToggle: () => {
      crt = !crt;
      saveCrt(crt);
      overlay.toast(crt ? 'CRT ON' : 'CRT OFF');
    },
    onMuteToggle: () => {
      const muted = audio.toggleMute();
      overlay.toast(muted ? 'SOUND OFF' : 'SOUND ON');
    },
    onFirstInput: () => {
      try {
        audio.resume();
      } catch {
        /* audio is optional */
      }
    },
  });
  input.bind(window);

  if (q.input) app.inputProbe = () => ({ k: input.lastKeyboard, g: input.lastGamepad, pads: input.gamepad.connected });
  const sim = (): void => app.simStep(input.poll());
  const render = (): void => {
    app.draw();
    app.drawInputProbe();
    presenter.upload(app.surface.canvas);
    presenter.present({ crt, time: performance.now() / 1000 });
  };
  const loop = new FixedLoop(sim, render, { maxStepsPerFrame: 5, maxDeltaMs: 250 });

  const resize = (): void => presenter.resize();
  window.addEventListener('resize', resize);
  let mq: MediaQueryList | null = null;
  const watchDpr = (): void => {
    mq?.removeEventListener('change', watchDpr);
    resize();
    mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', watchDpr);
  };
  watchDpr();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      app.session.autoPause();
      audio.setMusicDuck(true);
    }
    loop.resetClock();
  });
  window.addEventListener('blur', () => loop.resetClock());
  window.addEventListener('focus', () => loop.resetClock());

  if (q.debug) {
    installDebugHooks(app, (held) => app.simStep(held, false));
  }

  canvas.focus();
  loop.start();
}

start();
