//! Side-view mall environment art. Sprites are built procedurally from small drawing helpers
//! (the grid is turned into the ASCII art string the pixel pipeline expects), every sprite using
//! at most 3 colours + transparent.
//!
//! Catalogue (name WxH):
//! * tiles: tile_floor_0/1 16x8, tile_slab 16x8, tile_wall_0/1 16x16, tile_ceiling 16x8,
//!   park_floor 16x8, park_slab 16x8, park_wall 16x16, roof_floor 16x8, roof_slab 16x8, roof_rail 16x16
//! * arrival: skyscraper 64x112, anchor_post 12x24, cable_end 8x8, moon 16x16
//! * elevators: car_closed/car_open/car_half 32x40, shaft_back 32x16, shaft_opening 32x40,
//!   shaft_frame_door 32x40, grate 32x8, pit 32x8, shaft_cable 4x16, floor_lamp_0/1 8x8, shaft_top 32x8
//! * escalators: esc_0..3 16x16 (rising right), esc_rail 16x16, esc_landing 16x8
//! * furniture: kiosk 24x32, kiosk_screen_0/1 16x12, photo_booth_0/1 24x32, fountain_0..3 32x24,
//!   bench 24x12, plant_0/1 16x24, lamp 10x16, lamp_wreck 10x8, disco_hang_0..3 12x16,
//!   disco_ball 12x12, pillar 16x48, wagon_0/1 56x24, parking_sign 16x16, exit_sign 16x8,
//!   alarm_light_0/1 8x8, sale_banner 24x8, vent 16x8
//! * title: title_star_0/1 3x3, awning 16x8
use crate::pixel::{c, spr, SpriteDef};

struct G {
    w: i32,
    h: i32,
    px: Vec<u8>,
}

impl G {
    fn new(w: i32, h: i32) -> G {
        G { w, h, px: vec![0; (w * h) as usize] }
    }
    fn set(&mut self, x: i32, y: i32, v: u8) {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.px[(y * self.w + x) as usize] = v;
        }
    }
    fn get(&self, x: i32, y: i32) -> u8 {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.px[(y * self.w + x) as usize]
        } else {
            0
        }
    }
    fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, v: u8) {
        for yy in y..y + h {
            for xx in x..x + w {
                self.set(xx, yy, v);
            }
        }
    }
    fn frame(&mut self, x: i32, y: i32, w: i32, h: i32, v: u8) {
        self.rect(x, y, w, 1, v);
        self.rect(x, y + h - 1, w, 1, v);
        self.rect(x, y, 1, h, v);
        self.rect(x + w - 1, y, 1, h, v);
    }
    fn disc(&mut self, cx: f32, cy: f32, r: f32, v: u8) {
        for y in 0..self.h {
            for x in 0..self.w {
                let dx = x as f32 + 0.5 - cx;
                let dy = y as f32 + 0.5 - cy;
                if dx * dx + dy * dy <= r * r {
                    self.set(x, y, v);
                }
            }
        }
    }
    fn line(&mut self, x0: i32, y0: i32, x1: i32, y1: i32, v: u8) {
        let (dx, dy) = ((x1 - x0).abs(), -(y1 - y0).abs());
        let (sx, sy) = (if x0 < x1 { 1 } else { -1 }, if y0 < y1 { 1 } else { -1 });
        let (mut x, mut y, mut e) = (x0, y0, dx + dy);
        loop {
            self.set(x, y, v);
            if x == x1 && y == y1 {
                break;
            }
            let e2 = 2 * e;
            if e2 >= dy {
                e += dy;
                x += sx;
            }
            if e2 <= dx {
                e += dx;
                y += sy;
            }
        }
    }
    fn each(&mut self, f: impl Fn(i32, i32) -> u8) {
        for y in 0..self.h {
            for x in 0..self.w {
                let v = f(x, y);
                self.px[(y * self.w + x) as usize] = v;
            }
        }
    }
    /// Draw only where the closure returns Some.
    fn paint(&mut self, f: impl Fn(i32, i32) -> Option<u8>) {
        for y in 0..self.h {
            for x in 0..self.w {
                if let Some(v) = f(x, y) {
                    self.px[(y * self.w + x) as usize] = v;
                }
            }
        }
    }
    fn glyph(&mut self, x: i32, y: i32, ch: char, v: u8) {
        let g: [u8; 5] = match ch {
            'P' => [6, 5, 6, 4, 4],
            'H' => [5, 5, 7, 5, 5],
            'O' => [2, 5, 5, 5, 2],
            'T' => [7, 2, 2, 2, 2],
            'E' => [7, 4, 6, 4, 7],
            'X' => [5, 5, 2, 5, 5],
            'I' => [7, 2, 2, 2, 7],
            'F' => [7, 4, 6, 4, 4],
            '7' => [7, 1, 2, 2, 2],
            '0' => [7, 5, 5, 5, 7],
            '%' => [5, 1, 2, 4, 5],
            _ => [0; 5],
        };
        for (ry, row) in g.iter().enumerate() {
            for bx in 0..3 {
                if row & (4 >> bx) != 0 {
                    self.set(x + bx, y + ry as i32, v);
                }
            }
        }
    }
    fn text(&mut self, x: i32, y: i32, s: &str, v: u8) {
        for (i, ch) in s.chars().enumerate() {
            self.glyph(x + i as i32 * 4, y, ch, v);
        }
    }
    fn art(&self) -> &'static str {
        let mut s = String::new();
        for y in 0..self.h {
            for x in 0..self.w {
                s.push(match self.px[(y * self.w + x) as usize] {
                    0 => '.',
                    1 => '1',
                    2 => '2',
                    _ => '3',
                });
            }
            if y + 1 < self.h {
                s.push('\n');
            }
        }
        Box::leak(s.into_boxed_str())
    }
}

