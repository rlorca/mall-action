//! Title screen (screens agent 1 owns this file): night sky, two-tone logo, scrolling storefronts, Konami
//! secret (Black Friday mode).

use crate::art::storefront::{draw_storefront, FrontState};
use crate::copy::{BLACK_FRIDAY_1, BLACK_FRIDAY_2};
use crate::events::{Out, Sfx, Track};
use crate::input::{Konami, PadState, START};
use crate::pixel::{pal, text_width, Fb, FontKind, Rect, H, W};
use crate::rng::Rng;
use crate::types::StoreId;
use crate::ui::blink;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TitleOutcome {
    None,
    /// Start pressed. `black_friday` is true if the Konami code was entered.
    Start { black_friday: bool },
}

/// Frames of flashing after START before the outcome is returned (0.6 s).
pub const START_FLASH_FRAMES: u32 = 36;
/// Floor line the storefronts stand on.
const FLOOR_Y: i32 = 204;
/// Horizontal pitch of one storefront in the scrolling row (80 px front + gap).
const STORE_PITCH: i32 = 88;
const SUBTITLE: &str = "A SHOPPING MALL ESPIONAGE";
const COPYRIGHT: &str = "(C) 2026 FLICKERSOFT";
const CONTROLS: &str = "ARROWS MOVE  Z SHOOT  X JUMP/SEARCH  ENTER PAUSE";

/// "HI-SCORE nnnnnn" (6 digits, capped at 999999).
pub fn hi_score_text(high: u32) -> String {
    format!("HI-SCORE {:06}", high.min(999_999))
}

pub struct Title {
    high: u32,
    tick: u32,
    konami: Konami,
    black_friday: bool,
    /// Frames since the Konami code was completed.
    bf_tick: u32,
    /// Frames since START was pressed (None = not pressed).
    start_tick: Option<u32>,
    stars: Vec<Star>,
}

#[derive(Clone, Copy)]
struct Star {
    x: i32,
    y: i32,
    phase: u32,
    period: u32,
    big: bool,
}

impl Title {
    pub fn new(high_score: u32) -> Title {
        let mut rng = Rng::new(0x7171_E5);
        let stars = (0..46)
            .map(|i| Star {
                x: rng.range(2, W as i32 - 3),
                y: rng.range(18, 150),
                phase: rng.below(64),
                period: 24 + rng.below(40),
                big: i % 9 == 0,
            })
            .collect();
        Title { high: high_score, tick: 0, konami: Konami::new(), black_friday: false, bf_tick: 0, start_tick: None, stars }
    }

    pub fn step(&mut self, pad: PadState, out: &mut Out) -> TitleOutcome {
        if self.tick == 0 {
            out.music(Track::Title);
        }
        self.tick += 1;
        if let Some(t) = self.start_tick.as_mut() {
            *t += 1;
            if *t >= START_FLASH_FRAMES {
                return TitleOutcome::Start { black_friday: self.black_friday };
            }
            return TitleOutcome::None;
        }
        if self.black_friday {
            self.bf_tick += 1;
        }
        if self.konami.feed(pad.pressed) && !self.black_friday {
            self.black_friday = true;
            self.bf_tick = 0;
            out.sfx(Sfx::ExtraLife);
        }
        if pad.just_pressed(START) {
            self.start_tick = Some(0);
            out.sfx(Sfx::MenuBlip);
            out.sfx(Sfx::Coins);
        }
        TitleOutcome::None
    }

    /// True once the Konami code has been entered.
    pub fn black_friday(&self) -> bool {
        self.black_friday
    }

    /// True once START was pressed (the flash is playing).
    pub fn starting(&self) -> bool {
        self.start_tick.is_some()
    }

