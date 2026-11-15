//! Top-down characters: the agent (red trench coat) and the spies (black suit, fedora, shades).
//! Frames: 0 = stand, 1 and 2 = walk steps. Side sprites face RIGHT.

use crate::art::Registry;
use crate::pixel::{pal, Sprite};

/// Join parts (head, torso, legs) into one 16x16 frame, padding each row to 16 columns.
fn stack(parts: &[&[&str]]) -> Vec<String> {
    let mut rows: Vec<String> = Vec::new();
    for p in parts {
        for r in p.iter() {
            let mut s: String = r.chars().take(16).collect();
            while s.chars().count() < 16 {
                s.push('.');
            }
            rows.push(s);
        }
    }
    assert_eq!(rows.len(), 16, "frame must be 16 rows");
    rows
}

fn sprite(frames: &[Vec<String>], cols: [u8; 3]) -> Sprite {
    let fr: Vec<Vec<&str>> = frames.iter().map(|f| f.iter().map(|s| s.as_str()).collect()).collect();
    let fr2: Vec<&[&str]> = fr.iter().map(|v| v.as_slice()).collect();
    Sprite::from_frames(&fr2, cols)
}

// ----------------------------------------------------------------------------------------------- agent
const A_DOWN_HEAD: [&str; 7] = [
    "",
    ".....111111",
    "....11111111",
    "....11333311",
    "....13133131",
    "....13333331",
    ".....133331",
];
const A_UP_HEAD: [&str; 7] = [
    "",
    ".....111111",
    "....11111111",
    "....11111111",
    "....11111111",
    "....11111111",
    ".....111111",
];
const A_SIDE_HEAD: [&str; 7] = [
    "",
    "......11111",
    ".....1111111",
    ".....1111133",
    ".....1111313",
    ".....1111333",
    "......11133",
];
const A_DOWN_TORSO: [&str; 6] = [
    "...2222222222",
    "..222222222222",
    "..232222222232",
    "..232222222232",
    "..222221122222",
    "...2222222222",
];
const A_UP_TORSO: [&str; 6] = [
    "...2222222222",
    "..222222222222",
    "..232222222232",
    "..232222222232",
    "..222222222222",
    "...2222222222",
];
const A_SIDE_TORSO: [&str; 6] = [
    ".....22222222",
    ".....22222222",
    ".....222222223",
    ".....222222223",
    ".....22112222",
    ".....22222222",
];
const LEGS_FRONT: [[&str; 3]; 3] = [
    ["...2222..2222", "....111..111", ""],
    ["...2222..2222", "...1111...11", ""],
    ["...2222..2222", "....11...1111", ""],
];
const LEGS_SIDE: [[&str; 3]; 3] = [
    [".....22222222", "......111.111", ""],
    [".....222..222", ".....1111..11", ""],
    [".....222..222", "......11..1111", ""],
];

fn walker(head: &[&str; 7], torso: &[&str; 6], legs: &[[&str; 3]; 3], cols: [u8; 3]) -> Sprite {
    let fr: Vec<Vec<String>> = (0..3).map(|i| stack(&[head, torso, &legs[i]])).collect();
    sprite(&fr, cols)
}

