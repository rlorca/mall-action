//! Virtual NES pad: keyboard + gamepad merged into 8 buttons.
//!
//! * Letter keys are matched by their PRINTED letter (QWERTZ / AZERTY just work). Everything else, and any
//!   letter we do not map, falls back to the physical key position (`code`, e.g. "ArrowUp", "KeyZ").
//! * A release clears exactly what the press set (tracked per physical key), so keys never stick.
//! * Key events are queued, and each simulation step consumes them so that a tap that is pressed and released
//!   inside one rendered frame is still seen as a held frame, and rapid repeated taps keep their edges.

use std::collections::{HashMap, VecDeque};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Button {
    Up,
    Down,
    Left,
    Right,
    A,
    B,
    Select,
    Start,
}

impl Button {
    pub const ALL: [Button; 8] = [
        Button::Up,
        Button::Down,
        Button::Left,
        Button::Right,
        Button::A,
        Button::B,
        Button::Select,
        Button::Start,
    ];
    pub const fn mask(self) -> u8 {
        1 << (self as u8)
    }
}

pub const UP: u8 = Button::Up.mask();
pub const DOWN: u8 = Button::Down.mask();
pub const LEFT: u8 = Button::Left.mask();
pub const RIGHT: u8 = Button::Right.mask();
pub const A: u8 = Button::A.mask();
pub const B: u8 = Button::B.mask();
pub const SELECT: u8 = Button::Select.mask();
pub const START: u8 = Button::Start.mask();

/// What the game sees on one simulation step.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct PadState {
    pub held: u8,
    /// Buttons that went down on this step.
    pub pressed: u8,
    /// Buttons that went up on this step.
    pub released: u8,
}

impl PadState {
    pub fn from_held(prev_held: u8, held: u8) -> PadState {
        PadState { held, pressed: held & !prev_held, released: prev_held & !held }
    }
    pub fn is_held(&self, b: u8) -> bool {
        self.held & b != 0
    }
    pub fn just_pressed(&self, b: u8) -> bool {
        self.pressed & b != 0
    }
    pub fn any_pressed(&self) -> bool {
        self.pressed != 0
    }
    /// Horizontal axis -1 / 0 / 1 (Left wins nothing: both held cancels).
    pub fn dx(&self) -> i32 {
        (self.is_held(RIGHT) as i32) - (self.is_held(LEFT) as i32)
    }
    pub fn dy(&self) -> i32 {
        (self.is_held(DOWN) as i32) - (self.is_held(UP) as i32)
    }
}

/// Map a printed letter to a button (letters only).
fn button_for_letter(c: char) -> u8 {
    match c.to_ascii_lowercase() {
        'w' => UP,
        'a' => LEFT,
        's' => DOWN,
        'd' => RIGHT,
        'z' | 'j' => A,
        'x' | 'k' => B,
        _ => 0,
    }
}

/// Map a physical key code (W3C `KeyboardEvent.code` names) to a button.
fn button_for_code(code: &str) -> u8 {
    match code {
        "ArrowUp" | "KeyW" => UP,
        "ArrowDown" | "KeyS" => DOWN,
        "ArrowLeft" | "KeyA" => LEFT,
        "ArrowRight" | "KeyD" => RIGHT,
        "KeyZ" | "KeyJ" => A,
        "KeyX" | "KeyK" | "Space" => B,
        "ShiftLeft" | "ShiftRight" | "Tab" => SELECT,
        "Enter" | "NumpadEnter" => START,
        _ => 0,
    }
}

/// Resolve a key event to a button mask. `printed` is the character the key prints on the user's layout
/// (None for non-printing keys); `code` is the physical position.
pub fn resolve_key(printed: Option<char>, code: &str) -> u8 {
    if let Some(c) = printed {
        if c.is_ascii_alphabetic() {
            let m = button_for_letter(c);
            if m != 0 {
                return m;
            }
        }
    }
    button_for_code(code)
}

