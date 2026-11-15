pub mod copy;
pub mod layout;
pub mod powerups;
pub mod stores;
pub mod themes;

#[cfg(test)]
mod tests {
    use super::copy::*;
    use super::layout::*;
    use super::stores::*;
    use super::themes::*;

    // audio ids (src/audio/ids.ts); the audio module is owned elsewhere, so the id lists the store tests need live here.
    const STORE_SONG_IDS: [&str; 10] = [
        "store.forever12",
        "store.radioshock",
        "store.kgbtoys",
        "store.hotspy",
        "store.footlock",
        "store.sambaddy",
        "store.crookstone",
        "store.sharper",
        "store.spenders",
        "store.gamestonk",
    ];
    const LOOP_MUSIC_HEAD: [&str; 7] = ["title", "mall", "alarm", "elevator", "booth", "continue", "newspaper"];

    fn chars(s: &str) -> usize {
        s.chars().count()
    }

    // ---- copy fits on screen
    #[test]
    fn spygram_10_10_posts_captions_le_2_lines_of_le_21_chars_comments_le_21_chars() {
        assert_eq!(SPYGRAM_ARRIVAL.len(), 10);
        assert_eq!(SPYGRAM_COMPLETE.len(), 10);
        for p in SPYGRAM_ARRIVAL.iter().chain(SPYGRAM_COMPLETE.iter()) {
            assert!(p.caption.len() >= 1);
            assert!(p.caption.len() <= LIMITS.caption_lines);
            for l in p.caption {
                assert!(chars(l) <= LIMITS.caption_line, "{}", l);
            }
            assert!(chars(p.comment) <= LIMITS.comment, "{}", p.comment);
        }
    }

    #[test]
    fn speech_bubbles_le_28_chars() {
        let clerk28: String = EASTER_EGG.clerk.chars().take(28).collect();
        let mut bubbles: Vec<&str> = Vec::new();
        bubbles.extend(LAST_WORDS.iter().copied());
        bubbles.extend(ELEVATOR_EXIT_LINES.iter().copied());
        bubbles.extend([SHOUTS.walker, SHOUTS.cop, SHOUTS.fitting, SHOUTS.detained]);
        bubbles.push(&clerk28);
        for (_, lines) in FIRST_VISIT {
            for l in lines.iter() {
                bubbles.push(l.text);
            }
        }
        assert_eq!(LAST_WORDS.len(), 8);
        assert_eq!(ELEVATOR_EXIT_LINES.len(), 4);
        for b in bubbles {
            assert!(chars(b) <= LIMITS.bubble, "{}", b);
        }
        assert!(chars(SCREEN_TEXT.chase) <= LIMITS.bubble);
    }

    #[test]
    fn first_visit_lines_exist_for_the_9_stores_that_have_them() {
        let mut got: Vec<&str> = FIRST_VISIT.iter().map(|(id, _)| id.as_str()).collect();
        got.sort();
        let mut want = vec!["crookstone", "footlock", "forever12", "hotspy", "kgbtoys", "radioshock", "sambaddy", "sharper", "spenders"];
        want.sort();
        assert_eq!(got, want);
        for id in StoreId::ALL {
            assert_eq!(first_visit(id).is_some(), want.contains(&id.as_str()));
        }
    }

    #[test]
    fn headlines_wrap_into_lines_of_le_26_chars() {
        assert_eq!(HEADLINES.len(), 5);
        for h in HEADLINES {
            let lines = wrap_words(h, LIMITS.headline_line);
            for l in &lines {
                assert!(chars(l) <= LIMITS.headline_line, "{}", l);
            }
            assert_eq!(lines.join(" "), *h);
            assert!(lines.len() <= 4);
        }
    }

    #[test]
    fn pa_lines_wrap_to_le_28_chars_and_there_are_7() {
        assert_eq!(PA_LINES.len(), 7);
        for p in PA_LINES {
            for l in wrap_words(p, LIMITS.pa_line) {
                assert!(chars(&l) <= LIMITS.pa_line);
            }
        }
    }

