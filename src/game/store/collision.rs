use super::room::TILE;

/// Axis-aligned box movement against a tile grid, with Zelda-style corner assist.
/// Boxes are described by their CENTRE (x, y) and a half size; positions are floats
/// (sub-pixel), only rounded when drawn.
///
/// TS `SolidFn`: `(col, row) => boolean`.
pub type SolidFn<'a> = &'a dyn Fn(i32, i32) -> bool;

/// TS `Vec` (renamed so it does not shadow `std::vec::Vec`).
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct Vec2 {
    pub x: f64,
    pub y: f64,
}

const EPS: f64 = 1e-4;
const TILE_F: f64 = TILE as f64;

/// Half size of the agent's / a guard's collision box (12 x 12 inside a 16 x 16 sprite).
pub const HALF: f64 = 6.0;
/// How far (px) the box may overhang a blocking corner and still be nudged into a gap.
pub const ASSIST: i32 = 6;
/// Lateral nudge speed (px per frame) while corner-assisting.
pub const ASSIST_SPEED: f64 = 1.25;

/// TS `boxFree(solid, x, y, half = HALF)`.
pub fn box_free(solid: SolidFn, x: f64, y: f64, half: f64) -> bool {
    let c0 = ((x - half) / TILE_F).floor() as i32;
    let c1 = ((x + half - EPS) / TILE_F).floor() as i32;
    let r0 = ((y - half) / TILE_F).floor() as i32;
    let r1 = ((y + half - EPS) / TILE_F).floor() as i32;
    let mut r = r0;
    while r <= r1 {
        let mut c = c0;
        while c <= c1 {
            if solid(c, r) {
                return false;
            }
            c += 1;
        }
        r += 1;
    }
    true
}

#[derive(Clone, Copy, Debug)]
pub struct MoveOpts {
    pub half: f64,
    /// Corner assist (the agent only).
    pub assist: bool,
}

impl Default for MoveOpts {
    fn default() -> MoveOpts {
        MoveOpts { half: HALF, assist: false }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Axis {
    X,
    Y,
}

/// Move `p` along ONE axis by `delta` px (sign = direction). Slides flush against walls.
/// With `assist`, a move blocked only by a corner nudges the box sideways towards the gap.
/// Returns true if the box moved at all.
pub fn move_axis(solid: SolidFn, p: &mut Vec2, axis: Axis, delta: f64, opts: MoveOpts) -> bool {
    let half = opts.half;
    let dir: f64 = if delta < 0.0 { -1.0 } else { 1.0 };
    let mut remaining = delta.abs();
    let mut moved = false;
    while remaining > EPS {
        let step = remaining.min(1.0);
        remaining -= step;
        let nx = if axis == Axis::X { p.x + dir * step } else { p.x };
        let ny = if axis == Axis::Y { p.y + dir * step } else { p.y };
        if box_free(solid, nx, ny, half) {
            p.x = nx;
            p.y = ny;
            moved = true;
            continue;
        }
        // blocked: slide flush against the blocking tile edge
        let cur = if axis == Axis::X { p.x } else { p.y };
        let edge = cur + dir * (half + step);
        let flush = if dir > 0.0 {
            ((edge - EPS) / TILE_F).floor() * TILE_F - half
        } else {
            ((edge / TILE_F).floor() + 1.0) * TILE_F + half
        };
        if if dir > 0.0 { flush > cur } else { flush < cur } {
            let fx = if axis == Axis::X { flush } else { p.x };
            let fy = if axis == Axis::Y { flush } else { p.y };
            if box_free(solid, fx, fy, half) {
                p.x = fx;
                p.y = fy;
                moved = true;
            }
        }
        if opts.assist {
            assist_nudge(solid, p, axis, dir, half);
        }
        break;
    }
    moved
}

/// Blocked while moving along `axis`: find the smallest sideways offset that would let the box through and nudge towards it.
fn assist_nudge(solid: SolidFn, p: &mut Vec2, axis: Axis, dir: f64, half: f64) {
    for off in 1..=ASSIST {
        let off = off as f64;
        for s in [-1.0_f64, 1.0] {
            let lx = if axis == Axis::Y { p.x + s * off } else { p.x };
            let ly = if axis == Axis::X { p.y + s * off } else { p.y };
            let fx = if axis == Axis::X { p.x + dir } else { lx };
            let fy = if axis == Axis::Y { p.y + dir } else { ly };
            if !box_free(solid, lx, ly, half) || !box_free(solid, fx, fy, half) {
                continue;
            }
            // the lateral path must be clear too
            let nudge = off.min(ASSIST_SPEED);
            let tx = if axis == Axis::Y { p.x + s * nudge } else { p.x };
            let ty = if axis == Axis::X { p.y + s * nudge } else { p.y };
            if box_free(solid, tx, ty, half) {
                p.x = tx;
                p.y = ty;
            }
            return;
        }
    }
}

pub fn boxes_overlap(ax: f64, ay: f64, ah: f64, bx: f64, by: f64, bh: f64) -> bool {
    (ax - bx).abs() < ah + bh && (ay - by).abs() < ah + bh
}