pub fn register(r: &mut Registry) {
    let agent = [pal::BLACK, pal::RED, pal::TAN];
    r.insert("agent_td_down".into(), walker(&A_DOWN_HEAD, &A_DOWN_TORSO, &LEGS_FRONT, agent));
    r.insert("agent_td_up".into(), walker(&A_UP_HEAD, &A_UP_TORSO, &LEGS_FRONT, agent));
    r.insert("agent_td_side".into(), walker(&A_SIDE_HEAD, &A_SIDE_TORSO, &LEGS_SIDE, agent));
    r.insert(
        "agent_td_hold".into(),
        sprite(
            &[stack(&[
                &["....33....33", "....22....22", "....22.1111.22", "....22.1111.22", "....22111111.22", "....22133331.22"],
                &[".....13133131", ".....13333331", "......133331", "...2222222222", "..222222222222", "..222222222222"],
                &["..222221122222", "...2222222222", "...2222..2222", "....111..111"],
            ])],
            agent,
        ),
    );
    let stun_head = |dx: usize| -> Vec<&'static str> {
        // eyes as crosses + stars either side
        if dx == 0 {
            vec!["..3....3....3", ".....111111", ".3..11111111..3", "....11333311", "....13133131", "....13333331", ".....133331"]
        } else {
            vec!["....3....3....3", ".....111111", "..3.11111111.3", "....11333311", "....13133131", "....13333331", ".....133331"]
        }
    };
    let mk_stun = |i: usize| {
        let h = stun_head(i);
        let h: [&str; 7] = [h[0], h[1], h[2], h[3], h[4], h[5], h[6]];
        stack(&[&h, &A_DOWN_TORSO, &["...2222..2222", "...1111..1111", ""]])
    };
    r.insert("agent_td_stun".into(), sprite(&[mk_stun(0), mk_stun(1)], agent));

    // Spies: black suit (1), grey shirt/hat band (2), skin (3).
    let spy = [pal::BLACK, pal::LGRAY, pal::TAN];
    const S_DOWN_HEAD: [&str; 7] = [
        "....11111111",
        "...1111111111",
        "....12222221",
        "....11111111",
        "....13313331",
        "....13333331",
        ".....133331",
    ];
    const S_UP_HEAD: [&str; 7] = [
        "....11111111",
        "...1111111111",
        "....12222221",
        "....11111111",
        "....11111111",
        "....11111111",
        ".....111111",
    ];
    const S_SIDE_HEAD: [&str; 7] = [
        ".....1111111",
        "....111111111",
        ".....1222221",
        ".....1111111",
        ".....1111113",
        ".....1111333",
        "......11133",
    ];
    const S_DOWN_TORSO: [&str; 6] = [
        "...1111221111",
        "..11111221111",
        "..31111221113",
        "..31111221113",
        "..11111221111",
        "...1111111111",
    ];
    const S_UP_TORSO: [&str; 6] = [
        "...1111111111",
        "..111111111111",
        "..311112211113",
        "..311112211113",
        "..111112211111",
        "...1111111111",
    ];
    const S_SIDE_TORSO: [&str; 6] = [
        ".....11111111",
        ".....11122111",
        ".....111221113",
        ".....11122113",
        ".....11111111",
        ".....11111111",
    ];
    const SL_FRONT: [[&str; 3]; 3] = [
        ["...1111..1111", "....11....11", ""],
        ["...1111..1111", "...111....11", ""],
        ["...1111..1111", "....11....111", ""],
    ];
    const SL_SIDE: [[&str; 3]; 3] = [
        [".....11111111", "......11..11", ""],
        [".....111..111", ".....111...11", ""],
        [".....111..111", "......11...111", ""],
    ];
    r.insert("spy_td_down".into(), walker(&S_DOWN_HEAD, &S_DOWN_TORSO, &SL_FRONT, spy));
    r.insert("spy_td_up".into(), walker(&S_UP_HEAD, &S_UP_TORSO, &SL_FRONT, spy));
    r.insert("spy_td_side".into(), walker(&S_SIDE_HEAD, &S_SIDE_TORSO, &SL_SIDE, spy));
}

#[cfg(test)]
mod tests {
    use crate::art;

    #[test]
    fn walkers_have_three_distinct_frames() {
        for n in ["agent_td_down", "agent_td_up", "agent_td_side", "spy_td_down", "spy_td_up", "spy_td_side"] {
            let s = art::get(n);
            assert_eq!(s.frame_count(), 3, "{n}");
            assert!(s.frames[0] != s.frames[1] && s.frames[1] != s.frames[2] && s.frames[0] != s.frames[2], "{n}: walk frames identical");
        }
        assert_ne!(art::get("agent_td_stun").frames[0], art::get("agent_td_stun").frames[1]);
    }
}
