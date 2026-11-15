//! `?gallery=1`: every sprite, animated (art agent 1 owns this file).

use crate::pixel::Fb;

/// Draw gallery page `page` (0-based). Returns the total page count so the host can wrap.
pub fn draw(_fb: &mut Fb, _page: usize, _tick: u32) -> usize {
    1
}
