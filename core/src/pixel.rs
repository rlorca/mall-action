//! The pixel-art pipeline: fixed NES-like master palette, ASCII-art sprites (max 3 colours + transparent),
//! a 256x240 palette-indexed framebuffer and two built-in pixel fonts. Everything is generated from source.

use std::sync::OnceLock;

pub const W: usize = 256;
pub const H: usize = 240;
/// Height of the HUD strip along the top.
pub const HUD_H: i32 = 16;

// ---------------------------------------------------------------------------------------------------------
// Master palette (index = NES colour number 0x00..=0x3F)
// ---------------------------------------------------------------------------------------------------------

const PAL_RGB: [(u8, u8, u8); 64] = [
    (84, 84, 84), (0, 30, 116), (8, 16, 144), (48, 0, 136), (68, 0, 100), (92, 0, 48), (84, 4, 0), (60, 24, 0),
    (32, 42, 0), (8, 58, 0), (0, 64, 0), (0, 60, 0), (0, 50, 60), (0, 0, 0), (0, 0, 0), (0, 0, 0),
    (152, 150, 152), (8, 76, 196), (48, 50, 236), (92, 30, 228), (136, 20, 176), (160, 20, 100), (152, 34, 32), (120, 60, 0),
    (84, 90, 0), (40, 114, 0), (8, 124, 0), (0, 118, 40), (0, 102, 120), (0, 0, 0), (0, 0, 0), (0, 0, 0),
    (236, 238, 236), (76, 154, 236), (120, 124, 236), (176, 98, 236), (228, 84, 236), (236, 88, 180), (236, 106, 100), (212, 136, 32),
    (160, 170, 0), (116, 196, 0), (76, 208, 32), (56, 204, 108), (56, 180, 204), (60, 60, 60), (0, 0, 0), (0, 0, 0),
    (236, 238, 236), (168, 204, 236), (188, 188, 236), (212, 178, 236), (236, 174, 236), (236, 174, 212), (236, 180, 176), (228, 196, 144),
    (204, 210, 120), (180, 222, 120), (168, 226, 144), (152, 226, 180), (160, 214, 228), (160, 162, 160), (0, 0, 0), (0, 0, 0),
];

pub fn palette_rgb(i: u8) -> (u8, u8, u8) {
    PAL_RGB[(i & 63) as usize]
}

/// Named palette entries (NES colour numbers). Use these instead of raw numbers.
pub mod pal {
    pub const BLACK: u8 = 0x0F;
    pub const DGRAY: u8 = 0x00;
    pub const GRAY: u8 = 0x10;
    pub const LGRAY: u8 = 0x3D;
    pub const CHARCOAL: u8 = 0x2D;
    pub const WHITE: u8 = 0x30;

    pub const DRED: u8 = 0x06;
    pub const RED: u8 = 0x16;
    pub const LRED: u8 = 0x26;
    pub const PINK: u8 = 0x25;
    pub const LPINK: u8 = 0x35;

    pub const DBROWN: u8 = 0x07;
    pub const BROWN: u8 = 0x17;
    pub const ORANGE: u8 = 0x27;
    pub const TAN: u8 = 0x37;

    pub const DOLIVE: u8 = 0x08;
    pub const OLIVE: u8 = 0x18;
    pub const YELLOW: u8 = 0x28;
    pub const LYELLOW: u8 = 0x38;

    pub const DGREEN: u8 = 0x0A;
    pub const GREEN: u8 = 0x1A;
    pub const LGREEN: u8 = 0x2A;
    pub const LIME: u8 = 0x29;
    pub const PALEGREEN: u8 = 0x3A;
    pub const TEAL: u8 = 0x1B;
    pub const MINT: u8 = 0x2B;

    pub const DCYAN: u8 = 0x0C;
    pub const CYAN: u8 = 0x2C;
    pub const LCYAN: u8 = 0x3C;
    pub const STEEL: u8 = 0x1C;

