import { FLOORS, FLOOR_Y, LEVEL_W } from "./constants.js";

export const STORES = Object.freeze([
  { id: "forever", name: "FOREVER 12", floor: "4F", x: 32, role: "target", theme: "fashion", display: "fashion" },
  { id: "radio", name: "RADIOSHOCK", floor: "4F", x: 160, role: "target", theme: "electronics", display: "tv" },
  { id: "crook", name: "CROOKSTONE", floor: "4F", x: 336, role: "power", theme: "gadgets", display: "chair" },
  { id: "game", name: "GAMESTONK", floor: "4F", x: 544, role: "power", theme: "games", display: "console" },
  { id: "kgb", name: "KGB TOYS", floor: "3F", x: 48, role: "target", theme: "toys", display: "toys" },
  { id: "block", name: "BLOCKBLUSTER VIDEO", floor: "3F", x: 240, role: "closed", theme: "video", display: "vhs" },
  { id: "spender", name: "SPENDER'S GIFTS", floor: "3F", x: 464, role: "power", theme: "novelty", display: "lava" },
  { id: "sam", name: "SAM BADDY", floor: "2F", x: 32, role: "target", theme: "music", display: "music" },
  { id: "sharper", name: "SHARPER IMAGINE", floor: "2F", x: 192, role: "power", theme: "gadgets", display: "orb" },
  { id: "hotspy", name: "HOT SPY ON A STICK", floor: "2F", x: 352, role: "target", theme: "food", display: "food" },
  { id: "circuit", name: "CIRCUIT PITY", floor: "2F", x: 544, role: "closed", theme: "electronics", display: "deadtv" },
  { id: "foot", name: "FOOT LOCKPICKER", floor: "1F", x: 144, role: "target", theme: "sports", display: "shoes" },
  { id: "border", name: "BORDERLINE BOOKS", floor: "1F", x: 448, role: "closed", theme: "books", display: "books" },
].map((store) => Object.freeze(store)));

export const SHAFTS = Object.freeze([
  { id: "A", x: 696, floors: ["R", "4F", "3F", "2F"], manual: true },
  { id: "B", x: 88, floors: ["4F", "3F", "2F", "1F", "P"], manual: true },
  { id: "C", x: 624, floors: ["R", "4F", "3F", "2F", "1F"], manual: false },
]);
export const ESCALATORS = Object.freeze([
  { id: "E1", x: 448, top: "4F", bottom: "3F" },
  { id: "E2", x: 304, top: "2F", bottom: "1F" },
]);

const BASE_ROWS = [
  "################",
  "#..............#",
  "#..FF......FF..#",
  "#..............#",
  "#.....FFFF.....#",
  "#..............#",
  "#..FF......FF..#",
  "#..............#",
  "#......FF......#",
  "#..............#",
  "#######DD#######",
];

function variantRows(variant) {
  const rows = [...BASE_ROWS];
  if (variant % 4 === 1) {
    rows[3] = "#..FF......FF..#";
    rows[6] = "#....FFFFFF....#";
  } else if (variant % 4 === 2) {
    rows[2] = "#....F....F....#";
    rows[4] = "#.FF........FF.#";
    rows[8] = "#...F......F...#";
  } else if (variant % 4 === 3) {
    rows[2] = "#.FF........FF.#";
    rows[4] = "#......FF......#";
    rows[6] = "#....F....F....#";
  }
  // Small per-store architecture changes make each of the ten rooms distinct.
  if (variant === 4) rows[3] = "#....FFFF......#";
  if (variant === 5) rows[7] = "#..F........F..#";
  if (variant === 6) rows[3] = "#......FF......#";
  if (variant === 7) rows[7] = "#..FF....FF....#";
  if (variant === 8) rows[4] = "#..FFFFFFFFFF..#";
  if (variant === 9) rows[5] = "#....F....F....#";
  return Object.freeze(rows);
}

export const ROOM_TEMPLATES = Object.freeze(Object.fromEntries(
  STORES.filter((s) => s.role !== "closed").map((store, index) => [store.id, Object.freeze({
    width: 16, height: 11, tile: 16, theme: store.theme,
    rows: variantRows(index), guards: 1 + (index % 3), bots: store.id === "radio" || store.id === "sharper" ? 1 : 0,
  })]),
));