    #[test]
    fn banners_fit_in_one_line() {
        let mut banners: Vec<String> = FLOOR_BANNERS.iter().map(|s| s.to_string()).collect();
        banners.extend(EASTER_EGG.items.iter().map(|i| you_got(i)));
        banners.push(package_banner(6));
        banners.push(packages_left(6));
        banners.push(continues_left(3));
        for s in [UI.alarm_banner, UI.now_playing, UI.trap, UI.nothing] {
            banners.push(s.to_string());
        }
        for b in &banners {
            assert!(chars(b) <= LIMITS.banner, "{}", b);
        }
        assert_eq!(FLOOR_BANNERS.len(), NUM_FLOORS as usize);
        assert_eq!(FLOOR_BANNERS[1], "4F - FASHION & GADGETS, SPIES");
    }

    // TODO(lead): remove the `` gate below once engine::font + framebuffer exist (API already adapted to font.rs). TS tests 'every UI string is drawable with the main font'
    // (font_supports(FONT_MAIN, s) for every UI string and every line checked above) and
    // 'store signs fit the tiny font on an 80 px sign' (font_supports(FONT_TINY, name) and
    // text_width(name, FONT_TINY) <= STORE_W - 4 for every store).
    
    mod font_tests {
        use super::*;
        use crate::engine::font::{font_supports, text_width, TextOpts, FONT_MAIN, FONT_TINY};
        #[test]
        fn every_ui_string_is_drawable_with_the_main_font() {
            let mut all: Vec<String> = Vec::new();
            for p in SPYGRAM_ARRIVAL.iter().chain(SPYGRAM_COMPLETE.iter()) {
                for l in p.caption {
                    all.push(l.to_string());
                }
                all.push(p.comment.to_string());
            }
            all.extend(LAST_WORDS.iter().map(|s| s.to_string()));
            all.extend(ELEVATOR_EXIT_LINES.iter().map(|s| s.to_string()));
            all.extend([SHOUTS.walker, SHOUTS.cop, SHOUTS.fitting, SHOUTS.detained].iter().map(|s| s.to_string()));
            all.push(EASTER_EGG.clerk.chars().take(28).collect());
            for (_, lines) in FIRST_VISIT {
                all.extend(lines.iter().map(|l| l.text.to_string()));
            }
            all.extend(HEADLINES.iter().map(|s| s.to_string()));
            all.extend(PA_LINES.iter().map(|s| s.to_string()));
            all.extend(FLOOR_BANNERS.iter().map(|s| s.to_string()));
            all.extend(EASTER_EGG.items.iter().map(|i| you_got(i)));
            all.extend([package_banner(6), packages_left(6), continues_left(3)]);
            all.extend([UI.alarm_banner, UI.now_playing, UI.trap, UI.nothing].iter().map(|s| s.to_string()));
            let u = UI;
            all.extend(
                [
                    u.studio, u.presents, u.title, u.subtitle, u.copyright, u.press_start, u.hint1, u.hint2, u.black_friday, u.black_friday_off,
                    u.pause, u.directory, u.continue_q, u.game_over, u.closed_line1, u.closed_line2, u.alarm_banner, u.mission, u.alarm_hud, u.trap,
                    u.nothing, u.press_to_search, u.searching, u.now_playing, u.level_clear, u.crt_on, u.crt_off, u.sound_on, u.sound_off,
                    u.newspaper_name, u.spygram, u.no_gfx,
                ]
                .iter()
                .map(|s| s.to_string()),
            );
            for s in &all {
                assert!(font_supports(&FONT_MAIN, s), "{}", s);
            }
        }
        #[test]
        fn store_signs_fit_the_tiny_font_on_an_80_px_sign() {
            for s in STORES.iter() {
                assert!(font_supports(&FONT_TINY, s.name), "{}", s.name);
                assert!(text_width(s.name, &TextOpts::default().font(&FONT_TINY)) as f64 <= STORE_W - 4.0, "{}", s.name);
            }
        }
    }

