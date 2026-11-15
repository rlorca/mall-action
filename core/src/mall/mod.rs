//! The side-scrolling mall (mall agent owns this module): physics, elevators, escalators, arrival, exit and
//! the death flow, plus empty hook modules for spies, lights, NPCs and pickups. Pure rules plus a `draw`.
//!
//! # README: how phase 2 plugs in
//!
//! ```text
//! Mall { core: Core, spies: Spies, lights: Lights, npcs: Npcs, pickups: Pickups }
//! ```
//! * `Core` (state.rs) is everything shared: `player`, `cars[3]`, `escs`, `bullets`, `cam`, `banner`,
//!   `effects`, `arrival`. It has the READ-ONLY queries the hooks need:
//!   `player_view()` (floor, x, feet y, facing, ducking, jumping, kicking, hidden, dying, invulnerable,
//!   in_arrival, grounded, riding, on_escalator, hitbox), `car_view(shaft)` (y, dir, level floor, doors,
//!   occupied, rect), `opening(shaft, floor)` (`CarHere` / `GrateAbove` / `PitBelow`, None when the shaft does
//!   not serve the floor), `wall_bounds()`, `near_player(x, y)`, `view_span()`.
//! * Each hook has `new()`, `step(&mut Ctx)`, `draw(fb, cam, run, tick)` and `clear()`. `Mall::step` calls the
//!   hooks AFTER the player and the cars moved: `spies`, `lights`, `npcs`, `pickups`, then bullets vs the
//!   player. `Mall::draw` paints: scene, `lights`, `pickups`, `npcs`, `spies`, the agent, bullets, effects,
//!   banner. `clear()` runs on every respawn (also after a continue).
//! * `Ctx { core, run, out, pad }` is what `step` receives. The hurt-the-player entry point is
//!   `ctx.kill_player(DeathCause::X)`: it applies Cinnabomb, invulnerability, armour (spark + short
//!   invulnerability), lives and the death flow, and returns true only if the player died.
//!   `DeathCause::{Bullet, Spy, Lamp, DiscoBall}` are absorbed by armour; `Crushed` and `Fall` are not.
//!   A kicking player must be handled by the SPY side: if `player_view().kicking` kill the spy, else call
//!   `kill_player(Spy)`.
//! * Shooting: `ctx.core.bullets.fire_enemy(x, y, dir, floor)` (2 px/frame); player bullets are
//!   `Owner::Player`; `bullets.take_hit(rect, Owner::Player)` consumes a player bullet overlapping a spy.
//! * Elevators: `Car` (elevator.rs): `y` is the platform, `dir` (-1/0/+1), `last_move` (px this frame, + down),
//!   `call_to(floor)` (a spy calling a car), `extra_occupants` / `core.set_car_occupants(shaft, n)` (spies
//!   inside: car C will not leave while anyone is inside). To crush a spy on a grate: the spy stands in the
//!   opening with `opening() == GrateAbove` and `car_view().rect` overlaps his box while `dir > 0`.
//! * Geometry: `world.rs` (`CORRIDOR_H`, `opening_state`, `lamp_slots(floor)`, `free_spans`, door/landing
//!   zones) and `layout.rs`. Screen shake: `core.request_shake(frames)`. Score popups/effects: `core.add_effect`.
//! * `core.player.hidden = true` hides the agent from spies (photo booth); `pickups` may set it.

pub mod arrival;
pub mod bullets;
pub mod camera;
pub mod draw;
pub mod elevator;
pub mod escalator;
pub mod lights;
pub mod npcs;
pub mod pickups;
pub mod player;
pub mod spies;
pub mod state;
pub mod world;

#[cfg(test)]
mod tests;

use crate::events::{Out, Track};
use crate::input::PadState;
use crate::layout::{self, floor_y, SHAFTS, SHAFT_W, WALL_L, WALL_R};
use crate::pixel::Fb;
use crate::run::RunState;
use crate::types::{Floor, StoreId};

pub use state::{CarView, Core, Ctx, DeathCause, PlayerView};

use player::Mode;