    pub const NAVY: u8 = 0x01;
    pub const DBLUE: u8 = 0x02;
    pub const BLUE: u8 = 0x12;
    pub const LBLUE: u8 = 0x21;
    pub const SKY: u8 = 0x31;
    pub const MBLUE: u8 = 0x11;
    pub const PERI: u8 = 0x22;

    pub const DPURPLE: u8 = 0x03;
    pub const PURPLE: u8 = 0x13;
    pub const LPURPLE: u8 = 0x23;
    pub const PLUM: u8 = 0x04;
    pub const MAGENTA: u8 = 0x14;
    pub const LMAGENTA: u8 = 0x24;
    pub const LAVENDER: u8 = 0x33;
    pub const MAROON: u8 = 0x05;
}

// ---------------------------------------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------------------------------------

/// A (possibly animated) sprite. Pixel values: 0 = transparent, 1..=3 index into `colors`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Sprite {
    pub w: usize,
    pub h: usize,
    pub frames: Vec<Vec<u8>>,
    pub colors: [u8; 3],
}

#[derive(Debug, PartialEq, Eq)]
pub enum ArtError {
    Empty,
    Ragged { row: usize, expected: usize, got: usize },
    BadChar { row: usize, ch: char },
    FrameSize { frame: usize },
}

impl Sprite {
    /// Parse ASCII art. `.` or space is transparent, `1` `2` `3` pick the colours.
    pub fn try_frames(frames: &[&[&str]], colors: [u8; 3]) -> Result<Sprite, ArtError> {
        if frames.is_empty() || frames[0].is_empty() {
            return Err(ArtError::Empty);
        }
        let h = frames[0].len();
        let w = frames[0][0].chars().count();
        if w == 0 {
            return Err(ArtError::Empty);
        }
        let mut out = Vec::new();
        for (fi, rows) in frames.iter().enumerate() {
            if rows.len() != h {
                return Err(ArtError::FrameSize { frame: fi });
            }
            let mut px = Vec::with_capacity(w * h);
            for (ri, r) in rows.iter().enumerate() {
                let n = r.chars().count();
                if n != w {
                    return Err(ArtError::Ragged { row: ri, expected: w, got: n });
                }
                for ch in r.chars() {
                    px.push(match ch {
                        '.' | ' ' => 0,
                        '1' => 1,
                        '2' => 2,
                        '3' => 3,
                        other => return Err(ArtError::BadChar { row: ri, ch: other }),
                    });
                }
            }
            out.push(px);
        }
        Ok(Sprite { w, h, frames: out, colors })
    }

    pub fn from_frames(frames: &[&[&str]], colors: [u8; 3]) -> Sprite {
        match Sprite::try_frames(frames, colors) {
            Ok(s) => s,
            Err(e) => panic!("bad sprite art: {e:?}"),
        }
    }

    pub fn from_art(rows: &[&str], colors: [u8; 3]) -> Sprite {
        Sprite::from_frames(&[rows], colors)
    }

    pub fn frame_count(&self) -> usize {
        self.frames.len()
    }

    /// How many distinct non-transparent colours are used across all frames.
    pub fn colors_used(&self) -> usize {
        let mut seen = [false; 4];
        for f in &self.frames {
            for &p in f {
                seen[(p & 3) as usize] = true;
            }
        }
        seen[1..].iter().filter(|s| **s).count()
    }

    pub fn flipped(&self) -> Sprite {
        let frames = self
            .frames
            .iter()
            .map(|f| {
                let mut o = vec![0u8; f.len()];
                for y in 0..self.h {
                    for x in 0..self.w {
                        o[y * self.w + x] = f[y * self.w + (self.w - 1 - x)];
                    }
                }
                o
            })
            .collect();
        Sprite { w: self.w, h: self.h, frames, colors: self.colors }
    }

    /// Frame for an animation clock: `tick / period` cycles through the frames.
    pub fn frame_at(&self, tick: u32, period: u32) -> usize {
        ((tick / period.max(1)) as usize) % self.frames.len()
    }
}

// ---------------------------------------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------------------------------------

/// One glyph: up to 7 rows of up to 5 bits (bit 4 = leftmost).
type Glyph = [u8; 7];