export function validateRoomTemplate(template) {
  if (!template || template.width !== 16 || template.height !== 11 || template.rows.length !== 11) return false;
  if (template.rows.some((row) => row.length !== 16)) return false;
  if (!template.rows[10].includes("DD")) return false;
  for (let x = 0; x < 16; x++) {
    if (template.rows[0][x] !== "#") return false;
    if (x < 7 || x > 8) if (template.rows[10][x] !== "#") return false;
  }
  return template.rows.every((row) => row[0] === "#" && row[15] === "#");
}

export function roomFixtures(storeId) {
  const template = ROOM_TEMPLATES[storeId];
  if (!template) return [];
  const fixtures = [];
  template.rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "F") fixtures.push({ id: `${storeId}:${x}:${y}`, tx: x, ty: y, x: x * 16, y: y * 16, w: 16, h: 16 });
    });
  });
  return fixtures;
}

const POWERUPS = ["rapid", "spread", "armor", "sneakers", "radar", "cinnabomb", "orange", "pretzel"];
const pickStorePowerup = (store, rng) => store.id === "hotspy" && rng.chance(0.7) ? rng.pick(["cinnabomb", "orange", "pretzel"]) : rng.pick(POWERUPS);

export function createStoreStates(rng, blackFriday = false) {
  return Object.fromEntries(STORES.filter((s) => s.role !== "closed").map((store) => {
    const fixtures = roomFixtures(store.id).map((fixture) => ({
      ...fixture, opened: false, isFitting: store.id === "forever" && fixture.ty === 2, content: null,
    }));
    // Assign content in a second pass so exactly one package is guaranteed.
    if (store.role === "target") {
      const packageIndex = rng.int(0, fixtures.length - 1);
      fixtures.forEach((fixture, index) => {
        fixture.content = index === packageIndex ? "package" : blackFriday ? pickStorePowerup(store, rng) : rng.chance(0.28) ? "trap" : rng.chance(0.35) ? pickStorePowerup(store, rng) : "nothing";
      });
    } else {
      fixtures.forEach((fixture) => { fixture.content = blackFriday || rng.chance(0.7) ? pickStorePowerup(store, rng) : "nothing"; });
    }
    return [store.id, {
      storeId: store.id, fixtures, visits: 0, cleared: false, guards: [], firstVisit: true,
      fittingRoom: store.id === "forever", toysReleased: false, boothPlaying: false,
      easterEggDone: false, packageFixture: fixtures.find((f) => f.content === "package")?.id || null,
    }];
  }));
}

export function createElevators(rng) {
  return SHAFTS.map((shaft, index) => ({
    ...shaft, y: FLOOR_Y[shaft.floors[0]], targetY: FLOOR_Y[shaft.floors[0]],
    direction: 0, moving: false, occupied: false, wait: 120 + index * 30,
    called: false, lastFloor: shaft.floors[0], dingFloor: null,
  }));
}

export function reachableFloors() {
  const reached = new Set(["R"]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const shaft of SHAFTS) {
      if (shaft.floors.some((floor) => reached.has(floor))) {
        for (const floor of shaft.floors) if (!reached.has(floor)) { reached.add(floor); changed = true; }
      }
    }
    for (const escalator of ESCALATORS) {
      if (reached.has(escalator.top) && !reached.has(escalator.bottom)) { reached.add(escalator.bottom); changed = true; }
      if (reached.has(escalator.bottom) && !reached.has(escalator.top)) { reached.add(escalator.top); changed = true; }
    }
  }
  return [...reached];
}

export function storeAtDoor(floor, x) {
  return STORES.find((store) => store.floor === floor && Math.abs((store.x + 40) - x) < 18);
}

export function shaftAt(floor, x) {
  return SHAFTS.find((shaft) => shaft.floors.includes(floor) && Math.abs(shaft.x + 12 - x) < 22);
}

export function escalatorAt(floor, x, direction) {
  return ESCALATORS.find((e) => Math.abs(e.x - x) < 24 && ((direction < 0 && e.bottom === floor) || (direction > 0 && e.top === floor)));
}

export function nearestPackageStore(stores, floor, x) {
  const remaining = STORES.filter((s) => s.role === "target" && !stores[s.id].cleared);
  return remaining.sort((a, b) => {
    const floorCostA = Math.abs(FLOORS.indexOf(a.floor) - FLOORS.indexOf(floor)) * LEVEL_W;
    const floorCostB = Math.abs(FLOORS.indexOf(b.floor) - FLOORS.indexOf(floor)) * LEVEL_W;
    return floorCostA + Math.abs(a.x - x) - floorCostB - Math.abs(b.x - x);
  })[0] || null;
}
