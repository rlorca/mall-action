import { Bitmap, defSprite } from './pixel';
import { C } from './palette';

// ---------------------------------------------------------------- elevator car (28 x 40)
defSprite('car.back', 28, 40, [C.brown, C.dbrown, C.gold], (b) => {
  b.rect(0, 0, 28, 40, 1);
  for (let x = 6; x < 28; x += 7) b.vline(x, 3, 35, 2);
  b.hline(0, 22, 28, 3); // brass rail
  b.hline(0, 23, 28, 2);
  b.rect(0, 37, 28, 3, 2); // floor
});
// door animation frames: 0 = fully open ... 3 = fully closed
defSprite(
  'car.front',
  28,
  40,
  [C.lgrey, C.grey, C.white],
  (b, f) => {
    b.rect(0, 0, 28, 5, 2); // header
    b.hline(0, 0, 28, 1);
    b.rect(11, 1, 6, 3, 1);
    b.px(13, 2, 3);
    b.px(14, 2, 3);
    b.rect(0, 5, 3, 35, 1); // jambs
    b.rect(25, 5, 3, 35, 1);
    b.vline(0, 5, 35, 3);
    b.vline(27, 5, 35, 2);
    b.rect(0, 37, 28, 3, 2);
    const half = [3, 6, 9, 11][f];
    // doors slide in from both sides
    b.rect(3, 5, half, 32, 1);
    b.rect(25 - half, 5, half, 32, 1);
    b.vline(3 + half - 1, 5, 32, 2);
    b.vline(25 - half, 5, 32, 2);
    if (half >= 11) {
      b.rect(10, 12, 2, 8, 3);
      b.rect(16, 12, 2, 8, 3);
    }
  },
  4,
);
// car roof (28 x 4): what a pit-faller lands on
defSprite('car.roof', 28, 4, [C.lgrey, C.grey, C.white], (b) => {
  b.rect(0, 0, 28, 4, 1);
  b.hline(0, 0, 28, 3);
  b.hline(0, 3, 28, 2);
  b.rect(12, 1, 4, 2, 2);
});

// ---------------------------------------------------------------- kiosk, booth, fountain, benches, plants
defSprite(
  'kiosk',
  24,
  30,
  [C.navy, C.lgrey, C.pcyan],
  (b, f) => {
    b.rect(2, 6, 20, 22, 1);
    b.box(2, 6, 20, 22, 2);
    b.rect(5, 9, 14, 11, 2);
    b.rect(6, 10, 12, 9, f ? 3 : 1);
    // little map on the screen
    b.hline(7, 13, 10, f ? 1 : 3);
    b.vline(12, 11, 7, f ? 1 : 3);
    b.rect(8, 21, 8, 2, 2);
    b.rect(0, 28, 24, 2, 2);
    b.rect(8, 0, 8, 6, 1); // sign "i"
    b.box(8, 0, 8, 6, 2);
    b.px(11, 1, 3);
    b.px(12, 1, 3);
    b.vline(11, 3, 2, 3);
    b.vline(12, 3, 2, 3);
  },
  2,
);
defSprite('booth', 20, 30, [C.purple, C.dpurple, C.ppink], (b) => {
  b.rect(0, 4, 20, 26, 2);
  b.rect(1, 5, 18, 25, 1);
  b.rect(0, 0, 20, 5, 2);
  b.rect(2, 1, 16, 3, 3);
  b.rect(4, 2, 12, 1, 2);
  // curtain
  b.rect(3, 10, 14, 20, 2);
  for (let x = 4; x < 17; x += 3) b.vline(x, 10, 20, 1);
  b.rect(3, 8, 14, 2, 3);
  b.rect(9, 6, 2, 2, 3);
});
defSprite(
  'fountain',
  32,
  22,
  [C.blue, C.lgrey, C.pcyan],
  (b, f) => {
    b.rect(0, 14, 32, 8, 2);
    b.rect(1, 15, 30, 5, 1);
    b.hline(1, 15, 30, 3);
    b.rect(14, 6, 4, 10, 2);
    b.rect(10, 4, 12, 3, 2);
    // jets: 3 animation frames
    for (let i = 0; i < 3; i++) {
      const h = 4 + ((f + i) % 3) * 2;
      b.vline(12 + i * 4, 4 - h + 4, h, 3);
    }
    b.px(8 + f * 2, 3, 3);
    b.px(22 - f * 2, 3, 3);
    b.px(7, 8, 3);
    b.px(25, 8, 3);
  },
  3,
);
defSprite('bench', 24, 10, [C.brown, C.dbrown, C.tan], (b) => {
  b.rect(0, 2, 24, 3, 1);
  b.hline(0, 2, 24, 3);
  b.rect(0, 5, 24, 1, 2);
  b.rect(2, 6, 2, 4, 2);
  b.rect(20, 6, 2, 4, 2);
  b.rect(0, 0, 24, 2, 1);
  b.hline(0, 0, 24, 2);
});
defSprite('plant', 12, 20, [C.green, C.dgreen, C.brown], (b) => {
  b.rect(2, 13, 8, 7, 3);
  b.hline(1, 13, 10, 3);
  b.hline(3, 19, 6, 2);
  b.oval(6, 7, 5, 6, 1);
  b.oval(4, 5, 2, 3, 2);
  b.oval(8, 9, 2, 3, 2);
  b.px(6, 4, 2);
  b.vline(6, 12, 2, 2);
});
defSprite('pillar', 16, 48, [C.lgrey, C.grey, C.white], (b) => {
  b.rect(0, 0, 16, 48, 1);
  b.vline(0, 0, 48, 3);
  b.vline(1, 0, 48, 3);
  b.vline(14, 0, 48, 2);
  b.vline(15, 0, 48, 2);
  b.rect(0, 0, 16, 2, 2);
  b.rect(0, 36, 16, 6, 2);
  for (let x = 0; x < 16; x += 4) b.rect(x, 38, 2, 2, 3); // hazard stripes
});

