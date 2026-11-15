//! A scripted PLAYER used by tests. Port of `game/bot.ts`.
//!
//! It only presses buttons (walk, jump over pits, call and ride elevators, escalators, doors, searching in stores),
//! exactly like a human, so end-to-end tests prove that every route in the mall and every store can really be
//! played, with no softlocks.
//!
//! Rust shape: the TS `BotRig` / `StoreBot` interfaces become traits. A rig gives read access to the world
//! (`w()` / `world()` + `run()`) and the two ways of pressing buttons (`hold`, `tap`); the bot never mutates the
//! worlds directly. TS `throw new BotError(..)` becomes `Err(BotError)`.
use std::collections::VecDeque;
use std::fmt;

use crate::content::layout::{floor_y, EscalatorDef, ShaftId, SHAFTS};
use crate::content::stores::{store_def, StoreId, DOOR_W, DOOR_X};
use crate::engine::pad::{A, B, DOWN, LEFT, RIGHT, UP};
use crate::game::levelstate::StoreState;
use crate::game::mall::geometry::opening_state;
use crate::game::mall::testutil::Rig;
use crate::game::mall::types::{OpeningState, PlayerMode, SpyMode};
use crate::game::mall::world::MallWorld;
use crate::game::run::Run;
use crate::game::store::room::{is_solid_kind, tile_at, Room, TILE};
use crate::game::store::world::{BulletKind, Dir, StoreWorld};
use crate::game::store::room::GuardKind;

/// TS `BotRig`.
pub trait BotRig {
    /// The mall world (it persists across store visits).
    fn w(&self) -> &MallWorld;
    /// Hold `held` for `n` frames (TS `hold(held, n = 1)`).
    fn hold(&mut self, held: u32, n: i32);
    fn tap(&mut self, btn: u32);
}

/// TS `class BotError extends Error`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BotError(pub String);

impl fmt::Display for BotError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "BotError: {}", self.0)
    }
}

impl std::error::Error for BotError {}

pub type BotResult<T = ()> = Result<T, BotError>;

fn must(cond: bool, msg: impl FnOnce() -> String) -> BotResult {
    if cond {
        Ok(())
    } else {
        Err(BotError(msg()))
    }
}

/// The mall `Rig` of `mall/testutil.rs` is a `BotRig` (the route tests use it).
impl BotRig for Rig {
    fn w(&self) -> &MallWorld {
        &self.w
    }
    fn hold(&mut self, held: u32, n: i32) {
        Rig::hold(self, held, n)
    }
    fn tap(&mut self, btn: u32) {
        Rig::tap(self, btn)
    }
}

/// Walk like a player: jump-kick over any open pit that is in the way, and over a mall walker that blocks the corridor.
pub fn walk_to(r: &mut dyn BotRig, x: f64) {
    walk_to_max(r, x, 3500)
}

pub fn walk_to_max(r: &mut dyn BotRig, x: f64, max: i32) {
    // NB: the TS holds a live reference `p = r.w.player`; every read of `p.*` below is therefore live.
    // A `null` floor (in the air) coerces to 0 in the TS comparisons, hence `unwrap_or(0)`.
    let mut stall = 0;
    let mut last_x = r.w().player.x;
    for _ in 0..max {
        let dx = x - r.w().player.x;
        if dx.abs() <= 0.6 {
            break;
        }
        let dir: i32 = if dx > 0.0 { 1 } else { -1 };
        let btn = if dir > 0 { RIGHT } else { LEFT };
        if r.w().player.mode == PlayerMode::Ground && r.w().player.floor.is_some() {
            for sh in SHAFTS.iter() {
                let floor = r.w().player.floor.unwrap_or(0);
                if floor < sh.top || floor > sh.bottom {
                    continue;
                }
                if opening_state(r.w().car(sh.id), floor) != OpeningState::Pit {
                    continue;
                }
                let edge = if dir > 0 { sh.x + 4.0 } else { sh.x + sh.w - 4.0 };
                let gap = (edge - r.w().player.x) * dir as f64;
                let beyond = if dir > 0 { x > sh.x + sh.w } else { x < sh.x };
                if beyond && gap >= 0.0 && gap <= 7.0 {
                    r.hold(btn | B, 1);
                    jump_until_landed(r, btn);
                }
            }
            // Not getting anywhere (a mall walker is shoving us back): a jump-kick carries us past his centre.
            let px = r.w().player.x;
            stall = if (px - last_x) * dir as f64 > 0.2 { 0 } else { stall + 1 };
            last_x = px;
            if stall >= 12 && !near_open_pit(r, px, r.w().player.floor.unwrap_or(0), 40.0) {
                r.hold(btn | B, 1);
                jump_until_landed(r, btn);
                stall = 0;
            }
        }
        r.hold(btn, 1);
    }
    r.hold(0, 1);
}

