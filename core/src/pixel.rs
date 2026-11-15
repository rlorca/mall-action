//! The pixel-art pipeline: NES master palette, ASCII sprite definitions, and a software canvas.
//!
//! A sprite is drawn in source as rows of characters: `.` = transparent, `1`/`2`/`3` = the
//! sprite's three palette slots (each slot holds an index into the 64-colour NES master palette).
//! So every sprite has at most 3 colours plus transparent *by construction*.

/// NES-like master palette (0xRRGGBB), 64 entries, standard 2C02 ordering.
pub const MASTER: [u32; 64] = [
    0x666666, 0x002A88, 0x1412A7, 0x3B00A4, 0x5C007E, 0x6E0040, 0x6C0600, 0x561D00, 0x333500, 0x0B4800, 0x005200,
    0x004F08, 0x00404D, 0x000000, 0x000000, 0x000000, 0xADADAD, 0x155FD9, 0x4240FF, 0x7527FE, 0xA01ACC, 0xB71E7B,
    0xB53120, 0x994E00, 0x6B6D00, 0x388700, 0x0D9300, 0x008F32, 0x007C8D, 0x000000, 0x000000, 0x000000, 0xFFFEFF,
    0x64B0FF, 0x9290FF, 0xC676FF, 0xF36AFF, 0xFE6ECC, 0xFE8170, 0xEA9E22, 0xBCBE00, 0x88D800, 0x5CE430, 0x45E082,
    0x48CDDE, 0x4F4F4F, 0x000000, 0x000000, 0xFFFEFF, 0xC0DFFF, 0xD3D2FF, 0xE8C8FF, 0xFBC2FF, 0xFEC4EA, 0xFECCC5,
    0xF7D8A5, 0xE4E594, 0xCFEF96, 0xBDF4AB, 0xB3F3CC, 0xB5EBF2, 0xB8B8B8, 0x000000, 0x000000,
];

/// Handy named NES palette indices (index into [`MASTER`]).
pub mod c {
    pub const BLACK: u8 = 0x0F;
    pub const WHITE: u8 = 0x30;
    pub const GRAY_L: u8 = 0x3D;
    pub const GRAY: u8 = 0x10;
    pub const GRAY_D: u8 = 0x2D;
    pub const RED: u8 = 0x16;
    pub const RED_L: u8 = 0x26;
    pub const RED_D: u8 = 0x06;
    pub const ORANGE: u8 = 0x27;
    pub const BROWN: u8 = 0x17;
    pub const BROWN_D: u8 = 0x07;
    pub const TAN: u8 = 0x37;
    pub const YELLOW: u8 = 0x28;
    pub const YELLOW_L: u8 = 0x38;
    pub const OLIVE: u8 = 0x18;
    pub const GREEN: u8 = 0x1A;
    pub const GREEN_L: u8 = 0x2A;
    pub const GREEN_D: u8 = 0x0A;
    pub const MINT: u8 = 0x3B;
    pub const TEAL: u8 = 0x2C;
    pub const TEAL_D: u8 = 0x1C;
    pub const CYAN_L: u8 = 0x3C;
    pub const BLUE: u8 = 0x12;
    pub const BLUE_L: u8 = 0x22;
    pub const BLUE_D: u8 = 0x01;
    pub const SKY: u8 = 0x21;
    pub const INDIGO: u8 = 0x02;
    pub const PURPLE: u8 = 0x13;
    pub const PURPLE_L: u8 = 0x23;
    pub const VIOLET_D: u8 = 0x03;
    pub const MAGENTA: u8 = 0x14;
    pub const MAGENTA_L: u8 = 0x24;
    pub const PINK: u8 = 0x25;
    pub const PINK_L: u8 = 0x35;
    pub const ROSE_D: u8 = 0x15;
    pub const SKIN: u8 = 0x37;
}

pub fn rgb(idx: u8) -> [u8; 3] {
    let v = MASTER[(idx & 63) as usize];
    [(v >> 16) as u8, (v >> 8) as u8, v as u8]
}

/// Static description of one sprite. `art` rows are separated by `\n` (a leading newline is ignored).
#[derive(Clone, Copy, Debug)]
pub struct SpriteDef {
    pub name: &'static str,
    pub w: usize,
    pub h: usize,
    /// NES palette indices for slots 1, 2, 3.
    pub pal: [u8; 3],
    pub art: &'static str,
}

