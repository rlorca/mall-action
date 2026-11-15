//! Port of `game/mall/fairness.test.ts` ("the game feels fair on loop 1" for the MALL half).
//!
//! A sensible player (shoots spies that are in front of him, ducks aimed-high shots) tours every floor from the roof
//! down to the parking level. The agent is NOT invincible.
//! (A passive player who never shoots is punished by design: see the README's benchmark notes for the measured numbers.)
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::OnceLock;

use crate::content::stores::{StoreRole, DOOR_W, DOOR_X, STORES};
use crate::engine::pad::{pad_from_held, B, START};
use crate::game::bot::{go_to_floor, mall_reflexes, walk_to, BotRig};
use crate::game::game::{Game, GameOptions};
use crate::game::mall::types::PlayerMode;
use crate::game::mall::world::MallWorld;

struct TourResult {
    deaths: i32,
    completed: bool,
    reached_four_f: bool,
}

/// TS `bot` of `tour`: every frame goes through `mallReflexes`; counts the frames where the agent starts dying.
struct TourBot {
    g: Game,
    held: u32,
    prev: Option<PlayerMode>,
    deaths: i32,
}

impl TourBot {
    fn hold(&mut self, mask: u32, n: i32) {
        for _ in 0..n {
            let m = match &self.g.level {
                Some(lv) => mall_reflexes(&lv.mall, mask),
                None => mask,
            };
            self.g.step(pad_from_held(self.held, m));
            self.held = m;
            let pm = self.g.level.as_ref().map(|l| l.mall.player.mode);
            if pm == Some(PlayerMode::Dying) && self.prev != Some(PlayerMode::Dying) {
                self.deaths += 1;
            }
            self.prev = pm;
        }
    }
    fn tap(&mut self, b: u32) {
        self.hold(b, 1);
        self.hold(0, 1);
    }
}

impl BotRig for TourBot {
    /// TS `g.level!.mall` throws once the game is over (no level): the panic is the same "bot gave up".
    fn w(&self) -> &MallWorld {
        &self.g.level.as_ref().expect("no level").mall
    }
    fn hold(&mut self, held: u32, n: i32) {
        TourBot::hold(self, held, n)
    }
    fn tap(&mut self, btn: u32) {
        TourBot::tap(self, btn)
    }
}

fn tour(seed: u32) -> TourResult {
    let g = Game::new(GameOptions { seed, skip_splash: true, ..Default::default() });
    let mut bot = TourBot { g, held: 0, prev: None, deaths: 0 };
    bot.tap(START);
    let mut i = 0;
    while i < 700 && bot.g.level.as_ref().unwrap().mall.intro.is_some() {
        bot.hold(0, 1);
        if matches!(&bot.g.level.as_ref().unwrap().mall.intro, Some(it) if it.phase.as_str() == "selfie" && it.t > 20) {
            bot.tap(B);
        }
        i += 1;
    }
    let mut reached_four_f = false;
    let mut completed = false;
    // The route script gives up (usually mid-route after a death): a BotError or the missing level.
    let outcome = catch_unwind(AssertUnwindSafe(|| -> Result<(), crate::game::bot::BotError> {
        for floor in [1, 2, 3, 4, 5] {
            go_to_floor(&mut bot, floor)?;
            if floor == 1 {
                reached_four_f = bot.deaths == 0;
            }
            if let Some(st) = STORES.iter().find(|s| s.floor == floor && s.role != StoreRole::Closed) {
                walk_to(&mut bot, st.x + DOOR_X + DOOR_W / 2.0);
            }
            bot.hold(0, 60);
        }
        Ok(())
    }));
    if let Ok(Ok(())) = outcome {
        completed = true;
    }
    TourResult { deaths: bot.deaths, completed, reached_four_f }
}

const N: i32 = 16;

fn results() -> &'static Vec<TourResult> {
    static RESULTS: OnceLock<Vec<TourResult>> = OnceLock::new();
    RESULTS.get_or_init(|| (0..N).map(|i| tour(i as u32 + 1)).collect())
}

#[test]
fn a_new_player_reaches_the_4f_stores_without_dying_on_the_first_try() {
    let ok = results().iter().filter(|r| r.reached_four_f).count();
    assert!(ok as f64 / N as f64 >= 0.9, "{}/{}", ok, N);
}

#[test]
fn a_full_tour_of_all_six_floors_costs_about_one_life_or_less_on_average() {
    let avg = results().iter().map(|r| r.deaths).sum::<i32>() as f64 / N as f64;
    assert!(avg <= 1.6, "{}", avg);
}

#[test]
fn most_tours_complete_the_routes_are_never_blocked() {
    let n = results().iter().filter(|r| r.completed).count();
    assert!(n as f64 / N as f64 >= 0.6, "{}/{}", n, N);
}
