//! OWNER: items art. Defines every sprite listed for owner `items` in manifest.rs (power-up icons, pickups,
//! bullets, effects and HUD icons). Everything is a char grid; a few effects are generated with plain maths
//! (no randomness, no DOM) so they stay deterministic.
//!
//! The procedural icons (spread, radar, cinnabomb, pretzel, package, puff) are ported by hand (same maths, same
//! expression order); the static grids (and the coin frames, which are a string recolour of a fixed grid) are
//! emitted mechanically from the TS source (/private/tmp/claude-502/art/x/gen.ts).

use super::registry::{sd, Def};
use crate::engine::num::round_i;
use crate::engine::palette::c;
use std::f64::consts::PI;

/// A small mutable pixel canvas for the procedurally drawn pieces.
struct Canvas {
    px: Vec<Vec<char>>,
    w: i32,
    h: i32,
}

impl Canvas {
    fn new(w: i32, h: i32) -> Canvas {
        Canvas { px: vec![vec!['.'; w as usize]; h as usize], w, h }
    }
    fn set(&mut self, x: i32, y: i32, ch: char) {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.px[y as usize][x as usize] = ch;
        }
    }
    fn get(&self, x: i32, y: i32) -> char {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.px[y as usize][x as usize]
        } else {
            '.'
        }
    }
    /// Surround every opaque pixel with `ch` on the empty 4-neighbours.
    fn outline(&mut self, ch: char) {
        let mut add: Vec<(i32, i32)> = Vec::new();
        for y in 0..self.h {
            for x in 0..self.w {
                if self.get(x, y) != '.' {
                    continue;
                }
                if self.get(x - 1, y) != '.' || self.get(x + 1, y) != '.' || self.get(x, y - 1) != '.' || self.get(x, y + 1) != '.' {
                    add.push((x, y));
                }
            }
        }
        for (x, y) in add {
            self.set(x, y, ch);
        }
    }
    /// Like `outline`, but only around the outside of the shape: holes stay open (flood fill from the border).
    fn outline_outer(&mut self, ch: char) {
        let mut outside: Vec<bool> = vec![false; ((self.w + 2) * (self.h + 2)) as usize];
        let mut stack: Vec<(i32, i32)> = Vec::new();
        let (w, h) = (self.w, self.h);
        fn push(cv: &Canvas, outside: &mut Vec<bool>, stack: &mut Vec<(i32, i32)>, x: i32, y: i32, w: i32, h: i32) {
            if x < -1 || y < -1 || x > w || y > h {
                return;
            }
            let k = ((y + 1) * (w + 2) + (x + 1)) as usize;
            if outside[k] || cv.get(x, y) != '.' {
                return;
            }
            outside[k] = true;
            stack.push((x, y));
        }
        push(self, &mut outside, &mut stack, -1, -1, w, h);
        while let Some((x, y)) = stack.pop() {
            push(self, &mut outside, &mut stack, x + 1, y, w, h);
            push(self, &mut outside, &mut stack, x - 1, y, w, h);
            push(self, &mut outside, &mut stack, x, y + 1, w, h);
            push(self, &mut outside, &mut stack, x, y - 1, w, h);
        }
        let mut add: Vec<(i32, i32)> = Vec::new();
        for y in 0..self.h {
            for x in 0..self.w {
                if self.get(x, y) != '.' || !outside[((y + 1) * (self.w + 2) + (x + 1)) as usize] {
                    continue;
                }
                if self.get(x - 1, y) != '.' || self.get(x + 1, y) != '.' || self.get(x, y - 1) != '.' || self.get(x, y + 1) != '.' {
                    add.push((x, y));
                }
            }
        }
        for (x, y) in add {
            self.set(x, y, ch);
        }
    }
    fn rows(&self) -> Vec<String> {
        self.px.iter().map(|r| r.iter().collect::<String>()).collect()
    }
}

// ------------------------------------------------------------------ power-up icons (12x12)
const K: u8 = c::BLACK;

// Spread Shot: three bullets fanning out of one point (drawn with a little maths)
fn spread() -> Vec<String> {
    let mut cv = Canvas::new(12, 12);
    let ox = 5.5_f64;
    let oy = 11.2_f64;
    for deg in [-42.0_f64, 0.0, 42.0] {
        let a = (deg * PI) / 180.0;
        let dx = a.sin();
        let dy = -a.cos();
        let mut t = 1.5_f64;
        while t <= 9.6 {
            for w in [-0.9_f64, 0.0, 0.9] {
                let x = (ox + dx * t - dy * w).floor() as i32;
                let y = (oy + dy * t + dx * w).floor() as i32;
                cv.set(x, y, if t > 7.0 { 'Y' } else { 'O' });
            }
            t += 0.25;
        }
    }
    cv.outline('K');
    cv.rows()
}