/// Convenience constructor usable in `const`/`static` arrays.
pub const fn spr(name: &'static str, w: usize, h: usize, pal: [u8; 3], art: &'static str) -> SpriteDef {
    SpriteDef { name, w, h, pal, art }
}

/// Decoded sprite: `px` holds 0 (transparent) or 1..=3 (palette slot).
#[derive(Clone, Debug)]
pub struct Sprite {
    pub name: &'static str,
    pub w: usize,
    pub h: usize,
    pub pal: [u8; 3],
    pub px: Vec<u8>,
}

impl Sprite {
    pub fn from_def(d: &SpriteDef) -> Result<Sprite, String> {
        let rows: Vec<&str> = d.art.lines().filter(|l| !l.is_empty() || d.h == 0).collect();
        if rows.len() != d.h {
            return Err(format!("{}: expected {} rows, found {}", d.name, d.h, rows.len()));
        }
        let mut px = Vec::with_capacity(d.w * d.h);
        for (y, r) in rows.iter().enumerate() {
            let chars: Vec<char> = r.chars().collect();
            if chars.len() != d.w {
                return Err(format!("{}: row {} has width {}, expected {}", d.name, y, chars.len(), d.w));
            }
            for ch in chars {
                px.push(match ch {
                    '.' | ' ' => 0,
                    '1' => 1,
                    '2' => 2,
                    '3' => 3,
                    o => return Err(format!("{}: bad char {:?}", d.name, o)),
                });
            }
        }
        Ok(Sprite { name: d.name, w: d.w, h: d.h, pal: d.pal, px })
    }
    pub fn colours_used(&self) -> usize {
        (1..=3u8).filter(|s| self.px.contains(s)).count()
    }
}

/// RGBA software canvas (the 256x240 NES screen).
#[derive(Clone)]
pub struct Canvas {
    pub w: usize,
    pub h: usize,
    pub data: Vec<u8>,
    /// Clip rectangle (x0,y0,x1,y1) exclusive upper bounds.
    pub clip: (i32, i32, i32, i32),
}

