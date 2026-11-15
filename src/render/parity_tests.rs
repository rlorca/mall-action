//! Hash parity with the TS renderers: fixtures/render-screens.json (made by the tsx script
//! `render-screens-fixture.mts`) holds, for each representative state, the FNV-1a hash of the 61440 palette-index
//! bytes of the framebuffer (and a few raw numbers). Build the same states here and compare every entry.

use super::continue_view::{draw_continue, ContinueViewState};
use super::game_over_view::{draw_game_over, GameOverViewState};
use super::gallery::Gallery;
use super::level_clear_view::{draw_level_clear, spy_x, wagon_x, LevelClearViewState};
use super::map_view::{draw_map_view, inventory_lines, map_x, map_y};
use super::newspaper_view::draw_newspaper;
use super::osd::Osd;
use super::pause_view::draw_pause_overlay;
use super::screen_fx::{blit_scaled_by_name, center_text, center_text_at, draw_sprite_by_name, draw_sprite_by_name_sized, draw_two_tone, hash01, ScaledOpts, TwoToneOpts};
use super::spygram_view::{draw_spygram, spygram_likes, SpygramOpts};
use super::title_view::{draw_title, TitleViewState};
use super::widgets::*;
use crate::content::copy::{HEADLINES, SPYGRAM_ARRIVAL, SPYGRAM_COMPLETE};
use crate::content::layout::{floor_y, ShaftId};
use crate::content::stores::{StoreId, StoreRole, STORES};
use crate::engine::font::Align;
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::pad::{btn, Pad, NO_PAD};
use crate::engine::palette::c;
use crate::engine::rng::Rng;
use crate::game::levelstate::StoreStatus;
use crate::game::screens::r#continue::ContinueScreen;
use crate::game::screens::gameover::GameOverScreen;
use crate::game::screens::konami::KONAMI_CODE;
use crate::game::screens::levelclear::{LevelClearOpts, LevelClearScreen};
use crate::game::screens::mapdata::{MapCar, MapData, MapPlayer};
use crate::game::screens::screen::Screen;
use crate::game::screens::title::TitleScreen;
use crate::game::types::{Banner, Bubble, Popup};
use std::collections::BTreeMap;

const FIXTURE: &str = include_str!("../../fixtures/render-screens.json");

struct Fx {
    want: BTreeMap<String, f64>,
    checked: Vec<String>,
    bad: Vec<String>,
}

impl Fx {
    fn load() -> Fx {
        let mut want = BTreeMap::new();
        for line in FIXTURE.lines() {
            let line = line.trim().trim_end_matches(',');
            if !line.starts_with('"') {
                continue;
            }
            let end = line[1..].find('"').unwrap() + 1;
            let key = &line[1..end];
            let val: f64 = line[end + 2..].trim().parse().unwrap();
            want.insert(key.to_string(), val);
        }
        Fx { want, checked: Vec::new(), bad: Vec::new() }
    }
    fn num(&mut self, key: &str, got: f64) {
        self.checked.push(key.to_string());
        match self.want.get(key) {
            None => self.bad.push(format!("{}: not in fixture", key)),
            Some(&w) => {
                if w != got {
                    self.bad.push(format!("{}: want {} got {}", key, w, got));
                }
            }
        }
    }
    fn fb(&mut self, key: &str, fb: &Framebuffer) {
        self.num(key, fb.hash() as f64);
    }
}

fn fresh(bg: u8) -> Framebuffer {
    let mut fb = Framebuffer::new();
    fb.clear(bg);
    fb
}
fn press(mask: u32) -> Pad {
    Pad { held: mask, pressed: mask, released: 0 }
}

fn numbers(fx: &mut Fx) {
    for (a, b) in [(0, 0), (1, 1), (5, 3), (17, 2), (123, 456), (-7, 9), (1000, 12), (45, 5), (3, 50)] {
        fx.num(&format!("num.hash01.{}.{}", a, b), hash01(a, b));
    }
    for pf in [0, 10, 40, 41, 100, 200, 269] {
        fx.num(&format!("num.wagonX.{}", pf), wagon_x(pf));
    }
    for pf in [0, 29, 30, 31, 100, 150, 151, 165, 180, 181, 250] {
        fx.num(&format!("num.spyX.{}", pf), spy_x(pf));
    }
    for (f, s) in [(0, 5), (1, 5), (3, 5), (60, 5), (150, 5), (300, 5), (900, 5), (100, 9), (100, 1), (149, 77)] {
        fx.num(&format!("num.likes.{}.{}", f, s), spygram_likes(f, s) as f64);
    }
    for x in [0, 100, 250, 380, 767] {
        fx.num(&format!("num.mapX.{}", x), map_x(x as f64) as f64);
    }
    for y in [112, 136, 160, 232, 352] {
        fx.num(&format!("num.mapY.{}", y), map_y(y as f64) as f64);
    }
    let long = "EXPIRED COUPON, PRE-OWNED STRATEGY GUIDE, PET ROCK, MOOD RING, 1 SHARE (DOWN 99%), PHOTO STRIP, MORE, MORE, MORE, MORE";
    fx.num("num.inventoryLines.long", inventory_lines(long).join("|").chars().count() as f64);
}

