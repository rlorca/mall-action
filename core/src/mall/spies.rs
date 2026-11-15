//! Spies (phase 2): walk, aim, shoot, ride cars, wait at openings.
//!
//! HOOK MODULE (empty for phase 1). `Mall` owns one `Spies` and calls, every frame and in this order:
//! `step(&mut ctx)` from `Mall::step` (after the player and cars), `draw(fb, cam, tick)` from `Mall::draw` (over the scene, under the player), and
//! `clear()` whenever the player respawns (bullets, spies and freezes are wiped).
//!
//! Read the player and the cars through `ctx.core.player_view()` / `ctx.core.car_view(shaft)` /
//! `ctx.core.opening(shaft, floor)`; shoot through `ctx.core.bullets`; hurt the player ONLY through
//! `ctx.kill_player(cause)`; score through `ctx.run.add_score(pts, ctx.out)`; sound through `ctx.out`.
//! World geometry helpers live in `world.rs` and `layout.rs`.

use crate::pixel::Fb;
use crate::run::RunState;

use super::camera::Camera;
use super::state::Ctx;

#[derive(Clone, Debug, Default)]
pub struct Spies {}

impl Spies {
    pub fn new() -> Spies {
        Spies {}
    }

    /// Advance one frame (the player and the elevator cars have already moved this frame).
    pub fn step(&mut self, _ctx: &mut Ctx) {}

    /// Paint into the viewport. World -> screen with `cam.sx(wx)` / `cam.sy(wy)`.
    pub fn draw(&self, _fb: &mut Fb, _cam: &Camera, _run: &RunState, _tick: u32) {}

    /// The player respawned: drop everything that must not survive a death.
    pub fn clear(&mut self) {}
}
