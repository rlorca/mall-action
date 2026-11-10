/** Hand-designed store room templates. Any size is supported; rooms scroll with a camera. */
export const TILE = 16;

/**
 * Legend: # wall, . floor, F fixture, R fitting room (fixture), T toy shelf (fixture),
 * C counter, P decor, V demo TV, B listening-booth pad, D door,
 * s spy guard, h/v security bot patrolling horizontally/vertically.
 */
export const ROOM_ART: Record<string, string[]> = {
  forever: [
    '################',
    '#RR.RR....F..F.#',
    '#..............#',
    '#.F..s...CC....#',
    '#.F......CC..F.#',
    '#..............#',
    '#....F..F...s..#',
    '#.P..........P.#',
    '#....F..F......#',
    '#..............#',
    '#######DD#######',
  ],
  radio: [
    '################',
    '#FFFF......FFFF#',
    '#..............#',
    '#..h...........#',
    '#.CC..F..F..CC.#',
    '#..............#',
    '#.F....s.....F.#',
    '#.F..........F.#',
    '#....P....P....#',
    '#..............#',
    '#######DD#######',
  ],
  kgb: [
    '################',
    '#TT..F....F..TT#',
    '#..............#',
    '#..s.......s...#',
    '#..FF..CC..FF..#',
    '#..............#',
    '#.T....PP....T.#',
    '#..............#',
    '#..F........F..#',
    '#..............#',
    '#######DD#######',
  ],
  hotspy: [
    '################',
    '#CCCCCCC..FFFF.#',
    '#......s.......#',
    '#..............#',
    '#.F..F....F..F.#',
    '#.P..P....P..P.#',
    '#..............#',
    '#.F..F....F..F.#',
    '#..............#',
    '#..............#',
    '#######DD#######',
  ],
  foot: [
    '################',
    '#F.F.F.F..F.F.F#',
    '#..............#',
    '#...s......s...#',
    '#.CCCC....CCCC.#',
    '#..............#',
    '#.F..........F.#',
    '#.F....PP....F.#',
    '#..............#',
    '#..............#',
    '#######DD#######',
  ],
  sam: [
    '################',
    '#FF.FF.FF..#BB.#',
    '#..........#BB.#',
    '#..............#',
    '#.FF.FF..s.....#',
    '#............v.#',
    '#.FF.FF..CC....#',
    '#..............#',
    '#.P.........P..#',
    '#..............#',
    '#######DD#######',
  ],
  crook: [
    '################',
    '#.F...F..F...F.#',
    '#..............#',
    '#..CC......CC..#',
    '#......s.......#',
    '#.F....PP....F.#',
    '#..............#',
    '#..CC......CC..#',
    '#..............#',
    '#..............#',
    '#######DD#######',
  ],
  sharper: [
    '################',
    '#F.....FF.....F#',
    '#..............#',
    '#...F......F...#',
    '#..............#',
    '#.h....CC......#',
    '#..............#',
    '#...F......F...#',
    '#..............#',
    '#.P..........P.#',
    '#######DD#######',
  ],
  spender: [
    '################',
    '#F.F........F.F#',
    '#..............#',
    '#....CCCCCC....#',
    '#.......s......#',
    '#.P..........P.#',
    '#..F...FF...F..#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#######DD#######',
  ],
  gamestonk: [
    '################',
    '#F...FV..VF...F#',
    '#..............#',
    '#..............#',
    '#.CC........CC.#',
    '#......s.......#',
    '#.F..........F.#',
    '#.F..h.......F.#',
    '#..............#',
    '#..............#',
    '#######DD#######',
  ],
};

export interface RoomTpl {
  key: string;
  w: number;
  h: number;
  tiles: string[]; // guards replaced by floor
  fixtures: { tx: number; ty: number; kind: 'F' | 'R' | 'T' }[];
  guards: { tx: number; ty: number; kind: 'spy' | 'bot'; axis: 'h' | 'v' }[];
  doors: { tx: number; ty: number }[];
  startX: number; // player start (top-left px), just inside the door
  startY: number;
}

