//! Generated pixel art. Every sprite is an ASCII [`SpriteDef`] (<= 3 colours + transparent).
//!
//! ## Naming contract (the renderer looks sprites up by these exact names)
//! * A single sprite is `name`; an animation is `name_0`, `name_1`, ... (consecutive, from 0).
//!   Use [`Sprites::anim`] to pick a frame (wraps around) and [`Sprites::frames`] for the count.
//! * Characters face RIGHT in the art; the renderer mirrors for left.
//! * Palette override: the renderer may blit any sprite with another 3-colour palette
//!   (used for recolours), so keep shapes using slot 1/2/3 consistently (1 = main, 2 = shade/detail, 3 = highlight/outline).
//!
//! ### chars.rs  (people, items, HUD)  -- see that file for the exact list
//! ### mall.rs   (side-view environment) -- see that file for the exact list
//! ### storefronts.rs (13 shop windows/doors) -- see that file for the exact list
//! ### rooms.rs   (top-down store themes) -- see that file for the exact list
use crate::pixel::{Sprite, SpriteDef};
use std::collections::HashMap;

pub mod chars;
pub mod mall;
pub mod rooms;
pub mod storefronts;

/// Every sprite definition in the game.
pub fn all_defs() -> Vec<SpriteDef> {
    let mut v = Vec::new();
    v.extend(chars::defs());
    v.extend(mall::defs());
    v.extend(storefronts::defs());
    v.extend(rooms::defs());
    v
}

pub struct Sprites {
    map: HashMap<&'static str, Sprite>,
    missing: Sprite,
}

impl Sprites {
    pub fn new() -> Sprites {
        let mut map = HashMap::new();
        for d in all_defs() {
            let s = Sprite::from_def(&d).unwrap_or_else(|e| panic!("bad sprite: {e}"));
            map.insert(d.name, s);
        }
        let missing = Sprite::from_def(&SpriteDef {
            name: "missing",
            w: 8,
            h: 8,
            pal: [0x24, 0x0F, 0x30],
            art: "12121212\n21212121\n12121212\n21212121\n12121212\n21212121\n12121212\n21212121",
        })
        .unwrap();
        Sprites { map, missing }
    }
    pub fn has(&self, name: &str) -> bool {
        self.map.contains_key(name)
    }
    /// Look up by exact name (a magenta checkerboard if missing, so bugs are visible, never a panic).
    pub fn get(&self, name: &str) -> &Sprite {
        self.map.get(name).unwrap_or(&self.missing)
    }
    /// Number of frames of animation `base` (`base_0`, `base_1`, ...). 0 if it is not an animation.
    pub fn frames(&self, base: &str) -> usize {
        let mut n = 0;
        while self.map.contains_key(format!("{base}_{n}").as_str()) {
            n += 1;
        }
        n
    }
    /// Frame `i` (wrapped) of animation `base`; falls back to the single sprite `base`.
    pub fn anim(&self, base: &str, i: usize) -> &Sprite {
        let n = self.frames(base);
        if n == 0 {
            return self.get(base);
        }
        self.get(&format!("{base}_{}", i % n))
    }
    pub fn names(&self) -> Vec<&'static str> {
        let mut v: Vec<_> = self.map.keys().copied().collect();
        v.sort();
        v
    }
}

impl Default for Sprites {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn all_sprites_valid_unique_and_at_most_three_colours() {
        let mut seen = HashSet::new();
        for d in all_defs() {
            assert!(seen.insert(d.name), "duplicate sprite name {}", d.name);
            let s = Sprite::from_def(&d).unwrap_or_else(|e| panic!("{e}"));
            assert!(s.colours_used() <= 3);
            assert!(d.pal.iter().all(|p| *p < 64));
            assert!(s.px.iter().any(|p| *p != 0), "{} is empty", d.name);
        }
    }
}
