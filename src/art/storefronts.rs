//! OWNER: storefronts art. Window displays (28x28, `win.<storeId>.L/R`) and the four door sprites (20x28).
//!
//! The sprites are built from tiny drawing helpers (`Grid`) plus hand-drawn stamps, then handed to the
//! registry as ordinary char-grid sprites (<= 3 colours + transparent, rows exactly w chars).
//!
//! TRICK: transparent pixels of a window show the window's backdrop, which `draw_storefront` fills with
//! `window_style(id).bg` (and a floor strip) first. So every window effectively has 4 colours: the 3 of the
//! sprite plus its backdrop. Closed stores' windows are frame-identical on purpose (nothing moves behind a
//! shutter), which also keeps "closed storefronts never blink" trivially true.
//!
//! Rust port notes: the TS registered these sprites into the global registry as a side effect. Here the
//! sprites are built once (`OnceLock`) and exposed through `sprites()` (hand them to the registry) and
//! `get_sprite(name)` (used by `storefront.rs`, so this module has no dependency on the registry).

use std::f64::consts::PI;
use std::sync::OnceLock;

use crate::content::stores::{StoreId, STORES};
use crate::engine::font::FONT_TINY;
use crate::engine::num::round_i;
use crate::engine::palette::c;
use super::registry::{build_def, Def};
use crate::engine::sprite::Sprite;

// ------------------------------------------------------------------------------------------ drawing helpers

type Rows<'a> = &'a [&'a str];

/// A small char canvas. '.' is transparent. All coordinates are whole pixels; out-of-range writes are ignored.
#[derive(Clone)]
struct Grid {
    w: i32,
    h: i32,
    cells: Vec<Vec<char>>,
}

impl Grid {
    fn new(w: i32, h: i32) -> Grid {
        Grid { w, h, cells: vec![vec!['.'; w as usize]; h as usize] }
    }
    fn px(&mut self, x: i32, y: i32, ch: char) -> &mut Self {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.cells[y as usize][x as usize] = ch;
        }
        self
    }
    fn get(&self, x: i32, y: i32) -> char {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.cells[y as usize][x as usize]
        } else {
            '.'
        }
    }
    fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, ch: char) -> &mut Self {
        for yy in 0..h {
            for xx in 0..w {
                self.px(x + xx, y + yy, ch);
            }
        }
        self
    }
    fn box_(&mut self, x: i32, y: i32, w: i32, h: i32, ch: char) -> &mut Self {
        self.rect(x, y, w, 1, ch).rect(x, y + h - 1, w, 1, ch).rect(x, y, 1, h, ch).rect(x + w - 1, y, 1, h, ch);
        self
    }
    fn hline(&mut self, x: i32, y: i32, w: i32, ch: char) -> &mut Self {
        self.rect(x, y, w, 1, ch)
    }
    fn vline(&mut self, x: i32, y: i32, h: i32, ch: char) -> &mut Self {
        self.rect(x, y, 1, h, ch)
    }
    fn line(&mut self, mut x0: i32, mut y0: i32, x1: i32, y1: i32, ch: char) -> &mut Self {
        let dx = (x1 - x0).abs();
        let dy = -(y1 - y0).abs();
        let sx = if x0 < x1 { 1 } else { -1 };
        let sy = if y0 < y1 { 1 } else { -1 };
        let mut err = dx + dy;
        loop {
            self.px(x0, y0, ch);
            if x0 == x1 && y0 == y1 {
                break;
            }
            let e2 = 2 * err;
            if e2 >= dy {
                err += dy;
                x0 += sx;
            }
            if e2 <= dx {
                err += dx;
                y0 += sy;
            }
        }
        self
    }
    /// Filled ellipse centred on (cx, cy) with radii rx, ry.
    fn ellipse(&mut self, cx: i32, cy: i32, rx: i32, ry: i32, ch: char) -> &mut Self {
        for yy in -ry..=ry {
            let span = (rx as f64 * (0.0f64).max(1.0 - ((yy * yy) as f64) / ((ry * ry) as f64 + 0.5)).sqrt() + 0.5).floor() as i32;
            self.hline(cx - span, cy + yy, span * 2 + 1, ch);
        }
        self
    }
    fn disc(&mut self, cx: i32, cy: i32, r: i32, ch: char) -> &mut Self {
        self.ellipse(cx, cy, r, r, ch)
    }
    /// Stamp a hand-drawn pattern with its top-left at (x, y). '.' and ' ' leave the canvas untouched.
    fn stamp<S: AsRef<str>>(&mut self, x: i32, y: i32, rows: &[S]) -> &mut Self {
        let w = rows[0].as_ref().chars().count();
        for (yy, row) in rows.iter().enumerate() {
            let row = row.as_ref();
            let chars: Vec<char> = row.chars().collect();
            if chars.len() != w {
                panic!("stamp row {} has {} chars, expected {}: \"{}\"", yy, chars.len(), w, row);
            }
            for (xx, &ch) in chars.iter().enumerate() {
                if ch == '.' || ch == ' ' {
                    continue;
                }
                self.px(x + xx as i32, y + yy as i32, ch);
            }
        }
        self
    }
    /// Tiny 3x5 text. With `narrow` the letter I is drawn 1 px wide and N as a 4 px diagonal, so long words
    /// ("CLOSING") fit a 28 px window and still read. Returns the x after the text.
    fn text(&mut self, mut x: i32, y: i32, s: &str, ch: char, narrow: bool) -> i32 {
        for cc in s.chars() {
            let special: Option<&[&str]> = if narrow { narrow_glyph(cc) } else { None };
            if let Some(special) = special {
                for (ry, row) in special.iter().enumerate() {
                    for (rx, b) in row.chars().enumerate() {
                        if b == 'X' {
                            self.px(x + rx as i32, y + ry as i32, ch);
                        }
                    }
                }
                x += special[0].len() as i32 + 1;
                continue;
            }
            let g = FONT_TINY.glyph(cc).or_else(|| FONT_TINY.glyph('?')).expect("tiny font has no '?'");
            for ry in 0..5 {
                for rx in 0..3 {
                    if g[ry as usize] & (1 << (2 - rx)) != 0 {
                        self.px(x + rx, y + ry, ch);
                    }
                }
            }
            x += 4;
        }
        x
    }
    /// Fill cells inside a rect with `ch` where (x + y + parity) is even: a checker dither.
    fn dither(&mut self, x: i32, y: i32, w: i32, h: i32, ch: char, parity: i32) -> &mut Self {
        for yy in 0..h {
            for xx in 0..w {
                if ((xx + yy + parity) & 1) == 0 {
                    self.px(x + xx, y + yy, ch);
                }
            }
        }
        self
    }
    fn rows(&self) -> Vec<String> {
        self.cells.iter().map(|r| r.iter().collect()).collect()
    }
}

fn narrow_glyph(c: char) -> Option<&'static [&'static str]> {
    match c {
        'I' => Some(&["X", "X", "X", "X", "X"]),
        'N' => Some(&["X..X", "XX.X", "X.XX", "X..X", "X..X"]),
        _ => None,
    }
}

/// Horizontal mirror of a stamp.
fn mirror(rows: Rows) -> Vec<String> {
    rows.iter().map(|r| r.chars().rev().collect()).collect()
}

/// Tiny deterministic LCG (static noise, sparkles). Never random: art must be reproducible.
struct Lcg {
    s: u32,
}
fn lcg(seed: u32) -> Lcg {
    Lcg { s: if seed == 0 { 1 } else { seed } }
}
impl Lcg {
    fn next(&mut self) -> u32 {
        self.s = self.s.wrapping_mul(1664525).wrapping_add(1013904223);
        self.s >> 16
    }
}

