//! Software framebuffer of NES palette indices (256x240). All game drawing goes
//! here; the browser side converts it to RGBA (`to_rgba`) and uploads it to the WebGL texture.
//!
//! Coordinates are `i32`: where the TS code did `x |= 0`, callers with fractional values should pass
//! `x as i32` (truncation toward zero, identical to `|0` for in-range values).

use super::num::imul;
use super::palette::{build_rgba_lut, darken, TRANSPARENT};
use super::sprite::{Recolor, Sprite};

pub const SCREEN_W: i32 = 256;
pub const SCREEN_H: i32 = 240;
const W: usize = SCREEN_W as usize;

#[derive(Clone, Copy, Default)]
pub struct BlitOpts<'a> {
    pub frame: i32,
    pub flip_x: bool,
    pub flip_y: bool,
    /// Recolour LUT from `make_recolor()`.
    pub recolor: Option<&'a Recolor>,
    /// Draw every opaque pixel in this single colour (silhouette / hit flash).
    pub solid: Option<u8>,
}

impl<'a> BlitOpts<'a> {
    pub fn frame(mut self, f: i32) -> Self {
        self.frame = f;
        self
    }
    pub fn flip_x(mut self, v: bool) -> Self {
        self.flip_x = v;
        self
    }
    pub fn flip_y(mut self, v: bool) -> Self {
        self.flip_y = v;
        self
    }
    pub fn recolor(mut self, r: &'a Recolor) -> Self {
        self.recolor = Some(r);
        self
    }
    pub fn solid(mut self, c: u8) -> Self {
        self.solid = Some(c);
        self
    }
}

#[derive(Clone)]
pub struct Framebuffer {
    pub w: i32,
    pub h: i32,
    /// 256*240 palette indices, row-major.
    pub px: Vec<u8>,
    clip_x0: i32,
    clip_y0: i32,
    clip_x1: i32,
    clip_y1: i32,
    clip_stack: Vec<[i32; 4]>,
}

impl Default for Framebuffer {
    fn default() -> Self {
        Self::new()
    }
}

impl Framebuffer {
    pub fn new() -> Framebuffer {
        Framebuffer {
            w: SCREEN_W,
            h: SCREEN_H,
            px: vec![0; W * SCREEN_H as usize],
            clip_x0: 0,
            clip_y0: 0,
            clip_x1: SCREEN_W,
            clip_y1: SCREEN_H,
            clip_stack: Vec::new(),
        }
    }

    pub fn clear(&mut self, c: u8) {
        self.px.fill(c);
    }

    /// Restrict drawing to a rectangle (intersected with the screen). Pair with `pop_clip()`.
    pub fn push_clip(&mut self, x: i32, y: i32, w: i32, h: i32) {
        self.clip_stack.push([self.clip_x0, self.clip_y0, self.clip_x1, self.clip_y1]);
        self.clip_x0 = self.clip_x0.max(x);
        self.clip_y0 = self.clip_y0.max(y);
        self.clip_x1 = self.clip_x1.min(x + w);
        self.clip_y1 = self.clip_y1.min(y + h);
    }

    pub fn pop_clip(&mut self) {
        if let Some(c) = self.clip_stack.pop() {
            self.clip_x0 = c[0];
            self.clip_y0 = c[1];
            self.clip_x1 = c[2];
            self.clip_y1 = c[3];
        }
    }

    pub fn reset_clip(&mut self) {
        self.clip_stack.clear();
        self.clip_x0 = 0;
        self.clip_y0 = 0;
        self.clip_x1 = SCREEN_W;
        self.clip_y1 = SCREEN_H;
    }

    pub fn set_pixel(&mut self, x: i32, y: i32, c: u8) {
        if x < self.clip_x0 || y < self.clip_y0 || x >= self.clip_x1 || y >= self.clip_y1 {
            return;
        }
        self.px[y as usize * W + x as usize] = c;
    }

    /// Off-screen reads return 0x0f (black).
    pub fn get_pixel(&self, x: i32, y: i32) -> u8 {
        if x < 0 || y < 0 || x >= SCREEN_W || y >= SCREEN_H {
            return 0x0f;
        }
        self.px[y as usize * W + x as usize]
    }