fn widgets_and_fx(fx: &mut Fx) {
    let mut fb = fresh(c::DKBLUE);
    draw_bubble(&mut fb, "HELLO THERE", 100.0, 80.0);
    draw_bubble(&mut fb, "SHORT", 10.0, 20.0);
    draw_bubble(&mut fb, "A LONGER BUBBLE TEXT!", 250.0, 100.0);
    draw_bubble_at(&mut fb, "TOP", 60.0, 10.0, 4);
    draw_bubble(&mut fb, "ODD", 127.5, 60.5);
    fx.fb("widgets.bubbles", &fb);
    let mut fb = fresh(c::DKBLUE);
    let bubbles = vec![
        Bubble { text: "ONE".into(), x: 150.0, y: 100.0, t: 5 },
        Bubble { text: "GONE".into(), x: 50.0, y: 50.0, t: 0 },
        Bubble { text: "TWO".into(), x: 220.5, y: 120.5, t: 1 },
    ];
    draw_bubbles(&mut fb, &bubbles, 20.5, 10.25);
    fx.fb("widgets.bubbles_list", &fb);

    let ban = |text: &str, lines: Option<Vec<&str>>, t: i32, total: i32, color: Option<u8>| Banner {
        text: text.to_string(),
        lines: lines.map(|v| v.into_iter().map(|s| s.to_string()).collect()),
        t,
        total,
        color,
    };
    let banners: Vec<(&str, Banner, Option<i32>)> = vec![
        ("in2", ban("ALARM! SECURITY ALERTED", Some(vec!["LINE TWO", "THE THIRD LINE"]), 118, 120, Some(c::RED)), None),
        ("in1", ban("FLOOR 3F", None, 115, 120, None), None),
        ("mid", ban("FLOOR 3F", None, 100, 120, Some(c::CYAN)), None),
        ("out1", ban("FLOOR 3F", None, 10, 120, Some(c::CYAN)), Some(100)),
        ("out2", ban("FLOOR 3F", None, 3, 120, None), None),
        ("dead", ban("GONE", None, 0, 120, None), None),
    ];
    for (n, b, y) in &banners {
        let mut fb = fresh(c::DKBLUE);
        match y {
            None => draw_banner(&mut fb, b),
            Some(y) => draw_banner_at(&mut fb, b, *y),
        }
        fx.fb(&format!("widgets.banner.{}", n), &fb);
    }
    let mut fb = fresh(c::DKBLUE);
    let popups = vec![
        Popup { x: 100.0, y: 60.0, text: "+100".into(), t: 10, color: None },
        Popup { x: 150.5, y: 80.5, text: "1UP".into(), t: 5, color: Some(c::CYAN) },
    ];
    draw_popups(&mut fb, &popups, 10.5, 4.0);
    fx.fb("widgets.popups", &fb);
    let mut fb = fresh(c::DKBLUE);
    draw_bar(&mut fb, 10, 10, 100, 6, 0.37, c::GREEN);
    draw_bar(&mut fb, 10, 20, 100, 6, 0.0, c::GREEN);
    draw_bar_bg(&mut fb, 10, 30, 100, 6, 1.5, c::RED, c::MAROON);
    draw_bar(&mut fb, 10, 40, 100, 6, -1.0, c::RED);
    draw_box(&mut fb, 10, 60, 30, 20, c::WHITE, None);
    draw_box(&mut fb, 50, 60, 30, 20, c::WHITE, Some(c::RED));
    fx.fb("widgets.bars_boxes", &fb);

    let mut fb = fresh(c::DKBLUE);
    draw_two_tone(&mut fb, "MALL", 128, 12, &TwoToneOpts { scale: 6, top: c::YELLOW, bottom: c::ORANGE, split: 4, outline: Some(c::BLACK), shadow: Some(c::BLACK), align: Align::Center, ..Default::default() });
    draw_two_tone(&mut fb, "ACTION", 10, 60, &TwoToneOpts { scale: 3, top: c::CYAN, bottom: c::BLUE, ..Default::default() });
    draw_two_tone(&mut fb, "RIGHT", 250, 100, &TwoToneOpts { scale: 2, top: c::WHITE, bottom: c::RED, split: 3, shadow: Some(c::BLACK), align: Align::Right, ..Default::default() });
    fx.fb("fx.twotone", &fb);
    let mut fb = fresh(c::DKBLUE);
    draw_sprite_by_name(&mut fb, "agent.ride", 20, 20, &BlitOpts::default());
    draw_sprite_by_name(&mut fb, "no.such.sprite", 60, 20, &BlitOpts::default());
    draw_sprite_by_name_sized(&mut fb, "no.such.sprite", 90, 20, &BlitOpts::default(), 30, 10);
    blit_scaled_by_name(&mut fb, "agent.selfie", 100, 100, 3, &ScaledOpts { frame: 1, ..Default::default() });
    blit_scaled_by_name(&mut fb, "agent.selfie", 160, 100, 2, &ScaledOpts { flip_x: true, solid: Some(c::YELLOW), ..Default::default() });
    blit_scaled_by_name(&mut fb, "nope", 160, 100, 2, &ScaledOpts::default());
    center_text(&mut fb, "CENTRED", 200, c::WHITE, &Default::default());
    center_text_at(&mut fb, "CENTRED2", 210, c::WHITE, &crate::engine::font::TextOpts::default().scale(2), 100);
    fx.fb("fx.sprites_text", &fb);
}

