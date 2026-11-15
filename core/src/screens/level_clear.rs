//! Level clear sequence: parking garage chase, tally, THE DAILY MALL front page, mission-complete SPYGRAM
//! post (screens agent 1 owns this file).

use crate::events::Out;
use crate::input::PadState;
use crate::pixel::Fb;

pub struct LevelClear {}

impl LevelClear {
    /// `packages` collected, `time_bonus` and `clear_bonus` points already awarded, `loop_no` just finished.
    pub fn new(_packages: u32, _time_bonus: u32, _clear_bonus: u32, _loop_no: u32, _seed: u64) -> LevelClear {
        LevelClear {}
    }
    /// Returns true when the sequence is over (Start skips ahead stage by stage) and the next loop should begin.
    pub fn step(&mut self, _pad: PadState, _out: &mut Out) -> bool {
        true
    }
    pub fn draw(&self, _fb: &mut Fb) {}
}
