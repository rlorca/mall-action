//! The 16 px NES-style status strip drawn over every gameplay scene: score, package count, lives, the active
//! timed power-up with a draining bar, armour/radar icons, a blinking ALARM and, on the right, an
//! elevator-style LED floor panel that turns into a store-name marquee inside a store.
//!
//! Every section is drawn through its own clip rectangle (`SECTION_*`), so sections can never overlap by
//! construction; the tests check that the worst-case text fits each section.

use crate::art;
use crate::pixel::{pal, text_width, Fb, FontKind, Rect, HUD_H, W};
use crate::run::RunState;
use crate::types::{Floor, PowerUp};
use crate::ui;

pub const SECTION_SCORE: Rect = Rect::new(2, 0, 38, 15);
pub const SECTION_PKG: Rect = Rect::new(42, 0, 44, 15);
pub const SECTION_LIVES: Rect = Rect::new(88, 0, 28, 15);
pub const SECTION_POWER: Rect = Rect::new(118, 0, 44, 15);
pub const SECTION_ICONS: Rect = Rect::new(164, 0, 20, 15);
pub const SECTION_ALARM: Rect = Rect::new(186, 0, 30, 15);
pub const SECTION_PANEL: Rect = Rect::new(218, 1, 36, 14);

pub const SECTIONS: [Rect; 7] =
    [SECTION_SCORE, SECTION_PKG, SECTION_LIVES, SECTION_POWER, SECTION_ICONS, SECTION_ALARM, SECTION_PANEL];

/// Everything the strip shows, as plain data (so tests can build worst cases).
#[derive(Clone, Debug)]
pub struct HudData {
    pub score: u32,
    pub packages: u32,
    pub lives: u32,
    /// Short name and remaining fraction (0..=1) of the active timed power-up.
    pub timed: Option<(&'static str, f32)>,
    pub armor: bool,
    pub radar: bool,
    pub alarm: bool,
    pub floor: Floor,
    /// Inside a store: the marquee text (the store name).
    pub marquee: Option<&'static str>,
    pub tick: u32,
}

/// Short HUD form of a timed power-up name (must fit the 44 px power section in the tiny font).
pub fn short_name(p: PowerUp) -> &'static str {
    match p {
        PowerUp::RapidFire => "RAPID FIRE",
        PowerUp::SpreadShot => "SPREAD",
        PowerUp::Sneakers => "SNEAKERS",
        PowerUp::OrangeJuliOoze => "JULI-OOZE",
        PowerUp::Cinnabomb => "CINNABOMB",
        PowerUp::ArmorVest => "ARMOR",
        PowerUp::Radar => "RADAR",
        PowerUp::OneUp => "1-UP",
        PowerUp::SoftPretzel => "PRETZEL",
    }
}

impl HudData {
    pub fn from_run(run: &RunState, floor: Floor, marquee: Option<&'static str>, tick: u32) -> HudData {
        HudData {
            score: run.score,
            packages: run.packages_found(),
            lives: run.lives,
            timed: run.power.hud_timed().map(|t| (short_name(t.kind), t.left as f32 / t.total.max(1) as f32)),
            armor: run.power.armor,
            radar: run.power.radar,
            alarm: run.alarm,
            floor,
            marquee,
            tick,
        }
    }
}

pub fn score_text(score: u32) -> String {
    format!("{:06}", score.min(999_999))
}

pub fn pkg_text(n: u32) -> String {
    format!("PKG {}/6", n.min(6))
}

pub fn lives_text(n: u32) -> String {
    format!("x{}", n.min(99))
}

fn in_section(fb: &mut Fb, r: Rect, f: impl FnOnce(&mut Fb)) {
    let old = fb.set_clip(r);
    f(fb);
    fb.set_clip(old);
}

