//! Storefront art: window displays, doors and trim for the 13 mall stores.
//!
//! The art is *drawn by code* into tiny 3-slot grids ([`G`]) and converted to
//! [`SpriteDef`]s (so every sprite is <= 3 colours + transparent by construction).
//!
//! Catalogue (name: size):
//! * Windows (32x28, opaque, 1..=3 frames `_0.._n`), `sf_<slug>_l_<n>` and `sf_<slug>_r_<n>`:
//!   `forever12` l:2 r:1, `radioshock` l:3 r:1, `crookstone` l:1 r:1, `gamestonk` l:2 r:2,
//!   `kgbtoys` l:1 r:1, `bbv` l:1 r:1 (closed), `spenders` l:3 r:3, `sambaddy` l:1 r:2,
//!   `sharper` l:2 r:3, `hotspy` l:2 r:1, `circuitpity` l:1 r:1 (closed), `footlock` l:1 r:1,
//!   `borderline` l:1 r:1 (closed).
//! * Doors (16x28): `sf_door_target_0` (bright red), `sf_door_target_1` (dark red blink frame),
//!   `sf_door_power` (blue), `sf_door_dark` (package taken), `sf_door_shutter` (closed store).
//! * Extras: `sf_shutter_32` (32x28), `sf_sale70` (28x10), `sf_pillar` (8x40), `sf_sign_cap` (4x10).
use crate::font::draw_tiny;
use crate::pixel::{c, rgb, Canvas, SpriteDef};

/// A tiny paint grid; values 1..=3 are palette slots.
struct G {
    w: i32,
    h: i32,
    px: Vec<u8>,
}

impl G {
    fn new(w: i32, h: i32, bg: u8) -> G {
        G { w, h, px: vec![bg; (w * h) as usize] }
    }
    fn p(&mut self, x: i32, y: i32, s: u8) {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.px[(y * self.w + x) as usize] = s;
        }
    }
    fn r(&mut self, x: i32, y: i32, w: i32, h: i32, s: u8) {
        for yy in y..y + h {
            for xx in x..x + w {
                self.p(xx, yy, s);
            }
        }
    }
    fn ell(&mut self, cx: f32, cy: f32, rx: f32, ry: f32, s: u8) {
        for y in 0..self.h {
            for x in 0..self.w {
                let dx = (x as f32 + 0.5 - cx) / rx;
                let dy = (y as f32 + 0.5 - cy) / ry;
                if dx * dx + dy * dy <= 1.0 {
                    self.p(x, y, s);
                }
            }
        }
    }
    fn ring(&mut self, cx: f32, cy: f32, rx: f32, ry: f32, s: u8) {
        for y in 0..self.h {
            for x in 0..self.w {
                let dx = (x as f32 + 0.5 - cx) / rx;
                let dy = (y as f32 + 0.5 - cy) / ry;
                let d = dx * dx + dy * dy;
                if d <= 1.0 && d > 0.55 {
                    self.p(x, y, s);
                }
            }
        }
    }
    fn line(&mut self, x0: i32, y0: i32, x1: i32, y1: i32, s: u8) {
        let n = (x1 - x0).abs().max((y1 - y0).abs()).max(1);
        for i in 0..=n {
            self.p(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, s);
        }
    }
    fn txt(&mut self, x: i32, y: i32, t: &str, s: u8) {
        let mut cv = Canvas::new(self.w as usize, self.h as usize);
        cv.clear(c::BLACK);
        draw_tiny(&mut cv, x, y, t, c::WHITE);
        let white = rgb(c::WHITE);
        for yy in 0..self.h {
            for xx in 0..self.w {
                if cv.get(xx, yy) == white {
                    self.p(xx, yy, s);
                }
            }
        }
    }
    fn def(&self, name: String, pal: [u8; 3]) -> SpriteDef {
        let mut art = String::new();
        for y in 0..self.h {
            for x in 0..self.w {
                art.push(match self.px[(y * self.w + x) as usize] {
                    1 => '1',
                    2 => '2',
                    3 => '3',
                    _ => '.',
                });
            }
            art.push('\n');
        }
        let name: &'static str = Box::leak(name.into_boxed_str());
        let art: &'static str = Box::leak(art.into_boxed_str());
        SpriteDef { name, w: self.w as usize, h: self.h as usize, pal, art }
    }
}

fn hash(a: i32, b: i32, f: i32) -> u32 {
    let mut h = (a as u32).wrapping_mul(0x9E37_79B1) ^ (b as u32).wrapping_mul(0x85EB_CA6B) ^ (f as u32).wrapping_mul(0xC2B2_AE35);
    h ^= h >> 15;
    h = h.wrapping_mul(0x2C1B_3C6D);
    h ^ (h >> 12)
}