/// `for (let k = 0; k < 60 && mode === 'air'; k++) r.hold(btn, 1)`.
fn jump_until_landed(r: &mut dyn BotRig, btn: u32) {
    let mut k = 0;
    while k < 60 && r.w().player.mode == PlayerMode::Air {
        r.hold(btn, 1);
        k += 1;
    }
}

fn near_open_pit(r: &dyn BotRig, x: f64, floor: i32, margin: f64) -> bool {
    for sh in SHAFTS.iter() {
        if floor < sh.top || floor > sh.bottom {
            continue;
        }
        if x > sh.x - margin && x < sh.x + sh.w + margin && opening_state(r.w().car(sh.id), floor) == OpeningState::Pit {
            return true;
        }
    }
    false
}

/// Ride shaft `id` from the current floor to floor `to` and step out.
pub fn ride(r: &mut dyn BotRig, id: ShaftId, to: i32) -> BotResult {
    let s = *SHAFTS.iter().find(|k| k.id == id).unwrap();
    let from = r.w().player.floor;
    must(from.is_some(), || "ride: not standing on a floor".to_string())?;
    let from = from.unwrap();
    // like a player: stand beside the opening and wait (standing still calls the car)
    let side = if r.w().player.x < s.x { s.x - 6.0 } else { s.x + s.w + 6.0 };
    walk_to(r, side);
    let mut i = 0;
    while i < 1800 && opening_state(r.w().car(id), from) != OpeningState::Here {
        r.hold(0, 1);
        i += 1;
    }
    must(opening_state(r.w().car(id), from) == OpeningState::Here, || format!("{}: the car never came to floor {}", id.as_str(), from))?;
    walk_to(r, s.x + s.w / 2.0);
    r.tap(if to > from { DOWN } else { UP });
    must(r.w().player.mode == PlayerMode::Ride, || format!("{}: could not board", id.as_str()))?;
    let target = floor_y(to as f64);
    let dir = if to > from { DOWN } else { UP };
    for _ in 0..1500 {
        let car = r.w().car(id);
        if (car.y - target).abs() < 24.0 && car.dir != 0 {
            break;
        }
        r.hold(dir, 1);
    }
    r.hold(0, 90);
    must(r.w().car(id).y == target && r.w().car(id).dir == 0, || format!("{}: did not stop level with floor {}", id.as_str(), to))?;
    r.hold(RIGHT, 30);
    must(r.w().player.mode == PlayerMode::Ground && r.w().player.floor == Some(to), || format!("{}: could not step out at {}", id.as_str(), to))?;
    Ok(())
}

pub fn escalate(r: &mut dyn BotRig, e: EscalatorDef, up: bool) -> BotResult {
    walk_to(r, if up { e.x_low } else { e.x_high });
    r.tap(if up { UP } else { DOWN });
    must(r.w().player.mode == PlayerMode::Escalator, || format!("{}: could not board", e.id.as_str()))?;
    r.hold(0, 60);
    must(r.w().player.floor == Some(if up { e.upper } else { e.lower }), || format!("{}: did not arrive", e.id.as_str()))?;
    Ok(())
}