fn nm(s: String) -> &'static str {
    Box::leak(s.into_boxed_str())
}

fn def(name: &'static str, pal: [u8; 3], g: &G) -> SpriteDef {
    spr(name, g.w as usize, g.h as usize, pal, g.art())
}

fn hash(a: i32, b: i32) -> i32 {
    let mut h = (a.wrapping_mul(374761393)).wrapping_add(b.wrapping_mul(668265263));
    h = (h ^ (h >> 13)).wrapping_mul(1274126177);
    (h ^ (h >> 16)) & 0x7fff
}

// ---------------------------------------------------------------- tiles

fn floor_tile(variant: i32) -> G {
    // slot1 light pink tile, slot2 darker pink tile, slot3 white shine
    let mut g = G::new(16, 8);
    g.each(|x, y| {
        if y == 0 {
            return 3;
        }
        let left = x < 8;
        if (left && variant == 0) || (!left && variant == 1) {
            1
        } else {
            2
        }
    });
    g.rect(7, 1, 1, 7, 2);
    g.rect(8, 1, 1, 7, 1);
    let o = if variant == 0 { 2 } else { 10 };
    g.set(o, 2, 3);
    g.set(o + 1, 3, 3);
    g.set(o + 2, 4, 3);
    g
}

fn slab() -> G {
    let mut g = G::new(16, 8);
    g.each(|_x, y| if y == 7 { 2 } else { 1 });
    g.rect(0, 0, 16, 1, 3);
    g.rect(7, 2, 1, 4, 2);
    g.rect(15, 2, 1, 4, 2);
    g.rect(0, 3, 16, 1, 2);
    g
}

fn wall(variant: i32) -> G {
    // 1 pastel pink, 2 pink shade, 3 teal trim
    let mut g = G::new(16, 16);
    g.rect(0, 0, 16, 16, 1);
    g.rect(0, 0, 16, 1, 3);
    g.rect(0, 1, 16, 1, 2);
    g.rect(0, 9, 16, 1, 3);
    g.rect(0, 10, 16, 1, 3);
    g.rect(0, 11, 16, 1, 2);
    for y in 12..16 {
        for x in 0..16 {
            g.set(x, y, if (x + y) % 2 == 0 { 2 } else { 1 });
        }
    }
    g.rect(0, 12, 1, 4, 3);
    if variant == 1 {
        for (x, y) in [(4, 5), (12, 5)] {
            g.set(x, y - 1, 2);
            g.set(x - 1, y, 2);
            g.set(x + 1, y, 2);
            g.set(x, y + 1, 2);
        }
    } else {
        g.rect(7, 3, 2, 5, 2);
        g.rect(0, 3, 1, 5, 2);
    }
    g
}

fn ceiling() -> G {
    let mut g = G::new(16, 8);
    g.rect(0, 0, 16, 8, 1);
    g.rect(0, 7, 16, 1, 2);
    g.rect(0, 0, 16, 1, 3);
    g.rect(0, 3, 16, 1, 2);
    g.rect(7, 0, 1, 7, 2);
    g.rect(15, 0, 1, 7, 2);
    g
}

fn park_floor() -> G {
    let mut g = G::new(16, 8);
    g.rect(0, 0, 16, 8, 1);
    g.rect(0, 0, 16, 1, 2);
    g.rect(1, 3, 9, 1, 3);
    for (x, y) in [(11, 2), (13, 5), (3, 5), (6, 6), (14, 3)] {
        g.set(x, y, 2);
    }
    g
}

fn park_slab() -> G {
    let mut g = G::new(16, 8);
    g.rect(0, 0, 16, 8, 2);
    g.rect(0, 0, 16, 1, 1);
    g.rect(0, 4, 16, 1, 1);
    g.rect(8, 0, 1, 4, 1);
    g.rect(4, 4, 1, 4, 1);
    g.rect(12, 4, 1, 4, 1);
    g
}

fn park_wall() -> G {
    let mut g = G::new(16, 16);
    g.rect(0, 0, 16, 16, 1);
    g.rect(0, 7, 16, 1, 2);
    g.rect(7, 0, 1, 7, 2);
    g.rect(3, 8, 1, 2, 2);
    g.rect(11, 8, 1, 2, 2);
    for x in 0..16 {
        for y in 11..14 {
            g.set(x, y, if (x + y) % 4 < 2 { 3 } else { 2 });
        }
    }
    g.rect(0, 14, 16, 2, 2);
    g
}