type Win = (&'static str, char, [u8; 3], Vec<G>);

// ---------- windows ----------

fn forever12_l() -> Win {
    let mut v = Vec::new();
    for f in 0..2 {
        let mut g = G::new(32, 28, 1);
        for (i, cx) in [9, 23].into_iter().enumerate() {
            g.ell(cx as f32, 5.0, 2.5, 3.0, 2); // head
            g.r(cx - 1, 8, 2, 2, 2); // neck
            g.r(cx - 4, 10, 8, 8, 3); // top
            g.r(cx - 6, 10, 2, 7, 2); // arms
            g.r(cx + 4, 10, 2, 7, 2);
            if i == 1 {
                g.r(cx - 4, 14, 8, 1, 1); // belt
            } else {
                g.r(cx - 1, 11, 2, 6, 1); // stripe
            }
            for k in 0..5 {
                g.r(cx - 4 - k / 2, 18 + k, 8 + k, 1, 3); // flared skirt
            }
            g.r(cx - 2, 23, 1, 4, 2);
            g.r(cx + 1, 23, 1, 4, 2);
            g.r(cx - 4, 27, 8, 1, 2);
        }
        if f == 1 {
            g.line(16, 2, 16, 6, 2);
            g.line(14, 4, 18, 4, 2);
        } else {
            g.p(16, 4, 2);
        }
        v.push(g);
    }
    ("forever12", 'l', [c::ROSE_D, c::WHITE, c::PINK], v)
}

fn forever12_r() -> Win {
    let mut g = G::new(32, 28, 1);
    g.r(1, 5, 30, 1, 2);
    g.r(1, 5, 1, 23, 2);
    g.r(30, 5, 1, 23, 2);
    g.r(0, 27, 32, 1, 2);
    for i in 0..5 {
        let x = 5 + i * 5;
        let col = if i % 2 == 0 { 2 } else { 3 };
        g.p(x, 4, 2);
        g.line(x - 2, 8, x, 6, 2);
        g.line(x, 6, x + 2, 8, 2);
        let len = 9 + (i * 3) % 6;
        g.r(x - 2, 8, 5, len, col);
        g.r(x - 3, 9, 1, 3, col);
        g.r(x + 3, 9, 1, 3, col);
        g.p(x, 9, 1);
    }
    ("forever12", 'r', [c::ROSE_D, c::WHITE, c::YELLOW], vec![g])
}

fn radioshock_l() -> Win {
    let mut v = Vec::new();
    for f in 0..3 {
        let mut g = G::new(32, 28, 3);
        for (i, (x, y)) in [(1, 15), (17, 15), (1, 2), (17, 2)].into_iter().enumerate() {
            g.r(x, y, 14, 12, 1);
            let (sx, sy) = (x + 1, y + 1);
            g.r(sx, sy, 10, 9, 3);
            g.r(x + 12, y + 2, 1, 8, 3); // knobs
            for yy in 0..9 {
                for xx in 0..10 {
                    if hash(xx + i as i32 * 7, yy, f + i as i32) % 5 < 2 {
                        g.p(sx + xx, sy + yy, 2);
                    }
                }
            }
        }
        v.push(g);
    }
    ("radioshock", 'l', [c::GRAY, c::WHITE, c::BLACK], v)
}

fn radioshock_r() -> Win {
    let mut g = G::new(32, 28, 1);
    for (i, x) in [3, 13, 23].into_iter().enumerate() {
        let y = 6 + (i as i32 % 2) * 2;
        g.r(x + 3, y - 4, 1, 5, 2); // antenna
        g.r(x, y, 7, 18, 3); // body
        g.r(x + 1, y + 1, 5, 6, 2); // speaker grille
        for k in 0..3 {
            g.r(x + 1, y + 2 + k * 2, 5, 1, 1);
        }
        g.r(x + 1, y + 9, 5, 3, 1); // display
        g.r(x + 5, y + 13, 1, 4, 2); // ptt
        g.r(x + 1, y + 14, 3, 3, 2);
    }
    ("radioshock", 'r', [c::TEAL_D, c::GRAY_L, c::GRAY_D], vec![g])
}

fn crookstone_l() -> Win {
    let mut g = G::new(32, 28, 1);
    g.r(0, 27, 32, 1, 3);
    g.r(5, 4, 5, 9, 2); // back
    g.r(7, 1, 4, 4, 3); // headrest
    g.r(5, 13, 18, 4, 2); // seat
    g.r(10, 17, 12, 2, 3);
    g.r(22, 17, 6, 9, 2); // leg rest
    g.r(24, 25, 6, 2, 3);
    g.r(9, 11, 12, 2, 3); // arm
    g.r(14, 19, 3, 8, 3); // base
    g.r(10, 26, 11, 1, 3);
    g.p(8, 6, 3);
    g.p(8, 8, 3);
    g.p(8, 10, 3);
    ("crookstone", 'l', [c::BROWN_D, c::BROWN, c::TAN], vec![g])
}

fn crookstone_r() -> Win {
    let mut g = G::new(32, 28, 1);
    for (x, h) in [(2, 10), (12, 15), (22, 7)] {
        g.r(x, 27 - h, 8, h, 2);
        g.r(x - 1, 27 - h, 10, 2, 3);
        g.r(x + 1, 27 - h + 2, 1, h - 3, 3);
    }
    // globe
    g.ell(6.0, 12.0, 3.5, 3.5, 3);
    g.p(5, 11, 1);
    g.p(7, 13, 1);
    // gadget with screen
    g.r(14, 7, 6, 4, 3);
    g.r(15, 8, 4, 2, 1);
    // drone
    g.r(22, 14, 8, 2, 3);
    g.r(22, 12, 2, 2, 3);
    g.r(28, 12, 2, 2, 3);
    ("crookstone", 'r', [c::BROWN_D, c::BROWN, c::TAN], vec![g])
}

fn gamestonk_l() -> Win {
    let mut v = Vec::new();
    for f in 0..2 {
        let mut g = G::new(32, 28, 1);
        g.r(0, 27, 32, 1, 3);
        g.r(3, 22, 18, 5, 2); // console 1
        g.r(5, 23, 8, 1, 1);
        g.r(5, 17, 15, 5, 3); // console 2
        g.r(6, 18, 6, 1, 1);
        g.r(14, 19, 4, 2, 1);
        g.r(7, 12, 12, 5, 2); // console 3
        g.r(8, 13, 4, 1, 1);
        // controller
        g.r(8, 7, 10, 4, 3);
        g.r(9, 8, 2, 2, 1);
        g.r(15, 8, 2, 2, 1);
        // cartridges
        for i in 0..3 {
            g.r(23 + i * 3, 12, 2, 15, if i % 2 == 0 { 3 } else { 2 });
            g.r(23 + i * 3, 14, 2, 3, 1);
        }
        if f == 1 {
            g.p(14, 5, 3);
            g.p(15, 4, 3);
        }
        v.push(g);
    }
    ("gamestonk", 'l', [c::BLUE_D, c::GRAY, c::RED_L], v)
}

fn gamestonk_r() -> Win {
    let mut v = Vec::new();
    for f in 0..2 {
        let mut g = G::new(32, 28, 1);
        // poster 20x26
        g.r(1, 1, 20, 26, 2);
        g.r(2, 2, 18, 24, 1);
        // rocket
        g.r(10, 2, 2, 2, 2);
        g.r(9, 4, 4, 4, 2);
        g.r(8, 6, 1, 2, 3);
        g.r(13, 6, 1, 2, 3);
        g.p(10, 8, 3);
        g.p(11, 8, 3);
        g.p(10, 9, 3);
        g.txt(3, 11, "TO", 2);
        g.txt(3, 16, "THE", 2);
        g.txt(3, 21, "MOON", 3);
        // demo tv
        g.r(23, 10, 8, 10, 2);
        g.r(24, 11, 6, 7, 3);
        for yy in 0..7 {
            for xx in 0..6 {
                if hash(xx, yy, f + 9) % 3 == 0 {
                    g.p(24 + xx, 11 + yy, 1);
                }
            }
        }
        g.r(25, 21, 4, 1, 2);
        g.r(24, 22, 6, 5, 2);
        v.push(g);
    }
    ("gamestonk", 'r', [c::BLUE_D, c::GRAY_L, c::GREEN_L], v)
}

fn bear(g: &mut G, cx: i32, y: i32) {
    g.ell((cx - 4) as f32, (y + 1) as f32, 2.0, 2.0, 2); // ears
    g.ell((cx + 4) as f32, (y + 1) as f32, 2.0, 2.0, 2);
    g.ell(cx as f32, (y + 5) as f32, 5.0, 4.5, 2); // head
    g.r(cx - 3, y + 1, 7, 3, 3); // ushanka
    g.r(cx - 5, y + 3, 2, 5, 3); // flaps
    g.r(cx + 4, y + 3, 2, 5, 3);
    g.r(cx - 2, y + 6, 1, 1, 1); // eyes
    g.r(cx + 1, y + 6, 1, 1, 1);
    g.r(cx - 1, y + 8, 2, 1, 1); // nose
    g.ell(cx as f32, (y + 15) as f32, 5.0, 6.0, 2); // body
    g.r(cx - 7, y + 11, 3, 4, 2);
    g.r(cx + 5, y + 11, 3, 4, 2);
    g.r(cx - 5, y + 20, 3, 3, 2);
    g.r(cx + 3, y + 20, 3, 3, 2);
    g.r(cx - 1, y + 12, 2, 3, 3); // star on belly
}

fn kgbtoys_l() -> Win {
    let mut g = G::new(32, 28, 1);
    g.r(0, 27, 32, 1, 3);
    bear(&mut g, 9, 3);
    bear(&mut g, 23, 5);
    ("kgbtoys", 'l', [c::BLUE_D, c::BROWN, c::WHITE], vec![g])
}

fn kgbtoys_r() -> Win {
    let mut g = G::new(32, 28, 1);
    g.r(0, 27, 32, 1, 3);
    // robot
    g.r(10, 1, 1, 3, 2); // antenna
    g.r(9, 0, 3, 1, 3);
    g.r(5, 4, 11, 8, 2); // head
    g.r(7, 6, 2, 2, 1);
    g.r(12, 6, 2, 2, 1);
    g.r(8, 10, 5, 1, 1);
    g.r(8, 12, 5, 2, 2);
    g.r(3, 14, 15, 9, 2); // torso
    g.r(5, 16, 3, 3, 3);
    g.r(10, 16, 6, 2, 1);
    g.r(0, 15, 3, 7, 2);
    g.r(18, 15, 3, 7, 2);
    g.r(5, 23, 4, 4, 2);
    g.r(12, 23, 4, 4, 2);
    // rocket
    g.r(26, 6, 2, 2, 3);
    g.r(25, 8, 4, 12, 2);
    g.r(25, 11, 4, 2, 3);
    g.r(23, 16, 2, 5, 3);
    g.r(29, 16, 2, 5, 3);
    g.r(25, 20, 4, 2, 3);
    g.r(26, 22, 2, 2, 3);
    g.p(26, 25, 3);
    g.p(27, 24, 3);
    ("kgbtoys", 'r', [c::BLUE_D, c::GRAY_L, c::RED], vec![g])
}

fn bbv_l() -> Win {
    let mut g = G::new(32, 28, 1);
    g.r(0, 0, 32, 1, 2);
    g.r(0, 27, 32, 1, 2);
    g.r(4, 6, 24, 16, 3);
    g.r(5, 7, 22, 14, 2);
    g.r(15, 2, 1, 4, 3); // hanging string
    g.txt(7, 9, "FOR", 1);
    g.txt(7, 15, "LEASE", 1);
    g.r(22, 9, 3, 5, 1);
    ("bbv", 'l', [c::BLUE_D, c::GRAY_L, c::GRAY_D], vec![g])
}

fn bbv_r() -> Win {
    let mut g = G::new(32, 28, 1);
    g.r(5, 2, 22, 24, 2);
    g.r(6, 3, 20, 22, 1);
    g.ell(16.0, 9.0, 3.0, 3.0, 3);
    g.r(12, 12, 8, 7, 3);
    g.r(9, 13, 3, 2, 3);
    g.r(20, 13, 3, 2, 3);
    g.r(7, 20, 18, 1, 2);
    g.txt(8, 21, "VHS", 2);
    for y in 3..25 {
        for x in 6..26 {
            if (x + y) % 5 == 0 && g.px[(y * 32 + x) as usize] == 3 {
                g.p(x, y, 1);
            }
        }
    }
    ("bbv", 'r', [c::BLUE_D, c::GRAY_D, c::GRAY], vec![g])
}

fn spenders_l() -> Win {
    let mut v = Vec::new();
    for f in 0..3i32 {
        let mut g = G::new(32, 28, 1);
        g.r(10, 23, 12, 4, 3);
        g.r(12, 21, 8, 2, 3);
        g.r(13, 1, 6, 2, 3);
        for y in 3..21 {
            let half = 3 + (y - 3) * 3 / 17;
            g.r(16 - half, y, half * 2, 1, 2);
        }
        let blobs = [(16, 17 - f * 4), (14 + f * 2, 9 + ((f + 1) % 3) * 3), (18 - f, 5 + f * 5)];
        for (bx, by) in blobs {
            g.ell(bx as f32, by as f32, 2.5, 2.5, 3);
        }
        g.r(12, 18, 8, 3, 3);
        v.push(g);
    }
    ("spenders", 'l', [c::VIOLET_D, c::RED, c::YELLOW], v)
}

fn spenders_r() -> Win {
    let mut v = Vec::new();
    for f in 0..3i32 {
        let mut g = G::new(32, 28, 1);
        g.r(11, 24, 10, 3, 2);
        g.r(13, 22, 6, 2, 2);
        g.ring(16.0, 11.0, 11.0, 11.0, 2);
        g.ell(16.0, 11.0, 2.0, 2.0, 3);
        let dirs = [(-9, -6), (9, -4), (-3, 10), (7, 8), (-8, 5)];
        for (i, (dx, dy)) in dirs.into_iter().enumerate() {
            if (i as i32 + f) % 3 == 2 {
                continue;
            }
            let jitter = (hash(i as i32, f, 3) % 3) as i32 - 1;
            let mx = 16 + dx / 2 + jitter;
            let my = 11 + dy / 2;
            g.line(16, 11, mx, my, 3);
            g.line(mx, my, 16 + dx, 11 + dy, 3);
        }
        v.push(g);
    }
    ("spenders", 'r', [c::VIOLET_D, c::PURPLE_L, c::CYAN_L], v)
}

fn sambaddy_l() -> Win {
    let mut g = G::new(32, 28, 1);
    g.r(0, 27, 32, 1, 2);
    g.r(1, 8, 14, 14, 2);
    g.ell(10.0, 15.0, 6.5, 6.5, 3);
    g.ell(10.0, 15.0, 2.0, 2.0, 2);
    g.p(10, 15, 3);
    g.r(14, 8, 2, 14, 3);
    g.r(16, 12, 14, 14, 2);
    g.ell(23.0, 19.0, 6.5, 6.5, 3);
    g.ell(23.0, 19.0, 2.0, 2.0, 1);
    g.r(17, 2, 12, 7, 2);
    g.r(19, 3, 8, 3, 3);
    g.p(21, 4, 1);
    g.p(25, 4, 1);
    g.r(20, 7, 6, 1, 1);
    g.r(2, 1, 11, 6, 2);
    g.r(4, 2, 7, 2, 3);
    g.p(6, 3, 1);
    g.p(9, 3, 1);
    ("sambaddy", 'l', [c::INDIGO, c::MAGENTA_L, c::GRAY_L], vec![g])
}

fn sambaddy_r() -> Win {
    let mut v = Vec::new();
    for f in 0..2 {
        let mut g = G::new(32, 28, 1);
        g.r(0, 27, 32, 1, 3);
        g.r(3, 8, 26, 17, 2);
        g.r(8, 4, 16, 1, 3);
        g.r(8, 5, 1, 3, 3);
        g.r(23, 5, 1, 3, 3);
        g.r(12, 10, 8, 3, 3);
        g.r(14, 11, 4, 1, 1);
        let rr = if f == 0 { 4.5 } else { 5.5 };
        for cx in [9.0, 23.0] {
            g.ell(cx, 18.0, rr + 0.5, rr + 0.5, 1);
            g.ell(cx, 18.0, rr, rr, 3);
            g.ell(cx, 18.0, rr - 2.0, rr - 2.0, 1);
            g.ell(cx, 18.0, 1.0, 1.0, 3);
        }
        g.r(15, 15, 2, 6, 3);
        if f == 1 {
            g.p(1, 14, 3);
            g.p(30, 14, 3);
            g.p(0, 18, 3);
            g.p(31, 18, 3);
        }
        v.push(g);
    }
    ("sambaddy", 'r', [c::INDIGO, c::GRAY_D, c::YELLOW], v)
}

fn sharper_l() -> Win {
    let mut v = Vec::new();
    for f in 0..2 {
        let mut g = G::new(32, 28, 1);
        g.r(0, 26, 32, 2, 2);
        for x in (2..30).step_by(6) {
            g.p(x, 27, 1);
        }
        g.ell(16.0, 22.0, 12.5, 4.5, 2);
        g.ell(16.0, 21.0, 10.0, 3.0, 1);
        g.ell(16.0, 21.0, 4.0, 2.0, 2);
        g.r(26, 20, 3, 1, 2);
        g.ring(16.0, 21.0, 10.0, 3.0, 2);
        g.p(if f == 0 { 16 } else { 17 }, 21, 3);
        g.p(5, 18, 3);
        g.p(27, 18, 3);
        if f == 1 {
            g.p(3, 17, 3);
            g.p(29, 17, 3);
        }
        v.push(g);
    }
    ("sharper", 'l', [c::GRAY_D, c::GRAY_L, c::CYAN_L], v)
}

fn sharper_r() -> Win {
    let mut v = Vec::new();
    for f in 0..3 {
        let mut g = G::new(32, 28, 1);
        let rad = 5.0 + f as f32 * 1.8;
        g.r(12, 22, 8, 5, 2);
        g.r(10, 26, 12, 1, 2);
        for y in 0..24 {
            for x in 0..32 {
                let dx = x as f32 + 0.5 - 16.0;
                let dy = y as f32 + 0.5 - 12.0;
                let d = (dx * dx + dy * dy).sqrt();
                if d < rad + 5.0 && d >= rad && (x + y) % 2 == 0 {
                    g.p(x, y, 2);
                }
            }
        }
        g.ell(16.0, 12.0, rad, rad, 2);
        g.ell(16.0, 12.0, rad - 2.0, rad - 2.0, 3);
        g.p(14, 10, 2);
        v.push(g);
    }
    ("sharper", 'r', [c::INDIGO, c::CYAN_L, c::WHITE], v)
}

fn hotspy_l() -> Win {
    let mut v = Vec::new();
    for f in 0..2i32 {
        let mut g = G::new(32, 28, 1);
        g.r(0, 27, 32, 1, 3);
        g.r(4, 10, 16, 17, 3);
        g.r(4, 14, 16, 1, 2);
        g.r(4, 22, 16, 1, 2);
        g.r(5, 12, 14, 13, 2);
        g.r(5, 16, 14, 1, 3);
        g.r(3, 9, 18, 2, 3);
        g.ell(11.0, 12.0, 3.0, 3.0, 3);
        g.p(11, 12, 2);
        let dy = if f == 0 { 0 } else { 5 };
        g.r(24, 2 + dy, 6, 2, 3);
        g.r(26, 4 + dy, 2, 20 - dy, 3);
        g.r(20, 22, 10, 2, 3);
        g.r(24, 24, 6, 3, 3);
        v.push(g);
    }
    ("hotspy", 'l', [c::RED_D, c::YELLOW, c::WHITE], v)
}

fn hotspy_r() -> Win {
    let mut g = G::new(32, 28, 1);
    g.r(0, 27, 32, 1, 2);
    for (i, x) in [3, 10, 17, 24].into_iter().enumerate() {
        let top = 4 + (i as i32 % 2) * 2;
        g.r(x + 2, top + 10, 1, 24 - top - 10, 3);
        g.r(x, top, 5, 12, 2);
        g.ell((x + 2) as f32 + 0.5, top as f32 + 0.5, 2.5, 2.0, 2);
        g.r(x + 1, top + 3, 3, 1, 3);
        g.p(x + 3, top + 5, 3);
        g.p(x + 1, top + 7, 3);
    }
    ("hotspy", 'r', [c::RED_D, c::ORANGE, c::YELLOW_L], vec![g])
}

fn shutter_fill(g: &mut G, y0: i32, y1: i32, w: i32, base: u8, line: u8) {
    g.r(0, y0, w, y1 - y0, base);
    let mut y = y0 + 1;
    while y < y1 {
        g.r(0, y, w, 1, line);
        y += 3;
    }
}

fn circuitpity(side: char) -> Win {
    let mut g = G::new(32, 28, 1);
    for (i, x) in [1, 17].into_iter().enumerate() {
        let y = if side == 'l' { 14 } else { 13 } + i as i32 % 2;
        g.r(x, y, 14, 12, 2);
        g.r(x + 1, y + 1, 10, 9, 1);
        g.p(x + 2, y + 2, 2);
        g.p(x + 3, y + 2, 2);
        g.r(x + 12, y + 2, 1, 6, 1);
    }
    shutter_fill(&mut g, 0, 12, 32, 3, 2);
    g.r(0, 12, 32, 2, 2);
    g.r(14, 11, 4, 3, 2);
    ("circuitpity", side, [c::BLACK, c::GRAY_D, c::GRAY], vec![g])
}

fn footlock_l() -> Win {
    let mut g = G::new(32, 28, 1);
    for row in 0..3 {
        let y = 5 + row * 9;
        g.r(0, y + 4, 32, 1, 2);
        for (i, x) in [1, 17].into_iter().enumerate() {
            let col = if (row + i as i32) % 2 == 0 { 2 } else { 3 };
            g.r(x + 1, y - 1, 5, 4, col);
            g.r(x, y + 1, 13, 3, col);
            g.r(x + 8, y, 5, 3, col);
            g.r(x, y + 3, 13, 1, 3);
            g.p(x + 3, y, 1);
            g.p(x + 5, y + 1, 1);
            g.p(x + 7, y + 1, 1);
        }
    }
    ("footlock", 'l', [c::BLACK, c::RED_L, c::WHITE], vec![g])
}

fn footlock_r() -> Win {
    let mut g = G::new(32, 28, 1);
    g.r(0, 27, 32, 1, 3);
    g.r(2, 2, 14, 24, 3);
    g.r(0, 2, 3, 3, 3);
    g.r(15, 2, 3, 3, 3);
    g.r(6, 1, 6, 3, 1);
    g.r(2, 24, 14, 1, 2);
    g.txt(6, 10, "23", 2);
    g.r(2, 8, 14, 1, 2);
    for (cx, cy) in [(24.0, 22.0), (26.0, 8.0)] {
        g.ell(cx, cy, 5.0, 5.0, 2);
        g.line(cx as i32 - 5, cy as i32, cx as i32 + 4, cy as i32, 1);
        g.line(cx as i32, cy as i32 - 5, cx as i32, cy as i32 + 4, 1);
        g.ring(cx, cy, 5.0, 5.0, 2);
    }
    ("footlock", 'r', [c::BLACK, c::ORANGE, c::WHITE], vec![g])
}

fn borderline(side: char) -> Win {
    let mut g = G::new(32, 28, 1);
    shutter_fill(&mut g, 0, 28, 32, 1, 2);
    g.r(0, 25, 32, 3, 2);
    g.r(0, 7, 32, 14, 3);
    g.r(0, 7, 32, 1, 2);
    g.r(0, 20, 32, 1, 2);
    if side == 'l' {
        g.txt(2, 9, "CLOSING", 2);
        g.txt(2, 15, "50% OFF", 2);
    } else {
        g.txt(3, 9, "SALE", 2);
        g.txt(3, 15, "NOW!", 2);
    }
    ("borderline", side, [c::GRAY, c::BLACK, c::YELLOW], vec![g])
}

// ---------- doors & extras ----------

fn door(name: &str, pal: [u8; 3], handle: bool) -> SpriteDef {
    let mut g = G::new(16, 28, 0);
    g.r(0, 0, 16, 28, 2); // frame
    g.r(1, 1, 14, 27, 1); // leaf
    g.r(3, 3, 10, 11, 2);
    g.r(4, 4, 8, 9, 3);
    g.r(4, 8, 8, 1, 2);
    g.r(8, 4, 1, 9, 2);
    g.r(3, 17, 10, 8, 2);
    g.r(4, 18, 8, 6, 1);
    if handle {
        g.r(12, 15, 2, 3, 3);
    }
    g.def(name.to_string(), pal)
}

fn shutter_door() -> SpriteDef {
    let mut g = G::new(16, 28, 0);
    shutter_fill(&mut g, 0, 28, 16, 1, 2);
    g.r(0, 0, 16, 1, 3);
    g.r(0, 0, 1, 28, 3);
    g.r(15, 0, 1, 28, 3);
    g.r(5, 24, 6, 2, 3);
    g.def("sf_door_shutter".into(), [c::GRAY, c::GRAY_D, c::GRAY_L])
}

fn shutter32() -> SpriteDef {
    let mut g = G::new(32, 28, 1);
    shutter_fill(&mut g, 0, 28, 32, 1, 2);
    g.r(0, 26, 32, 2, 3);
    g.r(0, 0, 32, 1, 3);
    g.def("sf_shutter_32".into(), [c::GRAY, c::GRAY_D, c::GRAY_L])
}

fn sale70() -> SpriteDef {
    let mut g = G::new(28, 10, 1);
    g.r(0, 0, 28, 1, 3);
    g.r(0, 9, 28, 1, 3);
    g.txt(0, 2, "70% OFF", 2);
    g.def("sf_sale70".into(), [c::RED, c::WHITE, c::YELLOW])
}

fn pillar() -> SpriteDef {
    let mut g = G::new(8, 40, 1);
    g.r(0, 0, 8, 3, 3);
    g.r(0, 37, 8, 3, 3);
    g.r(1, 3, 1, 34, 2);
    g.r(3, 3, 2, 34, 3);
    g.r(6, 3, 1, 34, 2);
    g.def("sf_pillar".into(), [c::GRAY_D, c::GRAY, c::GRAY_L])
}

fn sign_cap() -> SpriteDef {
    let mut g = G::new(4, 10, 1);
    g.r(0, 0, 4, 1, 3);
    g.r(0, 9, 4, 1, 3);
    g.r(3, 1, 1, 8, 2);
    g.r(0, 1, 1, 8, 3);
    g.def("sf_sign_cap".into(), [c::GRAY_D, c::GRAY, c::GRAY_L])
}

pub fn defs() -> Vec<SpriteDef> {
    let mut out = Vec::new();
    let wins: Vec<Win> = vec![
        forever12_l(), forever12_r(), radioshock_l(), radioshock_r(), crookstone_l(), crookstone_r(),
        gamestonk_l(), gamestonk_r(), kgbtoys_l(), kgbtoys_r(), bbv_l(), bbv_r(), spenders_l(), spenders_r(),
        sambaddy_l(), sambaddy_r(), sharper_l(), sharper_r(), hotspy_l(), hotspy_r(), circuitpity('l'),
        circuitpity('r'), footlock_l(), footlock_r(), borderline('l'), borderline('r'),
    ];
    for (slug, side, pal, frames) in wins {
        for (n, g) in frames.iter().enumerate() {
            out.push(g.def(format!("sf_{slug}_{side}_{n}"), pal));
        }
    }
    out.push(door("sf_door_target_0", [c::RED, c::BLACK, c::YELLOW_L], true));
    out.push(door("sf_door_target_1", [c::RED_D, c::BLACK, c::ROSE_D], true));
    out.push(door("sf_door_power", [c::BLUE, c::BLACK, c::SKY], true));
    out.push(door("sf_door_dark", [c::GRAY_D, c::BLACK, c::BROWN_D], false));
    out.push(shutter_door());
    out.push(shutter32());
    out.push(sale70());
    out.push(pillar());
    out.push(sign_cap());
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pixel::{encode_png, Sprite};

    const SLUGS: [(&str, usize, usize); 13] = [
        ("forever12", 2, 1), ("radioshock", 3, 1), ("crookstone", 1, 1), ("gamestonk", 2, 2), ("kgbtoys", 1, 1),
        ("bbv", 1, 1), ("spenders", 3, 3), ("sambaddy", 1, 2), ("sharper", 2, 3), ("hotspy", 2, 1),
        ("circuitpity", 1, 1), ("footlock", 1, 1), ("borderline", 1, 1),
    ];

    #[test]
    fn all_required_present_with_sizes_and_frames() {
        let d = defs();
        let find = |n: &str| d.iter().find(|s| s.name == n);
        for (slug, lf, rf) in SLUGS {
            for (side, f) in [('l', lf), ('r', rf)] {
                assert!((1..=3).contains(&f));
                for n in 0..f {
                    let s = find(&format!("sf_{slug}_{side}_{n}")).unwrap_or_else(|| panic!("{slug} {side} {n}"));
                    assert_eq!((s.w, s.h), (32, 28));
                }
                assert!(find(&format!("sf_{slug}_{side}_{f}")).is_none(), "extra frame");
            }
        }
        for n in ["sf_door_target_0", "sf_door_target_1", "sf_door_power", "sf_door_dark", "sf_door_shutter"] {
            let s = find(n).unwrap();
            assert_eq!((s.w, s.h), (16, 28), "{n}");
        }
        for (n, w, h) in [("sf_shutter_32", 32, 28), ("sf_sale70", 28, 10), ("sf_pillar", 8, 40), ("sf_sign_cap", 4, 10)] {
            let s = find(n).unwrap();
            assert_eq!((s.w, s.h), (w, h), "{n}");
        }
    }

    #[test]
    fn windows_are_opaque() {
        for d in defs().iter().filter(|d| d.w == 32 && d.h == 28) {
            let s = Sprite::from_def(d).unwrap();
            assert!(s.px.iter().all(|p| *p != 0), "{} has holes", d.name);
        }
    }

    #[test]
    fn dump_sheet() {
        let Ok(path) = std::env::var("SF_SHEET") else { return };
        let d = defs();
        let mut cv = Canvas::new(32 * 9 + 24, 30 * 8 + 4);
        cv.clear(c::GRAY_D);
        let (mut x, mut y) = (2, 2);
        for sp in d.iter() {
            let s = Sprite::from_def(sp).unwrap();
            if x + s.w as i32 > cv.w as i32 {
                x = 2;
                y += 42;
            }
            cv.blit(&s, x, y);
            x += s.w as i32 + 2;
        }
        std::fs::write(path, encode_png(cv.w, cv.h, &cv.data, 3)).unwrap();
    }
}