// Radar: a satellite dish (half-disc bowl on a post) sending out signal arcs
fn radar() -> Vec<String> {
    let mut cv = Canvas::new(12, 12);
    let phi = (-45.0_f64 * PI) / 180.0;
    let ux = phi.cos();
    let uy = phi.sin();
    let cx = 4.6_f64;
    let cy = 6.4_f64;
    for y in 0..12 {
        for x in 0..12 {
            let dx = x as f64 + 0.5 - cx - 0.5;
            let dy = y as f64 + 0.5 - cy - 0.5;
            let u = dx * ux + dy * uy;
            let v = -dx * uy + dy * ux;
            let a = u / 3.7;
            let b = v / 4.7;
            if u <= 0.3 && a * a + b * b <= 1.0 {
                cv.set(x, y, 'W');
            }
        }
    }
    // feed horn on a stalk pointing out of the bowl
    for t in 1..=4 {
        cv.set(round_i(cx + ux * t as f64), round_i(cy + uy * t as f64), 'K');
    }
    cv.outline('K');
    // post and base
    for (x, y) in [(3, 9), (4, 9), (3, 10), (4, 10)] {
        cv.set(x, y, 'K');
    }
    for x in 1..=6 {
        cv.set(x, 11, 'K');
    }
    // signal arcs
    for (x, y) in [(8, 1), (9, 1), (10, 2), (10, 3), (8, 3), (9, 4)] {
        cv.set(x, y, 'G');
    }
    cv.rows()
}

// Cinnabomb: a cinnamon bun (spiral icing lines) with a lit fuse
fn cinnabomb() -> Vec<String> {
    let mut cv = Canvas::new(12, 12);
    let cx = 5.2_f64;
    let cy = 7.0_f64;
    for y in 0..12 {
        for x in 0..12 {
            let dx = x as f64 - cx;
            let dy = y as f64 - cy;
            let r = dx.hypot(dy);
            if r > 4.9 {
                continue;
            }
            let th = dy.atan2(dx) + PI; // 0..2pi
            let phase = (r - (th / (2.0 * PI)) * 2.4) / 2.4;
            let frac = phase - phase.floor();
            cv.set(x, y, if frac < 0.34 && r > 0.8 { 'K' } else { 'A' });
        }
    }
    cv.outline('K');
    // fuse and spark
    for (x, y) in [(7, 1), (8, 1), (8, 0)] {
        cv.set(x, y, 'K');
    }
    cv.set(9, 0, 'W');
    cv.set(10, 1, 'W');
    cv.set(9, 2, 'W');
    cv.rows()
}

// Soft Pretzel: a 10x10 dough body (holes stay open), outlined on the outside only, with a little salt
fn pretzel() -> Vec<String> {
    let body = [
        ".OOO..OOO.",
        "OOOOOOOOOO",
        "OO..OO..OO",
        "OO..OO..OO",
        "OOO.OO.OOO",
        ".OOOOOOOO.",
        "..OOOOOO..",
        ".OOO..OOO.",
        "OOO....OOO",
        "OO......OO",
    ];
    let mut cv = Canvas::new(12, 12);
    for (y, row) in body.iter().enumerate() {
        for (x, ch) in row.chars().enumerate() {
            if ch != '.' {
                cv.set(x as i32 + 1, y as i32 + 1, ch);
            }
        }
    }
    cv.outline_outer('K');
    for (x, y) in [(3, 2), (7, 2), (1, 5), (10, 6), (6, 7), (3, 10)] {
        cv.set(x, y, 'W');
    }
    cv.rows()
}

// Package: a taped cardboard box in oblique view (lit top, front, dark side), with a shipping label
fn pkg() -> Vec<String> {
    let mut cv = Canvas::new(12, 12);
    for y in 4..=10 {
        for x in 1..=8 {
            cv.set(x, y, 'O'); // front
        }
    }
    for y in 2..=3 {
        for x in (1 + (4 - y))..=(8 + (4 - y)) {
            cv.set(x, y, 'P'); // top
        }
    }
    for x in 9..=10 {
        for y in (4 - (x - 8))..=(10 - (x - 8)) {
            cv.set(x, y, 'K'); // side
        }
    }
    // packing tape: down the front, across the top
    for y in 4..=10 {
        for x in [4, 5] {
            cv.set(x, y, 'P');
        }
    }
    for y in 2..=3 {
        for x in [4 + (4 - y), 5 + (4 - y)] {
            cv.set(x, y, 'O');
        }
    }
    // shipping label
    for (x, y) in [(6, 8), (7, 8), (6, 9), (7, 9)] {
        cv.set(x, y, 'P');
    }
    cv.set(7, 9, 'K');
    cv.outline_outer('K');
    cv.rows()
}