// ---------------------------------------------------------------- lamps, disco balls
defSprite('lamp', 10, 32, [C.yellow, C.dgrey, C.white], (b) => {
  b.vline(5, 0, 18, 2); // cord
  b.rect(1, 18, 8, 2, 1);
  b.rect(0, 20, 10, 4, 1);
  b.hline(0, 23, 10, 2);
  b.rect(3, 24, 4, 2, 3); // bulb
  b.px(1, 19, 3);
});
defSprite(
  'disco',
  12,
  32,
  [C.lgrey, C.grey, C.white],
  (b, f) => {
    b.vline(6, 0, 16, 2);
    b.oval(6, 22, 6, 6, 1);
    for (let y = 17; y < 28; y += 3) b.hline(1, y, 10, 2);
    for (let x = 1; x < 12; x += 3) b.vline(x, 17, 11, 2);
    b.px(3 + f * 4, 19, 3);
    b.px(8 - f * 3, 24, 3);
    b.px(5, 21 + f, 3);
  },
  2,
);
defSprite('lamp.broken', 12, 8, [C.yellow, C.dgrey, C.white], (b) => {
  b.rect(1, 4, 10, 3, 1);
  b.px(0, 6, 1);
  b.px(11, 6, 1);
  b.px(3, 2, 3);
  b.px(8, 1, 3);
  b.px(6, 3, 2);
  b.px(2, 7, 3);
  b.px(9, 7, 3);
});
defSprite(
  'ball',
  12,
  12,
  [C.lgrey, C.grey, C.white],
  (b, f) => {
    b.oval(6, 6, 5, 5, 1);
    b.hline(1, 6, 10, 2);
    b.vline(6, 1, 10, 2);
    b.px(3 + f * 3, 3, 3);
    b.px(8 - f * 2, 8, 3);
  },
  2,
);

// ---------------------------------------------------------------- wet floor sign, bubbles, misc mall bits
defSprite('sign.wet', 10, 14, [C.yellow, C.black, C.orange], (b) => {
  b.rows(0, 0, [
    '...1111...',
    '..111111..',
    '.11122111.',
    '.11122111.',
    '.11122111.',
    '1111221111',
    '1111111111',
    '1111221111',
    '.11111111.',
    '.11111111.',
    '..111111..',
    '..1.11.1..',
    '.2..11..2.',
    '2...11...2',
  ]);
});
defSprite('mop.bucket', 10, 8, [C.blue, C.dgrey, C.pcyan], (b) => {
  b.rect(1, 2, 8, 6, 1);
  b.hline(0, 2, 10, 3);
  b.rect(2, 7, 6, 1, 2);
  b.px(4, 4, 3);
  b.px(6, 5, 3);
});

