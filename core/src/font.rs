//! Hand-made bitmap fonts: a 5x7 font (6 px advance) and a tiny 3x5 font (4 px advance).
//! Lowercase maps to uppercase. Unknown characters draw as a hollow box.
use crate::pixel::{c, Canvas};

pub const ADV: i32 = 6;
pub const TINY_ADV: i32 = 4;
/// Heart glyph character (use in copy where a heart is wanted).
pub const HEART: char = '^';

fn glyph5(ch: char) -> [u8; 7] {
    match ch.to_ascii_uppercase() {
        ' ' => [0; 7],
        'A' => [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
        'B' => [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
        'C' => [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
        'D' => [0x1E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1E],
        'E' => [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
        'F' => [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
        'G' => [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
        'H' => [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
        'I' => [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
        'J' => [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
        'K' => [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
        'L' => [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
        'M' => [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
        'N' => [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
        'O' => [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
        'P' => [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
        'Q' => [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
        'R' => [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
        'S' => [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
        'T' => [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
        'U' => [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
        'V' => [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
        'W' => [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A],
        'X' => [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
        'Y' => [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
        'Z' => [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
        '0' => [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
        '1' => [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
        '2' => [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F],
        '3' => [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
        '4' => [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
        '5' => [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
        '6' => [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
        '7' => [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
        '8' => [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
        '9' => [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
        '!' => [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
        '?' => [0x0E, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
        '.' => [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C],
        ',' => [0x00, 0x00, 0x00, 0x00, 0x0C, 0x04, 0x08],
        ':' => [0x00, 0x0C, 0x0C, 0x00, 0x0C, 0x0C, 0x00],
        ';' => [0x0C, 0x0C, 0x00, 0x0C, 0x04, 0x08, 0x00],
        '-' => [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
        '+' => [0x00, 0x04, 0x04, 0x1F, 0x04, 0x04, 0x00],
        '*' => [0x00, 0x15, 0x0E, 0x1F, 0x0E, 0x15, 0x00],
        '/' => [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
        '\'' => [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
        '"' => [0x0A, 0x0A, 0x0A, 0x00, 0x00, 0x00, 0x00],
        '(' => [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
        ')' => [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
        '#' => [0x0A, 0x0A, 0x1F, 0x0A, 0x1F, 0x0A, 0x0A],
        '$' => [0x04, 0x0F, 0x14, 0x0E, 0x05, 0x1E, 0x04],
        '%' => [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
        '&' => [0x0C, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0D],
        '=' => [0x00, 0x00, 0x1F, 0x00, 0x1F, 0x00, 0x00],
        '<' => [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
        '>' => [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
        '@' => [0x0E, 0x11, 0x17, 0x15, 0x17, 0x10, 0x0E],
        '_' => [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1F],
        '^' => [0x0A, 0x1F, 0x1F, 0x1F, 0x0E, 0x04, 0x00],
        '|' => [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
        _ => [0x1F, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1F],
    }
}

fn glyph3(ch: char) -> [u8; 5] {
    match ch.to_ascii_uppercase() {
        ' ' => [0; 5],
        'A' => [2, 5, 7, 5, 5],
        'B' => [6, 5, 6, 5, 6],
        'C' => [3, 4, 4, 4, 3],
        'D' => [6, 5, 5, 5, 6],
        'E' => [7, 4, 6, 4, 7],
        'F' => [7, 4, 6, 4, 4],
        'G' => [3, 4, 5, 5, 3],
        'H' => [5, 5, 7, 5, 5],
        'I' => [7, 2, 2, 2, 7],
        'J' => [1, 1, 1, 5, 2],
        'K' => [5, 5, 6, 5, 5],
        'L' => [4, 4, 4, 4, 7],
        'M' => [5, 7, 7, 5, 5],
        'N' => [6, 5, 5, 5, 5],
        'O' => [2, 5, 5, 5, 2],
        'P' => [6, 5, 6, 4, 4],
        'Q' => [2, 5, 5, 7, 3],
        'R' => [6, 5, 6, 5, 5],
        'S' => [3, 4, 2, 1, 6],
        'T' => [7, 2, 2, 2, 2],
        'U' => [5, 5, 5, 5, 7],
        'V' => [5, 5, 5, 5, 2],
        'W' => [5, 5, 7, 7, 5],
        'X' => [5, 5, 2, 5, 5],
        'Y' => [5, 5, 2, 2, 2],
        'Z' => [7, 1, 2, 4, 7],
        '0' => [7, 5, 5, 5, 7],
        '1' => [2, 6, 2, 2, 7],
        '2' => [6, 1, 2, 4, 7],
        '3' => [6, 1, 2, 1, 6],
        '4' => [5, 5, 7, 1, 1],
        '5' => [7, 4, 6, 1, 6],
        '6' => [3, 4, 7, 5, 7],
        '7' => [7, 1, 2, 2, 2],
        '8' => [7, 5, 7, 5, 7],
        '9' => [7, 5, 7, 1, 6],
        '.' => [0, 0, 0, 0, 2],
        '!' => [2, 2, 2, 0, 2],
        '-' => [0, 0, 7, 0, 0],
        '\'' => [2, 2, 0, 0, 0],
        '&' => [2, 5, 2, 5, 3],
        '/' => [1, 1, 2, 4, 4],
        ':' => [0, 2, 0, 2, 0],
        '?' => [6, 1, 2, 0, 2],
        '%' => [5, 1, 2, 4, 5],
        '+' => [0, 2, 7, 2, 0],
        '_' => [0, 0, 0, 0, 7],
        _ => [7, 5, 5, 5, 7],
    }
}

/// Pixel width of `s` in the 5x7 font.
pub fn text_width(s: &str) -> i32 {
    let n = s.chars().count() as i32;
    if n == 0 {
        0
    } else {
        n * ADV - 1
    }
}

pub fn tiny_width(s: &str) -> i32 {
    let n = s.chars().count() as i32;
    if n == 0 {
        0
    } else {
        n * TINY_ADV - 1
    }
}

pub fn draw_text(cv: &mut Canvas, x: i32, y: i32, s: &str, col: u8) {
    let mut cx = x;
    for ch in s.chars() {
        let g = glyph5(ch);
        for (ry, row) in g.iter().enumerate() {
            for bx in 0..5 {
                if row & (0x10 >> bx) != 0 {
                    cv.pset(cx + bx, y + ry as i32, col);
                }
            }
        }
        cx += ADV;
    }
}

pub fn draw_text_shadow(cv: &mut Canvas, x: i32, y: i32, s: &str, col: u8, shadow: u8) {
    draw_text(cv, x + 1, y + 1, s, shadow);
    draw_text(cv, x, y, s, col);
}

pub fn draw_text_center(cv: &mut Canvas, cx: i32, y: i32, s: &str, col: u8) {
    draw_text(cv, cx - text_width(s) / 2, y, s, col);
}

pub fn draw_text_center_shadow(cv: &mut Canvas, cx: i32, y: i32, s: &str, col: u8, shadow: u8) {
    draw_text_shadow(cv, cx - text_width(s) / 2, y, s, col, shadow);
}

/// Draw text with each pixel scaled `k` times (big titles).
pub fn draw_text_big(cv: &mut Canvas, x: i32, y: i32, s: &str, col: u8, k: i32) {
    let mut cx = x;
    for ch in s.chars() {
        let g = glyph5(ch);
        for (ry, row) in g.iter().enumerate() {
            for bx in 0..5 {
                if row & (0x10 >> bx) != 0 {
                    cv.rect(cx + bx * k, y + ry as i32 * k, k, k, col);
                }
            }
        }
        cx += ADV * k;
    }
}

pub fn big_width(s: &str, k: i32) -> i32 {
    text_width(s) * k
}

pub fn draw_tiny(cv: &mut Canvas, x: i32, y: i32, s: &str, col: u8) {
    let mut cx = x;
    for ch in s.chars() {
        let g = glyph3(ch);
        for (ry, row) in g.iter().enumerate() {
            for bx in 0..3 {
                if row & (0x04 >> bx) != 0 {
                    cv.pset(cx + bx, y + ry as i32, col);
                }
            }
        }
        cx += TINY_ADV;
    }
}

pub fn draw_tiny_center(cv: &mut Canvas, cx: i32, y: i32, s: &str, col: u8) {
    draw_tiny(cv, cx - tiny_width(s) / 2, y, s, col);
}

/// A rounded speech/banner box with centred lines. Returns the box rectangle.
pub fn draw_box(cv: &mut Canvas, x: i32, y: i32, w: i32, h: i32, fill: u8, border: u8) {
    cv.rect(x, y, w, h, fill);
    cv.frame(x, y, w, h, border);
    // knock the corners for a rounded look
    for (cx, cy) in [(x, y), (x + w - 1, y), (x, y + h - 1), (x + w - 1, y + h - 1)] {
        cv.pset(cx, cy, c::BLACK);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn widths() {
        assert_eq!(text_width(""), 0);
        assert_eq!(text_width("AB"), 11);
        assert_eq!(tiny_width("AB"), 7);
    }
    #[test]
    fn every_printable_copy_char_has_a_glyph() {
        // The fallback box is all-edges; ensure common copy chars are not the fallback.
        let fallback = glyph5('\u{1}');
        for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?.,:;-+*/'\"()#$%&=<>@_^|".chars() {
            assert_ne!(glyph5(ch), fallback, "{ch}");
        }
    }
    #[test]
    fn draws_pixels() {
        let mut cv = Canvas::new(16, 8);
        draw_text(&mut cv, 0, 0, "I", 0x30);
        assert_eq!(cv.get(2, 0), crate::pixel::rgb(0x30));
    }
}