/// Move to a floor from the current floor using whichever shaft / escalator is right (R -> everything).
pub fn go_to_floor(r: &mut dyn BotRig, to: i32) -> BotResult {
    let here = |r: &dyn BotRig| r.w().player.floor.unwrap_or(-1);
    if here(r) == to {
        return Ok(());
    }
    for id in [ShaftId::A, ShaftId::B, ShaftId::C] {
        let s = *SHAFTS.iter().find(|k| k.id == id).unwrap();
        if here(r) >= s.top && here(r) <= s.bottom && to >= s.top && to <= s.bottom {
            return ride(r, id, to);
        }
    }
    // two hops: go to a floor served by both
    for a in SHAFTS.iter() {
        if !(here(r) >= a.top && here(r) <= a.bottom) {
            continue;
        }
        for b in SHAFTS.iter() {
            if !(to >= b.top && to <= b.bottom) {
                continue;
            }
            let lo = a.top.max(b.top);
            let hi = a.bottom.min(b.bottom);
            if lo <= hi {
                ride(r, a.id, lo)?;
                ride(r, b.id, to)?;
                return Ok(());
            }
        }
    }
    Err(BotError(format!("no route from {} to {}", here(r), to)))
}

/// Walk to a store's door and press Up.
pub fn enter_store_door(r: &mut dyn BotRig, id: StoreId) -> BotResult {
    let st = store_def(id);
    go_to_floor(r, st.floor)?;
    walk_to(r, st.x + DOOR_X + DOOR_W / 2.0);
    r.tap(UP);
    Ok(())
}

// ---------------------------------------------------------------- stores
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Cell {
    pub col: i32,
    pub row: i32,
}

fn walkable(room: &Room, col: i32, row: i32) -> bool {
    !is_solid_kind(tile_at(room, col, row))
}

/// BFS over the room's tiles (4-neighbour). Returns the path including start and goal, or None.
pub fn tile_path(room: &Room, from: Cell, goal: impl Fn(Cell) -> bool) -> Option<Vec<Cell>> {
    let key = |c: Cell| (c.row * room.cols + c.col) as usize;
    let n = (room.cols * room.rows) as usize;
    // prev[key] = Some(None) for the start, Some(Some(parent)) for visited cells
    let mut prev: Vec<Option<Option<Cell>>> = vec![None; n];
    prev[key(from)] = Some(None);
    let mut queue: VecDeque<Cell> = VecDeque::new();
    queue.push_back(from);
    while let Some(c) = queue.pop_front() {
        if goal(c) {
            let mut path: Vec<Cell> = Vec::new();
            let mut k = Some(c);
            while let Some(cur) = k {
                path.insert(0, cur);
                k = prev[key(cur)].flatten();
            }
            return Some(path);
        }
        for (dc, dr) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
            let nb = Cell { col: c.col + dc, row: c.row + dr };
            if nb.col < 0 || nb.row < 0 || nb.col >= room.cols || nb.row >= room.rows {
                continue;
            }
            if !walkable(room, nb.col, nb.row) || prev[key(nb)].is_some() {
                continue;
            }
            prev[key(nb)] = Some(Some(c));
            queue.push_back(nb);
        }
    }
    None
}

/// TS `StoreBot`: a store world plus the run it lives in (the per-store state is in `run.level`).
pub trait StoreBot {
    fn world(&self) -> &StoreWorld;
    fn run(&self) -> &Run;
    fn hold(&mut self, held: u32, n: i32);
    fn tap(&mut self, btn: u32);
}

/// TS `w.store`: the level's state of the store the agent is in.
fn store_state(b: &dyn StoreBot) -> &StoreState {
    b.run().level.store(b.world().store_id).expect("store state")
}

fn cell_of(x: f64, y: f64) -> Cell {
    Cell { col: (x / TILE as f64).floor() as i32, row: (y / TILE as f64).floor() as i32 }
}

/// TS truthiness of `world.typewriter` (an empty string is falsy).
fn typewriter_on(w: &StoreWorld) -> bool {
    w.typewriter().map_or(false, |s| !s.is_empty())
}

