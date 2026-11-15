//! Top-down tiles and sprites (art agent 2). Every themed tile is an opaque 16x16 sprite of at most three
//! colours; characters and specials are small ASCII sprites. Helper modules live in `tiles/`.

use super::manifest::tile_name;
use super::Registry;
use crate::pixel::Sprite;

pub mod cv;
mod chars;
mod specials;
mod themes_a;
mod themes_b;
mod themes_c;

use cv::Cv;

/// Register a 16x16 tile from 16 ASCII rows (digits 1..3 only).
pub(crate) fn tile(r: &mut Registry, theme: &str, kind: &str, cols: [u8; 3], rows: &[&str]) {
    let name = tile_name(theme, kind);
    assert_eq!(rows.len(), 16, "{name}: needs 16 rows");
    for (i, row) in rows.iter().enumerate() {
        assert_eq!(row.chars().count(), 16, "{name}: row {i} is not 16 wide: {row}");
    }
    r.insert(name, Sprite::from_art(rows, cols));
}

/// Register a tile composed on a canvas.
pub(crate) fn tile_cv(r: &mut Registry, theme: &str, kind: &str, cols: [u8; 3], cv: &Cv) {
    r.insert(tile_name(theme, kind), Cv::sprite(&[cv], cols));
}

pub fn register(r: &mut Registry) {
    themes_a::register(r);
    themes_b::register(r);
    themes_c::register(r);
    specials::register(r);
    chars::register(r);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::art::manifest::{THEMES, TILE_KINDS};

    #[test]
    fn every_theme_has_all_ten_distinct_tiles() {
        let mut r = Registry::new();
        register(&mut r);
        for t in THEMES {
            let mut seen: Vec<(&str, &Sprite)> = Vec::new();
            for k in TILE_KINDS {
                let s = r.get(&tile_name(t, k)).unwrap_or_else(|| panic!("missing {t} {k}"));
                assert_eq!((s.w, s.h), (16, 16));
                // tiles are opaque
                assert!(s.frames[0].iter().all(|p| *p != 0), "{t} {k} has transparent pixels");
                for (k2, s2) in &seen {
                    assert!(s.frames[0] != s2.frames[0] || s.colors != s2.colors, "{t}: {k} identical to {k2}");
                }
                seen.push((k, s));
            }
        }
    }

    #[test]
    fn opened_fixtures_differ_from_closed() {
        let mut r = Registry::new();
        register(&mut r);
        for t in THEMES {
            for k in ["fixa", "fixb"] {
                let c = &r[&tile_name(t, k)];
                let o = &r[&tile_name(t, &format!("{k}_o"))];
                let diff = c.frames[0].iter().zip(&o.frames[0]).filter(|(a, b)| a != b).count();
                assert!(diff > 20 || c.colors != o.colors, "{t} {k}: opened look barely differs");
            }
        }
    }
}