// ------------------------------------------------------------------------------------- registry plumbing

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Side {
    L,
    R,
}

impl Side {
    pub fn as_str(self) -> &'static str {
        match self {
            Side::L => "L",
            Side::R => "R",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WindowStyle {
    /// Window interior colour painted behind the sprite (transparent pixels show it).
    pub bg: u8,
    /// Colour of the 2-px floor strip at the bottom of the window interior.
    pub floor: u8,
}

struct Anim {
    name: String,
    /// Frames per animation step.
    period: i32,
    /// Sprite frame index sequence (ping-pong etc.).
    seq: Vec<i32>,
}

struct WinSpec<'a> {
    pal: &'a [(char, u8)],
    frames: Vec<Grid>,
    /// Frames per animation step (default 24 = 0.4 s).
    period: Option<i32>,
    /// Order in which frames are shown (default 0,1,2...).
    seq: Option<Vec<i32>>,
}

struct Built {
    defs: Vec<Def>,
    sprites: Vec<Sprite>,
    anims: Vec<Anim>,
    /// Backdrop per store (both windows of a store share it), indexed by `StoreId as usize`.
    styles: [Option<WindowStyle>; 13],
}

impl Built {
    /// TS `defs.push(...)`: remember the def and parse it (3-colour rule etc.) right away.
    fn push(&mut self, name: &str, w: i32, h: i32, pal: &[(char, u8)], frames: Vec<Vec<String>>) {
        let d = Def::frames(name, w, h, pal, frames);
        self.sprites.push(build_def(&d));
        self.defs.push(d);
    }

    fn define_window(&mut self, id: StoreId, side: Side, spec: WinSpec) {
        let name = format!("win.{}.{}", id.as_str(), side.as_str());
        let frames: Vec<Vec<String>> = spec.frames.iter().map(|g| g.rows()).collect();
        self.push(&name, 28, 28, spec.pal, frames);
        let seq = spec.seq.unwrap_or_else(|| (0..spec.frames.len() as i32).collect());
        self.anims.push(Anim { name, period: spec.period.unwrap_or(24), seq });
    }

    /// A window that never moves (closed stores): two identical frames.
    fn define_static_window(&mut self, id: StoreId, side: Side, pal: &[(char, u8)], g: Grid) {
        self.define_window(id, side, WinSpec { pal, frames: vec![g.clone(), g], seq: Some(vec![0]), period: Some(60) });
    }

    fn style(&mut self, id: StoreId, bg: u8, floor: u8) {
        self.styles[id as usize] = Some(WindowStyle { bg, floor });
    }
}

fn built() -> &'static Built {
    static BUILT: OnceLock<Built> = OnceLock::new();
    BUILT.get_or_init(build)
}

/// Backdrop for a store's windows.
pub fn window_style(id: StoreId) -> WindowStyle {
    built().styles[id as usize].expect("storefronts art: missing window style")
}

/// Which frame of `win.<id>.<side>` to show at simulation frame `frame`. Each store/side gets its own phase so
/// neighbouring stores do not tick in lockstep.
pub fn window_frame_index(id: StoreId, side: Side, frame: i32) -> i32 {
    let name = format!("win.{}.{}", id.as_str(), side.as_str());
    let a = match built().anims.iter().find(|a| a.name == name) {
        Some(a) => a,
        None => return 0,
    };
    let mut phase: i32 = if side == Side::R { 11 } else { 0 };
    for (i, ch) in id.as_str().chars().enumerate() {
        phase += ch as i32 * (i as i32 + 3);
    }
    let step = (frame.max(0) + (phase % a.period)) / a.period;
    a.seq[(step as usize) % a.seq.len()]
}

/// TS side-effect `defineSprites(defs)`: the defs for the registry (`art::all_defs` collects them).
pub fn defs() -> Vec<Def> {
    built().defs.clone()
}

/// All sprites this module defines (win.<id>.L/R for the 13 stores, door.target/powerup/closed/dark), in the
/// same order as the TS registered them.
pub fn sprites() -> Vec<Sprite> {
    built().sprites.clone()
}

/// Look a sprite of this module up by name (panics on unknown names, like the TS `getSprite`).
pub fn get_sprite(name: &str) -> &'static Sprite {
    built().sprites.iter().find(|s| s.name == name).unwrap_or_else(|| panic!("unknown sprite: {}", name))
}

// ------------------------------------------------------------------------------------------------ doors

/// Shared door layout. `full` grows the body to the full 20x28 (the bright, blinking frame).
fn door_grid(panel: char, line: char, handle: char, full: bool) -> Grid {
    let mut g = Grid::new(20, 28);
    if full {
        g.rect(0, 0, 20, 28, panel);
    } else {
        g.rect(1, 1, 18, 27, panel);
    }
    g.rect(4, 4, 12, 11, '.'); // glass pane: shows the dark shop interior
    g.box_(3, 3, 14, 13, line);
    g.line(6, 13, 9, 7, line); // glint on the glass
    g.line(8, 13, 11, 7, line);
    g.box_(3, 19, 14, 7, line); // lower panel
    g.rect(13, 16, 4, 2, handle); // handle
    g
}

fn shutter_grid() -> Grid {
    // L = lit slat, G = shaded slat, K = gap/rail
    let mut g = Grid::new(20, 28);
    g.rect(0, 0, 20, 28, 'K');
    g.rect(1, 0, 18, 3, 'G'); // roll housing
    g.hline(1, 0, 18, 'L');
    let mut y = 3;
    while y < 24 {
        g.rect(1, y, 18, 1, 'L');
        g.rect(1, y + 1, 18, 1, 'G');
        // gap row y+2 stays K
        y += 3;
    }
    g.rect(1, 24, 18, 4, 'G'); // bottom bar
    g.hline(1, 24, 18, 'L');
    g.rect(8, 25, 4, 2, 'K'); // handle slot
    g.rect(9, 26, 2, 1, 'L');
    g.vline(0, 0, 28, 'K');
    g.vline(19, 0, 28, 'K');
    g.px(3, 5, 'K').px(16, 11, 'K').px(6, 17, 'K'); // rivets / dents
    g
}

fn blank() -> Grid {
    Grid::new(28, 28)
}

fn build() -> Built {
    let mut b = Built { defs: Vec::new(), sprites: Vec::new(), anims: Vec::new(), styles: [None; 13] };

    // ---- doors
    // frame 0 = dim, frame 1 = bright (renderer blinks between them)
    let target_pal = [('D', c::BROWNRED), ('R', c::RED), ('Y', c::YELLOW)];
    b.push("door.target", 20, 28, &target_pal, vec![door_grid('D', 'R', 'Y', false).rows(), door_grid('R', 'D', 'Y', true).rows()]);
    let powerup_pal = [('B', c::BLUE), ('D', c::DKBLUE), ('W', c::WHITE)];
    let powerup = door_grid('B', 'D', 'W', false).stamp(7, 20, &["..W..", ".WWW.", "WWWWW", ".WWW.", ".W.W."]).rows();
    b.push("door.powerup", 20, 28, &powerup_pal, vec![powerup]);
    b.push("door.closed", 20, 28, &[('L', c::LTGRAY), ('G', c::GRAY), ('K', c::BLACK)], vec![shutter_grid().rows()]);
    b.push("door.dark", 20, 28, &[('N', c::BROWN), ('K', c::BLACK), ('G', c::GRAY)], vec![door_grid('N', 'K', 'G', false).rows()]);

    // ---- windows
    forever12(&mut b);
    radioshock(&mut b);
    crookstone(&mut b);
    gamestonk(&mut b);
    kgbtoys(&mut b);
    spenders(&mut b);
    sambaddy(&mut b);
    sharper(&mut b);
    hotspy(&mut b);
    footlock(&mut b);
    blockbluster(&mut b);
    circuitpity(&mut b);
    borderline(&mut b);

    // Every store must have both windows and a backdrop; fail loudly rather than at draw time.
    for s in STORES.iter() {
        for side in [Side::L, Side::R] {
            let name = format!("win.{}.{}", s.id.as_str(), side.as_str());
            if !b.anims.iter().any(|a| a.name == name) {
                panic!("storefronts art: missing window {}", name);
            }
        }
        if b.styles[s.id as usize].is_none() {
            panic!("storefronts art: missing window style for {}", s.id.as_str());
        }
    }
    b
}

