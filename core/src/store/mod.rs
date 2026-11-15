//! The top-down store rooms (store agent owns this module): templates, fixtures, search, guards, extras.

use crate::events::Out;
use crate::input::PadState;
use crate::pixel::Fb;
use crate::run::RunState;
use crate::types::StoreId;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreOutcome {
    None,
    /// The player walked out through the door: fade back to the mall at this store's door.
    Exit,
    /// The player died in the store and no lives remain.
    OutOfLives,
}

/// Fill `run.fixtures` for every open store (exactly one package per target store, never trapped power-up
/// shops, Black Friday rules). Called at the start of every level.
pub fn setup_level(_run: &mut RunState) {}

pub struct StoreRoom {
    pub id: StoreId,
}

impl StoreRoom {
    pub fn new(id: StoreId, _run: &mut RunState, _out: &mut Out) -> StoreRoom {
        StoreRoom { id }
    }
    pub fn step(&mut self, _pad: PadState, _run: &mut RunState, _out: &mut Out) -> StoreOutcome {
        StoreOutcome::Exit
    }
    /// Draw the room (full screen below the HUD) and its bottom prompt strip.
    pub fn draw(&self, _fb: &mut Fb, _run: &RunState, _tick: u32) {}
    pub fn shake(&self) -> i32 {
        0
    }
}
