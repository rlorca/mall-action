//! Test rig for the mall: a Run + MallWorld stepped with synthetic pads. Port of `game/mall/testutil.ts`.
//! (Not `cfg(test)` so other modules' tests, e.g. the bot, can use it.)

use super::geometry::fy;
use super::types::*;
use super::world::{MallOptions, MallWorld};
use crate::audio_ids::SfxId;
use crate::content::layout::ShaftId;
use crate::content::stores::target_stores;
use crate::engine::pad::pad_from_held;
use crate::engine::rng::Rng;
use crate::game::levelstate::{LevelState, StoreState};
use crate::game::run::{Run, RunOpts};

pub use crate::engine::pad::{A, B, DOWN, LEFT, RIGHT, SELECT, START, UP};

/// A level where every target store still holds its package (the store contents themselves are irrelevant to the mall).
pub fn test_level() -> LevelState {
    let mut level = LevelState::new(1, 1, false);
    for s in target_stores() {
        level.set_store(s.id, StoreState { id: s.id, fixtures: Vec::new(), package_taken: false });
    }
    level
}

/// Options of `make_rig` (TS: `MallOptions & { seed, loop, floor, x }`).
#[derive(Clone, Copy, Debug, Default)]
pub struct RigOpts {
    pub seed: Option<u32>,
    pub loop_: Option<i32>,
    pub floor: Option<i32>,
    pub x: Option<f64>,
}

impl RigOpts {
    pub fn new() -> RigOpts {
        RigOpts::default()
    }
    pub fn seed(mut self, v: u32) -> RigOpts {
        self.seed = Some(v);
        self
    }
    pub fn loop_(mut self, v: i32) -> RigOpts {
        self.loop_ = Some(v);
        self
    }
    pub fn floor(mut self, v: i32) -> RigOpts {
        self.floor = Some(v);
        self
    }
    pub fn x(mut self, v: f64) -> RigOpts {
        self.x = Some(v);
        self
    }
}

pub struct Rig {
    pub run: Run,
    pub w: MallWorld,
    /// The buttons held at the end of the previous step (edges are computed from it).
    pub held: u32,
    pub sfx: Vec<SfxId>,
    /// Causes of every death, in order (the world resets `player.cause` on respawn).
    pub causes: Vec<String>,
}

impl Rig {
    /// Hold `held` for n frames (edges computed from the previous call).
    pub fn hold(&mut self, held: u32, n: i32) {
        for _ in 0..n {
            let before = self.w.player.mode;
            let pad = pad_from_held(self.held, held);
            self.w.step(&mut self.run, pad);
            if before != PlayerMode::Dying && self.w.player.mode == PlayerMode::Dying {
                self.causes.push(self.w.player.cause.map_or("None".to_string(), |c| c.as_str().to_string()));
            }
            self.held = held;
            let drained = self.run.drain_sfx();
            self.sfx.extend(drained);
        }
    }

    /// A single press edge for one frame, then release.
    pub fn tap(&mut self, btn: u32) {
        self.hold(btn, 1);
        self.hold(0, 1);
    }

    pub fn idle(&mut self, n: i32) {
        self.hold(0, n);
    }

    /// Like `hold`, but returns the last state of spy `id` seen while it was still in the world. (A TS test keeps its
    /// reference to a spy after the world dropped it; Rust tests look at this snapshot instead.)
    pub fn hold_watch(&mut self, held: u32, n: i32, id: i32) -> Option<Spy> {
        let mut last = self.w.spy_by_id(id).cloned();
        for _ in 0..n {
            self.hold(held, 1);
            if let Some(s) = self.w.spy_by_id(id) {
                last = Some(s.clone());
            }
        }
        last
    }

    pub fn sfx_has(&self, id: SfxId) -> bool {
        self.sfx.contains(&id)
    }

    pub fn sfx_count(&self, id: SfxId) -> usize {
        self.sfx.iter().filter(|s| **s == id).count()
    }
}

pub fn make_rig(opts: RigOpts) -> Rig {
    let seed = opts.seed.unwrap_or(1);
    let mut run = Run::new(seed, RunOpts::default());
    run.loop_ = opts.loop_.unwrap_or(1);
    run.level = test_level();
    let rng = Rng::new(seed);
    let x = opts.x.unwrap_or(100.0);
    let mut w = MallWorld::new(&mut run, rng, MallOptions { skip_intro: true, start_floor: Some(opts.floor.unwrap_or(0)), start_x: Some(x) });
    w.player.x = x;
    Rig { run, w, held: 0, sfx: Vec::new(), causes: Vec::new() }
}

/// Place the agent standing on a floor at x.
pub fn place(rig: &mut Rig, floor: i32, x: f64) {
    let p = &mut rig.w.player;
    p.x = x;
    p.y = fy(floor);
    p.floor = Some(floor);
    p.mode = PlayerMode::Ground;
    p.roof = None;
    p.car = None;
    p.vx = 0.0;
    p.vy = 0.0;
    p.peak_y = p.y;
    p.safe = SafeSpot { x, floor };
    rig.w.snap_camera();
}

pub fn set_car(rig: &mut Rig, id: ShaftId, floor: i32) {
    let c = rig.w.car_mut(id);
    c.y = fy(floor);
    c.prev_y = c.y;
    c.dir = 0;
    c.goal = None;
    c.protect_floor = None;
}
