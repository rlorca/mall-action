//! Ports of src/render/screens.test.ts (the TS tests are the spec).

use super::continue_view::{draw_continue, ContinueViewState};
use super::game_over_view::{draw_game_over, GameOverViewState};
use super::level_clear_view::{draw_level_clear, spy_x, wagon_x, LevelClearViewState};
use super::map_view::{draw_map_view, inventory_lines, map_x, map_y, store_boxes, STORE_BOX_W};
use super::newspaper_view::{draw_newspaper, headline_lines, NEWS_HEADLINE_CHARS};
use super::pause_view::draw_pause_overlay;
use super::spygram_view::{draw_spygram, spygram_likes, SpygramOpts, SPYGRAM_CARD_H, SPYGRAM_CARD_W};
use super::title_view::{draw_title, TitleViewState};
use crate::content::copy::{HEADLINES, LIMITS, SPYGRAM_ARRIVAL, SPYGRAM_COMPLETE};
use crate::content::layout::{floor_y, ShaftId, ESCALATORS, SHAFTS};
use crate::content::stores::{StoreId, StoreRole, STORES};
use crate::engine::font::{text_width, TextOpts};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::pad::{btn, Pad, NO_PAD};
use crate::engine::palette::c;
use crate::engine::rng::Rng;
use crate::game::levelstate::StoreStatus;
use crate::game::screens::r#continue::ContinueScreen;
use crate::game::screens::gameover::{GameOverScreen, GO_GAMEOVER_AT};
use crate::game::screens::konami::KONAMI_CODE;
use crate::game::screens::levelclear::{LevelClearOpts, LevelClearScreen};
use crate::game::screens::mapdata::{MapCar, MapData, MapPlayer};
use crate::game::screens::screen::Screen;
use crate::game::screens::title::{TitleScreen, TITLE_SCROLL_FRAMES, TITLE_STRIP_PERIOD};
use std::collections::HashSet;

fn press(mask: u32) -> Pad {
    Pad { held: mask, pressed: mask, released: 0 }
}
const SENT: u8 = 0x3d;
fn sentinel() -> Framebuffer {
    let mut fb = Framebuffer::new();
    fb.clear(SENT);
    fb
}
fn changed(fb: &Framebuffer) -> i32 {
    fb.count_not(SENT)
}
fn init() {
    crate::art::registry::init();
}

mod pause_overlay {
    use super::*;

    #[test]
    fn dims_everything_and_blinks_pause() {
        init();
        let mut base = Framebuffer::new();
        base.clear(c::WHITE);
        let mut on = Framebuffer::new();
        on.copy_from(&base);
        draw_pause_overlay(&mut on, 0);
        assert_ne!(on.get_pixel(1, 1), c::WHITE); // dimmed
        let mut off = Framebuffer::new();
        off.copy_from(&base);
        draw_pause_overlay(&mut off, 50);
        assert_eq!(off.get_pixel(1, 1), on.get_pixel(1, 1));
        assert_ne!(on.hash(), off.hash()); // PAUSE visible in one phase, hidden in the other
        let mut shown = HashSet::new();
        for f in 0..60 {
            let mut fb = Framebuffer::new();
            fb.copy_from(&base);
            draw_pause_overlay(&mut fb, f);
            shown.insert(fb.hash());
        }
        assert_eq!(shown.len(), 2);
    }
}

mod spygram {
    use super::*;

    #[test]
    fn likes_start_at_0_never_decrease_climb_quickly_and_depend_on_the_seed() {
        assert_eq!(spygram_likes(0, 5), 0);
        let mut prev = -1;
        for f in 0..900 {
            let v = spygram_likes(f, 5);
            assert!(v >= prev);
            prev = v;
        }
        assert!(spygram_likes(60, 5) > 100);
        assert!(spygram_likes(150, 5) > 290);
        let seeds: HashSet<i32> = [1, 2, 3, 4, 5, 6, 7, 8].iter().map(|&s| spygram_likes(300, s)).collect();
        assert!(seeds.len() > 3);
        assert_eq!(spygram_likes(100, 9), spygram_likes(100, 9));
    }

