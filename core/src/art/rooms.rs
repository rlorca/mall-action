//! Top-down store-room tiles (16x16, Zelda style), generated procedurally from tiny shape
//! functions and per-theme palettes, then handed to the pixel pipeline as ASCII sprites.
//! Slot convention: 1 = main colour, 2 = dark/outline, 3 = light/highlight.
//!
//! ## Catalogue (all 16x16)
//! Per theme `<t>` in fashion, electronics, toys, food, sports, music, gadgets, novelty, games:
//! `rt_<t>_floor_0`, `rt_<t>_floor_1` (opaque, alternating floor),
//! `rt_<t>_wall` (opaque side/bottom wall), `rt_<t>_wall_top` (opaque back wall with themed shelf),
//! `rt_<t>_fix_a_0` / `_1`, `rt_<t>_fix_b_0` / `_1` (searchable fixtures: closed / rummaged; transparent corners),
//! `rt_<t>_counter` (opaque-ish solid counter), `rt_<t>_decor_0`, `rt_<t>_decor_1` (solid decor).
//! Generic: `rt_door`, `rt_door_mat`, `rt_radar_0`, `rt_radar_1` (flashing "!" overlay),
//! `rt_fitting_0/1` (fitting room closed/open), `rt_toyshelf_0/1` (full/emptied), `rt_booth_0/1`
//! (listening booth idle/active), `rt_pedestal`, `rt_cave_floor`, `rt_cave_wall`, `rt_tv_0/1`
//! (flickering demo TV), `rt_fire_0/1` (brazier), `rt_trap_0/1` (floor vent), `rt_shadow` (dither overlay).
use crate::pixel::SpriteDef;

#[derive(Clone)]
struct G {
    c: [[u8; 16]; 16],
}

impl G {
    fn new(b: u8) -> G {
        G { c: [[b; 16]; 16] }
    }
    fn r(&mut self, x: i32, y: i32, w: i32, h: i32, ch: u8) -> &mut G {
        for yy in y..y + h {
            for xx in x..x + w {
                self.p(xx, yy, ch);
            }
        }
        self
    }
    fn p(&mut self, x: i32, y: i32, ch: u8) -> &mut G {
        if (0..16).contains(&x) && (0..16).contains(&y) {
            self.c[y as usize][x as usize] = ch;
        }
        self
    }
    /// Filled rect with a 1px outline of `o`.
    fn boxed(&mut self, x: i32, y: i32, w: i32, h: i32, fill: u8, o: u8) -> &mut G {
        self.r(x, y, w, h, o);
        self.r(x + 1, y + 1, w - 2, h - 2, fill)
    }
    fn def(&self, name: String, pal: [u8; 3]) -> SpriteDef {
        let mut s = String::new();
        for row in &self.c {
            for &ch in row {
                s.push(ch as char);
            }
            s.push('\n');
        }
        SpriteDef {
            name: Box::leak(name.into_boxed_str()),
            w: 16,
            h: 16,
            pal,
            art: Box::leak(s.into_boxed_str()),
        }
    }
}

const T: u8 = b'.';
const A: u8 = b'1';
const B: u8 = b'2';
const C: u8 = b'3';

#[derive(Clone, Copy)]
enum Shape {
    Rack,
    Shelf,
    Bin,
    Cabinet,
    Pedestal,
    Tv,
    Table,
}
#[derive(Clone, Copy)]
enum Decor {
    Plant,
    Pillar,
    Mannequin,
    Stand,
    Speaker,
    Lamp,
}

struct Theme {
    slug: &'static str,
    floor: [u8; 3],
    floor_style: u8,
    wall: [u8; 3],
    a: (Shape, [u8; 3]),
    b: (Shape, [u8; 3]),
    counter: [u8; 3],
    decor: [(Decor, [u8; 3]); 2],
    top: [u8; 3],
}

