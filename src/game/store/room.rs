//! Top-down store rooms: character-grid templates, their legend, the parsed `Room`
//! and a validator. Pure data + pure functions (no rng, no run state). Port of `game/store/room.ts`.
//!
//! LEGEND (one character per 16 px tile; every row of a template has the same length,
//! the grid may be any size; the door is always the 2 tiles at the bottom centre):
//!
//!   #  wall                      .  floor
//!   D  doorway (bottom row, the two centre tiles)   @  agent start (floor, directly above the door)
//!   s  shelf fixture    SEARCHABLE (st.<theme>.shelf / .shelf.open)
//!   r  rack fixture     SEARCHABLE (st.<theme>.rack / .rack.open)
//!   F  fitting room     SEARCHABLE (Forever 12; 25% chance of a spy when searched)
//!   c  counter (solid)  d  decor (solid)  V  demo TV (solid, GameStonk)
//!   T  toy shelf        solid, NOT searchable: shoot it to release 3 wind-up toys (KGB Toys)
//!   B  listening booth  walkable; standing on it switches the music (Sam Baddy)
//!   P  pedestal         walkable; the GameStonk easter-egg item stands on it (plain floor when the egg is not active)
//!   K  clerk spot       floor; the GameStonk easter-egg clerk stands here (absent when the egg is not active)
//!   y  spy spawn        floor
//!   b  security bot spawn, patrols left <-> right        v  security bot spawn, patrols up <-> down
//!
//! Searchable fixtures are numbered in reading order (rows top -> bottom, left -> right); that
//! number is the index into `StoreState.fixtures` (src/game/levelstate.rs).

use std::sync::OnceLock;

use crate::content::stores::{store_def, StoreId};
use crate::content::themes::ThemeId;

pub const TILE: i32 = 16;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TileKind {
    Floor,
    Wall,
    Counter,
    Decor,
    Shelf,
    Rack,
    Fitting,
    Toyshelf,
    Booth,
    Tv,
    Pedestal,
    Door,
}

impl TileKind {
    /// The TS string ('floor', 'wall', ... 'toyshelf', 'tv', ...).
    pub const fn as_str(self) -> &'static str {
        match self {
            TileKind::Floor => "floor",
            TileKind::Wall => "wall",
            TileKind::Counter => "counter",
            TileKind::Decor => "decor",
            TileKind::Shelf => "shelf",
            TileKind::Rack => "rack",
            TileKind::Fitting => "fitting",
            TileKind::Toyshelf => "toyshelf",
            TileKind::Booth => "booth",
            TileKind::Tv => "tv",
            TileKind::Pedestal => "pedestal",
            TileKind::Door => "door",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FixtureKind {
    Shelf,
    Rack,
    Fitting,
}

impl FixtureKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            FixtureKind::Shelf => "shelf",
            FixtureKind::Rack => "rack",
            FixtureKind::Fitting => "fitting",
        }
    }
}

pub fn is_solid_kind(k: TileKind) -> bool {
    matches!(
        k,
        TileKind::Wall | TileKind::Counter | TileKind::Decor | TileKind::Shelf | TileKind::Rack | TileKind::Fitting | TileKind::Toyshelf | TileKind::Tv
    )
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct FixtureSpot {
    /// Index into `StoreState.fixtures`.
    pub index: usize,
    pub col: i32,
    pub row: i32,
    pub kind: FixtureKind,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GuardKind {
    Spy,
    Bot,
}

impl GuardKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            GuardKind::Spy => "spy",
            GuardKind::Bot => "bot",
        }
    }
}

/// Bots only: which way they patrol (TS 'h' | 'v').
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GuardAxis {
    H,
    V,
}

