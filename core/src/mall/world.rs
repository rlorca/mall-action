//! World geometry and pure queries (no state): vertical metrics, shaft openings, the floor "spans" that
//! decor and lamps are placed in, and a few helpers shared by the player, elevators and drawing.
//!
//! Vertical layout of floor `f` (world y, `sy = floor_y(f)` is the row the feet stand ON):
//! ```text
//!   sy-48 .. sy-44   ceiling slab (the floor surface of the floor above, SLAB px thick)
//!   sy-44 .. sy      corridor (CORRIDOR_H = FRONT_H = 44)
//!   sy    .. sy+4    floor slab (tiles); the roof has sky above, parking has a taller ground slab
//! ```

use crate::layout::{self, floor_y, ShaftId, ESCALATORS, ESC_W, FLOOR_GAP, SHAFTS, SHAFT_W, STORE_SLOTS, STORE_W, WALL_L, WALL_R};
use crate::pixel::Rect;
use crate::types::{Floor, StoreId, FLOOR_COUNT};

pub const CORRIDOR_H: i32 = 44;
pub const SLAB: i32 = FLOOR_GAP - CORRIDOR_H;
/// Elevator car sprite height; the car's `y` is its platform (feet level), its roof is `y - CAR_H`.
pub const CAR_H: i32 = 38;
pub const CAR_W: i32 = SHAFT_W;
/// Player hitbox (feet at `y`, centred on `x`).
pub const PLAYER_W: i32 = 8;
pub const PLAYER_H: i32 = 22;
pub const DUCK_H: i32 = 12;
/// Chest height above the feet where bullets leave / hit (standing) and the low height (ducking).
pub const CHEST_DY: i32 = 15;
pub const LOW_DY: i32 = 6;

/// What the opening of a shaft on a given floor looks like (spec 5.4).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Opening {
    /// The car is level with this floor: walk in.
    CarHere,
    /// The car is above: a grate you can stand on (and be crushed on).
    GrateAbove,
    /// The car is below: an open pit.
    PitBelow,
}

/// State of the opening of `shaft` on `floor` for a car whose platform is at world y `car_y`.
/// `None` when the shaft does not serve that floor (solid floor there).
pub fn opening_state(shaft: ShaftId, floor: Floor, car_y: i32) -> Option<Opening> {
    if !layout::shaft(shaft).serves(floor) {
        return None;
    }
    let fy = floor_y(floor);
    Some(if car_y == fy {
        Opening::CarHere
    } else if car_y < fy {
        Opening::GrateAbove
    } else {
        Opening::PitBelow
    })
}

pub fn ceiling_y(f: Floor) -> i32 {
    floor_y(f) - CORRIDOR_H
}

/// Index (into `SHAFTS`) of the shaft whose column contains world x.
pub fn shaft_index_at(x: i32) -> Option<usize> {
    SHAFTS.iter().position(|s| x >= s.x && x < s.x + SHAFT_W)
}

/// The nearest floor to a world y (feet line).
pub fn nearest_floor(y: i32) -> Floor {
    let mut best = Floor::Roof;
    let mut bd = i32::MAX;
    for f in Floor::ALL {
        let d = (floor_y(f) - y).abs();
        if d < bd {
            bd = d;
            best = f;
        }
    }
    best
}

/// The floor whose feet line is exactly `y`.
pub fn floor_at_y(y: i32) -> Option<Floor> {
    Floor::ALL.iter().copied().find(|f| floor_y(*f) == y)
}

/// Floors a car can stop at in a shaft, as world y values, top to bottom.
pub fn shaft_stops(id: ShaftId) -> Vec<i32> {
    layout::shaft(id).floors().into_iter().map(floor_y).collect()
}

pub fn rect(x: i32, y: i32, w: i32, h: i32) -> Rect {
    Rect::new(x, y, w, h)
}

/// Player hitbox for feet position (x, y).
pub fn player_box(x: i32, y: i32, ducking: bool) -> Rect {
    let h = if ducking { DUCK_H } else { PLAYER_H };
    Rect::new(x - PLAYER_W / 2, y - h, PLAYER_W, h)
}

// ---------------------------------------------------------------------------------------------------------
// Door / landing zones (x ranges, world px)
// ---------------------------------------------------------------------------------------------------------

/// Half width of a store door zone.
pub const DOOR_ZONE: i32 = 10;

pub fn at_store_door(id: StoreId, x: i32) -> bool {
    (x - layout::door_x(id)).abs() <= DOOR_ZONE
}

/// Boarding zone of a shaft opening ("in the opening").
pub fn in_opening_zone(shaft: ShaftId, x: i32) -> bool {
    let s = layout::shaft(shaft);
    x >= s.x && x < s.x + SHAFT_W
}

/// Call zone: the opening plus a margin beside it.
pub const CALL_MARGIN: i32 = 8;
pub fn in_call_zone(shaft: ShaftId, x: i32) -> bool {
    let s = layout::shaft(shaft);
    x >= s.x - CALL_MARGIN && x < s.x + SHAFT_W + CALL_MARGIN
}

