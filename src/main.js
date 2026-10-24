import "./style.css";
import { MallGame } from "./core/game.js";
import { Renderer } from "./render/renderer.js";
import { VirtualPad } from "./core/input.js";
import { AudioSystem } from "./audio.js";
import { FPS, BUTTONS } from "./core/constants.js";
import { seedFromQuery } from "./core/rng.js";
import { FixedStepLoop, integerScale } from "./core/loop.js";

const query = new URLSearchParams(location.search);
const debug = query.get("debug") === "1";
const gallery = query.get("gallery") === "1";
const canvas = document.querySelector("#game");
const shell = document.querySelector("#game-shell");
const crtElement = document.querySelector("#crt");
const unsupported = document.querySelector("#unsupported");

let renderer;
try { renderer = new Renderer(canvas); }
catch { unsupported.hidden = false; throw new Error("Arcade display unavailable"); }

const game = new MallGame(seedFromQuery(location.search), { skipSplash: debug || gallery });
if (gallery) game.state.screen = "gallery";
const pad = new VirtualPad();
const audio = new AudioSystem();
let crt = true;
try { crt = localStorage.getItem("mall-action.crt") !== "0"; } catch { /* privacy mode */ }
crtElement.classList.toggle("off", !crt);
shell.classList.toggle("crt-on", crt);

function notify(text) {
  game.state.notice = text;
  game.state.noticeTime = 100;
}
function updateCRT() {
  crt = !crt;
  crtElement.classList.toggle("off", !crt);
  shell.classList.toggle("crt-on", crt);
  try { localStorage.setItem("mall-action.crt", crt ? "1" : "0"); } catch { /* storage is optional */ }
  notify(`CRT ${crt ? "ON" : "OFF"}`);
}
function toggleSound() { notify(`SOUND ${audio.toggle() ? "ON" : "OFF"}`); }

const controlledCodes = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab", "Enter", "KeyW", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyX", "KeyJ", "KeyK", "KeyC", "KeyM", "ShiftLeft", "ShiftRight"]);
window.addEventListener("keydown", (event) => {
  if (controlledCodes.has(event.code)) event.preventDefault();
  audio.unlock();
  if (event.repeat) return;
  const button = pad.keyDown(event);
  if (button === "crt") updateCRT();
  if (button === "mute") toggleSound();
  canvas.focus({ preventScroll: true });
}, { passive: false });
window.addEventListener("keyup", (event) => {
  if (controlledCodes.has(event.code)) event.preventDefault();
  pad.keyUp(event);
}, { passive: false });
window.addEventListener("blur", () => pad.clear());
document.addEventListener("visibilitychange", () => { if (document.hidden) pad.clear(); });
canvas.addEventListener("pointerdown", () => { audio.unlock(); canvas.focus({ preventScroll: true }); });
window.addEventListener("gamepadconnected", () => audio.unlock());

function resize() {
  const availableW = Math.max(256, window.innerWidth - 28);
  const availableH = Math.max(240, window.innerHeight - (window.innerHeight > 500 ? 58 : 12));
  const scale = integerScale(256, 240, availableW, availableH);
  shell.style.width = `${256 * scale}px`; shell.style.height = `${240 * scale}px`;
  canvas.style.width = `${256 * scale}px`; canvas.style.height = `${240 * scale}px`;
}
window.addEventListener("resize", resize);
resize();

let previousButtons = {};
function debugStep(frames = 1, buttons = {}) {
  const held = typeof buttons === "object" ? buttons : {};
  for (let i = 0; i < Math.max(0, Math.floor(frames)); i++) {
    const input = {};
    for (const button of BUTTONS) {
      input[button] = !!held[button];
      input[`${button}Pressed`] = !!held[button] && !previousButtons[button];
      input[`${button}Released`] = !held[button] && !!previousButtons[button];
    }
    const events = game.step(input); audio.handle(events);
    previousButtons = Object.fromEntries(BUTTONS.map((button) => [button, !!held[button]]));
  }
  renderer.render(game);
  return game.state;
}

if (debug) {
  const context = { game, renderer, pad, audio, step: debugStep, state: game.state, version: "1.0.0" };
  Object.defineProperty(context, "state", { get: () => game.state });
  globalThis.mallAction = context;
  globalThis.__MALL_ACTION__ = context;
}

let last = performance.now();
const fixedLoop = new FixedStepLoop();
function frame(now) {
  const delta = now - last; last = now;
  pad.pollGamepads(navigator.getGamepads?.() || []);
  fixedLoop.advance(delta, () => {
    const events = game.step(pad.sample()); audio.handle(events);
  });
  audio.update(game);
  renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// A tiny read-only diagnostic makes deployment checks straightforward.
canvas.dataset.fps = String(FPS);
canvas.dataset.seed = String(game.seed);
