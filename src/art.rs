pub const W: usize = 256;
pub const H: usize = 240;
pub const PAL: [[u8; 3]; 48] = [
    [7, 8, 22],
    [18, 18, 47],
    [37, 30, 67],
    [55, 47, 81],
    [90, 84, 115],
    [133, 135, 161],
    [192, 198, 216],
    [255, 243, 214],
    [67, 16, 57],
    [128, 22, 77],
    [220, 35, 68],
    [255, 76, 99],
    [255, 169, 137],
    [94, 45, 39],
    [179, 93, 57],
    [255, 178, 70],
    [255, 228, 134],
    [15, 54, 65],
    [13, 100, 108],
    [19, 161, 163],
    [95, 234, 186],
    [193, 250, 191],
    [24, 30, 89],
    [51, 65, 156],
    [57, 110, 223],
    [95, 183, 255],
    [184, 229, 255],
    [57, 23, 99],
    [119, 49, 163],
    [198, 78, 197],
    [255, 129, 216],
    [255, 209, 237],
    [232, 216, 184],
    [196, 178, 151],
    [148, 131, 120],
    [87, 72, 78],
    [37, 48, 55],
    [59, 78, 79],
    [112, 139, 131],
    [177, 196, 171],
    [47, 33, 54],
    [71, 45, 64],
    [113, 72, 58],
    [156, 108, 76],
    [202, 155, 100],
    [112, 140, 179],
    [67, 85, 116],
    [217, 183, 179],
];
pub struct Canvas {
    pub pixels: Vec<u8>,
}
impl Canvas {
    pub fn new() -> Self {
        Self {
            pixels: vec![0; W * H * 4],
        }
    }
    pub fn clear(&mut self, c: usize) {
        self.rect(0, 0, 256, 240, c)
    }
    pub fn pixel(&mut self, x: i32, y: i32, c: usize) {
        if !(0..256).contains(&x) || !(0..240).contains(&y) {
            return;
        }
        let i = (y as usize * W + x as usize) * 4;
        self.pixels[i..i + 3].copy_from_slice(&PAL[c % PAL.len()]);
        self.pixels[i + 3] = 255;
    }
    pub fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: usize) {
        for yy in y.max(0)..(y + h).min(240) {
            for xx in x.max(0)..(x + w).min(256) {
                self.pixel(xx, yy, c)
            }
        }
    }
    pub fn outline(&mut self, x: i32, y: i32, w: i32, h: i32, c: usize) {
        self.rect(x, y, w, 1, c);
        self.rect(x, y + h - 1, w, 1, c);
        self.rect(x, y, 1, h, c);
        self.rect(x + w - 1, y, 1, h, c)
    }
    pub fn line(&mut self, x: i32, y: i32, a: i32, b: i32, c: usize) {
        let n = (a - x).abs().max((b - y).abs()).max(1);
        for i in 0..=n {
            self.pixel(x + (a - x) * i / n, y + (b - y) * i / n, c)
        }
    }
    pub fn text(&mut self, x: i32, y: i32, s: &str, c: usize) {
        self.text_scale(x, y, s, c, 1)
    }
    pub fn text_scale(&mut self, x: i32, y: i32, s: &str, c: usize, scale: i32) {
        let mut xx = x;
        for ch in s.chars() {
            let rows = glyph(ch.to_ascii_uppercase());
            for (yy, row) in rows.iter().enumerate() {
                for bit in 0..3 {
                    if row & (1 << (2 - bit)) != 0 {
                        self.rect(xx + bit * scale, y + yy as i32 * scale, scale, scale, c)
                    }
                }
            }
            xx += 4 * scale;
        }
    }
    pub fn center(&mut self, y: i32, s: &str, c: usize) {
        self.text((256 - s.chars().count() as i32 * 4) / 2, y, s, c)
    }
    pub fn wrap(&mut self, x: i32, y: i32, s: &str, c: usize, cols: usize) -> i32 {
        let mut line = String::new();
        let mut yy = y;
        for word in s.split_whitespace() {
            if line.len() + word.len() + 1 > cols && !line.is_empty() {
                self.text(x, yy, &line, c);
                yy += 8;
                line.clear()
            }
            if !line.is_empty() {
                line.push(' ')
            }
            line.push_str(word)
        }
        if !line.is_empty() {
            self.text(x, yy, &line, c);
            yy += 8
        }
        yy
    }
    pub fn stamp_scaled(&mut self, x: i32, y: i32, rows: &[&str], inks: [usize; 3], scale: i32) {
        for (yy, row) in rows.iter().enumerate() {
            for (xx, p) in row.bytes().enumerate() {
                if (b'1'..=b'3').contains(&p) {
                    self.rect(
                        x + xx as i32 * scale,
                        y + yy as i32 * scale,
                        scale,
                        scale,
                        inks[(p - b'1') as usize],
                    );
                }
            }
        }
    }
    pub fn logo(&mut self, x: i32, y: i32, text: &str, scale: i32) {
        for depth in (1..=4).rev() {
            for (i, ch) in text.chars().enumerate() {
                for (yy, row) in big_glyph(ch).iter().enumerate() {
                    for xx in 0..5 {
                        if row & (1 << (4 - xx)) != 0 {
                            let px = x + i as i32 * 6 * scale + xx * scale + (6 - yy as i32) / 2;
                            let py = y + yy as i32 * scale;
                            self.rect(
                                px - 1 + depth,
                                py - 1 + depth,
                                scale + 2,
                                scale + 2,
                                if depth == 4 { 0 } else { 8 },
                            );
                        }
                    }
                }
            }
        }
        for (i, ch) in text.chars().enumerate() {
            for (yy, row) in big_glyph(ch).iter().enumerate() {
                for xx in 0..5 {
                    if row & (1 << (4 - xx)) != 0 {
                        let px = x + i as i32 * 6 * scale + xx * scale + (6 - yy as i32) / 2;
                        let py = y + yy as i32 * scale;
                        self.rect(px, py, scale, scale, if yy < 3 { 16 } else { 11 });
                        if yy == 0 || big_glyph(ch)[yy - 1] & (1 << (4 - xx)) == 0 {
                            self.rect(px, py, scale, 1, 7)
                        }
                        if xx == 4 || row & (1 << (3 - xx)) == 0 {
                            self.rect(px + scale - 1, py, 1, scale, if yy < 3 { 15 } else { 10 });
                        }
                    }
                }
            }
        }
    }
    pub fn stamp(&mut self, x: i32, y: i32, rows: &[&str], inks: [usize; 3], flip: bool) {
        let w = rows.iter().map(|r| r.len()).max().unwrap_or(0) as i32;
        for (yy, row) in rows.iter().enumerate() {
            for (xx, p) in row.bytes().enumerate() {
                if (b'1'..=b'3').contains(&p) {
                    self.pixel(
                        x + if flip { w - 1 - xx as i32 } else { xx as i32 },
                        y + yy as i32,
                        inks[(p - b'1') as usize],
                    );
                }
            }
        }
    }
    pub fn label(&mut self, x: i32, y: i32, s: &str, color: usize) {
        for (i, ch) in s.chars().enumerate() {
            for (yy, row) in big_glyph(ch.to_ascii_uppercase()).iter().enumerate() {
                for xx in 0..5 {
                    if row & (1 << (4 - xx)) != 0 {
                        self.pixel(x + i as i32 * 6 + xx, y + yy as i32, color);
                    }
                }
            }
        }
    }
    pub fn sprite(&mut self, x: i32, y: i32, id: usize, frame: u32, flip: bool) {
        let s = sprite(id, frame);
        let colors = match id {
            0 => [10, 7, 0],
            1 => [4, 7, 0],
            2 => [24, 7, 0],
            3 => [19, 7, 0],
            4 => [15, 7, 0],
            5 => [25, 7, 0],
            6 => [10, 7, 0],
            8 => [4, 7, 0],
            9 => [10, 7, 0],
            10 => [29, 7, 0],
            11 => [19, 7, 0],
            _ => [29, 7, 0],
        };
        for yy in 0..s.h {
            for xx in 0..s.w {
                let p = s.data[yy * s.w + xx];
                if p > 0 {
                    self.pixel(
                        x + if flip {
                            (s.w - 1 - xx) as i32
                        } else {
                            xx as i32
                        },
                        y + yy as i32,
                        colors[p as usize - 1],
                    );
                }
            }
        }
    }
}
pub struct Sprite {
    pub w: usize,
    pub h: usize,
    pub data: Vec<u8>,
}
pub fn sprite(id: usize, frame: u32) -> Sprite {
    use crate::pixel::*;
    let rows = match id {
        0 | 2 | 3 => AGENT,
        1 => SPY,
        4 => PACKAGE,
        5 => BOT,
        6 | 8 => SMALL_AGENT,
        9 => SMALL_BACK,
        10 => WALKER,
        11 => WALKER_B,
        _ => POWER,
    };
    let h = if id < 4 || id == 10 || id == 11 {
        24
    } else {
        16
    };
    let mut s = Sprite {
        w: 16,
        h,
        data: vec![0; 16 * h],
    };
    for (y, row) in rows.iter().take(h).enumerate() {
        for (x, p) in row.bytes().take(16).enumerate() {
            s.data[y * 16 + x] = if p == b'.' { 0 } else { p - b'0' };
        }
    }
    // Four poses have different silhouettes; hands swing against the planted foot.
    if matches!(id, 0 | 1 | 2 | 3 | 10 | 11) && frame % 4 == 1 {
        for y in 18..23 {
            for x in 0..16 {
                s.data[y * 16 + x] = 0;
            }
        }
        for (y, left, right) in [
            (18, 5, 9),
            (19, 4, 10),
            (20, 3, 11),
            (21, 3, 12),
            (22, 2, 12),
        ] {
            for x in left..left + 2 {
                s.data[y * 16 + x] = if id >= 10 && y < 21 { 1 } else { 3 };
            }
            for x in right..right + 2 {
                s.data[y * 16 + x] = if id >= 10 && y < 21 { 1 } else { 3 };
            }
        }
    }
    if matches!(id, 0 | 1 | 2 | 3 | 10 | 11) && frame % 4 == 3 {
        for y in 18..23 {
            for x in 0..16 {
                s.data[y * 16 + x] = 0;
            }
        }
        for (y, left, right) in [(18, 7, 8), (19, 7, 8), (20, 7, 9), (21, 6, 9), (22, 5, 10)] {
            for x in left..left + 2 {
                s.data[y * 16 + x] = if id >= 10 && y < 21 { 1 } else { 3 };
            }
            for x in right..right + 2 {
                s.data[y * 16 + x] = if id >= 10 && y < 21 { 1 } else { 3 };
            }
        }
    }
    if matches!(id, 6 | 8 | 9) && frame % 2 == 1 {
        for x in 3..6 {
            s.data[15 * 16 + x] = 0;
        }
        s.data[14 * 16 + 4] = 3;
        s.data[14 * 16 + 3] = 3;
    }
    s
}
pub fn big_glyph(c: char) -> [u8; 7] {
    match c {
        '0' => [14, 17, 19, 21, 25, 17, 14],
        '1' => [4, 12, 4, 4, 4, 4, 14],
        '2' => [14, 17, 1, 2, 4, 8, 31],
        '3' => [30, 1, 1, 14, 1, 1, 30],
        '4' => [2, 6, 10, 18, 31, 2, 2],
        '5' => [31, 16, 16, 30, 1, 1, 30],
        '6' => [14, 16, 16, 30, 17, 17, 14],
        '7' => [31, 1, 2, 4, 8, 8, 8],
        '8' => [14, 17, 17, 14, 17, 17, 14],
        '9' => [14, 17, 17, 15, 1, 1, 14],
        '\'' => [4, 4, 8, 0, 0, 0, 0],
        '!' => [4, 4, 4, 4, 4, 0, 4],
        '-' => [0, 0, 0, 31, 0, 0, 0],
        'A' => [14, 17, 17, 31, 17, 17, 17],
        'B' => [30, 17, 17, 30, 17, 17, 30],
        'C' => [14, 17, 16, 16, 16, 17, 14],
        'D' => [30, 17, 17, 17, 17, 17, 30],
        'E' => [31, 16, 16, 30, 16, 16, 31],
        'F' => [31, 16, 16, 30, 16, 16, 16],
        'G' => [14, 17, 16, 23, 17, 17, 15],
        'H' => [17, 17, 17, 31, 17, 17, 17],
        'I' => [31, 4, 4, 4, 4, 4, 31],
        'J' => [7, 2, 2, 2, 18, 18, 12],
        'K' => [17, 18, 20, 24, 20, 18, 17],
        'L' => [16, 16, 16, 16, 16, 16, 31],
        'M' => [17, 27, 21, 21, 17, 17, 17],
        'N' => [17, 25, 25, 21, 19, 19, 17],
        'O' => [14, 17, 17, 17, 17, 17, 14],
        'P' => [30, 17, 17, 30, 16, 16, 16],
        'Q' => [14, 17, 17, 17, 21, 18, 13],
        'R' => [30, 17, 17, 30, 20, 18, 17],
        'S' => [15, 16, 16, 14, 1, 1, 30],
        'T' => [31, 4, 4, 4, 4, 4, 4],
        'U' => [17, 17, 17, 17, 17, 17, 14],
        'V' => [17, 17, 17, 17, 17, 10, 4],
        'W' => [17, 17, 17, 21, 21, 27, 17],
        'X' => [17, 17, 10, 4, 10, 17, 17],
        'Y' => [17, 17, 10, 4, 4, 4, 4],
        'Z' => [31, 1, 2, 4, 8, 16, 31],
        _ => [0; 7],
    }
}
impl Canvas {
    pub fn big(&mut self, x: i32, y: i32, s: &str, scale: i32, top: usize, bottom: usize) {
        for (i, ch) in s.chars().enumerate() {
            for (yy, row) in big_glyph(ch).iter().enumerate() {
                for xx in 0..5 {
                    if row & (1 << (4 - xx)) != 0 {
                        self.rect(
                            x + i as i32 * 6 * scale + xx * scale + 1,
                            y + yy as i32 * scale + 2,
                            scale,
                            scale,
                            0,
                        );
                        self.rect(
                            x + i as i32 * 6 * scale + xx * scale,
                            y + yy as i32 * scale,
                            scale,
                            scale,
                            if yy < 3 { top } else { bottom },
                        );
                    }
                }
            }
        }
    }
}
pub fn glyph(c: char) -> [u8; 5] {
    match c {
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
        'N' => [5, 7, 7, 7, 5],
        'O' => [2, 5, 5, 5, 2],
        'P' => [6, 5, 6, 4, 4],
        'Q' => [2, 5, 5, 3, 1],
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
        '!' => [2, 2, 2, 0, 2],
        '?' => [6, 1, 2, 0, 2],
        '.' => [0, 0, 0, 0, 2],
        ',' => [0, 0, 0, 2, 4],
        ':' => [0, 2, 0, 2, 0],
        ';' => [0, 2, 0, 2, 4],
        '-' => [0, 0, 7, 0, 0],
        '_' => [0, 0, 0, 0, 7],
        '/' => [1, 1, 2, 4, 4],
        '\\' => [4, 4, 2, 1, 1],
        '\'' => [2, 2, 0, 0, 0],
        '"' => [5, 5, 0, 0, 0],
        '(' => [1, 2, 2, 2, 1],
        ')' => [4, 2, 2, 2, 4],
        '+' => [0, 2, 7, 2, 0],
        '=' => [0, 7, 0, 7, 0],
        '%' => [5, 1, 2, 4, 5],
        '$' => [3, 6, 2, 3, 6],
        '#' => [5, 7, 5, 7, 5],
        '<' => [1, 2, 4, 2, 1],
        '>' => [4, 2, 1, 2, 4],
        '*' => [0, 5, 2, 5, 0],
        '&' => [2, 5, 2, 5, 3],
        '@' => [2, 5, 7, 4, 3],
        _ => [0; 5],
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sprites_have_three_colors() {
        for id in 0..12 {
            for f in 0..4 {
                let s = sprite(id, f);
                assert_eq!(s.w, 16);
                assert_eq!(
                    s.h,
                    if id < 4 || id == 10 || id == 11 {
                        24
                    } else {
                        16
                    }
                );
                assert!(s.data.iter().all(|p| *p <= 3));
                assert!(s.data.iter().any(|p| *p > 0));
            }
        }
    }
    #[test]
    fn clipping() {
        let mut c = Canvas::new();
        c.rect(-50, -50, 400, 400, 7);
        assert_eq!(c.pixels.len(), 256 * 240 * 4);
        assert!(c.pixels.chunks(4).all(|p| p[3] == 255));
    }
}
