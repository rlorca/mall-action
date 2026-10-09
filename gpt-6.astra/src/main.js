import * as rules from "./rules.js";
import { Input, fixedLoop } from "./input.js";
import { Renderer } from "./render.js";
import { Monitor } from "./crt.js";
import { Audio } from "./audio.js";
import { TEXT } from "./copy.js";
const params = new URLSearchParams(location.search),
  debug = params.get("debug") === "1";
const safeRead = (key, fallback) => {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const prefRead = () => {
  try {
    return localStorage.getItem("mall-astra-crt") !== "off";
  } catch {
    return true;
  }
};
const state = rules.createGame(params.get("seed") ?? 7, {
  debug,
  high: Number(safeRead("mall-astra-high", 0)),
});
const input = new Input(),
  audio = new Audio();
const source = document.createElement("canvas");
source.width = 256;
source.height = 240;
const screen = document.getElementById("screen");
let renderer,
  monitor,
  running = true,
  lastHigh = state.high,
  noticeFrames = 0,
  ui = {
    crt: prefRead(),
    gallery: params.get("gallery") === "1",
    notice: null,
  };
function fail(err) {
  const message = document.getElementById("error");
  message.hidden = false;
  message.textContent = err.message;
  screen.hidden = true;
}
try {
  renderer = new Renderer(source);
  monitor = new Monitor(screen);
  monitor.resize();
} catch (err) {
  fail(err);
}
function events() {
  for (const e of state.events) {
    if (e.type === "crt") {
      ui.crt = !ui.crt;
      try {
        localStorage.setItem("mall-astra-crt", ui.crt ? "on" : "off");
      } catch {}
      ui.notice = ui.crt ? TEXT.crtOn : TEXT.crtOff;
      noticeFrames = 120;
    } else if (e.type === "mute") {
      audio.setMute(!audio.muted);
      ui.notice = audio.muted ? TEXT.soundOff : TEXT.soundOn;
      noticeFrames = 120;
    } else audio.event(e.type);
  }
  if (lastHigh !== state.high) {
    lastHigh = state.high;
    try {
      sessionStorage.setItem("mall-astra-high", String(state.high));
    } catch {}
  }
}
function tick(sample) {
  rules.step(state, sample);
  events();
  if (noticeFrames > 0 && --noticeFrames === 0) ui.notice = null;
  audio.update(state);
}
function render() {
  if (renderer && monitor) {
    renderer.draw(state, ui);
    monitor.draw(source, ui.crt, state.frame);
  }
}
const loop = fixedLoop(() => {
  if (!running) return;
  input.gamepads(navigator.getGamepads?.() || []);
  const sample = input.sample();
  if (Object.values(sample.pressed).some(Boolean) && !audio.active)
    void audio.unlock();
  tick(sample);
}, render);
function frame(t) {
  loop(t);
  requestAnimationFrame(frame);
}
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const mapped = input.down(e.key, e.code, e.repeat);
  if (mapped) {
    e.preventDefault();
    void audio.unlock();
  }
});
window.addEventListener("keyup", (e) => {
  input.up(e.code);
  if (
    [
      "Tab",
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.code)
  )
    e.preventDefault();
});
window.addEventListener("blur", () => {
  input.clear();
  if (["mall", "store"].includes(state.scene) && !state.overlay)
    state.overlay = "pause";
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) input.clear();
});
window.addEventListener("resize", () => monitor?.resize());
window.addEventListener("gamepaddisconnected", () =>
  input.gamepads(navigator.getGamepads?.() || []),
);
screen.addEventListener("pointerdown", () => {
  screen.focus();
  void audio.unlock();
  if (state.scene === "title") input.queue.push("start");
  else if (state.scene === "splash") input.queue.push("a");
});
screen.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  running = false;
  fail(Error("Graphics context was lost. Reload to resume the game."));
});
if (debug) {
  window.mall = {
    state,
    input,
    rules,
    ui,
    audio,
    renderer,
    stop: () => {
      running = false;
      input.clear();
    },
    start: () => {
      running = true;
      input.clear();
    },
    step: (n = 1, buttons = []) => {
      running = false;
      const held = Array.isArray(buttons)
        ? Object.fromEntries(buttons.map((b) => [b, true]))
        : buttons;
      for (let i = 0; i < n; i++) tick({ held, pressed: i === 0 ? held : {} });
      render();
      return state;
    },
    render,
  };
}
if (monitor) requestAnimationFrame(frame);
