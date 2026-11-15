//! Pixel-art pipeline: sprites are written as character grids in source code and
//! parsed into palette-index bitmaps. A sprite may use at most 3 colours plus
//! transparent (the NES limit); `parse_sprite` errors if it breaks that or if the
//! grid is not exactly w x h.

use super::palette::TRANSPARENT;

#[derive(Clone, Debug, PartialEq)]
pub struct Sprite {
    pub name: String,
    pub w: i32,
    pub h: i32,
    /// One entry per animation frame, each `w*h` palette indices row-major, TRANSPARENT (255) for empty pixels.
    pub frames: Vec<Vec<u8>>,
    /// Distinct opaque colours used (<= 3), in order of first use.
    pub colors: Vec<u8>,
}

impl Sprite {
    /// TS `sprite.frames` (the count).
    pub fn frame_count(&self) -> i32 {
        self.frames.len() as i32
    }
}

#[derive(Clone, Debug)]
pub struct SpriteDef<'a> {
    pub name: &'a str,
    pub w: i32,
    pub h: i32,
    /// Character -> NES palette index. '.' and ' ' are always transparent. At most 3 distinct colours.
    pub pal: &'a [(char, u8)],
    /// One frame (rows of exactly w chars) ...
    pub rows: Option<&'a [&'a str]>,
    /// ... or several animation frames (takes precedence, like TS `frames ?? rows`).
    pub frames: Option<&'a [&'a [&'a str]]>,
}

pub const MAX_SPRITE_COLORS: usize = 3;

/// Same checks and error messages as the TS `parseSprite` (which threw).
pub fn try_parse_sprite(def: &SpriteDef) -> Result<Sprite, String> {
    let (name, w, h) = (def.name, def.w, def.h);
    let single;
    let frame_rows: &[&[&str]] = match (def.frames, def.rows) {
        (Some(f), _) => f,
        (None, Some(r)) => {
            single = [r];
            &single
        }
        (None, None) => &[],
    };
    if frame_rows.is_empty() {
        return Err(format!("sprite {}: no rows/frames", name));
    }
    let mut frames: Vec<Vec<u8>> = Vec::new();
    let mut used: Vec<u8> = Vec::new();
    for (f, rows) in frame_rows.iter().enumerate() {
        let mut data = vec![TRANSPARENT; (w * h) as usize];
        if rows.len() as i32 != h {
            return Err(format!("sprite {} frame {}: expected {} rows, got {}", name, f, h, rows.len()));
        }
        for (y, row) in rows.iter().enumerate() {
            let chars: Vec<char> = row.chars().collect();
            if chars.len() as i32 != w {
                return Err(format!(
                    "sprite {} frame {} row {}: expected {} chars, got {} (\"{}\")",
                    name,
                    f,
                    y,
                    w,
                    chars.len(),
                    row
                ));
            }
            for x in 0..w as usize {
                let ch = chars[x];
                if ch == '.' || ch == ' ' {
                    continue;
                }
                let c = match def.pal.iter().find(|(k, _)| *k == ch) {
                    Some((_, c)) => *c,
                    None => {
                        return Err(format!("sprite {} frame {} ({},{}): char '{}' not in palette", name, f, x, y, ch));
                    }
                };
                data[y * w as usize + x] = c;
                if !used.contains(&c) {
                    used.push(c);
                }
            }
        }
        frames.push(data);
    }
    if used.len() > MAX_SPRITE_COLORS {
        return Err(format!("sprite {}: uses {} colours (max {})", name, used.len(), MAX_SPRITE_COLORS));
    }
    Ok(Sprite { name: name.to_string(), w, h, frames, colors: used })
}

/// Panicking wrapper (the game's sprite tables are static, so a bad one is a bug).
pub fn parse_sprite(def: &SpriteDef) -> Sprite {
    match try_parse_sprite(def) {
        Ok(s) => s,
        Err(e) => panic!("{}", e),
    }
}

