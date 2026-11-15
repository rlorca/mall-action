use crate::content::stores::StoreId;
use crate::content::themes::ThemeId;
use crate::engine::pad::{mask_of, pad_from_held, BtnName};
use crate::engine::rng::Rng;
use crate::game::levelstate::{FixtureContent, FixtureState, StoreState};
use crate::game::run::{Run, RunOpts};

use super::levelgen::generate_level;
use super::room::{get_room, parse_room, Room};
use super::world::StoreWorld;

/// Shared helpers for the store tests (not a test file, not imported by the game).

/// Drives a world like the input layer would: tracks the previous held mask so `pressed` edges are right.
///
/// Rust port note: the TS `Pilot` held the world; here the world and run are passed in (`Made` wraps all three and
/// offers the same `step` / `hold` / `idle` / `tap` directly).
#[derive(Clone, Copy, Debug, Default)]
pub struct Pilot {
    prev: u32,
}

impl Pilot {
    pub fn new() -> Pilot {
        Pilot { prev: 0 }
    }

    /// One step with exactly these buttons held.
    pub fn step(&mut self, world: &mut StoreWorld, run: &mut Run, names: &[BtnName]) {
        let held = mask_of(names);
        world.step(run, pad_from_held(self.prev, held));
        self.prev = held;
    }

    /// Hold these buttons for n frames.
    pub fn hold(&mut self, world: &mut StoreWorld, run: &mut Run, n: i32, names: &[BtnName]) {
        for _ in 0..n {
            self.step(world, run, names);
        }
    }

    pub fn idle(&mut self, world: &mut StoreWorld, run: &mut Run, n: i32) {
        self.hold(world, run, n, &[]);
    }

    /// Press for exactly one frame, then release for one frame.
    pub fn tap(&mut self, world: &mut StoreWorld, run: &mut Run, names: &[BtnName]) {
        self.step(world, run, names);
        self.step(world, run, &[]);
    }
}

#[derive(Clone, Debug)]
pub struct MakeOpts {
    pub seed: u32,
    pub black_friday: bool,
    pub loop_: i32,
    /// Mark the store as already visited (no first-visit chatter). Default true.
    pub seen: bool,
    /// Keep the room's guards. Default false (most tests want an empty room).
    pub guards: bool,
    /// GameStonk: keep the easter egg. Default false.
    pub egg: bool,
    pub room: Option<Room>,
}

impl Default for MakeOpts {
    fn default() -> MakeOpts {
        MakeOpts { seed: 1, black_friday: false, loop_: 1, seen: true, guards: false, egg: false, room: None }
    }
}

pub struct Made {
    pub run: Run,
    pub world: StoreWorld,
    pub pilot: Pilot,
}

impl Made {
    /// One step with exactly these buttons held.
    pub fn step(&mut self, names: &[BtnName]) {
        self.pilot.step(&mut self.world, &mut self.run, names);
    }
    /// Hold these buttons for n frames.
    pub fn hold(&mut self, n: i32, names: &[BtnName]) {
        self.pilot.hold(&mut self.world, &mut self.run, n, names);
    }
    pub fn idle(&mut self, n: i32) {
        self.pilot.idle(&mut self.world, &mut self.run, n);
    }
    /// Press for exactly one frame, then release for one frame.
    pub fn tap(&mut self, names: &[BtnName]) {
        self.pilot.tap(&mut self.world, &mut self.run, names);
    }
    /// `world.teleportAgent(col, row)`.
    pub fn teleport(&mut self, col: i32, row: i32) {
        self.world.teleport_agent(&self.run, col, row);
    }
    /// `world.teleportAgent(col, row, dx, dy)`.
    pub fn teleport_by(&mut self, col: i32, row: i32, dx: f64, dy: f64) {
        self.world.teleport_agent_by(&self.run, col, row, dx, dy);
    }
}

pub fn make_world(store_id: StoreId, opts: MakeOpts) -> Made {
    let seed = opts.seed;
    let mut run = Run::new(seed, RunOpts { black_friday: opts.black_friday, hi_score: 0 });
    run.loop_ = opts.loop_;
    run.level = generate_level(&mut Rng::new(seed), run.loop_, opts.black_friday);
    if opts.seen {
        run.mark_store_seen(store_id);
    }
    if !opts.egg {
        run.easter_egg_done = true;
    }
    let custom = opts.room.is_some();
    let room = opts.room.unwrap_or_else(|| get_room(store_id).clone());
    if custom {
        run.level.set_store(
            store_id,
            StoreState {
                id: store_id,
                fixtures: room.fixtures.iter().map(|_| FixtureState { content: FixtureContent::Nothing, opened: false }).collect(),
                package_taken: false,
            },
        );
    }
    let mut world = StoreWorld::new(&mut run, store_id, &Rng::new(seed + 1000), Some(room));
    if !opts.guards {
        world.guards.clear();
    }
    Made { run, world, pilot: Pilot::new() }
}

pub fn set_content(made: &mut Made, index: usize, content: FixtureContent) {
    let id = made.world.store_id;
    made.run.level.store_mut(id).unwrap().fixtures[index].content = content;
}

/// A 16x11 room (door bottom centre) from interior rows; rows 1..9 are given, walls are added.
pub fn room_from(interior: &[String], cols: usize) -> Room {
    let wall = "#".repeat(cols);
    let door = format!("{}DD{}", "#".repeat(cols / 2 - 1), "#".repeat(cols / 2 - 1));
    let mut rows: Vec<String> = vec![wall];
    for r in interior {
        rows.push(format!("#{}#", r));
    }
    rows.push(door);
    let refs: Vec<&str> = rows.iter().map(|s| s.as_str()).collect();
    parse_room("custom", ThemeId::Gadgets, &refs).expect("valid custom room")
}

/// An empty open room of any size with the agent start above the door.
/// `extra` overrides interior rows by row index (TS `Record<number, string>`).
pub fn empty_room(cols: usize, rows: usize, extra: &[(usize, &str)]) -> Room {
    let mut interior: Vec<String> = Vec::new();
    for r in 1..rows - 1 {
        let ex = extra.iter().find(|(k, _)| *k == r).map(|(_, v)| *v);
        let mut line = match ex {
            Some(s) => s.to_string(),
            None => ".".repeat(cols - 2),
        };
        if r == rows - 2 && ex.is_none() {
            let mid = cols / 2 - 1;
            line = format!("{}@{}", ".".repeat(mid - 1), ".".repeat(cols - 2 - mid));
        }
        interior.push(line);
    }
    room_from(&interior, cols)
}

pub fn fixture_pos(world: &StoreWorld, i: usize) -> (i32, i32) {
    let f = world.room.fixtures[i];
    (f.col, f.row)
}
