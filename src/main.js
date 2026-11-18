(() => {
  const canvas = document.querySelector("canvas"),
    screen = canvas.getContext("2d", { alpha: false }),
    buffer = document.createElement("canvas");
  buffer.width = 256;
  buffer.height = 240;
  const ctx = buffer.getContext("2d", { alpha: false });
  if (!ctx || !screen) {
    document.body.textContent =
      "Mall Action needs Canvas 2D graphics support. Please enable browser graphics.";
    return;
  }
  const params = new URLSearchParams(location.search),
    debug = params.get("debug") === "1",
    gallery = params.get("gallery") === "1",
    s = Game.newGame(
      params.has("seed") ? Number(params.get("seed")) : Date.now(),
      debug,
    ),
    view = View(ctx),
    pad = new Controls.Pad(),
    audio = Synth(),
    clock = Controls.clock();
  let crt = true,
    t = 0,
    toast = "",
    toastTime = 0;
  try {
    crt = localStorage.getItem("mall-action-crt") !== "off";
  } catch {}
  function resize() {
    const scale = Math.max(
      1,
      Math.floor(Math.min(innerWidth / 256, innerHeight / 240)),
    );
    canvas.style.width = 256 * scale + "px";
    canvas.style.height = 240 * scale + "px";
  }
  resize();
  addEventListener("resize", resize);
  addEventListener("pointerdown", () => audio.unlock());
  addEventListener("keydown", (e) => {
    const b = Controls.map(e.key, e.code);
    audio.unlock();
    if (!b) return;
    e.preventDefault();
    if (!e.repeat) pad.down(e.code, b);
  });
  addEventListener("keyup", (e) => pad.up(e.code));
  addEventListener("blur", () => pad.clear());
  function simulate(input) {
    let { press: k } = input;
    if (k === "crt" || k === "mute") {
      if (k === "crt") {
        crt = !crt;
        try {
          localStorage.setItem("mall-action-crt", crt ? "on" : "off");
        } catch {}
        toast = Copy.ui.crt + (crt ? Copy.ui.on : Copy.ui.off);
      } else
        toast = Copy.ui.sound + (audio.toggle() ? Copy.ui.on : Copy.ui.off);
      toastTime = 95;
      input = { ...input, press: undefined };
    }
    Game.step(s, input);
    audio.frame(s);
    t++;
    if (toastTime) toastTime--;
  }
  const mask = document.createElement("canvas");
  mask.width = 256;
  mask.height = 240;
  const mc = mask.getContext("2d");
  for (let y = 1; y < 240; y += 2) {
    mc.fillStyle = "rgba(8,4,23,.12)";
    mc.fillRect(0, y, 256, 1);
  }
  let gradient = mc.createRadialGradient(128, 116, 70, 128, 116, 178);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,.46)");
  mc.fillStyle = gradient;
  mc.fillRect(0, 0, 256, 240);
  function draw() {
    view.draw(s, t, gallery);
    if (toastTime) {
      view.g.box(88, 18, 80, 15, "ink", "mint");
      view.g.text(toast, 128, 22, "cream", 1, "center");
    }
    screen.imageSmoothingEnabled = false;
    if (!crt) {
      screen.drawImage(buffer, 0, 0);
      return;
    }
    screen.fillStyle = "#080810";
    screen.fillRect(0, 0, 256, 240);
    for (let y = 0; y < 240; ) {
      const inset = Math.floor(2.8 * ((y - 120) / 120) ** 2);
      let end = y + 1;
      while (end < 240 && Math.floor(2.8 * ((end - 120) / 120) ** 2) === inset)
        end++;
      screen.drawImage(buffer, 0, y, 8, end - y, inset, y, 8 - inset, end - y);
      screen.drawImage(buffer, 8, y, 240, end - y, 8, y, 240, end - y);
      screen.drawImage(buffer, 248, y, 8, end - y, 248, y, 8 - inset, end - y);
      y = end;
    }
    screen.drawImage(mask, 0, 0);
    screen.fillStyle = "rgba(205,222,255,.09)";
    for (let j = 0; j < 39; j++)
      screen.fillRect((j * 103 + t * 17) % 256, (j * 67 + t * 19) % 240, 1, 1);
  }
  let paused = false;
  if (debug)
    globalThis.mall = {
      state: s,
      pad,
      get crt() {
        return crt;
      },
      setManual(v) {
        paused = v;
      },
      step(n, buttons = []) {
        const held = new Set(buttons);
        for (let i = 0; i < n; i++)
          simulate({ held, press: i === 0 ? buttons[0] : undefined });
        draw();
        return s;
      },
      draw,
    };
  function frame(now) {
    let pads = [];
    try {
      pads = navigator.getGamepads?.() || [];
    } catch {}
    pad.gamepads(pads);
    if (pad.queue.length) audio.unlock();
    clock(now, () => {
      if (!paused) simulate(pad.read());
    });
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