impl GuardAxis {
    pub const fn as_str(self) -> &'static str {
        match self {
            GuardAxis::H => "h",
            GuardAxis::V => "v",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct GuardSpawn {
    pub kind: GuardKind,
    pub col: i32,
    pub row: i32,
    /// Bots only: which way they patrol.
    pub axis: GuardAxis,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Cell {
    pub col: i32,
    pub row: i32,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Room {
    /// The store id as a string for hand-designed rooms ("forever12"), or any label for test rooms ("x", "custom").
    pub id: String,
    pub theme: ThemeId,
    pub cols: i32,
    pub rows: i32,
    /// Row-major, `cols * rows` entries.
    pub tiles: Vec<TileKind>,
    /// Searchable fixtures in reading order.
    pub fixtures: Vec<FixtureSpot>,
    pub guards: Vec<GuardSpawn>,
    /// Left tile of the 2-tile doorway (always on the bottom row).
    pub door: Cell,
    pub spawn: Cell,
    pub clerk: Option<Cell>,
    pub pedestal: Option<Cell>,
    pub toy_shelves: Vec<Cell>,
    pub booths: Vec<Cell>,
}

pub const DOOR_TILES: i32 = 2;

pub fn room_px_w(room: &Room) -> i32 {
    room.cols * TILE
}
pub fn room_px_h(room: &Room) -> i32 {
    room.rows * TILE
}

/// Out-of-range cells are walls.
pub fn tile_at(room: &Room, col: i32, row: i32) -> TileKind {
    if col < 0 || row < 0 || col >= room.cols || row >= room.rows {
        return TileKind::Wall;
    }
    room.tiles[(row * room.cols + col) as usize]
}

pub fn is_door_tile(room: &Room, col: i32, row: i32) -> bool {
    row == room.door.row && col >= room.door.col && col < room.door.col + DOOR_TILES
}

/// Walkable by guards, toys and bullets-that-must-not-leave: everything except solids and the doorway.
pub fn guard_walkable(room: &Room, col: i32, row: i32) -> bool {
    let k = tile_at(room, col, row);
    !is_solid_kind(k) && k != TileKind::Door
}

fn char_to_tile(ch: char) -> Option<TileKind> {
    Some(match ch {
        '#' => TileKind::Wall,
        '.' => TileKind::Floor,
        'D' => TileKind::Door,
        '@' => TileKind::Floor,
        's' => TileKind::Shelf,
        'r' => TileKind::Rack,
        'F' => TileKind::Fitting,
        'c' => TileKind::Counter,
        'd' => TileKind::Decor,
        'V' => TileKind::Tv,
        'T' => TileKind::Toyshelf,
        'B' => TileKind::Booth,
        'P' => TileKind::Pedestal,
        'K' => TileKind::Floor,
        'y' => TileKind::Floor,
        'b' => TileKind::Floor,
        'v' => TileKind::Floor,
        _ => return None,
    })
}

/// Parse a character grid into a `Room`. Errors (TS throws) on ragged rows, unknown characters, or a missing/duplicate `@`.
/// The `Err` text is the TS error message.
pub fn parse_room(id: &str, theme: ThemeId, rows: &[&str]) -> Result<Room, String> {
    if rows.is_empty() {
        return Err(format!("room {}: empty template", id));
    }
    let cols = rows[0].chars().count() as i32;
    let mut tiles: Vec<TileKind> = Vec::new();
    let mut fixtures: Vec<FixtureSpot> = Vec::new();
    let mut guards: Vec<GuardSpawn> = Vec::new();
    let mut toy_shelves: Vec<Cell> = Vec::new();
    let mut booths: Vec<Cell> = Vec::new();
    let mut door: Option<Cell> = None;
    let mut spawn: Option<Cell> = None;
    let mut clerk: Option<Cell> = None;
    let mut pedestal: Option<Cell> = None;
    for (row, line) in rows.iter().enumerate() {
        let row = row as i32;
        let chars: Vec<char> = line.chars().collect();
        if chars.len() as i32 != cols {
            return Err(format!("room {}: row {} has {} chars, expected {}", id, row, chars.len(), cols));
        }
        for col in 0..cols {
            let ch = chars[col as usize];
            let kind = match char_to_tile(ch) {
                Some(k) => k,
                None => return Err(format!("room {}: unknown legend character '{}' at {},{}", id, ch, col, row)),
            };
            tiles.push(kind);
            let fk = match kind {
                TileKind::Shelf => Some(FixtureKind::Shelf),
                TileKind::Rack => Some(FixtureKind::Rack),
                TileKind::Fitting => Some(FixtureKind::Fitting),
                _ => None,
            };
            if let Some(kind) = fk {
                fixtures.push(FixtureSpot { index: fixtures.len(), col, row, kind });
            }
            if kind == TileKind::Toyshelf {
                toy_shelves.push(Cell { col, row });
            }
            if kind == TileKind::Booth {
                booths.push(Cell { col, row });
            }
            if kind == TileKind::Door && door.is_none() {
                door = Some(Cell { col, row });
            }
            if ch == '@' {
                if spawn.is_some() {
                    return Err(format!("room {}: more than one '@'", id));
                }
                spawn = Some(Cell { col, row });
            }
            if ch == 'K' {
                clerk = Some(Cell { col, row });
            }
            if ch == 'P' {
                pedestal = Some(Cell { col, row });
            }
            if ch == 'y' {
                guards.push(GuardSpawn { kind: GuardKind::Spy, col, row, axis: GuardAxis::H });
            }
            if ch == 'b' {
                guards.push(GuardSpawn { kind: GuardKind::Bot, col, row, axis: GuardAxis::H });
            }
            if ch == 'v' {
                guards.push(GuardSpawn { kind: GuardKind::Bot, col, row, axis: GuardAxis::V });
            }
        }
    }
    let spawn = spawn.ok_or_else(|| format!("room {}: no '@' agent start", id))?;
    let door = door.ok_or_else(|| format!("room {}: no doorway 'D'", id))?;
    Ok(Room {
        id: id.to_string(),
        theme,
        cols,
        rows: rows.len() as i32,
        tiles,
        fixtures,
        guards,
        door,
        spawn,
        clerk,
        pedestal,
        toy_shelves,
        booths,
    })
}

/// Distance (in tiles, 4-neighbour) from `from` over tiles that are not solid; -1 = unreachable.
/// (TS `walkDistances(room, from, allowDoor = true)`: pass `true` for the default.)
pub fn walk_distances(room: &Room, from: Cell, allow_door: bool) -> Vec<i16> {
    let mut dist = vec![-1i16; (room.cols * room.rows) as usize];
    let mut q: Vec<usize> = Vec::new();
    let open = |c: i32, r: i32| -> bool {
        let k = tile_at(room, c, r);
        !is_solid_kind(k) && (allow_door || k != TileKind::Door)
    };
    if !open(from.col, from.row) {
        return dist;
    }
    dist[(from.row * room.cols + from.col) as usize] = 0;
    q.push((from.row * room.cols + from.col) as usize);
    let mut i = 0;
    while i < q.len() {
        let cur = q[i];
        i += 1;
        let c = cur as i32 % room.cols;
        let r = cur as i32 / room.cols;
        for (dc, dr) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
            let nc = c + dc;
            let nr = r + dr;
            if nc < 0 || nr < 0 || nc >= room.cols || nr >= room.rows {
                continue;
            }
            let ni = (nr * room.cols + nc) as usize;
            if dist[ni] != -1 || !open(nc, nr) {
                continue;
            }
            dist[ni] = dist[cur] + 1;
            q.push(ni);
        }
    }
    dist
}

pub const MIN_FIXTURES: i32 = 4;
pub const MAX_FIXTURES: i32 = 12;
/// Guards must start at least this many tiles (walking) from the agent's start.
pub const MIN_GUARD_DISTANCE: i32 = 4;

/// Every problem found with a room (empty = valid). Used by the template tests and by `get_room`.
pub fn validate_room(room: &Room) -> Vec<String> {
    let mut problems: Vec<String> = Vec::new();
    let cols = room.cols;
    let rows = room.rows;
    if cols < 8 || rows < 6 {
        problems.push(format!("too small: {}x{}", cols, rows));
    }
    // enclosed by walls, except the doorway
    for c in 0..cols {
        for r in [0, rows - 1] {
            let k = tile_at(room, c, r);
            if k != TileKind::Wall && !(k == TileKind::Door && r == rows - 1) {
                problems.push(format!("border ({},{}) is {}, expected wall", c, r, k.as_str()));
            }
        }
    }
    for r in 0..rows {
        for c in [0, cols - 1] {
            if tile_at(room, c, r) != TileKind::Wall {
                problems.push(format!("border ({},{}) is {}, expected wall", c, r, tile_at(room, c, r).as_str()));
            }
        }
    }
    // door: exactly 2 tiles, bottom row, centred
    let mut doors: Vec<Cell> = Vec::new();
    for (i, k) in room.tiles.iter().enumerate() {
        if *k == TileKind::Door {
            doors.push(Cell { col: i as i32 % cols, row: i as i32 / cols });
        }
    }
    let want_col = cols / 2 - 1;
    if doors.len() as i32 != DOOR_TILES {
        problems.push(format!("expected {} door tiles, found {}", DOOR_TILES, doors.len()));
    } else if room.door.row != rows - 1 || room.door.col != want_col {
        problems.push(format!("door must be bottom centre (col {}), found {},{}", want_col, room.door.col, room.door.row));
    }
    // the agent starts just above the door, on a free tile
    if room.spawn.row != rows - 2 {
        problems.push(format!("spawn must be on the row above the door, found row {}", room.spawn.row));
    }
    if tile_at(room, room.spawn.col, room.spawn.row) != TileKind::Floor {
        problems.push("spawn tile is not floor".to_string());
    }
    if room.spawn.col < room.door.col || room.spawn.col >= room.door.col + DOOR_TILES {
        problems.push("spawn must be directly above the doorway".to_string());
    }
    // fixtures
    let nfx = room.fixtures.len() as i32;
    if nfx < MIN_FIXTURES || nfx > MAX_FIXTURES {
        problems.push(format!("fixture count {} outside {}..{}", nfx, MIN_FIXTURES, MAX_FIXTURES));
    }
    // reachability from the spawn: every non-solid tile, and a free neighbour for every fixture and toy shelf
    let dist = walk_distances(room, room.spawn, true);
    for (i, k) in room.tiles.iter().enumerate() {
        if !is_solid_kind(*k) && dist[i] == -1 {
            problems.push(format!("unreachable {} tile at {},{}", k.as_str(), i as i32 % cols, i as i32 / cols));
        }
    }
    let reachable_neighbour = |c: i32, r: i32| -> bool {
        [(1, 0), (-1, 0), (0, 1), (0, -1)].iter().any(|&(dc, dr)| {
            let nc = c + dc;
            let nr = r + dr;
            nc >= 0 && nr >= 0 && nc < cols && nr < rows && dist[(nr * cols + nc) as usize] >= 0 && tile_at(room, nc, nr) != TileKind::Door
        })
    };
    for f in &room.fixtures {
        if !reachable_neighbour(f.col, f.row) {
            problems.push(format!("fixture {} at {},{} cannot be reached", f.index, f.col, f.row));
        }
    }
    for t in &room.toy_shelves {
        if !reachable_neighbour(t.col, t.row) {
            problems.push(format!("toy shelf at {},{} cannot be reached", t.col, t.row));
        }
    }
    // guards
    let ng = room.guards.len();
    if ng < 1 || ng > 3 {
        problems.push(format!("guard count {} outside 1..3", ng));
    }
    for g in &room.guards {
        if tile_at(room, g.col, g.row) != TileKind::Floor {
            problems.push(format!("guard spawn {},{} is not on floor", g.col, g.row));
        }
        let d = dist[(g.row * cols + g.col) as usize];
        if (d as i32) < MIN_GUARD_DISTANCE {
            problems.push(format!("guard spawn {},{} is only {} tiles from the agent start", g.col, g.row, d));
        }
    }
    // doorway row above the door must be free so nobody is boxed in on entry
    for c in room.door.col..room.door.col + DOOR_TILES {
        if tile_at(room, c, rows - 2) != TileKind::Floor {
            problems.push(format!("tile above the door at col {} is not floor", c));
        }
    }
    problems
}

// ------------------------------------------------------------------ the 10 hand-designed rooms (16 x 11)

/// TS `ROOM_GRIDS` (same key order). Use `room_grid(id)` to look one up.
// prettier-ignore
pub const ROOM_GRIDS: [(StoreId, &[&str]); 10] = [
    // FOREVER 12 (fashion): a row of fitting rooms along the back wall, clothing racks, a checkout counter. 8 fixtures, 2 spies.
    (StoreId::Forever12, &[
        "################",
        "#.F..F..F..cccc#",
        "#..............#",
        "#..r..y..r.....#",
        "#..............#",
        "#.r..cc..cc..r.#",
        "#..............#",
        "#d..y......r..d#",
        "#..............#",
        "#......@.......#",
        "#######DD#######",
    ]),
    // RADIOSHOCK (electronics): two long counters make a corridor that a security bot paces; shelves of parts on the walls. 7 fixtures, 1 spy + 1 bot.
    (StoreId::Radioshock, &[
        "################",
        "#.s.s.s....dd.d#",
        "#..............#",
        "#.cccc....cccc.#",
        "#s..b.........s#",
        "#dcccc....ccccd#",
        "#s............s#",
        "#..............#",
        "#...y.....dd...#",
        "#......@.......#",
        "#######DD#######",
    ]),
    // KGB TOYS (toys): three toy shelves (shoot them!) along the back wall, play tables. 7 fixtures, 2 spies.
    (StoreId::Kgbtoys, &[
        "################",
        "#.T..T..T..s.s.#",
        "#..............#",
        "#.s.....y....s.#",
        "#..............#",
        "#..ddd....ddd.s#",
        "#..............#",
        "#.r........y.r.#",
        "#..............#",
        "#......@.......#",
        "#######DD#######",
    ]),
    // SAM BADDY (music): record bins, a stage with speakers, the listening booth. 8 fixtures, 2 spies.
    (StoreId::Sambaddy, &[
        "################",
        "#.r.r.r....dddd#",
        "#..............#",
        "#..y.......BBr.#",
        "#..............#",
        "#.ccc...r..r...#",
        "#..............#",
        "#d.r......r...d#",
        "#..y...........#",
        "#......@.......#",
        "#######DD#######",
    ]),
    // HOT SPY ON A STICK (food court): food stands and tables; a bot guards the back-right corner. 7 fixtures, 1 spy + 1 bot.
    (StoreId::Hotspy, &[
        "################",
        "#.s.s.s..ccccc.#",
        "#..............#",
        "#.dd...y...dd.r#",
        "#............v.#",
        "#.dd........dd.#",
        "#r.............#",
        "#.dd........dd.#",
        "#.s..........s.#",
        "#......@.......#",
        "#######DD#######",
    ]),
    // FOOT LOCKPICKER (sports): shoe walls on both sides, benches, a patrolling bot. 7 fixtures, 2 spies + 1 bot.
    (StoreId::Footlock, &[
        "################",
        "#....cccccc....#",
        "#s............s#",
        "#..dd......dd..#",
        "#s............s#",
        "#..dd..r...dd..#",
        "#s....b.......s#",
        "#..............#",
        "#..y.......y...#",
        "#......@.......#",
        "#######DD#######",
    ]),
    // CROOKSTONE (gadgets, lounge): massage-chair corners and a display table. 6 fixtures, 1 spy.
    (StoreId::Crookstone, &[
        "################",
        "#..ss......ss..#",
        "#..............#",
        "#..dd......dd..#",
        "#..dd......dd..#",
        "#......cc......#",
        "#..............#",
        "#.r..y.......r.#",
        "#..............#",
        "#......@.......#",
        "#######DD#######",
    ]),
    // GAMESTONK (games): the easter-egg alcove (clerk between two TVs, pedestal below) on the back wall. 6 fixtures, 1 spy.
    (StoreId::Gamestonk, &[
        "################",
        "#.ss..VKV...ss.#",
        "#......P.......#",
        "#.....y........#",
        "#.dd........dd.#",
        "#.dd...cc...dd.#",
        "#..............#",
        "#.r..........r.#",
        "#..............#",
        "#......@.......#",
        "#######DD#######",
    ]),
    // SPENDER'S GIFTS (novelty, black light): lava-lamp island and poster racks. 6 fixtures, 1 spy.
    (StoreId::Spenders, &[
        "################",
        "#.s.s.s....dd.d#",
        "#..............#",
        "#.d..y.........#",
        "#.d...cccc.....#",
        "#........r.....#",
        "#.r............#",
        "#.........r..d.#",
        "#..............#",
        "#......@.......#",
        "#######DD#######",
    ]),
    // SHARPER IMAGINE (gadgets, clean showroom): a bot paces the middle aisle. 6 fixtures, 1 bot + 1 spy.
    (StoreId::Sharper, &[
        "################",
        "#..s........s..#",
        "#..............#",
        "#....cccccc....#",
        "#.r..........r.#",
        "#...b..........#",
        "#..............#",
        "#.s....dd....s.#",
        "#............y.#",
        "#......@.......#",
        "#######DD#######",
    ]),
];

/// TS `ROOM_GRIDS[id]`: `None` for closed stores.
pub fn room_grid(id: StoreId) -> Option<&'static [&'static str]> {
    ROOM_GRIDS.iter().find(|(sid, _)| *sid == id).map(|(_, g)| *g)
}

static ROOM_CACHE: [OnceLock<Room>; 13] = [const { OnceLock::new() }; 13];

/// The parsed (and validated) hand-designed room of an open store, cached (same reference every call).
/// Panics (TS throws) for closed stores / invalid templates.
pub fn get_room(id: StoreId) -> &'static Room {
    ROOM_CACHE[id as usize].get_or_init(|| {
        let grid = room_grid(id);
        let def = store_def(id);
        let (grid, theme) = match (grid, def.theme) {
            (Some(g), Some(t)) => (g, t),
            _ => panic!("store {} has no room", id.as_str()),
        };
        let room = parse_room(id.as_str(), theme, grid).unwrap_or_else(|e| panic!("{}", e));
        let problems = validate_room(&room);
        if !problems.is_empty() {
            panic!("room {} is invalid: {}", id.as_str(), problems.join("; "));
        }
        room
    })
}

/// Number of searchable fixtures of an open store's room.
pub fn fixture_count(id: StoreId) -> usize {
    get_room(id).fixtures.len()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::copy::FIRST_VISIT;
    use crate::content::stores::{open_stores, powerup_stores, target_stores};
    use crate::content::themes::THEMES;

    /// Local copy of `testutil.emptyRoom` (G3 owns store/testutil.rs): an empty open room of any size.
    fn empty_room(cols: i32, rows: i32) -> Room {
        let mut interior: Vec<String> = Vec::new();
        for r in 1..rows - 1 {
            let mut line = ".".repeat((cols - 2) as usize);
            if r == rows - 2 {
                let mid = cols / 2 - 1;
                line = ".".repeat((mid - 1) as usize) + "@" + &".".repeat((cols - 2 - mid) as usize);
            }
            interior.push(line);
        }
        let wall = "#".repeat(cols as usize);
        let door = "#".repeat((cols / 2 - 1) as usize) + "DD" + &"#".repeat((cols / 2 - 1) as usize);
        let mut all: Vec<String> = vec![wall];
        for r in &interior {
            all.push(format!("#{}#", r));
        }
        all.push(door);
        let refs: Vec<&str> = all.iter().map(|s| s.as_str()).collect();
        parse_room("custom", ThemeId::Gadgets, &refs).unwrap()
    }

    fn grid_of(id: StoreId) -> &'static [&'static str] {
        room_grid(id).unwrap()
    }