    #[test]
    fn draws_every_post_inside_its_card_plus_shadow_at_the_default_position() {
        init();
        for post in SPYGRAM_ARRIVAL.iter().chain(SPYGRAM_COMPLETE.iter()) {
            let mut fb = sentinel();
            draw_spygram(&mut fb, post, 1234, 40, &SpygramOpts::default());
            let x0 = (256 - SPYGRAM_CARD_W) / 2;
            let y0 = (240 - SPYGRAM_CARD_H) / 2;
            let mut outside = 0;
            for y in 0..240 {
                for x in 0..256 {
                    if fb.get_pixel(x, y) == SENT {
                        continue;
                    }
                    if x < x0 || x >= x0 + SPYGRAM_CARD_W + 3 || y < y0 || y >= y0 + SPYGRAM_CARD_H + 3 {
                        outside += 1;
                    }
                }
            }
            assert_eq!(outside, 0, "{}", post.caption.join("/"));
        }
    }

    #[test]
    fn works_standalone_at_any_position_including_partly_off_screen_and_has_a_magenta_header() {
        init();
        for (x, y) in [(0, 0), (10, 20), (72, 50), (-40, -30), (200, 200)] {
            let mut fb = sentinel();
            draw_spygram(&mut fb, &SPYGRAM_ARRIVAL[0], 100, 3, &SpygramOpts { x: Some(x), y: Some(y), photo: None });
            assert!(changed(&fb) > 0);
        }
        let mut fb = sentinel();
        draw_spygram(&mut fb, &SPYGRAM_ARRIVAL[0], 100, 3, &SpygramOpts { x: Some(20), y: Some(10), photo: None });
        assert_eq!(fb.get_pixel(20 + 150, 10 + 10), c::MAGENTA);
    }

    #[test]
    fn shows_the_like_count_and_a_custom_photo_callback_is_used_clipped_to_the_photo_box() {
        init();
        let mut a = sentinel();
        let mut b = sentinel();
        draw_spygram(&mut a, &SPYGRAM_ARRIVAL[1], 10, 5, &SpygramOpts { x: Some(20), y: Some(10), photo: None });
        draw_spygram(&mut b, &SPYGRAM_ARRIVAL[1], 987, 5, &SpygramOpts { x: Some(20), y: Some(10), photo: None });
        assert_ne!(a.hash(), b.hash());
        let mut cc = sentinel();
        draw_spygram(
            &mut cc,
            &SPYGRAM_ARRIVAL[1],
            10,
            5,
            &SpygramOpts { x: Some(20), y: Some(10), photo: Some(|fb, x, y, w, h, _| fb.fill_rect(x - 50, y - 50, w + 100, h + 100, c::LIME)) }, // tries to paint outside
        );
        assert_eq!(cc.get_pixel(20 + 8 + 5, 10 + 36 + 5), c::LIME);
        assert_ne!(cc.get_pixel(20 + 8 - 3, 10 + 36 + 5), c::LIME); // clipped at the photo's edge
    }
}

mod mall_directory {
    use super::*;

    fn base() -> MapData {
        let mut statuses = [StoreStatus::Package; 13];
        for s in STORES.iter() {
            statuses[s.id as usize] = match s.role {
                StoreRole::Closed => StoreStatus::Closed,
                StoreRole::Powerup => StoreStatus::Powerup,
                StoreRole::Target => StoreStatus::Package,
            };
        }
        statuses[StoreId::Forever12 as usize] = StoreStatus::Cleared;
        MapData {
            frame: 0,
            cars: vec![MapCar { shaft: ShaftId::A, y: floor_y(1.0) }, MapCar { shaft: ShaftId::B, y: floor_y(3.0) }, MapCar { shaft: ShaftId::C, y: floor_y(4.0) }],
            player: MapPlayer { x: 380.0, y: floor_y(2.0), in_store: None },
            statuses,
            radar: false,
            inventory: "NONE YET".to_string(),
            black_friday: false,
        }
    }
    fn render(d: &MapData) -> Framebuffer {
        init();
        let mut fb = Framebuffer::new();
        draw_map_view(&mut fb, d);
        fb
    }
    fn box_of(id: StoreId) -> super::super::map_view::StoreBox {
        *store_boxes().iter().find(|x| x.id == id).unwrap()
    }
    fn center(id: StoreId) -> (i32, i32) {
        let b = box_of(id);
        (b.x + 2, b.y + 3) // inside the box, left of the label
    }

    #[test]
    fn colours_stores_by_status_package_red_cleared_grey_power_up_blue_closed_dark_outline() {
        let fb = render(&MapData { frame: 14, ..base() }); // blink phase: player marker hidden
        let px = |id: StoreId| {
            let (x, y) = center(id);
            fb.get_pixel(x, y)
        };
        assert_eq!(px(StoreId::Radioshock), c::RED);
        assert_eq!(px(StoreId::Forever12), c::GRAY);
        assert_eq!(px(StoreId::Crookstone), c::BLUE);
        assert_eq!(px(StoreId::Blockbluster), c::BLACK); // closed: not filled
        let b = box_of(StoreId::Blockbluster);
        assert_eq!(fb.get_pixel(b.x, b.y + 4), c::MDGRAY); // ...but outlined
    }

