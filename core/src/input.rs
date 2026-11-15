//! Virtual NES pad: keyboard (layout-aware letters) + gamepad merged into 8 buttons.
//!
//! * Letter keys match the PRINTED letter (so QWERTZ/AZERTY work); other keys match by physical
//!   position (`code`, e.g. "ArrowUp", "Space"). A letter key whose printed char is unknown or
//!   non-ASCII falls back to its physical position.
//! * A key release clears exactly the action that key press set.
//! * Edges are queued: each simulation step consumes one snapshot, so a tap that is pressed and
//!   released within one rendered frame still lasts at least one step.
use std::collections::VecDeque;

pub const UP: u8 = 1;
pub const DOWN: u8 = 2;
pub const LEFT: u8 = 4;
pub const RIGHT: u8 = 8;
pub const A: u8 = 16;
pub const B: u8 = 32;
pub const SELECT: u8 = 64;
pub const START: u8 = 128;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    Pad(u8),
    ToggleCrt,
    ToggleMute,
}

fn by_char(ch: char) -> Option<Action> {
    Some(match ch.to_ascii_lowercase() {
        'w' => Action::Pad(UP),
        's' => Action::Pad(DOWN),
        'a' => Action::Pad(LEFT),
        'd' => Action::Pad(RIGHT),
        'z' | 'j' => Action::Pad(A),
        'x' | 'k' => Action::Pad(B),
        'c' => Action::ToggleCrt,
        'm' => Action::ToggleMute,
        _ => return None,
    })
}

fn by_code(code: &str) -> Option<Action> {
    Some(match code {
        "ArrowUp" => Action::Pad(UP),
        "ArrowDown" => Action::Pad(DOWN),
        "ArrowLeft" => Action::Pad(LEFT),
        "ArrowRight" => Action::Pad(RIGHT),
        "Space" => Action::Pad(B),
        "ShiftLeft" | "ShiftRight" | "Tab" => Action::Pad(SELECT),
        "Enter" | "NumpadEnter" => Action::Pad(START),
        // physical fallback for letter keys (QWERTY positions)
        "KeyW" => Action::Pad(UP),
        "KeyS" => Action::Pad(DOWN),
        "KeyA" => Action::Pad(LEFT),
        "KeyD" => Action::Pad(RIGHT),
        "KeyZ" | "KeyJ" => Action::Pad(A),
        "KeyX" | "KeyK" => Action::Pad(B),
        "KeyC" => Action::ToggleCrt,
        "KeyM" => Action::ToggleMute,
        _ => return None,
    })
}

#[derive(Default, Clone, Debug)]
pub struct KeyMapper {
    down: Vec<(String, Action)>,
}

impl KeyMapper {
    pub fn new() -> Self {
        Self::default()
    }
    /// `code`: physical key name (DOM `KeyboardEvent.code` style). `ch`: the printed character, if any.
    /// Returns the action to apply, or None for unmapped keys and auto-repeat.
    pub fn key_down(&mut self, code: &str, ch: Option<char>) -> Option<Action> {
        if self.down.iter().any(|(c, _)| c == code) {
            return None; // repeat
        }
        let is_letter_key = code.starts_with("Key");
        let action = if is_letter_key {
            match ch {
                // printed letter first; a printed letter with no binding falls back to the physical position
                Some(c) if c.is_ascii_alphabetic() => by_char(c).or_else(|| by_code(code)),
                _ => by_code(code),
            }
        } else {
            by_code(code)
        };
        let a = action?;
        self.down.push((code.to_string(), a));
        Some(a)
    }
    /// Returns exactly the action that was set when this key went down.
    pub fn key_up(&mut self, code: &str) -> Option<Action> {
        let i = self.down.iter().position(|(c, _)| c == code)?;
        Some(self.down.remove(i).1)
    }
    pub fn release_all(&mut self) -> Vec<Action> {
        self.down.drain(..).map(|(_, a)| a).collect()
    }
}