/// What the Game should do after a mall step.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MallOutcome {
    None,
    /// The player pressed Up at an open store's door: fade into the store.
    EnterStore(StoreId),
    /// Level clear fired (exactly once).
    LevelClear,
    /// The death animation finished and no lives remain (the Game decides continue vs game over).
    OutOfLives,
}

/// Everything the map overlay needs from the mall.
#[derive(Clone, Debug)]
pub struct MapInfo {
    pub player_floor: Floor,
    pub player_x: i32,
    /// For shafts A, B, C: the car's current world y offset expressed as a floor position (0.0 = roof .. 5.0 = P).
    pub car_floor_pos: [f32; 3],
}

pub struct Mall {
    pub core: Core,
    pub spies: spies::Spies,
    pub lights: lights::Lights,
    pub npcs: npcs::Npcs,
    pub pickups: pickups::Pickups,
}

impl Mall {
    /// Start a fresh level: the agent hangs on the zip line.
    pub fn new(run: &mut RunState, out: &mut Out) -> Mall {
        let mut core = Core::new(run);
        let want = core.desired_track(run);
        core.last_track = Some(want);
        out.music(want);
        Mall { core, spies: spies::Spies::new(), lights: lights::Lights::new(), npcs: npcs::Npcs::new(), pickups: pickups::Pickups::new() }
    }

    /// Advance exactly one 60 Hz frame. Does not assume continuous calls (the Game stops stepping the mall while
    /// the player is in a store).
    pub fn step(&mut self, pad: PadState, run: &mut RunState, out: &mut Out) -> MallOutcome {
        self.core.frame = self.core.frame.wrapping_add(1);
        let mut outcome = MallOutcome::None;
        {
            let mut ctx = Ctx { core: &mut self.core, run, out, pad };
            if ctx.core.arrival.is_some() {
                ctx.step_arrival(pad);
                ctx.step_cars(0);
            } else {
                if std::mem::take(&mut ctx.core.debug_kill_pending) {
                    ctx.kill_player(DeathCause::Debug);
                }
                let drive = match ctx.core.player.mode {
                    Mode::Riding { .. } if !ctx.core.player.ride_lock => pad.dy(),
                    _ => 0,
                };
                ctx.step_cars(drive);
                outcome = ctx.step_player(pad);
                ctx.check_crush();
            }
            let riding_esc = matches!(ctx.core.player.mode, Mode::Escalator { .. });
            for (i, e) in ctx.core.escs.iter_mut().enumerate() {
                let on = matches!(ctx.core.player.mode, Mode::Escalator { idx, .. } if idx == i);
                e.step(riding_esc && on);
            }
            self.spies.step(&mut ctx);
            self.lights.step(&mut ctx);
            self.npcs.step(&mut ctx);
            self.pickups.step(&mut ctx);
            ctx.step_bullets();
            let death = ctx.step_death_flow();
            if outcome == MallOutcome::None {
                outcome = death;
            }
            ctx.track_safe_spot();
            ctx.step_effects();
            let (px, py, face) = (ctx.core.player.x, ctx.core.player.y(), ctx.core.player.facing);
            ctx.core.cam.follow(px, py, face);
            ctx.update_audio_state();
        }
        if self.core.take_respawn_flag() {
            self.clear_hooks();
        }
        outcome
    }

    fn clear_hooks(&mut self) {
        self.spies.clear();
        self.lights.clear();
        self.npcs.clear();
        self.pickups.clear();
    }

    /// Draw the mall viewport (below the HUD strip) with every in-world overlay (bubbles, banners).
    pub fn draw(&self, fb: &mut Fb, run: &RunState, tick: u32) {
        draw::draw_mall(self, fb, run, tick);
    }

    pub fn map_info(&self) -> MapInfo {
        let mut car_floor_pos = [0.0; 3];
        for (i, c) in self.core.cars.iter().enumerate() {
            car_floor_pos[i] = c.floor_pos();
        }
        MapInfo { player_floor: self.hud_floor(), player_x: self.core.player.x, car_floor_pos }
    }