pub fn draw(fb: &mut Fb, d: &HudData) {
    // strip background: black with a steel bottom rule
    fb.rect(0, 0, W as i32, HUD_H, pal::BLACK);
    fb.hline(0, HUD_H - 1, W as i32, pal::CHARCOAL);

    in_section(fb, SECTION_SCORE, |fb| {
        fb.text(SECTION_SCORE.x, 4, &score_text(d.score), pal::WHITE);
    });
    in_section(fb, SECTION_PKG, |fb| {
        let all = d.packages >= 6;
        let c = if all { pal::LGREEN } else { pal::LRED };
        fb.text(SECTION_PKG.x, 4, &pkg_text(d.packages), c);
    });
    in_section(fb, SECTION_LIVES, |fb| {
        art::draw_frame(fb, "head_icon", 0, SECTION_LIVES.x, 4, false);
        fb.text(SECTION_LIVES.x + 10, 4, &lives_text(d.lives), pal::WHITE);
    });
    in_section(fb, SECTION_POWER, |fb| {
        if let Some((name, frac)) = d.timed {
            fb.text_tiny(SECTION_POWER.x, 2, name, pal::YELLOW);
            let w = SECTION_POWER.w - 2;
            let col = if frac < 0.25 && ui::blink(d.tick, 6, 6) { pal::RED } else { pal::LGREEN };
            ui::bar(fb, SECTION_POWER.x, 9, w, 4, frac, col, pal::CHARCOAL);
            fb.frame(SECTION_POWER.x - 1, 8, w + 2, 6, pal::GRAY);
        }
    });
    in_section(fb, SECTION_ICONS, |fb| {
        if d.armor {
            art::draw_frame(fb, "armor_icon", 0, SECTION_ICONS.x, 4, false);
        }
        if d.radar {
            art::draw_frame(fb, "radar_icon", 0, SECTION_ICONS.x + 10, 4, false);
        }
    });
    in_section(fb, SECTION_ALARM, |fb| {
        if d.alarm && ui::blink(d.tick, 20, 12) {
            fb.text(SECTION_ALARM.x, 4, "ALARM", pal::LRED);
        }
    });
    draw_panel(fb, d);
}

// ---- LED floor panel ---------------------------------------------------------------------------------------

const LED_ON: u8 = pal::ORANGE;
const LED_HOT: u8 = pal::LYELLOW;
const LED_OFF: u8 = pal::DBROWN;

/// 7-segment mask: a=top b=top-right c=bottom-right d=bottom e=bottom-left f=top-left g=middle.
fn segs(c: char) -> u8 {
    const A: u8 = 1;
    const B: u8 = 2;
    const C: u8 = 4;
    const D: u8 = 8;
    const E: u8 = 16;
    const F: u8 = 32;
    const G: u8 = 64;
    match c {
        '1' => B | C,
        '2' => A | B | G | E | D,
        '3' => A | B | G | C | D,
        '4' => F | G | B | C,
        'F' => A | F | G | E,
        'P' => A | B | F | G | E,
        'R' => A | B | F | G | E, // plus a painted leg below
        _ => 0,
    }
}

/// Draw one 5x9 LED glyph at (x, y); unlit segments show as a faint dot.
fn led_glyph(fb: &mut Fb, x: i32, y: i32, c: char) {
    let m = segs(c);
    let seg = |fb: &mut Fb, bit: u8, sx: i32, sy: i32, w: i32, h: i32| {
        if m & bit != 0 {
            fb.rect(x + sx, y + sy, w, h, LED_ON);
        } else {
            // unlit segment: a single dim dot at its centre keeps the 7-segment look without hurting legibility
            fb.put(x + sx + w / 2, y + sy + h / 2, LED_OFF);
        }
    };
    seg(fb, 1, 1, 0, 3, 1); // a
    seg(fb, 2, 4, 1, 1, 3); // b
    seg(fb, 4, 4, 5, 1, 3); // c
    seg(fb, 8, 1, 8, 3, 1); // d
    seg(fb, 16, 0, 5, 1, 3); // e
    seg(fb, 32, 0, 1, 1, 3); // f
    seg(fb, 64, 1, 4, 3, 1); // g
    if c == 'R' {
        // the leg: replace the plain "P" bottom-right
        fb.rect(x + 3, y + 5, 1, 1, LED_ON);
        fb.rect(x + 4, y + 6, 1, 3, LED_ON);
    }
}

pub fn floor_glyph_width(label: &str) -> i32 {
    label.chars().count() as i32 * 7 - 2
}

