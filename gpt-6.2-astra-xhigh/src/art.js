globalThis.Art = (() => {
  const palette = {
    ink: "#100e20",
    night: "#191831",
    navy: "#202642",
    denim: "#34456a",
    slate: "#59698a",
    smoke: "#939bb4",
    cream: "#fff1d3",
    white: "#fff9ee",
    peach: "#ffbc91",
    gold: "#ffd36a",
    ochre: "#d89653",
    rust: "#ad594a",
    red: "#cf4256",
    coral: "#ff7668",
    wine: "#703555",
    pink: "#fc74ab",
    plum: "#8e518b",
    violet: "#565081",
    lilac: "#afa2dd",
    deep: "#254651",
    teal: "#387977",
    aqua: "#72c6b2",
    mint: "#a8e9bf",
    ice: "#a2dcdf",
    blue: "#5797c5",
    black: "#080810",
  };
  const font = {
    A: "0e11111f111111",
    B: "1e11111e11111e",
    C: "0f10101010100f",
    D: "1e11111111111e",
    E: "1f10101e10101f",
    F: "1f10101e101010",
    G: "0f10101711110f",
    H: "1111111f111111",
    I: "1f04040404041f",
    J: "0702020212120c",
    K: "11121418141211",
    L: "1010101010101f",
    M: "111b1515111111",
    N: "11191915131311",
    O: "0e11111111110e",
    P: "1e11111e101010",
    Q: "0e11111115120d",
    R: "1e11111e141211",
    S: "0f10100e01011e",
    T: "1f040404040404",
    U: "1111111111110e",
    V: "11111111110a04",
    W: "11111115151b11",
    X: "11110a040a1111",
    Y: "11110a04040404",
    Z: "1f01020408101f",
    0: "0e11131519110e",
    1: "040c040404040e",
    2: "0e11010204081f",
    3: "1e01010e01011e",
    4: "02060a121f0202",
    5: "1f10101e01011e",
    6: "0e10101e11110e",
    7: "1f010204080808",
    8: "0e11110e11110e",
    9: "0e11110f01010e",
    "!": "04040404040004",
    "?": "0e110102040004",
    "/": "01010204081010",
    ":": "00040400040400",
    "'": "04040800000000",
    "-": "0000001f00000000",
    ".": "00000000000004",
    ",": "00000000000408",
    "(": "02040808080402",
    ")": "08040202020408",
    "#": "000a1f0a1f0a00",
    "+": "0004041f040400",
    $: "040f140e051e04",
    "%": "19190204081313",
    "&": "0c12140815120d",
    "*": "00150e1f0e1500",
    "♥": "000a1f1f0e0400",
    ";": "00040000000408",
    "=": "00001f001f0000",
    ">": "10080402040810",
    "<": "01020408040201",
  };
  const tinyRows = [
    "25757",
    "65656",
    "34443",
    "65556",
    "74647",
    "74644",
    "34553",
    "55755",
    "72227",
    "11152",
    "55655",
    "44447",
    "57755",
    "57555",
    "25552",
    "65644",
    "25573",
    "65765",
    "34216",
    "72222",
    "55557",
    "55552",
    "55775",
    "55255",
    "55222",
    "71247",
  ];
  const tiny = {};
  [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].forEach((c, i) => (tiny[c] = tinyRows[i]));
  Object.assign(tiny, {
    0: "75557",
    1: "26227",
    2: "71247",
    3: "71217",
    4: "55711",
    5: "74617",
    6: "74757",
    7: "71222",
    8: "75757",
    9: "75717",
    "!": "22202",
    "?": "61202",
    "/": "11244",
    ":": "02020",
    "'": "22000",
    "-": "00070",
    ".": "00002",
    ",": "00024",
    "(": "12421",
    ")": "42124",
    "#": "57575",
    "+": "00272",
    $: "37636",
    "%": "51245",
    "&": "25653",
    "*": "05250",
    "♥": "05720",
    ";": "02024",
    "=": "07070",
    ">": "42124",
    "<": "12421",
    "@": "25743",
    "|": "22222",
  });
  function artist(ctx) {
    const col = (c) => palette[c] || c;
    const rect = (x, y, w, h, c) => {
      ctx.fillStyle = col(c);
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
    };
    function line(x, y, X, Y, c) {
      x = Math.round(x);
      y = Math.round(y);
      X = Math.round(X);
      Y = Math.round(Y);
      let dx = Math.abs(X - x),
        sx = x < X ? 1 : -1,
        dy = -Math.abs(Y - y),
        sy = y < Y ? 1 : -1,
        err = dx + dy;
      for (;;) {
        rect(x, y, 1, 1, c);
        if (x === X && y === Y) break;
        let e = 2 * err;
        if (e >= dy) {
          err += dy;
          x += sx;
        }
        if (e <= dx) {
          err += dx;
          y += sy;
        }
      }
    }
    function poly(pts, c) {
      let ys = pts.map((p) => p[1]);
      for (let y = Math.ceil(Math.min(...ys)); y <= Math.max(...ys); y++) {
        let xs = [];
        for (let i = 0; i < pts.length; i++) {
          let a = pts[i],
            b = pts[(i + 1) % pts.length];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
            xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2)
          rect(
            Math.ceil(xs[i]),
            y,
            Math.floor(xs[i + 1]) - Math.ceil(xs[i]) + 1,
            1,
            c,
          );
      }
    }
    function write(
      str,
      x,
      y,
      c = "cream",
      scale = 1,
      align = "left",
      small = false,
    ) {
      str = String(str).toUpperCase();
      const w = small ? 3 : 5,
        h = small ? 5 : 7;
      if (align === "center")
        x -= Math.floor(((str.length * (w + 1) - 1) * scale) / 2);
      if (align === "right") x -= (str.length * (w + 1) - 1) * scale;
      for (const ch of str) {
        const rows = small ? tiny[ch] : font[ch];
        if (rows)
          for (let j = 0; j < h; j++) {
            let n = parseInt(
              rows.slice(j * (small ? 1 : 2), (j + 1) * (small ? 1 : 2)),
              16,
            );
            for (let k = 0; k < w; k++)
              if (n & (1 << (w - 1 - k)))
                rect(x + k * scale, y + j * scale, scale, scale, c);
          }
        x += (w + 1) * scale;
      }
    }
    const text = (...a) => write(...a),
      mini = (str, x, y, c, align) => write(str, x, y, c, 1, align, true);
    function box(x, y, w, h, bg, edge) {
      rect(x, y, w, h, edge);
      rect(x + 1, y + 1, w - 2, h - 2, bg);
    }
    function drawSprite(
      name,
      x,
      y,
      frame = 0,
      flip = false,
      scale = 1,
      colors,
    ) {
      const sp = sprites[name],
        rows = sp.frames[Math.abs(Math.floor(frame)) % sp.frames.length];
      for (let j = 0; j < rows.length; j++)
        for (let i = 0; i < rows[j].length; i++) {
          let n = +rows[j][i];
          if (n)
            rect(
              x + (flip ? sp.w - 1 - i : i) * scale,
              y + j * scale,
              scale,
              scale,
              (colors || sp.colors)[n - 1],
            );
        }
    }
    return { ctx, col, rect, line, poly, text, mini, box, spr: drawSprite };
  }
  const sprites = {};
  function sprite(n, w, h, colors, draw) {
    const frames = [];
    for (let t = 0; t < 4; t++) {
      const rows = Array.from({ length: h }, () => Array(w).fill(0));
      const r = (x, y, a, b, c) => {
        for (let j = y; j < y + b; j++)
          for (let i = x; i < x + a; i++)
            if (rows[j] && i >= 0 && i < w) rows[j][i] = c;
      };
      draw(r, t);
      frames.push(rows.map((a) => a.join("")));
    }
    sprites[n] = { w, h, colors, frames };
  }
  const people = {
    agent: ["ink", "coral", "peach"],
    spy: ["ink", "denim", "cream"],
    cop: ["ink", "blue", "peach"],
    walker: ["violet", "aqua", "cream"],
    janitor: ["denim", "gold", "peach"],
    clerk: ["ink", "mint", "peach"],
    bot: ["navy", "blue", "gold"],
  };
  for (const [who, colors] of Object.entries(people))
    for (const pose of [
      "walk",
      "aim",
      "duck",
      "kick",
      "zip",
      "back",
      "side",
      "front",
      "hold",
      "dead",
    ]) {
      const short = ["back", "side", "front", "hold"].includes(pose);
      sprite(who + "_" + pose, 16, short ? 16 : 24, colors, (r, t) => {
        let crouch = pose === "duck" ? 7 : 0,
          bob = pose === "walk" && t === 1 ? 1 : 0,
          oy = short ? -1 : crouch + bob;
        const d = (x, y, w, h, c) => r(x, y + oy, w, h, c);
        if (pose === "dead") {
          r(2, 18 + t, 11, 3, 2);
          r(1, 20, 5, 3, 1);
          r(11, 18, 4, 3, 3);
          return;
        }
        if (who === "bot" && short) {
          r(7, 0, 1, 3, 1);
          r(7, 0, 2, 1, 3);
          r(3, 3, 10, 6, 1);
          r(4, 3, 8, 2, 2);
          if (pose !== "back") {
            r(4, 5, 8, 2, 3);
            r(6 + (t % 3), 5, 2, 2, 1);
          }
          r(6, 9, 4, 1, 1);
          r(3, 10, 10, 4, 2);
          r(1, 10, 2, 3, 1);
          r(13, 10, 2, 3, 1);
          r(5, 11, 2, 1, 3);
          r(4, 14, 8, 2, 1);
          r(4 + (t % 2), 14, 2, 1, 2);
          r(9 + (t % 2), 14, 2, 1, 2);
          return;
        }
        d(5, 1, 6, 1, 1);
        d(3, 2, 9, 4, 1);
        d(5, 4, 7, 5, 3);
        d(3, 4, 3, 3, 1);
        d(10, 5, 3, 1, 1);
        d(11, 6, 2, 1, 3);
        d(5, 8, 5, 2, 1);
        if (who === "spy") {
          d(2, 3, 12, 2, 1);
          d(5, 2, 6, 1, 2);
          d(6, 5, 7, 2, 1);
        }
        if (who === "bot" || who === "cop") {
          d(3, 2, 9, 3, 2);
          d(5, 5, 8, 2, 1);
          d(9, 5, 3, 1, 3);
        }
        if (who === "walker") {
          d(3, 1, 8, 3, 3);
          d(2, 3, 10, 2, 2);
          d(2, 4, 3, 3, 3);
        }
        if (who === "janitor") {
          d(4, 1, 8, 3, 2);
          d(9, 3, 5, 1, 2);
          d(8, 7, 4, 1, 1);
        }
        if (pose === "front" || pose === "hold") {
          d(4, 4, 8, 4, 3);
          d(5, 5, 2, 1, 1);
          d(9, 5, 2, 1, 1);
          if (who === "spy" || who === "agent") d(4, 5, 8, 2, 1);
        }
        if (pose === "back") d(4, 3, 8, 5, 1);
        d(4, 9, 7, 2, 2);
        d(3, 11, 9, short ? 3 : 5, 2);
        d(4, 9, 2, 2, 3);
        d(6, 11, 2, 2, 1);
        d(9, 10, 1, 5, 1);
        if (!short) {
          d(3, 15, 9, 1, 1);
          d(2, 16, 11, crouch ? 1 : 3, 2);
          if (!crouch) d(1, 18, 5, 1, 2);
        }
        if (pose === "zip" || pose === "hold") {
          d(2, 5, 2, 7, 2);
          d(12, 5, 2, 7, 2);
          d(2, 3, 2, 3, 3);
          d(12, 3, 2, 3, 3);
        } else if (pose === "aim" || pose === "kick") {
          d(8, 11, 6, 2, 3);
          d(12, 10, 4, 2, 1);
          d(13, 12, 1, 2, 1);
        } else {
          d(2, 11, 3, 3, 2);
          d(2, 14, 3, 2, 3);
        }
        const y = short ? 13 : crouch ? 16 : 19,
          legs = short ? 2 : crouch ? 1 : 4;
        if (pose === "kick") {
          d(3, 18, 4, 4, 1);
          d(9, 17, 7, 3, 1);
          d(13, 16, 3, 1, 3);
        } else {
          const stride = t % 2 === 0 ? 0 : t === 1 ? 2 : -2;
          d(4 - stride, y, 3, legs, 1);
          d(9 + stride, y, 3, legs, 1);
          d(4 - stride, y + legs, 4, 1, 1);
          d(9 + stride, y + legs, 4, 1, 1);
        }
      });
    }
  // Original miniature window displays. Each drawing is also a gallery sprite.
  const goods = [
    [
      "coupon",
      ["wine", "cream", "red"],
      "22222222 23322332 02233220 23322332 22222222",
    ],
    [
      "rock",
      ["denim", "slate", "cream"],
      "00011000 00122100 01232210 12222221 11111111",
    ],
    [
      "ring",
      ["gold", "lilac", "cream"],
      "00333000 00222000 01111100 01000100 01000100 00111000",
    ],
    [
      "stock",
      ["cream", "red", "ink"],
      "11111111 13333331 12111111 11221111 11112121 11111221 11111111",
    ],
    [
      "pretzel",
      ["rust", "ochre", "cream"],
      "01200210 23211232 12022021 01211210 00122100 01100110",
    ],
    [
      "roll",
      ["rust", "ochre", "cream"],
      "00111100 01233210 12322321 13233231 12233221 01111110",
    ],
    [
      "vest",
      ["denim", "blue", "cream"],
      "01200210 01222210 12233221 12222221 12233221 01111110",
    ],
    [
      "radar",
      ["deep", "mint", "cream"],
      "00111100 01221210 12221221 12132221 12222221 01222210 00111100",
    ],
    [
      "blaster",
      ["navy", "coral", "cream"],
      "00003300 12222221 13333331 01110000 01210000 01100000",
    ],
    [
      "dress",
      ["wine", "pink", "cream"],
      "00033000 00033000 00233200 02222220 00022000 00222200 02222220 02222220 00033000 00033000 00333300",
    ],
    [
      "rack",
      ["ochre", "lilac", "cream"],
      "11111111 10101011 12232321 12232321 12232321 10000001 10000001 11000011",
    ],
    [
      "tv",
      ["denim", "ice", "white"],
      "03000300 00303000 11111111 12222221 12322321 12232221 11111111 00111100",
    ],
    [
      "radio",
      ["ink", "blue", "cream"],
      "020000 020000 111111 133331 122221 122121 122121 111111",
    ],
    [
      "chair",
      ["wine", "coral", "peach"],
      "01110000 12221000 12221000 12221000 13223301 12222221 01111110 00100100",
    ],
    [
      "orb",
      ["violet", "pink", "ice"],
      "00033000 00322300 03222230 03223230 00322300 00033000 00011000 00111100",
    ],
    [
      "games",
      ["denim", "lilac", "cream"],
      "00001110 00001210 11111111 12222221 11111111 02200000 22220000",
    ],
    [
      "rocket",
      ["navy", "coral", "cream"],
      "00033000 00333300 00323300 03222330 02222220 00200200 00300300",
    ],
    [
      "bear",
      ["rust", "ochre", "cream"],
      "01111110 01222210 02222220 02122120 02233220 00222200 22222222 02222220 02200220",
    ],
    [
      "robot",
      ["denim", "aqua", "gold"],
      "00030000 01111110 01233210 01111110 00022000 11233211 01222210 00100100 01100110",
    ],
    [
      "vhs",
      ["navy", "lilac", "cream"],
      "11111111 13322331 13222231 11111111 00222200",
    ],
    [
      "lava",
      ["plum", "pink", "gold"],
      "00011000 00022000 00223200 00232200 02223320 02232220 00222200 00011000 00111100",
    ],
    [
      "record",
      ["ink", "slate", "coral"],
      "00111100 01221110 12111111 11133111 11133121 01111210 00111100",
    ],
    [
      "boombox",
      ["denim", "ice", "cream"],
      "00333300 00300300 11111111 12322321 12233221 12322321 11111111",
    ],
    [
      "vac",
      ["navy", "aqua", "cream"],
      "00000000 00111100 01233210 12222221 01111110",
    ],
    [
      "drink",
      ["rust", "gold", "cream"],
      "00000300 00003300 33333333 02222220 02223220 00222200 00111100",
    ],
    [
      "corndog",
      ["rust", "gold", "cream"],
      "00220000 02322000 02222000 00222000 00022000 00001000 00000100",
    ],
    [
      "shoe",
      ["navy", "coral", "cream"],
      "00000000 01100000 12221000 12322100 12222221 33333333",
    ],
    [
      "ball",
      ["rust", "ochre", "ink"],
      "00111100 01231210 12232221 33333333 12232221 01231210 00111100",
    ],
    [
      "book",
      ["wine", "lilac", "cream"],
      "01111110 01222310 01222210 01222310 01333310 01111110",
    ],
    [
      "parcel",
      ["rust", "gold", "cream"],
      "00333300 12233221 12233221 12222221 12222221 11111111",
    ],
  ];
  for (const [n, colors, data] of goods) {
    const rows = data.split(" ");
    sprite(n, 12, 12, colors, (r, t) =>
      rows.forEach((row, j) =>
        [...row].forEach((c, i) => {
          if (+c)
            r(
              2 + i,
              12 - rows.length + j,
              1,
              1,
              n === "tv" && c === "3" && t % 2 ? 2 : +c,
            );
        }),
      ),
    );
  }
  const displays = [
    ["dress", "rack"],
    ["tv", "radio"],
    ["chair", "orb"],
    ["games", "rocket"],
    ["bear", "robot"],
    ["vhs", "vhs"],
    ["lava", "orb"],
    ["record", "boombox"],
    ["vac", "orb"],
    ["drink", "corndog"],
    ["tv", "tv"],
    ["shoe", "ball"],
    ["book", "book"],
  ];
  return {
    artist,
    palette,
    sprites,
    displays,
    font,
    powerIcons: [
      "blaster",
      "blaster",
      "vest",
      "shoe",
      "radar",
      "bear",
      "roll",
      "drink",
      "pretzel",
    ],
    jokeIcons: ["coupon", "book", "rock", "ring", "stock"],
  };
})();