fn title(fx: &mut Fx) {
    let draw = |t: &TitleScreen| {
        let mut fb = Framebuffer::new();
        draw_title(&mut fb, &TitleViewState::from(t));
        fb
    };
    let mut t = TitleScreen::new(4200);
    let mut n = 0;
    for s in [0, 1, 5, 16, 60, 119, 500, 2300] {
        while n < s {
            t.step(&NO_PAD);
            n += 1;
        }
        fx.fb(&format!("title.{}", s), &draw(&t));
    }
    for hi in [0, 999999] {
        let mut u = TitleScreen::new(hi);
        for _ in 0..30 {
            u.step(&NO_PAD);
        }
        fx.fb(&format!("title.hi{}.30", hi), &draw(&u));
    }
    let mut bf = TitleScreen::new(4200);
    for b in KONAMI_CODE {
        bf.step(&press(b));
        bf.step(&NO_PAD);
    }
    fx.num("title.bf_flag", if bf.black_friday() { 1.0 } else { 0.0 });
    let mut n = 0;
    for s in [0, 7, 13, 40, 200] {
        while n < s {
            bf.step(&NO_PAD);
            n += 1;
        }
        fx.fb(&format!("title.bf.{}", s), &draw(&bf));
    }
}

fn continue_screen(fx: &mut Fx) {
    let draw = |s: &ContinueScreen| {
        let mut fb = Framebuffer::new();
        draw_continue(&mut fb, &ContinueViewState::from(s));
        fb
    };
    let mut cs = ContinueScreen::new(2);
    let mut n = 0;
    for s in [0, 4, 10, 59, 60, 125, 300, 360, 370, 419, 480, 539, 560, 600] {
        while n < s {
            cs.step(&NO_PAD);
            n += 1;
        }
        fx.fb(&format!("continue.{}", s), &draw(&cs));
    }
    let mut d = ContinueScreen::new(0);
    for _ in 0..100 {
        d.step(&NO_PAD);
    }
    fx.fb("continue.left0.100", &draw(&d));
}

fn game_over(fx: &mut Fx) {
    let mut run = |score: i32, hi: i32, snaps: &[i32], tag: &str| {
        let mut g = GameOverScreen::new(score, hi);
        let mut n = 0;
        for &s in snaps {
            while n < s {
                g.step(&NO_PAD);
                n += 1;
            }
            let mut fb = Framebuffer::new();
            draw_game_over(&mut fb, &GameOverViewState::from(&g));
            fx.fb(&format!("gameover.{}.{}", tag, s), &fb);
        }
    };
    run(500, 900, &[0, 40, 70, 100, 125, 150, 200, 250, 284, 290, 320, 500], "a");
    run(900, 900, &[290, 305, 320], "rec");
    run(0, 0, &[300], "zero");
    run(1234567, 100, &[300], "big");
}

