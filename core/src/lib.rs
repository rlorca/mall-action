//! MALL ACTION game core: pure, deterministic, browser-free. Rules, art, audio synthesis and software
//! rendering all live here; the Bevy app only feeds it input and presents its pixels and samples.

pub mod copy;
pub mod events;
pub mod fixed;
pub mod input;
pub mod layout;
pub mod pixel;
pub mod powerup;
pub mod rng;
pub mod run;
pub mod types;
