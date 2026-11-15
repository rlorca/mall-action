use crate::engine::pad::btn;

/// UP UP DOWN DOWN LEFT RIGHT LEFT RIGHT B A.
pub const KONAMI_CODE: [u32; 10] = [btn::UP, btn::UP, btn::DOWN, btn::DOWN, btn::LEFT, btn::RIGHT, btn::LEFT, btn::RIGHT, btn::B, btn::A];

/// Pure Konami-code detector. Feed it `pad.pressed` (rising edges) once per step.
///
/// It keeps the last 10 button presses and fires when they equal the code exactly (a sliding
/// window), so extra leading Ups (UP UP UP DOWN ...) still work and any unrelated press simply
/// pushes the old sequence out of the window (no hand-written reset logic to get wrong).
/// A step where several buttons go down at once pushes that whole mask as one entry, which never
/// equals a single-button code entry, so chords break a sequence in progress.
#[derive(Clone, Debug, Default)]
pub struct KonamiDetector {
    buf: Vec<u32>,
}

impl KonamiDetector {
    pub fn new() -> KonamiDetector {
        KonamiDetector { buf: Vec::new() }
    }

    /// Returns true on the step the code is completed. The window is cleared after a hit.
    pub fn feed(&mut self, pressed: u32) -> bool {
        if pressed == 0 {
            return false;
        }
        self.buf.push(pressed);
        if self.buf.len() > KONAMI_CODE.len() {
            self.buf.remove(0);
        }
        if self.buf.len() == KONAMI_CODE.len() && self.buf.iter().zip(KONAMI_CODE.iter()).all(|(b, k)| b == k) {
            self.buf.clear();
            return true;
        }
        false
    }

    /// How many of the most recent presses form a correct prefix of the code (for UI hints / tests).
    pub fn progress(&self) -> usize {
        let mut n = self.buf.len().min(KONAMI_CODE.len() - 1);
        while n > 0 {
            let mut ok = true;
            for i in 0..n {
                if self.buf[self.buf.len() - n + i] != KONAMI_CODE[i] {
                    ok = false;
                    break;
                }
            }
            if ok {
                return n;
            }
            n -= 1;
        }
        0
    }

    pub fn reset(&mut self) {
        self.buf.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Feed a list of presses (0 = idle step); returns the indices at which it fired.
    fn run(d: &mut KonamiDetector, presses: &[u32]) -> Vec<usize> {
        let mut hits = Vec::new();
        for (i, p) in presses.iter().enumerate() {
            if d.feed(*p) {
                hits.push(i);
            }
        }
        hits
    }

    #[test]
    fn fires_on_the_exact_code_on_the_final_a_press() {
        let mut d = KonamiDetector::new();
        assert_eq!(run(&mut d, &KONAMI_CODE), vec![9]);
    }

    #[test]
    fn ignores_idle_steps_between_presses() {
        let mut d = KonamiDetector::new();
        let mut seq = Vec::new();
        for b in KONAMI_CODE {
            seq.extend([0, 0, b, 0]);
        }
        assert_eq!(run(&mut d, &seq).len(), 1);
    }

    #[test]
    fn still_works_with_extra_leading_ups() {
        for extra in [1usize, 2, 4, 9] {
            let mut d = KonamiDetector::new();
            let mut seq: Vec<u32> = vec![btn::UP; extra];
            seq.extend(KONAMI_CODE);
            assert_eq!(run(&mut d, &seq), vec![seq.len() - 1], "{} extra", extra);
        }
    }

    #[test]
    fn does_not_fire_on_a_partial_or_wrong_code() {
        let mut d = KonamiDetector::new();
        assert!(run(&mut d, &KONAMI_CODE[..9]).is_empty());
        let mut wrong = KONAMI_CODE;
        wrong[8] = btn::A;
        wrong[9] = btn::B;
        assert!(run(&mut KonamiDetector::new(), &wrong).is_empty());
    }

    #[test]
    fn an_unrelated_press_in_the_middle_resets_a_clean_retry_then_works() {
        let mut d = KonamiDetector::new();
        let mut broken: Vec<u32> = KONAMI_CODE[..5].to_vec();
        broken.push(btn::A);
        broken.extend(&KONAMI_CODE[5..]);
        assert!(run(&mut d, &broken).is_empty());
        // the same detector still recognises a fresh, clean entry afterwards
        assert_eq!(run(&mut d, &KONAMI_CODE).len(), 1);
    }

    #[test]
    fn start_select_presses_are_unrelated_presses_too() {
        let mut d = KonamiDetector::new();
        let mut seq: Vec<u32> = KONAMI_CODE[..7].to_vec();
        seq.push(btn::SELECT);
        seq.extend(&KONAMI_CODE[7..]);
        assert!(run(&mut d, &seq).is_empty());
    }

    #[test]
    fn a_chord_two_buttons_at_once_breaks_a_sequence_in_progress() {
        let mut d = KonamiDetector::new();
        let mut seq = KONAMI_CODE;
        seq[3] = btn::DOWN | btn::UP;
        assert!(run(&mut d, &seq).is_empty());
    }

    #[test]
    fn can_be_entered_twice_in_a_row_window_clears_after_a_hit() {
        let mut d = KonamiDetector::new();
        let mut seq = KONAMI_CODE.to_vec();
        seq.extend(KONAMI_CODE);
        assert_eq!(run(&mut d, &seq), vec![9, 19]);
    }

    #[test]
    fn reports_progress_through_the_code() {
        let mut d = KonamiDetector::new();
        assert_eq!(d.progress(), 0);
        d.feed(btn::UP);
        d.feed(btn::UP);
        assert_eq!(d.progress(), 2);
        d.feed(btn::DOWN);
        assert_eq!(d.progress(), 3);
        d.feed(btn::A);
        assert_eq!(d.progress(), 0);
        d.reset();
        assert_eq!(d.progress(), 0);
    }
}
