//! Hand-designed room layouts (ASCII grids) and the tile model. Rooms can be ANY size: `Template::parse`
//! reads whatever grid it is given; the shipped stores are all 16x11 (one screen) with the door at the
//! bottom centre.
//!
//! Legend
//! ```text
//!  .  floor            ,  floor2 (carpet / checker)    #  wall
//!  a  fixture A        b  fixture B   (searchable)     c  counter (solid)
//!  d  decor A          e  decor B     (solid)          V  vending machine (solid)
//!  F  fitting room     T  toy shelf   (searchable, special)
//!  B  listening booth (walkable)                       D  door (walkable, bottom centre)
//!  s  spy spawn        h  bot spawn, patrols left/right    v  bot spawn, patrols up/down
//! ```
//! Fixture indices (`run.fixtures`) count the searchable tiles (a b F T) in reading order.

use crate::types::{StoreId, Theme};

pub const TILE: i32 = 16;
pub const ROOM_W: usize = 16;
pub const ROOM_H: usize = 11;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tile {
    Floor,
    Floor2,
    Wall,
    FixA,
    FixB,
    Counter,
    DecorA,
    DecorB,
    Fitting,
    ToyShelf,
    Booth,
    Vending,
    Door,
}

impl Tile {
    pub fn solid(self) -> bool {
        !matches!(self, Tile::Floor | Tile::Floor2 | Tile::Booth | Tile::Door)
    }
    pub fn searchable(self) -> bool {
        matches!(self, Tile::FixA | Tile::FixB | Tile::Fitting | Tile::ToyShelf)
    }
    /// Tiles guards may walk on (they never leave through the door).
    pub fn guard_walkable(self) -> bool {
        matches!(self, Tile::Floor | Tile::Floor2 | Tile::Booth)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpawnKind {
    Spy,
    /// Security bot patrolling left/right.
    BotH,
    /// Security bot patrolling up/down.
    BotV,
}

#[derive(Clone, Debug)]
pub struct Template {
    pub w: i32,
    pub h: i32,
    pub tiles: Vec<Tile>,
    pub spawns: Vec<(SpawnKind, i32, i32)>,
    pub door: (i32, i32),
    /// Tile coordinates of every searchable fixture, in reading order (= fixture index).
    pub fixtures: Vec<(i32, i32)>,
}

impl Template {
    pub fn parse(rows: &[&str]) -> Template {
        let h = rows.len() as i32;
        let w = rows[0].chars().count() as i32;
        let mut tiles = Vec::new();
        let mut spawns = Vec::new();
        let mut door = (w / 2, h - 1);
        let mut fixtures = Vec::new();
        for (y, row) in rows.iter().enumerate() {
            assert_eq!(row.chars().count() as i32, w, "row {y} of a room has the wrong width: {row:?}");
            for (x, c) in row.chars().enumerate() {
                let (x, y) = (x as i32, y as i32);
                let t = match c {
                    '.' => Tile::Floor,
                    ',' => Tile::Floor2,
                    '#' => Tile::Wall,
                    'a' => Tile::FixA,
                    'b' => Tile::FixB,
                    'c' => Tile::Counter,
                    'd' => Tile::DecorA,
                    'e' => Tile::DecorB,
                    'F' => Tile::Fitting,
                    'T' => Tile::ToyShelf,
                    'B' => Tile::Booth,
                    'V' => Tile::Vending,
                    'D' => {
                        door = (x, y);
                        Tile::Door
                    }
                    's' => {
                        spawns.push((SpawnKind::Spy, x, y));
                        Tile::Floor
                    }
                    'h' => {
                        spawns.push((SpawnKind::BotH, x, y));
                        Tile::Floor
                    }
                    'v' => {
                        spawns.push((SpawnKind::BotV, x, y));
                        Tile::Floor
                    }
                    other => panic!("unknown room tile {other:?}"),
                };
                if t.searchable() {
                    fixtures.push((x, y));
                }
                tiles.push(t);
            }
        }
        Template { w, h, tiles, spawns, door, fixtures }
    }

    /// Tile at (x, y); anything outside the room is wall.
    pub fn tile(&self, x: i32, y: i32) -> Tile {
        if x < 0 || y < 0 || x >= self.w || y >= self.h {
            Tile::Wall
        } else {
            self.tiles[(y * self.w + x) as usize]
        }
    }

    pub fn set(&mut self, x: i32, y: i32, t: Tile) {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.tiles[(y * self.w + x) as usize] = t;
        }
    }

    pub fn fixture_index(&self, x: i32, y: i32) -> Option<usize> {
        self.fixtures.iter().position(|&(fx, fy)| fx == x && fy == y)
    }

    /// The tile right inside the door, where the agent walks in and respawns.
    pub fn entry(&self) -> (i32, i32) {
        (self.door.0, self.door.1 - 1)
    }

    pub fn px_w(&self) -> i32 {
        self.w * TILE
    }
    pub fn px_h(&self) -> i32 {
        self.h * TILE
    }

    /// Booth tiles (walkable special tiles).
    pub fn has(&self, t: Tile) -> bool {
        self.tiles.contains(&t)
    }
}

/// Art theme name used by `art::manifest::tile_name`.
pub fn theme_name(t: Theme) -> &'static str {
    match t {
        Theme::Fashion => "fashion",
        Theme::Electronics => "electronics",
        Theme::Toys => "toys",
        Theme::FoodCourt => "food",
        Theme::Sports => "sports",
        Theme::Music => "music",
        Theme::Gadgets => "gadgets",
        Theme::Novelty => "novelty",
        Theme::Games => "games",
    }
}

