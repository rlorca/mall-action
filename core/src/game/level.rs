//! Mall geometry and level setup. Floors are numbered P=0, 1F..4F = 1..4, R=5.
use crate::rng::Rng;
use crate::stores::{self, Role, StoreId, ALL_STORES};

pub const WORLD_W: i32 = 768;
pub const WORLD_H: i32 = 384;
pub const FLOOR_GAP: i32 = 48;
pub const ROOF_Y: i32 = 128;
pub const CLEAR_H: i32 = 40;
pub const FLOOR_R: u8 = 5;
pub const FLOOR_P: u8 = 0;
pub const VIEW_W: i32 = 256;
pub const VIEW_H: i32 = 224;
pub const HUD_H: i32 = 16;
pub const WALL_L: i32 = 10;
pub const WALL_R: i32 = 758;

/// Walking line (feet y) of a floor.
pub fn floor_y(f: u8) -> i32 {
    ROOF_Y + (FLOOR_R as i32 - f as i32) * FLOOR_GAP
}
pub fn floor_name(f: u8) -> &'static str {
    ["P", "1F", "2F", "3F", "4F", "R"][f as usize]
}

#[derive(Clone, Copy, Debug)]
pub struct ShaftDef {
    pub name: char,
    /// Left edge x; the shaft is 32 wide.
    pub x: i32,
    pub top: u8,
    pub bottom: u8,
    pub manual: bool,
}
pub const SHAFT_W: i32 = 32;
pub const SHAFTS: [ShaftDef; 3] = [
    ShaftDef { name: 'A', x: 16, top: 5, bottom: 2, manual: true },
    ShaftDef { name: 'B', x: 368, top: 4, bottom: 0, manual: true },
    ShaftDef { name: 'C', x: 720, top: 5, bottom: 1, manual: false },
];
impl ShaftDef {
    pub fn serves(&self, f: u8) -> bool {
        f <= self.top && f >= self.bottom
    }
    pub fn cx(&self) -> i32 {
        self.x + SHAFT_W / 2
    }
}

#[derive(Clone, Copy, Debug)]
pub struct EscDef {
    pub low: u8,
    /// x of the bottom landing; rises to the right by 48 px.
    pub x_low: i32,
}
pub const ESC_RUN: i32 = 48;
pub const ESCALATORS: [EscDef; 2] = [EscDef { low: 3, x_low: 432 }, EscDef { low: 1, x_low: 224 }];
impl EscDef {
    pub fn x_high(&self) -> i32 {
        self.x_low + ESC_RUN
    }
    pub fn high(&self) -> u8 {
        self.low + 1
    }
}

#[derive(Clone, Copy, Debug)]
pub struct StoreSlot {
    pub id: StoreId,
    pub x: i32,
    pub floor: u8,
}
pub const STORE_W: i32 = 80;
impl StoreSlot {
    pub fn door_x(&self) -> i32 {
        self.x + STORE_W / 2
    }
}
pub const STORE_SLOTS: [StoreSlot; 13] = [
    StoreSlot { id: StoreId::Forever12, x: 64, floor: 4 },
    StoreSlot { id: StoreId::RadioShock, x: 160, floor: 4 },
    StoreSlot { id: StoreId::Crookstone, x: 512, floor: 4 },
    StoreSlot { id: StoreId::GameStonk, x: 608, floor: 4 },
    StoreSlot { id: StoreId::KgbToys, x: 64, floor: 3 },
    StoreSlot { id: StoreId::BlockBlusterVideo, x: 280, floor: 3 },
    StoreSlot { id: StoreId::SpendersGifts, x: 520, floor: 3 },
    StoreSlot { id: StoreId::SamBaddy, x: 64, floor: 2 },
    StoreSlot { id: StoreId::SharperImagine, x: 152, floor: 2 },
    StoreSlot { id: StoreId::HotSpyOnAStick, x: 416, floor: 2 },
    StoreSlot { id: StoreId::CircuitPity, x: 512, floor: 2 },
    StoreSlot { id: StoreId::FootLockpicker, x: 64, floor: 1 },
    StoreSlot { id: StoreId::BorderlineBooks, x: 416, floor: 1 },
];
pub fn slot(id: StoreId) -> &'static StoreSlot {
    STORE_SLOTS.iter().find(|s| s.id == id).unwrap()
}

