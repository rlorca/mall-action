//! Deterministic seeded PRNG (xorshift64*). All game randomness goes through this.
#[derive(Clone, Debug)]
pub struct Rng {
    s: u64,
}

impl Rng {
    pub fn new(seed: u64) -> Rng {
        // splitmix to avoid weak seeds
        let mut z = seed.wrapping_add(0x9E37_79B9_7F4A_7C15);
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^= z >> 31;
        Rng { s: if z == 0 { 0x1234_5678_9ABC_DEF1 } else { z } }
    }
    pub fn next_u32(&mut self) -> u32 {
        let mut x = self.s;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.s = x;
        (x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 32) as u32
    }
    /// Uniform integer in `lo..hi` (hi exclusive). Returns `lo` if the range is empty.
    pub fn range(&mut self, lo: i32, hi: i32) -> i32 {
        if hi <= lo {
            return lo;
        }
        lo + (self.next_u32() % (hi - lo) as u32) as i32
    }
    /// True with probability `pct` percent (0..=100).
    pub fn chance(&mut self, pct: u32) -> bool {
        self.next_u32() % 100 < pct
    }
    pub fn pick<'a, T>(&mut self, xs: &'a [T]) -> &'a T {
        &xs[self.range(0, xs.len() as i32) as usize]
    }
    pub fn index(&mut self, n: usize) -> usize {
        self.range(0, n as i32) as usize
    }
    pub fn shuffle<T>(&mut self, xs: &mut [T]) {
        for i in (1..xs.len()).rev() {
            let j = self.range(0, i as i32 + 1) as usize;
            xs.swap(i, j);
        }
    }
    pub fn float(&mut self) -> f32 {
        (self.next_u32() >> 8) as f32 / (1u32 << 24) as f32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn same_seed_same_sequence() {
        let mut a = Rng::new(42);
        let mut b = Rng::new(42);
        for _ in 0..100 {
            assert_eq!(a.next_u32(), b.next_u32());
        }
        let mut c = Rng::new(43);
        assert_ne!(Rng::new(42).next_u32(), c.next_u32());
    }
    #[test]
    fn range_bounds_and_chance() {
        let mut r = Rng::new(1);
        for _ in 0..1000 {
            let v = r.range(-3, 4);
            assert!((-3..4).contains(&v));
        }
        assert_eq!(r.range(5, 5), 5);
        let hits = (0..10000).filter(|_| r.chance(10)).count();
        assert!((800..1200).contains(&hits), "{hits}");
        assert!(!(0..100).any(|_| r.chance(0)));
        assert!((0..100).all(|_| r.chance(100)));
    }
    #[test]
    fn shuffle_is_permutation() {
        let mut v: Vec<u32> = (0..20).collect();
        Rng::new(7).shuffle(&mut v);
        let mut s = v.clone();
        s.sort();
        assert_eq!(s, (0..20).collect::<Vec<_>>());
    }
}