// ---------------------------------------------------------------------------------------------------------
// The ten open stores. Every layout: 16x11, wall ring, door at the bottom centre (col 8), and nothing that
// can see straight down the door lane at the start.
// ---------------------------------------------------------------------------------------------------------

/// FOREVER 12: three fitting rooms along the top wall, clothing racks, a long till counter. 8 fixtures.
const FOREVER12: [&str; 11] = [
    "################",
    "#F.F.F..dd..aa.#",
    "#......,,,,....#",
    "#.d..,,,,,,,,.d#",
    "#....,,,,,,,,..#",
    "#.b.......s..a.#",
    "#.....cccccc...#",
    "#.d..........b.#",
    "#.s............#",
    "#..............#",
    "########D#######",
];

/// RADIOSHOCK: TV wall, aisles of component shelves, a corridor patrolled by a security bot. 7 fixtures.
const RADIOSHOCK: [&str; 11] = [
    "################",
    "#ded.ded.d.cccc#",
    "#..............#",
    "#.aa........bb.#",
    "#..............#",
    "#.cc..h..a.cc.s#",
    "#..............#",
    "#.b....cc......#",
    "#.....,,,,...a.#",
    "#..............#",
    "########D#######",
];

/// KGB TOYS: shootable toy shelves around a play mat. 8 fixtures (4 toy shelves).
const KGBTOYS: [&str; 11] = [
    "################",
    "#T.T.,,,,,,.T.T#",
    "#..............#",
    "#.a....dd....b.#",
    "#....,,,,,,....#",
    "#....,,,,,,.s..#",
    "#.s..,,,,,,....#",
    "#.b..........a.#",
    "#.d..........d.#",
    "#..............#",
    "########D#######",
];

/// HOT SPY ON A STICK: food-court counters, stock coolers and tables. 7 fixtures.
const HOTSPY: [&str; 11] = [
    "################",
    "#aa.cccccccc.bb#",
    "#..............#",
    "#.dd..,,,,..dd.#",
    "#.....,,,,.....#",
    "#.s...........s#",
    "#.dd..,,,,..dd.#",
    "#.....,,,,.....#",
    "#.a..........b.#",
    "#..............#",
    "########D#######",
];

/// SAM BADDY: record bins, a listening booth in the corner, a speaker stack. 8 fixtures.
const SAMBADDY: [&str; 11] = [
    "################",
    "#B.bbbb..ee..aa#",
    "#..............#",
    "#.a..........b.#",
    "#....,,,,,,....#",
    "#.s..,cccc,....#",
    "#....,,,,,,..s.#",
    "#.e..........e.#",
    "#.ee........ee.#",
    "#..............#",
    "########D#######",
];

