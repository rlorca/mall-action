import { ui } from "./copy";
import { FixedLoop, Input, type Pad } from "./core";
import { createGame, step } from "./game";
import { Renderer } from "./render";
import { Audio } from "./audio";
import { CRT } from "./crt";
const query = new URLSearchParams(location.search),
  seed = Number(query.get("seed") ?? Date.now()) >>> 0;
const game = createGame(seed, query.get("debug") === "1"),
  input = new Input(),
  audio = new Audio();
const screen = document.querySelector<HTMLCanvasElement>("#screen")!,
  buffer = document.createElement("canvas");
buffer.width = 256;
buffer.height = 240;
const renderer = new Renderer(buffer);
let crt: CRT;
let enabled = true;
try {
  enabled = localStorage.getItem("mall-action.crt") !== "off";
} catch {}
let toast = "",
  toastTime = 0;
function toggle(k: "crt" | "mute") {
  if (k === "crt") {
    enabled = !enabled;
    toast = ui.CRT + (enabled ? "ON" : ui.OFF);
    try {
      localStorage.setItem("mall-action.crt", enabled ? "on" : "off");
    } catch {}
  } else {
    audio.muted = !audio.muted;
    toast = ui.SOUND + (audio.muted ? ui.OFF : "ON");
  }
  toastTime = 120;
}
try {
  crt = new CRT(screen);
  const resize = () => {
    const scale = Math.max(
      1,
      Math.floor(Math.min(innerWidth / 256, innerHeight / 240)),
    );
    screen.width = 256 * scale;
    screen.height = 240 * scale;
    screen.style.width = screen.width + "px";
    screen.style.height = screen.height + "px";
  };
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (ev) => {
    input.down(ev.key, ev.code, ev.repeat);
    if (input.held.has(ev.code)) {
      ev.preventDefault();
      void audio.start();
    }
  });
  window.addEventListener("keyup", (ev) => input.up(ev.code));
  window.addEventListener("blur", () => {
    input.clear();
    if (["mall", "store"].includes(game.scene)) game.overlay = "pause";
  });
  window.addEventListener("pointerdown", () => void audio.start());
  window.addEventListener("gamepadconnected", () => void audio.start());
  window.addEventListener("gamepaddisconnected", () =>
    input.poll(navigator.getGamepads()),
  );
  const tick = () => {
    input.poll(navigator.getGamepads?.() ?? []);
    if (Object.values(input.gamepad).some(Boolean)) void audio.start();
    for (const t of input.toggles.splice(0)) toggle(t);
    const pad = input.sample();
    step(game, pad.held, pad.pressed);
    audio.update(game);
    if (toastTime) toastTime--;
  };
  const loop = new FixedLoop(tick);
  if (query.get("debug") === "1") {
    Object.assign(window, {
      game,
      mallAction: {
        game,
        input,
        audio,
        renderer,
        get crt() {
          return enabled;
        },
        running: true,
        step: (n: number, h: Pad = {}, e: Pad = {}) => {
          for (let i = 0; i < n; i++) {
            step(game, h, i === 0 ? e : {});
            audio.update(game);
          }
          return game;
        },
      },
    });
  }
  function animate(time: number) {
    const api = (window as unknown as { mallAction?: { running: boolean } })
      .mallAction;
    if (api?.running !== false) loop.advance(time);
    else loop.last = time;
    if (query.get("gallery") === "1") renderer.gallery(game.frame);
    else renderer.draw(game);
    if (toastTime) {
      renderer.panel(87, 219, 82, 16, 0);
      renderer.text(toast, 128, 224, 6, 1, true);
    }
    crt.draw(buffer, enabled, game.frame);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
} catch (err) {
  screen.hidden = true;
  const box = document.querySelector<HTMLDivElement>("#error")!;
  box.hidden = false;
  box.textContent = String(err);
}