/// Build a sprite from raw data (procedural sprites), frame-major then row-major. Validates the colour limit.
pub fn try_sprite_from_data(name: &str, w: i32, h: i32, frames: i32, data: &[u8]) -> Result<Sprite, String> {
    if data.len() as i32 != w * h * frames {
        return Err(format!("sprite {}: data length mismatch", name));
    }
    let mut used: Vec<u8> = Vec::new();
    for &v in data {
        if v != TRANSPARENT && !used.contains(&v) {
            used.push(v);
        }
    }
    if used.len() > MAX_SPRITE_COLORS {
        return Err(format!("sprite {}: uses {} colours (max {})", name, used.len(), MAX_SPRITE_COLORS));
    }
    let fl = (w * h) as usize;
    let fr: Vec<Vec<u8>> = (0..frames as usize).map(|f| data[f * fl..(f + 1) * fl].to_vec()).collect();
    Ok(Sprite { name: name.to_string(), w, h, frames: fr, colors: used })
}

pub fn sprite_from_data(name: &str, w: i32, h: i32, frames: i32, data: &[u8]) -> Sprite {
    match try_sprite_from_data(name, w, h, frames, data) {
        Ok(s) => s,
        Err(e) => panic!("{}", e),
    }
}

/// A recolour LUT (index -> index) for palette swaps (variants, hit-flash).
pub type Recolor = [u8; 64];

pub fn make_recolor(map: &[(u8, u8)]) -> Recolor {
    let mut lut = [0u8; 64];
    for i in 0..64 {
        lut[i] = i as u8;
    }
    for &(from, to) in map {
        lut[from as usize] = to;
    }
    lut
}

pub fn sprite_pixel(s: &Sprite, x: i32, y: i32, frame: i32) -> u8 {
    if x < 0 || y < 0 || x >= s.w || y >= s.h {
        return TRANSPARENT;
    }
    s.frames[(frame % s.frame_count()) as usize][(y * s.w + x) as usize]
}

#[cfg(test)]
mod tests {
    use super::super::palette::c;
    use super::*;

    const PAL: [(char, u8); 3] = [('K', c::BLACK), ('R', c::RED), ('W', c::WHITE)];

    fn def<'a>(name: &'a str, w: i32, h: i32, pal: &'a [(char, u8)], rows: &'a [&'a str]) -> SpriteDef<'a> {
        SpriteDef { name, w, h, pal, rows: Some(rows), frames: None }
    }

    #[test]
    fn parses_a_grid_and_reads_pixels() {
        let s = parse_sprite(&def("t", 3, 2, &PAL, &["KRW", ".K."]));
        assert_eq!(sprite_pixel(&s, 0, 0, 0), c::BLACK);
        assert_eq!(sprite_pixel(&s, 2, 0, 0), c::WHITE);
        assert_eq!(sprite_pixel(&s, 0, 1, 0), TRANSPARENT);
        assert_eq!(s.colors.len(), 3);
    }
    #[test]
    fn rejects_wrong_sizes_unknown_chars_and_more_than_3_colours() {
        let e = try_parse_sprite(&def("a", 3, 2, &PAL, &["KRW"])).unwrap_err();
        assert!(e.contains("rows"));
        let e = try_parse_sprite(&def("a", 3, 1, &PAL, &["KR"])).unwrap_err();
        assert!(e.contains("chars"));
        let e = try_parse_sprite(&def("a", 1, 1, &PAL, &["Q"])).unwrap_err();
        assert!(e.contains("palette"));
        let pal4 = [('A', 1u8), ('B', 2), ('C', 3), ('D', 4)];
        let e = try_parse_sprite(&def("a", 4, 1, &pal4, &["ABCD"])).unwrap_err();
        assert!(e.contains("colours"));
    }
    #[test]
    #[should_panic(expected = "colours")]
    fn parse_sprite_panics_on_error() {
        let pal4 = [('A', 1u8), ('B', 2), ('C', 3), ('D', 4)];
        parse_sprite(&def("a", 4, 1, &pal4, &["ABCD"]));
    }
    #[test]
    fn supports_animation_frames() {
        let fr: [&[&str]; 2] = [&["KK"], &["RR"]];
        let s = parse_sprite(&SpriteDef { name: "a", w: 2, h: 1, pal: &PAL, rows: None, frames: Some(&fr) });
        assert_eq!(s.frame_count(), 2);
        assert_eq!(sprite_pixel(&s, 0, 0, 1), c::RED);
    }
}
