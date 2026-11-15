//! Game over: PA chime, typewriter message, shutters roll down, "GAME OVER" with scores (screens agent 1).

use crate::events::Out;
use crate::input::PadState;
use crate::pixel::Fb;

pub struct GameOver {}

impl GameOver {
    pub fn new(_score: u32, _high_score: u32) -> GameOver {
        GameOver {}
    }
    /// Returns true when finished and the game should go back to the title.
    pub fn step(&mut self, _pad: PadState, _out: &mut Out) -> bool {
        true
    }
    /// `backdrop` is the last gameplay frame the shutters roll down over (None = plain mall backdrop).
    pub fn draw(&self, _fb: &mut Fb, _backdrop: Option<&Fb>) {}
}
