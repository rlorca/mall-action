//! Shared on-screen UI helpers used by every scene: speech bubbles, banners, bars, typewriter text, fades.
//! All coordinates are SCREEN pixels (256x240). Text always stays on screen.

use crate::copy::wrap;
use crate::pixel::{pal, text_width, Fb, FontKind, HUD_H, H, W};

/// Draw a speech bubble whose tail points at (`tip_x`, `tip_y`) (just above a speaker's head). The box is
/// moved horizontally/vertically so it never leaves the visible screen below the HUD. Text is word-wrapped
/// at 28 characters. Returns the box rectangle (x, y, w, h).
pub fn speech_bubble(fb: &mut Fb, text: &str, tip_x: i32, tip_y: i32) -> (i32, i32, i32, i32) {
    let lines = wrap(text, 28);
    let tw = lines.iter().map(|l| text_width(FontKind::Normal, l)).max().unwrap_or(0);
    let bw = tw + 8;
    let bh = lines.len() as i32 * 9 + 5;
    let mut bx = tip_x - bw / 2;
    bx = bx.clamp(2, W as i32 - bw - 2);
    let mut by = tip_y - 5 - bh;
    let flipped = by < HUD_H + 1;
    if flipped {
        by = tip_y + 12;
    }
    by = by.clamp(HUD_H + 1, H as i32 - bh - 2);
    fb.rect(bx, by, bw, bh, pal::WHITE);
    fb.frame(bx, by, bw, bh, pal::BLACK);
    for (i, l) in lines.iter().enumerate() {
        fb.text(bx + 4, by + 3 + i as i32 * 9, l, pal::BLACK);
    }
    // tail
    let tx = tip_x.clamp(bx + 4, bx + bw - 5);
    if !flipped && by + bh < tip_y {
        fb.put(tx, by + bh, pal::WHITE);
        fb.put(tx - 1, by + bh, pal::WHITE);
        fb.put(tx, by + bh + 1, pal::BLACK);
        fb.put(tx - 1, by + bh + 1, pal::WHITE);
        fb.put(tx, by + bh + 2, pal::BLACK);
    }
    (bx, by, bw, bh)
}

/// A centred banner box with up to a few wrapped lines, at vertical position `y` (top of the box).
pub fn banner_box(fb: &mut Fb, text: &str, y: i32, fg: u8, bg: u8, border: u8) -> (i32, i32, i32, i32) {
    let lines = wrap(text, crate::copy::BANNER_LINE_MAX);
    let tw = lines.iter().map(|l| text_width(FontKind::Normal, l)).max().unwrap_or(0);
    let bw = (tw + 12).min(W as i32 - 4);
    let bh = lines.len() as i32 * 9 + 7;
    let bx = (W as i32 - bw) / 2;
    fb.rect(bx, y, bw, bh, bg);
    fb.frame(bx, y, bw, bh, border);
    for (i, l) in lines.iter().enumerate() {
        fb.text_center(W as i32 / 2, y + 4 + i as i32 * 9, l, fg);
    }
    (bx, y, bw, bh)
}

/// A timed banner message. `show` sets it; `step` counts it down; `draw` paints it if alive.
#[derive(Clone, Debug, Default)]
pub struct Banner {
    pub text: String,
    pub frames_left: u32,
}

impl Banner {
    pub fn show(&mut self, text: &str, frames: u32) {
        self.text = text.to_string();
        self.frames_left = frames;
    }
    pub fn step(&mut self) {
        self.frames_left = self.frames_left.saturating_sub(1);
    }
    pub fn active(&self) -> bool {
        self.frames_left > 0
    }
    pub fn draw(&self, fb: &mut Fb, y: i32, fg: u8, bg: u8, border: u8) {
        if self.active() {
            banner_box(fb, &self.text, y, fg, bg, border);
        }
    }
}

/// Typewriter: the visible prefix of `text` after `frames` frames at `frames_per_char`.
pub fn typed(text: &str, frames: u32, frames_per_char: u32) -> &str {
    let n = (frames / frames_per_char.max(1)) as usize;
    match text.char_indices().nth(n) {
        Some((i, _)) => &text[..i],
        None => text,
    }
}

