export const ROOM_COLS = 16, ROOM_ROWS = 11, TILE = 16;

export const TEMPLATES = {
  fashion: [
    '################',
    '#R.R.R....F..F.#',
    '#..............#',
    '#.F..F.....G...#',
    '#..............#',
    '#....cccc......#',
    '#.F..........F.#',
    '#.....G........#',
    '#.F...........F#',
    '#..............#',
    '#######DD#######',
  ],
  electronics: [
    '################',
    '#VVV..F..F..VVV#',
    '#..............#',
    '#.cc.......cc..#',
    '#.F..........F.#',
    '#......G.......#',
    '#.F...cc.....F.#',
    '#..........B...#',
    '#..F........F..#',
    '#..............#',
    '#######DD#######',
  ],
  toys: [
    '################',
    '#T.T.T....T.T.T#',
    '#..............#',
    '#..............#',
    '#.F..cc..cc..F.#',
    '#.....G....G...#',
    '#..............#',
    '#.T..........T.#',
    '#......B.......#',
    '#..............#',
    '#######DD#######',
  ],
  food: [
    '################',
    '#cccccccccccccc#',
    '#F.F.F....F.F.F#',
    '#..............#',
    '#..............#',
    '#.cc...G....cc.#',
    '#.F..........F.#',
    '#..............#',
    '#..cc......cc..#',
    '#..............#',
    '#######DD#######',
  ],
  sports: [
    '################',
    '#FFFF......FFFF#',
    '#..............#',
    '#..G........G..#',
    '#..............#',
    '#....F.cc.F....#',
    '#..............#',
    '#.B............#',
    '#..F........F..#',
    '#..............#',
    '#######DD#######',
  ],
  music: [
    '################',
    '#F.F.F.F.....L.#',
    '#..............#',
    '#.cc.cc...G....#',
    '#..............#',
    '#.F........F...#',
    '#..............#',
    '#....cc..cc....#',
    '#..F........F..#',
    '#..............#',
    '#######DD#######',
  ],
  gadgetsA: [
    '################',
    '#..F...cc...F..#',
    '#..............#',
    '#.F....G.....F.#',
    '#..............#',
    '#....F....F....#',
    '#..............#',
    '#..cc......cc..#',
    '#..............#',
    '#..............#',
    '#######DD#######',
  ],
  gadgetsB: [
    '################',
    '#F............F#',
    '#..cc......cc..#',
    '#..............#',
    '#......F.......#',
    '#..F.......F...#',
    '#.....B........#',
    '#..............#',
    '#.F..........F.#',
    '#..............#',
    '#######DD#######',
  ],
  novelty: [
    '################',
    '#F..F..cc..F..F#',
    '#..............#',
    '#..............#',
    '#.F....G.....F.#',
    '#..............#',
    '#...cc....cc...#',
    '#..............#',
    '#.F..........F.#',
    '#..............#',
    '#######DD#######',
  ],
  games: [
    '################',
    '#FF..V.O.V...FF#',
    '#..............#',
    '#......I.......#',
    '#..............#',
    '#.F..........F.#',
    '#.....G........#',
    '#..cc......cc..#',
    '#.F..........F.#',
    '#..............#',
    '#######DD#######',
  ],
};

const TILE_OF = { '#': 'wall', '.': 'floor', D: 'door', F: 'solid', R: 'solid', T: 'solid', c: 'solid', V: 'solid', G: 'floor', B: 'floor', L: 'booth', O: 'solid', I: 'floor' };

export function parseRoom(template) {
  const room = { template, cols: template[0].length, rows: template.length, tiles: [], fixtures: [], guards: [], door: [], oldMan: null, pedestal: null, booth: null, tvs: [] };
  template.forEach((line, row) => {
    room.tiles.push([...line].map((ch, col) => {
      if (!(ch in TILE_OF)) throw new Error(`bad room tile "${ch}"`);
      if (ch === 'F' || ch === 'R' || ch === 'T') room.fixtures.push({ col, row, kind: ch });
      if (ch === 'G') room.guards.push({ col, row, type: 'spy' });
      if (ch === 'B') room.guards.push({ col, row, type: 'bot' });
      if (ch === 'D') room.door.push({ col, row });
      if (ch === 'O') room.oldMan = { col, row };
      if (ch === 'I') room.pedestal = { col, row };
      if (ch === 'L') room.booth = { col, row };
      if (ch === 'V') room.tvs.push({ col, row });
      return TILE_OF[ch];
    }));
  });
  return room;
}

const cache = new Map();
export function roomFor(store) {
  const key = store.layout ?? store.theme;
  if (!cache.has(key)) cache.set(key, parseRoom(TEMPLATES[key]));
  return cache.get(key);
}