// getaway station wagon with wood panelling (56 x 26)
defSprite(
  'wagon',
  56,
  26,
  [C.brown, C.black, C.tan],
  (b, f) => {
    // body
    b.rect(2, 8, 52, 12, 1);
    b.rect(10, 2, 36, 7, 1); // roof
    b.hline(10, 2, 36, 3);
    // windows
    b.rect(12, 3, 8, 5, 2);
    b.rect(22, 3, 10, 5, 2);
    b.rect(34, 3, 10, 5, 2);
    b.px(13, 4, 3);
    b.px(23, 4, 3);
    // wood panelling stripes
    for (let y = 11; y <= 17; y += 2) b.hline(4, y, 48, 3);
    b.hline(2, 8, 52, 2);
    b.hline(2, 19, 52, 2);
    // bumpers + lights
    b.rect(0, 15, 3, 4, 3);
    b.rect(53, 15, 3, 4, 3);
    b.rect(53, 10, 2, 3, f ? 3 : 2);
    // wheels
    for (const x of [10, 40]) {
      b.oval(x + 4, 21, 5, 5, 2);
      b.oval(x + 4, 21, 2, 2, 3);
    }
  },
  2,
);

// ---------------------------------------------------------------- pickups & icons
const POWER_PAL = {
  rapid: [C.red, C.yellow, C.white],
  spread: [C.green, C.yellow, C.white],
  armor: [C.blue, C.pcyan, C.white],
  sneakers: [C.white, C.red, C.lblue],
  radar: [C.dgreen, C.lgreen, C.black],
  oneup: [C.red, C.white, C.black],
  cinnabomb: [C.brown, C.white, C.tan],
  juice: [C.orange, C.lgreen, C.white],
  pretzel: [C.brown, C.white, C.tan],
} as const;

