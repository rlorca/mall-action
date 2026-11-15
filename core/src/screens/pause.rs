//! PAUSE overlay: the frozen gameplay frame dimmed with a dither and a blinking "PAUSE" plate.

use crate::pixel::{pal, Fb, HUD_H, H, W};
use crate::ui;

/// Dim everything below the HUD strip (50% black checkerboard) and paint the blinking PAUSE plate.
pub fn draw_over(fb: &mut Fb, tick: u32) {
    fb.dither_rect(0, HUD_H, W as i32, H as i32 - HUD_H, pal::BLACK, 0);
    let (bw, bh) = (92, 30);
    let (bx, by) = ((W as i32 - bw) / 2, 104);
    fb.rect(bx, by, bw, bh, pal::BLACK);
    fb.frame(bx, by, bw, bh, pal::WHITE);
    fb.frame(bx + 2, by + 2, bw - 4, bh - 4, pal::MBLUE);
    if ui::blink(tick, 40, 20) {
        let w = Fb::text_scaled_width("PAUSE", 2);
        fb.text_scaled((W as i32 - w) / 2, by + 5, "PAUSE", pal::LYELLOW, 2);
    }
    fb.text_center_tiny(W as i32 / 2, by + bh - 9, "START TO RESUME", pal::LAVENDER);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dims_the_scene_but_not_the_hud_and_blinks() {
        let mut a = Fb::new();
        a.clear(pal::WHITE);
        draw_over(&mut a, 0);
        assert_eq!(a.get(0, 0), pal::WHITE, "HUD strip untouched");
        let black = (0..W as i32).filter(|x| a.get(*x, 30) == pal::BLACK).count();
        assert!(black > 100 && black < W - 100, "dithered, not solid: {black}");
        let mut b = Fb::new();
        b.clear(pal::WHITE);
        draw_over(&mut b, 50);
        assert_ne!(a.px, b.px, "PAUSE text blinks");
    }
}
