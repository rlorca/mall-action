import test from "node:test";
import assert from "node:assert/strict";
import { Renderer } from "../src/render.js";
import { drawSprite } from "../src/art.js";
import * as R from "../src/rules.js";
import { UI } from "../src/copy.js";
const context = () =>
  new Proxy(
    {
      fillStyle: "",
      fillRect(...args) {
        assert.ok(args.every(Number.isFinite), "finite coordinates");
        assert.ok(args.every(Number.isInteger), "integer pixel coordinates");
      },
    },
    { get: (o, k) => o[k] ?? (() => {}) },
  );
test("renderer draws every screen and gallery without mutating rules state", () => {
  const ctx = context(),
    renderer = new Renderer({ getContext: () => ctx });
  const s = R.createGame(7);
  const draw = () => {
    const before = structuredClone(s);
    renderer.draw(s, {});
    assert.deepEqual(s, before);
  };
  for (const name of [
    "splash",
    "title",
    "arrival",
    "selfie",
    "mall",
    "continue",
    "death",
    "gameover",
  ]) {
    R.newRun(s);
    R.scene(s, name);
    s.sceneFrame = 170;
    draw();
  }
  s.packages = 6;
  R.scene(s, "mall");
  R.startClear(s);
  for (const name of ["clear", "paper", "post"]) {
    R.scene(s, name);
    draw();
  }
  for (const st of s.stores.filter((x) => x.role !== "closed")) {
    R.enterStoreNow(s, st.id);
    draw();
    s.overlay = "map";
    draw();
    s.overlay = "pause";
    draw();
    s.overlay = null;
  }
  renderer.draw(s, { gallery: true });
});
test("fractional-size preview sprites still rasterize on whole pixel boundaries", () => {
  for (const scale of [0.5, 1, 1.5, 2])
    drawSprite(context(), "wagon", 0.3, 0.7, { scale });
});
test("small UI copy fits the single-line full-screen budget", () => {
  for (const line of Object.values(UI)) assert.ok(line.length <= 58, line);
});