/// Smoke puff: a union of discs per frame; grey outline, white body, light-grey shading toward the lower right.
fn puff(discs: &[(f64, f64, f64)], outline_only: bool) -> Vec<String> {
    let mut cv = Canvas::new(16, 16);
    let inside = |x: i32, y: i32| -> bool { discs.iter().any(|&(cx, cy, r)| (x as f64 + 0.5 - cx).hypot(y as f64 + 0.5 - cy) <= r) };
    let edge = |x: i32, y: i32| -> bool { inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) };
    for y in 0..16 {
        for x in 0..16 {
            if !inside(x, y) {
                continue;
            }
            if edge(x, y) {
                cv.set(x, y, 'G');
            } else if outline_only {
                continue;
            } else {
                cv.set(x, y, if edge(x + 1, y) || edge(x, y + 1) || edge(x + 1, y + 1) { 'L' } else { 'W' });
            }
        }
    }
    cv.rows()
}

fn puff_frames() -> Vec<Vec<String>> {
    vec![
        puff(&[(8.0, 8.2, 3.5), (5.4, 9.2, 2.0), (10.6, 9.2, 2.0), (8.0, 5.6, 2.0)], false),
        puff(&[(8.0, 8.5, 4.4), (4.6, 10.0, 3.3), (11.4, 10.0, 3.3), (6.0, 5.4, 3.0), (10.2, 5.4, 3.0)], false),
        puff(
            &[(8.0, 2.9, 2.6), (13.1, 6.0, 2.7), (12.4, 12.0, 2.7), (8.0, 13.3, 2.6), (3.6, 12.0, 2.7), (2.9, 6.0, 2.7), (5.0, 3.6, 2.2), (11.0, 3.6, 2.2)],
            false,
        ),
        puff(
            &[(3.0, 3.5, 1.8), (13.0, 3.0, 1.6), (2.5, 12.0, 2.0), (13.5, 12.5, 1.9), (8.0, 1.6, 1.3), (8.0, 14.4, 1.3), (1.3, 8.0, 1.1), (14.7, 8.0, 1.1)],
            true,
        ),
    ]
}

fn icon(name: &str, pal: &[(char, u8)], rows: Vec<String>) -> Def {
    Def::rows(name, 12, 12, pal, rows)
}

