//! The virtual NES pad. Keyboard and gamepad are merged into this; the game only
//! ever sees `Pad`. All timings in the game are in 60 Hz frames.

pub const UP: u32 = 1;
pub const DOWN: u32 = 2;
pub const LEFT: u32 = 4;
pub const RIGHT: u32 = 8;
/// shoot
pub const A: u32 = 16;
/// jump (mall), search (store)
pub const B: u32 = 32;
/// map
pub const SELECT: u32 = 64;
/// pause, confirm
pub const START: u32 = 128;

/// `Btn` in the TS source: `btn::UP`, `btn::A`, ...
pub mod btn {
    pub const UP: u32 = super::UP;
    pub const DOWN: u32 = super::DOWN;
    pub const LEFT: u32 = super::LEFT;
    pub const RIGHT: u32 = super::RIGHT;
    pub const A: u32 = super::A;
    pub const B: u32 = super::B;
    pub const SELECT: u32 = super::SELECT;
    pub const START: u32 = super::START;
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BtnName {
    Up,
    Down,
    Left,
    Right,
    A,
    B,
    Select,
    Start,
}

impl BtnName {
    pub fn mask(self) -> u32 {
        match self {
            BtnName::Up => UP,
            BtnName::Down => DOWN,
            BtnName::Left => LEFT,
            BtnName::Right => RIGHT,
            BtnName::A => A,
            BtnName::B => B,
            BtnName::Select => SELECT,
            BtnName::Start => START,
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            BtnName::Up => "UP",
            BtnName::Down => "DOWN",
            BtnName::Left => "LEFT",
            BtnName::Right => "RIGHT",
            BtnName::A => "A",
            BtnName::B => "B",
            BtnName::Select => "SELECT",
            BtnName::Start => "START",
        }
    }
}

pub const BTN_ORDER: [BtnName; 8] = [
    BtnName::Up,
    BtnName::Down,
    BtnName::Left,
    BtnName::Right,
    BtnName::A,
    BtnName::B,
    BtnName::Select,
    BtnName::Start,
];

/// One simulation step's view of the pad.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Pad {
    /// Buttons down during this step.
    pub held: u32,
    /// Buttons that went down at the start of this step (rising edge).
    pub pressed: u32,
    /// Buttons that were released at the start of this step.
    pub released: u32,
}

pub const NO_PAD: Pad = Pad { held: 0, pressed: 0, released: 0 };

pub fn has_btn(mask: u32, b: u32) -> bool {
    (mask & b) != 0
}

/// Build a Pad from a previous and a current held mask.
pub fn pad_from_held(prev_held: u32, held: u32) -> Pad {
    Pad { held, pressed: held & !prev_held, released: prev_held & !held }
}

/// `mask_of(&[BtnName::Up, BtnName::A])` -> bit mask. Handy for tests and the debug stepper.
pub fn mask_of(names: &[BtnName]) -> u32 {
    let mut m = 0;
    for n in names {
        m |= n.mask();
    }
    m
}

fn btn_from_key(key: &str) -> Option<u32> {
    BTN_ORDER.iter().find(|b| b.as_str() == key).map(|b| b.mask())
}

/// Parse "UP+A" / "up,a" / "LEFT" into a mask (used by the ?debug=1 stepper).
/// (The TS version also accepted a number, returned unchanged; callers with a number just use it directly.)
pub fn parse_buttons(spec: &str) -> u32 {
    let mut m = 0;
    for part in spec.split(|c: char| c == '+' || c == ',' || c == '|' || c.is_whitespace()) {
        let key = part.trim().to_uppercase();
        if let Some(b) = btn_from_key(&key) {
            m |= b;
        }
    }
    m
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_pressed_released_edges() {
        let p = pad_from_held(A | UP, A | B);
        assert_eq!(p.pressed, B);
        assert_eq!(p.released, UP);
        assert_eq!(p.held, A | B);
    }
    #[test]
    fn parses_button_specs() {
        assert_eq!(parse_buttons("UP+A"), UP | A);
        assert_eq!(parse_buttons("left, b"), LEFT | B);
        assert_eq!(parse_buttons(""), 0);
        assert_eq!(mask_of(&[BtnName::Up, BtnName::A]), UP | A);
    }
}