export function parseRoom(key: string, rows: string[]): RoomTpl {
  const h = rows.length;
  const w = rows[0].length;
  const tiles: string[] = [];
  const fixtures: RoomTpl['fixtures'] = [];
  const guards: RoomTpl['guards'] = [];
  const doors: RoomTpl['doors'] = [];
  for (let ty = 0; ty < h; ty++) {
    let row = '';
    if (rows[ty].length !== w) throw new Error(`room ${key}: ragged row ${ty}`);
    for (let tx = 0; tx < w; tx++) {
      let ch = rows[ty][tx];
      if (ch === 'F' || ch === 'R' || ch === 'T') fixtures.push({ tx, ty, kind: ch });
      else if (ch === 's') { guards.push({ tx, ty, kind: 'spy', axis: 'h' }); ch = '.'; }
      else if (ch === 'h' || ch === 'v') { guards.push({ tx, ty, kind: 'bot', axis: ch }); ch = '.'; }
      else if (ch === 'D') doors.push({ tx, ty });
      row += ch;
    }
    tiles.push(row);
  }
  if (!doors.length) throw new Error(`room ${key}: no door`);
  const dx0 = Math.min(...doors.map((d) => d.tx));
  const dx1 = Math.max(...doors.map((d) => d.tx));
  const startX = ((dx0 + dx1 + 1) * TILE) / 2 - 8;
  const startY = (doors[0].ty - 1) * TILE;
  return { key, w, h, tiles, fixtures, guards, doors, startX, startY };
}

export const ROOMS: Record<string, RoomTpl> = {};
for (const [k, rows] of Object.entries(ROOM_ART)) ROOMS[k] = parseRoom(k, rows);

const SOLID = '#FRTCPV';
export function tileAt(tpl: RoomTpl, tx: number, ty: number): string {
  if (tx < 0 || ty < 0 || tx >= tpl.w || ty >= tpl.h) return '#';
  return tpl.tiles[ty][tx];
}
export function solidTile(tpl: RoomTpl, tx: number, ty: number): boolean {
  return SOLID.includes(tileAt(tpl, tx, ty));
}
export function solidAt(tpl: RoomTpl, px: number, py: number): boolean {
  return solidTile(tpl, Math.floor(px / TILE), Math.floor(py / TILE));
}

/** Validate a template; returns a list of problems (empty = valid). Used by tests. */
export function validateRoom(tpl: RoomTpl): string[] {
  const errs: string[] = [];
  const bottom = tpl.h - 1;
  if (!tpl.doors.every((d) => d.ty === bottom)) errs.push('door must be on the bottom row');
  const mid = (tpl.w - 1) / 2;
  const dc = tpl.doors.reduce((s, d) => s + d.tx, 0) / tpl.doors.length;
  if (Math.abs(dc - mid) > 0.01) errs.push('door must be centred');
  for (let x = 0; x < tpl.w; x++) {
    if (tileAt(tpl, x, 0) !== '#') errs.push('top edge must be wall');
    const b = tileAt(tpl, x, bottom);
    if (b !== '#' && b !== 'D') errs.push('bottom edge must be wall or door');
  }
  for (let y = 0; y < tpl.h; y++) if (tileAt(tpl, 0, y) !== '#' || tileAt(tpl, tpl.w - 1, y) !== '#') errs.push('side edges must be wall');
  if (tpl.guards.length < 1 || tpl.guards.length > 3) errs.push('needs 1 to 3 guards');
  if (tpl.fixtures.length < 4) errs.push('needs at least 4 fixtures');
  // flood fill from the door
  const seen = new Set<string>();
  const stack = tpl.doors.map((d) => [d.tx, d.ty]);
  while (stack.length) {
    const [x, y] = stack.pop()!;
    const k = x + ',' + y;
    if (seen.has(k) || solidTile(tpl, x, y)) continue;
    seen.add(k);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  for (const f of tpl.fixtures) {
    const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(f.tx + dx + ',' + (f.ty + dy)));
    if (!ok) errs.push(`fixture at ${f.tx},${f.ty} unreachable`);
  }
  for (const g of tpl.guards) if (!seen.has(g.tx + ',' + g.ty)) errs.push(`guard at ${g.tx},${g.ty} unreachable`);
  return errs;
}