    // ---- store table
    #[test]
    fn has_13_storefronts_6_targets_4_power_up_shops_3_closed() {
        assert_eq!(STORES.len(), 13);
        assert_eq!(STORE_IDS.len(), 13);
        assert_eq!(target_stores().len() as i32, PACKAGES_TOTAL);
        assert_eq!(powerup_stores().len(), 4);
        assert_eq!(closed_stores().len(), 3);
        assert_eq!(open_stores().len(), 10);
        // StoreId discriminant == index in STORES, and store_def round-trips
        for (i, s) in STORES.iter().enumerate() {
            assert_eq!(s.id as usize, i);
            assert_eq!(StoreId::ALL[i], s.id);
            assert_eq!(store_def(s.id).name, s.name);
        }
    }

    #[test]
    fn matches_the_brief_floors_4f_4_3f_3_2f_4_1f_2() {
        assert_eq!(stores_on_floor(1).len(), 4);
        assert_eq!(stores_on_floor(2).len(), 3);
        assert_eq!(stores_on_floor(3).len(), 4);
        assert_eq!(stores_on_floor(4).len(), 2);
    }

    #[test]
    fn nine_themes_gadgets_used_by_exactly_two_shops_closed_stores_have_no_theme_song() {
        assert_eq!(THEMES.len(), 9);
        let used: Vec<ThemeId> = STORES.iter().filter_map(|s| s.theme).collect();
        let mut uniq: Vec<ThemeId> = Vec::new();
        for t in &used {
            if !uniq.contains(t) {
                uniq.push(*t);
            }
        }
        assert_eq!(uniq.len(), 9);
        assert_eq!(STORES.iter().filter(|s| s.theme == Some(ThemeId::Gadgets)).count(), 2);
        for s in closed_stores() {
            assert!(s.theme.is_none());
            assert!(s.song.is_none());
        }
    }

    #[test]
    fn every_open_store_has_its_own_distinct_song_id_that_exists() {
        let songs: Vec<&str> = open_stores().iter().map(|s| s.song.unwrap()).collect();
        let mut uniq = songs.clone();
        uniq.sort();
        uniq.dedup();
        assert_eq!(uniq.len(), 10);
        for s in songs {
            assert!(STORE_SONG_IDS.contains(&s));
        }
        assert!(LOOP_MUSIC_HEAD.contains(&"mall"));
    }

    // ---- mall layout
    #[test]
    fn floors_are_48_px_apart_and_named_r_4f_3f_2f_1f_p() {
        assert_eq!(FLOOR_NAMES, ["R", "4F", "3F", "2F", "1F", "P"]);
        for f in 1..NUM_FLOORS {
            assert_eq!(floor_y(f as f64) - floor_y((f - 1) as f64), 48.0);
        }
    }

    #[test]
    fn shaft_a_serves_r_2f_b_serves_4f_p_c_serves_r_1f_a_b_manual_c_automatic() {
        let [a, b, c] = SHAFTS;
        assert_eq!((a.top, a.bottom, a.manual), (0, 3, true));
        assert_eq!((b.top, b.bottom, b.manual), (1, 5, true));
        assert_eq!((c.top, c.bottom, c.manual), (0, 4, false));
    }

    #[test]
    fn escalators_connect_3f_4f_and_1f_2f() {
        let v: Vec<(i32, i32)> = ESCALATORS.iter().map(|e| (e.upper, e.lower)).collect();
        assert_eq!(v, vec![(1, 2), (3, 4)]);
    }

    #[test]
    fn every_floor_can_be_reached_from_the_roof_and_p_only_via_b() {
        let mut r = reachable_floors(0);
        r.sort();
        assert_eq!(r, vec![0, 1, 2, 3, 4, 5]);
        let ids: Vec<ShaftId> = SHAFTS.iter().filter(|s| s.bottom >= 5).map(|s| s.id).collect();
        assert_eq!(ids, vec![ShaftId::B]);
    }

