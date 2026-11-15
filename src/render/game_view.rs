use super::continue_view::{draw_continue, ContinueViewState};
use super::game_over_view::{draw_game_over, GameOverViewState};
use super::hud::draw_hud;
use super::level_clear_view::{draw_level_clear, LevelClearViewState};
use super::mall_actors_view::{draw_mall_actors, draw_mall_furniture};
use super::mall_view::{draw_mall, MallDrawHooks};
use super::map_view::draw_map_view;
use super::pause_view::draw_pause_overlay;
use super::store_view::draw_store_view;
use super::title_view::{draw_title, TitleViewState};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::palette::c;
use crate::game::game::{Game, SceneKind};
use crate::game::level::{Level, LevelOverlay};
use crate::game::run::Run;

const HOOKS: MallDrawHooks = MallDrawHooks { furniture: Some(draw_mall_furniture), actors: Some(draw_mall_actors) };

fn draw_level(fb: &mut Framebuffer, lv: &Level, run: &Run) {
    if lv.overlay == Some(LevelOverlay::Map) {
        draw_map_view(fb, &lv.map_data(run));
    } else {
        match &lv.store {
            Some(store) => draw_store_view(fb, store, run, lv.frame),
            None => draw_mall(fb, &lv.mall, run, lv.frame, &HOOKS),
        }
        draw_hud(fb, &lv.hud(run));
        if lv.overlay == Some(LevelOverlay::Pause) {
            draw_pause_overlay(fb, lv.frame);
        }
    }
    let steps = lv.fade_steps();
    if steps > 0 {
        fb.darken_all(steps);
    }
}