fn themes() -> Vec<Theme> {
    use Decor::*;
    use Shape::*;
    vec![
        Theme { slug: "fashion", floor: [0x35, 0x30, 0x25], floor_style: 0, wall: [0x14, 0x04, 0x25],
            a: (Rack, [0x24, 0x05, 0x30]), b: (Shelf, [0x26, 0x06, 0x37]), counter: [0x25, 0x05, 0x30],
            decor: [(Mannequin, [0x37, 0x07, 0x30]), (Plant, [0x2A, 0x0A, 0x17])], top: [0x24, 0x05, 0x30] },
        Theme { slug: "electronics", floor: [0x00, 0x0F, 0x10], floor_style: 3, wall: [0x01, 0x0F, 0x21],
            a: (Tv, [0x10, 0x0F, 0x2C]), b: (Bin, [0x21, 0x01, 0x30]), counter: [0x10, 0x00, 0x3D],
            decor: [(Stand, [0x2C, 0x0C, 0x30]), (Pillar, [0x10, 0x00, 0x3D])], top: [0x2C, 0x0F, 0x30] },
        Theme { slug: "toys", floor: [0x38, 0x22, 0x28], floor_style: 0, wall: [0x21, 0x01, 0x30],
            a: (Bin, [0x16, 0x06, 0x28]), b: (Shelf, [0x2A, 0x0A, 0x28]), counter: [0x22, 0x02, 0x38],
            decor: [(Stand, [0x17, 0x07, 0x37]), (Plant, [0x2A, 0x0A, 0x28])], top: [0x16, 0x2A, 0x28] },
        Theme { slug: "food", floor: [0x30, 0x16, 0x26], floor_style: 0, wall: [0x27, 0x07, 0x38],
            a: (Table, [0x17, 0x07, 0x37]), b: (Cabinet, [0x3D, 0x2D, 0x28]), counter: [0x28, 0x17, 0x38],
            decor: [(Plant, [0x2A, 0x0A, 0x17]), (Pillar, [0x27, 0x07, 0x38])], top: [0x16, 0x28, 0x30] },
        Theme { slug: "sports", floor: [0x27, 0x17, 0x37], floor_style: 1, wall: [0x12, 0x02, 0x30],
            a: (Shelf, [0x16, 0x06, 0x30]), b: (Cabinet, [0x22, 0x02, 0x30]), counter: [0x10, 0x00, 0x30],
            decor: [(Stand, [0x16, 0x06, 0x30]), (Pillar, [0x12, 0x02, 0x30])], top: [0x16, 0x22, 0x30] },
        Theme { slug: "music", floor: [0x13, 0x03, 0x23], floor_style: 1, wall: [0x15, 0x05, 0x25],
            a: (Bin, [0x17, 0x0F, 0x28]), b: (Cabinet, [0x00, 0x0F, 0x10]), counter: [0x16, 0x06, 0x26],
            decor: [(Speaker, [0x00, 0x0F, 0x10]), (Lamp, [0x28, 0x17, 0x38])], top: [0x28, 0x16, 0x30] },
        Theme { slug: "gadgets", floor: [0x10, 0x2D, 0x3D], floor_style: 3, wall: [0x1C, 0x0C, 0x3C],
            a: (Pedestal, [0x30, 0x10, 0x2C]), b: (Cabinet, [0x2C, 0x0C, 0x30]), counter: [0x3D, 0x10, 0x30],
            decor: [(Pillar, [0x3D, 0x10, 0x30]), (Lamp, [0x2C, 0x0C, 0x30])], top: [0x30, 0x2C, 0x28] },
        Theme { slug: "novelty", floor: [0x03, 0x0F, 0x14], floor_style: 2, wall: [0x03, 0x0F, 0x24],
            a: (Shelf, [0x24, 0x03, 0x3C]), b: (Bin, [0x2A, 0x0F, 0x3B]), counter: [0x13, 0x03, 0x24],
            decor: [(Lamp, [0x24, 0x03, 0x3B]), (Stand, [0x2A, 0x03, 0x3C])], top: [0x24, 0x2A, 0x3C] },
        Theme { slug: "games", floor: [0x01, 0x0F, 0x12], floor_style: 3, wall: [0x12, 0x01, 0x2C],
            a: (Shelf, [0x10, 0x0F, 0x2A]), b: (Cabinet, [0x16, 0x0F, 0x28]), counter: [0x01, 0x0F, 0x21],
            decor: [(Stand, [0x12, 0x0F, 0x2C]), (Speaker, [0x2D, 0x0F, 0x28])], top: [0x2A, 0x16, 0x28] },
    ]
}