/// Furniture (centre x per floor).
pub const KIOSKS: [(u8, i32); 4] = [(4, 292), (3, 256), (2, 312), (1, 352)];
pub const PHOTO_BOOTH: (u8, i32) = (3, 172);
pub const FOUNTAINS: [(u8, i32); 2] = [(3, 216), (1, 312)];
pub const BENCHES: [(u8, i32); 5] = [(4, 436), (3, 636), (2, 640), (1, 560), (4, 350)];
pub const PLANTS: [(u8, i32); 8] = [(4, 56), (4, 704), (3, 612), (3, 700), (2, 56), (2, 600), (1, 52), (1, 620)];
pub const PILLARS: [i32; 6] = [100, 200, 300, 470, 640, 700];
pub const WAGON_X: i32 = 540;
pub const WAGON_W: i32 = 56;
pub const ANCHOR_X: i32 = 150;
pub const SKY_TOP_X: i32 = 60;

/// Lamp hanging x per floor (ceiling lamps; 2F has disco balls). Never inside store sign spans.
pub const LAMPS: [(u8, i32); 17] = [
    (4, 264),
    (4, 330),
    (4, 440),
    (4, 490),
    (4, 704),
    (3, 188),
    (3, 250),
    (3, 410),
    (3, 506),
    (3, 640),
    (3, 690),
    (2, 268),
    (2, 340),
    (2, 620),
    (2, 680),
    (1, 200),
    (1, 600),
];

pub fn shaft(i: usize) -> &'static ShaftDef {
    &SHAFTS[i]
}

/// All floors connected by shafts and escalators: can a floor be reached from the roof?
pub fn reachable_floors() -> [bool; 6] {
    let mut seen = [false; 6];
    seen[FLOOR_R as usize] = true;
    let mut changed = true;
    while changed {
        changed = false;
        for f in 0..6u8 {
            if !seen[f as usize] {
                continue;
            }
            for s in SHAFTS.iter().filter(|s| s.serves(f)) {
                for g in s.bottom..=s.top {
                    if !seen[g as usize] {
                        seen[g as usize] = true;
                        changed = true;
                    }
                }
            }
            for e in ESCALATORS.iter() {
                for (a, b) in [(e.low, e.high()), (e.high(), e.low)] {
                    if a == f && !seen[b as usize] {
                        seen[b as usize] = true;
                        changed = true;
                    }
                }
            }
        }
    }
    seen
}

/// What a searchable fixture holds.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Content {
    Nothing,
    Package,
    Trap,
    Power(crate::game::powerups::PowerKind),
}

/// Per-level, per-store state: fixture contents decided at level start (seeded), opened flags persist.
#[derive(Clone, Debug)]
pub struct StoreState {
    pub id: StoreId,
    pub contents: Vec<Content>,
    pub opened: Vec<bool>,
    pub package_taken: bool,
    pub visited: bool,
    /// Fitting rooms / special fixtures whose one-off surprise already happened.
    pub revealed: Vec<bool>,
}

impl StoreState {
    pub fn role(&self) -> Role {
        stores::info(self.id).role
    }
    pub fn open_for_entry(&self) -> bool {
        match self.role() {
            Role::Closed => false,
            Role::Target => !self.package_taken,
            Role::PowerUp => true,
        }
    }
}

