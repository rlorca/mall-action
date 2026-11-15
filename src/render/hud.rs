use super::screen_fx::{blink_on, draw_sprite_by_name_sized, pad6, W};
use crate::content::copy::UI;
use crate::content::layout::{FLOOR_NAMES, NUM_FLOORS};
use crate::content::stores::PACKAGES_TOTAL;
use crate::engine::font::{draw_text, text_width, TextOpts, FONT_TINY};
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::game::hud::HudData;

/// The 16 px status strip. Two text rows plus the LED floor panel on the right:
///
///   row A (y 1..9)   SCORE | PKG n/6 | head xN | armour | radar | ALARM          | LED PANEL
///   row B (y 10..14) POWER-UP NAME  [draining bar]                               | (R 4F 3F 2F 1F P)
///
/// `hud_layout` returns the rectangle of every element that is present, so the test can prove that nothing
/// overlaps and nothing leaves y 0..15, even in the worst case (everything on at once).
pub const HUD_H: i32 = 16;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum HudId {
    Score,
    Pkg,
    Lives,
    Armor,
    Radar,
    Alarm,
    TimedName,
    TimedBar,
    Panel,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct HudRect {
    pub id: HudId,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

const MAX_NAME: usize = 16;
const PANEL: HudRect = HudRect { id: HudId::Panel, x: 189, y: 2, w: 65, h: 12 };
const CELL_W: i32 = 9;

fn tiny() -> TextOpts {
    TextOpts::default().font(&FONT_TINY)
}

fn pkg_text(hud: &HudData) -> String {
    format!("PKG {}/{}", hud.packages.min(PACKAGES_TOTAL).max(0), PACKAGES_TOTAL)
}
fn lives_text(hud: &HudData) -> String {
    format!("x{}", hud.lives.min(99).max(0))
}
fn name_text(hud: &HudData) -> String {
    match &hud.timed {
        Some(t) => t.name.to_uppercase().chars().take(MAX_NAME).collect(),
        None => String::new(),
    }
}

pub fn hud_layout(hud: &HudData) -> Vec<HudRect> {
    let d = TextOpts::default();
    let mut out: Vec<HudRect> = Vec::new();
    out.push(HudRect { id: HudId::Score, x: 2, y: 2, w: text_width("000000", &d), h: 7 });
    out.push(HudRect { id: HudId::Pkg, x: 42, y: 2, w: text_width(&pkg_text(hud), &d), h: 7 });
    out.push(HudRect { id: HudId::Lives, x: 88, y: 1, w: 10 + text_width(&lives_text(hud), &d), h: 8 });
    if hud.armor {
        out.push(HudRect { id: HudId::Armor, x: 120, y: 1, w: 8, h: 8 });
    }
    if hud.radar {
        out.push(HudRect { id: HudId::Radar, x: 130, y: 1, w: 8, h: 8 });
    }
    if hud.alarm {
        out.push(HudRect { id: HudId::Alarm, x: 142, y: 1, w: text_width(UI.alarm_hud, &d) + 4, h: 9 });
    }
    if hud.timed.is_some() {
        let nw = text_width(&name_text(hud), &tiny());
        out.push(HudRect { id: HudId::TimedName, x: 2, y: 10, w: nw, h: 5 });
        out.push(HudRect { id: HudId::TimedBar, x: 2 + nw + 4, y: 10, w: 44, h: 4 });
    }
    out.push(PANEL);
    out
}

fn rect_of(rects: &[HudRect], id: HudId) -> Option<HudRect> {
    rects.iter().find(|r| r.id == id).copied()
}

fn bar_color(frac: f64, frame: i32) -> u8 {
    if frac > 0.5 {
        return c::GREEN;
    }
    if frac > 0.25 {
        return c::YELLOW;
    }
    if blink_on(frame, 12, 8) {
        c::RED
    } else {
        c::SALMON
    }
}

fn draw_panel(fb: &mut Framebuffer, hud: &HudData) {
    let HudRect { x, y, w, h, .. } = PANEL;
    fb.fill_rect(x, y, w, h, c::BLACK);
    fb.stroke_rect(x, y, w, h, c::MDGRAY);
    if let Some(floor) = hud.floor {
        let cells_w = NUM_FLOORS * CELL_W + (NUM_FLOORS - 1);
        let x0 = x + (w - cells_w).div_euclid(2);
        for i in 0..NUM_FLOORS {
            let cx = x0 + i * (CELL_W + 1);
            let name = FLOOR_NAMES[i as usize];
            let lit = i == floor;
            if lit {
                fb.fill_rect(cx, y + 2, CELL_W, h - 4, c::RED);
            }
            let tw = text_width(name, &tiny());
            draw_text(fb, name, cx + (CELL_W - tw).div_euclid(2), y + 4, if lit { c::PALEYELLOW } else { c::BROWNRED }, &tiny());
        }
        return;
    }
    if let Some(marquee) = &hud.marquee {
        // Store name scrolling right-to-left like an LED marquee.
        let text = marquee.to_uppercase();
        let tw = text_width(&text, &TextOpts::default());
        let gap = 28;
        let period = tw + gap;
        let off = hud.frame.div_euclid(2) % period;
        fb.push_clip(x + 1, y + 1, w - 2, h - 2);
        for k in -1..=1 {
            draw_text(fb, &text, x + w - 1 - off + k * period, y + 2, c::ORANGE, &TextOpts::default());
        }
        fb.pop_clip();
    }
}

/// Draw one or all HUD elements (the optional filter exists so tests can check each element's bounds).
pub fn draw_hud_elements(fb: &mut Framebuffer, hud: &HudData, only: Option<HudId>) {
    let rects = hud_layout(hud);
    let want = |id: HudId| -> Option<HudRect> {
        let r = rect_of(&rects, id);
        match (r, only) {
            (Some(r), None) => Some(r),
            (Some(r), Some(o)) if o == id => Some(r),
            _ => None,
        }
    };
    let d = TextOpts::default();
    let b = BlitOpts::default();

    if let Some(score) = want(HudId::Score) {
        draw_text(fb, &pad6(hud.score), score.x, score.y, c::WHITE, &d);
    }

    if let Some(pkg) = want(HudId::Pkg) {
        draw_text(fb, &pkg_text(hud), pkg.x, pkg.y, if hud.packages >= PACKAGES_TOTAL { c::GREEN } else { c::RED }, &d);
    }

    if let Some(lives) = want(HudId::Lives) {
        draw_sprite_by_name_sized(fb, "hud.head", lives.x, lives.y, &b, 8, 8);
        draw_text(fb, &lives_text(hud), lives.x + 10, lives.y + 1, c::WHITE, &d);
    }

    if let Some(armor) = want(HudId::Armor) {
        draw_sprite_by_name_sized(fb, "hud.armor", armor.x, armor.y, &b, 8, 8);
    }
    if let Some(radar) = want(HudId::Radar) {
        draw_sprite_by_name_sized(fb, "hud.radar", radar.x, radar.y, &b, 8, 8);
    }

    if let Some(alarm) = want(HudId::Alarm) {
        if blink_on(hud.frame, 16, 10) {
            fb.fill_rect(alarm.x, alarm.y, alarm.w, alarm.h, c::RED);
            draw_text(fb, UI.alarm_hud, alarm.x + 2, alarm.y + 1, c::WHITE, &d);
        }
    }

    if let (Some(tn), Some(_)) = (want(HudId::TimedName), &hud.timed) {
        draw_text(fb, &name_text(hud), tn.x, tn.y, c::WHITE, &tiny());
    }
    if let (Some(tb), Some(timed)) = (want(HudId::TimedBar), &hud.timed) {
        let frac = timed.frac.min(1.0).max(0.0);
        fb.fill_rect(tb.x, tb.y, tb.w, tb.h, c::MDGRAY);
        fb.fill_rect(tb.x + 1, tb.y + 1, tb.w - 2, tb.h - 2, c::BLACK);
        let n = round_i((tb.w - 2) as f64 * frac);
        if n > 0 {
            fb.fill_rect(tb.x + 1, tb.y + 1, n, tb.h - 2, bar_color(frac, hud.frame));
        }
    }

    if want(HudId::Panel).is_some() {
        draw_panel(fb, hud);
    }
}

/// Draw the whole HUD strip into rows 0..15. Nothing below y = 16 is touched.
pub fn draw_hud(fb: &mut Framebuffer, hud: &HudData) {
    fb.fill_rect(0, 0, W, HUD_H, c::BLACK);
    fb.h_line(0, HUD_H - 1, W, c::DKBLUE);
    draw_hud_elements(fb, hud, None);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::stores::STORES;
    use crate::game::hud::HudTimed;

    const SENTINEL: u8 = 0x3d;

    fn hud(f: impl FnOnce(&mut HudData)) -> HudData {
        let mut h = HudData {
            score: 12340,
            packages: 3,
            lives: 3,
            timed: None,
            armor: false,
            radar: false,
            alarm: false,
            floor: Some(0),
            marquee: None,
            frame: 0,
        };
        f(&mut h);
        h
    }

    fn worst() -> HudData {
        hud(|h| {
            h.score = 999999;
            h.packages = 6;
            h.lives = 99;
            h.timed = Some(HudTimed { name: "ORANGE JULI-OOZE", frac: 0.2 });
            h.armor = true;
            h.radar = true;
            h.alarm = true;
            h.floor = Some(5);
        })
    }

    fn overlap(a: &HudRect, b: &HudRect) -> bool {
        a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    }

    fn stray_below(fb: &Framebuffer) -> i32 {
        let mut n = 0;
        for y in HUD_H..fb.h {
            for x in 0..fb.w {
                if fb.get_pixel(x, y) != SENTINEL {
                    n += 1;
                }
            }
        }
        n
    }

    fn unpainted_in_strip(fb: &Framebuffer) -> i32 {
        let mut n = 0;
        for y in 0..HUD_H {
            for x in 0..fb.w {
                if fb.get_pixel(x, y) == SENTINEL {
                    n += 1;
                }
            }
        }
        n
    }

    fn fresh() -> Framebuffer {
        let mut fb = Framebuffer::new();
        fb.clear(SENTINEL);
        fb
    }

    fn with_frame(h: &HudData, frame: i32) -> HudData {
        let mut o = *h;
        o.frame = frame;
        o
    }

    fn states() -> Vec<(&'static str, HudData)> {
        vec![
            ("plain", hud(|_| {})),
            ("worst case (everything on, floor panel)", worst()),
            ("worst case inside a store (marquee)", {
                let mut h = worst();
                h.floor = None;
                h.marquee = Some("BLOCKBLUSTER VIDEO");
                h
            }),
            ("no floor and no marquee", hud(|h| h.floor = None)),
            ("long power-up name", hud(|h| h.timed = Some(HudTimed { name: "AN EXTREMELY LONG POWER UP NAME", frac: 1.0 }))),
            ("zero everything", hud(|h| {
                h.score = 0;
                h.packages = 0;
                h.lives = 0;
            })),
            ("out of range values", hud(|h| {
                h.score = 12345678;
                h.packages = 9;
                h.lives = 250;
                h.timed = Some(HudTimed { name: "RAPID FIRE", frac: 7.0 });
            })),
        ]
    }

    #[test]
    fn hud_layout_every_element_is_inside_the_256x16_strip_and_no_two_overlap() {
        for (name, h) in states() {
            let rects = hud_layout(&h);
            for r in &rects {
                assert!(r.x >= 0, "{}: {:?}.x", name, r.id);
                assert!(r.y >= 0, "{}: {:?}.y", name, r.id);
                assert!(r.x + r.w <= 256, "{}: {:?} right edge", name, r.id);
                assert!(r.y + r.h <= HUD_H, "{}: {:?} bottom edge", name, r.id);
            }
            for i in 0..rects.len() {
                for j in i + 1..rects.len() {
                    assert!(!overlap(&rects[i], &rects[j]), "{}: {:?} vs {:?}", name, rects[i].id, rects[j].id);
                }
            }
        }
    }

    #[test]
    fn hud_layout_draws_only_inside_y_0_15_and_paints_the_whole_strip() {
        for (name, h) in states() {
            for frame in [0, 5, 11, 40, 77, 123] {
                let mut fb = fresh();
                draw_hud(&mut fb, &with_frame(&h, frame));
                assert_eq!(stray_below(&fb), 0, "{}: frame {}: pixels drawn below the strip", name, frame);
                assert_eq!(unpainted_in_strip(&fb), 0, "{}: frame {}: unpainted pixels in the strip", name, frame);
            }
        }
    }

    #[test]
    fn hud_layout_each_element_draws_only_inside_its_own_rectangle() {
        for (name, h) in states() {
            for frame in [0, 9, 20, 61] {
                let hf = with_frame(&h, frame);
                for r in hud_layout(&hf) {
                    let mut fb = fresh();
                    draw_hud_elements(&mut fb, &hf, Some(r.id));
                    let mut outside = 0;
                    for y in 0..fb.h {
                        for x in 0..fb.w {
                            if fb.get_pixel(x, y) == SENTINEL {
                                continue;
                            }
                            if !(x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
                                outside += 1;
                            }
                        }
                    }
                    assert_eq!(outside, 0, "{}: {:?} drew pixels outside its rect (frame {})", name, r.id, frame);
                }
            }
        }
    }

    #[test]
    fn the_store_marquee_fits_the_panel_for_every_store_name_and_scrolls() {
        for s in STORES.iter() {
            let mut a = fresh();
            let mut b = fresh();
            draw_hud(&mut a, &hud(|h| {
                h.floor = None;
                h.marquee = Some(s.name);
                h.frame = 0;
            }));
            draw_hud(&mut b, &hud(|h| {
                h.floor = None;
                h.marquee = Some(s.name);
                h.frame = 30;
            }));
            for fb in [&a, &b] {
                assert_eq!(stray_below(fb), 0);
            }
            assert_ne!(a.hash(), b.hash(), "{}", s.name);
        }
    }

    #[test]
    fn pkg_is_red_until_all_six_are_found_then_green() {
        let probe = |packages: i32| -> Vec<u8> {
            let mut fb = fresh();
            let h = hud(|h| h.packages = packages);
            draw_hud(&mut fb, &h);
            let r = hud_layout(&h).into_iter().find(|x| x.id == HudId::Pkg).unwrap();
            let mut cols = Vec::new();
            for y in r.y..r.y + r.h {
                for x in r.x..r.x + r.w {
                    cols.push(fb.get_pixel(x, y));
                }
            }
            cols
        };
        assert!(probe(5).contains(&c::RED));
        assert!(!probe(5).contains(&c::GREEN));
        assert!(probe(6).contains(&c::GREEN));
        assert!(!probe(6).contains(&c::RED));
    }

    #[test]
    fn alarm_blinks() {
        let mut shown = [false, false];
        let r = hud_layout(&hud(|h| h.alarm = true)).into_iter().find(|x| x.id == HudId::Alarm).unwrap();
        for frame in 0..32 {
            let mut fb = fresh();
            draw_hud(&mut fb, &hud(|h| {
                h.alarm = true;
                h.frame = frame;
            }));
            shown[(fb.get_pixel(r.x + 1, r.y + 1) == c::RED) as usize] = true;
        }
        assert!(shown[1]);
        assert!(shown[0]);
        // and it is absent when not alarmed
        assert!(!hud_layout(&hud(|h| h.alarm = false)).iter().any(|x| x.id == HudId::Alarm));
    }

    #[test]
    fn the_led_floor_panel_lights_exactly_the_current_floor() {
        let lit = |floor: i32| -> Vec<i32> {
            let mut fb = fresh();
            draw_hud(&mut fb, &hud(|h| h.floor = Some(floor)));
            // sample the top-left pixel of each cell: lit cells are filled red
            let mut out = Vec::new();
            let panel = hud_layout(&hud(|_| {})).into_iter().find(|x| x.id == HudId::Panel).unwrap();
            let cells_w = FLOOR_NAMES.len() as i32 * 9 + (FLOOR_NAMES.len() as i32 - 1);
            let x0 = panel.x + (panel.w - cells_w).div_euclid(2);
            for i in 0..FLOOR_NAMES.len() as i32 {
                if fb.get_pixel(x0 + i * 10, panel.y + 2) == c::RED {
                    out.push(i);
                }
            }
            out
        };
        for f in 0..6 {
            assert_eq!(lit(f), vec![f]);
        }
    }

    #[test]
    fn timed_power_up_bar_drains() {
        let filled = |frac: f64| -> i32 {
            let mut fb = fresh();
            let h = hud(|h| h.timed = Some(HudTimed { name: "RAPID FIRE", frac }));
            draw_hud(&mut fb, &h);
            let bar = hud_layout(&h).into_iter().find(|x| x.id == HudId::TimedBar).unwrap();
            let mut n = 0;
            for x in bar.x + 1..bar.x + bar.w - 1 {
                if [c::GREEN, c::YELLOW, c::RED, c::SALMON].contains(&fb.get_pixel(x, bar.y + 1)) {
                    n += 1;
                }
            }
            n
        };
        assert!(filled(1.0) > filled(0.5));
        assert!(filled(0.5) > filled(0.1));
        assert_eq!(filled(0.0), 0);
    }

    #[test]
    fn is_deterministic_for_the_same_input() {
        let mut a = fresh();
        let mut b = fresh();
        draw_hud(&mut a, &worst());
        draw_hud(&mut b, &worst());
        assert_eq!(a.hash(), b.hash());
    }
}