fn floor(style: u8, alt: bool) -> G {
    let mut g = G::new(if alt && style == 0 { C } else { A });
    match style {
        0 => {
            g.r(15, 0, 1, 16, B).r(0, 15, 16, 1, B);
            g.r(1, 1, 2, 1, if alt { A } else { C });
        }
        1 => {
            for y in (3..16).step_by(4) {
                g.r(0, y, 16, 1, B);
            }
            for (i, y) in (0..16).step_by(4).enumerate() {
                let off = if (i % 2 == 0) != alt { 3 } else { 10 };
                g.r(off, y, 1, 3, B);
            }
            g.r(if alt { 9 } else { 2 }, 1, 3, 1, C);
        }
        2 => {
            let o = if alt { 4 } else { 0 };
            for (x, y) in [(2, 3), (10, 2), (6, 9), (13, 12), (3, 13)] {
                g.p((x + o) % 16, y, B);
            }
            g.p((7 + o) % 16, 5, C).p((12 + o) % 16, 8, C);
        }
        _ => {
            g.r(0, 0, 16, 1, B).r(0, 0, 1, 16, B);
            g.r(8, 8, 1, 1, if alt { C } else { B });
            g.r(if alt { 3 } else { 11 }, 4, 2, 1, C);
        }
    }
    g
}

fn wall_side() -> G {
    let mut g = G::new(A);
    g.r(0, 0, 16, 2, C);
    for y in (5..16).step_by(5) {
        g.r(0, y, 16, 1, B);
    }
    g.r(4, 2, 1, 3, B).r(11, 7, 1, 3, B).r(4, 12, 1, 3, B);
    g.r(0, 14, 16, 2, B);
    g
}

fn wall_top() -> G {
    let mut g = G::new(A);
    g.r(0, 0, 16, 1, C);
    g.r(0, 9, 16, 2, B).r(0, 10, 16, 1, C);
    for (i, x) in [1, 5, 9, 12].iter().enumerate() {
        let h = 3 + (i as i32 % 2) * 2;
        g.boxed(*x, 9 - h, 3, h, if i % 2 == 0 { C } else { A }, B);
    }
    g.r(0, 11, 16, 5, A).r(0, 11, 16, 1, B).r(0, 14, 16, 2, B).r(0, 14, 16, 1, C);
    g
}

