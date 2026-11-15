//! Level setup: what every searchable fixture of the 10 open stores holds. Port of `game/store/levelgen.ts`.
//!
//! Rules (tests enforce them):
//!  - exactly ONE package in each of the 6 target stores;
//!  - power-up shops hold only power-ups or nothing (never traps, never packages);
//!  - Black Friday: every non-package fixture (targets and shops) holds a power-up;
//!  - the same seed always generates the same level (each store draws from its own `rng.fork`).
//!
//! Normal mode, target stores: ~28% of the other fixtures are power-ups, ~28% (+4% per loop, capped at
//! 50%) are traps and the rest are empty, with at most 3 traps per store. Power-up shops: ~75% power-ups
//! and at least 2 of them. Food power-ups mostly come from Hot Spy on a Stick (brief section 7).

use crate::content::powerups::{PowerId, FOOD_POWERS, NON_FOOD_POWERS};
use crate::content::stores::{open_stores, StoreDef, StoreId, StoreRole};
use crate::engine::rng::Rng;
use crate::game::levelstate::{FixtureContent, FixtureState, LevelState, StoreState};

use super::room::fixture_count;

pub const MAX_TRAPS_PER_STORE: i32 = 3;
pub const MIN_POWERUPS_PER_SHOP: i32 = 2;

/// Relative weights of each power-up. Food is rare everywhere except Hot Spy on a Stick.
pub fn power_weights(store_id: StoreId) -> Vec<(PowerId, f64)> {
    let food_weight = if store_id == StoreId::Hotspy { 7.0 } else { 0.5 };
    let mut weights: Vec<(PowerId, f64)> = Vec::new();
    for id in NON_FOOD_POWERS {
        let w = if id == PowerId::Oneup {
            1.0
        } else if id == PowerId::Radar {
            2.0
        } else {
            3.0
        };
        weights.push((id, w));
    }
    for id in FOOD_POWERS {
        weights.push((id, food_weight));
    }
    weights
}

pub fn pick_power(rng: &mut Rng, store_id: StoreId) -> PowerId {
    let weights = power_weights(store_id);
    let mut total = 0.0;
    for (_, w) in &weights {
        total += *w;
    }
    let mut roll = rng.next() * total;
    for (id, w) in &weights {
        roll -= *w;
        if roll < 0.0 {
            return *id;
        }
    }
    weights[weights.len() - 1].0
}

fn power_content(rng: &mut Rng, store_id: StoreId) -> FixtureContent {
    FixtureContent::Powerup(pick_power(rng, store_id))
}

/// Contents of one store's fixtures, in the room's fixture (reading) order.
pub fn store_contents(def: &StoreDef, rng: &mut Rng, loop_: i32, black_friday: bool) -> Vec<FixtureContent> {
    let n = fixture_count(def.id) as i32;
    let mut out: Vec<FixtureContent> = Vec::new();
    if def.role == StoreRole::Powerup {
        for _ in 0..n {
            out.push(if black_friday || rng.chance(0.75) { power_content(rng, def.id) } else { FixtureContent::Nothing });
        }
        // a shop with fewer than MIN_POWERUPS_PER_SHOP power-ups would be pointless: top it up
        let mut have = out.iter().filter(|c| matches!(c, FixtureContent::Powerup(_))).count() as i32;
        let mut i = 0;
        while i < n && have < MIN_POWERUPS_PER_SHOP {
            if !matches!(out[i as usize], FixtureContent::Powerup(_)) {
                out[i as usize] = power_content(rng, def.id);
                have += 1;
            }
            i += 1;
        }
        return out;
    }
    // target store: one package, the rest power-ups / traps / nothing
    let package_at = rng.int(n);
    let trap_p = 0.5f64.min(0.28 + 0.04 * 0.max(loop_ - 1) as f64);
    let mut traps = 0;
    for i in 0..n {
        if i == package_at {
            out.push(FixtureContent::Package);
            continue;
        }
        if black_friday {
            out.push(power_content(rng, def.id));
            continue;
        }
        let roll = rng.next();
        if roll < 0.28 {
            out.push(power_content(rng, def.id));
        } else if roll < 0.28 + trap_p && traps < MAX_TRAPS_PER_STORE {
            traps += 1;
            out.push(FixtureContent::Trap);
        } else {
            out.push(FixtureContent::Nothing);
        }
    }
    out
}