/// Horizontal progress bar (frac 0..=1).
pub fn bar(fb: &mut Fb, x: i32, y: i32, w: i32, h: i32, frac: f32, fg: u8, bg: u8) {
    fb.rect(x, y, w, h, bg);
    let fw = ((w as f32) * frac.clamp(0.0, 1.0)).round() as i32;
    fb.rect(x, y, fw, h, fg);
}

/// Dither fade toward black: `level` 0 (none) ..= 4 (fully black). Uses ordered 4x4 dithering so it works
/// on palette-indexed pixels.
pub fn fade_black(fb: &mut Fb, level: u32) {
    if level == 0 {
        return;
    }
    if level >= 4 {
        fb.clear(pal::BLACK);
        return;
    }
    const BAYER: [[u8; 4]; 4] = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    let thresh = level * 4; // 4, 8, 12
    for y in 0..H {
        for x in 0..W {
            if (BAYER[y & 3][x & 3] as u32) < thresh {
                fb.px[y * W + x] = pal::BLACK;
            }
        }
    }
}

/// Fade level for a transition of `total` frames at frame `t` going out (0 -> 4).
pub fn fade_level(t: u32, total: u32) -> u32 {
    if total == 0 {
        return 4;
    }
    ((t.min(total) * 4) / total).min(4)
}

/// Blink helper: true for `on` frames then false for `off` frames.
pub fn blink(tick: u32, on: u32, off: u32) -> bool {
    tick % (on + off).max(1) < on
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bubbles_stay_on_screen_everywhere() {
        for &(x, y) in &[(0, 0), (255, 239), (-50, 100), (300, 30), (128, 20), (10, 239), (250, 18)] {
            let mut fb = Fb::new();
            let (bx, by, bw, bh) = speech_bubble(&mut fb, "THESE ARE MY GETAWAY SHOES", x, y);
            assert!(bx >= 0 && by >= HUD_H && bx + bw <= W as i32 && by + bh <= H as i32, "{bx},{by},{bw},{bh} for tip {x},{y}");
        }
    }

    #[test]
    fn longest_bubble_line_fits_the_screen() {
        let mut fb = Fb::new();
        let s = "I WAS ON MY LUNCH BREAK!!!!!"; // 28 chars
        let (_, _, bw, _) = speech_bubble(&mut fb, s, 128, 100);
        assert!(bw <= W as i32);
    }

    #[test]
    fn banner_box_is_inside_the_screen() {
        let mut fb = Fb::new();
        let (x, _, w, _) = banner_box(&mut fb, "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.", 40, pal::WHITE, pal::BLACK, pal::WHITE);
        assert!(x >= 0 && x + w <= W as i32);
    }

    #[test]
    fn banner_counts_down() {
        let mut b = Banner::default();
        assert!(!b.active());
        b.show("HI", 2);
        assert!(b.active());
        b.step();
        b.step();
        assert!(!b.active());
    }

    #[test]
    fn typewriter_reveals_progressively() {
        assert_eq!(typed("HELLO", 0, 2), "");
        assert_eq!(typed("HELLO", 4, 2), "HE");
        assert_eq!(typed("HELLO", 100, 2), "HELLO");
    }

    #[test]
    fn fade_levels() {
        let mut fb = Fb::new();
        fb.clear(pal::WHITE);
        fade_black(&mut fb, 0);
        assert!(fb.px.iter().all(|p| *p == pal::WHITE));
        fade_black(&mut fb, 2);
        let black = fb.px.iter().filter(|p| **p == pal::BLACK).count();
        assert!(black > W * H / 4 && black < W * H * 3 / 4, "{black}");
        fade_black(&mut fb, 4);
        assert!(fb.px.iter().all(|p| *p == pal::BLACK));
        assert_eq!(fade_level(0, 20), 0);
        assert_eq!(fade_level(20, 20), 4);
    }

    #[test]
    fn blink_pattern() {
        assert!(blink(0, 4, 4) && blink(3, 4, 4) && !blink(4, 4, 4) && blink(8, 4, 4));
    }

    #[test]
    fn bar_fills_proportionally() {
        let mut fb = Fb::new();
        bar(&mut fb, 0, 0, 10, 2, 0.5, pal::RED, pal::DGRAY);
        assert_eq!(fb.get(4, 0), pal::RED);
        assert_eq!(fb.get(5, 0), pal::DGRAY);
    }
}
