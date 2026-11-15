//! The mall's fixed floor plan: single source of truth for the side-scroller AND the map overlay.
//! World is 768 px wide; floors are 48 px apart; `x` is a left edge unless noted.

use crate::types::{Floor, StoreId, FLOOR_COUNT};

pub const WORLD_W: i32 = 768;
pub const FLOOR_GAP: i32 = 48;
/// World y of the roof floor surface (where feet stand).
pub const FLOOR0_Y: i32 = 88;
pub const STORE_W: i32 = 80;
pub const SHAFT_W: i32 = 24;
pub const ESC_W: i32 = 48;

pub fn floor_y(f: Floor) -> i32 {
    FLOOR0_Y + f.index() as i32 * FLOOR_GAP
}

/// Total world height (sky above the roof is included; the parking slab ends a little below P).
pub const WORLD_H: i32 = FLOOR0_Y + 5 * FLOOR_GAP + 24;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ShaftId {
    A,
    B,
    C,
}

pub struct Shaft {
    pub id: ShaftId,
    pub x: i32,
    /// Topmost and bottommost floors served (inclusive); every floor between is served.
    pub top: Floor,
    pub bottom: Floor,
    /// Player drives it (A, B) or it runs on a timer (C).
    pub manual: bool,
}

impl Shaft {
    pub fn serves(&self, f: Floor) -> bool {
        f.index() >= self.top.index() && f.index() <= self.bottom.index()
    }
    pub fn floors(&self) -> Vec<Floor> {
        Floor::ALL.iter().copied().filter(|f| self.serves(*f)).collect()
    }
    pub fn center_x(&self) -> i32 {
        self.x + SHAFT_W / 2
    }
}

pub const SHAFTS: [Shaft; 3] = [
    Shaft { id: ShaftId::A, x: 208, top: Floor::Roof, bottom: Floor::F2, manual: true },
    Shaft { id: ShaftId::B, x: 400, top: Floor::F4, bottom: Floor::Parking, manual: true },
    Shaft { id: ShaftId::C, x: 544, top: Floor::Roof, bottom: Floor::F1, manual: false },
];

pub fn shaft(id: ShaftId) -> &'static Shaft {
    SHAFTS.iter().find(|s| s.id == id).unwrap()
}

/// An escalator between `upper` and the floor below it. The bottom landing is at `x`, the top landing at
/// `x + ESC_W` (it climbs to the right). Up boards at the bottom landing, Down boards at the top landing.
pub struct Escalator {
    pub upper: Floor,
    pub x: i32,
}

impl Escalator {
    pub fn lower(&self) -> Floor {
        self.upper.below().unwrap()
    }
}

pub const ESCALATORS: [Escalator; 2] = [Escalator { upper: Floor::F4, x: 336 }, Escalator { upper: Floor::F2, x: 336 }];

pub struct StoreSlot {
    pub id: StoreId,
    pub x: i32,
}

pub const STORE_SLOTS: [StoreSlot; 13] = [
    StoreSlot { id: StoreId::Forever12, x: 24 },
    StoreSlot { id: StoreId::RadioShock, x: 112 },
    StoreSlot { id: StoreId::Crookstone, x: 248 },
    StoreSlot { id: StoreId::GameStonk, x: 448 },
    StoreSlot { id: StoreId::KgbToys, x: 24 },
    StoreSlot { id: StoreId::BlockblusterVideo, x: 248 },
    StoreSlot { id: StoreId::SpendersGifts, x: 448 },
    StoreSlot { id: StoreId::SamBaddy, x: 24 },
    StoreSlot { id: StoreId::SharperImagine, x: 112 },
    StoreSlot { id: StoreId::HotSpyOnAStick, x: 248 },
    StoreSlot { id: StoreId::CircuitPity, x: 448 },
    StoreSlot { id: StoreId::FootLockpicker, x: 112 },
    StoreSlot { id: StoreId::BorderlineBooks, x: 448 },
];

pub fn store_x(id: StoreId) -> i32 {
    STORE_SLOTS.iter().find(|s| s.id == id).unwrap().x
}

/// X of a store's door centre.
pub fn door_x(id: StoreId) -> i32 {
    store_x(id) + STORE_W / 2
}

pub fn stores_on(f: Floor) -> Vec<StoreId> {
    StoreId::ALL.iter().copied().filter(|s| s.info().floor == f).collect()
}

/// Directory kiosks (x centre) on each shopping floor.
pub const KIOSKS: [(Floor, i32); 4] = [(Floor::F4, 640), (Floor::F3, 600), (Floor::F2, 640), (Floor::F1, 40)];
pub const PHOTO_BOOTH: (Floor, i32) = (Floor::F3, 672);
pub const FOUNTAINS: [(Floor, i32); 2] = [(Floor::F3, 728), (Floor::F1, 656)];
/// Station wagon on P: left edge.
pub const CAR_X: i32 = 96;
pub const CAR_W: i32 = 56;
/// Roof anchor post for the zip line (x centre) and where the agent lands.
pub const ANCHOR_X: i32 = 72;