    pub fn fill_rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8) {
        let x0 = x.max(self.clip_x0);
        let y0 = y.max(self.clip_y0);
        let x1 = x.saturating_add(w).min(self.clip_x1);
        let y1 = y.saturating_add(h).min(self.clip_y1);
        if x1 <= x0 {
            return;
        }
        for yy in y0..y1 {
            let row = yy as usize * W;
            self.px[row + x0 as usize..row + x1 as usize].fill(c);
        }
    }

    pub fn stroke_rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8) {
        self.fill_rect(x, y, w, 1, c);
        self.fill_rect(x, y + h - 1, w, 1, c);
        self.fill_rect(x, y, 1, h, c);
        self.fill_rect(x + w - 1, y, 1, h, c);
    }

    pub fn h_line(&mut self, x: i32, y: i32, w: i32, c: u8) {
        self.fill_rect(x, y, w, 1, c);
    }

    pub fn v_line(&mut self, x: i32, y: i32, h: i32, c: u8) {
        self.fill_rect(x, y, 1, h, c);
    }

    /// Bresenham line.
    pub fn line(&mut self, mut x0: i32, mut y0: i32, x1: i32, y1: i32, c: u8) {
        let dx = (x1 - x0).abs();
        let dy = -(y1 - y0).abs();
        let sx = if x0 < x1 { 1 } else { -1 };
        let sy = if y0 < y1 { 1 } else { -1 };
        let mut err = dx + dy;
        loop {
            self.set_pixel(x0, y0, c);
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
    }

    /// `r` is an f64 like the TS (callers pass integers or halves); centre is in whole pixels.
    pub fn fill_circle(&mut self, cx: i32, cy: i32, r: f64, c: u8) {
        let mut y = -r;
        while y <= r {
            let span = (r * r - y * y + 0.5).sqrt().floor();
            let yi = y as i32; // `cy + y` is truncated by fillRect's `|0`
            let sp = span as i32;
            self.fill_rect(cx - sp, cy + yi, sp * 2 + 1, 1, c);
            y += 1.0;
        }
    }

    /// Checkerboard dither: sets every other pixel (parity 0/1) in a rect.
    pub fn dither(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8, parity: i32) {
        for yy in 0..h {
            for xx in 0..w {
                if ((xx + yy + parity) & 1) == 0 {
                    self.set_pixel(x + xx, y + yy, c);
                }
            }
        }
    }

    /// Draw a sprite with its top-left corner at (x, y).
    pub fn sprite(&mut self, s: &Sprite, x: i32, y: i32, opts: &BlitOpts) {
        let n = s.frame_count();
        let f = opts.frame % n;
        let frame = &s.frames[(if f < 0 { f + n } else { f }) as usize];
        for sy in 0..s.h {
            let dy = y + sy;
            if dy < self.clip_y0 || dy >= self.clip_y1 {
                continue;
            }
            let src_row = ((if opts.flip_y { s.h - 1 - sy } else { sy }) * s.w) as usize;
            for sx in 0..s.w {
                let dx = x + sx;
                if dx < self.clip_x0 || dx >= self.clip_x1 {
                    continue;
                }
                let mut v = frame[src_row + (if opts.flip_x { s.w - 1 - sx } else { sx }) as usize];
                if v == TRANSPARENT {
                    continue;
                }
                if let Some(sc) = opts.solid {
                    v = sc;
                } else if let Some(r) = opts.recolor {
                    v = r[v as usize];
                }
                self.px[dy as usize * W + dx as usize] = v;
            }
        }
    }

    /// Copy a rectangle from another framebuffer (no transparency).
    pub fn blit(&mut self, src: &Framebuffer, sx: i32, sy: i32, w: i32, h: i32, dx: i32, dy: i32) {
        for yy in 0..h {
            let y = dy + yy;
            let syy = sy + yy;
            if y < self.clip_y0 || y >= self.clip_y1 || syy < 0 || syy >= SCREEN_H {
                continue;
            }
            for xx in 0..w {
                let x = dx + xx;
                let sxx = sx + xx;
                if x < self.clip_x0 || x >= self.clip_x1 || sxx < 0 || sxx >= SCREEN_W {
                    continue;
                }
                self.px[y as usize * W + x as usize] = src.px[syy as usize * W + sxx as usize];
            }
        }
    }

    pub fn copy_from(&mut self, src: &Framebuffer) {
        self.px.copy_from_slice(&src.px);
    }

    /// Darken everything in a rect by `steps` NES luminance rows (fades, pause dimming).
    pub fn darken_rect(&mut self, x: i32, y: i32, w: i32, h: i32, steps: i32) {
        if steps <= 0 {
            return;
        }
        let x0 = x.max(self.clip_x0);
        let y0 = y.max(self.clip_y0);
        let x1 = (x + w).min(self.clip_x1);
        let y1 = (y + h).min(self.clip_y1);
        for yy in y0..y1 {
            for xx in x0..x1 {
                let i = yy as usize * W + xx as usize;
                self.px[i] = darken(self.px[i], steps);
            }
        }
    }

    pub fn darken_all(&mut self, steps: i32) {
        if steps <= 0 {
            return;
        }
        for p in self.px.iter_mut() {
            *p = darken(*p, steps);
        }
    }

    /// Convert to RGBA bytes (R,G,B,A per pixel). `out` must be at least 256*240*4 bytes.
    pub fn to_rgba(&self, out: &mut [u8]) {
        let lut = build_rgba_lut();
        for (i, &p) in self.px.iter().enumerate() {
            out[i * 4..i * 4 + 4].copy_from_slice(&lut[(p & 0x3f) as usize].to_le_bytes());
        }
    }

    /// Cheap content hash (determinism checks, "did anything change" tests).
    pub fn hash(&self) -> u32 {
        let mut h: i32 = 0x811c9dc5u32 as i32;
        for &p in &self.px {
            h ^= p as i32;
            h = imul(h, 0x01000193);
        }
        h as u32
    }

    /// Number of pixels that are not `bg`.
    pub fn count_not(&self, bg: u8) -> i32 {
        self.px.iter().filter(|&&p| p != bg).count() as i32
    }

    /// Debug: render a region as ASCII (one char per distinct colour).
    pub fn dump(&self, x: i32, y: i32, w: i32, h: i32) -> String {
        let chars: Vec<char> = ".#@%&*+=-:;~^o0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".chars().collect();
        let mut seen: Vec<u8> = Vec::new();
        let mut out = String::new();
        for yy in y..y + h {
            for xx in x..x + w {
                let c = self.get_pixel(xx, yy);
                let idx = match seen.iter().position(|&s| s == c) {
                    Some(i) => i,
                    None => {
                        seen.push(c);
                        seen.len() - 1
                    }
                };
                out.push(chars[idx % chars.len()]);
            }
            out.push('\n');
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::super::palette::{c, NES_RGB};
    use super::super::sprite::{make_recolor, parse_sprite, SpriteDef};
    use super::*;

    #[test]
    fn blits_with_transparency_flip_recolour_and_clipping() {
        let mut fb = Framebuffer::new();
        fb.clear(c::BLACK);
        let pal = [('R', c::RED), ('W', c::WHITE)];
        let s = parse_sprite(&SpriteDef { name: "t", w: 2, h: 1, pal: &pal, rows: Some(&["R."]), frames: None });
        let d = BlitOpts::default();
        fb.sprite(&s, 10, 10, &d);
        assert_eq!(fb.get_pixel(10, 10), c::RED);
        assert_eq!(fb.get_pixel(11, 10), c::BLACK);
        fb.sprite(&s, 20, 10, &d.flip_x(true));
        assert_eq!(fb.get_pixel(21, 10), c::RED);
        let lut = make_recolor(&[(c::RED, c::BLUE)]);
        fb.sprite(&s, 30, 10, &d.recolor(&lut));
        assert_eq!(fb.get_pixel(30, 10), c::BLUE);
        fb.sprite(&s, 40, 10, &d.solid(c::WHITE));
        assert_eq!(fb.get_pixel(40, 10), c::WHITE);
        fb.push_clip(0, 0, 5, 5);
        fb.fill_rect(0, 0, 50, 50, c::GREEN);
        fb.pop_clip();
        assert_eq!(fb.get_pixel(4, 4), c::GREEN);
        assert_ne!(fb.get_pixel(5, 5), c::GREEN);
    }

    #[test]
    fn is_hashable_and_convertible_to_rgba() {
        let mut fb = Framebuffer::new();
        fb.clear(c::BLACK);
        let h0 = fb.hash();
        fb.set_pixel(1, 1, c::RED);
        assert_ne!(fb.hash(), h0);
        let mut out = vec![0u8; 256 * 240 * 4];
        fb.to_rgba(&mut out);
        let i = (256 + 1) * 4;
        let rgb = NES_RGB[c::RED as usize];
        assert_eq!(out[i..i + 4], [((rgb >> 16) & 255) as u8, ((rgb >> 8) & 255) as u8, (rgb & 255) as u8, 255]);
    }

    #[test]
    fn hash_of_cleared_buffer_matches_fnv1a() {
        // FNV-1a over 61440 identical bytes, cross-checked against the TS formula.
        let mut fb = Framebuffer::new();
        fb.clear(0);
        let mut h: u32 = 0x811c9dc5;
        for _ in 0..256 * 240 {
            h = h.wrapping_mul(0x01000193);
        }
        assert_eq!(fb.hash(), h);
    }

    #[test]
    fn circle_line_and_dither_draw() {
        let mut fb = Framebuffer::new();
        fb.clear(c::BLACK);
        fb.fill_circle(20, 20, 3.0, c::RED);
        assert_eq!(fb.get_pixel(20, 20), c::RED);
        assert_eq!(fb.get_pixel(23, 20), c::RED);
        assert_eq!(fb.get_pixel(24, 20), c::BLACK);
        fb.line(0, 0, 5, 5, c::WHITE);
        assert_eq!(fb.get_pixel(3, 3), c::WHITE);
        fb.dither(100, 100, 4, 4, c::BLUE, 0);
        assert_eq!(fb.px.iter().filter(|&&p| p == c::BLUE).count(), 8);
    }
}
