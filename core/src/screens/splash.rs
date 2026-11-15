//! Wrapper that plays the FLICKERSOFT splash module (screens agent 1 owns this file).

use crate::events::Out;
use crate::input::PadState;
use crate::pixel::Fb;

pub struct SplashScreen {}

impl SplashScreen {
    pub fn new() -> SplashScreen {
        SplashScreen {}
    }
    /// Returns true when the splash is finished (or skipped with any button).
    pub fn step(&mut self, _pad: PadState, _out: &mut Out) -> bool {
        true
    }
    pub fn draw(&self, _fb: &mut Fb) {}
}

impl Default for SplashScreen {
    fn default() -> Self {
        SplashScreen::new()
    }
}
