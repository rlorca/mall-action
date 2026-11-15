//! JavaScript number semantics that differ from Rust's. Use these instead of `round()` / `as i32` where the
//! TypeScript original used `Math.round`, `| 0`, `>>> 0`, `Math.imul`.

/// `Math.round`: halves round toward +infinity (Rust's `f64::round` rounds half away from zero).
#[inline]
pub fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}
/// `Math.round(x)` as i32.
#[inline]
pub fn round_i(x: f64) -> i32 {
    js_round(x) as i32
}
/// `x | 0` / `x >> 0` for a double: truncate toward zero, wrap modulo 2^32 (NaN/inf -> 0).
#[inline]
pub fn to_i32(x: f64) -> i32 {
    if !x.is_finite() {
        return 0;
    }
    (x.trunc() % 4294967296.0) as i64 as i32
}
/// `x >>> 0`.
#[inline]
pub fn to_u32(x: f64) -> u32 {
    to_i32(x) as u32
}
/// `Math.imul`.
#[inline]
pub fn imul(a: i32, b: i32) -> i32 {
    a.wrapping_mul(b)
}
/// `Math.min(Math.max(x, lo), hi)`.
#[inline]
pub fn clamp(x: f64, lo: f64, hi: f64) -> f64 {
    x.max(lo).min(hi)
}
/// JS `%` on doubles (sign follows dividend) is Rust's `%` on f64; this is `((a % n) + n) % n`.
#[inline]
pub fn modulo(a: f64, n: f64) -> f64 {
    ((a % n) + n) % n
}