// ---------------------------------------------------------------------------------------------- windows

// ---- FOREVER 12 (target): mannequins in outfits / a clothing rack
fn forever12(b: &mut Built) {
    b.style(StoreId::Forever12, c::PURPLE0, c::BLACK);
    let pal = [('W', c::WHITE), ('P', c::HOTPINK), ('Y', c::YELLOW)];
    let dress: &[&str] = &[
        "....WWW....",
        "....WWW....",
        "....WWW....",
        ".....W.....",
        "..WWWWWWW..",
        ".WPPPPPPPW.",
        ".WPPPPPPPW.",
        ".W.PPPPP.W.",
        ".W.YYYYY.W.",
        ".W.PPPPP.W.",
        "..PPPPPPP..",
        "..PPPYPPP..",
        ".PPPPPPPPP.",
        ".PPYPPPYPP.",
        "PPPPPPPPPPP",
        "PPPPYPPPPPP",
        "PPPPPPPPYPP",
        "PPPPPPPPPPP",
        "...W...W...",
        "...W...W...",
        "...W...W...",
        "..WWW.WWW..",
    ];
    let suit: &[&str] = &[
        "....WWW....",
        "....WWW....",
        "....WWW....",
        ".....W.....",
        ".YYYYYYYYY.",
        "YYYYWWWYYYY",
        "YYYYYWYYYYY",
        "YYYYYWYYYYY",
        "YY.YYYYY.YY",
        "YY.YYYYY.YY",
        "WW.YYYYY.WW",
        "...PPPPP...",
        "...PPPPP...",
        "...PP.PP...",
        "...PP.PP...",
        "...PP.PP...",
        "...PP.PP...",
        "...PP.PP...",
        "...PP.PP...",
        "...PP.PP...",
        "...PP.PP...",
        "..WWW.WWW..",
    ];
    fn spark(g: &mut Grid, x: i32, y: i32) {
        g.px(x, y, 'W').px(x - 1, y, 'W').px(x + 1, y, 'W').px(x, y - 1, 'W').px(x, y + 1, 'W');
    }
    let mannequins = |f: i32| -> Grid {
        let mut g = blank();
        g.stamp(2, 2, dress).stamp(15, 2, suit);
        if f == 0 {
            spark(&mut g, 6, 14);
        } else {
            spark(&mut g, 20, 8);
        }
        g
    };
    b.define_window(StoreId::Forever12, Side::L, WinSpec { pal: &pal, frames: vec![mannequins(0), mannequins(1)], period: Some(30), seq: None });

    let rack_frame = |f: i32| -> Grid {
        let mut g = blank();
        g.hline(2, 5, 24, 'W'); // rail
        g.vline(2, 6, 19, 'W').vline(25, 6, 19, 'W'); // uprights
        g.hline(1, 24, 5, 'W').hline(22, 24, 5, 'W'); // feet
        let garments: [(i32, &[&str]); 4] = [
            (4, &["PPPPP", "PPPPP", "PPPPP", ".PPP.", ".PPP.", ".PPP.", ".PPP.", ".PPP.", ".PPP."]),
            (9, &[".YYY.", "YYYYY", ".YYY.", ".YYY.", "YYYYY", "YYYYY", "YYYYY", "YYYYY", "YYYYY", "YYYYY", "YYYYY", "YYYYY", "YYYYY", "YYYYY"]),
            (14, &["WWWWW", "W.W.W", "WW.WW", "WW.WW", "WW.WW", "WWWWW", "WWWWW", "WWWWW", "WWWWW", "WWWWW", "WWWWW"]),
            (19, &["PPPPP", "PPPPP", "PPPPP", "PPPPP", "PPPPP", "PPPPP", "PPPPP"]),
        ];
        for (i, (gx, rows)) in garments.iter().enumerate() {
            g.px(gx + 2, 6, 'W'); // hook
            for (r, row) in rows.iter().enumerate() {
                let swing = if f == 1 && r >= 3 {
                    if i % 2 == 0 {
                        1
                    } else {
                        -1
                    }
                } else {
                    0
                };
                for (cc, ch) in row.chars().enumerate() {
                    if ch != '.' {
                        g.px(gx + cc as i32 + swing, 7 + r as i32, ch);
                    }
                }
            }
        }
        g
    };
    b.define_window(StoreId::Forever12, Side::R, WinSpec { pal: &pal, frames: vec![rack_frame(0), rack_frame(1)], period: Some(26), seq: None });
}

// ---- RADIOSHOCK (target): stacked TVs flickering with static / walkie-talkies
fn radioshock(b: &mut Built) {
    b.style(StoreId::Radioshock, c::DKBLUE, c::BLACK);
    let pal_l = [('G', c::LTGRAY), ('W', c::WHITE), ('K', c::BLACK)];
    fn tv(g: &mut Grid, x: i32, y: i32, rnd: &mut Lcg, feet: bool) {
        g.rect(x, y, 12, 9, 'G');
        for sy in 0..7 {
            for sx in 0..8 {
                g.px(x + 1 + sx, y + 1 + sy, if rnd.next() & 1 != 0 { 'W' } else { 'K' });
            }
        }
        g.px(x + 10, y + 2, 'K').px(x + 10, y + 5, 'K');
        if feet {
            g.hline(x + 1, y + 9, 2, 'K').hline(x + 9, y + 9, 2, 'K');
        }
    }
    let stack = |f: i32| -> Grid {
        let mut g = blank();
        let mut r = lcg((1000 + f * 77) as u32);
        tv(&mut g, 2, 15, &mut r, true);
        tv(&mut g, 14, 15, &mut r, true);
        tv(&mut g, 8, 6, &mut r, false);
        g.line(13, 5, 9, 1, 'G').line(14, 5, 18, 1, 'G');
        g.px(9, 0, 'W').px(18, 0, 'W');
        g
    };
    b.define_window(
        StoreId::Radioshock,
        Side::L,
        WinSpec { pal: &pal_l, frames: vec![stack(0), stack(1), stack(2)], period: Some(5), seq: Some(vec![0, 1, 2, 1, 0, 2]) },
    );

    let pal_r = [('G', c::LTGRAY), ('K', c::BLACK), ('R', c::RED)];
    fn walkie(g: &mut Grid, x: i32, h: i32, led: bool, w: i32) {
        let top = 24 - h + 1;
        g.vline(x + 1, top, 5, 'K'); // antenna
        g.rect(x, top + 5, w, h - 5, 'G'); // body
        let l = if led { 'R' } else { 'K' };
        g.px(x + w - 2, top + 5, l).px(x + w - 2, top + 6, l); // LED
        g.rect(x + 1, top + 8, w - 2, 1, 'K').rect(x + 1, top + 10, w - 2, 1, 'K').rect(x + 1, top + 12, w - 2, 1, 'K'); // grille
        g.rect(x + 2, top + 14, w - 4, 3, 'K'); // display
        g.px(x - 1, top + 9, 'K').px(x - 1, top + 10, 'K'); // push-to-talk
        g.hline(x + 1, top + h - 2, w - 2, 'K'); // keypad bar
    }
    let radios = |f: i32| -> Grid {
        let mut g = blank();
        walkie(&mut g, 3, 22, f == 0, 8);
        walkie(&mut g, 13, 19, f == 1, 8);
        walkie(&mut g, 22, 16, f == 0, 5);
        // radio waves
        if f == 0 {
            g.px(7, 1, 'G').px(8, 2, 'G').px(8, 3, 'G').px(7, 4, 'G').px(9, 0, 'G').px(10, 1, 'G').px(10, 4, 'G').px(9, 5, 'G');
        } else {
            g.px(17, 4, 'G').px(18, 5, 'G').px(18, 6, 'G').px(17, 7, 'G').px(19, 3, 'G').px(20, 4, 'G').px(20, 7, 'G').px(19, 8, 'G');
        }
        g
    };
    b.define_window(StoreId::Radioshock, Side::R, WinSpec { pal: &pal_r, frames: vec![radios(0), radios(1)], period: Some(18), seq: None });
}