fn roof_floor() -> G {
    let mut g = G::new(16, 8);
    g.rect(0, 0, 16, 8, 1);
    g.rect(0, 0, 16, 1, 3);
    for i in 0..14 {
        let x = hash(i, 1) % 16;
        let y = 1 + hash(i, 2) % 7;
        g.set(x, y, if i % 2 == 0 { 2 } else { 3 });
    }
    g
}

fn roof_slab() -> G {
    let mut g = G::new(16, 8);
    g.rect(0, 0, 16, 8, 1);
    g.rect(0, 0, 16, 1, 3);
    g.rect(0, 7, 16, 1, 2);
    g.rect(0, 4, 16, 1, 2);
    g.rect(5, 0, 1, 4, 2);
    g.rect(11, 4, 1, 3, 2);
    g
}

fn roof_rail() -> G {
    let mut g = G::new(16, 16);
    g.rect(0, 3, 16, 2, 1);
    g.rect(0, 3, 16, 1, 3);
    g.rect(0, 11, 16, 1, 1);
    for px in [0, 8] {
        g.rect(px, 3, 2, 13, 1);
        g.rect(px + 1, 5, 1, 11, 2);
        g.set(px, 2, 3);
        g.set(px + 1, 2, 2);
    }
    g.rect(0, 5, 16, 1, 2);
    g
}

// ---------------------------------------------------------------- arrival

fn skyscraper() -> G {
    let mut g = G::new(64, 112);
    g.rect(31, 0, 2, 5, 2);
    g.set(31, 0, 3);
    g.set(32, 0, 3);
    g.rect(14, 5, 36, 6, 1);
    g.rect(14, 5, 36, 1, 2);
    g.rect(18, 7, 4, 3, 3);
    g.rect(40, 7, 4, 3, 2);
    g.rect(2, 11, 60, 2, 2);
    g.rect(4, 13, 56, 99, 1);
    g.rect(52, 13, 8, 99, 2);
    g.rect(4, 13, 1, 99, 2);
    for j in 0..10 {
        for i in 0..6 {
            let lit = (i * 5 + j * 11 + i * j * 3) % 7 < 3;
            let (x, y) = (8 + 8 * i, 18 + 9 * j);
            g.rect(x, y, 5, 5, if lit { 3 } else { 2 });
        }
    }
    g.rect(4, 109, 56, 3, 2);
    g
}

fn anchor_post() -> G {
    let mut g = G::new(12, 24);
    g.rect(0, 21, 12, 3, 2);
    g.rect(0, 21, 12, 1, 3);
    g.rect(4, 6, 4, 15, 1);
    g.rect(4, 6, 1, 15, 3);
    g.rect(7, 6, 1, 15, 2);
    g.rect(2, 2, 8, 5, 1);
    g.rect(2, 2, 8, 1, 3);
    g.rect(2, 6, 8, 1, 2);
    g.rect(5, 3, 2, 2, 3);
    g.set(5, 4, 2);
    g.set(6, 4, 2);
    g.set(1, 22, 2);
    g.set(10, 22, 2);
    g
}

fn cable_end() -> G {
    let mut g = G::new(8, 8);
    g.disc(4.0, 4.0, 3.5, 1);
    g.disc(4.0, 4.0, 1.6, 2);
    g.set(3, 3, 3);
    g.set(2, 2, 3);
    g.line(0, 7, 3, 4, 2);
    g
}

fn moon() -> G {
    let mut g = G::new(16, 16);
    g.disc(8.0, 8.0, 7.5, 1);
    g.disc(6.0, 7.0, 6.2, 3);
    g.disc(10.0, 8.0, 5.0, 1);
    for (x, y) in [(10, 5), (11, 9), (8, 11), (12, 12)] {
        g.rect(x, y, 2, 2, 2);
    }
    g
}

// ---------------------------------------------------------------- elevators

fn car(dw: i32) -> G {
    // pal: 1 brass, 2 brown, 3 highlight
    let mut g = G::new(32, 40);
    g.rect(0, 0, 32, 40, 2);
    g.rect(1, 1, 30, 38, 1);
    g.rect(1, 1, 30, 1, 3);
    g.rect(1, 4, 30, 1, 2);
    g.rect(14, 2, 4, 2, 2);
    g.set(15, 2, 3);
    g.set(16, 2, 3);
    let ox = 2 + dw;
    let ow = 28 - 2 * dw;
    if ow > 0 {
        g.rect(ox, 5, ow, 34, 2);
        for x in ox..ox + ow {
            if (x - 2) % 6 == 0 {
                g.rect(x, 6, 1, 26, 1);
            }
        }
        g.rect(ox, 20, ow, 2, 3);
        g.rect(ox, 22, ow, 1, 1);
        g.rect(ox, 33, ow, 5, 1);
        g.rect(ox, 33, ow, 1, 3);
    }
    for (dx, left) in [(2, true), (30 - dw, false)] {
        if dw > 0 {
            g.rect(dx, 5, dw, 34, 1);
            g.rect(if left { dx + dw - 1 } else { dx }, 5, 1, 34, 2);
            if dw >= 6 {
                g.rect(dx + 1, 5, 1, 34, 3);
            }
            if dw >= 10 {
                g.frame(dx + 3, 9, dw - 6, 26, 2);
                g.rect(dx + 4, 10, 1, 24, 3);
            }
        }
    }
    g
}

