globalThis.Controls = (() => {
  const letters = {
    w: "up",
    s: "down",
    a: "left",
    d: "right",
    z: "a",
    j: "a",
    x: "b",
    k: "b",
    m: "mute",
    c: "crt",
  };
  const codes = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Space: "b",
    Enter: "start",
    ShiftLeft: "select",
    ShiftRight: "select",
    Tab: "select",
  };
  const map = (key, code) =>
    letters[key.toLowerCase()] ||
    codes[code] ||
    letters[code.replace(/^Key/, "").toLowerCase()];
  class Pad {
    keys = new Map();
    queue = [];
    down(id, b) {
      if (!b || this.keys.has(id)) return;
      if (![...this.keys.values()].includes(b)) this.queue.push(b);
      this.keys.set(id, b);
    }
    up(id) {
      this.keys.delete(id);
    }
    clear() {
      this.keys.clear();
      this.queue = [];
    }
    read() {
      const press = this.queue.shift();
      return {
        held: new Set([...this.keys.values(), ...(press ? [press] : [])]),
        press,
      };
    }
    gamepads(pads) {
      const active = new Set();
      for (const p of pads) {
        if (!p) continue;
        const buttons = {
          up: p.buttons[12]?.pressed || p.axes[1] < -0.45,
          down: p.buttons[13]?.pressed || p.axes[1] > 0.45,
          left: p.buttons[14]?.pressed || p.axes[0] < -0.45,
          right: p.buttons[15]?.pressed || p.axes[0] > 0.45,
          a: p.buttons[0]?.pressed,
          b: p.buttons[1]?.pressed,
          select: p.buttons[8]?.pressed,
          start: p.buttons[9]?.pressed,
        };
        for (const [b, on] of Object.entries(buttons))
          if (on) {
            let id = "pad" + p.index + b;
            active.add(id);
            this.down(id, b);
          }
      }
      for (const id of this.keys.keys())
        if (id.startsWith("pad") && !active.has(id)) this.up(id);
    }
  }
  function clock() {
    let last = null,
      acc = 0;
    return (now, tick) => {
      if (last !== null) acc += Math.max(0, Math.min(100, now - last));
      last = now;
      let n = 0;
      while (acc >= 1000 / 60 - 1e-8 && n < 6) {
        tick();
        acc -= 1000 / 60;
        n++;
      }
      return n;
    };
  }
  return { Pad, map, clock };
})();