/// FOOT LOCKPICKER: shoe walls, try-on benches, a patrolling bot. 8 fixtures.
const FOOTLOCKPICKER: [&str; 11] = [
    "################",
    "#aaaa......bbbb#",
    "#..............#",
    "#.d..d.,,,,....#",
    "#..........s...#",
    "#.....,,,,..d..#",
    "#.v...,,,,...v.#",
    "#.....d..d.....#",
    "#.d..........d.#",
    "#..............#",
    "########D#######",
];

/// CROOKSTONE (power shop): massage chairs and gadget tables. 5 fixtures.
const CROOKSTONE: [&str; 11] = [
    "################",
    "#dd.........dd.#",
    "#..a........b..#",
    "#..............#",
    "#.....,,,,.....#",
    "#.s...,cc,.....#",
    "#.....,,,,.....#",
    "#.........a....#",
    "#..a........b..#",
    "#..............#",
    "########D#######",
];

/// SHARPER IMAGINE (power shop): sleek gadget plinths, a robot on patrol. 4 fixtures.
const SHARPERIMAGINE: [&str; 11] = [
    "################",
    "#..............#",
    "#.e.a......b.e.#",
    "#..............#",
    "#.....,,,,.....#",
    "#.....,cc,.....#",
    "#h....,,,,..s..#",
    "#..............#",
    "#.e.a......b.e.#",
    "#..............#",
    "########D#######",
];

/// SPENDER'S GIFTS (power shop): black-light posters, lava lamps, a gag-gift counter. 5 fixtures.
const SPENDERS: [&str; 11] = [
    "################",
    "#e.e.e.e.e.e.e.#",
    "#..............#",
    "#.a........b...#",
    "#.....,,,,.....#",
    "#..s..,cc,.....#",
    "#.....,,,,.....#",
    "#.d........d...#",
    "#.....a....b...#",
    "#..............#",
    "########D#######",
];

/// GAMESTONK (power shop): game racks and demo kiosks, with an open central aisle for the cave scene. 5 fixtures.
const GAMESTONK: [&str; 11] = [
    "################",
    "#aa.dd....dd.bb#",
    "#..............#",
    "#.e..........e.#",
    "#......,,......#",
    "#.s....,,......#",
    "#......,,......#",
    "#.e..........e.#",
    "#.....b....a...#",
    "#..............#",
    "########D#######",
];

/// The Zelda-style cave: wall ring, the clerk (middle) and the two demo TVs on the back row.
const CAVE: [&str; 11] = [
    "################",
    "#..............#",
    "#..............#",
    "#....d.ee.d....#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "########D#######",
];

/// The layout of an open store. Closed stores have no room: they fall back to the novelty shop layout so
/// `StoreRoom::new` stays safe (the mall never lets you in).
pub fn template(id: StoreId) -> Template {
    let rows: &[&str] = match id {
        StoreId::Forever12 => &FOREVER12,
        StoreId::RadioShock => &RADIOSHOCK,
        StoreId::KgbToys => &KGBTOYS,
        StoreId::HotSpyOnAStick => &HOTSPY,
        StoreId::SamBaddy => &SAMBADDY,
        StoreId::FootLockpicker => &FOOTLOCKPICKER,
        StoreId::Crookstone => &CROOKSTONE,
        StoreId::SharperImagine => &SHARPERIMAGINE,
        StoreId::SpendersGifts => &SPENDERS,
        StoreId::GameStonk => &GAMESTONK,
        _ => &SPENDERS,
    };
    Template::parse(rows)
}

pub fn cave_template() -> Template {
    Template::parse(&CAVE)
}

/// Pixel positions (sprite top-left, room coordinates) of the clerk and the pedestal, centred on the room
/// (the clerk straddles the two middle columns).
pub const CAVE_CLERK_PX: (i32, i32) = (120, 48);
pub const CAVE_PEDESTAL_PX: (i32, i32) = (120, 96);
/// The two flickering demo TVs.
pub const CAVE_TVS_PX: [(i32, i32); 2] = [(80, 48), (160, 48)];
