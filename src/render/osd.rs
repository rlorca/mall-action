use crate::content::copy::UI;
use crate::engine::font::{draw_text, text_width, TextOpts};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::palette::c;

/// Small on-screen confirmations ("CRT ON", "SOUND OFF" ...): a box in the top-right corner for ~1.5 s.
#[derive(Clone, Debug, Default)]
pub struct Osd {
    text: String,
    t: i32,
}

/// Wasm-side message codes -> text: 1=CRT ON, 2=CRT OFF, 3=SOUND ON, 4=SOUND OFF, 5=GAMEPAD ON, 6=GAMEPAD OFF
/// (anything else: empty).
pub fn osd_text(kind: u32) -> &'static str {
    match kind {
        1 => UI.crt_on,
        2 => UI.crt_off,
        3 => UI.sound_on,
        4 => UI.sound_off,
        5 => "GAMEPAD ON", // literal in TS main.ts (not in copy.rs UI)
        6 => "GAMEPAD OFF",
        _ => "",
    }
}

impl Osd {
    pub fn new() -> Osd {
        Osd::default()
    }

    /// `frames` is 100 in the TS default.
    pub fn show(&mut self, text: &str, frames: i32) {
        self.text = text.to_string();
        self.t = frames;
    }

    /// Advance one rendered frame (OSD timing is presentation only, not game time).
    pub fn tick(&mut self) {
        if self.t > 0 {
            self.t -= 1;
        }
    }

    pub fn active(&self) -> bool {
        self.t > 0
    }

    pub fn current(&self) -> &str {
        if self.t > 0 {
            &self.text
        } else {
            ""
        }
    }

    pub fn draw(&self, fb: &mut Framebuffer) {
        if self.t <= 0 {
            return;
        }
        let o = TextOpts::default();
        let w = text_width(&self.text, &o) + 10;
        let x = 256 - w - 5;
        let y = 22;
        fb.fill_rect(x, y, w, 13, c::BLACK);
        fb.stroke_rect(x, y, w, 13, c::WHITE);
        draw_text(fb, &self.text, x + 5, y + 3, c::WHITE, &o);
    }
}
