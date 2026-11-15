// Browser shell for the Rust/WebAssembly core: input, fixed-step scheduling, WebGL CRT, Web Audio, persistence.
// No game rules live here. The wasm module owns the simulation and the 256x240 software renderer; this file
// hands it one input edge-set per 60 Hz step and uploads its RGBA framebuffer to the GPU.
import { Btn, padFromHeld, parseButtons } from './web/pad.js?v=b9daff61f7ab';
import { FixedStepLoop } from './web/loop.js?v=b9daff61f7ab';
import { Input, gamepadMask, resolveKey } from './web/input.js?v=b9daff61f7ab';
import { Presenter } from './web/presenter.js?v=b9daff61f7ab';
import { AudioEngine } from './audio/audio.js?v=b9daff61f7ab';
import { SFX_IDS, MUSIC_IDS } from './audio/ids.js?v=b9daff61f7ab';

const W = 256, H = 240;
const params = new URLSearchParams(location.search);
const debug = params.get('debug') === '1';
const gallery = params.get('gallery') === '1';
const seedParam = params.get('seed');
const seed = seedParam !== null && /^-?\d+$/.test(seedParam)
  ? Number(seedParam) >>> 0
  : ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) || 1;
// flag bits for init(): 1 debug (skips the splash), 2 gallery, 4 autostart (?start=1), 8 skip the arrival (?skipintro=1)
const flags = (debug ? 1 : 0) | (gallery ? 2 : 0) | (params.get('start') === '1' ? 4 : 0) | (params.get('skipintro') === '1' ? 8 : 0);
const OSD = { CRT_ON: 1, CRT_OFF: 2, SOUND_ON: 3, SOUND_OFF: 4, GAMEPAD_ON: 5, GAMEPAD_OFF: 6 };

const readSetting = (key, def) => { try { const v = localStorage.getItem(`mall-action:${key}`); return v === null ? def : v === '1'; } catch { return def; } };
const writeSetting = (key, v) => { try { localStorage.setItem(`mall-action:${key}`, v ? '1' : '0'); } catch { /* blocked storage: setting does not persist */ } };

async function loadCore() {
  const url = new URL('./mall_action.wasm?v=b9daff61f7ab', import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load mall_action.wasm (' + response.status + ')');
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}

async function boot() {
  const canvas = document.getElementById('screen');
  const loading = document.getElementById('loading');
  const fallback = document.getElementById('fallback');
  const presenter = Presenter.create(canvas);
  if (!presenter) { loading.style.display = 'none'; canvas.style.display = 'none'; fallback.style.display = 'block'; fallback.textContent = 'MALL ACTION needs WebGL. Enable hardware acceleration or try another browser.'; return; }
  let core;
  try { core = await loadCore(); } catch (e) { loading.textContent = String(e && e.message || e); return; }
  loading.style.display = 'none';
  core.init(seed, flags);

  const input = new Input();
  const audio = new AudioEngine();
  let crt = readSetting('crt', true);
  audio.setMuted(readSetting('mute', false));
  const sfxLog = [];

  const frameView = () => new Uint8ClampedArray(core.memory.buffer, core.draw(), W * H * 4); // refreshed every call: memory may grow
  const advance = (pad) => {
    core.tick(pad.held, pad.pressed, pad.released);
    for (let s = core.sfx_next(); s !== 0; s = core.sfx_next()) { audio.sfx(SFX_IDS[s - 1]); if (debug) sfxLog.push(SFX_IDS[s - 1]); }
    const m = core.music();
    audio.setMusic(m === 0 ? null : MUSIC_IDS[m - 1]);
    audio.setDuck(core.duck() !== 0);
  };
  const loop = new FixedStepLoop(() => advance(input.sampleStep()));

  let lw = 0, lh = 0, ld = 0;
  const fit = () => { const w = innerWidth, h = innerHeight, d = devicePixelRatio || 1; if (w === lw && h === lh && d === ld) return; lw = w; lh = h; ld = d; presenter.resize(w, h, d); };
  addEventListener('resize', fit); fit();

  let unlocked = false;
  const unlock = () => { if (unlocked) return; unlocked = true; audio.unlock(); };
  const isGameKey = (e) => resolveKey(e.key, e.code) !== null || e.code === 'Space' || e.code === 'Tab';
  addEventListener('keydown', (e) => { if (e.ctrlKey || e.metaKey || e.altKey) return; unlock(); if (isGameKey(e)) e.preventDefault(); input.keyDown(e.key, e.code, e.repeat); });
  addEventListener('keyup', (e) => { if (isGameKey(e)) e.preventDefault(); input.keyUp(e.key, e.code); });
  const releaseAll = () => input.releaseAll();
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  addEventListener('pointerdown', () => { unlock(); canvas.focus(); });
  addEventListener('gamepadconnected', () => core.osd_show(OSD.GAMEPAD_ON));
  addEventListener('gamepaddisconnected', () => { core.osd_show(OSD.GAMEPAD_OFF); input.setGamepad(0); });
  canvas.focus();

  const pollGamepads = () => {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let mask = 0; for (const gp of pads) if (gp && gp.connected) mask |= gamepadMask(gp);
    if (mask !== 0) unlock();
    input.setGamepad(mask);
  };
  const handleSystem = () => {
    for (const a of input.drainSystem()) {
      if (a === 'crt') { crt = !crt; writeSetting('crt', crt); core.osd_show(crt ? OSD.CRT_ON : OSD.CRT_OFF); }
      else { audio.setMuted(!audio.isMuted()); writeSetting('mute', audio.isMuted()); core.osd_show(audio.isMuted() ? OSD.SOUND_OFF : OSD.SOUND_ON); }
    }
  };
  const draw = (t) => { presenter.present(frameView(), crt, t / 1000); core.osd_tick(); };

  let last = performance.now();
  const dbg = { realtime: true };
  const frame = (now) => {
    const dt = now - last; last = now;
    fit(); pollGamepads(); handleSystem();
    if (dbg.realtime) loop.advance(dt);
    draw(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (debug) {
    let held = 0;
    const text = () => { const p = core.state_json(), n = core.state_json_len(); return new TextDecoder().decode(new Uint8Array(core.memory.buffer, p, n)); };
    const state = () => { const s = JSON.parse(text()); s.seed = seed; s.sfx = sfxLog.slice(-12); return s; };
    const api = {
      core, input, audio,
      get realtime() { return dbg.realtime; }, set realtime(v) { dbg.realtime = v; },
      step(frames = 1, buttons = 0) { const mask = parseButtons(buttons); for (let i = 0; i < frames; i++) { advance(padFromHeld(held, mask)); held = mask; } draw(performance.now()); return state(); },
      tap(buttons, frames = 1) { api.step(frames, buttons); return api.step(1, 0); },
      pump(frames = 1) { for (let i = 0; i < frames; i++) advance(input.sampleStep()); draw(performance.now()); return state(); },
      render() { draw(performance.now()); },
      state,
      /** The exact game pixels (no CRT) as a PNG data URL. */
      shot() { const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'); const img = ctx.createImageData(W, H); img.data.set(frameView()); ctx.putImageData(img, 0, 0); return c.toDataURL('image/png'); },
      Btn,
    };
    window.__mall = api;
  }
}

if (typeof document !== 'undefined') boot();