    #[test]
    fn every_store_box_is_on_screen_readable_size_and_clear_of_shafts_and_other_boxes() {
        let boxes = store_boxes();
        assert_eq!(boxes.len(), STORES.len());
        for b in &boxes {
            assert!(b.x >= 0);
            assert!(b.x + b.w <= 256);
            assert_eq!(b.w, STORE_BOX_W);
            assert!(b.w >= 22);
            assert!(b.h >= 14);
        }
        let hit = |a: &super::super::map_view::StoreBox, c: &super::super::map_view::StoreBox| a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
        for i in 0..boxes.len() {
            for j in i + 1..boxes.len() {
                assert!(!hit(&boxes[i], &boxes[j]));
            }
        }
        for s in SHAFTS.iter() {
            let sx = map_x(s.x);
            let sw = (s.w * 0.3).round() as i32;
            for b in &boxes {
                assert!(!(sx < b.x + b.w && b.x < sx + sw), "{:?} vs shaft {}", b.id, s.id.as_str());
            }
        }
    }

    #[test]
    fn the_player_marker_blinks_inside_a_store_the_store_blinks_instead() {
        let mut hashes = HashSet::new();
        for f in 0..48 {
            hashes.insert(render(&MapData { frame: f, ..base() }).hash());
        }
        assert_eq!(hashes.len(), 2);
        let pl = MapPlayer { x: 0.0, y: 0.0, in_store: Some(StoreId::Hotspy) };
        let a = render(&MapData { frame: 0, player: pl, ..base() });
        let b = render(&MapData { frame: 14, player: pl, ..base() });
        let hb = box_of(StoreId::Hotspy);
        assert_eq!(a.get_pixel(hb.x + 2, hb.y + 3), c::WHITE);
        assert_eq!(b.get_pixel(hb.x + 2, hb.y + 3), c::RED);
        // no player marker in store mode: only the store box changes between blink phases
        let mut diff_outside = 0;
        for y in 0..240 {
            for x in 0..256 {
                if a.get_pixel(x, y) != b.get_pixel(x, y) && !(x >= hb.x && x < hb.x + hb.w && y >= hb.y && y < hb.y + hb.h) {
                    diff_outside += 1;
                }
            }
        }
        assert_eq!(diff_outside, 0);
    }

    #[test]
    fn radar_marks_each_remaining_package_store_with_a_bang_and_only_those() {
        let off = render(&MapData { frame: 14, ..base() });
        let on = render(&MapData { frame: 14, radar: true, ..base() });
        let marks = |fb: &Framebuffer, id: StoreId| {
            let b = box_of(id);
            let mut n = 0;
            for y in b.y + 2..b.y + 8 {
                for x in b.x..b.x + b.w {
                    if fb.get_pixel(x, y) == c::YELLOW || fb.get_pixel(x, y) == c::WHITE {
                        n += 1;
                    }
                }
            }
            n
        };
        assert!(marks(&on, StoreId::Radioshock) > marks(&off, StoreId::Radioshock));
        assert_eq!(marks(&on, StoreId::Forever12), marks(&off, StoreId::Forever12)); // cleared
        assert_eq!(marks(&on, StoreId::Crookstone), marks(&off, StoreId::Crookstone)); // power-up shop
        assert_eq!(marks(&on, StoreId::Blockbluster), marks(&off, StoreId::Blockbluster)); // closed
    }

    #[test]
    fn shows_each_car_where_it_is_moving_a_car_changes_the_picture_and_positions_map_linearly() {
        let a = render(&MapData { cars: vec![MapCar { shaft: ShaftId::B, y: floor_y(2.0) }], ..base() });
        let b = render(&MapData { cars: vec![MapCar { shaft: ShaftId::B, y: floor_y(2.0) + 24.0 }], ..base() });
        assert_ne!(a.hash(), b.hash());
        assert_eq!(map_y(floor_y(3.0)) - map_y(floor_y(2.0)), map_y(floor_y(4.0)) - map_y(floor_y(3.0)));
        assert!(map_y(floor_y(2.0) + 24.0) > map_y(floor_y(2.0)));
        // car on the shaft's bottom floor stays inside the shaft
        let bottom = render(&MapData { cars: vec![MapCar { shaft: ShaftId::A, y: floor_y(5.0) }], ..base() }); // A only serves R..2F; clamped to its bottom
        assert!(bottom.count_not(c::BLACK) > 0);
    }