    /// The player walked out of a store: stand at that store's door, facing the corridor. The mall world state
    /// persisted while he was away. The music latch is cleared so the next step re-emits the mall track (use
    /// `return_from_store_out` to emit it right away).
    pub fn return_from_store(&mut self, id: StoreId) {
        let x = layout::door_x(id);
        let y = floor_y(id.info().floor);
        let p = &mut self.core.player;
        let invuln = p.invuln;
        p.place(x, y);
        p.invuln = invuln;
        p.facing = if x < layout::WORLD_W / 2 { 1 } else { -1 };
        self.core.last_safe = (x, y);
        self.core.last_track = None;
        self.core.call_wait = 0;
        self.core.cam.snap_to(x, y, self.core.player.facing);
    }

    /// Like `return_from_store`, and re-emits the desired music track immediately.
    pub fn return_from_store_out(&mut self, id: StoreId, run: &RunState, out: &mut Out) {
        self.return_from_store(id);
        let want = self.core.desired_track(run);
        self.core.last_track = Some(want);
        out.music(want);
    }

    /// After a continue (3 fresh lives): revive where the player fell, invulnerable for a moment.
    pub fn revive_after_continue(&mut self, _run: &mut RunState) {
        self.core.respawn(state::RESPAWN_INVULN);
        self.core.take_respawn_flag();
        self.clear_hooks();
    }

    /// Floor shown on the HUD's LED panel.
    pub fn hud_floor(&self) -> Floor {
        if self.core.arrival.is_some() {
            return Floor::Roof;
        }
        world::nearest_floor(self.core.player.y())
    }

    /// True while an elevator carries the player (the Game plays the muzak track).
    pub fn riding_elevator(&self) -> bool {
        matches!(self.core.player.mode, Mode::Riding { .. })
    }

    /// True while the arrival (zip line, landing, selfie) is playing and the HUD should stay quiet.
    pub fn in_arrival(&self) -> bool {
        self.core.arrival.is_some()
    }

    /// Debug/playtest: put the player on `floor` at world x (nudged clear of shafts and escalator wells).
    pub fn debug_teleport(&mut self, floor: Floor, x: i32) {
        let mut x = x.clamp(WALL_L + 4, WALL_R - 4);
        for _ in 0..4 {
            for s in SHAFTS.iter() {
                if s.serves(floor) && x >= s.x - 12 && x < s.x + SHAFT_W + 12 {
                    x = if x < s.center_x() { s.x - 13 } else { s.x + SHAFT_W + 12 };
                }
            }
            for e in layout::ESCALATORS.iter() {
                if (e.upper == floor || e.lower() == floor) && x >= e.x - 10 && x < e.x + layout::ESC_W + 10 {
                    x = e.x - 12;
                }
            }
        }
        let x = x.clamp(WALL_L + 4, WALL_R - 4);
        let y = floor_y(floor);
        self.core.arrival = None;
        self.core.player.place(x, y);
        self.core.last_safe = (x, y);
        self.core.cam.snap_to(x, y, 1);
    }

    /// Debug/playtest: kill the player right now (normal death flow, runs on the next step).
    pub fn debug_kill(&mut self) {
        self.core.debug_kill_pending = true;
    }

    /// Debug/playtest: one-line description of the mall state (player pos, floor, cars...).
    pub fn debug_state(&self) -> String {
        let p = &self.core.player;
        let c = &self.core.cars;
        format!(
            "{} x={} y={} {:?} g={} inv={} cars=[{},{},{}] bul={} f={}",
            self.hud_floor().label(),
            p.x,
            p.y(),
            p.mode,
            p.grounded as u8,
            p.invuln,
            c[0].y,
            c[1].y,
            c[2].y,
            self.core.bullets.list.len(),
            self.core.frame
        )
    }
}

/// Which track the mall wants (exposed for the Game's own bookkeeping).
pub fn track_for(riding: bool, alarm: bool) -> Track {
    if riding {
        Track::Elevator
    } else if alarm {
        Track::Alarm
    } else {
        Track::MallAmbient
    }
}
