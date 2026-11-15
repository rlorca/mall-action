//! Top-level game state machine (screens agent 2 owns this file): splash -> title -> mall <-> store ->
//! level clear -> ..., plus map, pause, continue and game over overlays.

use crate::events::Event;
use crate::input::PadState;
use crate::pixel::Fb;

#[derive(Clone, Copy, Debug, Default)]
pub struct GameOptions {
    /// Skip the studio splash (debug).
    pub skip_splash: bool,
}

pub struct Game {
    events: Vec<Event>,
}

impl Game {
    pub fn new(_seed: u64, _opts: GameOptions) -> Game {
        Game { events: Vec::new() }
    }
    /// Advance exactly one 60 Hz simulation frame.
    pub fn step(&mut self, _pad: PadState) {}
    pub fn draw(&self, _fb: &mut Fb) {}
    /// Events (sfx / music) produced since the last call.
    pub fn drain_events(&mut self) -> Vec<Event> {
        std::mem::take(&mut self.events)
    }
}