fn level_clear(fx: &mut Fx) {
    let mk = |seed: u32| {
        let rng = Rng::new(seed);
        LevelClearScreen::new(LevelClearOpts { rng: &rng, packages: 6, time_bonus: 900, clear_bonus: 1000, loop_n: 1, score: 100, score_includes_bonus: false })
    };
    let draw = |s: &LevelClearScreen| {
        let mut fb = Framebuffer::new();
        draw_level_clear(&mut fb, &LevelClearViewState::from(s));
        fb
    };
    let mut s = mk(2);
    let mut n = 0;
    for f in [0, 1, 12, 18, 30, 40, 60, 100, 150, 176, 200, 217, 240, 253, 262, 269] {
        while n < f {
            s.step(&NO_PAD);
            n += 1;
        }
        fx.fb(&format!("levelclear.drive.{}", f), &draw(&s));
    }
    s.step(&NO_PAD);
    fx.num("levelclear.phase_after_drive", s.phase() as i32 as f64);
    let mut pf = 0;
    fx.fb("levelclear.tally.0", &draw(&s));
    for f in [10, 24, 40, 60, 90, 120, 170, 220, 300] {
        while pf < f {
            s.step(&NO_PAD);
            pf += 1;
        }
        fx.fb(&format!("levelclear.tally.{}", f), &draw(&s));
    }
    s.step(&press(btn::START));
    fx.num("levelclear.phase_after_start1", s.phase() as i32 as f64);
    fx.fb("levelclear.news.0", &draw(&s));
    pf = 0;
    for f in [2, 10, 22, 100, 300] {
        while pf < f {
            s.step(&NO_PAD);
            pf += 1;
        }
        fx.fb(&format!("levelclear.news.{}", f), &draw(&s));
    }
    s.step(&press(btn::START));
    fx.num("levelclear.phase_after_start2", s.phase() as i32 as f64);
    fx.fb("levelclear.spygram.0", &draw(&s));
    pf = 0;
    for f in [3, 8, 16, 60, 150, 300] {
        while pf < f {
            s.step(&NO_PAD);
            pf += 1;
        }
        fx.fb(&format!("levelclear.spygram.{}", f), &draw(&s));
    }
    for seed in [5u32, 9, 31] {
        let mut u = mk(seed);
        u.step(&press(btn::START));
        u.step(&press(btn::START));
        for _ in 0..100 {
            u.step(&NO_PAD);
        }
        fx.fb(&format!("levelclear.seed{}.news100", seed), &draw(&u));
        u.step(&press(btn::START));
        for _ in 0..100 {
            u.step(&NO_PAD);
        }
        fx.fb(&format!("levelclear.seed{}.spygram100", seed), &draw(&u));
    }
    let rng = Rng::new(3);
    let mut v = LevelClearScreen::new(LevelClearOpts { rng: &rng, packages: 0, time_bonus: 0, clear_bonus: 1000, loop_n: 12, score: 999000, score_includes_bonus: true });
    v.step(&press(btn::START));
    for _ in 0..400 {
        v.step(&NO_PAD);
    }
    fx.fb("levelclear.tally.big", &draw(&v));
}

fn news_and_spygram(fx: &mut Fx) {
    for (i, h) in HEADLINES.iter().enumerate() {
        for f in [5, 100] {
            let mut fb = Framebuffer::new();
            draw_newspaper(&mut fb, h, f);
            fx.fb(&format!("news.h{}.{}", i, f), &fb);
        }
    }
    for f in [0, 2, 11, 21, 22] {
        let mut fb = Framebuffer::new();
        draw_newspaper(&mut fb, HEADLINES[0], f);
        fx.fb(&format!("news.slide.{}", f), &fb);
    }
    let posts: Vec<_> = SPYGRAM_ARRIVAL.iter().chain(SPYGRAM_COMPLETE.iter()).collect();
    for (i, p) in posts.iter().enumerate() {
        let mut fb = fresh(0x3d);
        draw_spygram(&mut fb, p, 1234, 40, &SpygramOpts::default());
        fx.fb(&format!("spygram.post{}", i), &fb);
    }
    for (i, (x, y)) in [(0, 0), (10, 20), (72, 50), (-40, 20), (200, 200), (30, -30)].into_iter().enumerate() {
        let mut fb = fresh(0x3d);
        draw_spygram(&mut fb, &SPYGRAM_ARRIVAL[0], 100, 3, &SpygramOpts { x: Some(x), y: Some(y), photo: None });
        fx.fb(&format!("spygram.pos{}", i), &fb);
    }
    for f in [0, 3, 5, 29, 30, 89, 90] {
        let mut fb = fresh(0x3d);
        draw_spygram(&mut fb, &SPYGRAM_ARRIVAL[1], 987654, f, &SpygramOpts::default());
        fx.fb(&format!("spygram.frame{}", f), &fb);
    }
    let mut fb = fresh(0x3d);
    draw_spygram(
        &mut fb,
        &SPYGRAM_ARRIVAL[1],
        10,
        5,
        &SpygramOpts { x: Some(20), y: Some(10), photo: Some(|f, x, y, w, h, _| f.fill_rect(x - 50, y - 50, w + 100, h + 100, c::LIME)) },
    );
    fx.fb("spygram.customphoto", &fb);
}

