//! Effects, bullets, icons and power-ups (art agent 1). Every sprite uses at most 3 colours.
use super::characters::frames_of;
use super::Registry;
use crate::pixel::pal;

fn ins(r: &mut Registry, name: &str, blocks: &[&str], w: usize, h: usize, c: [u8; 3]) {
    r.insert(name.into(), frames_of(blocks, w, h, c));
}

pub fn register(r: &mut Registry) {
    effects(r);
    effects2(r);
    powerups(r);
}

fn effects(r: &mut Registry) {
    // Bullets: 4x2 bright pills, hot core and coloured ends.
    ins(r, "bullet_player", &["2112\n2112"], 4, 2, [pal::WHITE, pal::LYELLOW, pal::ORANGE]);
    ins(r, "bullet_enemy", &["2112\n2112"], 4, 2, [pal::WHITE, pal::LRED, pal::RED]);
    ins(r, "bullet_td", &[".22.\n2112\n2112\n.22."], 4, 4, [pal::WHITE, pal::LYELLOW, pal::ORANGE]);
    ins(r, "bullet_td_enemy", &[".22.\n2112\n2112\n.22."], 4, 4, [pal::WHITE, pal::LRED, pal::RED]);

    // Hit spark: a star bursting outward, then fading.
    ins(
        r,
        "spark",
        &[
            "
........
...1....
..121...
.12321..
..121...
...1....
........
........
",
            "
...2....
.2.2.2..
..212...
22.3.22.
..212...
.2.2.2..
...2....
........
",
            "
2..2..2.
........
..2..2..
........
.2....2.
........
2..2..2.
........
",
        ],
        8,
        8,
        [pal::ORANGE, pal::YELLOW, pal::WHITE],
    );

    // Smoke puff: grows and thins out (dithered edge in the last frame).
    ins(
        r,
        "puff_smoke",
        &[
            "
................
................
................
................
................
......3333......
.....322223.....
.....322223.....
.....322223.....
......3333......
................
................
................
................
................
................
",
            "
................
................
................
....33333333....
...3222222223...
..322222222223..
..322222222223..
..322222222223..
..322222222223..
...3222222223...
....33333333....
................
................
................
................
................
",
            "
................
.....333333.....
...3332222333...
..322222222223..
.32222222222223.
.32222222222223.
.32222222222223.
.32222222222223.
.32222222222223.
..322222222223..
...3332222333...
.....333333.....
................
................
................
................
",
            "
................
................
...3.3..3.3.....
..2...22....2...
.3..........3...
.2....3.....2...
.3..........3...
.2..3....3..3...
.3..........2...
..2..........2..
...3..2..3..3...
................
................
................
................
................
",
        ],
        16,
        16,
        [pal::DGRAY, pal::LGRAY, pal::GRAY],
    );
}

fn coin_frames(mark: char) -> Vec<String> {
    let m = mark.to_string();
    let full = format!("..1111..\n.122221.\n123222 21\n1232{m}221\n1222{m}221\n12222221\n.122221.\n..1111..").replace(' ', "");
    let three = format!("...11...\n..1221..\n.123221.\n.12{m}221.\n.12{m}221.\n.122221.\n..1221..\n...11...");
    let edge = "...11...\n...12...\n...12...\n...12...\n...12...\n...12...\n...12...\n...11...".to_string();
    vec![full, three.clone(), edge, three]
}