impl Canvas {
    pub fn new(w: usize, h: usize) -> Canvas {
        Canvas { w, h, data: vec![0; w * h * 4], clip: (0, 0, w as i32, h as i32) }
    }
    pub fn set_clip(&mut self, x0: i32, y0: i32, x1: i32, y1: i32) {
        self.clip = (x0.max(0), y0.max(0), x1.min(self.w as i32), y1.min(self.h as i32));
    }
    pub fn reset_clip(&mut self) {
        self.clip = (0, 0, self.w as i32, self.h as i32);
    }
    pub fn clear(&mut self, nes: u8) {
        let [r, g, b] = rgb(nes);
        for p in self.data.chunks_exact_mut(4) {
            p.copy_from_slice(&[r, g, b, 255]);
        }
    }
    #[inline]
    pub fn pset(&mut self, x: i32, y: i32, nes: u8) {
        if x < self.clip.0 || y < self.clip.1 || x >= self.clip.2 || y >= self.clip.3 {
            return;
        }
        let [r, g, b] = rgb(nes);
        let i = (y as usize * self.w + x as usize) * 4;
        self.data[i..i + 4].copy_from_slice(&[r, g, b, 255]);
    }
    pub fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, nes: u8) {
        for yy in y.max(self.clip.1)..(y + h).min(self.clip.3) {
            for xx in x.max(self.clip.0)..(x + w).min(self.clip.2) {
                self.pset(xx, yy, nes);
            }
        }
    }
    pub fn frame(&mut self, x: i32, y: i32, w: i32, h: i32, nes: u8) {
        self.rect(x, y, w, 1, nes);
        self.rect(x, y + h - 1, w, 1, nes);
        self.rect(x, y, 1, h, nes);
        self.rect(x + w - 1, y, 1, h, nes);
    }
    pub fn hline(&mut self, x: i32, y: i32, w: i32, nes: u8) {
        self.rect(x, y, w, 1, nes);
    }
    pub fn vline(&mut self, x: i32, y: i32, h: i32, nes: u8) {
        self.rect(x, y, 1, h, nes);
    }
    pub fn blit(&mut self, s: &Sprite, x: i32, y: i32) {
        self.blit_ex(s, x, y, false, false, None);
    }
    pub fn blit_flip(&mut self, s: &Sprite, x: i32, y: i32, flip_x: bool) {
        self.blit_ex(s, x, y, flip_x, false, None);
    }
    /// Blit with optional flips and optional palette override.
    pub fn blit_ex(&mut self, s: &Sprite, x: i32, y: i32, flip_x: bool, flip_y: bool, pal: Option<[u8; 3]>) {
        let pal = pal.unwrap_or(s.pal);
        let cols = [rgb(pal[0]), rgb(pal[1]), rgb(pal[2])];
        for sy in 0..s.h {
            let dy = y + sy as i32;
            if dy < self.clip.1 || dy >= self.clip.3 {
                continue;
            }
            let srow = if flip_y { s.h - 1 - sy } else { sy };
            for sx in 0..s.w {
                let scol = if flip_x { s.w - 1 - sx } else { sx };
                let v = s.px[srow * s.w + scol];
                if v == 0 {
                    continue;
                }
                let dx = x + sx as i32;
                if dx < self.clip.0 || dx >= self.clip.2 {
                    continue;
                }
                let c = cols[(v - 1) as usize];
                let i = (dy as usize * self.w + dx as usize) * 4;
                self.data[i..i + 4].copy_from_slice(&[c[0], c[1], c[2], 255]);
            }
        }
    }
    /// Blit scaled up by an integer factor `k` (chunky pixels).
    pub fn blit_scaled(&mut self, s: &Sprite, x: i32, y: i32, k: i32, flip_x: bool) {
        let cols = [rgb(s.pal[0]), rgb(s.pal[1]), rgb(s.pal[2])];
        for sy in 0..s.h {
            for sx in 0..s.w {
                let scol = if flip_x { s.w - 1 - sx } else { sx };
                let v = s.px[sy * s.w + scol];
                if v == 0 {
                    continue;
                }
                let c = cols[(v - 1) as usize];
                let (x0, y0) = (x + sx as i32 * k, y + sy as i32 * k);
                for yy in y0.max(self.clip.1)..(y0 + k).min(self.clip.3) {
                    for xx in x0.max(self.clip.0)..(x0 + k).min(self.clip.2) {
                        let i = (yy as usize * self.w + xx as usize) * 4;
                        self.data[i..i + 4].copy_from_slice(&[c[0], c[1], c[2], 255]);
                    }
                }
            }
        }
    }
    /// Darken a rectangle by dithering to black (checkerboard) - used for dimmed areas.
    pub fn dim_rect(&mut self, x: i32, y: i32, w: i32, h: i32, parity: i32) {
        for yy in y.max(self.clip.1)..(y + h).min(self.clip.3) {
            for xx in x.max(self.clip.0)..(x + w).min(self.clip.2) {
                if (xx + yy + parity) & 1 == 0 {
                    self.pset(xx, yy, crate::pixel::c::BLACK);
                }
            }
        }
    }
    /// Multiply a rectangle's brightness (0.0..1.0) - for fades and dark sections.
    pub fn shade_rect(&mut self, x: i32, y: i32, w: i32, h: i32, k: f32) {
        for yy in y.max(self.clip.1)..(y + h).min(self.clip.3) {
            for xx in x.max(self.clip.0)..(x + w).min(self.clip.2) {
                let i = (yy as usize * self.w + xx as usize) * 4;
                for ch in 0..3 {
                    self.data[i + ch] = (self.data[i + ch] as f32 * k) as u8;
                }
            }
        }
    }
    pub fn fade(&mut self, k: f32) {
        let (w, h) = (self.w as i32, self.h as i32);
        let old = self.clip;
        self.reset_clip();
        self.shade_rect(0, 0, w, h, k);
        self.clip = old;
    }
    pub fn get(&self, x: i32, y: i32) -> [u8; 3] {
        let i = (y as usize * self.w + x as usize) * 4;
        [self.data[i], self.data[i + 1], self.data[i + 2]]
    }
}