// ---- CROOKSTONE (power-up): a massage chair / gadgets on pedestals
fn crookstone(b: &mut Built) {
    b.style(StoreId::Crookstone, c::DKTEAL, c::BLACK);
    let pal_l = [('O', c::ORANGE), ('Y', c::YELLOW), ('W', c::WHITE)];
    let chair = |f: i32| -> Grid {
        let mut g = blank();
        let dx = if f == 1 { 1 } else { 0 }; // the whole chair shudders
        for t in 0..6 {
            g.line(6 + t + dx, 5, 9 + t + dx, 18, 'O'); // backrest
        }
        g.rect(7 + dx, 2, 6, 4, 'O').px(7 + dx, 2, '.').px(12 + dx, 2, '.'); // headrest
        g.rect(10 + dx, 17, 11, 4, 'O'); // seat
        for t in 0..4 {
            g.line(20 + dx, 17 + t, 25 + dx, 19 + t, 'O'); // leg rest
        }
        g.rect(11 + dx, 13, 9, 3, 'Y'); // armrest
        g.rect(12 + dx, 21, 7, 3, 'Y'); // base
        g.rect(10 + dx, 24, 11, 1, 'Y');
        // vibration waves behind the chair
        for y in [6, 10, 14, 18] {
            let o = if (y as f64 / 4.0 + f as f64) % 2.0 == 0.0 { 0 } else { 1 };
            g.px(2 + o, y, 'W').px(3 + o, y + 1, 'W').px(2 + o, y + 2, 'W');
        }
        g
    };
    b.define_window(StoreId::Crookstone, Side::L, WinSpec { pal: &pal_l, frames: vec![chair(0), chair(1)], period: Some(6), seq: None });

    let pal_r = [('W', c::WHITE), ('C', c::CYAN), ('Y', c::YELLOW)];
    fn pedestal(g: &mut Grid, x: i32, h: i32) {
        let top = 24 - h + 1;
        g.hline(x, top, 7, 'W');
        g.rect(x + 1, top + 1, 5, h - 2, 'W');
        g.hline(x, 24, 7, 'W');
        g.px(x + 2, top + 2, '.').px(x + 2, top + 3, '.');
    }
    let gadgets = |f: i32| -> Grid {
        let mut g = blank();
        pedestal(&mut g, 1, 14); // tallest, y=11
        pedestal(&mut g, 10, 8); // y=17
        pedestal(&mut g, 19, 11); // y=14
        // crystal ball
        g.disc(4, 6, 4, 'C').px(2, 4, 'W').px(3, 3, 'W').px(2, 5, 'W');
        // drone with spinning rotor
        g.rect(11, 14, 5, 2, 'C').hline(10, 16, 7, 'C').px(12, 13, 'C').px(14, 13, 'C');
        if f == 0 {
            g.hline(9, 12, 9, 'W');
        } else {
            g.hline(11, 12, 5, 'W');
        }
        g.px(13, 11, 'W');
        // light bulb
        g.disc(22, 8, 3, 'Y').rect(21, 12, 3, 2, 'W');
        g.px(21, 7, 'W');
        if f == 0 {
            g.px(17, 5, 'Y').px(27, 8, 'Y').px(22, 3, 'Y').px(18, 11, 'Y');
        } else {
            g.px(18, 4, 'Y').px(26, 5, 'Y').px(22, 2, 'Y').px(26, 12, 'Y').px(6, 1, 'Y');
        }
        g
    };
    b.define_window(StoreId::Crookstone, Side::R, WinSpec { pal: &pal_r, frames: vec![gadgets(0), gadgets(1)], period: Some(14), seq: None });
}

// ---- GAMESTONK (power-up): a console stack and cartridges / a "TO THE MOON" poster and demo TV
fn gamestonk(b: &mut Built) {
    b.style(StoreId::Gamestonk, c::VIOLET, c::BLACK);
    let pal_l = [('G', c::LTGRAY), ('K', c::BLACK), ('R', c::RED)];
    fn console_(g: &mut Grid, y: i32, led: bool) {
        g.rect(2, y, 16, 5, 'G');
        g.hline(3, y + 2, 9, 'K'); // disc slot
        let l = if led { 'R' } else { 'K' };
        g.px(14, y + 2, l).px(15, y + 2, l);
        g.hline(3, y + 4, 14, 'K');
    }
    let consoles = |f: i32| -> Grid {
        let mut g = blank();
        console_(&mut g, 19, f == 0);
        console_(&mut g, 13, f == 1);
        console_(&mut g, 7, f == 2);
        // gamepad on the very top
        g.rect(4, 3, 12, 4, 'G').px(5, 3, '.').px(14, 3, '.');
        g.hline(5, 4, 3, 'K').vline(6, 3, 3, 'K');
        g.px(12, 4, 'R').px(14, 5, 'R');
        // cartridge
        g.rect(20, 15, 6, 10, 'K').rect(21, 16, 4, 4, 'R').hline(21, 22, 4, 'G').hline(21, 24, 4, 'G');
        // little spark of excitement from the cartridge
        if f == 1 {
            g.px(23, 12, 'G').px(23, 13, 'G').px(21, 13, 'G').px(25, 13, 'G');
        }
        g
    };
    b.define_window(StoreId::Gamestonk, Side::L, WinSpec { pal: &pal_l, frames: vec![consoles(0), consoles(1), consoles(2)], period: Some(14), seq: None });

    let pal_r = [('W', c::WHITE), ('K', c::BLACK), ('R', c::RED)];
    let poster = |f: i32| -> Grid {
        let mut g = blank();
        g.rect(1, 1, 26, 15, 'W').box_(1, 1, 26, 15, 'K');
        g.text(3, 3, "TO THE", 'K', false);
        g.text(3, 9, "MOON", 'K', false);
        // rocket
        g.stamp(21, 7, &["..R..", ".RRR.", ".RWR.", ".RRR.", "R.R.R", "R...R"]);
        if f == 1 {
            g.px(23, 13, 'K').px(23, 14, 'K');
        } else {
            g.px(22, 13, 'K').px(24, 13, 'K').px(23, 14, 'K');
        }
        // demo TV running a platformer
        g.rect(4, 17, 20, 9, 'K');
        g.rect(5, 18, 15, 6, 'W');
        g.px(21, 19, 'R').px(21, 21, 'R'); // knobs
        g.hline(5, 23, 15, 'K'); // ground
        g.rect(15, 21, 2, 2, 'K'); // pipe
        let px = [7, 10, 13][f as usize];
        let py = if f == 1 { 19 } else { 21 };
        g.rect(px, py, 2, 2, 'R');
        g
    };
    b.define_window(StoreId::Gamestonk, Side::R, WinSpec { pal: &pal_r, frames: vec![poster(0), poster(1), poster(2)], period: Some(16), seq: None });
}