fn shaft_back() -> G {
    let mut g = G::new(32, 16);
    g.rect(0, 0, 32, 16, 1);
    g.rect(0, 0, 32, 1, 2);
    g.rect(0, 8, 32, 1, 2);
    for x in [3, 27] {
        g.rect(x, 0, 1, 16, 3);
        g.rect(x + 1, 0, 1, 16, 2);
    }
    for (x, y) in [(8, 3), (23, 11), (14, 6), (18, 13)] {
        g.set(x, y, 3);
    }
    g
}

fn shaft_opening() -> G {
    let mut g = G::new(32, 40);
    g.rect(0, 0, 32, 40, 2);
    g.rect(1, 1, 30, 39, 1);
    g.rect(3, 4, 26, 36, 2);
    for x in [7, 24] {
        g.rect(x, 4, 1, 36, 3);
    }
    g
}

fn shaft_frame_door() -> G {
    let mut g = G::new(32, 40);
    g.rect(0, 0, 3, 40, 1);
    g.rect(29, 0, 3, 40, 1);
    g.rect(0, 0, 32, 4, 1);
    g.rect(0, 0, 1, 40, 2);
    g.rect(31, 0, 1, 40, 2);
    g.rect(0, 0, 32, 1, 2);
    g.rect(1, 1, 30, 1, 3);
    g.rect(3, 3, 26, 1, 2);
    g.rect(2, 4, 1, 36, 2);
    g.rect(29, 4, 1, 36, 2);
    g
}

fn grate() -> G {
    let mut g = G::new(32, 8);
    g.each(|x, y| match y {
        0 => 3,
        7 => 1,
        _ => {
            if x % 4 < 2 {
                1
            } else {
                2
            }
        }
    });
    g.rect(0, 3, 32, 1, 1);
    g
}

fn pit() -> G {
    let mut g = G::new(32, 8);
    g.rect(0, 0, 32, 8, 2);
    g.rect(0, 0, 32, 1, 1);
    g.rect(0, 0, 1, 8, 1);
    g.rect(31, 0, 1, 8, 1);
    for (x, y) in [(6, 4), (12, 6), (19, 3), (25, 5)] {
        g.set(x, y, 3);
    }
    g
}

fn shaft_cable() -> G {
    let mut g = G::new(4, 16);
    for y in 0..16 {
        let k = y % 4;
        g.set(1, y, if k < 2 { 1 } else { 2 });
        g.set(2, y, if k < 2 { 2 } else { 1 });
    }
    g.set(1, 0, 3);
    g
}

fn floor_lamp(on: bool) -> G {
    let mut g = G::new(8, 8);
    g.disc(4.0, 4.0, 3.6, if on { 1 } else { 2 });
    if on {
        g.set(3, 3, 3);
        g.set(4, 3, 3);
        g.set(3, 4, 3);
    } else {
        g.set(3, 3, 3);
    }
    g
}

fn shaft_top() -> G {
    let mut g = G::new(32, 8);
    g.rect(0, 0, 32, 8, 1);
    g.rect(0, 0, 32, 1, 3);
    g.rect(0, 7, 32, 1, 2);
    g.disc(16.0, 4.5, 3.4, 2);
    g.disc(16.0, 4.5, 1.4, 3);
    for x in [3, 8, 24, 28] {
        g.set(x, 3, 2);
    }
    g
}

// ---------------------------------------------------------------- escalators

fn esc(frame: i32) -> G {
    let mut g = G::new(16, 16);
    g.paint(|x, y| {
        let d = y - (15 - x);
        match d {
            0..=4 => {
                let k = (x + 4 - frame) % 4;
                Some(match (d, k) {
                    (0, _) => 3,
                    (_, 0) => 3,
                    (_, 1) => 2,
                    _ => 1,
                })
            }
            5..=8 => Some(2),
            _ => None,
        }
    });
    g
}

fn esc_rail() -> G {
    let mut g = G::new(16, 16);
    g.paint(|x, y| {
        let d = y - (15 - x);
        match d {
            -1 => Some(3),
            0 | 1 => Some(1),
            2 => Some(2),
            _ => None,
        }
    });
    g
}

fn esc_landing() -> G {
    let mut g = G::new(16, 8);
    g.rect(0, 0, 16, 8, 1);
    g.rect(0, 0, 16, 1, 3);
    for x in (0..16).step_by(2) {
        g.rect(x, 2, 1, 4, 2);
    }
    g.rect(0, 7, 16, 1, 2);
    g
}

// ---------------------------------------------------------------- furniture

fn kiosk() -> G {
    // 1 teal, 2 dark, 3 white
    let mut g = G::new(24, 32);
    g.rect(2, 0, 20, 25, 1);
    g.frame(2, 0, 20, 25, 2);
    g.rect(4, 2, 16, 3, 2);
    for x in (6..18).step_by(3) {
        g.set(x, 3, 3);
    }
    g.rect(4, 6, 16, 16, 3);
    g.frame(4, 6, 16, 16, 2);
    for (x, y, w, h) in [(6, 8, 5, 3), (13, 8, 5, 3), (6, 13, 5, 3), (13, 13, 5, 3)] {
        g.rect(x, y, w, h, 2);
    }
    g.rect(6, 18, 12, 2, 1);
    g.rect(9, 25, 6, 4, 1);
    g.rect(9, 25, 1, 4, 3);
    g.rect(4, 29, 16, 3, 2);
    g.rect(4, 29, 16, 1, 1);
    g
}