    pub fn draw(&self, fb: &mut Fb) {
        let t = self.tick;
        draw_sky(fb, t, &self.stars, self.black_friday);
        // the logo drops in during the first half second, then sits still (with a shine sweep)
        let drop = {
            let p = t.min(30) as i32;
            let q = 30 - p;
            -(q * q) / 12 // 0 at p=30, -75 at p=0
        };
        draw_logo(fb, drop, t);

        fb.text_center(W as i32 / 2 + 1, 113, SUBTITLE, pal::DPURPLE);
        fb.text_center(W as i32 / 2, 112, SUBTITLE, pal::LCYAN);

        if self.black_friday {
            let f = (self.bf_tick / 5) % 2 == 0;
            let (a, b) = if f { (pal::YELLOW, pal::RED) } else { (pal::WHITE, pal::DRED) };
            let w = text_scaled_w(BLACK_FRIDAY_1, 2);
            let x = (W as i32 - w) / 2;
            fb.text_scaled(x + 2, 126 + 2, BLACK_FRIDAY_1, b, 2);
            fb.text_scaled(x, 126, BLACK_FRIDAY_1, a, 2);
            fb.text_center(W as i32 / 2 + 1, 145, BLACK_FRIDAY_2, pal::BLACK);
            fb.text_center(W as i32 / 2, 144, BLACK_FRIDAY_2, if f { pal::WHITE } else { pal::YELLOW });
        } else {
            let hi = hi_score_text(self.high);
            fb.text_center(W as i32 / 2 + 1, 129, &hi, pal::BLACK);
            fb.text_center(W as i32 / 2, 128, &hi, pal::YELLOW);
        }

        // PRESS START blinks (fast once pressed)
        let (on, off) = if self.start_tick.is_some() { (2, 2) } else { (30, 20) };
        let ty = if self.black_friday { 158 } else { 146 };
        let show = blink(self.start_tick.unwrap_or(t), on, off);
        if show {
            let col = if self.start_tick.is_some() { pal::YELLOW } else { pal::WHITE };
            fb.text_center(W as i32 / 2 + 1, ty + 1, "PRESS START", pal::BLACK);
            fb.text_center(W as i32 / 2, ty, "PRESS START", col);
        }

        // storefront row on the mall floor
        draw_floor_row(fb, t, self.black_friday);

        // fine print
        fb.rect(0, 216, W as i32, H as i32 - 216, pal::BLACK);
        fb.text_center(W as i32 / 2, 219, COPYRIGHT, pal::LGRAY);
        fb.text_center_tiny(W as i32 / 2, 231, CONTROLS, pal::GRAY);

        // START: bright flash that fades out
        if let Some(s) = self.start_tick {
            if s < 6 {
                fb.dither_rect(0, 0, W as i32, H as i32, pal::WHITE, (s & 1) as i32);
            } else if s < 12 {
                fb.dither_rect(0, 0, W as i32, H as i32, pal::LAVENDER, (s & 1) as i32);
                fb.map_rect(0, 0, W as i32, 0, |p| p);
            }
        }
    }
}

fn text_scaled_w(s: &str, scale: i32) -> i32 {
    Fb::text_scaled_width(s, scale)
}

