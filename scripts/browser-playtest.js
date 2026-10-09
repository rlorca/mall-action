// Import in a debug browser tab. These helpers dispatch real keyboard events and
// wait for the live requestAnimationFrame simulation; they never call mall.step.
export const keyMap = {
  up: ["ArrowUp", "ArrowUp"],
  down: ["ArrowDown", "ArrowDown"],
  left: ["ArrowLeft", "ArrowLeft"],
  right: ["ArrowRight", "ArrowRight"],
  a: ["z", "KeyZ"],
  b: ["x", "KeyX"],
  start: ["Enter", "Enter"],
  select: ["Shift", "ShiftLeft"],
  crt: ["c", "KeyC"],
  mute: ["m", "KeyM"],
};
export function key(button, down) {
  const [key, code] = keyMap[button];
  window.dispatchEvent(
    new KeyboardEvent(down ? "keydown" : "keyup", {
      key,
      code,
      bubbles: true,
      cancelable: true,
    }),
  );
}
export function frames(n) {
  const start = window.mall.state.frame;
  return new Promise((resolve, reject) => {
    const deadline = performance.now() + n * 40 + 2000;
    function poll() {
      if (window.mall.state.frame - start >= n) return resolve();
      if (performance.now() > deadline)
        return reject(Error("Live simulation stalled"));
      requestAnimationFrame(poll);
    }
    poll();
  });
}
export async function hold(button, n) {
  key(button, true);
  await frames(n);
  key(button, false);
  await frames(1);
}
export async function tap(button) {
  await hold(button, 1);
}
export function summary() {
  const s = window.mall.state;
  return {
    scene: s.scene,
    frame: s.frame,
    sceneFrame: s.sceneFrame,
    x: s.p.x,
    y: s.p.y,
    floor: s.p.floor,
    ride: s.p.ride,
    lives: s.lives,
    score: s.score,
    packages: s.packages,
    overlay: s.overlay,
    store: s.storeId,
    crt: window.mall.ui.crt,
  };
}
export async function walk(button, n, shoot = false) {
  if (shoot) key("a", true);
  await hold(button, n);
  if (shoot) key("a", false);
}
export function route(goal) {
  const s = mall.state,
    r = s.room,
    p = s.p,
    start = [Math.round(p.x), Math.round(p.y)],
    seen = new Set([start.join(",")]),
    queue = [{ x: start[0], y: start[1], path: [] }];
  let idx = 0;
  while (idx < queue.length) {
    const n = queue[idx++];
    if (goal(n.x, n.y)) return n.path;
    for (const [dx, dy, b] of [
      [0, -4, "up"],
      [0, 4, "down"],
      [-4, 0, "left"],
      [4, 0, "right"],
    ]) {
      const x = n.x + dx,
        y = n.y + dy,
        k = x + "," + y;
      if (!seen.has(k) && !mall.rules.roomSolid(r, x, y)) {
        seen.add(k);
        queue.push({ x, y, path: [...n.path, b] });
      }
    }
  }
  throw Error("No path in " + s.storeId);
}
export async function follow(path) {
  const groups = [];
  for (const b of path) {
    if (groups.at(-1)?.b === b) groups.at(-1).n += 4;
    else groups.push({ b, n: 4 });
  }
  for (const { b, n } of groups) {
    await walk(b, n, true);
    if (mall.state.scene !== "store") throw Error("Died on room route");
  }
}
export async function packageSearch() {
  const s = mall.state;
  const f = s.room.fixtures.find((f) => f.content === "package");
  if (s.dialog) await frames(s.dialog + 1);
  if (s.pose) await frames(s.pose + 1);
  await follow(
    route(
      (x, y) =>
        mall.rules.touchingFixture({ ...s, p: { ...s.p, x, y } })?.id === f.id,
    ),
  );
  await tap("b");
  await frames(48);
  if (!f.opened) {
    await frames(65);
    await tap("b");
    await frames(48);
  }
  if (!f.opened) throw Error("Search incomplete");
}
export async function leave() {
  const s = mall.state;
  if (s.pose) await frames(s.pose + 1);
  await follow(route((x, y) => y >= 148 && x >= 112 && x <= 128));
  await hold("down", 10);
  await frames(26);
  if (mall.state.scene !== "mall") throw Error("Did not exit store");
}