fn kiosk_screen(f: i32) -> G {
    let mut g = G::new(16, 12);
    g.rect(0, 0, 16, 12, 1);
    for (x, y, w, h) in [(1, 1, 5, 3), (9, 1, 6, 3), (1, 7, 5, 4), (9, 7, 6, 4)] {
        g.rect(x, y, w, h, 2);
    }
    if f == 1 {
        g.rect(7, 5, 2, 2, 3);
    }
    g
}

fn photo_booth(feet: bool) -> G {
    // 1 pink body, 2 dark, 3 white
    let mut g = G::new(24, 32);
    g.rect(1, 1, 22, 31, 1);
    g.frame(1, 1, 22, 31, 2);
    g.rect(2, 2, 20, 6, 2);
    g.text(3, 3, "PHOTO", 3);
    g.rect(3, 9, 2, 22, 2);
    g.rect(19, 9, 2, 22, 2);
    let bottom = if feet { 26 } else { 30 };
    g.rect(5, 9, 14, bottom - 9 + 1, 2);
    for x in (6..19).step_by(3) {
        g.rect(x, 10, 1, bottom - 10, 1);
    }
    g.rect(5, 9, 14, 1, 3);
    if feet {
        g.rect(7, 28, 4, 3, 3);
        g.rect(13, 28, 4, 3, 3);
    }
    g
}

fn fountain(f: i32) -> G {
    // 1 stone, 2 water, 3 spray
    let mut g = G::new(32, 24);
    g.rect(0, 17, 32, 7, 1);
    g.rect(0, 17, 32, 1, 3);
    g.rect(0, 23, 32, 1, 2);
    for x in (3..30).step_by(6) {
        g.rect(x, 19, 1, 4, 2);
    }
    g.rect(2, 14, 28, 3, 2);
    g.rect(1, 16, 30, 1, 2);
    g.paint(|x, y| if y == 15 && (x + f) % 4 == 0 { Some(3) } else { None });
    g.rect(14, 8, 4, 7, 1);
    g.rect(14, 8, 1, 7, 3);
    g.rect(10, 7, 12, 2, 1);
    g.rect(10, 7, 12, 1, 3);
    g.rect(12, 9, 8, 1, 2);
    let jet = 2 + (f % 4);
    g.rect(15, 6 - jet, 2, jet, 3);
    for dir in [-1.0f32, 1.0] {
        for i in 0..5 {
            let tt = ((i * 4 + f) % 16) as f32;
            let x = 15.5 + dir * (tt * 0.85 + 1.0);
            let y = 6.0 - tt + tt * tt / 12.0;
            g.set(x as i32, y as i32, 3);
        }
    }
    g
}

fn bench() -> G {
    // 1 wood, 2 dark wood, 3 light wood
    let mut g = G::new(24, 12);
    g.rect(0, 0, 24, 2, 1);
    g.rect(0, 0, 24, 1, 3);
    g.rect(0, 3, 24, 2, 1);
    g.rect(0, 3, 24, 1, 3);
    g.rect(1, 0, 1, 7, 2);
    g.rect(22, 0, 1, 7, 2);
    g.rect(0, 6, 24, 2, 1);
    g.rect(0, 6, 24, 1, 3);
    g.rect(0, 8, 24, 1, 2);
    g.rect(2, 8, 2, 4, 2);
    g.rect(20, 8, 2, 4, 2);
    g
}

fn plant(variant: i32) -> G {
    // 1 leaf, 2 dark leaf/soil, 3 pot
    let mut g = G::new(16, 24);
    g.rect(4, 17, 8, 2, 3);
    g.rect(5, 19, 6, 5, 3);
    g.rect(10, 19, 1, 5, 2);
    g.rect(4, 17, 8, 1, 2);
    g.rect(7, 12, 2, 6, 2);
    let blobs: &[(f32, f32, f32)] = if variant == 0 {
        &[(8.0, 6.0, 5.0), (4.5, 9.0, 3.6), (11.5, 9.0, 3.6), (8.0, 11.0, 3.0)]
    } else {
        &[(8.0, 4.0, 3.6), (4.0, 8.0, 3.8), (12.0, 7.0, 3.8), (8.0, 10.5, 3.5), (6.0, 13.0, 2.4)]
    };
    for (cx, cy, r) in blobs {
        g.disc(*cx, *cy, *r, 1);
    }
    for y in 0..17 {
        for x in 0..16 {
            if g.get(x, y) == 1 && ((x + y * 2) % 5 == 0 || (x > 9 && (x + y) % 2 == 0)) {
                g.set(x, y, 2);
            }
        }
    }
    g
}