fn fixture(s: Shape, open: bool) -> G {
    let mut g = G::new(T);
    match s {
        Shape::Bin => {
            if !open {
                g.boxed(1, 5, 14, 10, A, B).r(2, 6, 12, 2, C).r(7, 8, 2, 3, C);
            } else {
                g.boxed(1, 8, 14, 7, B, B).r(3, 9, 3, 2, C).r(9, 10, 3, 2, A);
                g.boxed(1, 1, 14, 5, A, B).r(2, 2, 12, 1, C);
                g.r(2, 6, 12, 2, B);
            }
        }
        Shape::Shelf => {
            g.boxed(1, 1, 14, 14, A, B);
            g.r(2, 5, 12, 1, B).r(2, 9, 12, 1, B).r(2, 13, 12, 1, B);
            let items: [(i32, i32); 9] = [(2, 2), (6, 2), (10, 2), (2, 6), (6, 6), (10, 6), (2, 10), (6, 10), (10, 10)];
            for (i, (x, y)) in items.iter().enumerate() {
                if open && i % 2 == 0 {
                    continue;
                }
                g.r(*x + 1, *y, 3, 3, if i % 2 == 0 { C } else { B });
            }
            if open {
                g.r(12, 11, 2, 2, C);
            }
        }
        Shape::Rack => {
            g.r(1, 2, 14, 1, B).r(1, 2, 1, 13, B).r(14, 2, 1, 13, B);
            for (i, x) in (2..14).step_by(2).enumerate() {
                let sh = if open && i % 2 == 0 { 1 } else { 0 };
                g.r(x + sh, 3, 2, if open { 7 + (i as i32 % 3) } else { 9 }, if i % 2 == 0 { C } else { A });
                if open && i % 2 == 0 {
                    g.p(x + 1, 3, B);
                }
            }
            g.r(1, 13, 14, 2, B).r(2, 13, 12, 1, A);
        }
        Shape::Cabinet => {
            g.boxed(2, 1, 12, 14, A, B).r(7, 2, 2, 12, B);
            if !open {
                g.r(6, 7, 1, 2, C).r(9, 7, 1, 2, C).r(3, 2, 3, 1, C).r(10, 2, 3, 1, C);
            } else {
                g.r(3, 2, 3, 12, B).r(10, 2, 3, 12, B).r(5, 3, 1, 10, A).r(10, 3, 1, 10, A);
                g.r(7, 5, 2, 2, C);
            }
        }
        Shape::Pedestal => {
            g.boxed(3, 8, 10, 7, A, B).r(4, 9, 8, 1, C);
            g.r(2, 7, 12, 2, B).r(3, 7, 10, 1, C);
            if !open {
                g.boxed(5, 1, 6, 6, C, B).r(6, 2, 2, 2, A);
            } else {
                g.r(6, 5, 4, 2, B);
            }
        }
        Shape::Tv => {
            g.boxed(1, 8, 14, 7, A, B);
            g.r(3, 9, 10, 5, if open { B } else { C });
            g.boxed(3, 1, 10, 7, A, B);
            g.r(4, 2, 8, 5, if open { B } else { C });
            if !open {
                g.r(5, 3, 2, 1, A).r(8, 5, 3, 1, A);
            }
            g.r(13, 12, 1, 1, A);
        }
        Shape::Table => {
            g.r(3, 3, 10, 9, B).r(2, 4, 12, 7, B).r(4, 4, 8, 7, A).r(5, 5, 6, 1, C).r(7, 12, 2, 3, B);
            if !open {
                g.r(6, 7, 4, 2, C);
            } else {
                g.r(10, 8, 2, 2, C);
                g.r(1, 12, 3, 3, B).r(2, 13, 1, 1, A);
            }
        }
    }
    g
}