/// Static grids (generated).
fn static_defs() -> Vec<Def> {
    vec![
    sd("item.rapid", 12, 12, &[('K', c::BLACK), ('Y', c::YELLOW), ('O', c::ORANGE)], &[
        &[
            "......KKKK..",
            ".....KYYYK..",
            "....KYYYK...",
            "...KYYYK....",
            "..KYYYYYYK..",
            ".KYYYYYYYK..",
            ".KKKKYYYK...",
            "....KYYOK...",
            "...KYYOK....",
            "..KYYOK.....",
            "..KYOK......",
            "..KKK.......",
        ],
    ]),
    sd("item.armor", 12, 12, &[('K', c::BLACK), ('B', c::BLUE), ('W', c::WHITE)], &[
        &[
            "..KK....KK..",
            ".KBBK..KBBK.",
            ".KBBBKKBBBK.",
            ".KBBBBBBBBK.",
            "..KBBBBBBK..",
            "..KBWWWWBK..",
            "..KBWWWWBK..",
            "..KBWWWWBK..",
            "..KBBBBBBK..",
            "..KBBBBBBK..",
            "..KBBBBBBK..",
            "...KKKKKK...",
        ],
    ]),
    sd("item.sneakers", 12, 12, &[('K', c::BLACK), ('W', c::WHITE), ('R', c::RED)], &[
        &[
            "............",
            ".KKKK.......",
            "KWWWWK......",
            "KWRRWK......",
            "KWWWWKKK....",
            "KWWRWWWWKK..",
            "KWWWWWWWWWK.",
            "KWWWWWWWWWWK",
            "KKKKKKKKKKKK",
            "KRRRRRRRRRRK",
            ".KKKKKKKKKK.",
            "............",
        ],
    ]),
    sd("item.oneup", 12, 12, &[('K', c::BLACK), ('R', c::RED), ('W', c::WHITE)], &[
        &[
            "............",
            "..KKK..KKK..",
            ".KRRRKKRRRK.",
            "KRWWRRRRRRRK",
            "KRWRRRRRRRRK",
            "KRRRRRRRRRRK",
            ".KRRRRRRRRK.",
            "..KRRRRRRK..",
            "...KRRRRK...",
            "....KRRK....",
            ".....KK.....",
            "............",
        ],
    ]),
    sd("item.ooze", 12, 12, &[('K', c::BLACK), ('O', c::ORANGE), ('W', c::WHITE)], &[
        &[
            ".......KK...",
            "......KWK...",
            "......KWK...",
            ".KKKKKKWKKK.",
            ".KWWWWWWWWK.",
            "..KOOOOOOK..",
            "..KOWOOOOK..",
            "..KOWOOOOK..",
            "...KOOOOK...",
            "...KOOOOK...",
            "....KKKK....",
            "............",
        ],
    ]),
    sd("item.joke", 12, 12, &[('K', c::BLACK), ('W', c::WHITE), ('R', c::RED)], &[
        &[
            "............",
            ".K.K.K.K.K..",
            "KRRRRRRRRRRK",
            "KWWWWWWWWWWK",
            "KWKKKKKKKWWK",
            "KWWWWWWWWWWK",
            "KWKKKKKWWWWK",
            "KWWWWWWWWWWK",
            "KWKKKWWRRWWK",
            ".K.K.K.K.K..",
            "............",
            "............",
        ],
    ]),
    sd("item.photostrip", 8, 12, &[('K', c::BLACK), ('W', c::WHITE), ('P', c::PEACH)], &[
        &[
            "KKKKKKKK",
            "KWWWWWWK",
            "KWPPPPWK",
            "KWPKKPWK",
            "KWWWWWWK",
            "KWPPPPWK",
            "KWPKKPWK",
            "KWWWWWWK",
            "KWPPPPWK",
            "KWPKKPWK",
            "KWWWWWWK",
            "KKKKKKKK",
        ],
    ]),
    sd("item.coin", 8, 8, &[('K', c::BLACK), ('W', c::WHITE), ('L', c::LTGRAY)], &[
        &[
            "..KKKK..",
            ".KWWWWK.",
            "KWWLLWWK",
            "KWWLLWLK",
            "KWWLLWLK",
            "KWWLLWLK",
            ".KWWWLK.",
            "..KKKK..",
        ],
        &[
            "...KK...",
            "..KWWK..",
            ".KWLLWK.",
            ".KWLLLK.",
            ".KWLLLK.",
            ".KWLLLK.",
            "..KWLK..",
            "...KK...",
        ],
        &[
            "...KK...",
            "..KLLK..",
            "..KLLK..",
            "..KLLK..",
            "..KLLK..",
            "..KLLK..",
            "..KLLK..",
            "...KK...",
        ],
        &[
            "...KK...",
            "..KLWK..",
            ".KLLWWK.",
            ".KLLLWK.",
            ".KLLLWK.",
            ".KLLLWK.",
            "..KLWK..",
            "...KK...",
        ],
    ]),
    sd("item.goldcoin", 8, 8, &[('K', c::BLACK), ('Y', c::YELLOW), ('O', c::ORANGE)], &[
        &[
            "..KKKK..",
            ".KYYYYK.",
            "KYYOOYYK",
            "KYYOOYOK",
            "KYYOOYOK",
            "KYYOOYOK",
            ".KYYYOK.",
            "..KKKK..",
        ],
        &[
            "...KK...",
            "..KYYK..",
            ".KYOOYK.",
            ".KYOOOK.",
            ".KYOOOK.",
            ".KYOOOK.",
            "..KYOK..",
            "...KK...",
        ],
        &[
            "...KK...",
            "..KOOK..",
            "..KOOK..",
            "..KOOK..",
            "..KOOK..",
            "..KOOK..",
            "..KOOK..",
            "...KK...",
        ],
        &[
            "...KK...",
            "..KOYK..",
            ".KOOYYK.",
            ".KOOOYK.",
            ".KOOOYK.",
            ".KOOOYK.",
            "..KOYK..",
            "...KK...",
        ],
    ]),
    sd("bullet.player", 5, 3, &[('K', c::BLACK), ('Y', c::YELLOW), ('W', c::WHITE)], &[
        &[
            ".KKK.",
            "YWWWW",
            ".KKK.",
        ],
    ]),
    sd("bullet.enemy", 5, 3, &[('K', c::BLACK), ('O', c::ORANGE), ('R', c::RED)], &[
        &[
            ".KKK.",
            "ORRRR",
            ".KKK.",
        ],
    ]),
    sd("fx.spark", 8, 8, &[('W', c::WHITE), ('Y', c::YELLOW), ('O', c::ORANGE)], &[
        &[
            "........",
            "........",
            "...YY...",
            "..YWWY..",
            "..YWWY..",
            "...YY...",
            "........",
            "........",
        ],
        &[
            "...WW...",
            "...YY...",
            ".W.YY.W.",
            "..YWWY..",
            "YYWWWWYY",
            "..YWWY..",
            ".W.YY.W.",
            "...WW...",
        ],
        &[
            ".O....O.",
            "........",
            "...O....",
            ".....O..",
            "..O.....",
            "....O...",
            "........",
            "O.....O.",
        ],
    ]),
    sd("fx.glass", 8, 8, &[('W', c::WHITE), ('C', c::CYAN)], &[
        &[
            "........",
            "...W.C..",
            "..CW.W..",
            ".W.CW...",
            "..C..W..",
            ".CW.C...",
            "...W....",
            "........",
        ],
        &[
            ".W....C.",
            "..C.W...",
            "....C..W",
            ".C.W....",
            "...C..C.",
            "W....W..",
            "..C.W...",
            ".W....C.",
        ],
        &[
            "........",
            "C......W",
            "..W..C..",
            "........",
            ".C....W.",
            ".......C",
            "W..C....",
            "..W....C",
        ],
    ]),
    sd("hud.head", 8, 8, &[('K', c::BLACK), ('P', c::PEACH), ('R', c::RED)], &[
        &[
            "..KKKK..",
            ".KKKKKK.",
            ".KKPPPP.",
            ".KKPKPP.",
            ".KPPPPPP",
            "..KPPP..",
            ".RRPPRR.",
            ".RRRRRR.",
        ],
    ]),
    sd("hud.armor", 8, 8, &[('K', c::BLACK), ('B', c::BLUE), ('W', c::WHITE)], &[
        &[
            ".KK..KK.",
            "KBBKKBBK",
            "KBBBBBBK",
            ".KBWWBK.",
            ".KBWWBK.",
            ".KBBBBK.",
            ".KBBBBK.",
            "..KKKK..",
        ],
    ]),
    sd("hud.radar", 8, 8, &[('K', c::BLACK), ('W', c::WHITE), ('G', c::GREEN)], &[
        &[
            "....G.G.",
            ".KK..G.G",
            "KWWK.G.G",
            "KWWWK.G.",
            "KWWWK...",
            ".KWK.K..",
            "..KK.K..",
            ".KKKKKK.",
        ],
    ]),    ]
}