fn lamp() -> G {
    // 1 pink shade, 2 dark, 3 bulb glow
    let mut g = G::new(10, 16);
    g.rect(4, 0, 2, 7, 2);
    for y in 6..12 {
        let half = (1 + (y - 6)).min(5);
        g.rect(5 - half, y, half * 2, 1, 1);
    }
    g.rect(0, 12, 10, 1, 2);
    g.rect(2, 13, 6, 2, 3);
    g.rect(3, 15, 4, 1, 3);
    g.set(5, 8, 3);
    g.set(4, 9, 3);
    g
}

fn lamp_wreck() -> G {
    let mut g = G::new(10, 8);
    for (x, y, w) in [(0, 6, 3), (3, 5, 2), (5, 6, 3), (8, 4, 2), (2, 7, 5)] {
        g.rect(x, y, w, 1, 1);
    }
    g.set(1, 5, 1);
    g.set(7, 5, 1);
    g.set(4, 4, 2);
    g.set(6, 3, 2);
    g.set(9, 7, 2);
    g.set(0, 7, 2);
    for (x, y) in [(3, 6), (7, 7), (5, 2), (2, 3)] {
        g.set(x, y, 3);
    }
    g.rect(3, 7, 2, 1, 2);
    g
}

fn disco(f: i32, hang: bool) -> G {
    let mut g = if hang { G::new(12, 16) } else { G::new(12, 12) };
    let oy = if hang { 4 } else { 0 };
    if hang {
        g.rect(5, 0, 2, 4, 2);
    }
    g.disc(6.0, oy as f32 + 6.0, 6.0, 1);
    for y in oy..oy + 12 {
        for x in 0..12 {
            if g.get(x, y) != 0 {
                if (x + y) % 3 == 0 {
                    g.set(x, y, 2);
                }
                if (x * 3 + y * 5 + f * 7) % 11 == 0 {
                    g.set(x, y, 3);
                }
            }
        }
    }
    g.set(3, oy + 3, 3);
    g
}

fn pillar() -> G {
    let mut g = G::new(16, 48);
    g.rect(0, 0, 16, 48, 1);
    g.rect(12, 0, 4, 48, 2);
    g.rect(0, 0, 1, 48, 2);
    g.rect(0, 0, 16, 2, 2);
    g.rect(2, 2, 10, 1, 1);
    g.rect(0, 20, 16, 1, 2);
    for y in 34..48 {
        for x in 0..16 {
            g.set(x, y, if (x + y) % 6 < 3 { 3 } else { 2 });
        }
    }
    g.rect(0, 33, 16, 1, 2);
    g
}

fn wagon(f: i32) -> G {
    // 1 wood, 2 black (glass, tyres, shadow), 3 tan/chrome
    let mut g = G::new(56, 24);
    let dy = -f;
    g.rect(10, 2 + dy, 29, 2, 3);
    for y in 4..9 {
        let right = 39 + (y - 4) * 2;
        g.rect(8, y + dy, right - 8 + 1, 1, 3);
    }
    g.rect(11, 4 + dy, 12, 5, 2);
    g.rect(25, 4 + dy, 12, 5, 2);
    g.rect(13, 5 + dy, 3, 1, 3);
    g.rect(27, 5 + dy, 3, 1, 3);
    g.rect(1, 9 + dy, 53, 1, 3);
    g.rect(1, 10 + dy, 54, 8, 1);
    g.rect(3, 12 + dy, 46, 1, 2);
    g.rect(3, 16 + dy, 46, 1, 2);
    for x in [3, 16, 29, 42, 49] {
        g.rect(x, 12 + dy, 1, 5, 2);
    }
    for (x, y) in [(7, 14), (10, 13), (21, 15), (34, 14), (38, 13), (45, 15)] {
        g.set(x, y + dy, 2);
    }
    g.rect(49, 10 + dy, 6, 2, 3);
    g.rect(0, 17 + dy, 4, 2, 3);
    g.rect(52, 17 + dy, 4, 2, 3);
    g.rect(53, 11 + dy, 2, 2, 3);
    g.rect(2, 18 + dy, 52, 2, 2);
    for cx in [13.0f32, 42.0] {
        g.disc(cx, 19.0, 4.2, 2);
        g.disc(cx, 19.0, 2.2, 3);
        g.disc(cx, 19.0, 0.9, 2);
    }
    g
}

fn parking_sign() -> G {
    let mut g = G::new(16, 16);
    g.rect(0, 0, 16, 16, 1);
    g.frame(0, 0, 16, 16, 2);
    g.frame(1, 1, 14, 14, 3);
    g.rect(5, 3, 2, 10, 3);
    g.rect(5, 3, 6, 2, 3);
    g.rect(9, 3, 2, 6, 3);
    g.rect(5, 7, 6, 2, 3);
    g
}

fn exit_sign() -> G {
    let mut g = G::new(16, 8);
    g.rect(0, 0, 16, 8, 1);
    g.rect(0, 0, 16, 1, 2);
    g.rect(0, 7, 16, 1, 2);
    g.text(0, 1, "EXIT", 3);
    g
}