function iconBase(b: Bitmap): void {
  b.rect(1, 1, 14, 14, 1);
  b.box(0, 0, 16, 16, 2);
  b.px(0, 0, 0);
  b.px(15, 0, 0);
  b.px(0, 15, 0);
  b.px(15, 15, 0);
}
defSprite('pu.rapid', 16, 16, POWER_PAL.rapid, (b) => {
  iconBase(b);
  // triple bullets
  for (const y of [4, 7, 10]) {
    b.rect(3, y, 8, 2, 3);
    b.rect(11, y, 2, 2, 2);
  }
});
defSprite('pu.spread', 16, 16, POWER_PAL.spread, (b) => {
  iconBase(b);
  b.line(4, 8, 12, 3, 3);
  b.line(4, 8, 12, 8, 3);
  b.line(4, 8, 12, 13, 3);
  b.rect(2, 7, 3, 3, 2);
});
defSprite('pu.armor', 16, 16, POWER_PAL.armor, (b) => {
  iconBase(b);
  b.rows(3, 2, ['..111111..', '.11222211.', '.12222221.', '.12222221.', '.12222221.', '..122221..', '..122221..', '...1221...', '....22....']);
  b.rows(3, 2, ['..333333..'].slice(0, 0));
  b.rect(7, 4, 2, 6, 3);
  b.rect(5, 6, 6, 2, 3);
});
defSprite('pu.sneakers', 16, 16, POWER_PAL.sneakers, (b) => {
  iconBase(b);
  b.rows(2, 4, ['..1111....', '..1221....', '..1221....', '..1221111.', '.11222211.', '1112222221', '1111111111', '3333333333']);
});
defSprite('pu.radar', 16, 16, POWER_PAL.radar, (b) => {
  iconBase(b);
  b.oval(8, 8, 5, 5, 3);
  b.oval(8, 8, 4, 4, 1);
  b.oval(8, 8, 2, 2, 3);
  b.oval(8, 8, 1, 1, 1);
  b.line(8, 8, 12, 4, 2);
  b.px(11, 5, 2);
});
defSprite('pu.oneup', 16, 16, POWER_PAL.oneup, (b) => {
  iconBase(b);
  b.rows(3, 3, ['..1111..', '.111111.', '.133331.', '.1.33.1.', '..3333..', '..3..3..', '.22..22.']);
  b.rect(4, 11, 8, 2, 2);
  b.px(6, 11, 3);
  b.px(9, 11, 3);
});
defSprite('pu.cinnabomb', 16, 16, POWER_PAL.cinnabomb, (b) => {
  iconBase(b);
  b.oval(8, 9, 5, 4, 3);
  b.oval(8, 9, 4, 3, 1);
  b.hline(5, 7, 6, 2);
  b.hline(6, 9, 5, 2);
  b.vline(8, 3, 3, 3);
  b.px(9, 2, 3);
  b.px(7, 2, 3);
});
defSprite('pu.juice', 16, 16, POWER_PAL.juice, (b) => {
  iconBase(b);
  b.oval(8, 9, 4, 4, 1);
  b.rect(4, 8, 8, 2, 1);
  b.px(6, 7, 3);
  b.px(7, 7, 3);
  b.rect(8, 2, 2, 3, 2);
  b.rect(9, 1, 3, 1, 2);
  b.rect(6, 12, 4, 1, 3);
});
defSprite('pu.pretzel', 16, 16, POWER_PAL.pretzel, (b) => {
  iconBase(b);
  b.oval(5, 7, 3, 3, 3);
  b.oval(11, 7, 3, 3, 3);
  b.oval(5, 7, 1, 1, 1);
  b.oval(11, 7, 1, 1, 1);
  b.rect(4, 10, 8, 3, 3);
  b.line(5, 9, 11, 12, 1);
  b.line(11, 9, 5, 12, 1);
  b.px(4, 5, 2);
  b.px(8, 8, 2);
  b.px(12, 5, 2);
  b.px(7, 12, 2);
});
defSprite('package', 16, 16, [C.tan, C.brown, C.red], (b) => {
  b.rect(1, 3, 14, 12, 1);
  b.box(1, 3, 14, 12, 2);
  b.rect(7, 3, 2, 12, 3);
  b.rect(1, 8, 14, 2, 3);
  b.rect(4, 1, 4, 2, 3);
  b.rect(8, 1, 4, 2, 3);
});
defSprite(
  'coin',
  8,
  8,
  [C.yellow, C.orange, C.white],
  (b, f) => {
    const w = [3, 2, 1, 2][f];
    b.oval(4, 4, w, 3, 1);
    b.vline(4, 1, 6, 2);
    if (w >= 2) b.px(3, 2, 3);
  },
  4,
);
defSprite(
  'coin.gold',
  8,
  8,
  [C.yellow, C.red, C.white],
  (b, f) => {
    const w = [3, 2, 1, 2][f];
    b.oval(4, 4, w, 3, 1);
    b.vline(4, 1, 6, 2);
    b.px(3, 2, 3);
    b.px(f % 2 ? 6 : 1, 1, 3);
  },
  4,
);
defSprite('bullet.p', 4, 2, [C.yellow, C.white, C.orange], (b) => {
  b.rect(0, 0, 4, 2, 1);
  b.px(3, 0, 2);
  b.px(3, 1, 2);
});
defSprite('bullet.e', 4, 2, [C.lred, C.white, C.red], (b) => {
  b.rect(0, 0, 4, 2, 1);
  b.px(0, 0, 2);
  b.px(0, 1, 2);
});
defSprite('hud.head', 8, 8, [C.red, C.black, C.skin], (b) => {
  b.rows(0, 0, ['.222222.', '.222222.', '.233332.', '.233332.', '..3333..', '.111111.', '.111111.', '.11..11.']);
});
defSprite('hud.armor', 8, 8, [C.pcyan, C.blue, C.white], (b) => {
  b.rows(0, 0, ['.111111.', '12222221', '12222221', '12222221', '.122221.', '.122221.', '..1221..', '...11...']);
});
defSprite('hud.radar', 8, 8, [C.lgreen, C.dgreen, C.black], (b) => {
  b.oval(4, 4, 3, 3, 1);
  b.oval(4, 4, 2, 2, 2);
  b.px(4, 4, 1);
  b.line(4, 4, 6, 2, 1);
});
defSprite(
  'smoke',
  16,
  16,
  [C.white, C.lgrey, C.grey],
  (b, f) => {
    const r = 3 + f * 2;
    b.oval(8, 8, r, r, 2);
    b.oval(6 - f, 9, r - 1, r - 2, 1);
    b.oval(10 + f, 7, r - 2, r - 1, 1);
    if (f === 2) {
      b.px(2, 3, 3);
      b.px(13, 12, 3);
      b.px(12, 2, 3);
    }
  },
  3,
);
defSprite('pad.exclaim', 8, 12, [C.yellow, C.black, C.white], (b) => {
  b.rect(3, 1, 3, 6, 1);
  b.rect(3, 9, 3, 2, 1);
  b.box(2, 0, 5, 8, 2);
});