// ---- KGB TOYS (target): teddy bears in fur hats / a robot and a toy rocket
fn kgbtoys(b: &mut Built) {
    b.style(StoreId::Kgbtoys, c::DKGREEN, c::BLACK);
    let pal_l = [('O', c::OCHRE), ('H', c::WHITE), ('R', c::RED)];
    let bear: &[&str] = &[
        "...HHHHH...",
        ".HHHHRHHHH.",
        "HHHRRRRRHHH",
        "HHHHRRRHHHH",
        "HHHRRHRRHHH",
        "HHHHHHHHHHH",
        "HOOOOOOOOOH",
        "HOO.OOO.OOH",
        "HOOOH.HOOOH",
        "HOOOHHHOOOH",
        ".OOOOOOOOO.",
        "OOOOOOOOOOO",
        "OOHHHHHHHOO",
        "OOHHHHHHHOO",
        ".OHHHHHHHO.",
        ".OHHHHHHHO.",
        "..OOOOOOO..",
        ".OOOO.OOOO.",
        ".HHOO.OOHH.",
    ];
    let bears = |f: i32| -> Grid {
        let mut g = blank();
        // bunting
        g.hline(1, 1, 26, 'H');
        for i in 0..6 {
            let col = if (i + f) % 2 == 0 { 'R' } else { 'H' };
            g.hline(2 + i * 4, 2, 3, col).px(3 + i * 4, 3, col);
        }
        g.stamp(2, 6, bear).stamp(15, 6, bear);
        if f == 1 {
            // bear 1 waves, bear 2 blinks
            for (x, y) in [(11, 18), (12, 18), (11, 19), (12, 19)] {
                g.px(x, y, '.');
            }
            for (x, y) in [(12, 17), (13, 17), (13, 16), (13, 15), (13, 14)] {
                g.px(x, y, 'O');
            }
            g.px(13, 13, 'H');
            g.px(18, 13, 'O').px(22, 13, 'O');
        }
        g
    };
    b.define_window(StoreId::Kgbtoys, Side::L, WinSpec { pal: &pal_l, frames: vec![bears(0), bears(1)], period: Some(22), seq: None });

    let pal_r = [('G', c::LTGRAY), ('R', c::RED), ('Y', c::YELLOW)];
    let robot: &[&str] = &[
        ".....YY.....",
        "......G.....",
        "..GGGGGGGG..",
        "..GYYGGYYG..",
        "..GYYGGYYG..",
        "..GGGGGGGG..",
        "..G.G..G.G..",
        "..GGGGGGGG..",
        "....GGGG....",
        ".GGGGGGGGGG.",
        "GG.GGGGGG.GG",
        "GG.GRRGGG.GG",
        "GG.GRRGYY.GG",
        "GG.GGGGGG.GG",
        ".G.GGGGGG.G.",
        "...GGGGGG...",
        "...GG..GG...",
        "...GG..GG...",
        "...GG..GG...",
        "..GGG..GGG..",
    ];
    let toys = |f: i32| -> Grid {
        let mut g = blank();
        g.stamp(2, 5, robot);
        if f == 1 {
            g.px(5, 8, 'G').px(6, 8, 'G').px(5, 9, 'G').px(6, 9, 'G'); // eyes dim
            g.px(2, 15, '.').px(3, 15, '.').px(2, 16, '.').px(3, 16, '.').px(2, 17, '.').px(3, 17, '.'); // left arm up
            g.px(1, 13, 'G').px(1, 12, 'G').px(1, 11, 'G').px(2, 11, 'G');
        }
        // rocket on a stand
        g.stamp(
            17,
            3,
            &["...RR...", "..RRRR..", "..RRRR..", "..GGGG..", "..GYYG..", "..GGGG..", "..RRRR..", "..GGGG..", ".RGGGGR.", "RRGGGGRR", "RR.GG.RR"],
        );
        let flame = [3, 5, 4][(f % 3) as usize];
        for i in 0..flame {
            g.hline(20 + if i > 2 { 1 } else { 0 }, 14 + i, if i > 2 { 2 } else { 4 }, 'Y');
        }
        g.vline(20, 20, 4, 'G').vline(21, 20, 4, 'G').hline(17, 24, 8, 'G');
        g
    };
    b.define_window(StoreId::Kgbtoys, Side::R, WinSpec { pal: &pal_r, frames: vec![toys(0), toys(1)], period: Some(12), seq: None });
}

// ---- SPENDER'S GIFTS (power-up): an animated lava lamp / a plasma ball
fn spenders(b: &mut Built) {
    b.style(StoreId::Spenders, c::BLACK, c::PURPLE0);
    let pal_l = [('G', c::LTGRAY), ('P', c::HOTPINK), ('Y', c::YELLOW)];
    fn hw(y: i32) -> i32 {
        if y <= 8 {
            3
        } else if y <= 12 {
            4
        } else if y <= 16 {
            5
        } else {
            6
        }
    }
    let lamp = |f: i32| -> Grid {
        let mut g = blank();
        let cx = 14;
        g.hline(cx - 1, 1, 3, 'G').hline(cx - 2, 2, 5, 'G').hline(cx - 3, 3, 7, 'G'); // cap
        for y in 4..=19 {
            g.hline(cx - hw(y), y, hw(y) * 2 + 1, 'P'); // liquid in the glass
        }
        for (y, w) in [(20, 5), (21, 4), (22, 5), (23, 6), (24, 7)] {
            g.hline(cx - w, y, w * 2 + 1, 'G'); // base
        }
        let blobs: [[(i32, i32, i32, i32); 3]; 3] = [
            [(13, 17, 3, 2), (16, 7, 2, 2), (12, 12, 1, 1)],
            [(13, 13, 3, 3), (15, 9, 2, 2), (15, 16, 1, 1)],
            [(14, 9, 3, 3), (12, 14, 2, 2), (13, 18, 2, 1)],
        ];
        let mask = g.rows();
        for (bx, by, rx, ry) in blobs[f as usize] {
            let mut bb = Grid::new(28, 28);
            bb.ellipse(bx, by, rx, ry, 'Y');
            for y in 0..28 {
                for x in 0..28 {
                    if bb.get(x, y) == 'Y' && mask[y as usize].as_bytes()[x as usize] == b'P' {
                        g.px(x, y, 'Y');
                    }
                }
            }
        }
        // glow flickering around the lamp
        for y in 5..=19 {
            if (y + f) % 3 == 0 {
                g.px(cx - hw(y) - 2, y, 'P').px(cx + hw(y) + 2, y, 'P');
            }
        }
        g
    };
    b.define_window(
        StoreId::Spenders,
        Side::L,
        WinSpec { pal: &pal_l, frames: vec![lamp(0), lamp(1), lamp(2)], period: Some(22), seq: Some(vec![0, 1, 2, 1]) },
    );

    let pal_r = [('V', c::LAVENDER), ('W', c::WHITE), ('P', c::HOTPINK)];
    let plasma = |f: i32| -> Grid {
        let mut g = blank();
        let cx = 14;
        let cy = 11;
        g.disc(cx, cy, 10, 'V').disc(cx, cy, 9, '.');
        for (y, w) in [(21, 4), (22, 5), (23, 6), (24, 7), (25, 7)] {
            g.hline(cx - w, y, w * 2 + 1, 'V');
        }
        let angles: [[i32; 6]; 3] = [[-80, -20, 35, 100, 160, 215], [-115, -55, 5, 75, 140, 200], [-65, -5, 55, 125, 180, 245]];
        let mut rnd = lcg((90 + f) as u32);
        for deg in angles[f as usize] {
            let a = (deg as f64 * PI) / 180.0;
            let rx = round_i(cx as f64 + 8.5 * a.cos());
            let ry = round_i(cy as f64 + 8.5 * a.sin());
            let jitter = (rnd.next() % 5) as i32 - 2;
            let mx = round_i((cx + rx) as f64 / 2.0 - a.sin() * jitter as f64);
            let my = round_i((cy + ry) as f64 / 2.0 + a.cos() * jitter as f64);
            g.line(cx, cy, mx, my, 'W').line(mx, my, rx, ry, 'W');
        }
        g.disc(cx, cy, 2, 'P').px(cx, cy, 'W');
        g.px(8, 5, 'W').px(9, 4, 'W').px(8, 6, 'W'); // glass reflection
        g
    };
    b.define_window(
        StoreId::Spenders,
        Side::R,
        WinSpec { pal: &pal_r, frames: vec![plasma(0), plasma(1), plasma(2)], period: Some(5), seq: Some(vec![0, 1, 2, 1]) },
    );
}

