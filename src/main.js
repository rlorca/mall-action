import { Application, Container, Graphics, TextureStyle } from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { SCREEN_W, SCREEN_H } from './world/constants.js';
import { createFixedStep } from './core/loop.js';
import { createInput } from './core/input.js';
import { createSynth } from './audio/synth.js';
import { SceneManager } from './core/scenes.js';
import { createKonami } from './logic/secrets.js';
import { createGameState } from './game/state.js';
import { TitleScene } from './scenes/TitleScene.js';
import { PlaceholderScene } from './scenes/PlaceholderScene.js';

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

  const root = new Container(); // everything at native 256×240 lives here
  app.stage.addChild(root);
  const sceneLayer = new Container(), overlayLayer = new Container();
  const fade = new Graphics().rect(0, 0, SCREEN_W, SCREEN_H).fill(0x000000);
  fade.alpha = 0;
  root.addChild(sceneLayer, overlayLayer, fade);
  // clip anything drawn outside the 256×240 screen
  const clip = new Graphics().rect(0, 0, SCREEN_W, SCREEN_H).fill(0xffffff);
  root.addChild(clip); root.mask = clip;

  const crt = new CRTFilter({ curvature: 2, lineWidth: 1.5, lineContrast: 0.2, noise: 0.06, noiseSize: 1, vignetting: 0.25, vignettingAlpha: 0.5 });
  let crtOn = true;
  const applyFilters = () => { app.stage.filters = crtOn ? [crt] : []; };
  applyFilters();

  const resize = () => {
    const s = fitScale();
    app.renderer.resize(SCREEN_W * s, SCREEN_H * s);
    root.scale.set(s);
    crt.lineWidth = Math.max(1, s * 0.5);
    app.stage.filterArea = app.screen;
  };
  window.addEventListener('resize', resize);
  resize();

  const input = createInput(window);
  input.onHotkey('KeyC', () => { crtOn = !crtOn; applyFilters(); });
  const audio = createSynth();
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  input.onHotkey('KeyM', () => audio.toggleMute());

  const params = new URLSearchParams(location.search);
  const ctx = {
    pad: input.pad, input, audio, state: null, konami: createKonami(), highScore: 0,
    debug: params.has('debug'), seed: params.has('seed') ? Number(params.get('seed')) : null,
  };
  ctx.scenes = new SceneManager({ layer: sceneLayer, overlayLayer, setFade: (a) => { fade.alpha = a; } }, ctx);
  ctx.startGame = ({ blackFriday = false } = {}) => {
    ctx.state = createGameState({ seed: ctx.seed ?? undefined, blackFriday, highScore: ctx.highScore });
    ctx.scenes.replace(new PlaceholderScene('MALL'), { newLevel: true });
  };
  ctx.toTitle = () => ctx.scenes.replace(new TitleScene());
  if (ctx.debug) window.__mall = ctx;

  ctx.scenes.replace(new TitleScene(), {}, { fade: false });

  const fixed = createFixedStep();
  app.ticker.add((t) => {
    fixed.advance(t.deltaMS, () => { input.poll(); ctx.scenes.update(); });
    if (crtOn) { crt.time += 0.5; crt.seed = Math.random(); }
  });
}

boot();
