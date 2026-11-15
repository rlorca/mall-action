use std::cmp::Ordering;

use crate::art::registry::all_sprites;
use crate::engine::font::{draw_text, TextOpts, FONT_TINY};
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::pad::{btn, Pad};
use crate::engine::palette::c;
use crate::engine::sprite::Sprite;

#[derive(Clone, Copy)]
pub struct Placed {
    pub s: &'static Sprite,
    pub x: i32,
    pub y: i32,
}

/// ICU-like collation key for `localeCompare` on sprite names (lowercase letters, digits, `.`, `_`, `-`):
/// punctuation < digits < letters, case-insensitive first.
fn collate_class(ch: char) -> (u8, u32) {
    // ICU root order of the punctuation we use: '_' < '-' < ',' < ';' < ':' < '!' < '?' < '.' ... then digits, letters.
    match ch {
        ' ' => (0, 0),
        '_' => (1, 0),
        '-' => (1, 1),
        ',' => (1, 2),
        ';' => (1, 3),
        ':' => (1, 4),
        '!' => (1, 5),
        '?' => (1, 6),
        '.' => (1, 7),
        '/' => (1, 8),
        '0'..='9' => (2, ch as u32),
        _ if ch.is_alphabetic() => (3, ch.to_lowercase().next().unwrap() as u32),
        _ => (1, 100 + ch as u32),
    }
}

/// JS `a.localeCompare(b)` (ICU root collation) for the ASCII names used by the registry.
fn locale_compare(a: &str, b: &str) -> Ordering {
    let ka = a.chars().map(collate_class);
    let kb = b.chars().map(collate_class);
    match ka.cmp(kb) {
        Ordering::Equal => {
            // tertiary: lowercase before uppercase
            for (x, y) in a.chars().zip(b.chars()) {
                if x != y {
                    return if x.is_lowercase() { Ordering::Less } else { Ordering::Greater };
                }
            }
            Ordering::Equal
        }
        o => o,
    }
}

/// ?gallery=1: every registered sprite, animated, paged with Left / Right (or A / D).
pub struct Gallery {
    pub frame: i32,
    pub page: usize,
    pub pages: Vec<Vec<Placed>>,
}

impl Default for Gallery {
    fn default() -> Self {
        Gallery::new()
    }
}

impl Gallery {
    pub fn new() -> Gallery {
        let mut sprites: Vec<&'static Sprite> = all_sprites().iter().collect();
        sprites.sort_by(|a, b| locale_compare(&a.name, &b.name)); // stable, like Array.sort
        let mut pages: Vec<Vec<Placed>> = vec![Vec::new()];
        let mut x = 4;
        let mut y = 22;
        let mut row_h = 0;
        for s in sprites {
            let cell_w = s.w.max(s.name.encode_utf16().count() as i32 * 4) + 4;
            if x + cell_w > 254 {
                x = 4;
                y += row_h + 12;
                row_h = 0;
            }
            if y + s.h + 8 > 238 {
                pages.push(Vec::new());
                x = 4;
                y = 22;
                row_h = 0;
            }
            pages.last_mut().unwrap().push(Placed { s, x, y });
            x += cell_w;
            row_h = row_h.max(s.h);
        }
        Gallery { frame: 0, page: 0, pages }
    }

    pub fn step(&mut self, pad: &Pad) {
        self.frame += 1;
        let n = self.pages.len();
        if pad.pressed & btn::RIGHT != 0 {
            self.page = (self.page + 1) % n;
        }
        if pad.pressed & btn::LEFT != 0 {
            self.page = (self.page + n - 1) % n;
        }
    }

    pub fn draw(&self, fb: &mut Framebuffer) {
        fb.clear(c::MDGRAY);
        let mut yy = 0;
        while yy < 240 {
            let mut xx = 0;
            while xx < 256 {
                if ((xx + yy) >> 3) & 1 != 0 {
                    fb.fill_rect(xx, yy, 8, 8, c::GRAY);
                }
                xx += 8;
            }
            yy += 8;
        }
        fb.fill_rect(0, 0, 256, 16, c::BLACK);
        draw_text(fb, &format!("SPRITE GALLERY {}/{}  <- ->", self.page + 1, self.pages.len()), 6, 4, c::WHITE, &TextOpts::default());
        for p in &self.pages[self.page] {
            let f = if p.s.frame_count() > 1 { (self.frame >> 4) % p.s.frame_count() } else { 0 };
            fb.sprite(p.s, p.x, p.y, &BlitOpts::default().frame(f));
            draw_text(fb, &p.s.name, p.x, p.y + p.s.h + 2, c::WHITE, &TextOpts::default().font(&FONT_TINY).shadow(c::BLACK));
        }
    }
}