/// Bottom landing of an escalator (boards Up) on the LOWER floor: `[x-8, x+8)`.
pub fn at_esc_bottom(idx: usize, x: i32) -> bool {
    let e = &ESCALATORS[idx];
    x >= e.x - 8 && x < e.x + 8
}
/// Top landing (boards Down) on the UPPER floor: `[x+ESC_W-8, x+ESC_W+8)`.
pub fn at_esc_top(idx: usize, x: i32) -> bool {
    let e = &ESCALATORS[idx];
    x >= e.x + ESC_W - 8 && x < e.x + ESC_W + 8
}

/// Is world x within a shaft's "keep out" band (used for safe respawn spots)?
pub fn near_shaft(x: i32, margin: i32) -> bool {
    SHAFTS.iter().any(|s| x >= s.x - margin && x < s.x + SHAFT_W + margin)
}
pub fn near_escalator(x: i32, margin: i32) -> bool {
    ESCALATORS.iter().any(|e| x >= e.x - margin && x < e.x + ESC_W + margin)
}

// ---------------------------------------------------------------------------------------------------------
// Spans: free stretches of a floor for decor and lamps
// ---------------------------------------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DecorKind {
    Plant,
    Bench,
    Vending,
    Trash,
}

impl DecorKind {
    pub fn width(self) -> i32 {
        match self {
            DecorKind::Plant => 16,
            DecorKind::Bench => 24,
            DecorKind::Vending => 16,
            DecorKind::Trash => 8,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DecorItem {
    pub kind: DecorKind,
    pub floor: Floor,
    /// Left edge.
    pub x: i32,
}

/// Things that occupy floor space on a floor (x0, x1), including kiosks, the booth and fountains.
pub fn occupied_spans(f: Floor) -> Vec<(i32, i32)> {
    let mut v: Vec<(i32, i32)> = Vec::new();
    for s in STORE_SLOTS.iter().filter(|s| s.id.info().floor == f) {
        v.push((s.x, s.x + STORE_W));
    }
    for s in SHAFTS.iter().filter(|s| s.serves(f)) {
        v.push((s.x, s.x + SHAFT_W));
    }
    for e in ESCALATORS.iter().filter(|e| e.upper == f || e.lower() == f) {
        v.push((e.x, e.x + ESC_W));
    }
    for (kf, cx) in layout::KIOSKS {
        if kf == f {
            v.push((cx - 12, cx + 12));
        }
    }
    if layout::PHOTO_BOOTH.0 == f {
        v.push((layout::PHOTO_BOOTH.1 - 12, layout::PHOTO_BOOTH.1 + 12));
    }
    for (ff, cx) in layout::FOUNTAINS {
        if ff == f {
            v.push((cx - 16, cx + 16));
        }
    }
    if f == Floor::Parking {
        v.push((layout::CAR_X, layout::CAR_X + layout::CAR_W));
        for px in pillar_xs() {
            v.push((px, px + 16));
        }
    }
    v.sort();
    v
}

/// Parking pillars (left edges).
pub fn pillar_xs() -> Vec<i32> {
    vec![24, 176, 280, 336, 480, 584, 664, 736]
}

/// Free stretches of floor `f` between `occupied_spans`, shrunk by `margin` each side, at least `min_w` wide.
pub fn free_spans(f: Floor, margin: i32, min_w: i32) -> Vec<(i32, i32)> {
    let occ = occupied_spans(f);
    let mut out = Vec::new();
    let mut cursor = WALL_L;
    for (a, b) in occ {
        if a - margin - (cursor + margin) >= min_w {
            out.push((cursor + margin, a - margin));
        }
        cursor = cursor.max(b);
    }
    if WALL_R - margin - (cursor + margin) >= min_w {
        out.push((cursor + margin, WALL_R - margin));
    }
    out
}

/// Deterministic decor (plants, benches, vending machines, bins) placed in the free spans of each floor.
pub fn decor_items(f: Floor) -> Vec<DecorItem> {
    if f == Floor::Roof {
        return Vec::new();
    }
    let lamps = lamp_slots(f);
    let mut items = Vec::new();
    let pattern = [DecorKind::Plant, DecorKind::Bench, DecorKind::Plant, DecorKind::Vending, DecorKind::Bench, DecorKind::Trash];
    let mut n = f.index() * 2;
    for (a, b) in free_spans(f, 4, 12) {
        let w = b - a;
        let mut x = a;
        // Short gaps get one plant centred; long stretches alternate items with breathing room.
        if w < 40 {
            let k = if w >= 16 && f != Floor::Parking { DecorKind::Plant } else { DecorKind::Trash };
            if w >= k.width() {
                items.push(DecorItem { kind: k, floor: f, x: a + (w - k.width()) / 2 });
            }
            continue;
        }
        while x + 16 <= b {
            let mut k = pattern[n % pattern.len()];
            n += 1;
            if f == Floor::Parking && matches!(k, DecorKind::Plant | DecorKind::Bench) {
                k = DecorKind::Trash;
            }
            if k == DecorKind::Vending && lamps.iter().any(|l| (l - (x + 8)).abs() < 18) {
                k = DecorKind::Trash;
            }
            if x + k.width() > b {
                break;
            }
            items.push(DecorItem { kind: k, floor: f, x });
            x += k.width() + 28 + ((n as i32 * 7) % 3) * 12;
        }
    }
    items
}

/// Hanging lamp / disco ball positions (x centre) on floor `f`: in the gaps between stores, shafts and
/// escalators, never in front of a store sign. The lights agent can take these over.
pub fn lamp_slots(f: Floor) -> Vec<i32> {
    if f == Floor::Roof {
        return Vec::new();
    }
    let mut blockers: Vec<(i32, i32)> = Vec::new();
    for s in STORE_SLOTS.iter().filter(|s| s.id.info().floor == f) {
        blockers.push((s.x, s.x + STORE_W));
    }
    for s in SHAFTS.iter().filter(|s| s.serves(f)) {
        blockers.push((s.x - 4, s.x + SHAFT_W + 4));
    }
    for e in ESCALATORS.iter().filter(|e| e.upper == f || e.lower() == f) {
        blockers.push((e.x, e.x + ESC_W));
    }
    if f == Floor::Parking {
        blockers.push((layout::CAR_X, layout::CAR_X + layout::CAR_W));
        for px in pillar_xs() {
            blockers.push((px - 2, px + 18));
        }
    }
    blockers.sort();
    let mut spans = Vec::new();
    let mut cursor = WALL_L + 18; // keep clear of the floor label on the left wall
    for (a, b) in blockers {
        if a - cursor >= 18 {
            spans.push((cursor, a));
        }
        cursor = cursor.max(b);
    }
    if WALL_R - cursor >= 18 {
        spans.push((cursor, WALL_R));
    }
    let mut out = Vec::new();
    for (a, b) in spans {
        let w = b - a;
        let n = (w / 96).max(1);
        for i in 0..n {
            out.push(a + w * (2 * i + 1) / (2 * n));
        }
    }
    out
}

/// Total number of floors, re-exported for convenience.
pub const FLOORS: usize = FLOOR_COUNT;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn corridor_matches_storefront_height() {
        assert_eq!(CORRIDOR_H, crate::art::storefront::FRONT_H);
        assert_eq!(CORRIDOR_H + SLAB, FLOOR_GAP);
        assert!(CAR_H < CORRIDOR_H);
    }

    #[test]
    fn opening_states_follow_the_car() {
        let fy = floor_y(Floor::F3);
        assert_eq!(opening_state(ShaftId::A, Floor::F3, fy), Some(Opening::CarHere));
        assert_eq!(opening_state(ShaftId::A, Floor::F3, fy - 1), Some(Opening::GrateAbove));
        assert_eq!(opening_state(ShaftId::A, Floor::F3, fy + 1), Some(Opening::PitBelow));
        assert_eq!(opening_state(ShaftId::A, Floor::F1, fy), None, "A does not serve 1F");
    }

    #[test]
    fn decor_never_overlaps_anything_and_lamps_avoid_stores() {
        for f in Floor::ALL {
            let occ = occupied_spans(f);
            let items = decor_items(f);
            for it in &items {
                let (a, b) = (it.x, it.x + it.kind.width());
                assert!(a >= WALL_L && b <= WALL_R, "{it:?} outside walls");
                for (oa, ob) in &occ {
                    assert!(b <= *oa || a >= *ob, "{it:?} overlaps {oa}..{ob} on {f:?}");
                }
                for o in &items {
                    if o != it {
                        assert!(b <= o.x || a >= o.x + o.kind.width(), "{it:?} overlaps {o:?}");
                    }
                }
            }
            for lx in lamp_slots(f) {
                for st in STORE_SLOTS.iter().filter(|s| s.id.info().floor == f) {
                    assert!(lx + 8 <= st.x || lx - 8 >= st.x + STORE_W, "lamp at {lx} covers store {:?}", st.id);
                }
            }
        }
    }

    #[test]
    fn shopping_floors_have_lamps() {
        for f in [Floor::F4, Floor::F3, Floor::F2, Floor::F1] {
            assert!(!lamp_slots(f).is_empty(), "{f:?}");
        }
    }

    #[test]
    fn zones_do_not_collide_at_the_escalator_next_to_shaft_b() {
        // 4F/2F: esc top landing zone ends before shaft B's call zone starts.
        let e = &ESCALATORS[0];
        let top_end = e.x + ESC_W + 8;
        let b = layout::shaft(ShaftId::B);
        assert!(top_end <= b.x - CALL_MARGIN);
    }
}
