//! Parity with the TS registry: fixtures/sprites-characters-items-mallprops.json holds, for every sprite of the
//! characters / items / mallprops modules, name, w, h, frame count and the FNV-1a hash of each frame's pixel
//! bytes (TRANSPARENT = 255), dumped from the TS source. Rebuild each sprite here and compare.

use super::registry::{all_sprites, get_sprite};
use crate::engine::sprite::Sprite;

const FIXTURE: &str = include_str!("../../fixtures/sprites-characters-items-mallprops.json");

pub fn fnv1a(bytes: &[u8]) -> u32 {
    let mut h: u32 = 0x811c9dc5;
    for &b in bytes {
        h ^= b as u32;
        h = h.wrapping_mul(0x01000193);
    }
    h
}

struct Entry {
    owner: String,
    name: String,
    w: i32,
    h: i32,
    frames: usize,
    hashes: Vec<u32>,
}

/// Minimal reader for the fixed fixture layout (an array of flat objects; no crates allowed).
fn parse_fixture() -> Vec<Entry> {
    let mut out = Vec::new();
    for chunk in FIXTURE.split("\"owner\":").skip(1) {
        let str_field = |key: &str| -> String {
            let k = format!("\"{}\": \"", key);
            let s = chunk.find(&k).unwrap() + k.len();
            let e = s + chunk[s..].find('"').unwrap();
            chunk[s..e].to_string()
        };
        let num_field = |key: &str| -> i64 {
            let k = format!("\"{}\": ", key);
            let s = chunk.find(&k).unwrap() + k.len();
            let e = s + chunk[s..].find(|c: char| !c.is_ascii_digit()).unwrap();
            chunk[s..e].parse().unwrap()
        };
        let owner = {
            let s = chunk.find('"').unwrap() + 1;
            let e = s + chunk[s..].find('"').unwrap();
            chunk[s..e].to_string()
        };
        let hs = chunk.find("\"hashes\": [").unwrap() + "\"hashes\": [".len();
        let he = hs + chunk[hs..].find(']').unwrap();
        let hashes: Vec<u32> = chunk[hs..he].split(',').map(|t| t.trim()).filter(|t| !t.is_empty()).map(|t| t.parse().unwrap()).collect();
        out.push(Entry { owner, name: str_field("name"), w: num_field("w") as i32, h: num_field("h") as i32, frames: num_field("frames") as usize, hashes });
    }
    out
}

fn check(s: &Sprite, e: &Entry) {
    assert_eq!((s.w, s.h), (e.w, e.h), "{} size", e.name);
    assert_eq!(s.frames.len(), e.frames, "{} frame count", e.name);
    for (f, want) in e.hashes.iter().enumerate() {
        assert_eq!(fnv1a(&s.frames[f]), *want, "{} frame {} hash", e.name, f);
    }
}

#[test]
fn every_characters_items_mallprops_sprite_matches_the_ts_registry() {
    let entries = parse_fixture();
    assert_eq!(entries.len(), 68);
    for owner in ["characters", "items", "mallprops"] {
        let n = entries.iter().filter(|e| e.owner == owner).count();
        assert_eq!(n, match owner { "characters" => 25, "items" => 22, _ => 21 });
    }
    for e in &entries {
        check(get_sprite(&e.name), e);
    }
}

#[test]
fn registry_order_matches_ts_insertion_order_for_these_modules() {
    let entries = parse_fixture();
    let names: Vec<&str> = all_sprites().iter().map(|s| s.name.as_str()).collect();
    let mut last = 0usize;
    for e in &entries {
        let i = names.iter().position(|n| *n == e.name).unwrap();
        assert!(i >= last, "{} out of order", e.name);
        last = i;
    }
}
