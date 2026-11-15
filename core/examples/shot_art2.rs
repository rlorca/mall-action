//! Dev tool for art agent 2: tiles, rooms, storefronts, top-down characters.
//!   shot_art2 tiles out.png [scale] | room:<theme idx> out.png | chars out.png | fronts:<tick> out.png | special out.png

use mall_core::art::{self, manifest};
use mall_core::pixel::{pal, Fb};
use mall_core::png;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let what = a.get(1).map(String::as_str).unwrap_or("tiles");
    let out = a.get(2).map(String::as_str).unwrap_or("art2.png");
    let scale: usize = a.get(3).and_then(|s| s.parse().ok()).unwrap_or(3);
    let mut fb = Fb::new();
    fb.clear(pal::DGRAY);
    if what == "tiles" {
        for (row, t) in manifest::THEMES.iter().enumerate() {
            for (col, k) in manifest::TILE_KINDS.iter().enumerate() {
                art::draw_frame(&mut fb, &manifest::tile_name(t, k), 0, 4 + col as i32 * 17, 4 + row as i32 * 17, false);
            }
        }
    } else if let Some(i) = what.strip_prefix("room:") {
        let i: usize = i.parse().unwrap();
        let t = manifest::THEMES[i];
        let n = |k: &str| manifest::tile_name(t, k);
        for ty in 0..11 {
            for tx in 0..16 {
                let k = if ty == 0 {
                    "wall"
                } else if tx == 0 || tx == 15 {
                    "wall"
                } else {
                    if (tx + ty) % 2 == 0 { "floor" } else { "floor2" }
                };
                art::draw_frame(&mut fb, &n(k), 0, tx * 16, 16 + ty * 16, false);
            }
        }
        let place: [(&str, i32, i32); 9] = [("fixa", 3, 2), ("fixa_o", 5, 2), ("fixb", 8, 2), ("fixb_o", 10, 2), ("counter", 12, 2), ("counter", 13, 2), ("decora", 3, 6), ("decorb", 11, 6), ("floor", 0, 0)];
        for (k, x, y) in place {
            art::draw_frame(&mut fb, &n(k), 0, x * 16, 16 + y * 16, false);
        }
        art::draw_frame(&mut fb, "t_door", 0, 7 * 16, 16 + 10 * 16, false);
        art::draw_frame(&mut fb, "agent_td_down", 0, 7 * 16, 16 + 8 * 16, false);
        art::draw_frame(&mut fb, "spy_td_side", 1, 5 * 16, 16 + 6 * 16, false);
    } else if what == "chars" || what == "special" {
        let names: Vec<&str> = if what == "chars" {
            manifest::TOPDOWN.iter().map(|e| e.0).filter(|n| n.contains("_td")).collect()
        } else {
            manifest::TOPDOWN.iter().map(|e| e.0).filter(|n| !n.contains("_td")).collect()
        };
        let mut y = 4;
        for n in names {
            let s = art::get(n);
            for f in 0..s.frame_count() {
                art::draw_frame(&mut fb, n, f, 4 + f as i32 * 18, y, false);
            }
            fb.text_tiny(70, y + 5, n, pal::WHITE);
            y += 18;
        }
    } else if let Some(t) = what.strip_prefix("fronts:") {
        let tick: u32 = t.parse().unwrap_or(0);
        fb.clear(pal::LGRAY);
        for (i, id) in mall_core::types::StoreId::ALL.iter().enumerate() {
            let col = (i % 3) as i32;
            let row = (i / 3) as i32;
            let cleared = false;
            mall_core::art::storefront::draw_storefront(&mut fb, *id, 4 + col * 84, 50 + row * 47, &mall_core::art::storefront::FrontState { cleared, tick, black_friday: false });
        }
    }
    png::save_fb(out, &fb, scale);
    eprintln!("wrote {out}");
}