/// Generate the store contents of a whole level. Deterministic in (rng state, loop, blackFriday).
/// Advances `rng` by one step, so calling it again with the same Rng object gives the next level.
pub fn generate_level(rng: &mut Rng, loop_: i32, black_friday: bool) -> LevelState {
    let seed = rng.state();
    let base = rng.fork("level.stores");
    rng.next();
    let mut level = LevelState::new(seed, loop_, black_friday);
    for def in open_stores() {
        let mut store_rng = base.fork(&format!("store.{}", def.id.as_str()));
        let contents = store_contents(def, &mut store_rng, loop_, black_friday);
        level.set_store(
            def.id,
            StoreState {
                id: def.id,
                fixtures: contents.into_iter().map(|content| FixtureState { content, opened: false }).collect(),
                package_taken: false,
            },
        );
    }
    level
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::stores::{powerup_stores, target_stores, PACKAGES_TOTAL};
    use crate::game::levelstate::{can_enter_store, packages_taken, store_status, StoreStatus};
    use crate::game::store::room::get_room;

    fn seeds() -> Vec<u32> {
        (0..60u32).map(|i| i * 7919 + 1).collect()
    }

    #[test]
    fn creates_state_for_exactly_the_10_open_stores_one_fixture_entry_per_searchable_fixture() {
        let lvl = generate_level(&mut Rng::new(1), 1, false);
        let present: Vec<&str> = lvl.iter_stores().map(|s| s.id.as_str()).collect();
        let mut want: Vec<&str> = open_stores().iter().map(|s| s.id.as_str()).collect();
        let mut got = present.clone();
        got.sort();
        want.sort();
        assert_eq!(got, want);
        for s in open_stores() {
            let st = lvl.store(s.id).unwrap();
            assert_eq!(st.id, s.id);
            assert_eq!(st.fixtures.len(), get_room(s.id).fixtures.len());
            assert!(!st.package_taken);
            assert!(st.fixtures.iter().all(|f| !f.opened));
        }
        assert_eq!(lvl.loop_, 1);
        assert!(!lvl.black_friday);
        assert_eq!(packages_taken(&lvl), 0);
    }

    #[test]
    fn puts_exactly_one_package_in_each_of_the_6_target_stores_for_many_seeds_and_loops() {
        assert_eq!(PACKAGES_TOTAL, 6);
        for seed in seeds() {
            for (loop_, bf) in [(1, false), (3, false), (1, true)] {
                let lvl = generate_level(&mut Rng::new(seed), loop_, bf);
                for s in target_stores() {
                    let n = lvl.store(s.id).unwrap().fixtures.iter().filter(|f| f.content == FixtureContent::Package).count();
                    assert_eq!(n, 1, "{} seed {}", s.id.as_str(), seed);
                }
            }
        }
    }

    #[test]
    fn power_up_shops_never_hold_packages_or_traps_only_power_ups_or_nothing() {
        for seed in seeds() {
            for bf in [false, true] {
                let lvl = generate_level(&mut Rng::new(seed), 1 + (seed % 5) as i32, bf);
                for s in powerup_stores() {
                    let kinds: Vec<FixtureContent> = lvl.store(s.id).unwrap().fixtures.iter().map(|f| f.content).collect();
                    assert!(
                        kinds.iter().all(|k| matches!(k, FixtureContent::Powerup(_) | FixtureContent::Nothing)),
                        "{} seed {}",
                        s.id.as_str(),
                        seed
                    );
                    assert!(kinds.iter().filter(|k| matches!(k, FixtureContent::Powerup(_))).count() as i32 >= MIN_POWERUPS_PER_SHOP);
                }
            }
        }
    }

    #[test]
    fn never_hides_a_package_in_a_power_up_shop() {
        for seed in seeds() {
            let lvl = generate_level(&mut Rng::new(seed), 1, false);
            for s in powerup_stores() {
                assert!(!lvl.store(s.id).unwrap().fixtures.iter().any(|f| f.content == FixtureContent::Package));
            }
        }
    }

    #[test]
    fn black_friday_every_non_package_fixture_in_every_store_holds_a_power_up() {
        for seed in seeds() {
            let lvl = generate_level(&mut Rng::new(seed), 1, true);
            assert!(lvl.black_friday);
            for s in open_stores() {
                for f in &lvl.store(s.id).unwrap().fixtures {
                    assert!(matches!(f.content, FixtureContent::Package | FixtureContent::Powerup(_)), "{} seed {}", s.id.as_str(), seed);
                }
            }
        }
    }

    #[test]
    fn normal_mode_mixes_power_ups_traps_and_empty_fixtures_in_the_target_stores_with_a_cap_on_traps() {
        let mut seen: Vec<&'static str> = Vec::new();
        for seed in seeds() {
            let lvl = generate_level(&mut Rng::new(seed), 4, false);
            for s in target_stores() {
                let fx = &lvl.store(s.id).unwrap().fixtures;
                for f in fx {
                    let k = f.content.kind_str();
                    if !seen.contains(&k) {
                        seen.push(k);
                    }
                }
                assert!(fx.iter().filter(|f| f.content == FixtureContent::Trap).count() as i32 <= MAX_TRAPS_PER_STORE);
            }
        }
        seen.sort();
        assert_eq!(seen, vec!["nothing", "package", "powerup", "trap"]);
    }

    #[test]
    fn a_given_seed_always_generates_the_same_level_different_seeds_differ_the_rng_advances() {
        let a = generate_level(&mut Rng::new(42), 1, false);
        let b = generate_level(&mut Rng::new(42), 1, false);
        assert_eq!(a, b);
        let c = generate_level(&mut Rng::new(43), 1, false);
        assert_ne!(c, a);
        let mut rng = Rng::new(42);
        let first = generate_level(&mut rng, 1, false);
        let second = generate_level(&mut rng, 1, false);
        assert_eq!(first, a);
        assert_ne!(second.stores, first.stores);
    }

    #[test]
    fn food_power_ups_mostly_come_from_hot_spy_on_a_stick() {
        let (mut hot, mut hot_total, mut other, mut other_total) = (0, 0, 0, 0);
        for seed in seeds() {
            let lvl = generate_level(&mut Rng::new(seed), 1, true);
            for s in open_stores() {
                for f in &lvl.store(s.id).unwrap().fixtures {
                    let power = match f.content {
                        FixtureContent::Powerup(p) => p,
                        _ => continue,
                    };
                    let food = FOOD_POWERS.contains(&power);
                    if s.id == StoreId::Hotspy {
                        hot_total += 1;
                        if food {
                            hot += 1;
                        }
                    } else {
                        other_total += 1;
                        if food {
                            other += 1;
                        }
                    }
                }
            }
        }
        assert!(hot as f64 / hot_total as f64 > 0.45);
        assert!((other as f64 / other_total as f64) < 0.15);
    }

    #[test]
    fn pick_power_is_deterministic_and_returns_real_power_ups() {
        let mut a = Rng::new(5);
        let mut b = Rng::new(5);
        for _ in 0..50 {
            assert_eq!(pick_power(&mut a, StoreId::Crookstone), pick_power(&mut b, StoreId::Crookstone));
        }
    }

    #[test]
    fn level_status_helpers_see_the_generated_state_cleared_target_stores_cannot_be_entered() {
        let mut lvl = generate_level(&mut Rng::new(9), 1, false);
        assert_eq!(store_status(&lvl, StoreId::Kgbtoys), StoreStatus::Package);
        assert!(can_enter_store(&lvl, StoreId::Kgbtoys));
        lvl.store_mut(StoreId::Kgbtoys).unwrap().package_taken = true;
        assert_eq!(store_status(&lvl, StoreId::Kgbtoys), StoreStatus::Cleared);
        assert!(!can_enter_store(&lvl, StoreId::Kgbtoys));
        assert!(can_enter_store(&lvl, StoreId::Crookstone));
        assert!(!can_enter_store(&lvl, StoreId::Blockbluster));
    }
}
