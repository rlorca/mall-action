import { Application, Container, Graphics, TextureStyle } from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { SCREEN_W, SCREEN_H } from './world/constants.js';
import { createFixedStep } from './core/loop.js';
import { createInput } from './core/input.js';
import { makeText } from './gfx/font.js';
import { createSynth } from './audio/synth.js';

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
  const unlock = () => { audio.unlock(); window.__audioCheck?.(audio); };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  input.onHotkey('KeyM', () => audio.toggleMute());

  // TEMP test pattern (removed in Task 9)
  const demo = makeText('MALL ACTION\nPRESS START 0123\n^_<> !?.,:;\'"-+/()%&#@*=$');
  demo.position.set(16, 100);
  root.addChild(new Graphics().rect(0, 0, SCREEN_W, 16).fill(0x2038ec), demo);

  const fixed = createFixedStep();
  app.ticker.add((t) => {
    fixed.advance(t.deltaMS, () => { input.poll(); /* scenes: wired in Task 9 */ });
    crt.time += 0.5; crt.seed = Math.random();
  });
}

boot();
