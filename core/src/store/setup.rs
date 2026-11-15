//! Level setup: what every fixture of every open store holds. Deterministic from `run.rng`; call once per
//! level (the rooms read `run.fixtures` and fill a missing store lazily as a safety net).

use crate::run::RunState;
use crate::types::{Content, PowerUp, StoreId, StoreRole};

use super::templates::template;

/// Fill `run.fixtures` for every open store.
///
/// * Target store: exactly ONE package; a few traps and power-ups; everything else is empty.
/// * Power shop: only power-ups or nothing, never a trap, never a package; at least two (different) power-ups.
/// * Hot Spy on a Stick favours food power-ups.
/// * Black Friday: every non-package fixture holds a power-up.
pub fn setup_level(run: &mut RunState) {
    for id in StoreId::ALL {
        if id.is_open() {
            fill_store(run, id);
        }
    }
}

/// (Re)fill one store. Used by `setup_level` and as a lazy fallback by `StoreRoom::new`.
pub fn fill_store(run: &mut RunState, id: StoreId) {
    let n = template(id).fixtures.len();
    let mut slots: Vec<usize> = (0..n).collect();
    run.rng.shuffle(&mut slots);
    let mut contents = vec![Content::Nothing; n];
    let black_friday = run.black_friday;

    match id.role() {
        StoreRole::Target => {
            let mut it = slots.into_iter();
            contents[it.next().unwrap()] = Content::Package;
            let rest: Vec<usize> = it.collect();
            if black_friday {
                for i in rest {
                    contents[i] = Content::PowerUp(pick_powerup(run, id, &[]));
                }
            } else {
                // 1-2 traps, 1-2 power-ups, the rest nothing.
                let traps = 1 + run.rng.below(2) as usize;
                let ups = 1 + run.rng.below(2) as usize;
                let mut used = Vec::new();
                for (k, i) in rest.into_iter().enumerate() {
                    if k < traps {
                        contents[i] = Content::Trap;
                    } else if k < traps + ups {
                        let p = pick_powerup(run, id, &used);
                        used.push(p);
                        contents[i] = Content::PowerUp(p);
                    }
                }
            }
        }
        StoreRole::PowerShop => {
            let mut used: Vec<PowerUp> = Vec::new();
            for (k, i) in slots.into_iter().enumerate() {
                // The first two slots are always (different) power-ups; the rest is a coin flip.
                if k < 2 || black_friday || run.rng.chance(0.55) {
                    let p = pick_powerup(run, id, &used);
                    used.push(p);
                    contents[i] = Content::PowerUp(p);
                }
            }
        }
        StoreRole::Closed => {}
    }
    run.fixtures.insert(id, contents);
}

/// A power-up not already in `avoid` (when possible). Hot Spy on a Stick leans towards food. 1-Up is rare.
fn pick_powerup(run: &mut RunState, id: StoreId, avoid: &[PowerUp]) -> PowerUp {
    for _ in 0..32 {
        let p = if id == StoreId::HotSpyOnAStick && run.rng.chance(0.75) {
            const FOOD: [PowerUp; 3] = [PowerUp::Cinnabomb, PowerUp::OrangeJuliOoze, PowerUp::SoftPretzel];
            *run.rng.pick(&FOOD)
        } else {
            *run.rng.pick(&PowerUp::ALL)
        };
        if p == PowerUp::OneUp && !run.rng.chance(0.3) {
            continue;
        }
        if !avoid.contains(&p) {
            return p;
        }
    }
    // Everything already used: fall back to anything not equal to the last one.
    *PowerUp::ALL.iter().find(|p| !avoid.contains(p)).unwrap_or(&PowerUp::RapidFire)
}
