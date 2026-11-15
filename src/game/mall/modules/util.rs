//! Small helpers shared by the mall modules. Port of `modules/util.ts`.

use crate::content::layout::SHAFTS;
use crate::game::mall::geometry::shaft_near;
use crate::game::mall::types::Bullet;

/// `Math.sign` as an integer: -1, 0 or 1.
pub fn sgn(n: f64) -> i32 {
    if n > 0.0 {
        1
    } else if n < 0.0 {
        -1
    } else {
        0
    }
}

/// Swept test of a bullet against an x-span: `on_bullet` runs BEFORE the bullet moves, and bullets cover 4 px a frame,
/// so a thin target would be tunnelled by a point test. Returns the distance the bullet has to travel along x to reach
/// the span (0 when it already is inside), or None when it does not touch the span this frame.
pub fn sweep_dist(b: &Bullet, lo: f64, hi: f64) -> Option<f64> {
    let a = b.x.min(b.x + b.vx);
    let z = b.x.max(b.x + b.vx);
    if z < lo || a > hi {
        return None;
    }
    Some(if b.vx >= 0.0 { 0.0f64.max(lo - b.x) } else { 0.0f64.max(b.x - hi) })
}

/// A walker-type NPC of half width `half` centred on x would overlap a shaft opening (plus `margin`) on this floor.
pub fn touches_shaft(x: f64, floor: i32, half: f64, margin: f64) -> bool {
    shaft_near(x, floor, half + margin).is_some()
}

/// Free stretches of a floor between the shaft openings and the walls for something `half` px wide: each (lo, hi) is
/// the range its centre may take without overlapping an opening (plus `margin`). Defaults in TS: margin 4, wallPad 16.
pub fn floor_segments(floor: i32, half: f64, margin: f64, wall_pad: f64) -> Vec<(f64, f64)> {
    let lo0 = 8.0 + wall_pad;
    let hi0 = 768.0 - 8.0 - wall_pad;
    let mut cuts: Vec<(f64, f64)> = SHAFTS
        .iter()
        .filter(|s| floor >= s.top && floor <= s.bottom)
        .map(|s| (s.x - half - margin, s.x + s.w + half + margin))
        .collect();
    cuts.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    let mut out: Vec<(f64, f64)> = Vec::new();
    let mut cur = lo0;
    for (a, b) in cuts {
        if a > cur {
            out.push((cur, a.min(hi0)));
        }
        cur = cur.max(b);
    }
    if cur < hi0 {
        out.push((cur, hi0));
    }
    out.into_iter().filter(|(a, b)| b - a >= 8.0).collect()
}

/// The segment (from `floor_segments`) holding x, or the nearest one.
pub fn segment_at(segs: &[(f64, f64)], x: f64) -> (f64, f64) {
    let mut best = segs[0];
    let mut bd = f64::INFINITY;
    for s in segs {
        if x >= s.0 && x <= s.1 {
            return *s;
        }
        let d = (x - s.0).abs().min((x - s.1).abs());
        if d < bd {
            bd = d;
            best = *s;
        }
    }
    best
}
