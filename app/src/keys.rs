//! Keyboard: macroquad key codes -> DOM-style codes + printed letters -> virtual pad actions.
use macroquad::prelude::*;
use mall_core::input::{Action, KeyMapper};

pub struct Keys {
    mapper: KeyMapper,
    held: Vec<(KeyCode, &'static str)>,
}

fn code_of(k: KeyCode) -> Option<&'static str> {
    Some(match k {
        KeyCode::Up => "ArrowUp",
        KeyCode::Down => "ArrowDown",
        KeyCode::Left => "ArrowLeft",
        KeyCode::Right => "ArrowRight",
        KeyCode::Space => "Space",
        KeyCode::LeftShift => "ShiftLeft",
        KeyCode::RightShift => "ShiftRight",
        KeyCode::Tab => "Tab",
        KeyCode::Enter => "Enter",
        KeyCode::KpEnter => "NumpadEnter",
        KeyCode::A => "KeyA",
        KeyCode::B => "KeyB",
        KeyCode::C => "KeyC",
        KeyCode::D => "KeyD",
        KeyCode::E => "KeyE",
        KeyCode::F => "KeyF",
        KeyCode::G => "KeyG",
        KeyCode::H => "KeyH",
        KeyCode::I => "KeyI",
        KeyCode::J => "KeyJ",
        KeyCode::K => "KeyK",
        KeyCode::L => "KeyL",
        KeyCode::M => "KeyM",
        KeyCode::N => "KeyN",
        KeyCode::O => "KeyO",
        KeyCode::P => "KeyP",
        KeyCode::Q => "KeyQ",
        KeyCode::R => "KeyR",
        KeyCode::S => "KeyS",
        KeyCode::T => "KeyT",
        KeyCode::U => "KeyU",
        KeyCode::V => "KeyV",
        KeyCode::W => "KeyW",
        KeyCode::X => "KeyX",
        KeyCode::Y => "KeyY",
        KeyCode::Z => "KeyZ",
        _ => return None,
    })
}

impl Keys {
    pub fn new() -> Keys {
        Keys { mapper: KeyMapper::new(), held: vec![] }
    }

    /// New key events this frame: (action, pressed?). A release always clears exactly the action
    /// its press set; keys that silently went up (missed events) are released too.
    pub fn poll(&mut self) -> Vec<(Action, bool)> {
        let mut out = vec![];
        // printed characters typed this frame (to pair with letter keys: QWERTZ / AZERTY support)
        let mut chars: Vec<char> = vec![];
        while let Some(c) = get_char_pressed() {
            if c.is_alphabetic() {
                chars.push(c);
            }
        }
        let mut pressed: Vec<KeyCode> = get_keys_pressed().into_iter().collect();
        pressed.sort_by_key(|k| *k as u32);
        for k in pressed {
            let Some(code) = code_of(k) else { continue };
            let is_letter = code.starts_with("Key");
            let ch = if is_letter && !chars.is_empty() { Some(chars.remove(0)) } else { None };
            if let Some(a) = self.mapper.key_down(code, ch) {
                self.held.push((k, code));
                out.push((a, true));
            }
        }
        // releases (explicit events, or keys that are no longer down)
        let mut still = vec![];
        for (k, code) in std::mem::take(&mut self.held) {
            if is_key_down(k) {
                still.push((k, code));
            } else if let Some(a) = self.mapper.key_up(code) {
                out.push((a, false));
            }
        }
        self.held = still;
        out
    }

    pub fn release_all(&mut self) -> Vec<Action> {
        self.held.clear();
        self.mapper.release_all()
    }
}