fn wait_free(b: &mut dyn StoreBot, max: i32) {
    for _ in 0..max {
        let w = b.world();
        let a = &w.agent;
        if a.stun <= 0 && a.hold.is_none() && !typewriter_on(w) && w.search.is_none() {
            return;
        }
        b.hold(0, 1);
    }
}

fn walk_path(b: &mut dyn StoreBot, path: &[Cell]) {
    for c in path.iter().skip(1) {
        let tx = (c.col * TILE) as f64 + TILE as f64 / 2.0;
        let ty = (c.row * TILE) as f64 + TILE as f64 / 2.0;
        for _ in 0..80 {
            let (ax, ay, busy, exited) = {
                let w = b.world();
                (w.agent.x, w.agent.y, w.agent.stun > 0 || w.agent.hold.is_some(), w.exited)
            };
            if exited {
                return;
            }
            if busy {
                b.hold(0, 1);
                continue;
            }
            let dx = tx - ax;
            let dy = ty - ay;
            if dx.abs() <= 1.2 && dy.abs() <= 1.2 {
                break;
            }
            if dy.abs() > 1.2 && dx.abs() <= 3.0 {
                b.hold(if dy > 0.0 { DOWN } else { UP }, 1);
            } else if dx.abs() > 1.2 {
                b.hold(if dx > 0.0 { RIGHT } else { LEFT }, 1);
            } else {
                b.hold(if dy > 0.0 { DOWN } else { UP }, 1);
            }
        }
    }
    b.hold(0, 1);
}

/// Direction button from `last` toward fixture cell (`f_col`, `f_row`).
fn toward_btn(last: Cell, f_col: i32, f_row: i32) -> u32 {
    if f_col > last.col {
        RIGHT
    } else if f_col < last.col {
        LEFT
    } else if f_row > last.row {
        DOWN
    } else {
        UP
    }
}

/// Search the store like a player: walk next to each fixture (nearest first), tap B once, wait for the result,
/// until the package is found; then walk out of the door. Returns true when the package was taken.
pub fn search_store_for_package(b: &mut dyn StoreBot) -> bool {
    let room = b.world().room.clone();
    let start = cell_of(b.world().agent.x, b.world().agent.y);
    let mut order = room.fixtures.clone();
    // stable sort, like Array.prototype.sort
    order.sort_by_key(|f| (f.col - start.col).abs() + (f.row - start.row).abs());
    for f in order {
        if store_state(b).package_taken || b.world().exited {
            break;
        }
        if store_state(b).fixtures[f.index].opened {
            continue;
        }
        wait_free(b, 400);
        let here = cell_of(b.world().agent.x, b.world().agent.y);
        let path = tile_path(&room, here, |c| (c.col - f.col).abs() + (c.row - f.row).abs() == 1 && walkable(&room, c.col, c.row));
        let path = match path {
            Some(p) => p,
            None => continue,
        };
        walk_path(b, &path);
        // face the fixture with a fresh press, then tap B (the world also auto-faces touching fixtures)
        let last = *path.last().unwrap();
        let toward = toward_btn(last, f.col, f.row);
        b.hold(toward, 2);
        b.hold(0, 1);
        b.tap(B);
        let mut i = 0;
        while i < 90 && b.world().search.is_some() {
            b.hold(0, 1);
            i += 1;
        }
        b.hold(0, 4);
        wait_free(b, 600);
    }
    store_state(b).package_taken
}

/// Walk out of the door at the bottom of the room.
pub fn leave_store(b: &mut dyn StoreBot) -> BotResult {
    wait_free(b, 600);
    let room = b.world().room.clone();
    let door = room.door;
    let here = cell_of(b.world().agent.x, b.world().agent.y);
    let path = tile_path(&room, here, |c| c.row == door.row && c.col == door.col);
    if let Some(p) = path {
        walk_path(b, &p);
    }
    let mut i = 0;
    while i < 120 && !b.world().exited {
        b.hold(DOWN, 1);
        i += 1;
    }
    must(b.world().exited, || "could not leave the store".to_string())
}