fn draw_sky(fb: &mut Fb, t: u32, stars: &[Star], bf: bool) {
    let bands: [(i32, u8); 8] = [
        (0, pal::NAVY),
        (26, pal::DBLUE),
        (52, pal::DPURPLE),
        (78, pal::PURPLE),
        (104, pal::PLUM),
        (128, pal::MAGENTA),
        (152, pal::PINK),
        (176, pal::ORANGE),
    ];
    let bands: Vec<(i32, u8)> = if bf {
        // Black Friday: the sky goes blood red
        let b: [(i32, u8); 8] = [
            (0, pal::BLACK),
            (26, pal::MAROON),
            (52, pal::DRED),
            (78, pal::RED),
            (104, pal::LRED),
            (128, pal::PINK),
            (152, pal::ORANGE),
            (176, pal::YELLOW),
        ];
        b.to_vec()
    } else {
        bands.to_vec()
    };
    for (i, &(y0, c)) in bands.iter().enumerate() {
        let y1 = bands.get(i + 1).map(|b| b.0).unwrap_or(FLOOR_Y + 12);
        fb.rect(0, y0, W as i32, y1 - y0, c);
        // dithered transition into the next band (NES banding with a 2-row ordered dither)
        if let Some(&(_, next)) = bands.get(i + 1) {
            fb.dither_rect(0, y1 - 4, W as i32, 2, next, 0);
            fb.dither_rect(0, y1 - 2, W as i32, 2, next, 1);
            fb.rect(0, y1 - 2, W as i32, 0, next);
        }
    }
    // twinkling stars
    for s in stars {
        let step = (t / 6 + s.phase) % s.period;
        let lit = match step {
            0..=1 => 0u8, // blink out
            2..=5 => 1,   // dim
            _ => 2,
        };
        let c = match lit {
            0 => continue,
            1 => pal::LAVENDER,
            _ => pal::WHITE,
        };
        fb.put(s.x, s.y, c);
        if s.big && lit == 2 {
            fb.put(s.x - 1, s.y, pal::LAVENDER);
            fb.put(s.x + 1, s.y, pal::LAVENDER);
            fb.put(s.x, s.y - 1, pal::LAVENDER);
            fb.put(s.x, s.y + 1, pal::LAVENDER);
        }
    }
}

/// Two-tone chunky text: black outline, drop shadow, a top-half colour, a bottom-half colour and a white
/// glint on the first font row. `scale` is the font pixel size.
pub fn fancy_text(fb: &mut Fb, x: i32, y: i32, s: &str, scale: i32, top: u8, bottom: u8, outline: u8, shadow: u8) {
    let o = (scale / 3).max(1);
    // drop shadow
    fb.text_scaled(x + o + 1, y + o + 2, s, shadow, scale);
    for dy in -o..=o {
        for dx in -o..=o {
            if dx != 0 || dy != 0 {
                fb.text_scaled(x + dx, y + dy, s, outline, scale);
            }
        }
    }
    let old = fb.clip();
    fb.set_clip(intersect(old, Rect::new(0, y, W as i32, scale * 4)));
    fb.text_scaled(x, y, s, top, scale);
    fb.set_clip(intersect(old, Rect::new(0, y + scale * 4, W as i32, scale * 4)));
    fb.text_scaled(x, y, s, bottom, scale);
    fb.set_clip(intersect(old, Rect::new(0, y, W as i32, scale)));
    fb.text_scaled(x, y, s, pal::WHITE, scale);
    fb.set_clip(old);
}

fn intersect(a: Rect, b: Rect) -> Rect {
    let x0 = a.x.max(b.x);
    let y0 = a.y.max(b.y);
    let x1 = a.right().min(b.right());
    let y1 = a.bottom().min(b.bottom());
    Rect::new(x0, y0, (x1 - x0).max(0), (y1 - y0).max(0))
}

fn draw_logo(fb: &mut Fb, drop: i32, t: u32) {
    let cx = W as i32 / 2;
    let (s1, s2) = (6, 5);
    let w1 = Fb::text_scaled_width("MALL", s1);
    let w2 = Fb::text_scaled_width("ACTION", s2);
    let (x1, y1) = (cx - w1 / 2, 16 + drop);
    let (x2, y2) = (cx - w2 / 2, 66 + drop);
    fancy_text(fb, x1, y1, "MALL", s1, pal::LYELLOW, pal::ORANGE, pal::BLACK, pal::DPURPLE);
    fancy_text(fb, x2, y2, "ACTION", s2, pal::LCYAN, pal::BLUE, pal::BLACK, pal::DPURPLE);
    // shine sweep every ~3 seconds
    let cycle = t % 200;
    if cycle < 40 {
        let sx = -20 + cycle as i32 * 7;
        let old = fb.clip();
        for (x, y, s, txt) in [(x1, y1, s1, "MALL"), (x2, y2, s2, "ACTION")] {
            // slanted strip: shift the clip per font row
            for row in 0..7 {
                let off = (6 - row) * 2;
                fb.set_clip(intersect(old, Rect::new(sx + off, y + row * s, 8, s)));
                fb.text_scaled(x, y, txt, pal::WHITE, s);
            }
        }
        fb.set_clip(old);
    }
    // a little underline "tag" between the two lines of logo and subtitle
    let ty = 108 + drop.max(0);
    fb.rect(cx - 60, ty, 120, 1, pal::LMAGENTA);
}