    fn base() -> Vec<String> {
        grid_of(StoreId::Crookstone).iter().map(|s| s.to_string()).collect()
    }

    fn parse(g: &[String]) -> Result<Room, String> {
        let refs: Vec<&str> = g.iter().map(|s| s.as_str()).collect();
        parse_room("x", ThemeId::Gadgets, &refs)
    }

    fn ids_sorted(v: &[&crate::content::stores::StoreDef]) -> Vec<&'static str> {
        let mut x: Vec<&'static str> = v.iter().map(|s| s.id.as_str()).collect();
        x.sort();
        x
    }

    #[test]
    fn there_is_exactly_one_hand_designed_room_per_open_store_10_and_none_for_closed_stores() {
        let mut keys: Vec<&str> = ROOM_GRIDS.iter().map(|(id, _)| id.as_str()).collect();
        keys.sort();
        assert_eq!(keys, ids_sorted(&open_stores()));
        assert_eq!(open_stores().len(), 10);
    }

    #[test]
    fn per_store_room_checks() {
        for def in open_stores() {
            let grid = grid_of(def.id);
            let room = parse_room(def.id.as_str(), def.theme.unwrap(), grid).unwrap();
            let name = def.name;

            // is 16 x 11 tiles and uses only legend characters
            assert_eq!(room.cols, 16, "{}", name);
            assert_eq!(room.rows, 11, "{}", name);
            assert!(grid.iter().all(|r| r.len() == 16), "{}", name);
            assert!(grid.iter().all(|r| r.chars().all(|c| "#.D@srFcdVTBPKybv".contains(c))), "{}", name);

            // is valid: enclosed by walls, door at the bottom centre, everything reachable
            assert_eq!(validate_room(&room), Vec::<String>::new(), "{}", name);
            assert!(std::ptr::eq(get_room(def.id), get_room(def.id)), "{}", name);

            // has the door at columns 7-8 of the bottom row and the agent start right above it
            assert_eq!(room.door, Cell { col: 7, row: 10 });
            assert_eq!(tile_at(&room, 7, 10), TileKind::Door);
            assert_eq!(tile_at(&room, 8, 10), TileKind::Door);
            assert_eq!(room.spawn.row, 9);
            assert!([7, 8].contains(&room.spawn.col));
            assert_eq!(tile_at(&room, room.spawn.col, room.spawn.row), TileKind::Floor);

            // is enclosed: every border tile is a wall except the doorway
            for c in 0..room.cols {
                assert_eq!(tile_at(&room, c, 0), TileKind::Wall);
                let bottom = tile_at(&room, c, room.rows - 1);
                assert_eq!(bottom, if c == 7 || c == 8 { TileKind::Door } else { TileKind::Wall });
            }
            for r in 0..room.rows {
                assert_eq!(tile_at(&room, 0, r), TileKind::Wall);
                assert_eq!(tile_at(&room, room.cols - 1, r), TileKind::Wall);
            }

            // has every searchable fixture reachable from the door
            let dist = walk_distances(&room, room.spawn, true);
            for f in &room.fixtures {
                let open = [(1, 0), (-1, 0), (0, 1), (0, -1)].iter().any(|&(dc, dr)| dist[((f.row + dr) * room.cols + f.col + dc) as usize] >= 0);
                assert!(open, "fixture {} at {},{}", f.index, f.col, f.row);
            }
            // and every walkable tile is reachable (no sealed pockets)
            for (i, k) in room.tiles.iter().enumerate() {
                if !is_solid_kind(*k) {
                    assert!(dist[i] >= 0, "tile {},{} ({})", i as i32 % room.cols, i as i32 / room.cols, k.as_str());
                }
            }

            // has guard spawns on floor, 1 to 3 of them, away from the entrance
            assert!(room.guards.len() >= 1);
            assert!(room.guards.len() <= 3);
            for g in &room.guards {
                assert_eq!(tile_at(&room, g.col, g.row), TileKind::Floor);
                assert!(dist[(g.row * room.cols + g.col) as usize] as i32 >= MIN_GUARD_DISTANCE);
            }

            // uses its own theme from content/stores.rs
            assert_eq!(Some(room.theme), def.theme);
        }
    }

    #[test]
    fn target_stores_have_about_6_9_searchable_fixtures_power_up_shops_about_4_6() {
        for s in target_stores() {
            let n = get_room(s.id).fixtures.len();
            assert!(n >= 6, "{}", s.id.as_str());
            assert!(n <= 9, "{}", s.id.as_str());
        }
        for s in powerup_stores() {
            let n = get_room(s.id).fixtures.len();
            assert!(n >= 4, "{}", s.id.as_str());
            assert!(n <= 6, "{}", s.id.as_str());
        }
    }

    #[test]
    fn fixtures_are_numbered_in_reading_order_rows_top_to_bottom_left_to_right() {
        for s in open_stores() {
            let fx = &get_room(s.id).fixtures;
            for (i, f) in fx.iter().enumerate() {
                assert_eq!(f.index, i);
                if i > 0 {
                    let p = &fx[i - 1];
                    assert!(f.row > p.row || (f.row == p.row && f.col > p.col));
                }
            }
        }
    }

    #[test]
    fn all_9_themes_are_used_and_the_two_gadget_shops_have_different_layouts() {
        let used: Vec<Option<ThemeId>> = open_stores().iter().map(|s| s.theme).collect();
        for t in THEMES {
            assert!(used.contains(&Some(t)), "{}", t.as_str());
        }
        let gadgets: Vec<_> = open_stores().into_iter().filter(|s| s.theme == Some(ThemeId::Gadgets)).collect();
        assert_eq!(gadgets.len(), 2);
        assert_ne!(grid_of(StoreId::Crookstone), grid_of(StoreId::Sharper));
    }

    #[test]
    fn every_store_with_first_visit_lines_has_a_guard_to_say_them_a_bot_for_bot_lines_a_spy_for_spy_lines() {
        for (id, lines) in FIRST_VISIT {
            let room = get_room(*id);
            for l in lines.iter() {
                assert!(room.guards.iter().any(|g| g.kind.as_str() == l.who.as_str()), "{}: {}", id.as_str(), l.who.as_str());
            }
        }
    }

    #[test]
    fn store_extras_have_their_special_tiles() {
        assert!(get_room(StoreId::Forever12).fixtures.iter().filter(|f| f.kind == FixtureKind::Fitting).count() >= 3);
        assert!(get_room(StoreId::Kgbtoys).toy_shelves.len() >= 3);
        assert!(get_room(StoreId::Sambaddy).booths.len() >= 1);
        let gs = get_room(StoreId::Gamestonk);
        assert!(gs.clerk.is_some());
        assert!(gs.pedestal.is_some());
        // the clerk stands between two demo TVs
        let clerk = gs.clerk.unwrap();
        assert_eq!(tile_at(gs, clerk.col - 1, clerk.row), TileKind::Tv);
        assert_eq!(tile_at(gs, clerk.col + 1, clerk.row), TileKind::Tv);
        assert!(get_room(StoreId::Radioshock).guards.iter().any(|g| g.kind == GuardKind::Bot));
        assert!(get_room(StoreId::Sharper).guards.iter().any(|g| g.kind == GuardKind::Bot));
    }

    #[test]
    fn fixture_counts_sit_within_the_validator_limits() {
        for s in open_stores() {
            let n = get_room(s.id).fixtures.len() as i32;
            assert!(n >= MIN_FIXTURES);
            assert!(n <= MAX_FIXTURES);
        }
    }

    // ---- room parsing and the validator
    #[test]
    fn rejects_ragged_rows_unknown_characters_and_a_missing_start() {
        let mut ragged = base();
        ragged[3] = ragged[3][1..].to_string();
        assert!(parse(&ragged).unwrap_err().contains("expected 16"));
        let mut unknown = base();
        unknown[3] = unknown[3].replacen('.', "?", 1);
        assert!(parse(&unknown).unwrap_err().contains("unknown legend"));
        let no_start: Vec<String> = base().iter().map(|r| r.replacen('@', ".", 1)).collect();
        assert!(parse(&no_start).unwrap_err().contains('@'));
    }

    #[test]
    fn flags_a_hole_in_the_wall() {
        let mut g = base();
        g[0] = format!("{}.{}", &g[0][..5], &g[0][6..]);
        let problems = validate_room(&parse(&g).unwrap());
        assert!(problems.iter().any(|p| p.contains("expected wall")));
    }

    #[test]
    fn flags_a_missing_or_off_centre_door() {
        let mut none = base();
        none[10] = "################".to_string();
        assert!(parse(&none).unwrap_err().contains("doorway"));
        let mut off = base();
        off[10] = "#DD#############".to_string();
        assert!(validate_room(&parse(&off).unwrap()).iter().any(|p| p.contains("door must be bottom centre")));
    }

    #[test]
    fn flags_a_fixture_walled_in_and_a_sealed_pocket() {
        let mut g = base();
        // seal the free tiles around the shelf at (3,1): (2,1) and (3,2)... (4,1) is another shelf, (3,0) is wall
        g[1] = "#.dss......ss..#".to_string();
        g[2] = "#..d...........#".to_string();
        let problems = validate_room(&parse(&g).unwrap());
        assert!(problems.len() > 0);
    }

    #[test]
    fn flags_a_guard_spawned_too_close_to_the_door_or_inside_the_fixtures_count_limits() {
        let mut g = base();
        g[8] = "#.....y........#".to_string();
        let problems = validate_room(&parse(&g).unwrap());
        assert!(problems.iter().any(|p| p.contains("guard spawn")));
    }

    #[test]
    fn parses_rooms_of_any_size_the_room_system_is_not_tied_to_16_x_11() {
        let big = empty_room(40, 24);
        assert_eq!(big.cols, 40);
        assert_eq!(big.rows, 24);
        assert_eq!(big.door, Cell { col: 19, row: 23 });
        let small = empty_room(10, 7);
        assert_eq!(small.cols, 10);
        assert_eq!(small.door, Cell { col: 4, row: 6 });
    }

    #[test]
    fn closed_stores_have_no_room() {
        let r = std::panic::catch_unwind(|| {
            get_room(StoreId::Blockbluster);
        });
        assert!(r.is_err());
        assert!(store_def(StoreId::Blockbluster).theme.is_none());
    }
}