fn draw_panel(fb: &mut Fb, d: &HudData) {
    let r = SECTION_PANEL;
    // housing: steel frame, black glass
    fb.rect(r.x, r.y, r.w, r.h, pal::BLACK);
    fb.frame(r.x, r.y, r.w, r.h, pal::GRAY);
    fb.hline(r.x + 1, r.y, r.w - 2, pal::LGRAY);
    let inner = Rect::new(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    in_section(fb, inner, |fb| match d.marquee {
        Some(text) => {
            let tw = text_width(FontKind::Normal, text);
            let span = tw + inner.w;
            let off = ((d.tick / 2) as i32) % span.max(1);
            let x = inner.x + inner.w - off;
            fb.text(x, r.y + 4, text, LED_ON);
            // LED dot-matrix feel: darken every other row slightly
            for yy in (inner.y..inner.y + inner.h).step_by(2) {
                for xx in inner.x..inner.x + inner.w {
                    if fb.get(xx, yy) == LED_ON {
                        fb.put(xx, yy, LED_HOT);
                    }
                }
            }
        }
        None => {
            let label = d.floor.label();
            let w = floor_glyph_width(label);
            let mut x = inner.x + (inner.w - w) / 2;
            for ch in label.chars() {
                led_glyph(fb, x, r.y + 3, ch);
                x += 7;
            }
        }
    });
    // little up/down tell-tale lamps in the corners
    fb.put(r.x + 1, r.y + 1, if ui::blink(d.tick, 30, 30) { pal::RED } else { pal::DRED });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn worst() -> HudData {
        HudData {
            score: 999_999,
            packages: 6,
            lives: 9,
            timed: Some((short_name(PowerUp::OrangeJuliOoze), 0.5)),
            armor: true,
            radar: true,
            alarm: true,
            floor: Floor::F4,
            marquee: Some("BLOCKBLUSTER VIDEO"),
            tick: 0,
        }
    }

    #[test]
    fn sections_fit_the_strip_and_never_overlap() {
        for (i, a) in SECTIONS.iter().enumerate() {
            assert!(a.x >= 0 && a.right() <= W as i32 && a.y >= 0 && a.bottom() <= HUD_H, "{a:?}");
            for b in SECTIONS.iter().skip(i + 1) {
                assert!(!a.intersects(b), "{a:?} overlaps {b:?}");
            }
        }
    }

    #[test]
    fn worst_case_text_fits_its_section() {
        let d = worst();
        assert!(text_width(FontKind::Normal, &score_text(d.score)) <= SECTION_SCORE.w);
        assert!(text_width(FontKind::Normal, &pkg_text(6)) <= SECTION_PKG.w);
        assert!(10 + text_width(FontKind::Normal, &lives_text(99)) <= SECTION_LIVES.w);
        for p in PowerUp::ALL {
            assert!(text_width(FontKind::Tiny, short_name(p)) <= SECTION_POWER.w - 2, "{p:?}");
        }
        assert!(text_width(FontKind::Normal, "ALARM") <= SECTION_ALARM.w);
        assert!(10 + 8 <= SECTION_ICONS.w);
        for f in Floor::ALL {
            assert!(floor_glyph_width(f.label()) <= SECTION_PANEL.w - 4, "{f:?}");
        }
    }

    #[test]
    fn hud_paints_only_the_strip() {
        let mut fb = Fb::new();
        fb.clear(pal::MAGENTA);
        draw(&mut fb, &worst());
        for y in HUD_H..crate::pixel::H as i32 {
            for x in 0..W as i32 {
                assert_eq!(fb.get(x, y), pal::MAGENTA, "pixel {x},{y} was touched");
            }
        }
    }

    fn count(fb: &Fb, r: Rect, c: u8) -> usize {
        let mut n = 0;
        for y in r.y..r.bottom() {
            for x in r.x..r.right() {
                if fb.get(x, y) == c {
                    n += 1;
                }
            }
        }
        n
    }

    #[test]
    fn pkg_counter_turns_green_with_all_six() {
        let mut d = worst();
        d.packages = 5;
        let mut fb = Fb::new();
        draw(&mut fb, &d);
        assert!(count(&fb, SECTION_PKG, pal::LRED) > 0 && count(&fb, SECTION_PKG, pal::LGREEN) == 0);
        d.packages = 6;
        draw(&mut fb, &d);
        assert!(count(&fb, SECTION_PKG, pal::LGREEN) > 0 && count(&fb, SECTION_PKG, pal::LRED) == 0);
    }

    #[test]
    fn icons_and_alarm_only_when_active() {
        let mut d = worst();
        d.armor = false;
        d.radar = false;
        d.alarm = false;
        d.timed = None;
        let mut fb = Fb::new();
        draw(&mut fb, &d);
        assert_eq!(count(&fb, SECTION_ICONS, pal::BLACK), (SECTION_ICONS.w * SECTION_ICONS.h) as usize);
        assert_eq!(count(&fb, SECTION_POWER, pal::BLACK), (SECTION_POWER.w * SECTION_POWER.h) as usize);
        assert_eq!(count(&fb, SECTION_ALARM, pal::LRED), 0);
        d.armor = true;
        d.radar = true;
        d.alarm = true;
        d.timed = Some(("RAPID FIRE", 1.0));
        draw(&mut fb, &d);
        assert!(count(&fb, SECTION_ICONS, pal::BLACK) < (SECTION_ICONS.w * SECTION_ICONS.h) as usize);
        assert!(count(&fb, SECTION_ALARM, pal::LRED) > 0, "alarm visible at tick 0");
        assert!(count(&fb, SECTION_POWER, pal::LGREEN) > 0);
        d.tick = 25; // blink off phase
        draw(&mut fb, &d);
        assert_eq!(count(&fb, SECTION_ALARM, pal::LRED), 0, "alarm blinks");
    }

    #[test]
    fn power_bar_drains() {
        let mut d = worst();
        let mut fb = Fb::new();
        d.timed = Some(("SNEAKERS", 1.0));
        draw(&mut fb, &d);
        let full = count(&fb, SECTION_POWER, pal::LGREEN);
        d.timed = Some(("SNEAKERS", 0.4));
        draw(&mut fb, &d);
        let part = count(&fb, SECTION_POWER, pal::LGREEN);
        assert!(part < full && part > 0);
    }

    #[test]
    fn marquee_scrolls_and_stays_in_the_panel() {
        let mut a = worst();
        a.tick = 40;
        let mut b = worst();
        b.tick = 80;
        let (mut fa, mut fb2) = (Fb::new(), Fb::new());
        draw(&mut fa, &a);
        draw(&mut fb2, &b);
        let r = SECTION_PANEL;
        let mut diff = 0;
        for y in r.y..r.bottom() {
            for x in r.x..r.right() {
                if fa.get(x, y) != fb2.get(x, y) {
                    diff += 1;
                }
            }
        }
        assert!(diff > 0, "marquee moves");
        // nothing outside the panel changed
        for y in 0..HUD_H {
            for x in 0..r.x {
                assert_eq!(fa.get(x, y), fb2.get(x, y));
            }
        }
    }

    #[test]
    fn floor_panel_shows_each_floor_differently() {
        let mut seen = Vec::new();
        for f in Floor::ALL {
            let mut d = worst();
            d.marquee = None;
            d.floor = f;
            let mut fb = Fb::new();
            draw(&mut fb, &d);
            let snap: Vec<u8> = (SECTION_PANEL.y..SECTION_PANEL.bottom())
                .flat_map(|y| (SECTION_PANEL.x..SECTION_PANEL.right()).map(move |x| (x, y)))
                .map(|(x, y)| fb.get(x, y))
                .collect();
            assert!(!seen.contains(&snap), "{f:?} looks like another floor");
            seen.push(snap);
        }
    }

    #[test]
    fn from_run_reads_the_run_state() {
        let mut run = RunState::new(1, false);
        run.score = 1234;
        run.power.grant(PowerUp::Sneakers);
        run.power.grant(PowerUp::ArmorVest);
        let d = HudData::from_run(&run, Floor::F2, None, 0);
        assert_eq!((d.score, d.lives, d.armor, d.radar), (1234, 3, true, false));
        assert_eq!(d.timed.map(|t| t.0), Some("SNEAKERS"));
    }
}