fn decor(d: Decor) -> G {
    let mut g = G::new(T);
    match d {
        Decor::Plant => {
            g.boxed(4, 10, 8, 5, B, B).r(5, 10, 6, 1, C);
            g.r(7, 6, 2, 5, B).r(3, 2, 4, 5, A).r(9, 1, 4, 6, A).r(6, 0, 4, 5, C).r(4, 3, 1, 2, C);
        }
        Decor::Pillar => {
            g.boxed(2, 12, 12, 4, A, B).boxed(4, 0, 8, 13, A, B).r(5, 1, 2, 11, C).r(9, 1, 2, 11, B);
            g.boxed(2, 0, 12, 3, A, B).r(3, 1, 10, 1, C);
        }
        Decor::Mannequin => {
            g.r(7, 1, 3, 4, C).r(8, 1, 1, 4, B).r(5, 5, 7, 7, A).r(4, 5, 1, 4, A).r(12, 5, 1, 4, A);
            g.r(7, 12, 2, 2, B).r(4, 14, 8, 2, B).r(6, 7, 3, 1, C).r(5, 11, 7, 1, B);
        }
        Decor::Stand => {
            g.boxed(2, 7, 12, 8, A, B).r(3, 8, 10, 1, C).boxed(5, 2, 6, 5, C, B).r(6, 3, 2, 2, A);
        }
        Decor::Speaker => {
            g.boxed(3, 1, 10, 14, A, B).boxed(5, 2, 6, 3, B, B).r(6, 3, 4, 1, C);
            g.r(4, 6, 8, 8, B).r(5, 7, 6, 6, C).r(6, 8, 4, 4, B).r(7, 9, 2, 2, A);
        }
        Decor::Lamp => {
            g.r(7, 5, 2, 9, B).boxed(4, 14, 8, 2, A, B).boxed(3, 0, 10, 6, C, B).r(4, 1, 3, 2, A).r(7, 5, 2, 1, A);
        }
    }
    g
}

fn counter() -> G {
    let mut g = G::new(A);
    g.r(0, 0, 16, 4, C).r(0, 4, 16, 1, B).r(0, 5, 16, 1, B);
    g.r(0, 14, 16, 2, B).r(5, 7, 1, 6, B).r(10, 7, 1, 6, B).r(0, 6, 16, 1, C);
    g
}

fn door() -> G {
    let mut g = G::new(A);
    g.r(0, 0, 16, 1, C);
    g.r(0, 1, 2, 15, B).r(14, 1, 2, 15, B);
    g.r(2, 1, 12, 15, C).r(3, 2, 10, 14, A);
    g.r(3, 11, 10, 4, B).r(4, 12, 8, 2, C).r(6, 12, 4, 2, B);
    g.r(2, 1, 12, 1, B);
    g
}

fn door_mat() -> G {
    let mut g = G::new(B);
    g.r(1, 3, 14, 10, A).r(2, 4, 12, 8, B);
    for x in (3..13).step_by(2) {
        g.r(x, 5, 1, 6, C);
    }
    g
}

fn radar(on: bool) -> G {
    let mut g = G::new(T);
    let col = if on { C } else { A };
    g.r(6, 1, 4, 9, B).r(6, 12, 4, 3, B);
    g.r(7, 2, 2, 7, col).r(7, 13, 2, 1, col);
    if on {
        g.r(5, 0, 1, 1, A).r(10, 0, 1, 1, A).r(4, 7, 1, 1, A).r(11, 7, 1, 1, A);
    }
    g
}

fn fitting(open: bool) -> G {
    let mut g = G::new(T);
    g.boxed(1, 0, 14, 16, A, B);
    if !open {
        for x in (2..14).step_by(2) {
            g.r(x, 1, 1, 14, C);
            g.r(x + 1, 1, 1, 14, A);
        }
        g.r(2, 14, 12, 1, B);
    } else {
        g.r(2, 1, 12, 14, B).r(6, 3, 4, 4, C).r(7, 7, 2, 4, C);
        g.r(2, 1, 3, 14, A).r(3, 2, 1, 12, C);
        g.r(11, 12, 3, 2, C);
    }
    g
}

fn toyshelf(empty: bool) -> G {
    let mut g = G::new(T);
    g.boxed(0, 1, 16, 14, A, B).r(1, 7, 14, 1, B);
    if !empty {
        g.boxed(2, 2, 4, 4, C, B).boxed(7, 3, 3, 3, B, B).r(8, 4, 1, 1, C).boxed(11, 2, 3, 4, A, B);
        g.boxed(2, 9, 3, 4, A, B).boxed(6, 9, 4, 4, C, B).r(7, 10, 2, 1, B).boxed(11, 10, 3, 3, B, B).r(12, 11, 1, 1, C);
    } else {
        g.r(2, 6, 1, 1, C).r(11, 12, 2, 1, C);
    }
    g
}