pub fn defs() -> Vec<Def> {
    let mut st = static_defs();
    let mut take = |name: &str| -> Def {
        let i = st.iter().position(|d| d.name == name).unwrap_or_else(|| panic!("items: missing static def {}", name));
        st.remove(i)
    };
    vec![
        take("item.rapid"),
        icon("item.spread", &[('K', K), ('Y', c::YELLOW), ('O', c::ORANGE)], spread()),
        take("item.armor"),
        take("item.sneakers"),
        icon("item.radar", &[('K', K), ('W', c::WHITE), ('G', c::GREEN)], radar()),
        take("item.oneup"),
        icon("item.cinnabomb", &[('K', K), ('A', c::AMBER), ('W', c::WHITE)], cinnabomb()),
        take("item.ooze"),
        icon("item.pretzel", &[('K', K), ('O', c::OCHRE), ('W', c::WHITE)], pretzel()),
        icon("item.package", &[('K', K), ('O', c::OCHRE), ('P', c::PEACH)], pkg()),
        take("item.joke"),
        take("item.photostrip"),
        take("item.coin"),
        take("item.goldcoin"),
        take("bullet.player"),
        take("bullet.enemy"),
        take("fx.spark"),
        Def::frames("fx.puff", 16, 16, &[('W', c::WHITE), ('L', c::LTGRAY), ('G', c::GRAY)], puff_frames()),
        take("fx.glass"),
        take("hud.head"),
        take("hud.armor"),
        take("hud.radar"),
    ]
}
