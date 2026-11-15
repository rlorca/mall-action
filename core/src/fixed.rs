//! Fixed 60 Hz simulation clock. Rendering is decoupled: the host feeds real elapsed time in,
//! gets back how many simulation steps to run, capped so a stalled tab cannot cause a spiral.

pub const STEP_HZ: u32 = 60;
pub const STEP_SECONDS: f64 = 1.0 / STEP_HZ as f64;
pub const MAX_CATCH_UP: u32 = 5;

#[derive(Clone, Debug, Default)]
pub struct FixedStep {
    acc: f64,
}

impl FixedStep {
    pub fn new() -> FixedStep {
        FixedStep { acc: 0.0 }
    }

    /// Add `dt` seconds of real time; returns the number of steps to simulate now (0..=MAX_CATCH_UP).
    /// Time beyond the cap is dropped rather than carried over.
    pub fn advance(&mut self, dt: f64) -> u32 {
        let dt = if dt.is_finite() { dt.clamp(0.0, 1.0) } else { 0.0 };
        self.acc += dt;
        let mut n = 0;
        while self.acc >= STEP_SECONDS - 1e-9 && n < MAX_CATCH_UP {
            self.acc -= STEP_SECONDS;
            n += 1;
        }
        if n == MAX_CATCH_UP && self.acc >= STEP_SECONDS {
            self.acc = 0.0;
        }
        if self.acc < 0.0 {
            self.acc = 0.0;
        }
        n
    }

    /// Fraction of a step left over, for optional interpolation.
    pub fn alpha(&self) -> f64 {
        (self.acc / STEP_SECONDS).clamp(0.0, 1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_step_per_sixtieth() {
        let mut f = FixedStep::new();
        assert_eq!(f.advance(STEP_SECONDS), 1);
        assert_eq!(f.advance(STEP_SECONDS), 1);
        assert_eq!(f.advance(0.001), 0);
    }

    #[test]
    fn accumulates_small_slices() {
        let mut f = FixedStep::new();
        let mut total = 0;
        for _ in 0..600 {
            total += f.advance(1.0 / 240.0);
        }
        assert!((149..=151).contains(&total), "{total}");
    }

    #[test]
    fn catch_up_is_capped() {
        let mut f = FixedStep::new();
        assert_eq!(f.advance(10.0), MAX_CATCH_UP);
        // the dropped backlog must not be paid back later
        assert_eq!(f.advance(0.0), 0);
    }

    #[test]
    fn garbage_dt_is_harmless() {
        let mut f = FixedStep::new();
        assert_eq!(f.advance(f64::NAN), 0);
        assert_eq!(f.advance(-5.0), 0);
    }

    #[test]
    fn sixty_hz_displays_give_one_step_per_frame() {
        let mut f = FixedStep::new();
        let total: u32 = (0..120).map(|_| f.advance(1.0 / 60.0)).sum();
        assert_eq!(total, 120);
    }
}
