//! All sprites, generated from source (ASCII art + palette). No external assets.
//!
//! * `manifest` lists every required sprite name + size.
//! * `characters`, `items`, `decor` (art agent 1) and `tiles`, `storefront` (art agent 2) register sprites.
//! * `get(name)` returns a sprite; unknown names return a loud magenta placeholder (and the tests fail).

use std::collections::BTreeMap;
use std::sync::OnceLock;

use crate::pixel::{pal, Fb, Sprite};

pub mod characters;
pub mod decor;
pub mod gallery;
pub mod items;
pub mod manifest;
pub mod storefront;
pub mod tiles;

pub type Registry = BTreeMap<String, Sprite>;

fn build() -> Registry {
    let mut r = Registry::new();
    characters::register(&mut r);
    items::register(&mut r);
    decor::register(&mut r);
    tiles::register(&mut r);
    storefront::register(&mut r);
    r
}

pub fn registry() -> &'static Registry {
    static R: OnceLock<Registry> = OnceLock::new();
    R.get_or_init(build)
}

fn placeholder() -> &'static Sprite {
    static P: OnceLock<Sprite> = OnceLock::new();
    P.get_or_init(|| {
        Sprite::from_frames(
            &[&["1212", "2121", "1212", "2121"], &["2121", "1212", "2121", "1212"]],
            [pal::MAGENTA, pal::BLACK, pal::WHITE],
        )
    })
}

/// Look up a sprite by name.
pub fn get(name: &str) -> &'static Sprite {
    registry().get(name).unwrap_or_else(placeholder)
}

pub fn has(name: &str) -> bool {
    registry().contains_key(name)
}

/// Draw a sprite frame by animation clock. `period` = ticks per frame.
pub fn draw(fb: &mut Fb, name: &str, x: i32, y: i32, flip: bool, tick: u32, period: u32) {
    let s = get(name);
    fb.blit(s, s.frame_at(tick, period), x, y, flip);
}

/// Draw a specific frame.
pub fn draw_frame(fb: &mut Fb, name: &str, frame: usize, x: i32, y: i32, flip: bool) {
    fb.blit(get(name), frame, x, y, flip);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_is_complete() {
        let mut problems = Vec::new();
        for (name, w, h, frames) in manifest::all_entries() {
            match registry().get(&name) {
                None => problems.push(format!("missing sprite {name}")),
                Some(s) => {
                    if s.w != w || s.h != h {
                        problems.push(format!("{name}: size {}x{} but manifest says {w}x{h}", s.w, s.h));
                    }
                    if s.frame_count() < frames {
                        problems.push(format!("{name}: {} frames but needs >= {frames}", s.frame_count()));
                    }
                }
            }
        }
        assert!(problems.is_empty(), "{} problems:\n{}", problems.len(), problems.join("\n"));
    }

    #[test]
    fn every_sprite_uses_at_most_three_colors_plus_transparent() {
        for (name, s) in registry() {
            assert!(s.colors_used() <= 3, "{name} uses {} colours", s.colors_used());
            for f in &s.frames {
                assert_eq!(f.len(), s.w * s.h, "{name} frame has the wrong pixel count");
                assert!(f.iter().all(|p| *p <= 3), "{name} has a pixel value above 3");
            }
            for c in s.colors {
                assert!(c < 64, "{name} has an invalid palette index");
            }
        }
    }

    #[test]
    fn sprites_are_not_blank() {
        for (name, s) in registry() {
            for (i, f) in s.frames.iter().enumerate() {
                assert!(f.iter().any(|p| *p != 0), "{name} frame {i} is empty");
            }
        }
    }

    #[test]
    fn unknown_names_get_the_placeholder() {
        assert!(!has("definitely_not_a_sprite"));
        assert_eq!(get("definitely_not_a_sprite").w, 4);
    }
}
