//! Shared small game types: popups, banners, bubbles. Port of `game/types.ts`.

pub use crate::engine::pad::Pad;

/// A floating score/text popup (cosmetic but deterministic state, so rules tests can see it).
#[derive(Clone, Debug, PartialEq)]
pub struct Popup {
    pub x: f64,
    pub y: f64,
    pub text: String,
    /// Frames left.
    pub t: i32,
    pub color: Option<u8>,
}

/// A timed banner message (center screen, or under the HUD).
#[derive(Clone, Debug, PartialEq)]
pub struct Banner {
    pub text: String,
    /// Extra lines (multi-line PA etc.).
    pub lines: Option<Vec<String>>,
    /// Frames left.
    pub t: i32,
    /// Total frames (for fade).
    pub total: i32,
    pub color: Option<u8>,
}

/// A speech bubble anchored over a world position.
#[derive(Clone, Debug, PartialEq)]
pub struct Bubble {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub t: i32,
}

pub fn tick_popups(popups: &mut Vec<Popup>) {
    let mut i = popups.len();
    while i > 0 {
        i -= 1;
        let p = &mut popups[i];
        p.t -= 1;
        if p.t % 3 == 0 {
            p.y -= 1.0;
        }
        if p.t <= 0 {
            popups.remove(i);
        }
    }
}

/// `makeBanner(text, frames = 120, lines?, color?)`; pass `120` for the default frame count.
pub fn make_banner(text: &str, frames: i32, lines: Option<Vec<String>>, color: Option<u8>) -> Banner {
    Banner { text: text.to_string(), lines, t: frames, total: frames, color }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn popups_rise_every_third_frame_and_expire() {
        let mut v = vec![Popup { x: 1.0, y: 10.0, text: "X".into(), t: 4, color: None }];
        tick_popups(&mut v); // t=3 -> rise
        assert_eq!(v[0].y, 9.0);
        tick_popups(&mut v); // t=2
        tick_popups(&mut v); // t=1
        assert_eq!(v[0].y, 9.0);
        tick_popups(&mut v); // t=0 -> removed
        assert!(v.is_empty());
        let b = make_banner("HI", 120, None, None);
        assert_eq!((b.t, b.total), (120, 120));
    }
}
