// Frame simulation. World y and actor positions are measured at the feet.
globalThis.Game = (() => {
  const D = MallData,
    C = Copy,
    Y = D.floorY,
    clamp = (n, a, b) => Math.max(a, Math.min(b, n)),
    near = (a, b, r) => Math.abs(a - b) <= r;
  function rand(s) {
    s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }
  const pick = (s, a) => a[Math.floor(rand(s) * a.length)],
    event = (s, id) => s.events.push(id);
  function note(s, text, sound, time = 100) {
    s.banner = text;
    s.bannerTime = time;
    if (sound) event(s, sound);
  }
  const clean = () => ({
    weapon: "",
    gun: 0,
    speed: 0,
    shoes: false,
    armor: false,
    radar: false,
    food: 0,
  });
  function newGame(seed = 1, debug = false) {
    return {
      seed: seed >>> 0,
      screen: debug ? "title" : "splash",
      age: 0,
      hi: 0,
      events: [],
      combo: "",
      black: false,
      overlay: "",
      bannerTime: 0,
    };
  }
  function scene(s, name) {
    s.screen = name;
    s.age = 0;
    s.overlay = "";
  }
  function start(s) {
    Object.assign(s, {
      loop: 1,
      score: 0,
      lives: 3,
      continues: 3,
      extra: false,
      visited: [],
      inventory: [],
      egg: false,
      photo: false,
      power: clean(),
    });
    level(s);
  }
  function level(s) {
    const rooms = D.stores.map((st) => {
      const fs = st.layout.map(([x, y], i) => ({
        x: x * 16,
        y: y * 16,
        w: 26,
        h: 16,
        opened: false,
        toys: false,
        kind: s.black
          ? "power"
          : st.role === "U"
            ? pick(s, ["power", "power", "empty"])
            : pick(s, ["power", "trap", "empty", "empty"]),
        i,
      }));
      if (st.role === "T") pick(s, fs).kind = "package";
      return { fs, w: 256, h: 176, cleared: false };
    });
    Object.assign(s, {
      rooms,
      pk: 0,
      elapsed: 0,
      alarm: false,
      spawn: 300,
      spies: [],
      shots: [],
      drops: [],
      fx: [],
      pop: [],
      lamps: [],
      cars: D.shafts.map(([x, lo, hi]) => ({
        x,
        lo,
        hi,
        y: Y(lo),
        goal: Y(lo),
        wait: 120,
        call: null,
      })),
      p: {
        x: 96,
        y: Y(0),
        f: 0,
        dir: 1,
        air: false,
        ride: -1,
        roof: -1,
        vy: 0,
        inv: 0,
        freeze: 0,
        cd: 0,
        hide: 0,
        safe: [96, 0],
      },
      es: null,
      store: -1,
      guards: [],
      wet: 0,
      jan: 280,
      jdir: 1,
      walk: [280, 306],
      wdir: 1,
      cop: { x: 540, f: 1 + Math.floor(rand(s) * 4), dir: -1, chase: 0 },
      kioskCD: 0,
      fountainCD: [0, 0, 0, 0, 0],
      shake: 0,
      fade: 0,
      prevPA: -1,
      post: pick(s, C.arrival),
      bannerTime: 0,
    });
    for (let f = 1; f <= 4; f++)
      for (const x of [205, 560, 735])
        s.lamps.push({ x, origin: x, y: Y(f) - 18, f, mode: "hang", dark: 0 });
    s.power.radar = false;
    scene(s, "arrival");
    event(s, "zip");
  }
  function points(s, n, x, y) {
    s.score = Math.max(0, s.score + n);
    if (x != null) s.pop.push({ x, y, n, t: 45 });
    if (!s.extra && s.score >= 20000) {
      s.extra = true;
      s.lives++;
      event(s, "item");
    }
  }
  function power(s, id) {
    let a = s.power;
    switch (id) {
      case 0:
      case 1:
        a.weapon = D.powers[id];
        a.gun = 1200;
        break;
      case 2:
      case 8:
        a.armor = true;
        break;
      case 3:
      case 7:
        a.speed = id === 3 ? 1200 : 720;
        a.shoes = id === 3;
        break;
      case 4:
        a.radar = true;
        break;
      case 5:
        s.lives++;
        break;
      case 6:
        a.food = 360;
        break;
    }
    points(s, 50);
    note(s, D.powers[id], "item");
  }
  function difficulty(s) {
    const n = s.loop - 1;
    return {
      speed: Math.min(1.8, 0.55 * 1.1 ** n) * (s.alarm ? 1.25 : 1),
      spawn:
        Math.max(50, Math.round(230 * 0.85 ** n)) /
        (s.black ? 2 : 1) /
        (s.alarm ? 1.4 : 1),
      shot: Math.max(60, Math.round(150 * 0.85 ** n)),
      alarm: Math.max(50, 150 - 20 * n) * 60,
      cap: s.black ? 8 : 4,
    };
  }
  function dead(s) {
    if (s.p.inv || s.power.food || !["mall", "store"].includes(s.screen))
      return;
    if (s.power.armor) {
      s.power.armor = false;
      s.p.inv = 120;
      note(s, Copy.ui.vestAbsorbedHit, "ping");
      return;
    }
    s.lives--;
    s.spies = [];
    s.shots = [];
    s.es = null;
    s.power = { ...clean(), radar: s.power.radar };
    s.p.freeze = s.p.hide = 0;
    s.from = s.screen;
    s.deathAt = s.from === "store" ? [s.r.x, s.r.y] : null;
    scene(s, "death");
    event(s, "death");
  }
  function respawn(s, continued = false) {
    const p = s.p;
    Object.assign(p, {
      f: p.safe[1],
      x: p.safe[0],
      y: Y(p.safe[1]),
      inv: 120,
      air: false,
      fallShaft: null,
      kick: false,
      ride: -1,
      roof: -1,
      slide: 0,
      cd: 0,
    });
    s.search = null;
    s.spies = [];
    s.shots = [];
    if (s.from === "store") {
      s.r.x = continued ? s.deathAt[0] : 128;
      s.r.y = continued ? s.deathAt[1] : s.r.h - 20;
      s.guards = s.guards.filter((g) => g.bot);
      s.guards.forEach((g) => (g.cd = 120));
    }
    scene(s, s.from);
  }
  function mechanism(s) {
    const p = s.p;
    for (const [i, c] of s.cars.entries()) {
      const old = c.y,
        step = Math.sign(c.goal - old);
      c.y += step;
      const atFloor = (c.y - Y(0)) % 48 === 0;
      if (
        i === 2 &&
        c.y === c.goal &&
        p.ride !== i &&
        c.call === null &&
        !(near(p.x, c.x, 9) && p.y === c.y) &&
        !s.spies.some((e) => !e.die && near(e.x, c.x, 8) && Y(e.f) === c.y) &&
        --c.wait <= 0
      ) {
        const stops = [];
        for (let f = c.lo; f <= c.hi; f++) if (Y(f) !== c.y) stops.push(f);
        c.goal = Y(pick(s, stops));
        c.wait = 120;
      }
      if (step > 0)
        for (const e of s.spies)
          if (!e.die && near(e.x, c.x, 8) && Y(e.f) === c.y) kill(s, e, 300);
      if (
        step &&
        atFloor &&
        p.ride !== i &&
        p.roof !== i &&
        p.f >= c.lo &&
        p.f <= c.hi &&
        near(p.x, c.x, 5) &&
        p.y === c.y &&
        step > 0 &&
        c.call !== p.f
      ) {
        s.shake = 10;
        event(s, "crush");
        dead(s);
      }
      if (p.roof === i) {
        p.y = c.y - 21;
        p.f = clamp(Math.round((p.y - Y(0)) / 48), 0, 5);
        if (c.y <= Y(c.lo) + 17) dead(s);
      }
      if (p.ride === i) {
        p.x = c.x;
        p.y = c.y;
        p.f = clamp(Math.round((c.y - Y(0)) / 48), 0, 5);
      }
      if (step && c.y === c.goal) {
        if (near(p.x, c.x, 180)) event(s, "ding");
        if (c.call === p.f && near(p.x, c.x, 19)) {
          p.ride = i;
          p.roof = -1;
          p.air = false;
          p.fallShaft = null;
          p.x = c.x;
          p.y = c.y;
        }
        c.call = null;
        c.wait = 120;
        if (p.ride === i)
          note(s, D.floors[p.f] + " - " + C.floors[p.f], null, 90);
        else if (
          s.elapsed > 300 &&
          near(p.x, c.x, 190) &&
          s.spies.length < difficulty(s).cap &&
          rand(s) < 0.24
        ) {
          const e = spy(s, c.x, (c.y - Y(0)) / 48);
          e.bubble = pick(s, C.lift);
          e.talk = 100;
        }
      }
    }
  }
  function spy(s, x, f) {
    const e = {
      x,
      f,
      dir: 1,
      life: 0,
      cd: 120,
      aim: 0,
      duck: 0,
      die: 0,
      volley: -1,
      wait: rand(s) < 0.6,
      talk: 0,
    };
    s.spies.push(e);
    return e;
  }
  function kill(s, e, n) {
    if (e.die) return;
    e.die = 24;
    points(s, n, e.x, Y(e.f) - 22);
    if (n === 300) {
      s.shake = 8;
      event(s, "crush");
    }
    if (rand(s) < 0.35) {
      e.bubble = pick(s, C.last);
      e.talk = 32;
    }
    if (rand(s) < 0.05)
      s.drops.push({
        x: e.x,
        y: Y(e.f) - 3,
        f: e.f,
        power: rand(s) < 0.5 ? pick(s, [6, 7, 8]) : Math.floor(rand(s) * 6),
        t: 600,
      });
  }
  function pit(s, x, f) {
    return s.cars.findIndex(
      (c) => f >= c.lo && f <= c.hi && near(x, c.x, 5) && c.y > Y(f) + 1,
    );
  }
  function spies(s) {
    const p = s.p,
      d = difficulty(s);
    if (--s.spawn <= 0) {
      s.spawn = d.spawn;
      const candidates = D.stores.filter(
        (st) =>
          st.role !== "C" &&
          !s.rooms[st.id].cleared &&
          near(st.f, p.f, 1) &&
          near(st.x, p.x, 200) &&
          !near(st.x, p.x, 63),
      );
      if (candidates.length && s.spies.length < d.cap) {
        const st = pick(s, candidates);
        spy(s, st.x, st.f);
      }
    }
    for (const e of s.spies) {
      if (e.die) {
        e.die--;
        if (!e.die) e.remove = true;
        continue;
      }
      e.life++;
      e.talk--;
      e.duck = Math.max(0, e.duck - 1);
      const see = !p.hide && p.ride < 0 && e.f === p.f && near(p.x, e.x, 160),
        dist = p.x - e.x;
      let dx = 0;
      if (e.aim) {
        if (!see) {
          e.aim = 0;
          continue;
        }
        if (!--e.aim) {
          s.shots.push({
            x: e.x + 8 * e.dir,
            y: Y(e.f) - (e.low ? 6 : 16),
            dx: e.dir * 2,
            dy: 0,
            enemy: true,
            t: 140,
          });
          event(s, "enemy");
          e.cd = d.shot - 30;
        }
      } else {
        e.cd--;
        if (see) {
          e.dir = Math.sign(dist) || 1;
          if (Math.abs(dist) > 40) dx = e.dir;
          if (e.cd <= 0) {
            e.aim = 30;
            e.low = rand(s) < 0.5;
          }
        } else if (e.wait) {
          let target = s.cars
            .filter((c) => e.f >= c.lo && e.f <= c.hi && c.y <= Y(e.f))
            .sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
          dx = target ? Math.sign(target.x - e.x) : e.dir;
        } else {
          if (e.x < 15 || e.x > 752) e.dir *= -1;
          dx = e.dir;
        }
      }
      const slip = e.f === 4 && s.wet && near(e.x, s.patch, 24);
      if (slip) {
        e.slide = e.slide || dx || e.dir;
        dx = e.slide;
      } else e.slide = 0;
      if (!e.duck && pit(s, e.x + dx * d.speed, e.f) < 0)
        e.x = clamp(e.x + dx * (slip ? 1 : d.speed), 8, 760);
      if (
        !p.hide &&
        e.f === p.f &&
        near(p.x, e.x, 10) &&
        near(p.y, Y(e.f), 20)
      ) {
        if (p.kick || s.power.food) kill(s, e, p.slide ? 300 : 100);
        else dead(s);
      }
    }
    s.spies = s.spies.filter((e) => !e.remove);
  }
  function fire(s, room) {
    let p = s.p;
    const rapid = s.power.gun && s.power.weapon === D.powers[0],
      spread = s.power.gun && s.power.weapon === D.powers[1];
    if (
      p.cd ||
      s.shots.filter((b) => !b.enemy).length >= (rapid ? 4 : spread ? 3 : 2)
    )
      return;
    p.cd = rapid ? 7 : 15;
    let dx = room ? s.r.dx : p.dir,
      dy = room ? s.r.dy : 0,
      x = room ? s.r.x : p.x,
      y = room ? s.r.y : p.y - (p.duck ? 6 : 16);
    for (const a of spread ? [0, 0.28, -0.28] : [0])
      s.shots.push({
        x: x + 8 * dx,
        y: y + 8 * dy,
        dx: 4 * dx - 4 * dy * a,
        dy: 4 * dy + 4 * dx * a,
        t: 64,
        id: s.elapsed,
        enemy: false,
      });
    event(s, "shot");
    const c = s.cop;
    if (
      !room &&
      p.f === c.f &&
      near(p.x, c.x, 128) &&
      Math.sign(p.x - c.x) === c.dir
    ) {
      c.chase = 600;
      c.talk = 90;
      event(s, "whistle");
    }
  }
  function mallShots(s) {
    const p = s.p;
    for (const b of s.shots) {
      b.x += b.dx;
      b.y += b.dy;
      b.t--;
      if (b.x < 0 || b.x > 768) b.t = 0;
      if (s.walk.some((x) => near(x, b.x, 7) && near(b.y, Y(3) - 12, 10))) {
        if (!b.enemy) {
          points(s, -200);
          s.walkTalk = 60;
          event(s, "ping");
        }
        b.t = 0;
        continue;
      }
      if (near(s.cop.x, b.x, 7) && near(Y(s.cop.f) - 12, b.y, 12)) {
        event(s, "ping");
        b.t = 0;
        continue;
      }
      if (b.enemy) {
        if (
          !p.hide &&
          near(p.x, b.x, 6) &&
          b.y <= p.y &&
          b.y >= p.y - (p.duck ? 10 : 20)
        ) {
          b.t = 0;
          dead(s);
        }
        continue;
      }
      for (const l of s.lamps)
        if (l.mode === "hang" && near(l.x, b.x, 5) && near(l.y, b.y, 8)) {
          l.mode = "fall";
          l.vy = 0.5;
          l.dir = Math.sign(b.dx);
          b.t = 0;
          event(s, "fall");
          break;
        }
      if (!b.t) continue;
      for (const f of [2, 4])
        if (
          !s.fountainCD[f] &&
          near(b.x, D.fountain, 12) &&
          near(b.y, Y(f) - 10, 10)
        ) {
          s.fountainCD[f] = 900;
          const n = pick(s, [3, 4, 5]),
            gold = rand(s) < 0.05;
          for (let i = 0; i < n; i++)
            s.drops.push({
              x: D.fountain,
              y: Y(f) - 10,
              dx: i - (n - 1) / 2,
              vy: -2 - rand(s),
              gold: !i && gold,
              f,
              t: 600,
            });
          b.t = 0;
          event(s, "coins");
        }
      for (const e of s.spies) {
        if (
          !e.die &&
          near(e.x, b.x, 30) &&
          near(b.y, Y(e.f) - 16, 3) &&
          b.id !== e.volley
        ) {
          e.volley = b.id;
          if (rand(s) < 0.1) e.duck = 22;
        }
        if (
          !e.die &&
          near(e.x, b.x, 7) &&
          b.y >= Y(e.f) - (e.duck ? 10 : 22) &&
          b.y <= Y(e.f)
        ) {
          kill(s, e, 100);
          b.t = 0;
          break;
        }
      }
    }
    s.shots = s.shots.filter((b) => b.t > 0);
  }
  function environment(s) {
    const p = s.p;
    s.wet = Math.max(0, s.wet - 1);
    if (s.elapsed % 420 === 180) {
      s.wet = 600;
      s.patch = clamp(s.jan, 265, 345);
    }
    if (s.elapsed % 420 > 90) {
      s.jan += s.jdir * 0.45;
      if (s.jan < 265 || s.jan > 345) s.jdir *= -1;
    }
    if (s.walk[0] < 265 || s.walk[0] > 352) s.wdir *= -1;
    s.walk = s.walk.map((x) => x + s.wdir * 0.7);
    if (p.f === 3 && !p.air && s.walk.some((x) => near(x, p.x, 8)))
      p.x += s.wdir * 0.85;
    let c = s.cop;
    if (c.talk) c.talk--;
    if (s.walkTalk) s.walkTalk--;
    if (c.chase > 0) {
      c.chase--;
      if (c.f === p.f && !p.hide) {
        c.dir = Math.sign(p.x - c.x) || 1;
        c.x += 1.35 * c.dir;
        if (near(c.x, p.x, 8) && near(p.y, Y(c.f), 16)) {
          c.chase = 0;
          p.freeze = 180;
          points(s, -500);
          note(s, Copy.ui.detained500, "whistle", 160);
        }
      }
    } else {
      c.x += 0.45 * c.dir;
      if (c.x < 20 || c.x > 748) c.dir *= -1;
    }
    for (const l of s.lamps) {
      if (l.dark) l.dark--;
      if (l.mode === "hang" || l.mode === "gone") continue;
      l.mode === "fall" ? ((l.y += l.vy), (l.vy += 0.27)) : (l.x += 2 * l.dir);
      if (near(p.x, l.x, 8) && near(p.y - 8, l.y, 12) && !p.hide) dead(s);
      for (const e of s.spies)
        if (e.f === l.f && near(e.x, l.x, 12) && near(Y(e.f) - 8, l.y, 14))
          kill(s, e, 300);
      if (l.mode === "fall" && l.y >= Y(l.f) - 5) {
        l.y = Y(l.f) - 5;
        l.mode = l.f === 3 ? "roll" : "gone";
        l.dark = 120;
        s.shake = 9;
        event(s, "glass");
      }
      if (l.mode === "roll" && (l.x < 5 || l.x > 763 || pit(s, l.x, l.f) >= 0))
        l.mode = "gone";
    }
    for (const o of s.drops) {
      o.t--;
      if (o.dx != null) {
        o.x += o.dx;
        o.dx *= 0.98;
        o.y += o.vy;
        o.vy += 0.15;
        if (o.y > Y(o.f) - 3) {
          o.y = Y(o.f) - 3;
          o.vy *= -0.55;
        }
      }
      if (o.f === p.f && near(p.x, o.x, 10) && near(p.y - 6, o.y, 18)) {
        o.t = 0;
        if (o.power != null) power(s, o.power);
        else {
          points(s, 50, o.x, o.y);
          if (o.gold) s.lives++;
          event(s, "coins");
        }
      }
    }
    s.drops = s.drops.filter((o) => o.t > 0);
  }
  function clearLevel(s) {
    if (s.screen !== "mall") return;
    if (s.pk !== 6) {
      note(s, Copy.ui.packagesLeft + (6 - s.pk), "buzz");
      return;
    }
    s.bonus = 10 * Math.max(0, 300 - Math.floor(s.elapsed / 60));
    points(s, 1000 + s.bonus);
    s.head = pick(s, C.headlines);
    s.post = pick(s, C.complete);
    scene(s, "clear");
    event(s, "clear");
  }
  function mall(s, h, k) {
    let p = s.p,
      dx = +h.has("right") - +h.has("left"),
      v = +h.has("down") - +h.has("up"),
      act = k === "up" || k === "down";
    if (p.hide) {
      if (--p.hide === 0 || act) {
        p.hide = 0;
        p.inv = 60;
        if (!s.photo) {
          s.photo = true;
          s.photoTime = 160;
          note(s, Copy.ui.photoStrip1, "item");
        }
      }
      mechanism(s);
      spies(s);
      mallShots(s);
      environment(s);
      return;
    }
    if (s.es) {
      let e = s.es;
      e.t++;
      p.x = e.x + (e.sign * 32 * e.t) / 48;
      p.y = Y(e.f) + e.sign * e.t;
      if (e.t >= 48) {
        p.f += e.sign;
        s.es = null;
        p.safe = [p.x, p.f];
      }
      return;
    }
    if (p.ride >= 0) {
      let c = s.cars[p.ride];
      if (c.y === c.goal && dx) {
        p.ride = -1;
        p.x = c.x + dx * 15;
        p.dir = dx;
        p.safe = [p.x, p.f];
      } else if (p.ride !== 2 && v && c.y === c.goal) {
        c.goal = Y(clamp(p.f + v, c.lo, c.hi));
        if (c.goal !== c.y) event(s, "hum");
      }
      if (
        p.ride >= 0 &&
        p.ride !== 2 &&
        v &&
        c.goal - c.y === v &&
        c.call === null
      )
        c.goal = Y(clamp((c.goal - Y(0)) / 48 + v, c.lo, c.hi));
      mechanism(s);
      if (s.screen === "mall") {
        spies(s);
        mallShots(s);
        environment(s);
      }
      return;
    }
    if (!p.freeze) {
      const slip = s.wet && p.f === 4 && near(p.x, s.patch, 24) && !p.air;
      p.slide = slip ? p.slide || dx || p.dir : 0;
      if (p.slide) dx = p.slide;
      const speed = s.power.speed > 0 ? 1.5 : 1;
      p.duck = !p.air && !dx && h.has("down");
      if (dx) p.dir = dx;
      if (!p.air && k === "b") {
        p.air = true;
        p.vy = s.power.speed && s.power.shoes ? -3.7 : -3.12;
        p.kick = !!dx;
        p.momentum = dx;
        p.roof = -1;
        event(s, "jump");
      }
      p.x = clamp(
        p.x +
          (p.fallShaft != null ? 0 : p.air && p.kick ? p.momentum : dx) * speed,
        8,
        760,
      );
      p.moving = !!dx;
      const i = s.cars.findIndex(
        (c) => p.f >= c.lo && p.f <= c.hi && near(p.x, c.x, 18),
      );
      let boarding = false;
      if (i >= 0 && !p.air) {
        const c = s.cars[i];
        if (dx) p.still = 0;
        else p.still = (p.still || 0) + 1;
        if (act || p.still === 30) {
          if (c.y === Y(p.f) && c.goal === c.y) {
            p.ride = i;
            p.roof = -1;
            p.x = c.x;
            p.y = c.y;
          } else {
            c.goal = Y(p.f);
            c.call = p.f;
            c.wait = 120;
          }
          boarding = true;
        }
      } else p.still = 0;
      if (p.roof >= 0 && !near(p.x, s.cars[p.roof].x, 8)) {
        p.roof = -1;
        p.air = true;
        p.vy = 0;
        p.f = clamp(Math.ceil((p.y - Y(0)) / 48), 0, 5);
      }
      if (p.ride < 0 && p.roof < 0) {
        let hole = p.fallShaft ?? pit(s, p.x, p.f),
          landing = Y(p.f);
        if (hole >= 0 && s.cars[hole].call !== p.f) {
          landing = s.cars[hole].y - 21;
          if (!p.air) {
            p.vy = 0;
            p.air = true;
            p.kick = false;
            p.fallShaft = hole;
          }
        }
        if (p.air) {
          p.y += p.vy;
          p.vy += 0.24;
          if (p.vy >= 0 && p.y >= landing) {
            if (hole >= 0 && s.cars[hole].y - Y(p.f) > 48) dead(s);
            else {
              p.air = false;
              p.fallShaft = null;
              p.y = landing;
              p.roof = hole;
              if (!(s.wet && p.f === 4 && near(p.x, s.patch, 24)))
                p.kick = false;
            }
          }
        } else if (!p.slide) p.kick = false;
      }
      if (s.screen !== "mall") return;
      if (act && !boarding && !p.air) {
        const st = D.stores.find(
          (st) =>
            st.f === p.f &&
            near(st.x, p.x, 10) &&
            st.role !== "C" &&
            !s.rooms[st.id].cleared,
        );
        if (st) {
          enter(s, st.id);
          return;
        }
        if (p.f === 5 && near(p.x, D.car, 34)) {
          clearLevel(s);
          return;
        }
        for (const [x, top] of D.stairs) {
          let sign = k === "down" ? 1 : -1;
          if (
            p.f === (sign === 1 ? top : top + 1) &&
            near(p.x, x + (sign === 1 ? 0 : 32), 12)
          ) {
            s.es = { x: p.x, f: p.f, sign, t: 0 };
            break;
          }
        }
        if (p.f === 2 && near(p.x, D.booth, 10)) {
          p.hide = 300;
          note(s, Copy.ui.photoBooth, "door");
        }
        if (p.f > 0 && p.f < 5 && near(p.x, D.kiosk, 10) && !s.kioskCD) {
          let st = D.stores
            .filter((t) => t.role === "T" && !s.rooms[t.id].cleared)
            .sort(
              (a, b) =>
                Math.abs(a.x - p.x) +
                Math.abs(a.f - p.f) * 150 -
                Math.abs(b.x - p.x) -
                Math.abs(b.f - p.f) * 150,
            )[0];
          s.kioskCD = 1200;
          if (st) {
            s.hint = st.id;
            s.hintTime = 150;
            note(s, D.floors[st.f] + " " + st.name, "ding");
          }
        }
      }
      if (p.ride < 0 && !p.air && i < 0 && p.roof < 0) p.safe = [p.x, p.f];
      if (h.has("a")) fire(s, false);
    }
    mechanism(s);
    if (s.screen !== "mall") return;
    spies(s);
    mallShots(s);
    environment(s);
  }
  function guard(s, x, y, bot = false) {
    return {
      x,
      y,
      dx: 1,
      dy: 0,
      bot,
      hp: bot ? 3 : 1,
      cd: 120,
      stun: 0,
      travel: 0,
    };
  }
  function enter(s, id) {
    const room = s.rooms[id];
    if (D.stores[id].role === "C" || room.cleared) return;
    s.store = id;
    s.r = {
      x: room.w / 2,
      y: room.h - 18,
      w: room.w,
      h: room.h,
      dx: 0,
      dy: -1,
    };
    s.shots = [];
    s.pop = [];
    s.fx = [];
    s.search = null;
    s.toys = [];
    s.hold = 0;
    s.sideB = false;
    s.guards = [
      guard(s, 32, 32),
      guard(s, 208, 96, id === 1 || id === 8),
    ].slice(0, id === 0 ? 1 : 2);
    if (s.loop > 1 && id !== 0) s.guards.push(guard(s, 64, 88));
    s.intro = s.visited.includes(id) ? 0 : C.visits[id].length * 60;
    s.cave = id === 3 && !s.egg;
    s.caveTime = s.cave ? 124 : 0;
    if (s.cave) s.pedestal = Math.floor(rand(s) * C.items.length);
    if (!s.visited.includes(id)) s.visited.push(id);
    s.p.inv = Math.max(s.p.inv, 75);
    s.fade = 14;
    s.bannerTime = 0;
    scene(s, "store");
    event(s, "door");
  }
  function leave(s) {
    const st = D.stores[s.store];
    s.p.x = st.x;
    s.p.y = Y(st.f);
    s.p.f = st.f;
    s.p.inv = 90;
    s.p.safe = [st.x, st.f];
    s.shots = [];
    s.pop = [];
    s.store = -1;
    s.search = null;
    s.fade = 14;
    scene(s, "mall");
    event(s, "door");
  }
  function fixture(s, x, y, r = 0) {
    return s.rooms[s.store].fs.find(
      (a) =>
        x >= a.x - r &&
        x <= a.x + a.w + r &&
        y >= a.y - r &&
        y <= a.y + a.h + r,
    );
  }
  function solid(s, x, y, r = 5) {
    return (
      x < 12 ||
      x > s.r.w - 12 ||
      y < 25 ||
      y > s.r.h - (near(x, s.r.w / 2, 10) ? 0 : 12) ||
      !!fixture(s, x, y, r) ||
      (near(y, 30, 7 + r) && near(x, s.r.w / 2, 18 + r))
    );
  }
  function roomMove(s, a, dx, dy, assist = false) {
    if (!solid(s, a.x + dx, a.y + dy)) {
      a.x += dx;
      a.y += dy;
      return true;
    }
    if (assist)
      for (const sign of [-1, 1]) {
        const sx = dy ? sign : 0,
          sy = dx ? sign : 0;
        if (
          !solid(s, a.x + sx, a.y + sy) &&
          !solid(s, a.x + dx + sx * 4, a.y + dy + sy * 4)
        ) {
          a.x += sx;
          a.y += sy;
          return true;
        }
      }
    return false;
  }
  function touch(s) {
    const a = s.r;
    return s.rooms[s.store].fs
      .filter(
        (f) =>
          !f.opened &&
          a.x >= f.x - 9 &&
          a.x <= f.x + f.w + 9 &&
          a.y >= f.y - 9 &&
          a.y <= f.y + f.h + 9,
      )
      .sort(
        (u, v) =>
          Math.hypot(a.x - u.x - u.w / 2, a.y - u.y - u.h / 2) -
          Math.hypot(a.x - v.x - v.w / 2, a.y - v.y - v.h / 2),
      )[0];
  }
  function face(r, f) {
    let dx = f.x + f.w / 2 - r.x,
      dy = f.y + f.h / 2 - r.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      r.dx = Math.sign(dx);
      r.dy = 0;
    } else {
      r.dx = 0;
      r.dy = Math.sign(dy);
    }
  }
  function reveal(s, f) {
    s.search = null;
    if (s.store === 0 && f.i === 0 && rand(s) < 0.25) {
      s.guards.push(guard(s, f.x - 9, f.y + 8));
      s.shots.push({
        x: f.x - 8,
        y: f.y + 8,
        dx: Math.sign(s.r.x - f.x + 8) * 2,
        dy: Math.sign(s.r.y - f.y - 8) * 2,
        enemy: true,
        shoe: true,
        t: 80,
      });
      note(s, Copy.ui.occupied, "shriek");
      return;
    }
    f.opened = true;
    if (f.kind === "package") {
      s.rooms[s.store].cleared = true;
      s.pk++;
      s.heldItem = { package: true };
      s.hold = 60;
      points(s, 500);
      note(s, Copy.ui.package + s.pk + "/6", "package", 120);
    } else if (f.kind === "power") {
      const id = s.store === 9 ? pick(s, [6, 7, 8]) : Math.floor(rand(s) * 9);
      power(s, id);
      s.heldItem = { power: id };
      s.hold = 32;
    } else {
      note(
        s,
        f.kind === "trap" ? Copy.ui.itSATrap : Copy.ui.nothingHere,
        "smoke",
      );
      s.fx.push({ x: f.x + 12, y: f.y + 5, t: 24 });
      if (f.kind === "trap") s.p.freeze = 60;
    }
  }
  function roomActors(s) {
    const r = s.r;
    for (const b of s.shots) {
      b.x += b.dx;
      b.y += b.dy;
      b.t--;
      let f = fixture(s, b.x, b.y);
      if (solid(s, b.x, b.y, 0)) {
        b.t = 0;
        if (!b.enemy && f && s.store === 4 && !f.toys) {
          f.toys = true;
          for (let i = 0; i < 3; i++)
            s.toys.push({
              x: f.x - 8,
              y: f.y + 3 + i * 4,
              dx: -1,
              dy: 0,
              t: 600,
            });
          event(s, "zip");
        }
        continue;
      }
      if (b.enemy && near(b.x, r.x, 5) && near(b.y, r.y, 5)) {
        b.t = 0;
        dead(s);
      }
      if (!b.enemy)
        for (const g of s.guards)
          if (g.hp > 0 && near(g.x, b.x, 7) && near(g.y, b.y, 7)) {
            g.hp--;
            b.t = 0;
            event(s, "ping");
            if (!g.hp) points(s, 100, g.x, g.y);
            break;
          }
    }
    s.shots = s.shots.filter((b) => b.t > 0);
    s.guards = s.guards.filter((g) => g.hp > 0);
    for (const t of s.toys) {
      t.t--;
      let f = fixture(s, t.x + t.dx * 4, t.y + t.dy * 4, 5);
      if (f && !f.opened && f.kind === "trap") {
        f.opened = true;
        s.fx.push({ x: t.x, y: t.y, t: 24 });
        for (const g of s.guards)
          if (Math.hypot(g.x - t.x, g.y - t.y) < 40) g.stun = 120;
      }
      if (!roomMove(s, t, t.dx, t.dy)) [t.dx, t.dy] = [-t.dy, t.dx];
      for (const g of s.guards)
        if (near(g.x, t.x, 8) && near(g.y, t.y, 8)) g.stun = 100;
    }
    s.toys = s.toys.filter((t) => t.t > 0);
    for (const g of s.guards) {
      if (g.stun) {
        g.stun--;
        continue;
      }
      let dx = r.x - g.x,
        dy = r.y - g.y;
      if (!g.bot && g.travel <= 0) {
        let dirs = [
          [Math.sign(dx), 0],
          [0, Math.sign(dy)],
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ];
        if (Math.abs(dy) > Math.abs(dx))
          dirs.reverse(), dirs.unshift([0, Math.sign(dy)]);
        if (rand(s) < 0.3) dirs.unshift(pick(s, dirs));
        const d = dirs.find(
          ([a, b]) => (a || b) && !solid(s, g.x + a * 6, g.y + b * 6),
        );
        if (d) [g.dx, g.dy] = d;
        g.travel = 16;
      }
      const speed = g.bot ? 0.45 : 0.32;
      if (!roomMove(s, g, g.dx * speed, g.dy * speed)) {
        g.dx *= -1;
        g.dy *= -1;
        g.travel = 0;
      } else g.travel -= speed;
      if (near(dx, 0, 9) && near(dy, 0, 9)) {
        if (s.power.food) {
          g.hp = 0;
          points(s, 100);
        } else dead(s);
      }
      if (--g.cd <= 0 && !g.bot && (Math.abs(dx) < 5 || Math.abs(dy) < 5)) {
        const ax = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0,
          ay = ax ? 0 : Math.sign(dy);
        let clear = true;
        for (let i = 4; i < Math.abs(dx) + Math.abs(dy); i += 4)
          if (solid(s, g.x + i * ax, g.y + i * ay, 0)) {
            clear = false;
            break;
          }
        if (clear) {
          s.shots.push({
            x: g.x,
            y: g.y,
            dx: ax * 2,
            dy: ay * 2,
            enemy: true,
            t: 100,
          });
          g.cd = difficulty(s).shot;
          event(s, "enemy");
        }
      }
    }
  }
  function room(s, h, k) {
    if (s.caveTime) {
      s.caveTime--;
      if (s.caveTime % 5 === 0) event(s, "text");
      return;
    }
    if (s.intro) s.intro--;
    if (s.hold) {
      s.hold--;
      return;
    }
    const r = s.r;
    let dy = +h.has("down") - +h.has("up"),
      dx = dy ? 0 : +h.has("right") - +h.has("left");
    if (!s.p.freeze) {
      if (s.search) {
        const q = s.search;
        if (
          (["up", "down", "left", "right"].includes(k) && k !== q.dir) ||
          h.has("a")
        )
          s.search = null;
        else {
          if (++q.t % 10 === 0) event(s, "tick");
          if (q.t >= q.max) reveal(s, q.f);
        }
      }
      r.moving = false;
      if (!s.search && !s.hold) {
        if (dx || dy) {
          r.moving = true;
          r.dx = dx;
          r.dy = dy;
          const speed = s.power.speed ? 1.5 : 1;
          roomMove(s, r, dx * speed, dy * speed, true);
        }
        if (r.y >= r.h - 3) {
          leave(s);
          return;
        }
        if (s.cave && near(r.x, 128, 11) && near(r.y, 70, 12)) {
          const item = C.items[s.pedestal];
          s.heldItem = { joke: s.pedestal };
          s.inventory.push(item);
          s.egg = true;
          s.cave = false;
          s.hold = 65;
          points(s, 1);
          note(s, Copy.ui.youGot + item, "item");
          s.fx.push({ x: 128, y: 44, t: 28 });
        }
        if (k === "b") {
          const f = touch(s);
          if (f) {
            face(r, f);
            s.search = {
              f,
              t: 0,
              max: s.power.speed && s.power.shoes ? 28 : 45,
              dir: r.dx
                ? r.dx > 0
                  ? "right"
                  : "left"
                : r.dy > 0
                  ? "down"
                  : "up",
            };
            event(s, "tick");
          }
        }
        if (h.has("a")) fire(s, true);
      }
    }
    if (s.store === 7 && !s.sideB && near(r.x, 128, 12) && near(r.y, 92, 10)) {
      s.sideB = true;
      note(s, Copy.ui.nowPlayingSideB, "ding");
    }
    if (!s.cave && !s.intro) roomActors(s);
  }
  function step(s, input = {}) {
    let h = input.held || new Set(),
      k = input.press;
    s.events = [];
    if (s.overlay) {
      if (k === "start" || k === "select") {
        s.overlay = "";
        event(s, "pause");
      }
      return;
    }
    if (
      ["mall", "store"].includes(s.screen) &&
      (k === "select" || k === "start")
    ) {
      s.overlay = k === "select" ? "map" : "pause";
      event(s, "pause");
      return;
    }
    s.age++;
    if (s.bannerTime) s.bannerTime--;
    switch (s.screen) {
      case "splash":
        if (s.age === 60) event(s, "studio");
        if (k || s.age >= Flickersoft.duration) scene(s, "title");
        break;
      case "title":
        if (k === "start") {
          start(s);
          break;
        }
        if (k) {
          s.combo = (
            s.combo +
            ({ up: "U", down: "D", left: "L", right: "R", a: "A", b: "B" }[k] ||
              "_")
          ).slice(-10);
          if (s.combo === "UUDDLRLRBA") {
            s.black = true;
            note(s, Copy.ui.blackFriday, "package", 240);
          }
        }
        break;
      case "arrival":
        if (s.age === 76) event(s, "thud");
        if (s.age >= 100) {
          scene(s, "selfie");
          event(s, "photo");
        }
        break;
      case "selfie":
        if (k || s.age >= 150) {
          scene(s, "mall");
          note(s, Copy.ui.findThe6RedDoors, "door", 125);
        }
        break;
      case "death":
        if (s.age >= 50) {
          if (s.lives) respawn(s);
          else if (s.continues) {
            scene(s, "continue");
            event(s, "ding");
          } else {
            scene(s, "over");
            event(s, "pa");
          }
        }
        break;
      case "continue":
        if (k === "start") {
          s.continues--;
          s.lives = 3;
          s.power = clean();
          respawn(s, true);
        } else if (s.age >= 600) {
          scene(s, "over");
          event(s, "pa");
        } else if (s.age % 60 === 0) event(s, "ding");
        break;
      case "over":
        if (s.age < 90 && s.age % 4 === 0) event(s, "text");
        s.hi = Math.max(s.score, s.hi);
        if (s.age === 120) event(s, "over");
        if (s.age >= 330 || (s.age >= 120 && k === "start")) {
          s.black = false;
          s.combo = "";
          scene(s, "title");
        }
        break;
      case "clear":
      case "paper":
      case "winpost":
        if (k === "start" || s.age >= 210) {
          if (s.screen === "winpost") {
            s.loop++;
            level(s);
          } else scene(s, s.screen === "clear" ? "paper" : "winpost");
        }
        break;
      case "mall":
      case "store": {
        s.elapsed++;
        if (!s.alarm && s.elapsed >= difficulty(s).alarm) {
          s.alarm = true;
          note(s, Copy.ui.alarmSecurityAlerted, "whistle", 160);
        } else if (s.elapsed % 3600 === 0) {
          s.prevPA =
            (s.prevPA + 1 + Math.floor(rand(s) * (C.pa.length - 1))) %
            C.pa.length;
          note(s, C.pa[s.prevPA], "pa", 200);
        }
        for (const key of ["inv", "cd", "freeze"]) if (s.p[key]) s.p[key]--;
        for (const key of ["gun", "speed", "food"])
          if (s.power[key]) s.power[key]--;
        for (const key of ["fade", "shake", "kioskCD", "hintTime", "photoTime"])
          if (s[key]) s[key]--;
        s.fountainCD = s.fountainCD.map((x) => Math.max(0, x - 1));
        s.pop = s.pop.filter((x) => --x.t > 0);
        s.fx = s.fx.filter((x) => --x.t > 0);
        if (s.screen === "mall") mall(s, h, k);
        else room(s, h, k);
        break;
      }
    }
    s.hi = Math.max(s.hi, s.score || 0);
  }
  return {
    newGame,
    step,
    start,
    enter,
    leave,
    touch,
    solid,
    rand,
    dead,
    power,
    points,
    difficulty,
    mechanism,
    clearLevel,
    spy,
    kill,
    reveal,
  };
})();
