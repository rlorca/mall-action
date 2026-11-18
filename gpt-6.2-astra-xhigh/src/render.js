globalThis.View = (ctx) => {
  const g = Art.artist(ctx),
    { rect: R, line: L, poly: P, box: B, text: T, mini: M, spr: S } = g,
    D = MallData,
    Y = D.floorY;
  const accents = [
    ["wine", "pink"],
    ["deep", "ice"],
    ["teal", "mint"],
    ["violet", "lilac"],
    ["rust", "gold"],
    ["denim", "smoke"],
    ["plum", "pink"],
    ["wine", "coral"],
    ["deep", "aqua"],
    ["rust", "peach"],
    ["denim", "slate"],
    ["teal", "mint"],
    ["violet", "smoke"],
  ];
  const center = (t, y, c = "cream", z = 1) => T(t, 128, y, c, z, "center");
  function wrap(t, n) {
    let out = [""];
    for (const w of t.split(" ")) {
      let i = out.length - 1;
      if (out[i] && (out[i] + " " + w).length > n) out.push(w);
      else out[i] += (out[i] ? " " : "") + w;
    }
    return out;
  }
  function panel(x, y, w, h) {
    R(x + 2, y + 3, w, h, "ink");
    B(x, y, w, h, "night", "slate");
    R(x + 2, y + 2, w - 4, 1, "denim");
  }
  function sky(t, base = 160) {
    R(0, 0, 256, 240, "night");
    for (const [y, c] of [
      [0.24, "navy"],
      [0.47, "violet"],
      [0.64, "plum"],
      [0.76, "wine"],
      [0.88, "rust"],
    ])
      R(0, base * y, 256, base * (1 - y), c);
    for (let i = 0; i < 83; i++) {
      let x = (i * 193 + 37) % 257,
        y = (i * i * 13) % Math.max(1, base - 22);
      R(
        x,
        y,
        1 + (i % 13 === 0),
        1,
        i % 9 === 0 && t % 90 < 25 ? "cream" : i % 3 ? "slate" : "lilac",
      );
    }
    const cy = base - 36;
    for (let j = -24; j < 25; j++) {
      let w = Math.sqrt(25 * 25 - j * j);
      if (j > 1 && j % 5 <= 1) continue;
      R(196 - w, cy + j, 2 * w, 1, j < 0 ? "peach" : "coral");
    }
    for (let i = 0; i < 26; i++) {
      let x = i * 11 - 4,
        h = 5 + ((i * 37) % 24);
      R(x, base - h, 10 + (i % 4), h, "navy");
      for (let a = 2; a < 10; a += 4)
        for (let b = 3; b < h; b += 5)
          if ((a + b + i) % 3 === 0) R(x + a, base - h + b, 2, 1, "plum");
    }
  }
  function palm(x, y, h) {
    L(x, y, x + 3, y - h, "ink");
    L(x + 1, y, x + 4, y - h, "ink");
    for (const [dx, dy] of [
      [-18, 1],
      [-14, -6],
      [-9, -10],
      [10, -8],
      [17, -2],
      [13, 5],
      [-9, 6],
    ]) {
      P(
        [
          [x + 3, y - h],
          [x + dx * 0.55, y - h + dy - 3],
          [x + dx, y - h + dy + 3],
          [x + dx * 0.53, y - h + dy],
        ],
        "ink",
      );
    }
  }
  function shop(st, x, y, t, cleared = false, bf = false) {
    const [wall, accent] = accents[st.id],
      closed = st.role === "C",
      width = 84;
    B(x, y, width, 38, "night", "ink");
    R(x + 1, y + 1, 82, 2, accent);
    B(x + 3, y + 3, 78, 10, wall, accent);
    M(st.name, x + 42, y + 6, "cream", "center");
    for (let i = 0; i < 20; i++)
      R(x + 2 + i * 4, y + 14, 4, 2, i % 2 ? wall : accent);
    for (const [i, wx] of [x + 3, x + 52].entries()) {
      B(wx, y + 17, 29, 17, cleared ? "navy" : wall, "denim");
      R(wx + 1, y + 18, 27, 2, "night");
      L(wx + 2, y + 24, wx + 9, y + 18, cleared ? "denim" : "slate");
      L(wx + 4, y + 25, wx + 10, y + 20, cleared ? "denim" : "slate");
      let product = Art.displays[st.id][i],
        f = t >> 4;
      const shade = cleared ? ["ink", "denim", "slate"] : undefined;
      if (st.id === 3 && i === 1) {
        B(wx + 2, y + 19, 12, 13, "night", "plum");
        S("rocket", wx + 2, y + 19, f);
        S("tv", wx + 15, y + 20, f);
      } else if (st.id === 4 && i === 1) {
        S("robot", wx + 1, y + 20 + (f % 2), f);
        S("rocket", wx + 13, y + 19, f);
      } else if ([0, 1, 4, 7, 9, 11, 12].includes(st.id)) {
        S(product, wx + 2, y + 19, f, false, 1, shade);
        S(product, wx + 14, y + 20, f + 1, true, 1, shade);
      } else S(product, wx + 8, y + 20, f, false, 1, shade);
      if (!cleared && product === "orb")
        R(wx + 13 + (f % 3), y + 25, 2, 2, "cream");
      if (!cleared && product === "lava")
        R(wx + 13, y + 28 - (f % 4), 2, 2, "gold");
      if (!cleared && product === "boombox")
        R(wx + 5, y + 22 - (f % 3), 1, 2, "peach");
      R(wx + 1, y + 32, 27, 2, accent);
      R(wx + 1, y + 34, 27, 2, "ink");
    }
    const dc =
      closed || cleared
        ? "denim"
        : st.role === "U"
          ? "blue"
          : t % 60 < 42
            ? "red"
            : "coral";
    B(x + 34, y + 16, 16, 21, dc, "ink");
    R(x + 36, y + 18, 12, 9, closed || cleared ? "navy" : "night");
    if (!closed && !cleared) {
      R(x + 38, y + 19, 8, 1, dc);
      R(x + 45, y + 29, 2, 1, "gold");
    }
    if (closed) {
      for (let i = 0; i < 5; i++) R(x + 33, y + 18 + i * 3, 18, 2, "slate");
      R(x + 23, y + 24, 39, 7, "cream");
      M(
        st.id === 12 ? Copy.ui.sale : Copy.ui.forLease,
        x + 42,
        y + 25,
        "ink",
        "center",
      );
    }
    if (bf && !closed) {
      R(x + 1, y + 20, 28, 7, "gold");
      M(Copy.ui.seventyOff, x + 2, y + 21, "ink");
    }
  }
  function logo(word, x, y, sx, sy, colors) {
    function layer(dx, dy, shade) {
      [...word].forEach((ch, i) => {
        const bits = Art.font[ch];
        for (let row = 0; row < 7; row++) {
          const v = parseInt(bits.slice(row * 2, row * 2 + 2), 16);
          for (let j = 0; j < 5; j++)
            if (v & (16 >> j))
              for (let k = 0; k < sy; k++) {
                let ry = row * sy + k;
                R(
                  x +
                    dx +
                    i * (sx * 5 + 2) +
                    j * sx +
                    Math.floor((7 * sy - ry) / 4),
                  y + dy + ry,
                  sx,
                  1,
                  shade || colors[Math.min(3, Math.floor((ry / (7 * sy)) * 4))],
                );
              }
        }
      });
    }
    layer(3, 5, "ink");
    layer(2, 4, "wine");
    layer(1, 3, "wine");
    layer(0, 2, "ink");
    layer(0, 0);
  }
  function title(s, t) {
    sky(t, 157);
    palm(12, 159, 48);
    palm(238, 160, 62);
    M("F L I C K E R S O F T", 128, 13, "ice", "center");
    R(47, 15, 34, 1, "teal");
    R(176, 15, 33, 1, "teal");
    logo(Copy.ui.mall, 67, 31, 5, 4, ["cream", "cream", "gold", "ochre"]);
    logo(Copy.ui.action, 20, 65, 6, 5, ["cream", "peach", "coral", "red"]);
    R(47, 110, 162, 11, "ink");
    M(Copy.ui.aShoppingMallEspionage, 128, 113, "peach", "center");
    if (s.black) {
      center(Copy.ui.blackFriday, 129, t % 20 < 10 ? "pink" : "gold");
      M(Copy.ui.seventyOffEverything, 128, 139, "cream", "center");
    } else {
      B(70, 128, 116, 17, "night", "aqua");
      {
        T(
          Copy.ui.pressStart,
          128,
          133,
          t % 86 < 68 ? "cream" : "slate",
          1,
          "center",
        );
        T(">", 75, 133, "gold");
      }
    }
    R(0, 156, 256, 4, "ink");
    R(0, 156, 256, 1, "aqua");
    for (let i = -1; i < 5; i++) {
      let k = (i + Math.floor(t / 344) + 13) % 13;
      shop(D.stores[k], i * 86 - (Math.floor(t / 4) % 86), 161, t);
    }
    R(0, 199, 256, 2, "slate");
    R(0, 201, 256, 39, "ink");
    M(Copy.ui.hiScore + String(s.hi).padStart(6, "0"), 10, 209, "gold");
    M(Copy.ui.c2026Flickersoft, 245, 209, "ice", "right");
    R(10, 221, 236, 1, "denim");
    M(Copy.ui.arrowsMoveZFireXJumpEnterStart, 128, 228, "smoke", "center");
  }
  function wagon(x, y, t) {
    R(x + 3, y - 3, 53, 3, "ink");
    P(
      [
        [x, y - 13],
        [x + 7, y - 15],
        [x + 11, y - 23],
        [x + 38, y - 23],
        [x + 46, y - 15],
        [x + 56, y - 13],
        [x + 57, y - 5],
        [x + 1, y - 5],
      ],
      "teal",
    );
    P(
      [
        [x + 8, y - 15],
        [x + 12, y - 21],
        [x + 36, y - 21],
        [x + 42, y - 15],
      ],
      "ice",
    );
    R(x + 20, y - 21, 2, 7, "deep");
    R(x + 29, y - 21, 2, 7, "deep");
    R(x + 3, y - 13, 49, 6, "ochre");
    R(x + 6, y - 11, 42, 2, "rust");
    R(x + 53, y - 13, 4, 3, "gold");
    R(x + 1, y - 7, 56, 2, "smoke");
    for (const xx of [x + 10, x + 42]) {
      B(xx, y - 9, 8, 8, "ink", "navy");
      R(xx + 2, y - 7, 4, 4, t % 12 < 6 ? "smoke" : "slate");
    }
  }
  function plant(x, y) {
    R(x - 4, y - 9, 9, 8, "rust");
    R(x - 5, y - 10, 11, 2, "peach");
    L(x, y - 10, x, y - 22, "teal");
    for (let i = 0; i < 4; i++) {
      L(x, y - 12 - i * 2, x - 6 + i, y - 16 - i * 2, "mint");
      L(x, y - 12 - i * 2, x + 7 - i, y - 18 - i * 2, "aqua");
    }
  }
  function headroom(f, x, y) {
    if (f > 0)
      for (let i = 0; i < 16; i++) {
        R(x + i * 48, y - 42, 1, 41, "denim");
        R(x + i * 48 + 2, y - 43, 8, 1, "denim");
      }
    R(0, y, 768, 8, "navy");
    R(0, y, 768, 2, "cream");
    R(0, y + 2, 768, 2, "slate");
    for (let j = 0; j < 768; j += 16) R(j, y + 1, 1, 2, "slate");
    if (f === 0) {
      R(0, y - 4, 768, 4, "denim");
      for (let xx = 115; xx < 768; xx += 98) {
        R(xx, y - 14, 27, 10, "slate");
        for (let k = 0; k < 5; k++) R(xx + 2 + k * 5, y - 12, 2, 6, "navy");
      }
    }
  }
  function mall(s, t) {
    const p = s.p,
      arr = s.screen === "arrival",
      ax = arr ? Math.min(96, 14 + s.age * 1.18) : p.x,
      ay = arr ? Y(0) : p.y;
    let cx = Math.max(0, Math.min(512, Math.floor(ax - 128))),
      cy = Math.max(0, Math.min(103, Math.floor(ay - 108)));
    ctx.save();
    ctx.translate(-cx, 16 - cy);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(i * 256, 0);
      sky(t, 71);
      ctx.restore();
    }
    R(0, 4, 29, 66, "ink");
    R(4, 0, 21, 4, "ink");
    for (let yy = 9; yy < 62; yy += 8)
      for (let xx = 3; xx < 27; xx += 6)
        R(xx, yy, 2, 3, (xx + yy) % 4 ? "ochre" : "denim");
    L(13, 3, 98, 52, "ink");
    L(14, 3, 98, 51, "smoke");
    R(96, 50, 3, 22, "slate");
    for (let f = 0; f < 6; f++) {
      let y = Y(f);
      if (f) {
        R(0, y - 40, 768, 40, f === 5 ? "navy" : f % 2 ? "violet" : "denim");
        R(0, y - 39, 768, 3, "navy");
        R(0, y - 35, 768, 1, "slate");
        R(0, y - 14, 768, 13, f % 2 ? "denim" : "navy");
        R(0, y - 6, 768, 2, "slate");
      }
      headroom(f, 0, y);
      if (f > 0 && f < 5) {
        for (const st of D.stores.filter((a) => a.f === f))
          shop(st, st.x - 42, y - 38, t, s.rooms[st.id].cleared, s.black);
        let x = D.kiosk;
        B(x - 8, y - 23, 16, 15, "aqua", "ink");
        B(x - 6, y - 20, 12, 8, "deep", "teal");
        M("?", x - 1, y - 19, "gold");
        R(x - 2, y - 8, 4, 8, "denim");
        plant(21, y);
        R(37, y - 6, 18, 3, "ochre");
        R(39, y - 3, 2, 3, "ink");
        R(52, y - 3, 2, 3, "ink");
        if (f === 2) {
          B(D.booth - 12, y - 31, 24, 31, "plum", "ink");
          R(D.booth - 9, y - 19, 17, 18, "wine");
          for (let k = 0; k < 4; k++)
            R(D.booth - 8 + k * 4, y - 18, 2, 17, "pink");
          M(Copy.ui.foto, D.booth, y - 28, "cream", "center");
        }
        if (f === 2 || f === 4) {
          const x = D.fountain;
          R(x - 10, y - 7, 20, 4, "ice");
          R(x - 8, y - 3, 16, 3, "blue");
          for (let j = -8; j < 9; j++) {
            let h = 11 - ((j * j) >> 3);
            R(x + j, y - 7 - h + (((j + t) >> 3) % 3), 1, 2, "ice");
          }
        }
      }
      if (f === 5) {
        for (let xx = 15; xx < 768; xx += 85) {
          R(xx, y - 40, 12, 40, "denim");
          R(xx, y - 20, 12, 3, "gold");
          R(xx, y - 16, 12, 2, "ink");
        }
        wagon(D.car - 27, y, t);
      }
      if (f > 0) {
        M(D.floors[f], 3, y - 30, "cream");
      }
    }
    for (const [x, top] of D.stairs) {
      let y = Y(top);
      for (let j = 0; j < 16; j++) {
        let xx = x + j * 2,
          yy = y + j * 3;
        R(xx, yy, 4, 3, "slate");
        R(xx, yy, 4, 1, "ice");
        if (j % 3 === 0) L(xx, yy - 1, xx, yy - 7, "denim");
      }
      L(x, y - 9, x + 32, y + 39, "gold");
    }
    for (const [i, c] of s.cars.entries()) {
      let a = Y(c.lo) - 28,
        b = Y(c.hi);
      R(c.x - 13, a, 26, b - a + 1, "ink");
      R(c.x - 13, a, 2, b - a, "slate");
      R(c.x + 11, a, 2, b - a, "slate");
      L(c.x - 4, a, c.x - 4, c.y - 22, "slate");
      L(c.x + 4, a, c.x + 4, c.y - 22, "slate");
      for (let f = c.lo; f <= c.hi; f++) {
        let y = Y(f);
        R(c.x + 14, y - 18, 8, 9, "ink");
        M("ABC"[i], c.x + 16, y - 16, "gold");
        if (c.y < y)
          for (let j = -11; j <= 10; j += 3) R(c.x + j, y - 1, 2, 2, "smoke");
      }
      B(c.x - 11, c.y - 25, 22, 26, "teal", "ochre");
      B(c.x - 9, c.y - 22, 18, 21, c.goal === c.y ? "night" : "denim", "ice");
      if (c.goal !== c.y) L(c.x, c.y - 22, c.x, c.y - 2, "ink");
      R(c.x - 12, c.y, 24, 2, "gold");
    }
    for (const l of s.lamps) {
      if (l.mode !== "gone") {
        if (l.mode === "hang") L(l.x, Y(l.f) - 38, l.x, l.y - 4, "ink");
        if (l.f === 3) {
          B(l.x - 4, l.y - 4, 9, 8, "lilac", "slate");
          R(l.x - 2, l.y - 2, 3, 2, "white");
          R(l.x + 2, l.y, 2, 2, "ice");
        } else {
          P(
            [
              [l.x - 2, l.y - 4],
              [l.x + 2, l.y - 4],
              [l.x + 6, l.y + 2],
              [l.x - 6, l.y + 2],
            ],
            "ochre",
          );
          R(l.x - 5, l.y + 2, 10, 2, "gold");
        }
      }
      if (l.dark) {
        ctx.globalAlpha = 0.5;
        R(l.origin - 38, Y(l.f) - 38, 76, 38, "black");
        ctx.globalAlpha = 1;
      }
    }
    if (s.wet) {
      R(s.patch - 24, Y(4) - 2, 48, 2, "ice");
      P(
        [
          [s.patch - 17, Y(4)],
          [s.patch - 13, Y(4) - 10],
          [s.patch - 8, Y(4)],
        ],
        "gold",
      );
      M("!", s.patch - 14, Y(4) - 7, "ink");
    }
    S(
      "janitor_" + (s.elapsed % 420 < 90 ? "aim" : "walk"),
      s.jan - 8,
      Y(4) - 24,
      t >> 3,
      s.jdir < 0,
    );
    L(s.jan + 5, Y(4) - 15, s.jan + 11, Y(4) - 1, "ochre");
    s.walk.forEach((x, i) =>
      S("walker_walk", x - 8, Y(3) - 24, (t >> 3) + i, s.wdir < 0),
    );
    S("cop_walk", s.cop.x - 8, Y(s.cop.f) - 26, 0, s.cop.dir < 0);
    R(s.cop.x - 8, Y(s.cop.f) - 5, 18, 3, "slate");
    R(s.cop.x - 7, Y(s.cop.f) - 3, 4, 3, "ink");
    R(s.cop.x + 4, Y(s.cop.f) - 3, 4, 3, "ink");
    for (const e of s.spies)
      S(
        "spy_" + (e.die ? "dead" : e.aim ? "aim" : e.duck ? "duck" : "walk"),
        e.x - 8,
        Y(e.f) - 24,
        t >> 3,
        e.dir < 0,
      );
    for (const o of s.drops) {
      if (o.power != null) S(Art.powerIcons[o.power], o.x - 6, o.y - 10);
      else {
        R(o.x - 2, o.y - 3, 4, 5, o.gold ? "gold" : "ice");
        R(o.x - 1, o.y - 2, 1, 2, "white");
      }
    }
    if (!p.hide && (!p.inv || t % 6 < 4 || s.screen === "death")) {
      const pose = arr
        ? s.age < 70
          ? "zip"
          : "duck"
        : s.screen === "death"
          ? "dead"
          : p.kick
            ? "kick"
            : p.duck
              ? "duck"
              : p.cd > 8
                ? "aim"
                : "walk";
      S(
        "agent_" + pose,
        ax - 8,
        (arr ? Math.min(Y(0), 20 + s.age * 0.7) : p.y) - 24,
        p.air ? 1 : (t >> 3) * (p.moving ? 1 : 0),
        p.dir < 0,
        1,
        s.power.food && t % 8 < 4 ? ["ink", "gold", "cream"] : undefined,
      );
    }
    if (s.screen === "over")
      for (let yy = 0; yy < Math.min(37, s.age / 3); yy += 3)
        for (const st of D.stores)
          R(st.x - 42, Y(st.f) - 38 + yy, 84, 2, "slate");
    shots(s);
    ctx.restore();
    if (s.walkTalk && Math.abs(s.walk[0] - cx - 128) < 135)
      bubble(Copy.ui.hey, s.walk[0] - cx, Y(3) - cy - 20);
    if (s.cop.talk && Math.abs(s.cop.x - cx - 128) < 135)
      bubble(Copy.ui.heyStopRightThere, s.cop.x - cx, Y(s.cop.f) - cy - 20);
    for (const e of s.spies)
      if (e.talk > 0 && Math.abs(e.x - cx - 128) < 132)
        bubble(e.bubble, e.x - cx, Y(e.f) - cy - 21);
    if (s.hintTime) {
      panel(175, 24, 76, 45);
      M(Copy.ui.directory, 213, 29, "gold", "center");
      for (let f = 1; f < 5; f++) R(182, 34 + f * 6, 60, 1, "slate");
      const st = D.stores[s.hint];
      R(182 + st.x / 13, 30 + st.f * 6, 5, 4, "coral");
    }
    if (s.photoTime) {
      panel(14, 39, 30, 98);
      for (let i = 0; i < 4; i++) {
        R(18, 42 + i * 23, 22, 21, i % 2 ? "plum" : "teal");
        S("agent_" + ["walk", "aim", "duck", "zip"][i], 21, 42 + i * 23);
      }
    }
  }
  function shots(s) {
    for (const b of s.shots) {
      if (b.shoe) {
        S("shoe", b.x - 6, b.y - 6);
        continue;
      }
      R(
        b.x - 1,
        b.y - 1,
        Math.abs(b.dx) > 0 ? 4 : 2,
        Math.abs(b.dy) > 0 ? 4 : 2,
        b.enemy ? "coral" : "gold",
      );
    }
    for (const p of s.pop)
      M(
        (p.n > 0 ? "+" : "") + p.n,
        p.x,
        p.y - (45 - p.t) / 4,
        "gold",
        "center",
      );
  }
  function bubble(t, x, y) {
    let w = t.length * 4 + 8;
    const left = Math.max(2, Math.min(254 - w, x - w / 2)),
      top = Math.max(18, Math.min(225, y));
    B(left, top, w, 11, "cream", "ink");
    M(t, left + 4, top + 3, "ink");
    R(Math.max(left + 3, Math.min(left + w - 5, x)), top + 10, 3, 2, "cream");
  }
  function room(s, t) {
    const st = D.stores[s.store],
      rm = s.rooms[s.store],
      r = s.r,
      [wall, accent] = accents[st.id],
      ox = -Math.max(0, Math.min(rm.w - 256, r.x - 128)),
      oy = 32 - Math.max(0, Math.min(rm.h - 176, r.y - 88));
    R(0, 0, 256, 240, "ink");
    ctx.save();
    ctx.translate(ox, oy);
    R(0, 0, rm.w, rm.h, "denim");
    for (let y = 16; y < rm.h; y += 16)
      for (let x = 0; x < rm.w; x += 16) {
        const alt = (x + y) % 32 === 0;
        R(x, y, 15, 15, alt ? wall : "navy");
        if (st.theme % 3 === 0) {
          R(x + 6, y + 7, 3, 1, alt ? "slate" : "denim");
          R(x + 7, y + 6, 1, 3, alt ? "slate" : "denim");
        } else if (st.theme % 3 === 1) {
          R(x + 1, y + 1, 12, 1, "denim");
          R(x + 1, y + 1, 1, 12, "denim");
        } else R(x + 2, y + 2, 2, 2, "denim");
      }
    R(0, 0, rm.w, 17, "night");
    R(0, 16, rm.w, 3, accent);
    for (let x = 4; x < rm.w; x += 32) {
      B(x, 2, 23, 12, wall, "slate");
      R(x + 3, 4, 15, 1, accent);
      R(x + 3, 7, 9, 2, "denim");
    }
    R(0, 18, 8, rm.h - 18, wall);
    R(rm.w - 8, 18, 8, rm.h - 18, wall);
    R(0, rm.h - 8, rm.w, 8, wall);
    R(rm.w / 2 - 14, rm.h - 10, 28, 10, "ink");
    R(rm.w / 2 - 12, rm.h - 8, 24, 2, "gold");
    M(Copy.ui.exit, rm.w / 2, rm.h - 5, "cream", "center");
    B(rm.w / 2 - 20, 23, 40, 15, wall, "ink");
    R(rm.w / 2 - 19, 24, 38, 3, accent);
    M(Copy.ui.checkout, rm.w / 2, 31, "cream", "center");
    for (const f of rm.fs) {
      R(f.x + 2, f.y + 3, f.w, f.h, "ink");
      B(f.x, f.y, f.w, f.h, wall, accent);
      R(f.x + 2, f.y + 3, f.w - 4, f.h - 6, f.opened ? "ink" : "night");
      R(f.x, f.y + f.h - 3, f.w, 2, accent);
      if (!f.opened) {
        const a = st.theme;
        if (a === 0) {
          R(f.x + 2, f.y + 2, 2, 10, "pink");
          R(f.x + f.w - 4, f.y + 2, 2, 10, "pink");
          if (!f.i) {
            for (let k = 0; k < 5; k++)
              R(f.x + 3 + k * 4, f.y + 2, 2, 10, k % 2 ? "wine" : "plum");
          }
        }
        if ([1, 3, 6].includes(a)) {
          for (let k = 0; k < 3; k++)
            R(f.x + 2 + k * 3, f.y + f.h - 4, 2, 1, k === 1 ? "gold" : "blue");
          R(f.x + f.w - 6, f.y + 4, 2, 5, "slate");
        }
        if ([2, 5].includes(a)) {
          R(f.x + 2, f.y + f.h - 4, f.w - 4, 1, "ice");
          L(f.x + 2, f.y + 6, f.x + 7, f.y + 1, "slate");
        }
        if (a === 4 || a === 8) {
          R(f.x + 1, f.y + 9, f.w - 2, 2, "ochre");
          S(Art.displays[st.id][1], f.x + 1, f.y - 2, t >> 4);
        }
        if (a === 7) {
          for (let k = 0; k < 8; k++)
            R(f.x + 1 + k * 3, f.y - 2, 3, 3, k % 2 ? "cream" : "red");
        }
      }
      if (f.opened) {
        L(f.x + 3, f.y + 10, f.x + 12, f.y + 5, "slate");
        R(f.x + 17, f.y + 8, 5, 2, "denim");
      } else {
        S(Art.displays[st.id][f.i % 2], f.x + 7, f.y - 1, t >> 4);
        if (s.power.radar && f.kind === "package" && t % 40 < 30)
          T("!", f.x + 11, f.y - 8, "gold");
      }
    }
    if (st.id === 7) {
      B(117, 84, 22, 14, "night", accent);
      S("record", 122, 84);
    }
    if (s.cave) {
      S("clerk_front", 120, 38);
      S("tv", 98, 42, t >> 3);
      S("tv", 145, 42, t >> 3);
      B(121, 64, 15, 12, "slate", "cream");
      if (!s.caveTime) S(Art.jokeIcons[s.pedestal], 122, 59);
    }
    for (const g of s.guards) {
      if (s.cave) break;
      S(
        (g.bot ? "bot" : "spy") +
          "_" +
          (g.dy < 0 ? "back" : g.dx ? "side" : "front"),
        g.x - 8,
        g.y - 9,
        s.intro ? 0 : t >> 4,
        g.dx < 0,
      );
      if (g.stun) M("*", g.x, g.y - 14, "gold");
    }
    for (const toy of s.toys) S("robot", toy.x - 5, toy.y - 6, t >> 3);
    for (const fx of s.fx)
      for (let i = 0; i < 6; i++)
        R(
          fx.x + Math.cos(i) * (0.6 * (25 - fx.t)),
          fx.y + Math.sin(i) * (0.5 * (25 - fx.t)),
          3,
          3,
          "smoke",
        );
    if (!s.p.inv || t % 6 < 4)
      S(
        "agent_" +
          (s.hold ? "hold" : r.dy < 0 ? "back" : r.dx ? "side" : "front"),
        r.x - 8,
        r.y - 9,
        (t >> 3) * (r.moving ? 1 : 0),
        r.dx < 0,
      );
    if (s.hold) {
      const item = s.heldItem;
      S(
        Art.powerIcons[item?.power] || Art.jokeIcons[item?.joke] || "parcel",
        r.x - 6,
        r.y - 22,
      );
    }
    shots(s);
    if (s.search) {
      B(r.x - 12, r.y - 17, 24, 4, "ink", "cream");
      R(r.x - 11, r.y - 16, (22 * s.search.t) / s.search.max, 2, "mint");
    }
    ctx.restore();
    M(D.floors[st.f] + " / " + st.name, 9, 22, accent);
    M(Copy.ui.interior, 246, 22, "slate", "right");
    R(0, 210, 256, 2, wall);
    T(st.name, 9, 218, accent);
    M(
      s.search
        ? Copy.ui.searching
        : Game.touch(s)
          ? Copy.ui.pressXToSearch
          : Copy.ui.findAFixtureXToSearch,
      9,
      231,
      "cream",
    );
    if (s.intro) {
      const lines = Copy.visits[st.id],
        idx = lines.length - Math.ceil(s.intro / 60);
      let actor = s.guards[idx % s.guards.length];
      if (actor) bubble(lines[idx], actor.x + ox, actor.y + oy - 22);
    }
    if (s.caveTime) {
      panel(12, 161, 232, 38);
      M(Copy.ui.storeClerk, 19, 168, "gold");
      wrap(Copy.cave.slice(0, Math.floor((125 - s.caveTime) / 2)), 32).forEach(
        (l, i) => T(l, 19, 178 + i * 9, "cream"),
      );
    }
  }
  function hud(s, t) {
    R(0, 0, 256, 16, "ink");
    R(0, 15, 256, 1, "ochre");
    M(Copy.ui.score, 3, 2, "smoke");
    T(String(s.score).padStart(6, "0"), 3, 8, "cream");
    T(Copy.ui.pkg, 45, 5, "smoke");
    T(s.pk + "/6", 65, 5, s.pk === 6 ? "mint" : "coral");
    S("agent_front", 87, -1, 0);
    M("X" + s.lives, 102, 6, "cream");
    const a = s.power;
    const name = a.food
      ? Copy.ui.cinnabomb
      : a.gun
        ? a.weapon
        : a.speed
          ? a.shoes
            ? Copy.ui.sneakers
            : Copy.ui.juliOoze
          : "";
    M(name || Copy.ui.loop + s.loop, 117, 4, name ? "mint" : "slate");
    if (name)
      R(
        117,
        11,
        39 *
          (a.food
            ? a.food / 360
            : a.gun
              ? a.gun / 1200
              : a.speed / (a.shoes ? 1200 : 720)),
        2,
        "aqua",
      );
    if (a.armor) M("V", 167, 5, "gold");
    if (a.radar) M("!", 174, 5, "mint");
    if (s.alarm && t % 60 < 40) M(Copy.ui.alarm, 181, 5, "coral");
    B(208, 2, 46, 11, "deep", "teal");
    if (s.store >= 0 && s.screen === "store") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(210, 3, 42, 9);
      ctx.clip();
      const str = D.stores[s.store].name + "   ";
      M(str + str, 210 - (Math.floor(t / 9) % (str.length * 4)), 5, "mint");
      ctx.restore();
    } else {
      M(Copy.ui.floor, 211, 5, "aqua");
      M(D.floors[s.p.f], 250, 5, "gold", "right");
    }
  }
  function map(s, t) {
    R(0, 0, 256, 240, "night");
    M(Copy.ui.flickersoftFieldGuide, 12, 10, "aqua");
    T(Copy.ui.mallDirectory, 12, 23, "cream", 2);
    R(12, 43, 232, 2, "coral");
    const xx = (x) => 30 + x * 0.275,
      yy = (f) => 64 + f * 19;
    for (let f = 0; f < 6; f++) {
      M(D.floors[f], 10, yy(f) - 4, "gold");
      R(26, yy(f) + 1, 215, 1, "slate");
    }
    s.cars.forEach((c) => {
      R(xx(c.x) - 2, yy(c.lo) - 5, 5, yy(c.hi) - yy(c.lo) + 6, "denim");
      R(xx(c.x) - 3, yy((c.y - Y(0)) / 48) - 3, 7, 4, "aqua");
    });
    for (const [x, f] of D.stairs)
      L(xx(x), yy(f), xx(x + 32), yy(f + 1), "gold");
    R(xx(D.car) - 5, yy(5) - 4, 12, 4, "ochre");
    for (const st of D.stores) {
      let color =
        st.role === "C"
          ? "navy"
          : st.role === "U"
            ? "blue"
            : s.rooms[st.id].cleared
              ? "slate"
              : "red";
      B(xx(st.x) - 5, yy(st.f) - 7, 11, 8, color, "denim");
      if (s.store === st.id && t % 45 < 25)
        R(xx(st.x) - 4, yy(st.f) - 6, 9, 6, "cream");
      if (st.role === "T" && !s.rooms[st.id].cleared && s.power.radar)
        M("!", xx(st.x) - 1, yy(st.f) - 13, "gold");
    }
    if (s.store < 0 && t % 45 < 28)
      R(xx(s.p.x) - 2, yy(s.p.f) - 7, 4, 6, "white");
    [
      Copy.ui.packageLabel,
      Copy.ui.cleared,
      Copy.ui.powerUp,
      Copy.ui.closed,
    ].forEach((l, i) => {
      R(12 + i * 59, 173, 5, 5, ["red", "slate", "blue", "denim"][i]);
      M(l, 20 + i * 59, 173, "cream");
    });
    R(12, 186, 232, 1, "denim");
    M(Copy.ui.inventory, 12, 193, "gold");
    wrap(
      [...s.inventory, ...(s.photo ? [Copy.ui.photoStrip] : [])].join(" / ") ||
        Copy.ui.empty,
      54,
    ).forEach((l, i) => M(l, 12, 205 + 8 * i, "cream"));
    M(Copy.ui.selectReturn, 244, 227, "aqua", "right");
  }
  function card(s, t) {
    R(0, 0, 256, 240, "night");
    for (let y = 0; y < 240; y += 8) L(0, y, 256, y + 80, "navy");
    panel(41, 14, 174, 212);
    R(42, 15, 172, 19, "wine");
    T(Copy.ui.spygram, 49, 21, "cream");
    M(Copy.ui.live, 203, 22, "pink", "right");
    ctx.save();
    ctx.beginPath();
    ctx.rect(49, 41, 158, 103);
    ctx.clip();
    ctx.translate(29, 28);
    sky(t, 125);
    palm(32, 122, 54); // Three inks, hand-pixelled close-up for the field camera.
    P(
      [
        [38, 122],
        [42, 106],
        [62, 96],
        [78, 89],
        [98, 89],
        [122, 105],
        [136, 122],
      ],
      "ink",
    );
    P(
      [
        [42, 122],
        [48, 107],
        [69, 100],
        [78, 94],
        [100, 94],
        [120, 108],
        [130, 122],
      ],
      "coral",
    );
    P(
      [
        [71, 95],
        [77, 79],
        [99, 77],
        [100, 99],
        [88, 111],
      ],
      "peach",
    );
    P(
      [
        [74, 85],
        [96, 83],
        [99, 89],
        [85, 99],
      ],
      "ink",
    );
    P(
      [
        [63, 51],
        [68, 34],
        [83, 28],
        [100, 31],
        [111, 42],
        [109, 58],
        [114, 67],
        [109, 69],
        [106, 80],
        [98, 88],
        [82, 88],
        [74, 80],
        [66, 73],
      ],
      "peach",
    );
    P(
      [
        [63, 66],
        [59, 59],
        [60, 49],
        [56, 47],
        [62, 43],
        [59, 41],
        [68, 38],
        [65, 35],
        [77, 28],
        [74, 25],
        [91, 24],
        [103, 28],
        [111, 35],
        [114, 43],
        [108, 46],
        [98, 42],
        [85, 40],
        [80, 47],
        [73, 50],
        [72, 61],
        [68, 58],
        [65, 59],
        [66, 69],
      ],
      "ink",
    );
    P(
      [
        [65, 48],
        [70, 39],
        [83, 33],
        [95, 32],
        [82, 35],
        [71, 42],
      ],
      "coral",
    );
    P(
      [
        [70, 51],
        [87, 53],
        [95, 54],
        [108, 51],
        [110, 54],
        [108, 63],
        [99, 65],
        [95, 58],
        [92, 58],
        [89, 65],
        [79, 65],
        [75, 57],
        [70, 55],
      ],
      "ink",
    );
    L(80, 55, 85, 55, "peach");
    L(101, 54, 105, 54, "peach");
    L(103, 72, 108, 71, "ink");
    L(101, 73, 104, 73, "ink");
    L(75, 74, 79, 79, "coral");
    P(
      [
        [67, 92],
        [53, 90],
        [60, 105],
        [72, 104],
        [68, 108],
        [83, 121],
        [79, 104],
      ],
      "ink",
    );
    P(
      [
        [65, 93],
        [56, 92],
        [62, 101],
        [72, 100],
        [70, 105],
        [80, 115],
      ],
      "coral",
    );
    P(
      [
        [99, 94],
        [110, 91],
        [107, 102],
        [99, 104],
        [102, 107],
        [89, 122],
      ],
      "ink",
    );
    R(60, 114, 3, 3, "peach");
    R(114, 114, 3, 3, "peach");
    ctx.restore();
    R(49, 144, 158, 2, "pink");
    M("♥ " + Math.min(999, 17 + 4 * s.age) + Copy.ui.likes, 50, 153, "pink");
    s.post.slice(0, 2).forEach((v, i) => T(v, 50, 165 + i * 11, "cream"));
    M(s.post[2], 50, 194, "ice");
    M(Copy.ui.fieldTransmission007, 50, 210, "slate");
    if (s.age < 5) R(0, 0, 256, 240, "white");
  }
  function clear(s, t) {
    R(0, 0, 256, 240, "navy");
    R(0, 139, 256, 22, "denim");
    for (let i = 0; i < 5; i++) {
      R(i * 63 + 11, 62, 12, 77, "slate");
      R(i * 63 + 11, 108, 12, 4, "gold");
    }
    wagon(30 + s.age * 0.85, 142, t);
    S("spy_walk", 9 + s.age * 0.74, 119, t >> 3);
    R(21 + s.age * 0.74, 120, 5, 8, "cream");
    center(Copy.ui.levelClear, 28, "gold", 2);
    panel(34, 159, 188, 66);
    M(Copy.ui.packages6X500, 44, 168, "cream");
    M(Copy.ui.timeBonus + s.bonus, 44, 181, "aqua");
    M(Copy.ui.clearBonus1000, 44, 194, "cream");
    M(Copy.ui.loop + s.loop, 44, 211, "gold");
    M(Copy.ui.start, 209, 211, "ice", "right");
  }
  function paper(s) {
    R(0, 0, 256, 240, "denim");
    B(13, 13, 230, 215, "cream", "ink");
    T(Copy.ui.theDailyMall, 128, 28, "ink", 2, "center");
    R(22, 49, 212, 3, "ink");
    M(Copy.ui.lateEdition, 23, 58, "rust");
    M(Copy.ui.issuePrice, 234, 58, "ink", "right");
    s.head.forEach((l, i) => T(l, 24, 77 + i * 14, "ink"));
    B(24, 125, 96, 82, "slate", "ink");
    S("spy_walk", 35, 131, 2, false, 3);
    S("parcel", 76, 151, 1, false, 2);
    for (let j = 0; j < 15; j++)
      R(130, 126 + j * 6, j % 4 === 0 ? 81 : 99, 2, "slate");
  }
  function gallery(t) {
    R(0, 0, 256, 240, "night");

    const keys = Object.keys(Art.sprites),
      pg = Math.floor(t / 240) % Math.ceil(keys.length / 30);
    M(Copy.ui.spriteArchive + (1 + pg), 9, 6, "gold");
    keys.slice(pg * 30, pg * 30 + 30).forEach((k, i) => {
      let x = 5 + (i % 5) * 50,
        y = 17 + Math.floor(i / 5) * 37;
      S(k, x + 12, y, t >> 3);
      M(k.split("_")[0], x, y + 26, "ice");
    });
  }
  function draw(s, t, galleryMode = false) {
    ctx.save();
    if (galleryMode) {
      gallery(t);
      ctx.restore();
      return;
    }
    if (s.overlay === "map") {
      map(s, t);
      ctx.restore();
      return;
    }
    if (s.shake && s.screen === "mall")
      ctx.translate((t % 3) - 1, ((t >> 1) % 3) - 1);
    switch (s.screen) {
      case "splash":
        Flickersoft.draw(g, s.age);
        break;
      case "title":
        title(s, t);
        break;
      case "selfie":
      case "winpost":
        card(s, t);
        break;
      case "paper":
        paper(s);
        break;
      case "clear":
        clear(s, t);
        break;
      case "continue":
        R(0, 0, 256, 240, "night");
        center(Copy.ui.continue, 48, "gold", 2);
        center(
          String(9 - Math.floor(s.age / 60)),
          88,
          s.age >= 360 ? "coral" : "cream",
          7,
        );
        center(Copy.ui.continuesLeft + s.continues, 161, "ice");
        center(Copy.ui.pressStart, 190);
        break;
      default: {
        if (
          s.screen === "store" ||
          (s.screen === "death" && s.from === "store")
        )
          room(s, t);
        else mall(s, t);
        hud(s, t);
        if (s.screen === "over") {
          panel(18, 72, 220, 85);
          wrap(
            Copy.ui.attentionShoppersTheMallIsNowClosed.slice(
              0,
              Math.floor(s.age / 2),
            ),
            22,
          ).forEach((l, i) => center(l, 82 + i * 11, "ice"));
          if (s.age >= 120) {
            center(Copy.ui.gameOver, 110, "coral", 2);
            center(Copy.ui.scoreLabel + s.score + Copy.ui.hi + s.hi, 141);
          }
        } else if (s.bannerTime && s.screen !== "arrival") {
          let lines = wrap(s.banner, 36),
            w = Math.min(248, Math.max(...lines.map((x) => x.length)) * 6 + 12),
            y = s.screen === "store" ? 22 : 204 - lines.length * 4;
          panel((256 - w) / 2, y, w, 10 + lines.length * 9);
          lines.forEach((l, i) => center(l, y + 5 + 9 * i, "gold"));
        }
        if (s.fade && ["mall", "store"].includes(s.screen)) {
          ctx.globalAlpha = s.fade / 18;
          R(0, 16, 256, 224, "ink");
          ctx.globalAlpha = 1;
        }
      }
    }
    if (s.overlay === "pause") {
      ctx.globalAlpha = 0.72;
      R(0, 0, 256, 240, "ink");
      ctx.globalAlpha = 1;
      panel(64, 96, 128, 48);
      if (t % 80 < 64) center(Copy.ui.pause, 108, "gold", 2);
      M(Copy.ui.startResume, 128, 131, "ice", "center");
    }
    ctx.restore();
  }
  return { draw, g };
};
