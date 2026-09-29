/** Browser-tool harness: import run and pass its live Playwright page. No deterministic stepping. */
export async function run(
  page,
  base = "http://127.0.0.1:5179",
  shots = undefined,
) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const results = [];
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    results.push(message);
  };
  const inspect = () =>
    page.evaluate(() => ({
      scene: game.scene,
      overlay: game.overlay,
      p: game.player,
      packages: game.packages,
      lives: game.lives,
      loop: game.loop,
      score: game.score,
      crt: mallAction.crt,
    }));
  const hold = async (key, ms) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
  };
  const shot = async (name) => {
    if (!shots) return;
    await page.screenshot({ path: `${shots}/${name}.png`, scale: "css" });
  };
  await page.goto(base + "/?seed=42");
  await page.waitForTimeout(160);
  await shot("splash");
  await page.waitForTimeout(3150);
  await shot("title");
  await page.goto(base + "/?debug=1&seed=42");
  await page.evaluate(() => localStorage.setItem("mall-action.crt", "on"));
  await page.reload();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2250);
  await shot("selfie");
  await page.waitForTimeout(2450);
  check(
    (await inspect()).scene === "mall",
    "zip-line and selfie reach playable mall",
  );
  check((await inspect()).crt, "CRT remains enabled");
  await hold("ArrowRight", 1220);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(100);
  await hold("ArrowDown", 550);
  await page.waitForTimeout(500);
  let s = await inspect();
  check(
    s.p.lift === 0 && s.p.floor === 1,
    "real keyboard rides manual elevator to 4F",
  );
  await shot("mall");
  await hold("ArrowLeft", 1100);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(2650);
  check((await inspect()).scene === "store", "real keyboard enters Forever 12");
  // Prepared scenario positions isolate each interaction. Simulation and key input remain real-time.
  await page.evaluate(() => {
    const f = game.rooms[0].fixtures.find((f) => f.content === "package");
    game.player.x = f.x + 12;
    game.player.y = f.y + f.h + 7;
    game.player.inv = 240;
  });
  await page.keyboard.press("x");
  await page.waitForTimeout(850);
  if (!(await inspect()).packages) {
    await page.keyboard.press("x");
    await page.waitForTimeout(850);
  }
  check(
    (await inspect()).packages === 1,
    "one-tap store search finds a package",
  );
  await shot("store");
  await page.keyboard.press("Shift");
  await page.waitForTimeout(150);
  let t = await page.evaluate(() => game.time);
  await page.waitForTimeout(350);
  check((await page.evaluate(() => game.time)) === t, "map pauses timers");
  await shot("map");
  await page.keyboard.press("Shift");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  t = await page.evaluate(() => game.time);
  await page.waitForTimeout(300);
  check(
    (await page.evaluate(() => game.time)) === t,
    "pause freezes simulation",
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    game.player.x = 128;
    game.player.y = 154;
  });
  await hold("ArrowDown", 150);
  check(
    (await inspect()).scene === "mall",
    "store exit returns to the correct mall door",
  );
  await page.evaluate(async () => {
    const { actor } = await import("/src/game.ts");
    game.scene = "mall";
    game.death = 0;
    game.player = actor(700, 2);
    game.spies = [];
  });
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(950);
  s = await inspect();
  check(
    s.p.floor === 1 && gameUndefinedSafe(s),
    "escalator animates from 3F to 4F",
  );
  await page.evaluate(async () => {
    const { actor, makeSpy } = await import("/src/game.ts");
    game.scene = "mall";
    game.death = 0;
    game.player = actor(220, 1);
    game.player.inv = 120;
    game.cool = 0;
    game.spies = [makeSpy(game, 260, 1)];
    game.spawn = 99999;
    game.bullets = [];
  });
  const before = await page.evaluate(() => game.score);
  for (
    let attempt = 0;
    attempt < 3 && (await page.evaluate(() => game.score)) <= before;
    attempt++
  ) {
    await page.keyboard.press("z");
    await page.waitForTimeout(450);
  }
  check(
    (await page.evaluate(() => game.score)) > before,
    "real-time shooting kills a spy",
  );
  await page.evaluate(async () => {
    const { actor } = await import("/src/game.ts");
    game.scene = "mall";
    game.death = 0;
    game.player = actor(110, 1);
    game.player.inv = 120;
    game.cool = 0;
    game.bullets = [];
  });
  await page.keyboard.press("z");
  await page.waitForTimeout(550);
  check(
    (await page.evaluate(() => game.lamps[0].mode)) !== "hang",
    "real-time shooting drops a lamp",
  );
  for (const id of [1, 4, 7, 9, 11]) {
    await page.evaluate(async (id) => {
      const { enterStore } = await import("/src/game.ts");
      enterStore(game, id);
      game.firstVisit = 0;
      const f = game.rooms[id].fixtures.find((f) => f.content === "package");
      game.player.x = f.x + 12;
      game.player.y = f.y + f.h + 7;
      game.player.inv = 120;
    }, id);
    await page.keyboard.press("x");
    await page.waitForTimeout(850);
    await page.evaluate(() => {
      game.player.x = 128;
      game.player.y = 154;
    });
    await hold("ArrowDown", 150);
  }
  check(
    (await inspect()).packages === 6,
    "all six stores yield one package each",
  );
  await page.evaluate(async () => {
    const { actor } = await import("/src/game.ts");
    game.player = actor(690, 5);
  });
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(350);
  check((await inspect()).scene === "clear", "parking exit triggers clear");
  await shot("clear");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await shot("newspaper");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await shot("complete");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  check(
    (await inspect()).loop === 2,
    "tally, newspaper, post progress into loop two",
  );
  await page.evaluate(async () => {
    const { actor, hurt } = await import("/src/game.ts");
    game.scene = "mall";
    game.player = actor(80, 1);
    game.lives = 1;
    hurt(game);
  });
  await page.waitForTimeout(900);
  check(
    (await inspect()).scene === "continue",
    "last life opens continue screen",
  );
  await shot("continue");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  check((await inspect()).lives === 3, "continue grants three fresh lives");
  await page.evaluate(async () => {
    const { hurt } = await import("/src/game.ts");
    game.player.inv = 0;
    game.lives = 1;
    game.continues = 0;
    hurt(game);
  });
  await page.waitForTimeout(2650);
  check(
    (await inspect()).scene === "over",
    "no continues starts mall shutdown",
  );
  await shot("over");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  check((await inspect()).scene === "title", "game over returns to title");
  await page.keyboard.press("c");
  await page.waitForTimeout(100);
  check(!(await inspect()).crt, "C toggles CRT off");
  await page.reload();
  check(!(await inspect()).crt, "CRT preference persists after reload");
  await page.keyboard.press("c");
  await page.keyboard.press("m");
  await page.waitForTimeout(100);
  check(
    await page.evaluate(() => mallAction.audio.muted),
    "M toggles synthesized sound",
  );
  await page.keyboard.press("m");
  await page.setViewportSize({ width: 801, height: 641 });
  await page.waitForTimeout(100);
  check(
    await page
      .locator("#screen")
      .evaluate((c) => c.width === 512 && c.height === 480),
    "resize retains integer pixel scale",
  );
  check(errors.length === 0, "browser console has no errors");
  return { results, errors };
}
function gameUndefinedSafe(s) {
  return s.p.ground && s.p.lift < 0;
}