/// Decide fixture contents for every store.
/// * each target store has exactly one package
/// * power-up shops hold only power-ups or nothing (never traps, never packages)
/// * Black Friday: every non-package fixture holds a power-up
pub fn setup_stores(rng: &mut Rng, black_friday: bool) -> Vec<StoreState> {
    use crate::game::powerups::PowerKind;
    let mut v = Vec::new();
    for id in ALL_STORES {
        let n = crate::game::rooms::fixture_count(id);
        let role = stores::info(id).role;
        let mut contents = vec![Content::Nothing; n];
        if n > 0 {
            match role {
                Role::Closed => {}
                Role::Target => {
                    let pk = rng.index(n);
                    for (i, c) in contents.iter_mut().enumerate() {
                        *c = if i == pk {
                            Content::Package
                        } else if black_friday {
                            Content::Power(PowerKind::random_pickup(rng, id))
                        } else {
                            match rng.range(0, 100) {
                                0..=24 => Content::Trap,
                                25..=49 => Content::Power(PowerKind::random_pickup(rng, id)),
                                _ => Content::Nothing,
                            }
                        };
                    }
                }
                Role::PowerUp => {
                    for c in contents.iter_mut() {
                        *c = if black_friday || rng.chance(55) {
                            Content::Power(PowerKind::random_pickup(rng, id))
                        } else {
                            Content::Nothing
                        };
                    }
                }
            }
        }
        v.push(StoreState { id, contents, opened: vec![false; n], package_taken: false, visited: false, revealed: vec![false; n] });
    }
    v
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stores::Role;

    #[test]
    fn every_floor_reachable_from_roof() {
        assert!(reachable_floors().iter().all(|b| *b));
    }
    #[test]
    fn parking_only_via_shaft_b() {
        for s in SHAFTS.iter() {
            assert_eq!(s.serves(0), s.name == 'B');
        }
        for e in ESCALATORS.iter() {
            assert!(e.low > 0);
        }
    }
    #[test]
    fn floors_are_48_apart() {
        for f in 0..5u8 {
            assert_eq!(floor_y(f) - floor_y(f + 1), 48);
        }
    }
    #[test]
    fn exactly_one_package_per_target_store_and_six_total() {
        for bf in [false, true] {
            for seed in 0..30 {
                let st = setup_stores(&mut Rng::new(seed), bf);
                let mut total = 0;
                for s in &st {
                    let pk = s.contents.iter().filter(|c| **c == Content::Package).count();
                    match s.role() {
                        Role::Target => assert_eq!(pk, 1),
                        _ => assert_eq!(pk, 0),
                    }
                    total += pk;
                }
                assert_eq!(total, 6);
            }
        }
    }
    #[test]
    fn powerup_shops_never_trapped() {
        for seed in 0..50 {
            for s in setup_stores(&mut Rng::new(seed), false) {
                if s.role() == Role::PowerUp {
                    assert!(s.contents.iter().all(|c| !matches!(c, Content::Trap | Content::Package)));
                }
            }
        }
    }
    #[test]
    fn black_friday_fixtures_are_all_powerups_except_package() {
        for seed in 0..20 {
            for s in setup_stores(&mut Rng::new(seed), true) {
                if s.role() == Role::Closed {
                    continue;
                }
                for c in &s.contents {
                    assert!(matches!(c, Content::Package | Content::Power(_)), "{:?} {:?}", s.id, c);
                }
            }
        }
    }
    #[test]
    fn stores_fit_and_do_not_overlap_shafts_or_escalators() {
        for s in STORE_SLOTS.iter() {
            assert!(s.x >= 56 && s.x + STORE_W <= 720);
            for sh in SHAFTS.iter().filter(|sh| sh.serves(s.floor)) {
                assert!(s.x + STORE_W <= sh.x || s.x >= sh.x + SHAFT_W, "{:?}", s.id);
            }
            assert_eq!(stores::info(s.id).floor, s.floor);
        }
        // stores on one floor never overlap
        for a in STORE_SLOTS.iter() {
            for b in STORE_SLOTS.iter() {
                if a.id != b.id && a.floor == b.floor {
                    assert!(a.x + STORE_W <= b.x || b.x + STORE_W <= a.x);
                }
            }
        }
    }
    #[test]
    fn furniture_never_overlaps_stores_shafts_or_escalators() {
        let items: Vec<(&str, u8, i32, i32)> = KIOSKS
            .iter()
            .map(|(f, x)| ("kiosk", *f, *x, 12))
            .chain(std::iter::once(("booth", PHOTO_BOOTH.0, PHOTO_BOOTH.1, 12)))
            .chain(FOUNTAINS.iter().map(|(f, x)| ("fountain", *f, *x, 16)))
            .chain(BENCHES.iter().map(|(f, x)| ("bench", *f, *x, 12)))
            .chain(PLANTS.iter().map(|(f, x)| ("plant", *f, *x, 8)))
            .collect();
        for (name, f, x, half) in items {
            let (a, b) = (x - half, x + half);
            for s in STORE_SLOTS.iter().filter(|s| s.floor == f) {
                assert!(b <= s.x || a >= s.x + STORE_W, "{name} at {x} on {f} overlaps {:?}", s.id);
            }
            for sh in SHAFTS.iter().filter(|sh| sh.serves(f)) {
                assert!(b <= sh.x || a >= sh.x + SHAFT_W, "{name} at {x} on {f} overlaps shaft {}", sh.name);
            }
            for e in ESCALATORS.iter() {
                if e.low == f {
                    assert!(b <= e.x_low - 24 || a >= e.x_low + 12, "{name} at {x} blocks the bottom landing");
                }
                if e.high() == f {
                    assert!(b <= e.x_high() - 12 || a >= e.x_high() + 28, "{name} at {x} blocks the top landing");
                }
            }
        }
    }
    #[test]
    fn lamps_avoid_store_signs_and_shafts() {
        for (f, x) in LAMPS {
            for s in STORE_SLOTS.iter().filter(|s| s.floor == f) {
                assert!(x < s.x - 4 || x > s.x + STORE_W + 4, "lamp {x} on {f} hits sign {:?}", s.id);
            }
            for sh in SHAFTS.iter().filter(|sh| sh.serves(f)) {
                assert!(x < sh.x - 4 || x > sh.x + SHAFT_W + 4);
            }
        }
    }
}
