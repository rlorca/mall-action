//! Deterministic seeded RNG (mulberry32). Port of `engine/rng.ts`; bit-exact with the TypeScript original.

#[derive(Clone, Debug)]
pub struct Rng {
    s: u32,
}

/// FNV-1a 32-bit hash of the string's UTF-16 code units (as `charCodeAt`).
pub fn hash_string(s: &str) -> u32 {
    let mut h: u32 = 0x811c9dc5;
    for u in s.encode_utf16() {
        h ^= u as u32;
        h = h.wrapping_mul(0x01000193);
    }
    h
}

impl Rng {
    pub fn new(seed: u32) -> Rng {
        Rng { s: if seed == 0 { 0x9e3779b9 } else { seed } }
    }
    /// Float in [0, 1).
    pub fn next(&mut self) -> f64 {
        self.s = self.s.wrapping_add(0x6d2b79f5);
        let mut t = self.s;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        (t ^ (t >> 14)) as f64 / 4294967296.0
    }
    /// Integer in [0, n).
    pub fn int(&mut self, n: i32) -> i32 {
        (self.next() * n as f64).floor() as i32
    }
    /// Integer in [lo, hi] inclusive.
    pub fn between(&mut self, lo: i32, hi: i32) -> i32 {
        lo + (self.next() * (hi - lo + 1) as f64).floor() as i32
    }
    /// Float in [lo, hi).
    pub fn range(&mut self, lo: f64, hi: f64) -> f64 {
        lo + self.next() * (hi - lo)
    }
    pub fn chance(&mut self, p: f64) -> bool {
        self.next() < p
    }
    /// Panics on an empty slice, like the original throws.
    pub fn pick<'a, T>(&mut self, arr: &'a [T]) -> &'a T {
        assert!(!arr.is_empty(), "Rng.pick on empty array");
        let i = self.int(arr.len() as i32) as usize;
        &arr[i]
    }
    pub fn shuffle<T>(&mut self, arr: &mut [T]) {
        let mut i = arr.len();
        while i > 1 {
            i -= 1;
            let j = self.int(i as i32 + 1) as usize;
            arr.swap(i, j);
        }
    }
    /// An independent stream derived from this one's state and a label.
    pub fn fork(&self, label: &str) -> Rng {
        Rng::new(hash_string(label) ^ self.s ^ 0x85ebca6b)
    }
    pub fn state(&self) -> u32 {
        self.s
    }
    pub fn set_state(&mut self, s: u32) {
        self.s = s;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Reference values dumped from the TypeScript implementation.
    #[test]
    fn matches_typescript() {
        let mut r = Rng::new(12345);
        let want = [0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203, 0.5094283693470061];
        for w in want {
            assert_eq!(r.next(), w);
        }
        assert_eq!(r.state(), 567906818);
        let mut f = r.fork("game1");
        assert_eq!([f.int(1000), f.int(1000), f.int(1000)], [604, 275, 515]);
        assert_eq!(hash_string("game1"), 2419968514);
        assert_eq!(Rng::new(0).state(), 2654435769);
        let mut a = [1, 2, 3, 4, 5, 6, 7, 8];
        Rng::new(9).shuffle(&mut a);
        assert_eq!(a, [8, 7, 4, 3, 5, 1, 6, 2]);
    }
}