fn booth(active: bool) -> G {
    let mut g = G::new(T);
    g.boxed(1, 1, 14, 14, A, B).r(2, 2, 12, 2, C);
    g.boxed(4, 5, 8, 6, if active { C } else { B }, B);
    g.r(3, 4, 1, 5, B).r(12, 4, 1, 5, B).r(4, 3, 8, 1, B);
    g.r(6, 12, 4, 2, B).r(7, 12, 2, 1, C);
    if active {
        g.r(6, 6, 1, 4, A).r(8, 7, 1, 2, A).r(10, 6, 1, 4, A);
    }
    g
}

fn pedestal() -> G {
    let mut g = G::new(T);
    g.boxed(2, 6, 12, 9, A, B).r(3, 7, 10, 2, C).r(4, 12, 8, 1, B);
    g.r(1, 5, 14, 2, B).r(2, 5, 12, 1, C);
    g
}

fn cave_floor() -> G {
    let mut g = G::new(A);
    g.p(3, 4, B).p(11, 9, B).p(7, 13, B).p(13, 2, C);
    g
}

fn cave_wall() -> G {
    let mut g = G::new(A);
    for y in (0..16).step_by(4) {
        g.r(0, y, 16, 1, B);
        let off = if (y / 4) % 2 == 0 { 4 } else { 12 };
        g.r(off, y, 1, 4, B);
    }
    g.r(1, 1, 2, 1, C).r(10, 5, 2, 1, C).r(6, 13, 2, 1, C);
    g
}

fn tv(frame: u8) -> G {
    let mut g = G::new(T);
    g.boxed(1, 2, 14, 12, A, B).r(3, 4, 8, 8, B);
    for y in 0..8 {
        for x in 0..8 {
            let h = (x * 7 + y * 13 + frame as i32 * 5) % 4;
            if h == 0 || (frame == 1 && (x + y) % 3 == 0) {
                g.p(3 + x, 4 + y, C);
            }
        }
    }
    g.r(12, 5, 2, 1, C).r(12, 8, 2, 1, C).r(4, 14, 8, 1, B);
    g
}

fn fire(frame: u8) -> G {
    let mut g = G::new(T);
    g.boxed(3, 11, 10, 4, A, B).r(4, 12, 8, 1, C);
    let h = if frame == 0 { 7 } else { 8 };
    g.r(5, 11 - h + 2, 6, h - 2, B).r(6, 11 - h + 1, 4, h - 1, A).r(7, 11 - h + 3, 2, h - 3, C);
    if frame == 1 {
        g.p(7, 1, A).p(10, 3, B);
    } else {
        g.p(6, 2, B).p(9, 1, A);
    }
    g
}

fn trap(on: bool) -> G {
    let mut g = G::new(A);
    g.boxed(2, 2, 12, 12, A, B);
    for y in [5, 7, 9, 11] {
        g.r(4, y, 8, 1, if on { C } else { B });
    }
    g
}

fn shadow() -> G {
    let mut g = G::new(T);
    for y in 0..16 {
        for x in 0..16 {
            let dx = x - 8;
            let dy = y - 12;
            if dx * dx + dy * dy * 3 < 40 && (x + y) % 2 == 0 {
                g.p(x, y, B);
            }
        }
    }
    g
}