struct FontData {
    big: Vec<Option<Glyph>>,   // 5x7, index = ascii
    tiny: Vec<Option<Glyph>>,  // 3x5, stored in the top 5 rows, bits 2..0
}

const BIG_SRC: &str = "\
A: .###. #...# #...# ##### #...# #...# #...#
B: ####. #...# #...# ####. #...# #...# ####.
C: .###. #...# #.... #.... #.... #...# .###.
D: ####. #...# #...# #...# #...# #...# ####.
E: ##### #.... #.... ####. #.... #.... #####
F: ##### #.... #.... ####. #.... #.... #....
G: .###. #...# #.... #.### #...# #...# .###.
H: #...# #...# #...# ##### #...# #...# #...#
I: .###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.
J: ..### ...#. ...#. ...#. ...#. #..#. .##..
K: #...# #..#. #.#.. ##... #.#.. #..#. #...#
L: #.... #.... #.... #.... #.... #.... #####
M: #...# ##.## #.#.# #.#.# #...# #...# #...#
N: #...# ##..# #.#.# #..## #...# #...# #...#
O: .###. #...# #...# #...# #...# #...# .###.
P: ####. #...# #...# ####. #.... #.... #....
Q: .###. #...# #...# #...# #.#.# #..#. .##.#
R: ####. #...# #...# ####. #.#.. #..#. #...#
S: .#### #.... #.... .###. ....# ....# ####.
T: ##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..
U: #...# #...# #...# #...# #...# #...# .###.
V: #...# #...# #...# #...# #...# .#.#. ..#..
W: #...# #...# #...# #.#.# #.#.# ##.## #...#
X: #...# #...# .#.#. ..#.. .#.#. #...# #...#
Y: #...# #...# .#.#. ..#.. ..#.. ..#.. ..#..
Z: ##### ....# ...#. ..#.. .#... #.... #####
0: .###. #...# #..## #.#.# ##..# #...# .###.
1: ..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.
2: .###. #...# ....# ...#. ..#.. .#... #####
3: ####. ....# ....# .###. ....# ....# ####.
4: ...#. ..##. .#.#. #..#. ##### ...#. ...#.
5: ##### #.... ####. ....# ....# #...# .###.
6: .###. #.... #.... ####. #...# #...# .###.
7: ##### ....# ...#. ..#.. .#... .#... .#...
8: .###. #...# #...# .###. #...# #...# .###.
9: .###. #...# #...# .#### ....# ....# .###.
!: ..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..
?: .###. #...# ....# ...#. ..#.. ..... ..#..
.: ..... ..... ..... ..... ..... .##.. .##..
,: ..... ..... ..... ..... .##.. ..#.. .#...
:: ..... .##.. .##.. ..... .##.. .##.. .....
;: ..... .##.. .##.. ..... .##.. ..#.. .#...
': .##.. ..#.. .#... ..... ..... ..... .....
\": .#.#. .#.#. ..... ..... ..... ..... .....
-: ..... ..... ..... ##### ..... ..... .....
+: ..... ..#.. ..#.. #####  ..#.. ..#.. .....
=: ..... ..... ##### ..... ##### ..... .....
/: ....# ....# ...#. ..#.. .#... #.... #....
(: ...#. ..#.. .#... .#... .#... ..#.. ...#.
): .#... ..#.. ...#. ...#. ...#. ..#.. .#...
*: ..... #.#.# .###. ##### .###. #.#.# .....
#: .#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.
%: ##..# ##..# ...#. ..#.. .#... #..## #..##
&: .##.. #..#. #.#.. .#... #.#.# #..#. .##.#
<: ...#. ..#.. .#... #.... .#... ..#.. ...#.
>: .#... ..#.. ...#. ....# ...#. ..#.. .#...
_: ..... ..... ..... ..... ..... ..... #####
@: .###. #...# #.### #.#.# #.### #.... .###.
$: ..#.. .#### #.#.. .###. ..#.# ####. ..#..
~: ..... ..... .#... #.#.# ...#. ..... .....
^: ..#.. .#.#. #...# ..... ..... ..... .....
[: .###. .#... .#... .#... .#... .#... .###.
]: .###. ...#. ...#. ...#. ...#. ...#. .###.
|: ..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#..
{: ..##. ..#.. .#... #.... .#... ..#.. ..##.
}: .##.. ..#.. ...#. ....# ...#. ..#.. .##..
\\: #.... #.... .#... ..#.. ...#. ....# ....#
";