// ---------------------------------------------------------------- a bot that plays stores like a sensible human
fn line_clear(room: &Room, ax: f64, ay: f64, bx: f64, by: f64) -> bool {
    let steps = ((bx - ax).hypot(by - ay) / 4.0).ceil() as i32;
    for i in 1..steps {
        let x = ax + ((bx - ax) * i as f64) / steps as f64;
        let y = ay + ((by - ay) * i as f64) / steps as f64;
        if is_solid_kind(tile_at(room, (x / TILE as f64).floor() as i32, (y / TILE as f64).floor() as i32)) {
            return false;
        }
    }
    true
}

/// One frame of reflexes: sidestep out of a guard's aim line / an incoming bullet, and shoot a guard that is lined up.
/// Returns the buttons to hold this frame, or None when nothing needs doing.
fn reflexes(b: &dyn StoreBot) -> Option<u32> {
    let w = b.world();
    let a = &w.agent;
    let room = &w.room;
    let is_solid_at = |x: f64, y: f64| is_solid_kind(tile_at(room, (x / TILE as f64).floor() as i32, (y / TILE as f64).floor() as i32));
    // danger: an aiming spy whose line passes through us, or an enemy bullet heading at us
    for g in w.guards.iter() {
        if g.dead || g.kind != GuardKind::Spy || g.aim <= 0 {
            continue;
        }
        let horiz = g.aim_dir == Dir::Left || g.aim_dir == Dir::Right;
        let on_line = if horiz { (g.y - a.y).abs() < 11.0 } else { (g.x - a.x).abs() < 11.0 };
        let ahead = if horiz {
            if g.aim_dir == Dir::Right {
                a.x > g.x
            } else {
                a.x < g.x
            }
        } else if g.aim_dir == Dir::Down {
            a.y > g.y
        } else {
            a.y < g.y
        };
        if on_line && ahead {
            let sides = if horiz { [Dir::Up, Dir::Down] } else { [Dir::Left, Dir::Right] };
            for s in sides {
                let v = s.vec();
                let tx = a.x + v.0 * 12.0;
                let ty = a.y + v.1 * 12.0;
                if !is_solid_at(tx, ty) {
                    return Some(s.bit());
                }
            }
        }
    }
    for bl in w.bullets.iter() {
        if bl.kind != BulletKind::Enemy {
            continue;
        }
        let horiz = bl.vx.abs() > bl.vy.abs();
        let on_line = if horiz { (bl.y - a.y).abs() < 9.0 } else { (bl.x - a.x).abs() < 9.0 };
        let toward = if horiz { (bl.x - a.x) * bl.vx < 0.0 && (bl.x - a.x).abs() < 56.0 } else { (bl.y - a.y) * bl.vy < 0.0 && (bl.y - a.y).abs() < 56.0 };
        if on_line && toward {
            return Some(if horiz {
                if a.y > room.rows as f64 * TILE as f64 / 2.0 {
                    UP
                } else {
                    DOWN
                }
            } else {
                LEFT
            });
        }
    }
    // offence: a guard lined up within range and in the clear: face it and fire
    for g in w.guards.iter() {
        if g.dead {
            continue;
        }
        let dx = g.x - a.x;
        let dy = g.y - a.y;
        let horiz = dy.abs() < 7.0 && dx.abs() < 150.0;
        let vert = dx.abs() < 7.0 && dy.abs() < 120.0;
        if !(horiz || vert) || !line_clear(room, a.x, a.y, g.x, g.y) {
            continue;
        }
        let want = if horiz {
            if dx > 0.0 {
                Dir::Right
            } else {
                Dir::Left
            }
        } else if dy > 0.0 {
            Dir::Down
        } else {
            Dir::Up
        };
        if a.facing != want {
            return Some(want.bit()); // turn toward him (a step, then we fire)
        }
        return Some(A);
    }
    None
}