/// The span a floor's walkable corridor covers.
pub const WALL_L: i32 = 8;
pub const WALL_R: i32 = WORLD_W - 8;

/// Which floors can be reached from `from` using shafts and escalators (the "every floor can be reached" rule).
pub fn reachable_floors(from: Floor) -> Vec<Floor> {
    let mut seen = [false; FLOOR_COUNT];
    seen[from.index()] = true;
    let mut changed = true;
    while changed {
        changed = false;
        for f in Floor::ALL {
            if !seen[f.index()] {
                continue;
            }
            for s in SHAFTS.iter().filter(|s| s.serves(f)) {
                for g in s.floors() {
                    if !seen[g.index()] {
                        seen[g.index()] = true;
                        changed = true;
                    }
                }
            }
            for e in ESCALATORS.iter() {
                for (a, b) in [(e.upper, e.lower()), (e.lower(), e.upper)] {
                    if a == f && !seen[b.index()] {
                        seen[b.index()] = true;
                        changed = true;
                    }
                }
            }
        }
    }
    Floor::ALL.iter().copied().filter(|f| seen[f.index()]).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::StoreRole;

    #[test]
    fn every_floor_reachable_from_the_roof() {
        assert_eq!(reachable_floors(Floor::Roof).len(), FLOOR_COUNT);
        assert_eq!(reachable_floors(Floor::Parking).len(), FLOOR_COUNT);
    }

    #[test]
    fn parking_only_via_shaft_b() {
        for s in SHAFTS.iter() {
            assert_eq!(s.serves(Floor::Parking), s.id == ShaftId::B);
        }
        assert!(ESCALATORS.iter().all(|e| e.lower() != Floor::Parking));
    }

    #[test]
    fn not_every_shaft_reaches_every_floor() {
        for s in SHAFTS.iter() {
            assert!(s.floors().len() < FLOOR_COUNT);
        }
        assert_eq!(shaft(ShaftId::A).floors().len(), 4);
        assert_eq!(shaft(ShaftId::B).floors().len(), 5);
        assert_eq!(shaft(ShaftId::C).floors().len(), 5);
        assert!(!shaft(ShaftId::C).manual && shaft(ShaftId::A).manual && shaft(ShaftId::B).manual);
    }

    #[test]
    fn escalators_connect_3f_4f_and_1f_2f() {
        let pairs: Vec<_> = ESCALATORS.iter().map(|e| (e.upper, e.lower())).collect();
        assert!(pairs.contains(&(Floor::F4, Floor::F3)));
        assert!(pairs.contains(&(Floor::F2, Floor::F1)));
    }

    #[test]
    fn every_store_has_a_slot_on_its_own_floor_inside_the_world() {
        for st in StoreId::ALL {
            assert!(STORE_SLOTS.iter().filter(|s| s.id == st).count() == 1);
            let x = store_x(st);
            assert!(x >= WALL_L && x + STORE_W <= WALL_R);
        }
        assert_eq!(stores_on(Floor::F4).len(), 4);
        assert_eq!(stores_on(Floor::F3).len(), 3);
        assert_eq!(stores_on(Floor::F2).len(), 4);
        assert_eq!(stores_on(Floor::F1).len(), 2);
    }

    #[test]
    fn nothing_overlaps_on_a_floor() {
        for f in Floor::ALL {
            let mut spans: Vec<(i32, i32, String)> = Vec::new();
            for st in stores_on(f) {
                spans.push((store_x(st), store_x(st) + STORE_W, format!("{st:?}")));
            }
            for s in SHAFTS.iter().filter(|s| s.serves(f)) {
                spans.push((s.x, s.x + SHAFT_W, format!("{:?}", s.id)));
            }
            for e in ESCALATORS.iter().filter(|e| e.upper == f || e.lower() == f) {
                spans.push((e.x, e.x + ESC_W, "esc".into()));
            }
            for (i, a) in spans.iter().enumerate() {
                for b in spans.iter().skip(i + 1) {
                    assert!(a.1 <= b.0 || b.1 <= a.0, "{:?} overlaps {:?} on {:?}", a, b, f);
                }
            }
        }
    }

    #[test]
    fn six_target_stores_exist() {
        let n = StoreId::ALL.iter().filter(|s| s.role() == StoreRole::Target).count();
        assert_eq!(n, crate::types::PACKAGES_TOTAL as usize);
        assert_eq!(StoreId::ALL.iter().filter(|s| s.role() == StoreRole::PowerShop).count(), 4);
        assert_eq!(StoreId::ALL.iter().filter(|s| s.role() == StoreRole::Closed).count(), 3);
    }

    #[test]
    fn floor_y_spacing_is_48() {
        assert_eq!(floor_y(Floor::F4) - floor_y(Floor::Roof), 48);
        assert_eq!(floor_y(Floor::Parking) - floor_y(Floor::F1), 48);
        assert!(WORLD_H > floor_y(Floor::Parking));
    }
}