/// Minimal uncompressed PNG encoder for dev screenshots (tests/tools).
pub fn encode_png(w: usize, h: usize, rgba: &[u8], scale: usize) -> Vec<u8> {
    fn crc32(data: &[u8]) -> u32 {
        let mut c = 0xFFFF_FFFFu32;
        for &b in data {
            c ^= b as u32;
            for _ in 0..8 {
                c = if c & 1 != 0 { 0xEDB8_8320 ^ (c >> 1) } else { c >> 1 };
            }
        }
        !c
    }
    fn chunk(out: &mut Vec<u8>, ty: &[u8; 4], data: &[u8]) {
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        let mut body = ty.to_vec();
        body.extend_from_slice(data);
        out.extend_from_slice(&body);
        out.extend_from_slice(&crc32(&body).to_be_bytes());
    }
    let (ow, oh) = (w * scale, h * scale);
    let mut raw = Vec::with_capacity((ow * 3 + 1) * oh);
    for y in 0..oh {
        raw.push(0);
        for x in 0..ow {
            let i = ((y / scale) * w + x / scale) * 4;
            raw.extend_from_slice(&rgba[i..i + 3]);
        }
    }
    // zlib stored blocks
    let mut z = vec![0x78, 0x01];
    let mut chunks = raw.chunks(65535).peekable();
    while let Some(ch) = chunks.next() {
        z.push(if chunks.peek().is_none() { 1 } else { 0 });
        z.extend_from_slice(&(ch.len() as u16).to_le_bytes());
        z.extend_from_slice(&(!(ch.len() as u16)).to_le_bytes());
        z.extend_from_slice(ch);
    }
    let (mut a, mut b) = (1u32, 0u32);
    for &v in &raw {
        a = (a + v as u32) % 65521;
        b = (b + a) % 65521;
    }
    z.extend_from_slice(&((b << 16) | a).to_be_bytes());
    let mut out = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    let mut ihdr = Vec::new();
    ihdr.extend_from_slice(&(ow as u32).to_be_bytes());
    ihdr.extend_from_slice(&(oh as u32).to_be_bytes());
    ihdr.extend_from_slice(&[8, 2, 0, 0, 0]);
    chunk(&mut out, b"IHDR", &ihdr);
    chunk(&mut out, b"IDAT", &z);
    chunk(&mut out, b"IEND", &[]);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sprite_decodes_and_counts_colours() {
        let d = spr("t", 3, 2, [c::RED, c::WHITE, c::BLACK], "1.2\n.3.");
        let s = Sprite::from_def(&d).unwrap();
        assert_eq!(s.px, vec![1, 0, 2, 0, 3, 0]);
        assert_eq!(s.colours_used(), 3);
    }
    #[test]
    fn bad_dimensions_rejected() {
        assert!(Sprite::from_def(&spr("t", 3, 1, [0, 0, 0], "11")).is_err());
        assert!(Sprite::from_def(&spr("t", 2, 2, [0, 0, 0], "11")).is_err());
        assert!(Sprite::from_def(&spr("t", 2, 1, [0, 0, 0], "1x")).is_err());
    }
    #[test]
    fn blit_flip_and_palette_override() {
        let s = Sprite::from_def(&spr("t", 2, 1, [c::RED, c::GREEN, c::BLUE], "12")).unwrap();
        let mut cv = Canvas::new(4, 2);
        cv.blit_flip(&s, 0, 0, true);
        assert_eq!(cv.get(0, 0), rgb(c::GREEN));
        assert_eq!(cv.get(1, 0), rgb(c::RED));
        cv.blit_ex(&s, 2, 1, false, false, Some([c::WHITE, c::BLACK, c::BLACK]));
        assert_eq!(cv.get(2, 1), rgb(c::WHITE));
    }
    #[test]
    fn clipping_never_panics() {
        let s = Sprite::from_def(&spr("t", 2, 2, [1, 2, 3], "11\n11")).unwrap();
        let mut cv = Canvas::new(4, 4);
        cv.blit(&s, -1, -1);
        cv.blit(&s, 3, 3);
        cv.blit(&s, 100, 100);
        cv.rect(-5, -5, 100, 100, 5);
    }
    #[test]
    fn png_has_signature() {
        let cv = Canvas::new(4, 4);
        let p = encode_png(4, 4, &cv.data, 2);
        assert_eq!(&p[1..4], b"PNG");
    }
}