/// Play a store with reflexes: go for the nearest unsearched fixture, tap B beside it, react to danger every frame.
/// Returns true when the package was taken. Gives up after `max_frames`.
pub fn play_store_smart(b: &mut dyn StoreBot, max_frames: i32) -> bool {
    let room = b.world().room.clone();
    let mut t = 0;
    loop {
        if !(t < max_frames && !b.world().exited && !b.world().died && !store_state(b).package_taken) {
            break;
        }
        let (ax, ay, busy) = {
            let w = b.world();
            let a = &w.agent;
            (a.x, a.y, a.stun > 0 || a.hold.is_some() || typewriter_on(w) || w.search.is_some() || a.dying > 0)
        };
        if busy {
            b.hold(0, 1);
            t += 1;
            continue;
        }
        if let Some(r) = reflexes(b) {
            b.hold(r, 1);
            t += 1;
            continue;
        }
        let here = cell_of(ax, ay);
        let mut best: Option<(Vec<Cell>, crate::game::store::room::FixtureSpot)> = None;
        for f in room.fixtures.iter() {
            if store_state(b).fixtures[f.index].opened {
                continue;
            }
            let path = tile_path(&room, here, |c| (c.col - f.col).abs() + (c.row - f.row).abs() == 1 && walkable(&room, c.col, c.row));
            if let Some(path) = path {
                if best.as_ref().map_or(true, |(bp, _)| path.len() < bp.len()) {
                    best = Some((path, *f));
                }
            }
        }
        let (path, f) = match best {
            Some(x) => x,
            None => break,
        };
        if path.len() == 1 || (path.len() == 2 && (ax - ((path[1].col * TILE) as f64 + 8.0)).hypot(ay - ((path[1].row * TILE) as f64 + 8.0)) < 2.0) {
            // beside the fixture: face it, tap B, wait for the search
            let toward = if f.col > here.col {
                RIGHT
            } else if f.col < here.col {
                LEFT
            } else if f.row > here.row {
                DOWN
            } else {
                UP
            };
            b.hold(toward, 2);
            b.hold(0, 1);
            b.tap(B);
            let mut i = 0;
            while i < 90 && b.world().search.is_some() {
                let rr = reflexes(b);
                b.hold(match rr {
                    Some(m) if m != A => m,
                    _ => 0,
                }, 1);
                i += 1;
            }
            t += 100;
            continue;
        }
        let next = path[1];
        let tx = (next.col * TILE) as f64 + TILE as f64 / 2.0;
        let ty = (next.row * TILE) as f64 + TILE as f64 / 2.0;
        let dx = tx - ax;
        let dy = ty - ay;
        if dx.abs() > 1.2 && (dy.abs() <= 3.0 || dx.abs() > dy.abs()) {
            b.hold(if dx > 0.0 { RIGHT } else { LEFT }, 1);
        } else {
            b.hold(if dy > 0.0 { DOWN } else { UP }, 1);
        }
        t += 1;
    }
    store_state(b).package_taken
}

// ---------------------------------------------------------------- mall reflexes (a sensible new player)
/// Adds the reflexes of a sensible human to the buttons the route script wants to press: shoot a spy that is in front of
/// us on our floor within 150 px, and duck while a spy nearby aims high (when we are not walking).
pub fn mall_reflexes(w: &MallWorld, mask: u32) -> u32 {
    let p = &w.player;
    if p.mode != PlayerMode::Ground || p.floor.is_none() {
        return mask;
    }
    let mut m = mask;
    for s in w.spies.iter() {
        if s.mode == SpyMode::Dying || Some(s.floor) != p.floor {
            continue;
        }
        let dx = s.x - p.x;
        if dx.abs() < 150.0 && p.face == (if dx > 0.0 { 1 } else { -1 }) {
            m |= A;
        }
        if s.mode == SpyMode::Aim && s.aim_high && dx.abs() < 170.0 && mask & (LEFT | RIGHT) == 0 {
            m |= DOWN;
        }
    }
    m
}
