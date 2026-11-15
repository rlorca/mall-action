//! Fixed 60 Hz simulation accumulator. Rendering is decoupled: call `advance(dt)` once per
//! rendered frame and run the returned number of simulation steps.
pub const STEP: f64 = 1.0 / 60.0;

#[derive(Clone, Debug)]
pub struct FixedStep {
    acc: f64,
    pub max_catchup: u32,
}

impl FixedStep {
    pub fn new() -> FixedStep {
        FixedStep { acc: 0.0, max_catchup: 5 }
    }
    /// Add `dt` seconds of wall time; returns how many 1/60 s steps to simulate (capped).
    pub fn advance(&mut self, dt: f64) -> u32 {
        self.acc += dt.clamp(0.0, 1.0);
        let mut n = 0;
        while self.acc >= STEP - 1e-9 && n < self.max_catchup {
            self.acc -= STEP;
            n += 1;
        }
        if n == self.max_catchup {
            // we are behind: drop the backlog instead of spiralling
            self.acc = self.acc.min(STEP);
        }
        n
    }
}

impl Default for FixedStep {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sixty_hz_over_one_second() {
        let mut f = FixedStep::new();
        let mut total = 0;
        for _ in 0..120 {
            total += f.advance(1.0 / 120.0);
        }
        assert!((59..=60).contains(&total), "{total}");
    }
    #[test]
    fn catchup_is_capped() {
        let mut f = FixedStep::new();
        assert_eq!(f.advance(0.9), 5);
        assert!(f.advance(0.0) <= 1);
    }
    #[test]
    fn slow_frame_runs_multiple_steps() {
        let mut f = FixedStep::new();
        assert_eq!(f.advance(1.0 / 30.0), 2);
    }
}