    #[test]
    fn draws_the_escalators_and_the_getaway_car_regardless_of_state() {
        let fb = render(&MapData { frame: 14, ..base() });
        for e in ESCALATORS.iter() {
            let mx = ((map_x(e.x_low) + map_x(e.x_high)) as f64 / 2.0).round() as i32;
            let mut orange = 0;
            for y in 0..240 {
                for x in mx - 3..=mx + 3 {
                    if fb.get_pixel(x, y) == c::ORANGE {
                        orange += 1;
                    }
                }
            }
            assert!(orange > 0, "{}", e.id.as_str());
        }
    }

    #[test]
    fn wraps_a_long_inventory_into_at_most_3_lines_that_fit() {
        let long = "EXPIRED COUPON, PRE-OWNED STRATEGY GUIDE, PET ROCK, MOOD RING, 1 SHARE (DOWN 99%), PHOTO STRIP, MORE, MORE, MORE, MORE";
        let lines = inventory_lines(long);
        assert!(lines.len() <= 3);
        for l in &lines {
            assert!(text_width(l, &TextOpts::default()) <= 256 - 16);
        }
        assert!(lines.last().unwrap().ends_with("..."));
        assert_eq!(inventory_lines("NONE YET"), vec!["ITEMS: NONE YET".to_string()]);
    }
}

mod the_daily_mall {
    use super::*;

    #[test]
    fn every_headline_wraps_to_at_most_3_lines_that_fit_the_page_and_the_26_char_copy_limit() {
        for h in HEADLINES {
            let lines = headline_lines(h);
            assert!(lines.len() <= 3, "{}", h);
            for l in &lines {
                assert!(l.chars().count() <= NEWS_HEADLINE_CHARS, "{}", l);
                assert!(l.chars().count() <= LIMITS.headline_line);
                assert!(text_width(l, &TextOpts::default().scale(2)) <= 240 - 16, "{}", l);
            }
            assert_eq!(lines.join(" "), *h);
        }
    }

    #[test]
    fn renders_every_headline_and_slides_in() {
        init();
        let mut hashes = HashSet::new();
        for h in HEADLINES {
            let mut fb = Framebuffer::new();
            draw_newspaper(&mut fb, h, 100);
            hashes.insert(fb.hash());
        }
        assert_eq!(hashes.len(), HEADLINES.len());
        let mut a = Framebuffer::new();
        let mut b = Framebuffer::new();
        draw_newspaper(&mut a, HEADLINES[0], 2);
        draw_newspaper(&mut b, HEADLINES[0], 100);
        assert_ne!(a.hash(), b.hash());
    }
}

mod title_view {
    use super::*;

    #[test]
    fn draws_blinks_press_start_shows_black_friday_after_the_code_and_the_strip_wraps() {
        init();
        let draw = |t: &TitleScreen| {
            let mut fb = Framebuffer::new();
            draw_title(&mut fb, &TitleViewState::from(t));
            fb
        };
        let mut t = TitleScreen::new(4200);
        let f0 = draw(&t);
        assert!(f0.count_not(c::BLACK) > 20000);
        let mut hashes = HashSet::new();
        for _ in 0..120 {
            t.step(&NO_PAD);
            hashes.insert(draw(&t).hash());
        }
        assert!(hashes.len() > 30);
        let mut bf = TitleScreen::new(4200);
        for b in KONAMI_CODE {
            bf.step(&press(b));
            bf.step(&NO_PAD);
        }
        let a = draw(&TitleScreen::new(4200));
        let b2 = draw(&bf);
        assert!(bf.black_friday());
        assert_ne!(a.hash(), b2.hash());
        assert!(TITLE_STRIP_PERIOD > 256);
        assert!(TITLE_SCROLL_FRAMES > 0);
    }
}

mod level_clear_view {
    use super::*;

    #[test]
    fn the_wagon_only_ever_moves_right_the_spy_trails_it_and_never_catches_up() {
        let mut prev = -1.0;
        for pf in 0..270 {
            assert!(wagon_x(pf) >= prev);
            prev = wagon_x(pf);
            if pf >= 30 && wagon_x(pf) < 256.0 {
                assert!(spy_x(pf) + 16.0 < wagon_x(pf), "frame {}", pf);
            }
            assert!(spy_x(pf) < 250.0);
        }
        assert!(wagon_x(269) > 256.0); // the wagon has left the screen
    }