/// Draw whatever scene the game is in into the framebuffer. Rendering never mutates the game.
pub fn render_game(fb: &mut Framebuffer, game: &Game) {
    fb.reset_clip();
    fb.clear(c::BLACK);
    match game.scene {
        SceneKind::Splash => {
            if let Some(s) = &game.splash {
                s.draw(fb);
            }
        }
        SceneKind::Title => {
            if let Some(t) = &game.title {
                draw_title(fb, &TitleViewState::from(t));
            }
        }
        SceneKind::Level => {
            if let (Some(lv), Some(run)) = (&game.level, &game.run) {
                draw_level(fb, lv, run);
            }
        }
        SceneKind::Clear => {
            if let Some(s) = &game.clear {
                draw_level_clear(fb, &LevelClearViewState::from(s));
            }
        }
        SceneKind::Continue => {
            if let Some(s) = &game.cont {
                draw_continue(fb, &ContinueViewState::from(s));
            }
        }
        SceneKind::Gameover => {
            if let Some(s) = &game.over {
                draw_game_over(fb, &GameOverViewState::from(s));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    //! Fine-grained render parity with the TS renderers: `fixtures/render-world.json` (made by
    //! `scripts/render-world.ts` from the TS source) holds framebuffer hashes of the HUD, store rooms, the mall with
    //! its extras and whole-Game scenes under scripted pads. Every scenario below mirrors the TS driver exactly.
    use super::*;
    use crate::content::stores::{open_stores, StoreId, STORES};
    use crate::content::powerups::PowerId;
    use crate::engine::pad::{self, pad_from_held};
    use crate::game::game::GameOptions;
    use crate::game::hud::{HudData, HudTimed};
    use crate::game::mall::modules::booth::PhotoStrip;
    use crate::game::mall::modules::janitor::WetPatch;
    use crate::game::mall::modules::kiosks::KioskPanel;
    use crate::game::mall::modules::testrig::make_xrig;
    use crate::game::mall::testutil::RigOpts;
    use crate::game::store::testutil::{make_world, MakeOpts};
    use std::collections::BTreeMap;

    fn lcg_next(s: u32) -> u32 {
        s.wrapping_mul(1664525).wrapping_add(1013904223)
    }

    fn fixture() -> Vec<(String, u32)> {
        let text = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/render-world.json")).expect("fixtures/render-world.json");
        let mut v = Vec::new();
        for line in text.lines() {
            let line = line.trim().trim_end_matches(',');
            if !line.starts_with('"') {
                continue;
            }
            let close = line[1..].find('"').unwrap() + 1;
            let key = line[1..close].to_string();
            let val: u32 = line[close + 2..].trim().parse().expect("hash");
            v.push((key, val));
        }
        v
    }

    /// Collects the computed hashes in the same order as the fixture and compares them group by group.
    struct Check {
        want: BTreeMap<String, u32>,
        seen: usize,
        bad: Vec<String>,
        group: &'static str,
    }

    impl Check {
        fn new() -> Check {
            Check { want: fixture().into_iter().collect(), seen: 0, bad: Vec::new(), group: "" }
        }
        fn emit(&mut self, key: String, fb: &Framebuffer) {
            self.seen += 1;
            match self.want.get(&key) {
                None => self.bad.push(format!("{}: no such key in the fixture", key)),
                Some(&w) if w != fb.hash() => self.bad.push(format!("{}: TS {} Rust {}", key, w, fb.hash())),
                _ => {}
            }
        }
        fn finish(&self, prefix: &str) {
            let n = self.want.keys().filter(|k| k.starts_with(prefix)).count();
            assert!(self.bad.is_empty(), "{} mismatches of {} (first 12):\n{}", self.bad.len(), self.seen, self.bad.iter().take(12).cloned().collect::<Vec<_>>().join("\n"));
            assert_eq!(self.seen, n, "{}: number of hashes compared vs the fixture", self.group);
        }
    }

    fn hud(f: impl FnOnce(&mut HudData)) -> HudData {
        let mut h = HudData { score: 12340, packages: 3, lives: 3, timed: None, armor: false, radar: false, alarm: false, floor: Some(0), marquee: None, frame: 0 };
        f(&mut h);
        h
    }

    #[test]
    fn render_world_hud_parity_with_ts() {
        let worst = hud(|h| {
            h.score = 999999;
            h.packages = 6;
            h.lives = 99;
            h.timed = Some(HudTimed { name: "ORANGE JULI-OOZE", frac: 0.2 });
            h.armor = true;
            h.radar = true;
            h.alarm = true;
            h.floor = Some(5);
        });
        let states = vec![
            hud(|_| {}),
            worst,
            { let mut h = worst; h.floor = None; h.marquee = Some("BLOCKBLUSTER VIDEO"); h },
            hud(|h| h.floor = None),
            hud(|h| h.timed = Some(HudTimed { name: "AN EXTREMELY LONG POWER UP NAME", frac: 1.0 })),
            hud(|h| { h.score = 0; h.packages = 0; h.lives = 0; }),
            hud(|h| { h.score = 12345678; h.packages = 9; h.lives = 250; h.timed = Some(HudTimed { name: "RAPID FIRE", frac: 7.0 }); }),
            hud(|h| { h.timed = Some(HudTimed { name: "RAPID FIRE", frac: 0.4 }); h.floor = Some(3); h.alarm = true; }),
            hud(|h| { h.timed = Some(HudTimed { name: "SNEAKERS", frac: 0.1 }); h.floor = Some(2); h.armor = true; }),
        ];
        let mut ck = Check::new();
        ck.group = "hud";
        for (i, h) in states.iter().enumerate() {
            for frame in [0, 5, 9, 11, 20, 40, 61, 77, 123] {
                let mut fb = Framebuffer::new();
                fb.clear(0x3d);
                let mut hh = *h;
                hh.frame = frame;
                draw_hud(&mut fb, &hh);
                ck.emit(format!("hud/{}/{}", i, frame), &fb);
            }
        }
        for s in STORES.iter() {
            for frame in [0, 30, 77, 301] {
                let mut fb = Framebuffer::new();
                fb.clear(0x3d);
                draw_hud(&mut fb, &hud(|h| { h.floor = None; h.marquee = Some(s.name); h.frame = frame; }));
                ck.emit(format!("hud/marquee/{}/{}", s.id.as_str(), frame), &fb);
            }
        }
        ck.finish("hud/");
    }

    #[test]
    fn render_world_store_rooms_parity_with_ts() {
        const MASKS: [u32; 14] = [
            0, pad::RIGHT, pad::LEFT, pad::UP, pad::DOWN, pad::RIGHT | pad::UP, pad::LEFT | pad::DOWN, pad::B, pad::A, pad::A | pad::RIGHT, pad::B | pad::LEFT,
            pad::B | pad::UP, pad::A | pad::DOWN, 0,
        ];
        let mut ck = Check::new();
        ck.group = "store";
        for (idx, def) in open_stores().iter().enumerate() {
            let idx = idx as u32;
            let mut m = make_world(def.id, MakeOpts { seed: 7 + idx, guards: true, seen: idx % 2 == 0, egg: def.id == StoreId::Gamestonk, ..MakeOpts::default() });
            if idx % 2 == 1 {
                m.run.give_power(PowerId::Radar);
            }
            if idx % 3 == 1 {
                m.run.give_power(PowerId::Cinnabomb);
            }
            if idx % 4 == 2 {
                m.run.give_power(PowerId::Armor);
            }
            let (mut lcg, mut held, mut prev) = (500 + idx, 0u32, 0u32);
            for f in 0..900 {
                if f % 12 == 0 {
                    lcg = lcg_next(lcg);
                    held = MASKS[((lcg >> 16) as usize) % MASKS.len()];
                }
                m.world.step(&mut m.run, pad_from_held(prev, held));
                prev = held;
                if f % 30 == 29 || (f < 120 && f % 6 == 5) {
                    let mut fb = Framebuffer::new();
                    fb.clear(0x0d);
                    draw_store_view(&mut fb, &m.world, &m.run, m.world.frame);
                    ck.emit(format!("store/{}/{}", def.id.as_str(), f), &fb);
                }
            }
        }
        ck.finish("store/");
    }

    #[test]
    fn render_world_mall_parity_with_ts() {
        const MASKS: [u32; 14] = [
            0, pad::RIGHT, pad::LEFT, pad::RIGHT | pad::B, pad::LEFT | pad::B, pad::A, pad::RIGHT | pad::A, pad::UP, pad::DOWN, pad::B, pad::UP | pad::RIGHT,
            pad::DOWN | pad::RIGHT, pad::A | pad::B, 0,
        ];
        let scn: [(u32, i32, f64); 6] = [(3, 0, 100.0), (5, 3, 300.0), (9, 4, 150.0), (11, 2, 500.0), (13, 1, 200.0), (17, 4, 600.0)];
        let hooks = MallDrawHooks { furniture: Some(draw_mall_furniture), actors: Some(draw_mall_actors) };
        let mut ck = Check::new();
        ck.group = "mall";
        for (seed, floor, x) in scn {
            let mut r = make_xrig(RigOpts::new().seed(seed).floor(floor).x(x), true);
            r.run.lives = 9999;
            let (mut lcg, mut held) = (1000 + seed, 0u32);
            let draw = |r: &crate::game::mall::modules::testrig::XRig, frame: i32| {
                let mut fb = Framebuffer::new();
                fb.clear(0x0d);
                draw_mall(&mut fb, &r.w, &r.run, frame, &hooks);
                fb
            };
            for f in 0..3000 {
                if f % 12 == 0 {
                    lcg = lcg_next(lcg);
                    held = MASKS[((lcg >> 16) as usize) % MASKS.len()];
                }
                r.hold(held, 1);
                if f % 40 == 39 {
                    ck.emit(format!("mall/s{}/{}", seed, f), &draw(&r, r.w.frame));
                }
            }
            // poked states on top of the final world
            let (px, py) = (r.w.player.x, r.w.player.y);
            r.x().janitor.patch = Some(WetPatch { x: px + 30.0, t: 80 });
            r.x().booth.strip = Some(PhotoStrip { x: px, y: py, t: 30, total: 200 });
            r.x().kiosks.panel = Some(KioskPanel { kiosk: 1, target: Some(StoreId::Crookstone), t: 100, total: 240 });
            for f in [3, 10, 17, 24] {
                ck.emit(format!("mall/poke/s{}/{}", seed, f), &draw(&r, f));
            }
            r.w.shake = 10;
            r.run.alarm_on = true;
            for f in [16, 17, 18, 19, 34] {
                ck.emit(format!("mall/shake/s{}/{}", seed, f), &draw(&r, f));
            }
            r.run.give_power(PowerId::Cinnabomb);
            r.w.player.frozen = 30;
            r.w.player.invuln = 50;
            for f in [0, 1, 2, 3, 4, 5] {
                ck.emit(format!("mall/flash/s{}/{}", seed, f), &draw(&r, f));
            }
        }
        ck.finish("mall/");
    }

    #[test]
    fn render_world_whole_game_parity_with_ts() {
        const MASKS: [u32; 16] = [
            0, pad::RIGHT, pad::LEFT, pad::RIGHT | pad::B, pad::LEFT | pad::B, pad::A, pad::RIGHT | pad::A, pad::UP, pad::DOWN, pad::B, pad::UP | pad::RIGHT,
            pad::DOWN | pad::RIGHT, pad::START, pad::SELECT, pad::A | pad::B, 0,
        ];
        // name, seed, skip_splash, autostart, skip_intro, black_friday, frames, input_seed, start
        let games: [(&str, u32, bool, bool, bool, bool, i32, u32, i32); 5] = [
            ("g1", 5, false, true, true, false, 7000, 71, 0),
            ("g2", 77, false, true, false, false, 4000, 73, 0),
            ("g3", 2024, false, true, true, true, 7000, 79, 0),
            ("g4", 31, false, true, true, false, 7000, 83, 0),
            ("g5", 8, true, false, false, false, 2500, 89, 30),
        ];
        let mut ck = Check::new();
        ck.group = "game";
        for (name, seed, skip_splash, autostart, skip_intro, black_friday, frames, input_seed, start) in games {
            let mut g = Game::new(GameOptions { seed, skip_splash, autostart, skip_intro, black_friday, hi_score: 0 });
            let mut fb = Framebuffer::new();
            let (mut held, mut prev, mut lcg) = (0u32, 0u32, input_seed);
            for f in 0..frames {
                if f % 15 == 0 {
                    lcg = lcg_next(lcg);
                    held = MASKS[((lcg >> 16) % 16) as usize];
                }
                let mut m = held;
                if f == start && start > 0 {
                    m = pad::START;
                } else if m & pad::START != 0 && f % 15 != 0 {
                    m &= !pad::START;
                }
                g.step(pad_from_held(prev, m));
                prev = m;
                g.drain_sfx();
                if f % 20 == 19 || (f < 200 && f % 4 == 3) {
                    render_game(&mut fb, &g);
                    ck.emit(format!("game/{}/{}", name, f), &fb);
                }
            }
        }
        ck.finish("game/");
    }
}
