//! Title screen (screens agent 1 owns this file).

use crate::events::Out;
use crate::input::PadState;
use crate::pixel::Fb;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TitleOutcome {
    None,
    /// Start pressed. `black_friday` is true if the Konami code was entered.
    Start { black_friday: bool },
}

pub struct Title {}

impl Title {
    pub fn new(_high_score: u32) -> Title {
        Title {}
    }
    pub fn step(&mut self, _pad: PadState, _out: &mut Out) -> TitleOutcome {
        TitleOutcome::Start { black_friday: false }
    }
    pub fn draw(&self, _fb: &mut Fb) {}
}
