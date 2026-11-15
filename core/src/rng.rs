//! Deterministic seeded random numbers (xorshift64*). Every random decision in the game goes through this.

#[derive(Clone, Debug)]
pub struct Rng {
    state: u64,
}

impl Rng {
    pub fn new(seed: u64) -> Rng {
        // splitmix64 scramble so small seeds (1, 2, 3...) give well-spread states.
        let mut z = seed.wrapping_add(0x9E37_79B9_7F4A_7C15);
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^= z >> 31;
        Rng { state: if z == 0 { 0x2545_F491_4F6C_DD1D } else { z } }
    }

    pub fn next_u32(&mut self) -> u32 {
        let mut x = self.state;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.state = x;
        (x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 32) as u32
    }

    /// Uniform integer in `0..n` (returns 0 when `n == 0`).
    pub fn below(&mut self, n: u32) -> u32 {
        if n == 0 {
            0
        } else {
            ((self.next_u32() as u64 * n as u64) >> 32) as u32
        }
    }

    /// Uniform integer in `lo..=hi`.
    pub fn range(&mut self, lo: i32, hi: i32) -> i32 {
        if hi <= lo {
            lo
        } else {
            lo + self.below((hi - lo + 1) as u32) as i32
        }
    }

    /// Uniform float in `[0, 1)`.
    pub fn float(&mut self) -> f32 {
        (self.next_u32() >> 8) as f32 / (1u32 << 24) as f32
    }

    /// True with probability `p` (0.0..=1.0).
    pub fn chance(&mut self, p: f32) -> bool {
        self.float() < p
    }

    pub fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[self.below(items.len() as u32) as usize]
    }

    /// Fisher-Yates shuffle.
    pub fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            let j = self.below(i as u32 + 1) as usize;
            items.swap(i, j);
        }
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
    }

    #[test]
    fn different_seeds_differ() {
        let mut a = Rng::new(1);
        let mut b = Rng::new(2);
        let same = (0..32).filter(|_| a.next_u32() == b.next_u32()).count();
        assert!(same < 4);
    }

    #[test]
    fn below_stays_in_range_and_covers() {
        let mut r = Rng::new(7);
        let mut seen = [false; 6];
        for _ in 0..500 {
            let v = r.below(6) as usize;
            assert!(v < 6);
            seen[v] = true;
        }
        assert!(seen.iter().all(|s| *s));
        assert_eq!(r.below(0), 0);
    }

    #[test]
    fn range_is_inclusive() {
        let mut r = Rng::new(9);
        let mut lo = false;
        let mut hi = false;
        for _ in 0..500 {
            let v = r.range(-2, 2);
            assert!((-2..=2).contains(&v));
            lo |= v == -2;
            hi |= v == 2;
        }
        assert!(lo && hi);
    }

    #[test]
    fn chance_rate_is_about_right() {
        let mut r = Rng::new(3);
        let n = (0..10_000).filter(|_| r.chance(0.1)).count();
        assert!((800..1200).contains(&n), "{n}");
    }

    #[test]
    fn shuffle_is_a_permutation() {
        let mut r = Rng::new(5);
        let mut v: Vec<u32> = (0..20).collect();
        r.shuffle(&mut v);
        let mut s = v.clone();
        s.sort();
        assert_eq!(s, (0..20).collect::<Vec<_>>());
    }
}
