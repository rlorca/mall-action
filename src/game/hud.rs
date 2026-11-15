//! Everything the HUD strip (top 16 px) needs. Built by the Game each frame; drawn by render/hud.rs.
//! Port of `game/hud.ts`.

/// Active timed power-up with a draining bar.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct HudTimed {
    pub name: &'static str,
    /// Fraction 0..1.
    pub frac: f64,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub struct HudData {
    pub score: i32,
    /// Packages collected (0..6).
    pub packages: i32,
    pub lives: i32,
    /// Active timed power-up with a draining bar (fraction 0..1), or None.
    pub timed: Option<HudTimed>,
    pub armor: bool,
    pub radar: bool,
    /// Blink "ALARM" in the HUD.
    pub alarm: bool,
    /// Mall floor index (0..5) lit on the LED panel; None when inside a store.
    pub floor: Option<i32>,
    /// Inside a store: the store name scrolls like a marquee on the LED panel.
    pub marquee: Option<&'static str>,
    /// Sim frame counter (blinking, scrolling).
    pub frame: i32,
}
