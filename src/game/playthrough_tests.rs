//! Port of `game/playthrough.test.ts`: the end-to-end bot playthrough of the whole mall and every package store.
use super::bot::{enter_store_door, go_to_floor, leave_store, search_store_for_package, walk_to, BotRig, StoreBot};
use super::game::{Game, GameOptions, SceneKind};
use super::mall::world::MallWorld;
use super::run::Run;
use super::store::world::StoreWorld;
use crate::content::layout::WAGON;
use crate::content::stores::{target_stores, PACKAGES_TOTAL};
use crate::engine::pad::{pad_from_held, B, START, UP};

/// Drives a real Game with button presses only. The agent is kept invincible so routing, not spies, is what's tested.
struct GameBot {
    held: u32,
    g: Game,
    immortal: bool,
}

impl GameBot {
    fn new(g: Game) -> GameBot {
        GameBot { held: 0, g, immortal: true }
    }
    fn hold(&mut self, mask: u32, n: i32) {
        for _ in 0..n {
            if self.immortal {
                if let Some(run) = self.g.run.as_mut() {
                    run.power.invincible = 1_000_000;
                }
            }
            self.g.step(pad_from_held(self.held, mask));
            self.held = mask;
        }
    }
    fn tap(&mut self, btn: u32) {
        self.hold(btn, 1);
        self.hold(0, 1);
    }
    fn wait_for(&mut self, cond: impl Fn(&Game) -> bool, max: i32) {
        let mut i = 0;
        while i < max && !cond(&self.g) {
            self.hold(0, 1);
            i += 1;
        }
        let lv = self.g.level.as_ref();
        assert!(
            cond(&self.g),
            "scene={} store={:?} fade={:?} p={},{:?},{} enter={:?} res={:?}",
            self.g.scene.as_str(),
            lv.and_then(|l| l.store.as_ref().map(|s| s.store_id.as_str())),
            lv.and_then(|l| l.fade),
            lv.map_or(0.0, |l| l.mall.player.x),
            lv.and_then(|l| l.mall.player.floor),
            lv.map_or("", |l| l.mall.player.mode.as_str()),
            lv.and_then(|l| l.mall.enter_store.map(|s| s.as_str())),
            lv.and_then(|l| l.result.map(|r| r.as_str())),
        );
    }
}

impl BotRig for GameBot {
    fn w(&self) -> &MallWorld {
        &self.g.level.as_ref().unwrap().mall
    }
    fn hold(&mut self, held: u32, n: i32) {
        GameBot::hold(self, held, n)
    }
    fn tap(&mut self, btn: u32) {
        GameBot::tap(self, btn)
    }
}

impl StoreBot for GameBot {
    fn world(&self) -> &StoreWorld {
        self.g.level.as_ref().unwrap().store.as_ref().unwrap()
    }
    fn run(&self) -> &Run {
        self.g.run.as_ref().unwrap()
    }
    fn hold(&mut self, held: u32, n: i32) {
        GameBot::hold(self, held, n)
    }
    fn tap(&mut self, btn: u32) {
        GameBot::tap(self, btn)
    }
}

fn full_playthrough(seed: u32) {
    let g = Game::new(GameOptions { seed, skip_splash: true, ..Default::default() });
    let mut bot = GameBot::new(g);
    bot.tap(START);
    assert_eq!(bot.g.scene, SceneKind::Level);
    // arrival: zip line, drop, crouch, selfie (any button skips the selfie)
    let mut i = 0;
    while i < 700 && bot.g.level.as_ref().unwrap().mall.intro.is_some() {
        bot.hold(0, 1);
        if matches!(&bot.g.level.as_ref().unwrap().mall.intro, Some(it) if it.phase.as_str() == "selfie" && it.t > 20) {
            bot.tap(B);
        }
        i += 1;
    }
    assert!(bot.g.level.as_ref().unwrap().mall.intro.is_none());
    // visit the six package stores, nearest-floor first
    let mut order = target_stores();
    order.sort_by(|a, b| a.floor.cmp(&b.floor).then(a.x.partial_cmp(&b.x).unwrap()));
    for (n, st) in order.iter().enumerate() {
        enter_store_door(&mut bot, st.id).unwrap();
        bot.wait_for(|g| g.level.as_ref().unwrap().store.is_some() && g.level.as_ref().unwrap().fade.is_none(), 120);
        assert_eq!(bot.g.level.as_ref().unwrap().store.as_ref().unwrap().store_id, st.id);
        let got = search_store_for_package(&mut bot);
        assert!(got, "{}: package not found", st.id.as_str());
        leave_store(&mut bot).unwrap();
        bot.wait_for(|g| g.level.as_ref().unwrap().store.is_none() && g.level.as_ref().unwrap().fade.is_none(), 120);
        assert_eq!(bot.g.run.as_ref().unwrap().packages(), n as i32 + 1);
        assert_eq!(bot.g.level.as_ref().unwrap().mall.player.floor, Some(st.floor));
    }
    assert_eq!(bot.g.run.as_ref().unwrap().packages(), PACKAGES_TOTAL);
    // the cleared stores can not be entered again
    let first = order[0];
    enter_store_door(&mut bot, first.id).unwrap();
    bot.hold(0, 40);
    assert!(bot.g.level.as_ref().unwrap().store.is_none());
    // to the parking level and the getaway car
    go_to_floor(&mut bot, 5).unwrap();
    walk_to(&mut bot, WAGON.x + 30.0);
    let before = bot.g.run.as_ref().unwrap().score;
    bot.tap(UP);
    assert_eq!(bot.g.scene, SceneKind::Clear);
    assert!(bot.g.run.as_ref().unwrap().score > before);
    // the clear screen runs to the next loop
    let mut guard = 0;
    while bot.g.scene == SceneKind::Clear && guard < 6000 {
        bot.tap(START);
        guard += 1;
    }
    assert_eq!(bot.g.scene, SceneKind::Level);
    assert_eq!(bot.g.run.as_ref().unwrap().loop_, 2);
    assert_eq!(bot.g.run.as_ref().unwrap().packages(), 0);
    assert!(bot.g.run.as_ref().unwrap().lives >= 3);
}

#[test]
fn full_playthrough_with_real_controls_seed_11_title_arrival_6_packages_parking_level_clear_loop_2() {
    full_playthrough(11);
}

#[test]
fn full_playthrough_with_real_controls_seed_12_title_arrival_6_packages_parking_level_clear_loop_2() {
    full_playthrough(12);
}
