//! Fixed NES-like master palette (64 entries, RGB). The framebuffer stores palette
//! INDICES, never RGB. `TRANSPARENT` marks "no pixel" in sprites.

pub const TRANSPARENT: u8 = 255;

// prettier-ignore
pub const PALETTE_RGB: [u32; 64] = [
    0x7c7c7c, 0x0000fc, 0x0000bc, 0x4428bc, 0x940084, 0xa80020, 0xa81000, 0x881400,
    0x503000, 0x007800, 0x006800, 0x005800, 0x004058, 0x000000, 0x000000, 0x000000,
    0xbcbcbc, 0x0078f8, 0x0058f8, 0x6844fc, 0xd800cc, 0xe40058, 0xf83800, 0xe45c10,
    0xac7c00, 0x00b800, 0x00a800, 0x00a844, 0x008888, 0x000000, 0x000000, 0x000000,
    0xf8f8f8, 0x3cbcfc, 0x6888fc, 0x9878f8, 0xf878f8, 0xf85898, 0xf87858, 0xfca044,
    0xf8b800, 0xb8f818, 0x58d854, 0x58f898, 0x00e8d8, 0x787878, 0x000000, 0x000000,
    0xfcfcfc, 0xa4e4fc, 0xb8b8f8, 0xd8b8f8, 0xf8b8f8, 0xf8a4c0, 0xf0d0b0, 0xfce0a8,
    0xf8d878, 0xd8f878, 0xb8f8b8, 0xb8f8d8, 0x00fcfc, 0xf8d8f8, 0x000000, 0x000000,
];
/// Alias matching the TS name `NES_RGB`.
pub use self::PALETTE_RGB as NES_RGB;

/// Named colours (NES palette indices). Use these instead of raw hex everywhere.
pub mod c {
    pub const BLACK: u8 = 0x0f;
    pub const WHITE: u8 = 0x30;
    pub const OFFWHITE: u8 = 0x20;
    pub const CREAM: u8 = 0x37;
    pub const GRAY: u8 = 0x00;
    pub const LTGRAY: u8 = 0x10;
    pub const MDGRAY: u8 = 0x2d;
    // dark row
    pub const DKBLUE: u8 = 0x02;
    pub const BLUE0: u8 = 0x01;
    pub const VIOLET: u8 = 0x03;
    pub const PURPLE0: u8 = 0x04;
    pub const CRIMSON: u8 = 0x05;
    pub const MAROON: u8 = 0x06;
    pub const BROWNRED: u8 = 0x07;
    pub const BROWN: u8 = 0x08;
    pub const DKGREEN: u8 = 0x0a;
    pub const GREEN0: u8 = 0x09;
    pub const FOREST: u8 = 0x0b;
    pub const DKTEAL: u8 = 0x0c;
    // mid row
    pub const SKY: u8 = 0x11;
    pub const BLUE: u8 = 0x12;
    pub const INDIGO: u8 = 0x13;
    pub const MAGENTA: u8 = 0x14;
    pub const PINKRED: u8 = 0x15;
    pub const RED: u8 = 0x16;
    pub const ORANGE: u8 = 0x17;
    pub const OCHRE: u8 = 0x18;
    pub const GREEN: u8 = 0x1a;
    pub const LIME0: u8 = 0x19;
    pub const SEA: u8 = 0x1b;
    pub const TEAL: u8 = 0x1c;
    // light row
    pub const LTBLUE: u8 = 0x21;
    pub const PERI: u8 = 0x22;
    pub const LAVENDER: u8 = 0x23;
    pub const HOTPINK: u8 = 0x24;
    pub const PINK: u8 = 0x25;
    pub const SALMON: u8 = 0x26;
    pub const AMBER: u8 = 0x27;
    pub const YELLOW: u8 = 0x28;
    pub const LIME: u8 = 0x29;
    pub const LTGREEN: u8 = 0x2a;
    pub const MINT: u8 = 0x2b;
    pub const CYAN: u8 = 0x2c;
    // pale row
    pub const PALEBLUE: u8 = 0x31;
    pub const PALEPERI: u8 = 0x32;
    pub const PALEVIOLET: u8 = 0x33;
    pub const PALEPINK: u8 = 0x34;
    pub const BLUSH: u8 = 0x35;
    pub const PEACH: u8 = 0x36;
    pub const PALEYELLOW: u8 = 0x38;
    pub const PALELIME: u8 = 0x39;
    pub const PALEGREEN: u8 = 0x3a;
    pub const PALEMINT: u8 = 0x3b;
    pub const AQUA: u8 = 0x3c;
    pub const PALEMAGENTA: u8 = 0x3d;
}

/// RGB for a palette index (0xRRGGBB; indices wrap to 6 bits like the original).
pub fn rgb_of(index: u8) -> u32 {
    PALETTE_RGB[(index & 0x3f) as usize]
}

/// Build the 64-entry RGBA LUT (little-endian packed 0xAABBGGRR) used to convert the framebuffer.
/// Written to memory as bytes this is R,G,B,A.
pub fn build_rgba_lut() -> [u32; 64] {
    let mut lut = [0u32; 64];
    for i in 0..64 {
        let rgb = PALETTE_RGB[i];
        let r = (rgb >> 16) & 0xff;
        let g = (rgb >> 8) & 0xff;
        let b = rgb & 0xff;
        lut[i] = (0xffu32 << 24) | (b << 16) | (g << 8) | r;
    }
    lut
}

/// NES-style fade: step the colour down its luminance column (each step darkens
/// by one row, bottoming out at black). 0 steps = unchanged.
pub fn darken(index: u8, steps: i32) -> u8 {
    if steps <= 0 {
        return index;
    }
    let hue = index & 0x0f;
    let row = (index >> 4) as i32;
    if hue >= 0x0d {
        c::BLACK
    } else {
        let r = row - steps;
        let mut out = if r < 0 { c::BLACK } else { ((r as u8) << 4) | hue };
        // Row 0 grays/colours darker than the base row go to black.
        if r == 0 && hue == 0 {
            out = 0x00;
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn darken_steps_down_the_luminance_column_and_floors_at_black() {
        assert_eq!(darken(0x30, 1), 0x20);
        assert_eq!(darken(0x30, 3), 0x00);
        assert_eq!(darken(0x16, 1), 0x06);
        assert_eq!(darken(0x06, 1), c::BLACK);
        assert_eq!(darken(c::BLACK, 2), c::BLACK);
    }
}