const TINY_SRC: &str = "\
A: .#. #.# ### #.# #.#
B: ##. #.# ##. #.# ##.
C: .## #.. #.. #.. .##
D: ##. #.# #.# #.# ##.
E: ### #.. ##. #.. ###
F: ### #.. ##. #.. #..
G: .## #.. #.# #.# .##
H: #.# #.# ### #.# #.#
I: ### .#. .#. .#. ###
J: ..# ..# ..# #.# .#.
K: #.# #.# ##. #.# #.#
L: #.. #.. #.. #.. ###
M: #.# ### ### #.# #.#
N: ##. #.# #.# #.# #.#
O: .#. #.# #.# #.# .#.
P: ##. #.# ##. #.. #..
Q: .#. #.# #.# ##. .##
R: ##. #.# ##. #.# #.#
S: .## #.. .#. ..# ##.
T: ### .#. .#. .#. .#.
U: #.# #.# #.# #.# ###
V: #.# #.# #.# #.# .#.
W: #.# #.# ### ### #.#
X: #.# #.# .#. #.# #.#
Y: #.# #.# .#. .#. .#.
Z: ### ..# .#. #.. ###
0: ### #.# #.# #.# ###
1: .#. ##. .#. .#. ###
2: ##. ..# .#. #.. ###
3: ##. ..# .#. ..# ##.
4: #.# #.# ### ..# ..#
5: ### #.. ##. ..# ##.
6: .## #.. ### #.# ###
7: ### ..# .#. .#. .#.
8: ### #.# ### #.# ###
9: ### #.# ### ..# ##.
!: .#. .#. .#. ... .#.
?: ##. ..# .#. ... .#.
.: ... ... ... ... .#.
,: ... ... ... .#. #..
': .#. .#. ... ... ...
:: ... .#. ... .#. ...
-: ... ... ### ... ...
+: ... .#. ### .#. ...
/: ..# ..# .#. #.. #..
&: .#. #.# .## #.# .##
%: #.# ..# .#. #.. #.#
*: ... #.# .#. #.# ...
#: #.# ### #.# ### #.#
\": #.# #.# ... ... ...
";

fn parse_font(src: &str, cols: usize, rows: usize) -> Vec<Option<Glyph>> {
    let mut table: Vec<Option<Glyph>> = vec![None; 128];
    for line in src.lines() {
        let line = line.trim_end();
        if line.is_empty() {
            continue;
        }
        let key = line.chars().next().unwrap();
        let rest = line[key.len_utf8()..].strip_prefix(':').unwrap_or("").trim();
        let mut g: Glyph = [0; 7];
        for (ri, row) in rest.split_whitespace().enumerate() {
            assert!(ri < rows, "font row overflow for {key:?}");
            assert_eq!(row.len(), cols, "font row width for {key:?}: {row}");
            let mut bits = 0u8;
            for ch in row.chars() {
                bits = (bits << 1) | (ch == '#') as u8;
            }
            g[ri] = bits;
        }
        if (key as usize) < 128 {
            table[key as usize] = Some(g);
        }
    }
    table
}

fn fonts() -> &'static FontData {
    static F: OnceLock<FontData> = OnceLock::new();
    F.get_or_init(|| {
        // Special-case lines whose key char collides with the ':' separator or quotes.
        let mut big = parse_font(BIG_SRC, 5, 7);
        let mut tiny = parse_font(TINY_SRC, 3, 5);
        // lowercase maps to uppercase
        for c in b'a'..=b'z' {
            big[c as usize] = big[(c - 32) as usize];
            tiny[c as usize] = tiny[(c - 32) as usize];
        }
        FontData { big, tiny }
    })
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FontKind {
    /// 5x7, advance 6.
    Normal,
    /// 3x5, advance 4. Used for store signs and fine print.
    Tiny,
}