fn alarm_light(on: bool) -> G {
    let mut g = G::new(8, 8);
    g.disc(4.0, 5.0, 3.0, if on { 1 } else { 2 });
    g.rect(0, 6, 8, 2, 2);
    if on {
        g.set(3, 3, 3);
        g.set(2, 4, 3);
        g.set(0, 1, 3);
        g.set(7, 1, 3);
        g.set(4, 0, 3);
    } else {
        g.set(3, 3, 1);
    }
    g
}

fn sale_banner() -> G {
    let mut g = G::new(24, 8);
    g.rect(0, 0, 24, 7, 1);
    g.rect(0, 0, 24, 1, 2);
    for x in (0..24).step_by(4) {
        g.rect(x, 7, 2, 1, 1);
    }
    g.text(1, 1, "70%", 3);
    g.text(13, 1, "OFF", 3);
    g
}

fn vent() -> G {
    let mut g = G::new(16, 8);
    g.rect(0, 0, 16, 8, 1);
    g.frame(0, 0, 16, 8, 2);
    for y in [2, 4, 6] {
        g.rect(2, y, 12, 1, 2);
        g.rect(2, y - 1, 12, 1, 3);
    }
    g
}

fn star(f: i32) -> G {
    let mut g = G::new(3, 3);
    if f == 0 {
        g.set(1, 0, 1);
        g.set(0, 1, 1);
        g.set(1, 1, 3);
        g.set(2, 1, 1);
        g.set(1, 2, 1);
    } else {
        g.set(1, 1, 1);
        g.set(0, 0, 2);
        g.set(2, 0, 2);
        g.set(0, 2, 2);
        g.set(2, 2, 2);
    }
    g
}

fn awning() -> G {
    // 1 red, 2 white, 3 dark red
    let mut g = G::new(16, 8);
    g.each(|x, _| if (x / 4) % 2 == 0 { 1 } else { 2 });
    g.rect(0, 0, 16, 1, 3);
    g.rect(0, 6, 16, 1, 3);
    for x in 0..16 {
        let k = x % 4;
        if k == 0 || k == 3 {
            g.set(x, 7, 0);
        } else {
            g.set(x, 7, if (x / 4) % 2 == 0 { 1 } else { 2 });
        }
    }
    g
}