fn draw_floor_row(fb: &mut Fb, t: u32, bf: bool) {
    // mall floor under the shops
    fb.rect(0, FLOOR_Y, W as i32, 12, pal::GRAY);
    fb.rect(0, FLOOR_Y, W as i32, 1, pal::WHITE);
    fb.rect(0, FLOOR_Y + 1, W as i32, 1, pal::LGRAY);
    for tx in (0..W as i32).step_by(16) {
        // tile seams scroll with the shops
        let off = ((t * 2 / 3) % 16) as i32;
        fb.rect(tx - off, FLOOR_Y + 2, 1, 10, pal::DGRAY);
        fb.dither_rect(tx - off + 8, FLOOR_Y + 2, 8, 10, pal::LGRAY, 0);
    }
    fb.rect(0, FLOOR_Y + 10, W as i32, 2, pal::DGRAY);
    // shops, scrolling left at 2/3 px per frame, wrapping seamlessly
    let total = STORE_PITCH * StoreId::ALL.len() as i32;
    let off = (t as i32 * 2 / 3) % total;
    let st = FrontState { cleared: false, tick: t, black_friday: bf };
    for (i, id) in StoreId::ALL.iter().enumerate() {
        let mut x = i as i32 * STORE_PITCH - off;
        if x < -STORE_PITCH {
            x += total;
        }
        if x < W as i32 {
            draw_storefront(fb, *id, x, FLOOR_Y, &st);
        }
    }
    let _ = text_width(FontKind::Normal, "");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::input::{A, B, DOWN, LEFT, RIGHT, UP};

    fn press(t: &mut Title, mask: u8) -> TitleOutcome {
        let mut out = Out::new();
        let r = t.step(PadState::from_held(0, mask), &mut out);
        // release for the next press
        t.step(PadState::from_held(mask, 0), &mut out);
        r
    }

    fn feed(t: &mut Title, seq: &[u8]) {
        for &b in seq {
            press(t, b);
        }
    }

    const KONAMI: [u8; 10] = [UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A];

    #[test]
    fn plays_title_music_on_the_first_step_only() {
        let mut t = Title::new(0);
        let mut out = Out::new();
        t.step(PadState::default(), &mut out);
        t.step(PadState::default(), &mut out);
        let n = out.events.iter().filter(|e| **e == crate::events::Event::Music(Track::Title)).count();
        assert_eq!(n, 1);
    }

    #[test]
    fn konami_enables_black_friday() {
        let mut t = Title::new(0);
        assert!(!t.black_friday());
        feed(&mut t, &KONAMI);
        assert!(t.black_friday());
    }

    #[test]
    fn konami_with_extra_leading_ups_works() {
        let mut t = Title::new(0);
        feed(&mut t, &[UP, UP, UP, UP]);
        assert!(!t.black_friday());
        feed(&mut t, &KONAMI);
        assert!(t.black_friday());
    }

    #[test]
    fn wrong_sequences_do_nothing() {
        let mut t = Title::new(0);
        let mut wrong = KONAMI;
        wrong.swap(8, 9); // A B instead of B A
        feed(&mut t, &wrong);
        assert!(!t.black_friday());
        feed(&mut t, &[UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B]);
        assert!(!t.black_friday());
        feed(&mut t, &[LEFT, UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT]);
        assert!(!t.black_friday());
    }

    #[test]
    fn konami_plays_a_sfx_once() {
        let mut t = Title::new(0);
        let mut out = Out::new();
        for &b in KONAMI.iter() {
            t.step(PadState::from_held(0, b), &mut out);
            t.step(PadState::from_held(b, 0), &mut out);
        }
        assert_eq!(out.count_sfx(Sfx::ExtraLife), 1);
    }

    #[test]
    fn start_returns_the_outcome_after_a_short_flash() {
        let mut t = Title::new(0);
        let mut out = Out::new();
        assert_eq!(t.step(PadState::default(), &mut out), TitleOutcome::None);
        assert_eq!(t.step(PadState::from_held(0, START), &mut out), TitleOutcome::None);
        assert!(t.starting());
        let mut n = 0;
        loop {
            n += 1;
            match t.step(PadState::default(), &mut out) {
                TitleOutcome::None => assert!(n < 100),
                o => {
                    assert_eq!(o, TitleOutcome::Start { black_friday: false });
                    break;
                }
            }
        }
        assert_eq!(n, START_FLASH_FRAMES);
    }

    #[test]
    fn start_after_konami_is_black_friday() {
        let mut t = Title::new(0);
        feed(&mut t, &KONAMI);
        let mut out = Out::new();
        t.step(PadState::from_held(0, START), &mut out);
        let mut res = TitleOutcome::None;
        for _ in 0..100 {
            let r = t.step(PadState::default(), &mut out);
            if r != TitleOutcome::None {
                res = r;
                break;
            }
        }
        assert_eq!(res, TitleOutcome::Start { black_friday: true });
    }

    #[test]
    fn holding_start_does_not_restart_or_double_fire() {
        let mut t = Title::new(0);
        let mut out = Out::new();
        // held from the first frame: not a press
        assert_eq!(t.step(PadState::from_held(START, START), &mut out), TitleOutcome::None);
        assert!(!t.starting());
    }

    #[test]
    fn high_score_is_six_digits() {
        assert_eq!(hi_score_text(0), "HI-SCORE 000000");
        assert_eq!(hi_score_text(12345), "HI-SCORE 012345");
        assert_eq!(hi_score_text(5_000_000), "HI-SCORE 999999");
    }

    #[test]
    fn draws_deterministically_and_stays_on_screen() {
        let mut a = Title::new(500);
        let mut b = Title::new(500);
        let mut out = Out::new();
        for _ in 0..77 {
            a.step(PadState::default(), &mut out);
            b.step(PadState::default(), &mut out);
        }
        let (mut fa, mut fb2) = (Fb::new(), Fb::new());
        a.draw(&mut fa);
        b.draw(&mut fb2);
        assert_eq!(fa.px, fb2.px);
        assert!(fa.px.iter().filter(|p| **p != pal::BLACK).count() > 30_000);
    }

    #[test]
    fn press_start_blinks() {
        let mut t = Title::new(0);
        let mut out = Out::new();
        let count = |t: &Title| {
            let mut fb = Fb::new();
            t.draw(&mut fb);
            // PRESS START is white text near y=146
            let mut n = 0;
            for y in 146..153 {
                for x in 90..170 {
                    n += (fb.get(x, y) == pal::WHITE) as i32;
                }
            }
            n
        };
        for _ in 0..20 {
            t.step(PadState::default(), &mut out);
        }
        let on = count(&t);
        for _ in 0..20 {
            t.step(PadState::default(), &mut out);
        }
        let off = count(&t);
        assert!(on > 40 && off < on / 4, "{on} {off}");
    }

    #[test]
    fn black_friday_text_shows() {
        let mut t = Title::new(0);
        feed(&mut t, &KONAMI);
        let mut fb = Fb::new();
        t.draw(&mut fb);
        let mut plain = Title::new(0);
        let mut out = Out::new();
        plain.step(PadState::default(), &mut out);
        let mut fb2 = Fb::new();
        plain.draw(&mut fb2);
        assert_ne!(fb.px, fb2.px);
    }
}