fn map(fx: &mut Fx) {
    let mut statuses = [StoreStatus::Package; 13];
    for s in STORES.iter() {
        statuses[s.id as usize] = match s.role {
            StoreRole::Closed => StoreStatus::Closed,
            StoreRole::Powerup => StoreStatus::Powerup,
            StoreRole::Target => StoreStatus::Package,
        };
    }
    statuses[StoreId::Forever12 as usize] = StoreStatus::Cleared;
    statuses[StoreId::Hotspy as usize] = StoreStatus::Cleared;
    let base = MapData {
        frame: 0,
        cars: vec![MapCar { shaft: ShaftId::A, y: floor_y(1.0) }, MapCar { shaft: ShaftId::B, y: floor_y(3.0) }, MapCar { shaft: ShaftId::C, y: floor_y(4.0) }],
        player: MapPlayer { x: 380.0, y: floor_y(2.0), in_store: None },
        statuses,
        radar: false,
        inventory: "NONE YET".to_string(),
        black_friday: false,
    };
    let long = "EXPIRED COUPON, PRE-OWNED STRATEGY GUIDE, PET ROCK, MOOD RING, 1 SHARE (DOWN 99%), PHOTO STRIP, MORE, MORE, MORE, MORE";
    let player = |x: f64, y: f64, s: Option<StoreId>| MapPlayer { x, y, in_store: s };
    let cases: Vec<(&str, MapData)> = vec![
        ("f0", base.clone()),
        ("f14", MapData { frame: 14, ..base.clone() }),
        ("f30", MapData { frame: 30, ..base.clone() }),
        ("radar", MapData { frame: 14, radar: true, ..base.clone() }),
        ("radar_f5", MapData { frame: 5, radar: true, ..base.clone() }),
        ("bf", MapData { black_friday: true, frame: 3, ..base.clone() }),
        ("bf_off", MapData { black_friday: true, frame: 20, ..base.clone() }),
        ("instore0", MapData { frame: 0, player: player(0.0, 0.0, Some(StoreId::Hotspy)), ..base.clone() }),
        ("instore14", MapData { frame: 14, player: player(0.0, 0.0, Some(StoreId::Hotspy)), ..base.clone() }),
        ("instore_radar", MapData { frame: 2, radar: true, player: player(0.0, 0.0, Some(StoreId::Radioshock)), ..base.clone() }),
        ("cars_a", MapData { cars: vec![MapCar { shaft: ShaftId::B, y: floor_y(2.0) }], ..base.clone() }),
        ("cars_b", MapData { cars: vec![MapCar { shaft: ShaftId::B, y: floor_y(2.0) + 24.0 }], ..base.clone() }),
        ("cars_bottom", MapData { cars: vec![MapCar { shaft: ShaftId::A, y: floor_y(5.0) }, MapCar { shaft: ShaftId::C, y: floor_y(0.0) - 20.0 }], ..base.clone() }),
        ("player_edges", MapData { player: player(-50.0, floor_y(0.0), None), ..base.clone() }),
        ("player_right", MapData { player: player(900.0, floor_y(5.0) + 30.0, None), ..base.clone() }),
        ("player_mid", MapData { player: player(300.5, floor_y(3.0) - 17.3, None), ..base.clone() }),
        ("inv_long", MapData { inventory: long.to_string(), ..base.clone() }),
        ("inv_two", MapData { inventory: "PET ROCK, MOOD RING, EXPIRED COUPON, PHOTO STRIP, ONE MORE".to_string(), ..base.clone() }),
    ];
    for (n, d) in &cases {
        let mut fb = Framebuffer::new();
        draw_map_view(&mut fb, d);
        fx.fb(&format!("map.{}", n), &fb);
    }
    let mut mixed = [StoreStatus::Package; 13];
    for (i, s) in STORES.iter().enumerate() {
        mixed[s.id as usize] = [StoreStatus::Package, StoreStatus::Cleared, StoreStatus::Powerup, StoreStatus::Closed][i % 4];
    }
    let mut fb = Framebuffer::new();
    draw_map_view(&mut fb, &MapData { frame: 14, statuses: mixed, radar: true, ..base.clone() });
    fx.fb("map.mixed", &fb);
}