// ---- SAM BADDY (target): tapes and vinyl / a boombox with bouncing speakers
fn sambaddy(b: &mut Built) {
    b.style(StoreId::Sambaddy, c::CRIMSON, c::BLACK);
    let pal_l = [('K', c::BLACK), ('L', c::LTGRAY), ('Y', c::YELLOW)];
    let vinyl = |f: i32| -> Grid {
        let mut g = blank();
        g.disc(9, 10, 8, 'K');
        for base in [f * 35 + 200, f * 35 + 20] {
            let mut d = 0;
            while d < 55 {
                let a = ((base + d) as f64 * PI) / 180.0;
                g.px(round_i(9.0 + 6.0 * a.cos()), round_i(10.0 + 6.0 * a.sin()), 'L');
                d += 8;
            }
        }
        g.disc(9, 10, 3, 'Y').px(9, 10, '.');
        // cassette on the right, stacked on another
        g.rect(14, 3, 13, 8, 'L').rect(15, 4, 11, 3, 'Y').rect(17, 8, 7, 2, 'K').px(18, 9, 'L').px(22, 9, 'L');
        g.rect(11, 16, 16, 9, 'L').rect(12, 17, 14, 3, 'Y').rect(14, 20, 10, 4, 'K');
        let spokes: [[(i32, i32); 3]; 3] = [[(-1, 0), (0, 0), (1, 0)], [(0, -1), (0, 0), (0, 1)], [(-1, -1), (0, 0), (1, 1)]];
        for cxr in [17, 22] {
            for (dx, dy) in spokes[((f + if cxr == 22 { 1 } else { 0 }) % 3) as usize] {
                g.px(cxr + dx, 22 + dy, 'L');
            }
        }
        g
    };
    b.define_window(StoreId::Sambaddy, Side::L, WinSpec { pal: &pal_l, frames: vec![vinyl(0), vinyl(1), vinyl(2)], period: Some(10), seq: None });

    let pal_r = [('L', c::LTGRAY), ('K', c::BLACK), ('Y', c::YELLOW)];
    let boombox = |f: i32| -> Grid {
        let mut g = blank();
        let hop = if f == 1 { -1 } else { 0 };
        let y0 = 10 + hop;
        g.rect(2, y0, 24, 14, 'L');
        g.hline(7, y0 - 3, 14, 'K').vline(7, y0 - 2, 2, 'K').vline(20, y0 - 2, 2, 'K'); // handle
        g.line(23, y0, 26, y0 - 7, 'K').px(26, y0 - 8, 'Y'); // antenna
        let cone = |g: &mut Grid, cx: i32| {
            g.disc(cx, y0 + 7, 4, 'K').disc(cx, y0 + 7, 3, 'L').disc(cx, y0 + 7, 2, 'K');
            if f == 0 {
                g.px(cx, y0 + 7, 'L');
            } else if f == 1 {
                g.disc(cx, y0 + 7, 1, 'L');
            } else {
                g.disc(cx, y0 + 7, 2, 'L');
            }
        };
        cone(&mut g, 7);
        cone(&mut g, 20);
        g.rect(12, y0 + 2, 5, 5, 'K'); // cassette deck window
        g.px(13, y0 + 4, 'L').px(15, y0 + 4, 'L');
        g.hline(12, y0 + 9, 5, 'Y').px(14, y0 + 10, 'K'); // tuner dial
        g.px(12, y0 + 12, 'K').px(14, y0 + 12, 'K').px(16, y0 + 12, 'K'); // buttons
        // music notes
        let note = |g: &mut Grid, x: i32, y: i32| {
            g.px(x + 1, y, 'Y').px(x + 2, y, 'Y').px(x + 1, y + 1, 'Y').px(x + 1, y + 2, 'Y').px(x, y + 3, 'Y').px(x + 1, y + 3, 'Y');
        };
        if f == 0 {
            note(&mut g, 1, 2);
        } else if f == 1 {
            note(&mut g, 10, 0);
        } else {
            note(&mut g, 4, 0);
        }
        g
    };
    b.define_window(StoreId::Sambaddy, Side::R, WinSpec { pal: &pal_r, frames: vec![boombox(0), boombox(1), boombox(2)], period: Some(8), seq: None });
}