/// One step's view of the pad.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct PadState {
    pub held: u8,
    pub pressed: u8,
    pub released: u8,
}

impl PadState {
    pub fn is(&self, b: u8) -> bool {
        self.held & b != 0
    }
    pub fn pressed(&self, b: u8) -> bool {
        self.pressed & b != 0
    }
    pub fn any_pressed(&self) -> bool {
        self.pressed != 0
    }
}

#[derive(Default, Clone, Debug)]
pub struct Pad {
    kb: [u8; 8],
    gamepad: u8,
    queue: VecDeque<u8>,
    last_pushed: u8,
    state: PadState,
}

impl Pad {
    pub fn new() -> Pad {
        Pad::default()
    }
    fn effective(&self) -> u8 {
        let mut m = self.gamepad;
        for (i, n) in self.kb.iter().enumerate() {
            if *n > 0 {
                m |= 1 << i;
            }
        }
        m
    }
    fn push(&mut self) {
        let e = self.effective();
        if e != self.last_pushed {
            self.queue.push_back(e);
            self.last_pushed = e;
        }
    }
    pub fn apply(&mut self, action: Action, down: bool) {
        if let Action::Pad(bit) = action {
            let i = bit.trailing_zeros() as usize;
            if down {
                self.kb[i] = self.kb[i].saturating_add(1);
            } else {
                self.kb[i] = self.kb[i].saturating_sub(1);
            }
            self.push();
        }
    }
    pub fn set_gamepad(&mut self, mask: u8) {
        if mask != self.gamepad {
            self.gamepad = mask;
            self.push();
        }
    }
    /// Advance to the next step's state (consumes at most one queued snapshot).
    pub fn begin_step(&mut self) -> PadState {
        let prev = self.state.held;
        let held = self.queue.pop_front().unwrap_or(prev);
        self.state = PadState { held, pressed: held & !prev, released: prev & !held };
        self.state
    }
    pub fn state(&self) -> PadState {
        self.state
    }
}

/// Konami code tracker: ↑↑↓↓←→←→ B A. Sliding window, so extra leading Ups still match.
#[derive(Default, Clone, Debug)]
pub struct Konami {
    buf: Vec<u8>,
}

pub const KONAMI: [u8; 10] = [UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A];