    #[test]
    fn draws_all_four_phases_without_error_and_each_looks_different() {
        init();
        let rng = Rng::new(2);
        let mut s = LevelClearScreen::new(LevelClearOpts { rng: &rng, packages: 6, time_bonus: 900, clear_bonus: 1000, loop_n: 1, score: 100, score_includes_bonus: false });
        let mut hashes = Vec::new();
        for _phase in 0..4 {
            for _ in 0..90 {
                s.step(&NO_PAD);
            }
            let mut fb = Framebuffer::new();
            draw_level_clear(&mut fb, &LevelClearViewState::from(&s));
            hashes.push(fb.hash());
            s.step(&press(btn::START));
        }
        let uniq: HashSet<u32> = hashes.into_iter().collect();
        assert_eq!(uniq.len(), 4);
    }
}

mod continue_and_game_over_views {
    use super::*;

    #[test]
    fn continue_the_picture_changes_with_the_count_and_turns_red_at_3() {
        init();
        let count = |cnt: i32| {
            let mut s = ContinueScreen::new(2);
            while s.count() > cnt {
                s.step(&NO_PAD);
            }
            for _ in 0..20 {
                s.step(&NO_PAD);
            }
            let mut fb = Framebuffer::new();
            draw_continue(&mut fb, &ContinueViewState::from(&s));
            fb
        };
        let red_pixels = |fb: &Framebuffer| {
            let mut n = 0;
            for y in 60..190 {
                for x in 60..200 {
                    if fb.get_pixel(x, y) == c::RED || fb.get_pixel(x, y) == c::SALMON {
                        n += 1;
                    }
                }
            }
            n
        };
        assert_ne!(count(9).hash(), count(8).hash());
        assert!(red_pixels(&count(3)) > 300);
        assert_eq!(red_pixels(&count(5)), 0);
    }

    #[test]
    fn game_over_shutters_progress_and_game_over_appears_at_the_end() {
        init();
        let mut s = GameOverScreen::new(500, 900);
        let mut early = Framebuffer::new();
        for _ in 0..100 {
            s.step(&NO_PAD);
        }
        draw_game_over(&mut early, &GameOverViewState::from(&s));
        while s.frame() < GO_GAMEOVER_AT + 2 {
            s.step(&NO_PAD);
        }
        let mut late = Framebuffer::new();
        draw_game_over(&mut late, &GameOverViewState::from(&s));
        assert_ne!(early.hash(), late.hash());
        // before the shutters the agent (red coat) is visible on the ground floor; after, it is hidden
        let coat = |fb: &Framebuffer| {
            let mut n = 0;
            for y in 160..184 {
                for x in 120..136 {
                    if fb.get_pixel(x, y) == c::RED || fb.get_pixel(x, y) == c::ORANGE {
                        n += 1;
                    }
                }
            }
            n
        };
        assert!(coat(&early) > 0);
        assert_eq!(coat(&late), 0);
    }
}

mod osd_and_misc {
    use super::super::osd::{osd_text, Osd};
    use super::*;

    #[test]
    fn osd_text_maps_the_wasm_codes() {
        assert_eq!(osd_text(1), "CRT ON");
        assert_eq!(osd_text(2), "CRT OFF");
        assert_eq!(osd_text(3), "SOUND ON");
        assert_eq!(osd_text(4), "SOUND OFF");
        assert_eq!(osd_text(5), "GAMEPAD ON");
        assert_eq!(osd_text(6), "GAMEPAD OFF");
        assert_eq!(osd_text(0), "");
    }

    #[test]
    fn osd_shows_for_the_given_frames_then_hides() {
        let mut o = Osd::new();
        let mut fb = sentinel();
        o.draw(&mut fb);
        assert_eq!(changed(&fb), 0);
        o.show("CRT ON", 2);
        assert!(o.active());
        assert_eq!(o.current(), "CRT ON");
        o.draw(&mut fb);
        assert!(changed(&fb) > 0);
        o.tick();
        o.tick();
        assert!(!o.active());
        assert_eq!(o.current(), "");
    }

    #[test]
    fn gallery_pages_wrap_with_left_and_right() {
        init();
        let mut g = super::super::gallery::Gallery::new();
        let n = g.pages.len();
        assert!(n >= 1);
        g.step(&press(btn::LEFT));
        assert_eq!(g.page, n - 1);
        g.step(&press(btn::RIGHT));
        assert_eq!(g.page, 0);
    }
}