// ---- SHARPER IMAGINE (power-up): a robot vacuum / a pulsing glowing orb
fn sharper(b: &mut Built) {
    b.style(StoreId::Sharper, c::BLACK, c::MDGRAY);
    let pal_l = [('W', c::WHITE), ('G', c::LTGRAY), ('C', c::CYAN)];
    let vac = |f: i32| -> Grid {
        let mut g = blank();
        let cx = [11, 14, 17][f as usize];
        // dust bunnies waiting to be eaten
        g.px(25, 22, 'G').px(24, 23, 'G').px(26, 23, 'G').px(25, 24, 'G').px(23, 24, 'G');
        g.ellipse(cx, 17, 9, 6, 'G').ellipse(cx, 15, 9, 6, 'G').ellipse(cx, 15, 8, 5, 'W'); // body, dark rim and side wall
        g.ellipse(cx, 18, 7, 2, 'G');
        g.ellipse(cx, 14, 5, 3, 'G').ellipse(cx, 14, 4, 2, 'W'); // big round top button ring
        g.ellipse(cx, 14, 1, 1, 'C'); // glowing button
        g.px(cx + 8, 12, 'G').px(cx + 8, 13, 'C').px(cx + 8, 14, 'C').px(cx + 8, 15, 'C').px(cx + 8, 16, 'G'); // front bumper sensor
        g.px(cx - 6, 12, 'C'); // status light
        // spinning side brush
        if f == 1 {
            g.px(cx + 8, 20, 'G').px(cx + 7, 19, 'G').px(cx + 9, 21, 'G').px(cx + 7, 21, 'G').px(cx + 9, 19, 'G');
        } else {
            g.px(cx + 8, 19, 'G').px(cx + 8, 20, 'G').px(cx + 8, 21, 'G').px(cx + 7, 20, 'G').px(cx + 9, 20, 'G');
        }
        // speed lines and a sparkle on the clean floor
        g.hline(cx - 15, 14, 3, 'G').hline(cx - 14, 17, 4, 'G').px(cx - 12, 22, 'C').px(cx - 13, 23, 'C');
        g.px(3, 4, 'C').px(4, 3, 'C').px(4, 5, 'C').px(5, 4, 'C').px(4, 4, 'W');
        g
    };
    b.define_window(
        StoreId::Sharper,
        Side::L,
        WinSpec { pal: &pal_l, frames: vec![vac(0), vac(1), vac(2)], period: Some(10), seq: Some(vec![0, 1, 2, 1]) },
    );

    let pal_r = [('W', c::WHITE), ('C', c::CYAN), ('B', c::BLUE)];
    let orb = |f: i32| -> Grid {
        let mut g = blank();
        let cx = 14;
        let cy = 10;
        let ring_out = [7, 9, 12][f as usize];
        for y in 0..28 {
            for x in 0..28 {
                let d = ((x - cx) as f64).hypot((y - cy) as f64);
                if d > 5.5 && d <= ring_out as f64 && (x + y + f) % 2 == 0 && (f == 2 || d <= ring_out as f64) {
                    g.px(x, y, 'B');
                }
            }
        }
        g.disc(cx, cy, 5, 'C').px(cx - 2, cy - 3, 'W').px(cx - 3, cy - 2, 'W').px(cx - 2, cy - 2, 'W');
        if f == 2 {
            g.px(cx, cy, 'W').px(cx + 1, cy, 'W');
        }
        // pedestal
        g.hline(10, 17, 9, 'W').rect(12, 18, 5, 4, 'W').hline(9, 22, 11, 'W').hline(8, 23, 13, 'W').hline(8, 24, 13, 'W');
        g
    };
    b.define_window(
        StoreId::Sharper,
        Side::R,
        WinSpec { pal: &pal_r, frames: vec![orb(0), orb(1), orb(2)], period: Some(12), seq: Some(vec![0, 1, 2, 1]) },
    );
}

// ---- HOT SPY ON A STICK (target): a lemonade tub being pumped / corn dogs
fn hotspy(b: &mut Built) {
    b.style(StoreId::Hotspy, c::MAROON, c::BLACK);
    let pal_l = [('Y', c::YELLOW), ('W', c::WHITE), ('R', c::RED)];
    let tub = |f: i32| -> Grid {
        let mut g = blank();
        // pump handle and stem
        let hy = [1, 3, 5][f as usize];
        g.hline(5, hy, 9, 'W').vline(9, hy + 1, 7 - hy, 'W');
        // a whole lemon on the lid
        g.ellipse(14, 5, 3, 2, 'Y').px(10, 5, 'Y').px(18, 5, 'Y').px(13, 4, 'W');
        // lid and tub
        g.rect(0, 7, 19, 3, 'R');
        g.rect(1, 10, 17, 15, 'W').rect(2, 10, 15, 14, 'Y');
        // lemon slices floating in the lemonade
        for (lx, ly) in [(6, 15), (12, 20)] {
            g.disc(lx, ly, 3, 'W').disc(lx, ly, 2, 'Y').vline(lx, ly - 2, 5, 'W').hline(lx - 2, ly, 5, 'W');
        }
        g.px(13, 13, 'W').px(4, 21, 'W').px(9, 12, 'W').px(15, 16, 'W'); // bubbles
        // spout, stream and cup
        g.hline(18, 13, 4, 'W').px(21, 14, 'W');
        let level = [1, 3, 5][f as usize];
        g.rect(19, 18, 7, 7, 'W').rect(20, 18, 5, 6, '.');
        g.rect(20, 24 - level, 5, level, 'Y');
        if f > 0 {
            g.vline(21, 15, 24 - level - 15, 'Y');
        }
        g
    };
    b.define_window(
        StoreId::Hotspy,
        Side::L,
        WinSpec { pal: &pal_l, frames: vec![tub(0), tub(1), tub(2)], period: Some(12), seq: Some(vec![0, 1, 2, 1]) },
    );

    let pal_r = [('A', c::AMBER), ('W', c::WHITE), ('R', c::RED)];
    let dogs = |f: i32| -> Grid {
        let mut g = blank();
        let tops = [5, 3, 6, 4, 7];
        for (i, top) in tops.iter().enumerate() {
            let top = *top;
            let x = 2 + i as i32 * 5;
            g.hline(x + 1, top, 2, 'A').rect(x, top + 1, 4, 10, 'A');
            g.vline(x + 1, top + 11, 24 - (top + 11), 'W'); // stick
            for k in 0..4 {
                g.px(x + 1 + (k % 2), top + 3 + k * 2, 'R'); // ketchup zig-zag
            }
        }
        g.rect(1, 19, 26, 6, 'R').hline(1, 21, 26, 'W');
        // steam
        let sx = if f == 0 { [4, 14] } else { [9, 19] };
        for x in sx {
            g.px(x, 1, 'W').px(x + 1, 0, 'W').px(x, 2, 'W');
        }
        g
    };
    b.define_window(StoreId::Hotspy, Side::R, WinSpec { pal: &pal_r, frames: vec![dogs(0), dogs(1)], period: Some(18), seq: None });
}

// ---- FOOT LOCKPICKER (target): a wall of sneakers / basketballs and a jersey
fn footlock(b: &mut Built) {
    b.style(StoreId::Footlock, c::GRAY, c::BLACK);
    let pal_l = [('W', c::WHITE), ('R', c::RED), ('K', c::BLACK)];
    fn shoe(a: char, bb: char) -> Vec<String> {
        vec![
            format!("{bb}{bb}{bb}{bb}........"),
            format!("{bb}{bb}{bb}{bb}{bb}......."),
            format!("{bb}{bb}{bb}{bb}{bb}{bb}{bb}....."),
            format!("{bb}{bb}{a}{a}{a}{bb}{bb}{bb}{bb}{bb}.."),
            format!("{bb}{bb}{bb}{bb}{bb}{bb}{bb}{bb}{bb}{bb}{bb}."),
            "KKKKKKKKKKKK".to_string(),
        ]
    }
    let wall = |f: i32| -> Grid {
        let mut g = blank();
        let rows: [(char, char); 3] = [('R', 'W'), ('W', 'R'), ('R', 'W')];
        for (i, shelf) in [8, 16, 24].iter().enumerate() {
            let shelf = *shelf;
            let (acc, body) = rows[i];
            let sh = shoe(acc, body);
            let sh_refs: Vec<&str> = sh.iter().map(|s| s.as_str()).collect();
            let mir = mirror(&sh_refs);
            let (left, right) = if i % 2 == 0 { (&sh, &mir) } else { (&mir, &sh) };
            g.stamp(1, shelf - 6, left).stamp(15, shelf - 6, right);
            for x in 1..27 {
                g.px(x, shelf, if (x + f) % 3 == 0 { 'R' } else { 'K' });
            }
        }
        g
    };
    b.define_window(StoreId::Footlock, Side::L, WinSpec { pal: &pal_l, frames: vec![wall(0), wall(1), wall(2)], period: Some(7), seq: None });

    let pal_r = [('B', c::BLUE), ('W', c::WHITE), ('O', c::ORANGE)];
    let ball_y = [21, 15, 9];
    let gear = |f: i32| -> Grid {
        let mut g = blank();
        // jersey on a hanger
        g.px(6, 1, 'W').line(6, 2, 3, 4, 'W').line(6, 2, 9, 4, 'W');
        let x0 = 1;
        let y0 = 5;
        g.rect(x0, y0, 11, 16, 'B');
        g.rect(x0, y0, 2, 5, '.').rect(x0 + 9, y0, 2, 5, '.'); // armholes
        g.rect(x0 + 4, y0, 3, 3, '.').px(x0 + 3, y0, '.').px(x0 + 7, y0, '.').hline(x0 + 3, y0 + 3, 5, 'B'); // neck
        g.hline(x0 + 4, y0 + 3, 3, 'W').hline(x0, y0 + 15, 11, 'W');
        g.text(x0 + 2, y0 + 6, "10", 'W', false);
        // basketballs
        let ball = |g: &mut Grid, cx: i32, cy: i32| {
            g.disc(cx, cy, 3, 'O').vline(cx, cy - 3, 7, '.').hline(cx - 3, cy, 7, '.');
        };
        ball(&mut g, 16, 21);
        ball(&mut g, 23, ball_y[f as usize]);
        g
    };
    b.define_window(
        StoreId::Footlock,
        Side::R,
        WinSpec { pal: &pal_r, frames: vec![gear(0), gear(1), gear(2)], period: Some(6), seq: Some(vec![0, 1, 2, 1]) },
    );
}

