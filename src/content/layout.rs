//! Mall geometry (pure data). World pixels; x grows right, y grows DOWN.
//! Floor index: 0 = R (roof), 1 = 4F, 2 = 3F, 3 = 2F, 4 = 1F, 5 = P (parking).
use super::stores::{StoreDef, STORES};

pub use super::stores::STORE_W;

pub const LEVEL_W: f64 = 768.0;
pub const NUM_FLOORS: i32 = 6;
pub const FLOOR_GAP: f64 = 48.0;
pub const ROOF_Y: f64 = 112.0;
pub const SLAB_H: f64 = 8.0;
/// Clearance between a floor's walking surface and the ceiling above it (the slab underside of the floor above).
pub const CEILING_GAP: f64 = FLOOR_GAP - SLAB_H; // 40
/// ground below P
pub const LEVEL_H: f64 = ROOF_Y + (NUM_FLOORS as f64 - 1.0) * FLOOR_GAP + 48.0;
pub const FLOOR_NAMES: [&str; 6] = ["R", "4F", "3F", "2F", "1F", "P"];
pub const WALL_L: f64 = 8.0;
pub const WALL_R: f64 = LEVEL_W - 8.0;

/// Walking-surface y of a floor (the agent's feet y when standing on it).
pub fn floor_y(f: f64) -> f64 {
    ROOF_Y + f * FLOOR_GAP
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ShaftId {
    A,
    B,
    C,
}

impl ShaftId {
    pub const ALL: [ShaftId; 3] = [ShaftId::A, ShaftId::B, ShaftId::C];
    pub const fn as_str(self) -> &'static str {
        match self {
            ShaftId::A => "A",
            ShaftId::B => "B",
            ShaftId::C => "C",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct ShaftDef {
    pub id: ShaftId,
    /// Left edge of the 24 px opening.
    pub x: f64,
    pub w: f64,
    /// Topmost / bottommost floor index served.
    pub top: i32,
    pub bottom: i32,
    /// true = driven by the player; false = automatic timer.
    pub manual: bool,
}

pub const CAR_W: f64 = 24.0;
pub const CAR_H: f64 = 32.0;

pub const SHAFTS: [ShaftDef; 3] = [
    ShaftDef { id: ShaftId::A, x: 168.0, w: CAR_W, top: 0, bottom: 3, manual: true }, // R .. 2F
    ShaftDef { id: ShaftId::B, x: 392.0, w: CAR_W, top: 1, bottom: 5, manual: true }, // 4F .. P (the only way to P)
    ShaftDef { id: ShaftId::C, x: 600.0, w: CAR_W, top: 0, bottom: 4, manual: false }, // R .. 1F, automatic
];

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EscalatorId {
    E1,
    E2,
}

impl EscalatorId {
    pub const fn as_str(self) -> &'static str {
        match self {
            EscalatorId::E1 => "E1",
            EscalatorId::E2 => "E2",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct EscalatorDef {
    pub id: EscalatorId,
    /// Upper (higher) and lower floor indices (upper < lower numerically).
    pub upper: i32,
    pub lower: i32,
    /// x of the bottom landing (on the lower floor) and the top landing (on the upper floor).
    pub x_low: f64,
    pub x_high: f64,
}

pub const ESCALATORS: [EscalatorDef; 2] = [
    EscalatorDef { id: EscalatorId::E1, upper: 1, lower: 2, x_low: 528.0, x_high: 576.0 }, // 3F <-> 4F, ascends to the right
    EscalatorDef { id: EscalatorId::E2, upper: 3, lower: 4, x_low: 688.0, x_high: 640.0 }, // 1F <-> 2F, ascends to the left
];

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FeatureKind {
    Kiosk,
    Booth,
    Fountain,
    Bench,
    Plant,
    Pillar,
    Wagon,
    Post,
    Ac,
    Pigeon,
}

impl FeatureKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            FeatureKind::Kiosk => "kiosk",
            FeatureKind::Booth => "booth",
            FeatureKind::Fountain => "fountain",
            FeatureKind::Bench => "bench",
            FeatureKind::Plant => "plant",
            FeatureKind::Pillar => "pillar",
            FeatureKind::Wagon => "wagon",
            FeatureKind::Post => "post",
            FeatureKind::Ac => "ac",
            FeatureKind::Pigeon => "pigeon",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Feature {
    pub kind: FeatureKind,
    pub floor: i32,
    /// Left edge.
    pub x: f64,
    pub w: f64,
}

/// Order matches the TS array (roof, 4F, 3F, 2F, 1F, parking; draw order may depend on it).
pub const FEATURES: &[Feature] = &[
    Feature { kind: FeatureKind::Post, floor: 0, x: 96.0, w: 8.0 },
    Feature { kind: FeatureKind::Ac, floor: 0, x: 236.0, w: 24.0 },
    Feature { kind: FeatureKind::Ac, floor: 0, x: 420.0, w: 24.0 },
    Feature { kind: FeatureKind::Pigeon, floor: 0, x: 340.0, w: 8.0 },
    Feature { kind: FeatureKind::Pigeon, floor: 0, x: 520.0, w: 8.0 },
    Feature { kind: FeatureKind::Ac, floor: 0, x: 700.0, w: 24.0 },
    Feature { kind: FeatureKind::Plant, floor: 1, x: 120.0, w: 16.0 },
    Feature { kind: FeatureKind::Kiosk, floor: 1, x: 300.0, w: 24.0 },
    Feature { kind: FeatureKind::Bench, floor: 1, x: 336.0, w: 24.0 },
    Feature { kind: FeatureKind::Booth, floor: 2, x: 120.0, w: 24.0 },
    Feature { kind: FeatureKind::Fountain, floor: 2, x: 312.0, w: 40.0 },
    Feature { kind: FeatureKind::Bench, floor: 2, x: 362.0, w: 24.0 },
    Feature { kind: FeatureKind::Kiosk, floor: 2, x: 650.0, w: 24.0 },
    Feature { kind: FeatureKind::Plant, floor: 2, x: 700.0, w: 16.0 },
    Feature { kind: FeatureKind::Bench, floor: 3, x: 120.0, w: 24.0 },
    Feature { kind: FeatureKind::Plant, floor: 3, x: 500.0, w: 16.0 },
    Feature { kind: FeatureKind::Kiosk, floor: 3, x: 720.0, w: 24.0 },
    Feature { kind: FeatureKind::Kiosk, floor: 4, x: 136.0, w: 24.0 },
    Feature { kind: FeatureKind::Fountain, floor: 4, x: 330.0, w: 40.0 },
    Feature { kind: FeatureKind::Bench, floor: 4, x: 460.0, w: 24.0 },
    Feature { kind: FeatureKind::Plant, floor: 4, x: 520.0, w: 16.0 },
    Feature { kind: FeatureKind::Pillar, floor: 5, x: 90.0, w: 16.0 },
    Feature { kind: FeatureKind::Pillar, floor: 5, x: 200.0, w: 16.0 },
    Feature { kind: FeatureKind::Pillar, floor: 5, x: 480.0, w: 16.0 },
    Feature { kind: FeatureKind::Pillar, floor: 5, x: 560.0, w: 16.0 },
    Feature { kind: FeatureKind::Pillar, floor: 5, x: 680.0, w: 16.0 },
    Feature { kind: FeatureKind::Wagon, floor: 5, x: 250.0, w: 72.0 },
];

/// Hanging lamps (disco balls on 2F = floor 3): centre x per floor. Never over store signs.
/// Floors without lamps are absent; use `lamps(floor)`.
pub const LAMPS: [(i32, &[f64]); 4] = [
    (1, &[152.0, 374.0, 744.0]),
    (2, &[156.0, 296.0, 744.0]),
    (3, &[156.0, 556.0, 700.0]),
    (4, &[190.0, 320.0, 500.0, 740.0]),
];
pub const LAMP_HALF_W: f64 = 6.0;

/// Lamp centre xs on a floor (empty slice if none).
pub fn lamps(floor: i32) -> &'static [f64] {
    for (f, xs) in LAMPS.iter() {
        if *f == floor {
            return xs;
        }
    }
    &[]
}

pub struct Arrival {
    /// Skyscraper at the left edge of the sky; the cable runs from its roof edge to the anchor post.
    pub cable_start_x: f64,
    pub cable_start_y: f64,
    pub post_x: f64,
    pub post_top_y: f64,
    /// The agent lets go near this x and drops onto the roof.
    pub let_go_x: f64,
}

pub const ARRIVAL: Arrival = Arrival {
    cable_start_x: 36.0,
    cable_start_y: ROOF_Y - 90.0,
    post_x: 100.0,
    post_top_y: ROOF_Y - 14.0,
    let_go_x: 88.0,
};

pub struct Wagon {
    pub x: f64,
    pub w: f64,
}

/// Getaway station wagon drive-up trigger: stand within this x range on P and press Up.
pub const WAGON: Wagon = Wagon { x: 250.0, w: 72.0 };

pub fn features_on_floor(floor: i32) -> Vec<Feature> {
    FEATURES.iter().copied().filter(|f| f.floor == floor).collect()
}

pub fn shafts_on_floor(floor: i32) -> Vec<ShaftDef> {
    SHAFTS.iter().copied().filter(|s| floor >= s.top && floor <= s.bottom).collect()
}

/// Stores on a floor sorted by x (stable).
pub fn stores_on_floor(floor: i32) -> Vec<&'static StoreDef> {
    let mut v: Vec<&'static StoreDef> = STORES.iter().filter(|s| s.floor == floor).collect();
    v.sort_by(|a, b| a.x.partial_cmp(&b.x).unwrap());
    v
}

/// Floors reachable from `start` using shafts and escalators (floor graph), in discovery (BFS) order.
pub fn reachable_floors(start: i32) -> Vec<i32> {
    let mut seen: Vec<i32> = vec![start];
    let mut queue: std::collections::VecDeque<i32> = std::collections::VecDeque::new();
    queue.push_back(start);
    while let Some(f) = queue.pop_front() {
        let mut next: Vec<i32> = Vec::new();
        for s in SHAFTS.iter() {
            if f >= s.top && f <= s.bottom {
                for g in s.top..=s.bottom {
                    next.push(g);
                }
            }
        }
        for e in ESCALATORS.iter() {
            if f == e.upper {
                next.push(e.lower);
            }
            if f == e.lower {
                next.push(e.upper);
            }
        }
        for g in next {
            if !seen.contains(&g) {
                seen.push(g);
                queue.push_back(g);
            }
        }
    }
    seen
}