/// Which action key (outside the pad) a key event means.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HostKey {
    ToggleCrt,
    ToggleMute,
}

pub fn host_key(printed: Option<char>, code: &str) -> Option<HostKey> {
    if let Some(c) = printed {
        match c.to_ascii_lowercase() {
            'c' => return Some(HostKey::ToggleCrt),
            'm' => return Some(HostKey::ToggleMute),
            _ => {}
        }
    }
    match code {
        "KeyC" if !printed.map_or(false, |c| c.is_ascii_alphabetic()) => Some(HostKey::ToggleCrt),
        "KeyM" if !printed.map_or(false, |c| c.is_ascii_alphabetic()) => Some(HostKey::ToggleMute),
        _ => None,
    }
}

/// Standard-mapping gamepad: buttons 0 (A), 1 (B), 8 (Select), 9 (Start), 12-15 D-pad; axes 0/1 left stick.
pub fn gamepad_mask(buttons: &[bool], axes: &[f32]) -> u8 {
    let b = |i: usize| buttons.get(i).copied().unwrap_or(false);
    let mut m = 0;
    if b(0) {
        m |= A;
    }
    if b(1) {
        m |= B;
    }
    if b(8) {
        m |= SELECT;
    }
    if b(9) {
        m |= START;
    }
    if b(12) {
        m |= UP;
    }
    if b(13) {
        m |= DOWN;
    }
    if b(14) {
        m |= LEFT;
    }
    if b(15) {
        m |= RIGHT;
    }
    m | stick_mask(axes.first().copied().unwrap_or(0.0), axes.get(1).copied().unwrap_or(0.0))
}

pub fn stick_mask(x: f32, y: f32) -> u8 {
    const DEAD: f32 = 0.5;
    let mut m = 0;
    if x < -DEAD {
        m |= LEFT;
    }
    if x > DEAD {
        m |= RIGHT;
    }
    if y < -DEAD {
        m |= UP;
    }
    if y > DEAD {
        m |= DOWN;
    }
    m
}

#[derive(Clone, Debug)]
pub struct InputMapper {
    /// physical key code -> mask it set when pressed
    down: HashMap<String, u8>,
    /// queued transitions (button mask single bit, is_down)
    queue: VecDeque<(u8, bool)>,
    /// level the sim has most recently been shown for keyboard
    key_level: u8,
    pad_level: u8,
    prev_held: u8,
}

impl Default for InputMapper {
    fn default() -> Self {
        InputMapper::new()
    }
}

impl InputMapper {
    pub fn new() -> InputMapper {
        InputMapper { down: HashMap::new(), queue: VecDeque::new(), key_level: 0, pad_level: 0, prev_held: 0 }
    }

    /// Key went down. Repeats (auto-repeat) of an already-down key are ignored.
    pub fn key_down(&mut self, printed: Option<char>, code: &str) {
        if self.down.contains_key(code) {
            return;
        }
        let m = resolve_key(printed, code);
        self.down.insert(code.to_string(), m);
        for b in Button::ALL {
            if m & b.mask() != 0 {
                self.push(b.mask(), true);
            }
        }
    }

    /// Key went up: clears exactly what this physical key set, whatever it prints now.
    pub fn key_up(&mut self, code: &str) {
        if let Some(m) = self.down.remove(code) {
            for b in Button::ALL {
                if m & b.mask() != 0 {
                    // only release the button if no other physical key still holds it
                    let still = self.down.values().any(|o| o & b.mask() != 0);
                    if !still {
                        self.push(b.mask(), false);
                    }
                }
            }
        }
    }

    /// Window lost focus: release everything.
    pub fn release_all(&mut self) {
        let codes: Vec<String> = self.down.keys().cloned().collect();
        for c in codes {
            self.key_up(&c);
        }
    }

    pub fn set_gamepad(&mut self, mask: u8) {
        self.pad_level = mask;
    }

    fn push(&mut self, bit: u8, down: bool) {
        if self.queue.len() >= 128 {
            self.queue.pop_front();
        }
        self.queue.push_back((bit, down));
    }

