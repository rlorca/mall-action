//! The side-scrolling mall (mall agent owns this module): physics, elevators, escalators, spies, lights,
//! NPCs, pickups. Pure rules plus a `draw`.

use crate::events::Out;
use crate::input::PadState;
use crate::pixel::Fb;
use crate::run::RunState;
use crate::types::{Floor, StoreId};

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

pub struct Mall {}

impl Mall {
    /// Start a fresh level: the agent hangs on the zip line.
    pub fn new(_run: &mut RunState, _out: &mut Out) -> Mall {
        Mall {}
    }
    pub fn step(&mut self, _pad: PadState, _run: &mut RunState, _out: &mut Out) -> MallOutcome {
        MallOutcome::None
    }
    /// Draw the mall viewport (below the HUD strip) with every in-world overlay (bubbles, banners).
    pub fn draw(&self, _fb: &mut Fb, _run: &RunState, _tick: u32) {}
    pub fn map_info(&self) -> MapInfo {
        MapInfo { player_floor: Floor::Roof, player_x: 0, car_floor_pos: [0.0; 3] }
    }
    /// The player walked out of a store: stand at that store's door.
    pub fn return_from_store(&mut self, _id: StoreId) {}
    /// After a continue (3 fresh lives): revive where the player fell, invulnerable for a moment.
    pub fn revive_after_continue(&mut self, _run: &mut RunState) {}
    /// Floor shown on the HUD's LED panel.
    pub fn hud_floor(&self) -> Floor {
        Floor::Roof
    }
    /// True while an elevator carries the player (the Game plays the muzak track).
    pub fn riding_elevator(&self) -> bool {
        false
    }
    /// True while the arrival (zip line, landing, selfie) is playing and the HUD should stay quiet.
    pub fn in_arrival(&self) -> bool {
        false
    }
    /// The mall wants the scene to shake this frame (screen shake amount in pixels).
    pub fn shake(&self) -> i32 {
        0
    }
}