// ---- BLOCKBLUSTER VIDEO (closed): a faded VHS poster / a FOR LEASE sign
fn blockbluster(b: &mut Built) {
    b.style(StoreId::Blockbluster, c::BLACK, c::GRAY);
    let pal = [('L', c::LTGRAY), ('G', c::GRAY), ('D', c::DKBLUE)];
    let mut rnd = lcg(1984);
    let mut poster = blank();
    poster.dither(5, 2, 18, 23, 'D', 0); // sun-bleached paper
    poster.box_(5, 2, 18, 23, 'G');
    poster.box_(7, 5, 14, 9, 'L').rect(8, 6, 12, 3, 'G').rect(9, 10, 10, 3, 'G');
    poster.px(11, 11, 'L').px(12, 11, 'L').px(16, 11, 'L').px(17, 11, 'L');
    // the faded colours of a hundred summers: knock out some pixels
    for y in 0..28 {
        for x in 0..28 {
            if poster.get(x, y) != '.' && rnd.next() % 100 < 16 {
                poster.px(x, y, '.');
            }
        }
    }
    poster.text(8, 17, "VHS", 'L', false);
    // torn, curling corner
    for y in 21..=24 {
        poster.hline(22 - (y - 21) - 1, y, 5 + (y - 21), '.');
    }
    poster.px(21, 20, 'G').px(20, 21, 'G').px(19, 22, 'G').px(18, 23, 'G').px(17, 24, 'G');
    b.define_static_window(StoreId::Blockbluster, Side::L, &pal, poster);

    let pal_r = [('L', c::LTGRAY), ('K', c::BLACK), ('G', c::GRAY)];
    let mut sign = blank();
    let mut y = 1;
    while y < 7 {
        sign.px(6, y, 'G').px(21, y, 'G'); // chains
        y += 2;
    }
    sign.rect(2, 7, 24, 15, 'L').box_(2, 7, 24, 15, 'G');
    sign.text(8, 9, "FOR", 'K', false);
    sign.text(4, 15, "LEASE", 'K', false);
    // cobweb in the top-left corner and a dusty bottom edge
    sign.line(1, 1, 5, 1, 'G').line(1, 1, 1, 5, 'G').line(1, 1, 4, 4, 'G').px(3, 2, 'G').px(2, 3, 'G').px(4, 2, 'G').px(2, 4, 'G');
    sign.px(5, 24, 'G').px(9, 24, 'G').px(10, 23, 'G').px(18, 24, 'G').px(21, 23, 'G');
    b.define_static_window(StoreId::Blockbluster, Side::R, &pal_r, sign);
}

// ---- CIRCUIT PITY (closed): shutter half down with dead TVs behind it
fn circuitpity(b: &mut Built) {
    b.style(StoreId::Circuitpity, c::BLACK, c::GRAY);
    let pal = [('L', c::LTGRAY), ('G', c::GRAY), ('K', c::BLACK)];
    fn half_shutter(g: &mut Grid) {
        g.rect(1, 1, 26, 2, 'G').hline(1, 1, 26, 'L');
        g.hline(1, 3, 26, 'K');
        let mut y = 4;
        while y <= 10 {
            g.hline(1, y, 26, 'L').hline(1, y + 1, 26, 'G');
            y += 3;
        }
        g.hline(1, 13, 26, 'L').hline(1, 14, 26, 'G').rect(12, 13, 4, 2, 'K'); // bottom bar with a handle slot
        g.hline(1, 15, 26, 'K');
    }
    fn dead_tv(g: &mut Grid, x: i32, y: i32, w: i32, h: i32, dot: bool, crack: bool) {
        g.rect(x, y, w, h, 'G');
        g.rect(x + 1, y + 1, w - 5, h - 3, 'K');
        g.px(x + w - 2, y + 2, 'K').px(x + w - 2, y + 4, 'K'); // knobs
        g.px(x + 2, y + 2, 'L').px(x + 3, y + 2, 'L').px(x + 2, y + 3, 'L'); // glare
        if dot {
            g.px(x + 1 + (w - 5) / 2, y + 1 + (h - 3) / 2 + 1, 'L'); // last dot of a dying CRT
        }
        if crack {
            g.line(x + 4, y + 1, x + 6, y + 3, 'L').line(x + 6, y + 3, x + 5, y + 5, 'L').line(x + 6, y + 3, x + 8, y + 4, 'L');
        }
    }
    let mut l = blank();
    half_shutter(&mut l);
    dead_tv(&mut l, 2, 16, 12, 9, true, false);
    dead_tv(&mut l, 14, 16, 12, 9, false, true);
    b.define_static_window(StoreId::Circuitpity, Side::L, &pal, l);
    let mut r = blank();
    half_shutter(&mut r);
    dead_tv(&mut r, 2, 16, 15, 9, false, false);
    dead_tv(&mut r, 18, 18, 9, 7, false, true);
    b.define_static_window(StoreId::Circuitpity, Side::R, &pal, r);
}

// ---- BORDERLINE BOOKS (closed): shutter with a "CLOSING SALE" banner
fn borderline(b: &mut Built) {
    b.style(StoreId::Borderline, c::BLACK, c::GRAY);
    let pal = [('L', c::LTGRAY), ('G', c::GRAY), ('R', c::RED)];
    fn shuttered() -> Grid {
        let mut g = blank();
        for y in 1..=24 {
            if y % 3 == 1 {
                g.hline(1, y, 26, 'L');
            } else if y % 3 == 2 {
                g.hline(1, y, 26, 'G');
            }
        }
        g
    }
    fn banner(g: &mut Grid) {
        g.rect(0, 6, 28, 15, 'R');
        let mut x = 0;
        while x < 28 {
            g.px(x, 7, 'L').px(x, 19, 'L'); // stitched hems
            x += 2;
        }
    }
    let mut l = shuttered();
    banner(&mut l);
    l.text(1, 9, "CLOSING", '.', true);
    l.text(7, 14, "SALE", '.', false);
    b.define_static_window(StoreId::Borderline, Side::L, &pal, l);
    let mut r = shuttered();
    banner(&mut r);
    r.text(8, 9, "ALL", '.', false);
    r.text(7, 14, "-50%", '.', false);
    b.define_static_window(StoreId::Borderline, Side::R, &pal, r);
}