pub fn defs() -> Vec<SpriteDef> {
    let mut v: Vec<SpriteDef> = Vec::new();
    let mut add = |name: String, g: &G, pal: [u8; 3]| v.push(g.def(name, pal));
    for t in themes() {
        let s = t.slug;
        add(format!("rt_{s}_floor_0"), &floor(t.floor_style, false), t.floor);
        add(format!("rt_{s}_floor_1"), &floor(t.floor_style, true), t.floor);
        add(format!("rt_{s}_wall"), &wall_side(), t.wall);
        add(format!("rt_{s}_wall_top"), &wall_top(), [t.wall[0], t.wall[1], t.top[0]]);
        add(format!("rt_{s}_fix_a_0"), &fixture(t.a.0, false), t.a.1);
        add(format!("rt_{s}_fix_a_1"), &fixture(t.a.0, true), t.a.1);
        add(format!("rt_{s}_fix_b_0"), &fixture(t.b.0, false), t.b.1);
        add(format!("rt_{s}_fix_b_1"), &fixture(t.b.0, true), t.b.1);
        add(format!("rt_{s}_counter"), &counter(), t.counter);
        add(format!("rt_{s}_decor_0"), &decor(t.decor[0].0), t.decor[0].1);
        add(format!("rt_{s}_decor_1"), &decor(t.decor[1].0), t.decor[1].1);
    }
    add("rt_door".into(), &door(), [0x27, 0x07, 0x37]);
    add("rt_door_mat".into(), &door_mat(), [0x16, 0x06, 0x26]);
    add("rt_radar_0".into(), &radar(false), [0x16, 0x0F, 0x26]);
    add("rt_radar_1".into(), &radar(true), [0x16, 0x0F, 0x38]);
    add("rt_fitting_0".into(), &fitting(false), [0x25, 0x05, 0x35]);
    add("rt_fitting_1".into(), &fitting(true), [0x25, 0x05, 0x35]);
    add("rt_toyshelf_0".into(), &toyshelf(false), [0x28, 0x17, 0x16]);
    add("rt_toyshelf_1".into(), &toyshelf(true), [0x28, 0x17, 0x16]);
    add("rt_booth_0".into(), &booth(false), [0x13, 0x0F, 0x10]);
    add("rt_booth_1".into(), &booth(true), [0x13, 0x0F, 0x38]);
    add("rt_pedestal".into(), &pedestal(), [0x10, 0x00, 0x30]);
    add("rt_cave_floor".into(), &cave_floor(), [0x0F, 0x00, 0x2D]);
    add("rt_cave_wall".into(), &cave_wall(), [0x17, 0x07, 0x27]);
    add("rt_tv_0".into(), &tv(0), [0x10, 0x0F, 0x30]);
    add("rt_tv_1".into(), &tv(1), [0x10, 0x0F, 0x30]);
    add("rt_fire_0".into(), &fire(0), [0x27, 0x16, 0x38]);
    add("rt_fire_1".into(), &fire(1), [0x27, 0x16, 0x38]);
    add("rt_trap_0".into(), &trap(false), [0x2D, 0x00, 0x10]);
    add("rt_trap_1".into(), &trap(true), [0x2D, 0x00, 0x16]);
    add("rt_shadow".into(), &shadow(), [0x0F, 0x0F, 0x0F]);
    v
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pixel::Sprite;

    #[test]
    fn all_required_present_at_16x16() {
        let d = defs();
        let mut need: Vec<String> = Vec::new();
        for t in themes() {
            for n in [
                "floor_0", "floor_1", "wall", "wall_top", "fix_a_0", "fix_a_1", "fix_b_0", "fix_b_1", "counter",
                "decor_0", "decor_1",
            ] {
                need.push(format!("rt_{}_{}", t.slug, n));
            }
        }
        for n in [
            "door", "door_mat", "radar_0", "radar_1", "fitting_0", "fitting_1", "toyshelf_0", "toyshelf_1", "booth_0",
            "booth_1", "pedestal", "cave_floor", "cave_wall", "tv_0", "tv_1", "fire_0", "fire_1", "trap_0", "trap_1",
            "shadow",
        ] {
            need.push(format!("rt_{n}"));
        }
        for n in need {
            let s = d.iter().find(|s| s.name == n).unwrap_or_else(|| panic!("missing {n}"));
            assert_eq!((s.w, s.h), (16, 16));
            assert!(Sprite::from_def(s).is_ok());
        }
    }
}