impl FontKind {
    pub fn advance(self) -> i32 {
        match self {
            FontKind::Normal => 6,
            FontKind::Tiny => 4,
        }
    }
    pub fn height(self) -> i32 {
        match self {
            FontKind::Normal => 7,
            FontKind::Tiny => 5,
        }
    }
    fn glyph(self, c: char) -> Option<Glyph> {
        let f = fonts();
        let idx = c as usize;
        if idx >= 128 {
            return None;
        }
        match self {
            FontKind::Normal => f.big[idx],
            FontKind::Tiny => f.tiny[idx],
        }
    }
    fn cols(self) -> i32 {
        match self {
            FontKind::Normal => 5,
            FontKind::Tiny => 3,
        }
    }
}

/// Width in pixels of a string (no trailing gap).
pub fn text_width(font: FontKind, s: &str) -> i32 {
    let n = s.chars().count() as i32;
    if n == 0 {
        0
    } else {
        n * font.advance() - (font.advance() - font.cols())
    }
}

/// Characters we draw as dedicated shapes rather than via the font.
pub const HEART: char = '♥';

// ---------------------------------------------------------------------------------------------------------
// Framebuffer
// ---------------------------------------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

impl Rect {
    pub const fn new(x: i32, y: i32, w: i32, h: i32) -> Rect {
        Rect { x, y, w, h }
    }
    pub fn contains(&self, px: i32, py: i32) -> bool {
        px >= self.x && py >= self.y && px < self.x + self.w && py < self.y + self.h
    }
    pub fn intersects(&self, o: &Rect) -> bool {
        self.x < o.x + o.w && o.x < self.x + self.w && self.y < o.y + o.h && o.y < self.y + self.h
    }
    pub fn right(&self) -> i32 {
        self.x + self.w
    }
    pub fn bottom(&self) -> i32 {
        self.y + self.h
    }
}

/// 256x240 framebuffer of palette indices (opaque).
#[derive(Clone)]
pub struct Fb {
    pub px: Vec<u8>,
    clip: Rect,
}

impl Default for Fb {
    fn default() -> Self {
        Fb::new()
    }
}

impl Fb {
    pub fn new() -> Fb {
        Fb { px: vec![pal::BLACK; W * H], clip: Rect::new(0, 0, W as i32, H as i32) }
    }

    pub fn clear(&mut self, c: u8) {
        self.px.iter_mut().for_each(|p| *p = c);
    }

    /// Restrict all drawing to a rectangle (clamped to the screen). Returns the previous clip.
    pub fn set_clip(&mut self, r: Rect) -> Rect {
        let old = self.clip;
        let x0 = r.x.max(0);
        let y0 = r.y.max(0);
        let x1 = (r.x + r.w).min(W as i32);
        let y1 = (r.y + r.h).min(H as i32);
        self.clip = Rect::new(x0, y0, (x1 - x0).max(0), (y1 - y0).max(0));
        old
    }

    pub fn reset_clip(&mut self) {
        self.clip = Rect::new(0, 0, W as i32, H as i32);
    }

    pub fn clip(&self) -> Rect {
        self.clip
    }

    #[inline]
    pub fn put(&mut self, x: i32, y: i32, c: u8) {
        if self.clip.contains(x, y) {
            self.px[y as usize * W + x as usize] = c;
        }
    }

    pub fn get(&self, x: i32, y: i32) -> u8 {
        if x < 0 || y < 0 || x >= W as i32 || y >= H as i32 {
            pal::BLACK
        } else {
            self.px[y as usize * W + x as usize]
        }
    }

