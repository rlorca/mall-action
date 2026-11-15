//! "CONTINUE?" countdown (screens agent 1 owns this file).

use crate::events::Out;
use crate::input::PadState;
use crate::pixel::Fb;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContinueOutcome {
    None,
    /// Start was pressed: use a continue.
    Continue,
    /// The countdown reached zero.
    Expired,
}

pub struct ContinueScreen {}

impl ContinueScreen {
    pub fn new(_continues_left: u32) -> ContinueScreen {
        ContinueScreen {}
    }
    pub fn step(&mut self, _pad: PadState, _out: &mut Out) -> ContinueOutcome {
        ContinueOutcome::Expired
    }
    pub fn draw(&self, _fb: &mut Fb) {}
}
