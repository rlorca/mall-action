use crate::audio_ids::{MusicId, SfxId};
use crate::engine::pad::Pad;

/// Common shape of the non-gameplay screens (splash, title, level clear, continue,
/// game over, map). The Game steps the active screen, drains its sfx, and moves
/// on when `done` is set. Screens never decide what comes next.
pub trait Screen {
    fn step(&mut self, pad: &Pad);
    fn done(&self) -> bool;
    /// The music this screen wants (None = silence).
    fn music(&self) -> Option<MusicId>;
    /// Take and clear pending sound effects.
    fn drain_sfx(&mut self) -> Vec<SfxId>;
}
