//! Port of `store/fairness.test.ts`.
//!
//! "The game feels fair on loop 1: a new player can find a package without dying on the first try."
//! A sensible-but-unspectacular scripted player (sidesteps aim lines, shoots guards that line up) must find the
//! package in most visits to every target store on loop 1.
//!
//! TODO(bot): these need `game/bot.rs::play_store_smart` (the lead ports bot.ts later). The scaffold below is the
//! TS `visit()` helper; wire it to the bot's store-player once it exists and remove the `#[ignore]`s.
use crate::content::stores::{target_stores, StoreId};
use crate::engine::pad::pad_from_held;
use crate::engine::rng::Rng;
use crate::game::run::{Run, RunOpts};

use super::levelgen::generate_level;
use super::world::StoreWorld;

#[allow(dead_code)]
struct Visit {
    run: Run,
    world: StoreWorld,
    held: u32,
}

#[allow(dead_code)]
impl Visit {
    fn new(store_id: StoreId, seed: u32) -> Visit {
        let mut run = Run::new(seed, RunOpts::default());
        run.level = generate_level(&mut Rng::new(seed), 1, false);
        let world = StoreWorld::new(&mut run, store_id, &Rng::new(seed + 1000), None);
        Visit { run, world, held: 0 }
    }
    /// TS bot interface `hold(mask, n = 1)`.
    fn hold(&mut self, mask: u32, n: i32) {
        for _ in 0..n {
            self.world.step(&mut self.run, pad_from_held(self.held, mask));
            self.held = mask;
        }
    }
    /// TS bot interface `tap(btn)`.
    fn tap(&mut self, btn: u32) {
        self.hold(btn, 1);
        self.hold(0, 1);
    }
}

/// TS `visit(storeId, seed)` -> `{ found, died }`.
#[allow(dead_code)]
fn visit(store_id: StoreId, seed: u32) -> (bool, bool) {
    let v = Visit::new(store_id, seed);
    let _ = &v;
    // TODO(bot): let found = play_store_smart(&mut v, 6000);
    let found = false;
    (found, v.world.died)
}

#[test]
#[ignore = "TODO(bot): needs game::bot::play_store_smart"]
fn loop_1_fairness_each_target_store_a_sensible_player_finds_the_package_in_at_least_60_percent_of_visits() {
    let n = 16;
    for st in target_stores() {
        let mut found = 0;
        for seed in 1..=n {
            if visit(st.id, seed).0 {
                found += 1;
            }
        }
        assert!(found as f64 / n as f64 >= 0.6, "{}", st.id.as_str());
    }
}

#[test]
#[ignore = "TODO(bot): needs game::bot::play_store_smart"]
fn loop_1_fairness_overall_at_least_80_percent_of_visits_succeed_on_the_first_try() {
    let n = 16;
    let (mut total, mut total_found) = (0, 0);
    for st in target_stores() {
        for seed in 1..=n {
            if visit(st.id, seed).0 {
                total_found += 1;
            }
            total += 1;
        }
    }
    assert!(total_found as f64 / total as f64 >= 0.8);
}
