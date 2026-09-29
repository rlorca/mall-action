import { ui } from "./copy";
export type Theme =
  | "fashion"
  | "electronics"
  | "toys"
  | "food"
  | "sports"
  | "music"
  | "gadgets"
  | "novelty"
  | "games";
export type Power =
  | typeof ui.RAPID_FIRE
  | typeof ui.SPREAD_SHOT
  | typeof ui.ARMOR_VEST
  | typeof ui.SNEAKERS
  | typeof ui.RADAR
  | "1-UP"
  | typeof ui.CINNABOMB
  | typeof ui.ORANGE_JULI_OOZE
  | typeof ui.SOFT_PRETZEL;
export const powers: Power[] = [
  ui.RAPID_FIRE,
  ui.SPREAD_SHOT,
  ui.ARMOR_VEST,
  ui.SNEAKERS,
  ui.RADAR,
  "1-UP",
  ui.CINNABOMB,
  ui.ORANGE_JULI_OOZE,
  ui.SOFT_PRETZEL,
];
export interface StoreDef {
  id: number;
  name: string;
  floor: number;
  x: number;
  role: "target" | "shop" | "closed";
  theme: Theme;
  layout: number;
}
export const stores: StoreDef[] = [
  {
    id: 0,
    name: ui.FOREVER_12,
    floor: 1,
    x: 42,
    role: "target",
    theme: "fashion",
    layout: 0,
  },
  {
    id: 1,
    name: ui.RADIOSHOCK,
    floor: 1,
    x: 254,
    role: "target",
    theme: "electronics",
    layout: 1,
  },
  {
    id: 2,
    name: ui.CROOKSTONE,
    floor: 1,
    x: 430,
    role: "shop",
    theme: "gadgets",
    layout: 2,
  },
  {
    id: 3,
    name: ui.GAMESTONK,
    floor: 1,
    x: 646,
    role: "shop",
    theme: "games",
    layout: 3,
  },
  {
    id: 4,
    name: ui.KGB_TOYS,
    floor: 2,
    x: 44,
    role: "target",
    theme: "toys",
    layout: 4,
  },
  {
    id: 5,
    name: ui.BLOCKBLUSTER_VIDEO,
    floor: 2,
    x: 270,
    role: "closed",
    theme: "electronics",
    layout: 5,
  },
  {
    id: 6,
    name: ui.SPENDERS_GIFTS,
    floor: 2,
    x: 620,
    role: "shop",
    theme: "novelty",
    layout: 6,
  },
  {
    id: 7,
    name: ui.SAM_BADDY,
    floor: 3,
    x: 42,
    role: "target",
    theme: "music",
    layout: 7,
  },
  {
    id: 8,
    name: ui.SHARPER_IMAGINE,
    floor: 3,
    x: 254,
    role: "shop",
    theme: "gadgets",
    layout: 8,
  },
  {
    id: 9,
    name: ui.HOT_SPY_ON_A_STICK,
    floor: 3,
    x: 430,
    role: "target",
    theme: "food",
    layout: 9,
  },
  {
    id: 10,
    name: ui.CIRCUIT_PITY,
    floor: 3,
    x: 644,
    role: "closed",
    theme: "electronics",
    layout: 10,
  },
  {
    id: 11,
    name: ui.FOOT_LOCKPICKER,
    floor: 4,
    x: 46,
    role: "target",
    theme: "sports",
    layout: 11,
  },
  {
    id: 12,
    name: ui.BORDERLINE_BOOKS,
    floor: 4,
    x: 620,
    role: "closed",
    theme: "music",
    layout: 12,
  },
];
export const floorY = (floor: number) => 48 + floor * 48;
export const shaftDefs = [
  { id: "A", x: 174, min: 0, max: 3, auto: false },
  { id: "B", x: 558, min: 1, max: 5, auto: false },
  { id: "C", x: 374, min: 0, max: 4, auto: true },
];
export const escalators = [
  { x: 700, top: 1, bottom: 2 },
  { x: 240, top: 3, bottom: 4 },
];
export interface Fixture {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: string;
  content: "package" | "power" | "trap" | "nothing";
  power?: Power;
  open: boolean;
  surprise: boolean;
  toys: boolean;
}
export interface Room {
  w: number;
  h: number;
  fixtures: Fixture[];
  visited: boolean;
  cleared: boolean;
}
const layouts = [
  [
    [2, 2],
    [6, 2],
    [11, 2],
    [2, 6],
    [7, 6],
    [12, 6],
  ],
  [
    [2, 2],
    [7, 2],
    [12, 2],
    [3, 6],
    [9, 6],
  ],
  [
    [3, 2],
    [9, 2],
    [2, 6],
    [7, 6],
    [12, 6],
  ],
  [
    [2, 2],
    [7, 2],
    [12, 2],
    [4, 6],
    [10, 6],
  ],
  [
    [2, 2],
    [6, 2],
    [11, 2],
    [3, 6],
    [9, 6],
  ],
  [],
  [
    [2, 2],
    [8, 2],
    [12, 5],
    [2, 6],
    [7, 6],
  ],
  [
    [3, 2],
    [10, 2],
    [2, 6],
    [7, 6],
    [12, 6],
  ],
  [
    [2, 2],
    [8, 2],
    [12, 3],
    [3, 6],
    [10, 6],
  ],
  [
    [2, 2],
    [7, 2],
    [12, 2],
    [3, 6],
    [10, 6],
  ],
  [],
  [
    [2, 2],
    [7, 2],
    [12, 2],
    [3, 6],
    [9, 6],
  ],
  [],
];
export function roomTemplate(s: StoreDef): Room {
  return {
    w: 256,
    h: 176,
    visited: false,
    cleared: false,
    fixtures: layouts[s.layout].map(([x, y], id) => ({
      id,
      x: x * 16,
      y: y * 16,
      w: 24,
      h: 24,
      kind:
        s.theme === "fashion" && id >= 3
          ? "fitting"
          : s.theme === "toys"
            ? "shelf"
            : s.theme,
      content: "nothing",
      open: false,
      surprise: false,
      toys: false,
    })),
  };
}
export function difficulty(loop: number, black = false) {
  return {
    speed: Math.min(1.8, 1 + (loop - 1) * 0.1),
    spawn: Math.max(
      70,
      Math.round((300 * Math.pow(0.85, loop - 1)) / (black ? 2 : 1)),
    ),
    shot: Math.max(60, Math.round(150 * Math.pow(0.85, loop - 1))),
    alarm: Math.max(45 * 60, (150 - (loop - 1) * 20) * 60),
    cap: black ? 8 : 4,
  };
}