pub fn defs() -> Vec<SpriteDef> {
    use c::*;
    let mut v: Vec<SpriteDef> = Vec::new();
    let floor_pal = [PINK_L, PINK, WHITE];
    v.push(def("tile_floor_0", floor_pal, &floor_tile(0)));
    v.push(def("tile_floor_1", floor_pal, &floor_tile(1)));
    v.push(def("tile_slab", [TEAL, TEAL_D, CYAN_L], &slab()));
    v.push(def("tile_wall_0", [PINK_L, PINK, TEAL], &wall(0)));
    v.push(def("tile_wall_1", [PINK_L, PINK, TEAL], &wall(1)));
    v.push(def("tile_ceiling", [GRAY_L, GRAY, GRAY_D], &ceiling()));
    v.push(def("park_floor", [GRAY_D, BLACK, YELLOW], &park_floor()));
    v.push(def("park_slab", [GRAY_D, GRAY, GRAY], &park_slab()));
    v.push(def("park_wall", [GRAY, GRAY_D, YELLOW], &park_wall()));
    v.push(def("roof_floor", [GRAY, GRAY_D, GRAY_L], &roof_floor()));
    v.push(def("roof_slab", [GRAY, GRAY_D, GRAY_L], &roof_slab()));
    v.push(def("roof_rail", [GRAY_L, GRAY_D, WHITE], &roof_rail()));
    v.push(def("skyscraper", [BLUE_D, BLACK, YELLOW], &skyscraper()));
    v.push(def("anchor_post", [GRAY, GRAY_D, WHITE], &anchor_post()));
    v.push(def("cable_end", [GRAY_L, GRAY_D, WHITE], &cable_end()));
    v.push(def("moon", [YELLOW_L, TAN, WHITE], &moon()));
    let brass = [ORANGE, BROWN, YELLOW_L];
    v.push(def("car_closed", brass, &car(14)));
    v.push(def("car_open", brass, &car(3)));
    v.push(def("car_half", brass, &car(7)));
    v.push(def("shaft_back", [GRAY_D, BLACK, GRAY], &shaft_back()));
    v.push(def("shaft_opening", [ORANGE, BLACK, GRAY_D], &shaft_opening()));
    v.push(def("shaft_frame_door", [ORANGE, BROWN, YELLOW_L], &shaft_frame_door()));
    v.push(def("grate", [GRAY, BLACK, GRAY_L], &grate()));
    v.push(def("pit", [GRAY_D, BLACK, GRAY], &pit()));
    v.push(def("shaft_cable", [GRAY, GRAY_D, WHITE], &shaft_cable()));
    v.push(def("floor_lamp_0", [RED_D, BLACK, GRAY], &floor_lamp(false)));
    v.push(def("floor_lamp_1", [YELLOW, BLACK, WHITE], &floor_lamp(true)));
    v.push(def("shaft_top", [GRAY, BLACK, GRAY_L], &shaft_top()));
    for f in 0..4 {
        v.push(def(nm(format!("esc_{f}")), [GRAY, GRAY_D, GRAY_L], &esc(f)));
    }
    v.push(def("esc_rail", [GRAY_D, BLACK, GRAY_L], &esc_rail()));
    v.push(def("esc_landing", [GRAY, GRAY_D, GRAY_L], &esc_landing()));
    v.push(def("kiosk", [TEAL, TEAL_D, WHITE], &kiosk()));
    v.push(def("kiosk_screen_0", [WHITE, BLUE, RED], &kiosk_screen(0)));
    v.push(def("kiosk_screen_1", [WHITE, BLUE, RED], &kiosk_screen(1)));
    v.push(def("photo_booth_0", [MAGENTA_L, ROSE_D, WHITE], &photo_booth(false)));
    v.push(def("photo_booth_1", [MAGENTA_L, ROSE_D, WHITE], &photo_booth(true)));
    for f in 0..4 {
        v.push(def(nm(format!("fountain_{f}")), [GRAY_L, BLUE_L, WHITE], &fountain(f)));
    }
    v.push(def("bench", [BROWN, BROWN_D, ORANGE], &bench()));
    v.push(def("plant_0", [GREEN, GREEN_D, ORANGE], &plant(0)));
    v.push(def("plant_1", [GREEN, GREEN_D, ORANGE], &plant(1)));
    v.push(def("lamp", [PINK, ROSE_D, YELLOW_L], &lamp()));
    v.push(def("lamp_wreck", [PINK, ROSE_D, YELLOW_L], &lamp_wreck()));
    for f in 0..4 {
        v.push(def(nm(format!("disco_hang_{f}")), [GRAY, GRAY_D, WHITE], &disco(f, true)));
    }
    v.push(def("disco_ball", [GRAY, GRAY_D, WHITE], &disco(1, false)));
    v.push(def("pillar", [GRAY, GRAY_D, YELLOW], &pillar()));
    v.push(def("wagon_0", [BROWN, BLACK, TAN], &wagon(0)));
    v.push(def("wagon_1", [BROWN, BLACK, TAN], &wagon(1)));
    v.push(def("parking_sign", [BLUE, WHITE, BLUE_D], &parking_sign()));
    v.push(def("exit_sign", [GREEN, GREEN_D, WHITE], &exit_sign()));
    v.push(def("alarm_light_0", [RED, RED_D, YELLOW_L], &alarm_light(false)));
    v.push(def("alarm_light_1", [RED, RED_D, YELLOW_L], &alarm_light(true)));
    v.push(def("sale_banner", [RED, RED_D, WHITE], &sale_banner()));
    v.push(def("vent", [GRAY_L, GRAY_D, WHITE], &vent()));
    v.push(def("title_star_0", [WHITE, SKY, BLACK], &star(0)));
    v.push(def("title_star_1", [WHITE, SKY, BLACK], &star(1)));
    v.push(def("awning", [RED, WHITE, RED_D], &awning()));
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn required_sprites_exist_with_exact_sizes() {
        let d = defs();
        let size = |n: &str| d.iter().find(|s| s.name == n).map(|s| (s.w, s.h));
        let mut req: Vec<(String, usize, usize)> = Vec::new();
        let mut add = |n: &str, w: usize, h: usize| req.push((n.to_string(), w, h));
        for n in ["tile_floor_0", "tile_floor_1", "tile_slab", "tile_ceiling", "park_floor", "park_slab", "roof_floor", "roof_slab", "esc_landing", "vent", "awning", "exit_sign"] {
            add(n, 16, 8);
        }
        for n in ["tile_wall_0", "tile_wall_1", "park_wall", "roof_rail", "moon", "esc_rail", "parking_sign"] {
            add(n, 16, 16);
        }
        add("skyscraper", 64, 112);
        add("anchor_post", 12, 24);
        add("cable_end", 8, 8);
        for n in ["car_closed", "car_open", "car_half", "shaft_opening", "shaft_frame_door"] {
            add(n, 32, 40);
        }
        add("shaft_back", 32, 16);
        add("grate", 32, 8);
        add("pit", 32, 8);
        add("shaft_top", 32, 8);
        add("shaft_cable", 4, 16);
        add("kiosk", 24, 32);
        add("photo_booth_0", 24, 32);
        add("photo_booth_1", 24, 32);
        add("bench", 24, 12);
        add("lamp", 10, 16);
        add("lamp_wreck", 10, 8);
        add("disco_ball", 12, 12);
        add("pillar", 16, 48);
        add("sale_banner", 24, 8);
        for i in 0..2 {
            add(&format!("floor_lamp_{i}"), 8, 8);
            add(&format!("alarm_light_{i}"), 8, 8);
            add(&format!("kiosk_screen_{i}"), 16, 12);
            add(&format!("plant_{i}"), 16, 24);
            add(&format!("wagon_{i}"), 56, 24);
            add(&format!("title_star_{i}"), 3, 3);
        }
        for i in 0..4 {
            add(&format!("esc_{i}"), 16, 16);
            add(&format!("fountain_{i}"), 32, 24);
            add(&format!("disco_hang_{i}"), 12, 16);
        }
        for (n, w, h) in req {
            assert_eq!(size(&n), Some((w, h)), "{n}");
        }
    }
}
