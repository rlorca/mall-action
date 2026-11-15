//! Sprite registry. In TS this was a global mutable Map filled by `defineSprites` at import time; here it is a
//! lazily built, immutable table (`init()` is idempotent). Art modules contribute `Vec<Def>` lists (insertion order
//! = registry order = TS import order: characters, items, mallprops, storefronts, storeart; see `art::all_defs`).
//! The manifest test (manifest.rs) checks that every required name exists with the right size, enough frames and
//! at most 3 colours.

use crate::engine::sprite::{parse_sprite, Sprite, SpriteDef};
use std::collections::HashMap;
use std::sync::OnceLock;

/// Owned `SpriteDef` (procedural sprites build their rows at runtime). Same fields as the TS `SpriteDef`:
/// either one frame (`rows`) or several (`frames`); `frames` always holds at least one frame here.
#[derive(Clone, Debug)]
pub struct Def {
    pub name: String,
    pub w: i32,
    pub h: i32,
    pub pal: Vec<(char, u8)>,
    pub frames: Vec<Vec<String>>,
}

impl Def {
    /// Single-frame sprite (TS `rows`).
    pub fn rows(name: &str, w: i32, h: i32, pal: &[(char, u8)], rows: Vec<String>) -> Def {
        Def { name: name.to_string(), w, h, pal: pal.to_vec(), frames: vec![rows] }
    }
    /// Multi-frame sprite (TS `frames`).
    pub fn frames(name: &str, w: i32, h: i32, pal: &[(char, u8)], frames: Vec<Vec<String>>) -> Def {
        Def { name: name.to_string(), w, h, pal: pal.to_vec(), frames }
    }
}

/// Static-data constructor used by the generated tables.
pub fn sd(name: &str, w: i32, h: i32, pal: &[(char, u8)], frames: &[&[&str]]) -> Def {
    Def {
        name: name.to_string(),
        w,
        h,
        pal: pal.to_vec(),
        frames: frames.iter().map(|f| f.iter().map(|r| r.to_string()).collect()).collect(),
    }
}

/// Parse one owned def through the shared engine parser (3-colour rule, exact size checks).
pub fn build_def(d: &Def) -> Sprite {
    let frames: Vec<&[String]> = d.frames.iter().map(|f| f.as_slice()).collect();
    let refs: Vec<Vec<&str>> = frames.iter().map(|f| f.iter().map(|s| s.as_str()).collect()).collect();
    let slices: Vec<&[&str]> = refs.iter().map(|v| v.as_slice()).collect();
    parse_sprite(&SpriteDef { name: &d.name, w: d.w, h: d.h, pal: &d.pal, rows: None, frames: Some(&slices) })
}

struct Registry {
    sprites: Vec<Sprite>,
    index: HashMap<String, usize>, // lookup only; iteration order comes from `sprites`
}

static REGISTRY: OnceLock<Registry> = OnceLock::new();

/// TS `defineSprites` for a whole batch, in order. Panics on a duplicate name.
fn define_sprites(reg: &mut Registry, defs: &[Def]) {
    for d in defs {
        if reg.index.contains_key(&d.name) {
            panic!("duplicate sprite name: {}", d.name);
        }
        reg.index.insert(d.name.clone(), reg.sprites.len());
        reg.sprites.push(build_def(d));
    }
}

fn registry() -> &'static Registry {
    REGISTRY.get_or_init(|| {
        let mut reg = Registry { sprites: Vec::new(), index: HashMap::new() };
        define_sprites(&mut reg, &super::all_defs());
        reg
    })
}

/// Build the registry now (idempotent). Everything else calls this lazily too.
pub fn init() {
    registry();
}

/// TS `getSprite`: panics with `unknown sprite: <name>` like the TS throw.
pub fn get_sprite(name: &str) -> &'static Sprite {
    match try_get_sprite(name) {
        Some(s) => s,
        None => panic!("unknown sprite: {}", name),
    }
}

pub fn try_get_sprite(name: &str) -> Option<&'static Sprite> {
    let r = registry();
    r.index.get(name).map(|&i| &r.sprites[i])
}

/// TS `hasSprite`.
pub fn has_sprite(name: &str) -> bool {
    registry().index.contains_key(name)
}

/// TS `allSprites()` (insertion order).
pub fn all_sprites() -> &'static [Sprite] {
    &registry().sprites
}