    #[test]
    fn storefronts_shafts_and_escalator_landings_never_overlap_on_a_floor_and_stay_inside_the_mall() {
        for f in 1..=4 {
            let mut boxes: Vec<(String, f64, f64)> = Vec::new();
            for s in stores_on_floor(f) {
                boxes.push((s.id.as_str().to_string(), s.x, s.x + STORE_W));
            }
            for sh in SHAFTS.iter() {
                if f >= sh.top && f <= sh.bottom {
                    boxes.push((format!("shaft{}", sh.id.as_str()), sh.x, sh.x + sh.w));
                }
            }
            for e in ESCALATORS.iter() {
                if f == e.upper || f == e.lower {
                    boxes.push((e.id.as_str().to_string(), e.x_low.min(e.x_high), e.x_low.max(e.x_high)));
                }
            }
            for (n, l, r) in &boxes {
                assert!(*l >= 8.0, "{}", n);
                assert!(*r <= LEVEL_W - 8.0, "{}", n);
            }
            for i in 0..boxes.len() {
                for j in (i + 1)..boxes.len() {
                    let (na, la, ra) = &boxes[i];
                    let (nb, lb, rb) = &boxes[j];
                    assert!(ra <= lb || rb <= la, "floor {}: {} overlaps {}", f, na, nb);
                }
            }
        }
    }

    #[test]
    fn lamps_never_hang_in_front_of_store_signs_shafts_or_escalators() {
        for (f, xs) in LAMPS.iter() {
            let f = *f;
            for &x in xs.iter() {
                for s in stores_on_floor(f) {
                    let hit = x + LAMP_HALF_W > s.x && x - LAMP_HALF_W < s.x + STORE_W;
                    assert!(!hit, "lamp {} on floor {} overlaps {}", x, f, s.id.as_str());
                }
                for sh in SHAFTS.iter() {
                    if f >= sh.top && f <= sh.bottom {
                        assert!(x + LAMP_HALF_W <= sh.x || x - LAMP_HALF_W >= sh.x + sh.w, "lamp {}/{} vs shaft {}", x, f, sh.id.as_str());
                    }
                }
                for e in ESCALATORS.iter() {
                    if f == e.upper || f == e.lower {
                        let l = e.x_low.min(e.x_high);
                        let r = e.x_low.max(e.x_high);
                        assert!(x + LAMP_HALF_W <= l || x - LAMP_HALF_W >= r, "lamp {}/{} vs {}", x, f, e.id.as_str());
                    }
                }
            }
        }
        assert_eq!(lamps(0), &[] as &[f64]);
        assert_eq!(lamps(4).len(), 4);
    }

    #[test]
    fn features_sit_on_real_floors_inside_the_mall() {
        for ft in FEATURES {
            assert!(ft.floor >= 0);
            assert!(ft.floor < NUM_FLOORS);
            assert!(ft.x >= 0.0);
            assert!(ft.x + ft.w <= LEVEL_W);
        }
        // a directory kiosk on each shopping floor; a photo booth on 3F; fountains on 3F and 1F
        for f in [1, 2, 3, 4] {
            assert!(FEATURES.iter().any(|x| x.kind == FeatureKind::Kiosk && x.floor == f));
        }
        assert!(FEATURES.iter().any(|x| x.kind == FeatureKind::Booth && x.floor == 2));
        let mut fl: Vec<i32> = FEATURES.iter().filter(|x| x.kind == FeatureKind::Fountain).map(|x| x.floor).collect();
        fl.sort();
        assert_eq!(fl, vec![2, 4]);
        assert!(FEATURES.iter().any(|x| x.kind == FeatureKind::Wagon && x.floor == 5));
        assert_eq!(LEVEL_W, 768.0);
    }
}