    /// Produce the pad state for the next simulation step.
    pub fn step(&mut self) -> PadState {
        // Apply queued transitions, at most one per button per step, so a down+up inside one frame
        // still yields a held step and a released step.
        let mut touched = 0u8;
        while let Some(&(bit, down)) = self.queue.front() {
            if touched & bit != 0 {
                break;
            }
            touched |= bit;
            if down {
                self.key_level |= bit;
            } else {
                self.key_level &= !bit;
            }
            self.queue.pop_front();
        }
        let held = self.key_level | self.pad_level;
        let st = PadState::from_held(self.prev_held, held);
        self.prev_held = held;
        st
    }
}

/// Konami code matcher: Up Up Down Down Left Right Left Right B A. Extra leading Ups are fine because the
/// match is on the most recent ten presses.
#[derive(Clone, Debug, Default)]
pub struct Konami {
    recent: Vec<u8>,
}

impl Konami {
    const CODE: [u8; 10] = [UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A];

    pub fn new() -> Konami {
        Konami { recent: Vec::new() }
    }

    /// Feed one step's presses; true when the code has just been completed.
    pub fn feed(&mut self, pressed: u8) -> bool {
        for b in Button::ALL {
            if pressed & b.mask() != 0 && b.mask() & (UP | DOWN | LEFT | RIGHT | A | B) != 0 {
                self.recent.push(b.mask());
                if self.recent.len() > 10 {
                    self.recent.remove(0);
                }
                if self.recent.len() == 10 && self.recent[..] == Self::CODE[..] {
                    self.recent.clear();
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
    fn letter_keys_match_printed_letter_on_qwertz() {
        // On QWERTZ the key printed "Z" sits at physical KeyY.
        assert_eq!(resolve_key(Some('z'), "KeyY"), A);
        // and the physical KeyZ position prints "Y": not a mapped letter, falls back to position (shoot).
        assert_eq!(resolve_key(Some('y'), "KeyZ"), A);
    }

    #[test]
    fn letter_keys_match_printed_letter_on_azerty() {
        // AZERTY: the key printed "W" is at physical KeyZ; the key printed "Z" is at physical KeyW.
        assert_eq!(resolve_key(Some('w'), "KeyZ"), UP);
        assert_eq!(resolve_key(Some('z'), "KeyW"), A);
        // printed "A" is at physical KeyQ
        assert_eq!(resolve_key(Some('a'), "KeyQ"), LEFT);
        assert_eq!(resolve_key(Some('A'), "KeyQ"), LEFT);
    }

    #[test]
    fn non_letters_use_physical_position() {
        assert_eq!(resolve_key(None, "ArrowUp"), UP);
        assert_eq!(resolve_key(None, "Space"), B);
        assert_eq!(resolve_key(None, "Enter"), START);
        assert_eq!(resolve_key(None, "ShiftLeft"), SELECT);
        assert_eq!(resolve_key(None, "Tab"), SELECT);
    }

    #[test]
    fn unmapped_letters_fall_back_to_position() {
        // Cyrillic layout: key at physical KeyW prints a non-latin letter
        assert_eq!(resolve_key(Some('ц'), "KeyW"), UP);
        assert_eq!(resolve_key(None, "KeyJ"), A);
        assert_eq!(resolve_key(Some('q'), "KeyP"), 0);
    }

    #[test]
    fn host_keys() {
        assert_eq!(host_key(Some('c'), "KeyC"), Some(HostKey::ToggleCrt));
        assert_eq!(host_key(Some('M'), "Semicolon"), Some(HostKey::ToggleMute));
        assert_eq!(host_key(Some('x'), "KeyX"), None);
    }

    #[test]
    fn release_clears_exactly_the_pressed_key() {
        let mut m = InputMapper::new();
        m.key_down(Some('d'), "KeyD");
        assert!(m.step().is_held(RIGHT));
        // shift changes what the release event would print; release is by physical key, so it still clears
        m.key_up("KeyD");
        let s = m.step();
        assert!(!s.is_held(RIGHT));
        assert!(s.released & RIGHT != 0);
    }

    #[test]
    fn two_keys_one_button_stay_held_until_both_up() {
        let mut m = InputMapper::new();
        m.key_down(Some('z'), "KeyZ");
        m.key_down(Some('j'), "KeyJ");
        m.step();
        m.key_up("KeyZ");
        assert!(m.step().is_held(A));
        m.key_up("KeyJ");
        assert!(!m.step().is_held(A));
    }

    #[test]
    fn auto_repeat_is_ignored() {
        let mut m = InputMapper::new();
        m.key_down(None, "ArrowLeft");
        assert!(m.step().just_pressed(LEFT));
        m.key_down(None, "ArrowLeft");
        assert!(!m.step().just_pressed(LEFT));
    }

    #[test]
    fn tap_inside_one_frame_is_not_lost() {
        let mut m = InputMapper::new();
        m.key_down(None, "Space");
        m.key_up("Space");
        let s1 = m.step();
        assert!(s1.just_pressed(B), "tap must be visible for one step");
        let s2 = m.step();
        assert!(!s2.is_held(B));
        assert!(s2.released & B != 0);
    }

    #[test]
    fn rapid_taps_keep_their_edges() {
        let mut m = InputMapper::new();
        for _ in 0..3 {
            m.key_down(None, "Space");
            m.key_up("Space");
        }
        let mut presses = 0;
        for _ in 0..8 {
            if m.step().just_pressed(B) {
                presses += 1;
            }
        }
        assert_eq!(presses, 3);
    }

    #[test]
    fn release_all_clears_everything() {
        let mut m = InputMapper::new();
        m.key_down(None, "ArrowUp");
        m.key_down(None, "ArrowLeft");
        m.step();
        m.release_all();
        let s = m.step();
        assert_eq!(s.held, 0);
        assert!(m.step().held == 0);
    }

    #[test]
    fn gamepad_merges_with_keyboard() {
        let mut m = InputMapper::new();
        m.key_down(None, "ArrowLeft");
        m.set_gamepad(A);
        let s = m.step();
        assert!(s.is_held(LEFT) && s.is_held(A));
        m.set_gamepad(0);
        assert!(m.step().is_held(LEFT));
    }

    #[test]
    fn gamepad_buttons_and_stick() {
        let mut b = vec![false; 16];
        b[0] = true;
        b[9] = true;
        b[12] = true;
        let m = gamepad_mask(&b, &[0.9, 0.0]);
        assert_eq!(m, A | START | UP | RIGHT);
        assert_eq!(gamepad_mask(&[], &[-1.0, 1.0]), LEFT | DOWN);
        assert_eq!(gamepad_mask(&[], &[0.2, -0.3]), 0);
        let mut b2 = vec![false; 16];
        b2[1] = true;
        b2[8] = true;
        assert_eq!(gamepad_mask(&b2, &[]), B | SELECT);
    }

    fn feed_all(k: &mut Konami, seq: &[u8]) -> bool {
        let mut hit = false;
        for &b in seq {
            hit |= k.feed(b);
        }
        hit
    }

    #[test]
    fn konami_code_detected() {
        let mut k = Konami::new();
        assert!(feed_all(&mut k, &[UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A]));
    }

    #[test]
    fn konami_with_extra_leading_ups() {
        let mut k = Konami::new();
        assert!(feed_all(&mut k, &[UP, UP, UP, UP, UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A]));
    }

    #[test]
    fn konami_wrong_sequence_does_not_fire() {
        let mut k = Konami::new();
        assert!(!feed_all(&mut k, &[UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, A, B]));
    }

    #[test]
    fn dx_dy() {
        let s = PadState::from_held(0, LEFT | UP);
        assert_eq!((s.dx(), s.dy()), (-1, -1));
        let s = PadState::from_held(0, LEFT | RIGHT);
        assert_eq!(s.dx(), 0);
    }
}