fn effects2(r: &mut Registry) {
    let silver = coin_frames('2');
    let refs: Vec<&str> = silver.iter().map(String::as_str).collect();
    ins(r, "coin", &refs, 8, 8, [pal::DGRAY, pal::LGRAY, pal::WHITE]);
    let gold = coin_frames('1');
    let refs: Vec<&str> = gold.iter().map(String::as_str).collect();
    ins(r, "gold_coin", &refs, 8, 8, [pal::ORANGE, pal::LYELLOW, pal::WHITE]);

    ins(
        r,
        "lamp_shards",
        &[
            "
.......3........
..2.........2...
....1...3.......
.3.....22....3..
...2.1.......2..
.2.....2..3.....
...1..2...1..2..
.2..2....2...1.2
",
            "
................
................
...3.......3....
.2.......2...2..
....1..2.....1..
.2..2.....3.....
..1...2..1...2..
.2..2.2.2..2.1.2
",
            "
................
................
................
................
.......3........
...2.1.......2..
.1....2..2...1..
1.2.1.2.22.2.12.
",
        ],
        16,
        8,
        [pal::BROWN, pal::ORANGE, pal::LYELLOW],
    );

    ins(
        r,
        "exclaim",
        &["
..1111..
.123221.
.122221.
.122221.
..1221..
..1111..
..1221..
..1111..
"],
        8,
        8,
        [pal::RED, pal::YELLOW, pal::WHITE],
    );
    ins(
        r,
        "armor_icon",
        &["
.11..11.
12211221
12222221
12222221
12322221
.122221.
.122221.
..1111..
"],
        8,
        8,
        [pal::BLUE, pal::SKY, pal::WHITE],
    );
    ins(
        r,
        "radar_icon",
        &["
..1111..
.1....1.
1....2.1
1...2..1
1..22.31
1.....31
.1....1.
..1111..
"],
        8,
        8,
        [pal::GREEN, pal::LGREEN, pal::WHITE],
    );
    ins(
        r,
        "package",
        &["
................
.11111111111111.
.12222233222221.
.12222233222221.
.11111133111111.
.12222233222221.
.12222233222221.
.12333333332221.
.12322222232221.
.12322222232221.
.12333333332221.
.12222233222221.
.12222233222221.
.12222233222221.
.11111111111111.
................
"],
        16,
        16,
        [pal::DBROWN, pal::ORANGE, pal::LYELLOW],
    );
    ins(
        r,
        "package_small",
        &["
........
.111111.
.122321.
.111311.
.122321.
.122321.
.111111.
........
"],
        8,
        8,
        [pal::DBROWN, pal::ORANGE, pal::LYELLOW],
    );
    ins(
        r,
        "receipt",
        &[
            "
.222222.
.211122.
.222222.
.221112.
.222222.
.211222.
.222222.
.211112.
.222222.
.221122.
.222222.
.211122.
.222222.
.222222.
.2.22.2.
..2..2..
",
            "
.222222.
.221112.
.222222.
.211122.
.222222.
.221122.
.222222.
.211112.
.222222.
.211222.
.222222.
.221112.
.222222.
.222222.
..2.22.2
.2..2...
",
        ],
        8,
        16,
        [pal::GRAY, pal::WHITE, pal::LGRAY],
    );
    ins(
        r,
        "shoe",
        &[
            "
........
.11.....
.121....
.1221...
.12221..
.1222211
.1333331
..111111
",
            "
..111111
.1333331
.1222211
.12221..
.1221...
.121....
.11.....
........
",
        ],
        8,
        8,
        [pal::BLACK, pal::RED, pal::WHITE],
    );
    ins(
        r,
        "phone_flash",
        &[
            "
................
................
.......33.......
.......33.......
.....3.22.3.....
......3222......
...3..32123..3..
..33.2221222.33.
..33.2221222.33.
...3..32123..3..
......3222......
.....3.22.3.....
.......33.......
.......33.......
................
................
",
            "
...3....3....3..
....3...3...3...
..3...3.2.3...3.
...3...222...3..
3...3..2222.3...
.3...3222222..3.
..3..22211222..3
333..22211222.33
333..22211222.33
..3..22211222..3
.3...3222222..3.
3...3..2222.3...
...3...222...3..
..3...3.2.3...3.
....3...3...3...
...3....3....3..
",
        ],
        16,
        16,
        [pal::WHITE, pal::LYELLOW, pal::YELLOW],
    );
    ins(
        r,
        "heart",
        &["
.11..11.
13211221
12222221
12222221
.122221.
..1221..
...11...
........
"],
        8,
        8,
        [pal::DRED, pal::RED, pal::WHITE],
    );
}

fn powerups(r: &mut Registry) {
    // Rapid fire: three speeding bullets with trails.
    ins(
        r,
        "pu_rapid",
        &["
............
.1.11222223.
.1.11222223.
............
..1.11222223
..1.11222223
............
.1.11222223.
.1.11222223.
............
............
............
"],
        12,
        12,
        [pal::ORANGE, pal::YELLOW, pal::WHITE],
    );
    // Spread: three shots fanning out from the muzzle.
    ins(
        r,
        "pu_spread",
        &["
...........3
.........23.
........22..
.......22...
......22....
.11..22.....
.11..2222223
.11..22.....
......22....
.......22...
........22..
.........23.
"],
        12,
        12,
        [pal::LMAGENTA, pal::LPINK, pal::WHITE],
    );
    // Armor: a bullet-proof vest.
    ins(
        r,
        "pu_armor",
        &["
..11....11..
.1221..1221.
122221122221
122222222221
123222222221
122222112221
122222222221
122212221221
.1222222221.
.1222222221.
..12222221..
...111111...
"],
        12,
        12,
        [pal::DBLUE, pal::SKY, pal::WHITE],
    );
    // Sneakers: a red hi-top with a white sole.
    ins(
        r,
        "pu_sneakers",
        &["
............
.333333.....
.311113.....
.312123.....
.311113.....
.312123.....
.3111133333.
.311111111 13
.3111111111 3
.32222222223
.33333333333
............
"
        .replace(' ', "")
        .as_str()],
        12,
        12,
        [pal::RED, pal::WHITE, pal::BLACK],
    );
    // Radar: a dish on a stand, signal arcs.
    ins(
        r,
        "pu_radar",
        &["
.....11.....
...112211...
..122222231.
.1222222331.
.1222223321.
122222332221
122222322221
.1222222221.
.1232222221.
..12222221..
...112211...
.....11.....
"],
        12,
        12,
        [pal::LGREEN, pal::DGREEN, pal::WHITE],
    );
    // 1UP: green plate with a heart and the label.
    ins(
        r,
        "pu_oneup",
        &["
..11111111..
.1222222221.
122222222221
123232323331
133232323231
123232323331
123232323221
123233323221
122222222221
122222222221
.1222222221.
..11111111..
"],
        12,
        12,
        [pal::DGREEN, pal::LGREEN, pal::WHITE],
    );
    // Cinnabomb: cinnamon roll with a lit fuse.
    ins(
        r,
        "pu_cinnabomb",
        &["
........3.3.
.........3..
......11....
...1111.1...
..12222221..
.1222222221.
.1221111221.
.1213..3121.
.1213333121.
.1221111221.
..12222221..
...111111...
"],
        12,
        12,
        [pal::DBROWN, pal::ORANGE, pal::LYELLOW],
    );
    // Juice: orange juice cup with a straw.
    ins(
        r,
        "pu_juice",
        &["
.........33.
........33..
.......33...
.2222233222.
.2222222222.
.2111111112.
.2113111112.
..21111112..
..21111112..
..21111112..
...211112...
...222222...
"],
        12,
        12,
        [pal::ORANGE, pal::WHITE, pal::RED],
    );
    // Pretzel: salted soft pretzel.
    ins(
        r,
        "pu_pretzel",
        &["
.1111111111.
123222222321
122122221221
221.1221.122
231122221132
122223222221
.1222232221.
..11222211..
..12311321..
.1221..1221.
.121....121.
..1......1..
"],
        12,
        12,
        [pal::BROWN, pal::ORANGE, pal::WHITE],
    );
}

#[cfg(test)]
mod tests {
    use crate::art;

    #[test]
    fn bullets_are_bright_pills() {
        for n in ["bullet_player", "bullet_enemy"] {
            let s = art::get(n);
            assert_eq!((s.w, s.h), (4, 2));
            assert!(s.frames[0].iter().all(|p| *p != 0), "{n} must be a solid pill");
        }
        assert_ne!(art::get("bullet_player").colors, art::get("bullet_enemy").colors);
    }

    #[test]
    fn coins_spin_from_flat_to_edge() {
        let width = |name: &str, f: usize| -> usize {
            let s = art::get(name);
            (0..s.w).filter(|&x| (0..s.h).any(|y| s.frames[f][y * s.w + x] != 0)).count()
        };
        for n in ["coin", "gold_coin"] {
            assert!(width(n, 0) > width(n, 1) && width(n, 1) > width(n, 2), "{n} should narrow to an edge");
            assert_eq!(width(n, 1), width(n, 3), "{n} spin is symmetric");
        }
        assert_ne!(art::get("coin").colors, art::get("gold_coin").colors);
    }

    #[test]
    fn powerup_icons_are_all_different() {
        let names = [
            "pu_rapid", "pu_spread", "pu_armor", "pu_sneakers", "pu_radar", "pu_oneup", "pu_cinnabomb", "pu_juice", "pu_pretzel",
        ];
        for (i, a) in names.iter().enumerate() {
            for b in &names[i + 1..] {
                assert_ne!(art::get(a).frames, art::get(b).frames, "{a} and {b} look the same");
            }
            let s = art::get(a);
            let filled = s.frames[0].iter().filter(|p| **p != 0).count();
            assert!(filled >= 30, "{a} is too sparse to read ({filled} px)");
        }
    }

    #[test]
    fn smoke_and_spark_animate() {
        for n in ["spark", "puff_smoke", "receipt", "shoe", "phone_flash", "lamp_shards"] {
            let s = art::get(n);
            assert_ne!(s.frames[0], s.frames[1], "{n} frames must differ");
        }
    }
}