impl Konami {
    pub fn new() -> Konami {
        Konami::default()
    }
    /// Feed the buttons freshly pressed this step (direction/A/B only). True when the code completes.
    pub fn feed(&mut self, pressed: u8) -> bool {
        for b in [UP, DOWN, LEFT, RIGHT, B, A] {
            if pressed & b != 0 {
                self.buf.push(b);
                if self.buf.len() > KONAMI.len() {
                    self.buf.remove(0);
                }
                if self.buf == KONAMI {
                    self.buf.clear();
                    return true;
                }
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arrows_and_wasd() {
        let mut m = KeyMapper::new();
        assert_eq!(m.key_down("ArrowUp", None), Some(Action::Pad(UP)));
        assert_eq!(m.key_down("KeyW", Some('w')), Some(Action::Pad(UP)));
        assert_eq!(m.key_down("Space", Some(' ')), Some(Action::Pad(B)));
        assert_eq!(m.key_down("Enter", None), Some(Action::Pad(START)));
        assert_eq!(m.key_down("Tab", None), Some(Action::Pad(SELECT)));
        assert_eq!(m.key_down("F5", None), None);
    }
    #[test]
    fn azerty_and_qwertz_use_printed_letters() {
        let mut m = KeyMapper::new();
        // AZERTY: the physical KeyQ position prints 'a' -> LEFT
        assert_eq!(m.key_down("KeyQ", Some('a')), Some(Action::Pad(LEFT)));
        // AZERTY: physical KeyW prints 'z' -> A button (shoot), not UP
        assert_eq!(m.key_down("KeyW", Some('z')), Some(Action::Pad(A)));
        // QWERTZ: physical KeyY prints 'z' -> shoot
        assert_eq!(m.key_down("KeyY", Some('z')), Some(Action::Pad(A)));
        // QWERTZ: physical KeyZ prints 'y' (no binding) -> falls back to its physical position (shoot)
        assert_eq!(m.key_down("KeyZ", Some('y')), Some(Action::Pad(A)));
        // a letter with neither a printed nor a physical binding stays unmapped
        assert_eq!(m.key_down("KeyB", Some('b')), None);
        // uppercase (shift held) still works
        assert_eq!(m.key_down("KeyM", Some('M')), Some(Action::ToggleMute));
    }
    #[test]
    fn unmapped_letters_fall_back_to_position() {
        let mut m = KeyMapper::new();
        // Cyrillic layout: physical KeyW prints 'ц' -> fall back to physical UP
        assert_eq!(m.key_down("KeyW", Some('ц')), Some(Action::Pad(UP)));
        assert_eq!(m.key_down("KeyX", None), Some(Action::Pad(B)));
    }
    #[test]
    fn release_clears_exactly_the_pressed_action() {
        let mut m = KeyMapper::new();
        // press as 'a' (LEFT) on AZERTY KeyQ, layout "changes" before release: still LEFT released
        assert_eq!(m.key_down("KeyQ", Some('a')), Some(Action::Pad(LEFT)));
        assert_eq!(m.key_up("KeyQ"), Some(Action::Pad(LEFT)));
        assert_eq!(m.key_up("KeyQ"), None);
    }
    #[test]
    fn repeat_is_ignored() {
        let mut m = KeyMapper::new();
        assert!(m.key_down("ArrowLeft", None).is_some());
        assert!(m.key_down("ArrowLeft", None).is_none());
    }
    #[test]
    fn two_keys_one_button_stay_held_until_both_released() {
        let mut p = Pad::new();
        p.apply(Action::Pad(UP), true);
        p.apply(Action::Pad(UP), true);
        p.begin_step();
        p.apply(Action::Pad(UP), false);
        assert!(p.begin_step().is(UP));
        p.apply(Action::Pad(UP), false);
        assert!(!p.begin_step().is(UP));
    }
    #[test]
    fn fast_tap_within_one_frame_is_not_lost() {
        let mut p = Pad::new();
        p.apply(Action::Pad(A), true);
        p.apply(Action::Pad(A), false); // tap fully inside one render frame
        let s1 = p.begin_step();
        assert!(s1.pressed(A));
        let s2 = p.begin_step();
        assert!(s2.released & A != 0);
    }
    #[test]
    fn double_tap_gives_two_presses() {
        let mut p = Pad::new();
        for _ in 0..2 {
            p.apply(Action::Pad(B), true);
            p.apply(Action::Pad(B), false);
        }
        let mut presses = 0;
        for _ in 0..6 {
            if p.begin_step().pressed(B) {
                presses += 1;
            }
        }
        assert_eq!(presses, 2);
    }
    #[test]
    fn gamepad_merges_with_keyboard() {
        let mut p = Pad::new();
        p.set_gamepad(LEFT | A);
        let s = p.begin_step();
        assert!(s.is(LEFT) && s.is(A));
        p.apply(Action::Pad(UP), true);
        p.set_gamepad(0);
        p.begin_step();
        assert_eq!(p.begin_step().held, UP);
    }
    #[test]
    fn konami_basic_and_extra_leading_ups() {
        let mut k = Konami::new();
        let mut done = false;
        for b in KONAMI {
            done = k.feed(b);
        }
        assert!(done);
        let mut k = Konami::new();
        for _ in 0..4 {
            k.feed(UP);
        }
        let mut done = false;
        for b in &KONAMI[2..] {
            done = k.feed(*b);
        }
        assert!(done);
    }
    #[test]
    fn konami_wrong_sequence_fails() {
        let mut k = Konami::new();
        let mut done = false;
        for b in [UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, A, B] {
            done = k.feed(b);
        }
        assert!(!done);
    }
}