fn pause_osd_gallery(fx: &mut Fx) {
    let mk_base = || {
        let mut fb = Framebuffer::new();
        let mut t = TitleScreen::new(4200);
        for _ in 0..60 {
            t.step(&NO_PAD);
        }
        draw_title(&mut fb, &TitleViewState::from(&t));
        fb
    };
    for f in [0, 39, 40, 50, 59, 60, 61, 130] {
        let mut fb = mk_base();
        draw_pause_overlay(&mut fb, f);
        fx.fb(&format!("pause.title.{}", f), &fb);
    }
    let mut w = fresh(c::WHITE);
    draw_pause_overlay(&mut w, 0);
    fx.fb("pause.white.0", &w);
    for (name, text, frames) in [("crt", "CRT ON", 100), ("sound", "SOUND OFF", 100), ("pad", "GAMEPAD ON", 100), ("short", "CRT OFF", 3)] {
        let mut o = Osd::new();
        o.show(text, frames);
        let mut fb = fresh(c::DKBLUE);
        o.draw(&mut fb);
        fx.fb(&format!("osd.{}.0", name), &fb);
        for _ in 0..50 {
            o.tick();
        }
        let mut fb = fresh(c::DKBLUE);
        o.draw(&mut fb);
        fx.fb(&format!("osd.{}.50", name), &fb);
        for _ in 0..60 {
            o.tick();
        }
        let mut fb = fresh(c::DKBLUE);
        o.draw(&mut fb);
        fx.fb(&format!("osd.{}.110", name), &fb);
        fx.num(&format!("osd.{}.active", name), if o.active() { 1.0 } else { 0.0 });
    }

    let mut g = Gallery::new();
    fx.num("gallery.pages", g.pages.len() as f64);
    fx.num("gallery.placed", g.pages.iter().map(|p| p.len()).sum::<usize>() as f64);
    let names: Vec<&str> = g.pages.iter().flatten().map(|p| p.s.name.as_str()).collect();
    let joined = names.join("\n");
    let mut h: u32 = 0x811c9dc5;
    for b in joined.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(0x01000193);
    }
    fx.num("gallery.order_fnv", h as f64);
    let mut fb = Framebuffer::new();
    g.draw(&mut fb);
    fx.fb("gallery.p0.f0", &fb);
    for p in 1..g.pages.len() {
        g.step(&press(btn::RIGHT));
        let mut fb = Framebuffer::new();
        g.draw(&mut fb);
        fx.fb(&format!("gallery.p{}.f{}", p, p), &fb);
    }
    g.step(&press(btn::RIGHT));
    fx.num("gallery.wrap_page", g.page as f64);
    g.step(&press(btn::LEFT));
    fx.num("gallery.left_page", g.page as f64);
    for _ in 0..40 {
        g.step(&NO_PAD);
    }
    let mut fb = Framebuffer::new();
    g.draw(&mut fb);
    fx.fb("gallery.last.f40ish", &fb);
}

#[test]
fn render_screens_hash_parity_with_ts() {
    crate::art::registry::init();
    let mut fx = Fx::load();
    numbers(&mut fx);
    widgets_and_fx(&mut fx);
    title(&mut fx);
    continue_screen(&mut fx);
    game_over(&mut fx);
    level_clear(&mut fx);
    news_and_spygram(&mut fx);
    map(&mut fx);
    pause_osd_gallery(&mut fx);
    let unchecked: Vec<&String> = fx.want.keys().filter(|k| !fx.checked.contains(k)).collect();
    assert!(fx.bad.is_empty(), "{} of {} mismatches:\n{}", fx.bad.len(), fx.checked.len(), fx.bad.join("\n"));
    assert!(unchecked.is_empty(), "fixture entries never checked: {:?}", unchecked);
}