    pub fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8) {
        let x0 = x.max(self.clip.x);
        let y0 = y.max(self.clip.y);
        let x1 = (x + w).min(self.clip.right());
        let y1 = (y + h).min(self.clip.bottom());
        for yy in y0..y1 {
            let row = yy as usize * W;
            for xx in x0..x1 {
                self.px[row + xx as usize] = c;
            }
        }
    }

    pub fn rect_r(&mut self, r: Rect, c: u8) {
        self.rect(r.x, r.y, r.w, r.h, c);
    }

    /// 1px outline.
    pub fn frame(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8) {
        if w <= 0 || h <= 0 {
            return;
        }
        self.rect(x, y, w, 1, c);
        self.rect(x, y + h - 1, w, 1, c);
        self.rect(x, y, 1, h, c);
        self.rect(x + w - 1, y, 1, h, c);
    }

    pub fn hline(&mut self, x: i32, y: i32, w: i32, c: u8) {
        self.rect(x, y, w, 1, c);
    }

    pub fn vline(&mut self, x: i32, y: i32, h: i32, c: u8) {
        self.rect(x, y, 1, h, c);
    }

    /// Checkerboard dither of a rectangle (every other pixel), useful for dimming and fades.
    pub fn dither_rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8, phase: i32) {
        for yy in y..y + h {
            for xx in x..x + w {
                if (xx + yy + phase) & 1 == 0 {
                    self.put(xx, yy, c);
                }
            }
        }
    }

    /// Replace every pixel inside the rect with `f(old)`.
    pub fn map_rect(&mut self, x: i32, y: i32, w: i32, h: i32, f: impl Fn(u8) -> u8) {
        let x0 = x.max(self.clip.x);
        let y0 = y.max(self.clip.y);
        let x1 = (x + w).min(self.clip.right());
        let y1 = (y + h).min(self.clip.bottom());
        for yy in y0..y1 {
            for xx in x0..x1 {
                let i = yy as usize * W + xx as usize;
                self.px[i] = f(self.px[i]);
            }
        }
    }

    pub fn blit(&mut self, s: &Sprite, frame: usize, x: i32, y: i32, flip: bool) {
        self.blit_col(s, frame, x, y, flip, s.colors);
    }

    /// Blit with an alternative colour trio (recolour, flash).
    pub fn blit_col(&mut self, s: &Sprite, frame: usize, x: i32, y: i32, flip: bool, colors: [u8; 3]) {
        let f = &s.frames[frame % s.frames.len()];
        for sy in 0..s.h {
            let dy = y + sy as i32;
            if dy < self.clip.y || dy >= self.clip.bottom() {
                continue;
            }
            for sx in 0..s.w {
                let p = f[sy * s.w + sx];
                if p == 0 {
                    continue;
                }
                let dx = x + if flip { (s.w - 1 - sx) as i32 } else { sx as i32 };
                if dx >= self.clip.x && dx < self.clip.right() {
                    self.px[dy as usize * W + dx as usize] = colors[(p - 1) as usize];
                }
            }
        }
    }

    /// Blit every opaque pixel in a single flat colour (silhouettes, hit flashes).
    pub fn blit_flat(&mut self, s: &Sprite, frame: usize, x: i32, y: i32, flip: bool, c: u8) {
        self.blit_col(s, frame, x, y, flip, [c, c, c]);
    }

    pub fn text(&mut self, x: i32, y: i32, s: &str, c: u8) -> i32 {
        self.text_font(FontKind::Normal, x, y, s, c)
    }

    pub fn text_tiny(&mut self, x: i32, y: i32, s: &str, c: u8) -> i32 {
        self.text_font(FontKind::Tiny, x, y, s, c)
    }

    /// Draw text; returns the x just after it.
    pub fn text_font(&mut self, font: FontKind, x: i32, y: i32, s: &str, c: u8) -> i32 {
        let mut cx = x;
        for ch in s.chars() {
            if ch == HEART {
                self.heart(cx, y, c);
            } else if let Some(g) = font.glyph(ch) {
                let cols = font.cols();
                for (ry, bits) in g.iter().enumerate().take(font.height() as usize) {
                    for rx in 0..cols {
                        if bits & (1 << (cols - 1 - rx)) != 0 {
                            self.put(cx + rx, y + ry as i32, c);
                        }
                    }
                }
            }
            cx += font.advance();
        }
        cx
    }

    fn heart(&mut self, x: i32, y: i32, c: u8) {
        const H: [u8; 7] = [0b01010, 0b11111, 0b11111, 0b11111, 0b01110, 0b00100, 0b00000];
        for (ry, bits) in H.iter().enumerate() {
            for rx in 0..5 {
                if bits & (1 << (4 - rx)) != 0 {
                    self.put(x + rx, y + ry as i32, c);
                }
            }
        }
    }

    pub fn text_center(&mut self, cx: i32, y: i32, s: &str, c: u8) {
        let w = text_width(FontKind::Normal, s);
        self.text(cx - w / 2, y, s, c);
    }

    pub fn text_center_tiny(&mut self, cx: i32, y: i32, s: &str, c: u8) {
        let w = text_width(FontKind::Tiny, s);
        self.text_tiny(cx - w / 2, y, s, c);
    }

    pub fn text_right(&mut self, rx: i32, y: i32, s: &str, c: u8) {
        let w = text_width(FontKind::Normal, s);
        self.text(rx - w, y, s, c);
    }

    /// Text with a 1px drop shadow.
    pub fn text_shadow(&mut self, x: i32, y: i32, s: &str, c: u8, shadow: u8) {
        self.text(x + 1, y + 1, s, shadow);
        self.text(x, y, s, c);
    }

    /// Big text: every font pixel becomes a `scale` x `scale` block.
    pub fn text_scaled(&mut self, x: i32, y: i32, s: &str, c: u8, scale: i32) -> i32 {
        let mut cx = x;
        for ch in s.chars() {
            if let Some(g) = FontKind::Normal.glyph(ch) {
                for (ry, bits) in g.iter().enumerate() {
                    for rx in 0..5 {
                        if bits & (1 << (4 - rx)) != 0 {
                            self.rect(cx + rx * scale, y + ry as i32 * scale, scale, scale, c);
                        }
                    }
                }
            }
            cx += 6 * scale;
        }
        cx
    }

    pub fn text_scaled_width(s: &str, scale: i32) -> i32 {
        let n = s.chars().count() as i32;
        if n == 0 {
            0
        } else {
            (n * 6 - 1) * scale
        }
    }

    /// Convert to RGBA bytes (len W*H*4) through the master palette.
    pub fn to_rgba(&self, out: &mut [u8]) {
        for (i, &p) in self.px.iter().enumerate() {
            let (r, g, b) = palette_rgb(p);
            let o = i * 4;
            out[o] = r;
            out[o + 1] = g;
            out[o + 2] = b;
            out[o + 3] = 255;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn art_parses_and_counts_colors() {
        let s = Sprite::from_art(&["1.2", ".3."], [pal::RED, pal::WHITE, pal::BLACK]);
        assert_eq!((s.w, s.h), (3, 2));
        assert_eq!(s.colors_used(), 3);
        assert_eq!(s.frames[0], vec![1, 0, 2, 0, 3, 0]);
    }

    #[test]
    fn art_errors_are_reported() {
        assert_eq!(Sprite::try_frames(&[&["11", "1"]], [0; 3]).unwrap_err(), ArtError::Ragged { row: 1, expected: 2, got: 1 });
        assert_eq!(Sprite::try_frames(&[&["1x"]], [0; 3]).unwrap_err(), ArtError::BadChar { row: 0, ch: 'x' });
        assert_eq!(Sprite::try_frames(&[&["11"], &["11", "11"]], [0; 3]).unwrap_err(), ArtError::FrameSize { frame: 1 });
        assert_eq!(Sprite::try_frames(&[], [0; 3]).unwrap_err(), ArtError::Empty);
        assert_eq!(Sprite::try_frames(&[&["14"]], [0; 3]).unwrap_err(), ArtError::BadChar { row: 0, ch: '4' });
    }

    #[test]
    fn flip_mirrors() {
        let s = Sprite::from_art(&["12."], [1, 2, 3]).flipped();
        assert_eq!(s.frames[0], vec![0, 2, 1]);
    }

    #[test]
    fn blit_respects_transparency_flip_and_clip() {
        let mut fb = Fb::new();
        let s = Sprite::from_art(&["1.", ".2"], [pal::RED, pal::GREEN, pal::BLUE]);
        fb.blit(&s, 0, 10, 10, false);
        assert_eq!(fb.get(10, 10), pal::RED);
        assert_eq!(fb.get(11, 10), pal::BLACK);
        assert_eq!(fb.get(11, 11), pal::GREEN);
        let mut fb = Fb::new();
        fb.blit(&s, 0, 10, 10, true);
        assert_eq!(fb.get(11, 10), pal::RED);
        assert_eq!(fb.get(10, 11), pal::GREEN);
        // clip
        let mut fb = Fb::new();
        fb.set_clip(Rect::new(0, 16, 256, 224));
        fb.blit(&s, 0, 0, 15, false);
        assert_eq!(fb.get(0, 15), pal::BLACK);
        fb.blit(&s, 0, -1, 20, false);
        assert_eq!(fb.get(0, 21), pal::GREEN);
    }

    #[test]
    fn offscreen_draws_do_not_panic() {
        let mut fb = Fb::new();
        fb.rect(-50, -50, 1000, 1000, pal::RED);
        fb.text(-100, 300, "HELLO", pal::WHITE);
        fb.put(-1, 5, 1);
        fb.put(300, 5, 1);
        assert_eq!(fb.get(5, 5), pal::RED);
    }

    #[test]
    fn fonts_cover_the_alphabet_digits_and_punctuation() {
        for c in ('A'..='Z').chain('0'..='9').chain("!?.,:;'\"-+=/()*#%&<>_@".chars()) {
            assert!(FontKind::Normal.glyph(c).is_some(), "normal font missing {c:?}");
        }
        for c in ('A'..='Z').chain('0'..='9').chain("!?.,:'-+/&%*#".chars()) {
            assert!(FontKind::Tiny.glyph(c).is_some(), "tiny font missing {c:?}");
        }
        assert_eq!(FontKind::Normal.glyph('a'), FontKind::Normal.glyph('A'));
    }

    #[test]
    fn text_draws_pixels_and_measures() {
        let mut fb = Fb::new();
        let end = fb.text(0, 0, "A", pal::WHITE);
        assert_eq!(end, 6);
        assert_eq!(fb.get(1, 0), pal::WHITE); // A's top row ".###."
        assert_eq!(fb.get(0, 0), pal::BLACK);
        assert_eq!(text_width(FontKind::Normal, "AB"), 11);
        assert_eq!(text_width(FontKind::Tiny, "AB"), 7);
        assert_eq!(text_width(FontKind::Normal, ""), 0);
    }

    #[test]
    fn colon_and_backslash_glyphs_exist() {
        assert!(FontKind::Normal.glyph(':').is_some());
        assert!(FontKind::Normal.glyph('\\').is_some());
        assert!(FontKind::Tiny.glyph(':').is_some());
        assert!(FontKind::Normal.glyph('"').is_some());
    }

    #[test]
    fn rgba_conversion_uses_palette() {
        let mut fb = Fb::new();
        fb.put(0, 0, pal::WHITE);
        let mut out = vec![0u8; W * H * 4];
        fb.to_rgba(&mut out);
        assert_eq!(&out[0..4], &[236, 238, 236, 255]);
        assert_eq!(&out[4..8], &[0, 0, 0, 255]);
    }

    #[test]
    fn frame_at_cycles() {
        let s = Sprite::from_frames(&[&["1"], &["2"], &["3"]], [1, 2, 3]);
        assert_eq!(s.frame_at(0, 8), 0);
        assert_eq!(s.frame_at(8, 8), 1);
        assert_eq!(s.frame_at(24, 8), 0);
    }

    #[test]
    fn all_palette_names_are_valid_indices() {
        for c in [pal::BLACK, pal::WHITE, pal::RED, pal::MAROON, pal::LAVENDER, pal::PALEGREEN, pal::LCYAN] {
            assert!(c < 64);
        }
    }
}
