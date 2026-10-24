export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const HUD_H = 16;
export const FPS = 60;
export const STEP_MS = 1000 / FPS;
export const MAX_CATCHUP = 5;
export const LEVEL_W = 768;
export const FLOOR_GAP = 48;
export const FLOORS = ["R", "4F", "3F", "2F", "1F", "P"];
export const FLOOR_Y = Object.fromEntries(FLOORS.map((name, i) => [name, 56 + i * FLOOR_GAP]));
export const STORE_W = 80;
export const GRAVITY = 0.42;
export const JUMP_VELOCITY = -4.1;
export const MAX_FALL = 6.5;
export const BUTTONS = ["up", "down", "left", "right", "a", "b", "select", "start"];

// A carefully limited, NES-inspired master palette. All art uses these colours.
export const PALETTE = Object.freeze({
  ink: "#10101c", black: "#000000", white: "#f8f8f8", cream: "#f8d8a0",
  grey: "#787878", silver: "#b8b8b8", charcoal: "#303044", smoke: "#505068",
  navy: "#182848", blue: "#2848b8", sky: "#58a8f8", cyan: "#48d8e8",
  teal: "#087878", green: "#28a858", lime: "#a0d848", olive: "#687828",
  red: "#d83048", coral: "#f06860", pink: "#f080b8", magenta: "#b83088",
  purple: "#6838a8", lavender: "#a888d8", orange: "#f08828", yellow: "#f8d838",
  brown: "#704028", wood: "#a86038", tan: "#d8a060", darkRed: "#781c30",
});

export const EVENT = Object.freeze({
  SOUND: "sound", SCORE: "score", MESSAGE: "message", DING: "ding",
  SHAKE: "shake", DEATH: "death", PACKAGE: "package", TRANSITION: "transition",
});

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const approach = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
export const floorIndex = (floor) => FLOORS.indexOf(floor);
export const floorAtY = (y) => FLOORS[clamp(Math.round((y - 56) / FLOOR_GAP), 0, FLOORS.length - 1)];
export const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
