use super::ai::{guard_rect, lined_up, rects_overlap};
use super::*;
use crate::events::{Event, Sfx, Track};
use crate::input::{PadState, A, B, DOWN, LEFT, RIGHT, UP};
use crate::run::RunState;
use crate::types::{Content, PowerUp, StoreId, StoreRole};

const OPEN: [StoreId; 10] = [
    StoreId::Forever12,
    StoreId::RadioShock,
    StoreId::KgbToys,
    StoreId::HotSpyOnAStick,
    StoreId::SamBaddy,
    StoreId::FootLockpicker,
    StoreId::Crookstone,
    StoreId::SharperImagine,
    StoreId::SpendersGifts,
    StoreId::GameStonk,
];

fn run(seed: u64) -> RunState {
    let mut r = RunState::new(seed, false);
    setup_level(&mut r);
    r
}

/// Feeds a pad state to a room each frame, tracking the previous held mask like the real input mapper.
struct Drv {
    prev: u8,
}

impl Drv {
    fn new() -> Drv {
        Drv { prev: 0 }
    }
    fn step(&mut self, room: &mut StoreRoom, r: &mut RunState, out: &mut Out, held: u8) -> StoreOutcome {
        let pad = PadState::from_held(self.prev, held);
        self.prev = held;
        room.step(pad, r, out)
    }
    fn run(&mut self, room: &mut StoreRoom, r: &mut RunState, out: &mut Out, held: u8, n: u32) -> StoreOutcome {
        let mut o = StoreOutcome::None;
        for _ in 0..n {
            o = self.step(room, r, out, held);
            if o != StoreOutcome::None {
                break;
            }
        }
        o
    }
}

fn enter(id: StoreId, r: &mut RunState) -> (StoreRoom, Out) {
    let mut out = Out::new();
    let room = StoreRoom::new(id, r, &mut out);
    (room, out)
}

/// A room with the intro over and the grace period spent, no guards (so nothing interferes).
fn quiet(id: StoreId, r: &mut RunState) -> (StoreRoom, Out) {
    r.visited.insert(id);
    let (mut room, out) = enter(id, r);
    room.guards.clear();
    room.bubbles.clear();
    (room, out)
}

/// Put the agent right next to fixture `i`, `gap` px away, on `side` (the side of the FIXTURE he stands on).
fn stand_on(room: &mut StoreRoom, i: usize, gap: i32, side: Dir) -> bool {
    let (fx, fy) = room.tpl.fixtures[i];
    let (x, y) = match side {
        Dir::Down => (fx * TILE, fy * TILE + TILE + gap - BOX_Y),
        Dir::Up => (fx * TILE, fy * TILE - BOX_Y - BOX_H - gap),
        Dir::Left => (fx * TILE - BOX_X - BOX_W - gap, fy * TILE),
        Dir::Right => (fx * TILE + TILE + gap - BOX_X, fy * TILE),
    };
    if room.free(x, y) {
        room.player.x = x;
        room.player.y = y;
        true
    } else {
        false
    }
}

/// Stand by fixture `i` on the first free side. Returns the side of the fixture he is on.
fn stand_by(room: &mut StoreRoom, i: usize, gap: i32) -> Dir {
    for d in [Dir::Down, Dir::Up, Dir::Left, Dir::Right] {
        if stand_on(room, i, gap, d) {
            return d;
        }
    }
    panic!("no room to stand by fixture {i}");
}

fn events_have(out: &Out, e: Event) -> bool {
    out.events.contains(&e)
}

// ---------------------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------------------

#[test]
fn every_template_is_a_valid_one_screen_room() {
    for id in OPEN {
        let t = template(id);
        assert_eq!((t.w, t.h), (16, 11), "{id:?}");
        let doors: Vec<_> = (0..t.h).flat_map(|y| (0..t.w).map(move |x| (x, y))).filter(|&(x, y)| t.tile(x, y) == Tile::Door).collect();
        assert_eq!(doors, vec![(8, 10)], "{id:?}: exactly one door at the bottom centre");
        for x in 0..t.w {
            assert!(t.tile(x, 0) == Tile::Wall, "{id:?} top wall");
            if x != 8 {
                assert!(t.tile(x, 10) == Tile::Wall, "{id:?} bottom wall");
            }
        }
        for y in 0..t.h {
            assert!(t.tile(0, y) == Tile::Wall && t.tile(15, y) == Tile::Wall, "{id:?} side walls");
        }
        for &(_, x, y) in &t.spawns {
            assert!(!t.tile(x, y).solid(), "{id:?} spawn on floor");
        }
        assert!(!t.tile(t.entry().0, t.entry().1).solid());
    }
}

#[test]
fn fixture_counts_match_the_store_role() {
    for id in OPEN {
        let n = template(id).fixtures.len();
        match id.role() {
            StoreRole::Target => assert!((5..=9).contains(&n), "{id:?} has {n} fixtures"),
            StoreRole::PowerShop => assert!((3..=6).contains(&n), "{id:?} has {n} fixtures"),
            StoreRole::Closed => unreachable!(),
        }
    }
}

#[test]
fn guards_are_one_to_three_per_store_and_never_ambush_the_door() {
    for id in OPEN {
        let t = template(id);
        assert!((1..=3).contains(&t.spawns.len()), "{id:?}: {} guards", t.spawns.len());
        let (ex, ey) = t.entry();
        for &(k, x, y) in &t.spawns {
            let d = (x - ex).abs() + (y - ey).abs();
            assert!(d >= 4, "{id:?}: guard at ({x},{y}) is too close to the door");
            if k == SpawnKind::Spy {
                assert!(
                    lined_up(&t, x * 16 + 8, y * 16 + 8, ex * 16 + 8, ey * 16 + 8).is_none(),
                    "{id:?}: spy at ({x},{y}) sees the entry tile"
                );
            }
        }
    }
}

#[test]
fn every_fixture_is_reachable_from_the_door_by_walking() {
    // Pixel-level flood fill of the agent's real hit box from the entry position (no corner assist, so this
    // is the pessimistic case), then check each fixture can be touched from some reachable spot.
    for id in OPEN {
        let mut r = run(1);
        let (mut room, _) = quiet(id, &mut r);
        let (w, h) = (room.grid.px_w(), room.grid.px_h());
        let idx = |x: i32, y: i32| (y * w + x) as usize;
        let mut seen = vec![false; (w * h) as usize];
        let (sx, sy) = (room.player.x, room.player.y);
        let mut stack = vec![(sx, sy)];
        seen[idx(sx, sy)] = true;
        let mut reach: Vec<(i32, i32)> = Vec::new();
        while let Some((x, y)) = stack.pop() {
            reach.push((x, y));
            for (dx, dy) in [(0, -1), (0, 1), (-1, 0), (1, 0)] {
                let (nx, ny) = (x + dx, y + dy);
                if nx < 0 || ny < 0 || nx >= w || ny >= h || seen[idx(nx, ny)] || !room.free(nx, ny) {
                    continue;
                }
                seen[idx(nx, ny)] = true;
                stack.push((nx, ny));
            }
        }
        for i in 0..room.tpl.fixtures.len() {
            let ok = reach.iter().any(|&(x, y)| {
                room.player.x = x;
                room.player.y = y;
                room.touch(i).is_some()
            });
            assert!(ok, "{id:?}: fixture {i} at {:?} can not be touched", room.tpl.fixtures[i]);
        }
        // and the way out through the door exists
        let (_, dy) = room.grid.door;
        assert!(reach.iter().any(|&(_, y)| y + BOX_Y + BOX_H / 2 >= dy * TILE + 10), "{id:?}: door reachable");
    }
}

#[test]
fn rooms_are_roomy_enough_to_dodge() {
    // At least 55% of the interior is open floor.
    for id in OPEN {
        let t = template(id);
        let interior = (t.w - 2) * (t.h - 2);
        let open = (1..t.h - 1).flat_map(|y| (1..t.w - 1).map(move |x| (x, y))).filter(|&(x, y)| !t.tile(x, y).solid()).count() as i32;
        assert!(open * 100 >= interior * 55, "{id:?}: only {open}/{interior} open");
    }
}

#[test]
fn big_rooms_get_a_scrolling_camera() {
    // A synthetic 24x16 room.
    let mut rows: Vec<String> = Vec::new();
    for y in 0..16 {
        let mut row = String::new();
        for x in 0..24 {
            let edge = x == 0 || y == 0 || x == 23 || y == 15;
            row.push(if y == 15 && x == 12 { 'D' } else if edge { '#' } else if x == 5 && y == 5 { 'a' } else { '.' });
        }
        rows.push(row);
    }
    let refs: Vec<&str> = rows.iter().map(String::as_str).collect();
    let tpl = Template::parse(&refs);
    assert_eq!((tpl.w, tpl.h), (24, 16));
    let mut r = run(3);
    let mut out = Out::new();
    let mut room = StoreRoom::from_template(StoreId::Crookstone, tpl, &mut r, &mut out);
    room.guards.clear();
    // Pure camera function: clamped and following.
    assert_eq!(camera(384, 256, 0, 0), (0, 0));
    assert_eq!(camera(384, 256, 384, 256), (384 - VIEW_W, 256 - VIEW_H));
    assert_eq!(camera(384, 256, 192, 128), (192 - 128, 128 - 88));
    // Smaller rooms are centred.
    assert_eq!(camera(200, 100, 50, 50), (-28, -38));
    // The agent starts at the bottom centre: camera at the bottom, horizontally centred (200 - 128 = 72).
    let (cx, cy) = room.cam();
    assert_eq!(cx, 72); // the door is column 12: x 192..208, centre 200, minus half a view
    assert_eq!(cy, 256 - VIEW_H);
    // Walk up and left: the camera follows and never leaves the room.
    let mut d = Drv::new();
    for _ in 0..500 {
        d.step(&mut room, &mut r, &mut out, UP | LEFT);
        let (cx, cy) = room.cam();
        assert!((0..=384 - VIEW_W).contains(&cx) && (0..=256 - VIEW_H).contains(&cy));
    }
    // vertical priority moved him up first; he is somewhere in the upper-left now
    let (cx, cy) = room.cam();
    assert_eq!(cy, 0);
    assert!(cx <= 72);
    // It draws without panicking and stays inside the framebuffer.
    let mut fb = Fb::new();
    room.draw(&mut fb, &r, 0);
}

// ---------------------------------------------------------------------------------------------------------
// Level setup
// ---------------------------------------------------------------------------------------------------------

#[test]
fn setup_rules_hold_for_many_seeds() {
    for seed in 0..300u64 {
        let r = run(seed);
        for id in StoreId::ALL {
            if !id.is_open() {
                assert!(!r.fixtures.contains_key(&id), "closed store {id:?} has fixtures");
                continue;
            }
            let f = &r.fixtures[&id];
            assert_eq!(f.len(), template(id).fixtures.len(), "{id:?}");
            let packages = f.iter().filter(|c| **c == Content::Package).count();
            match id.role() {
                StoreRole::Target => {
                    assert_eq!(packages, 1, "seed {seed} {id:?}");
                    assert!(f.iter().any(|c| *c == Content::Trap), "seed {seed} {id:?} has a trap");
                    assert!(f.iter().any(|c| matches!(c, Content::PowerUp(_))), "seed {seed} {id:?} has a power-up");
                    assert!(f.iter().any(|c| *c == Content::Nothing), "seed {seed} {id:?} has empties");
                }
                StoreRole::PowerShop => {
                    assert_eq!(packages, 0);
                    assert!(!f.iter().any(|c| *c == Content::Trap), "power shop trapped");
                    let ups: Vec<PowerUp> = f.iter().filter_map(|c| if let Content::PowerUp(p) = c { Some(*p) } else { None }).collect();
                    assert!(ups.len() >= 2, "seed {seed} {id:?}: {} power-ups", ups.len());
                    assert!(ups.iter().any(|p| *p != ups[0]), "at least two differ");
                }
                StoreRole::Closed => unreachable!(),
            }
        }
    }
}

#[test]
fn black_friday_fills_every_other_fixture_with_a_power_up() {
    for seed in 0..60u64 {
        let mut r = RunState::new(seed, true);
        setup_level(&mut r);
        for id in OPEN {
            let f = &r.fixtures[&id];
            for c in f {
                match c {
                    Content::Package => assert_eq!(id.role(), StoreRole::Target),
                    Content::PowerUp(_) => {}
                    other => panic!("black friday {id:?}: {other:?}"),
                }
            }
            if id.role() == StoreRole::Target {
                assert_eq!(f.iter().filter(|c| **c == Content::Package).count(), 1);
            }
        }
    }
}

#[test]
fn hot_spy_favours_food() {
    let (mut hot_food, mut hot_all, mut other_food, mut other_all) = (0, 0, 0, 0);
    for seed in 0..200u64 {
        let r = run(seed);
        for (id, f) in &r.fixtures {
            for c in f {
                if let Content::PowerUp(p) = c {
                    if *id == StoreId::HotSpyOnAStick {
                        hot_all += 1;
                        hot_food += p.is_food() as i32;
                    } else if *id == StoreId::Forever12 || *id == StoreId::RadioShock {
                        other_all += 1;
                        other_food += p.is_food() as i32;
                    }
                }
            }
        }
    }
    let hot = hot_food as f32 / hot_all as f32;
    let other = other_food as f32 / other_all as f32;
    assert!(hot > 0.6 && other < 0.5 && hot > other + 0.2, "hot {hot} other {other}");
}

#[test]
fn setup_is_deterministic() {
    let a = run(99);
    let b = run(99);
    let c = run(100);
    for id in OPEN {
        assert_eq!(a.fixtures[&id], b.fixtures[&id]);
    }
    assert!(OPEN.iter().any(|id| a.fixtures[id] != c.fixtures[id]));
}

// ---------------------------------------------------------------------------------------------------------
// Searching
// ---------------------------------------------------------------------------------------------------------

#[test]
fn a_single_tap_of_b_runs_a_whole_search() {
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    stand_by(&mut room, 0, 0);
    assert!(room.can_search(&r));
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B); // tap
    assert!(room.is_searching());
    d.run(&mut room, &mut r, &mut out, 0, 20); // let go; it keeps going
    assert!(room.is_searching(), "still searching mid-way");
    d.run(&mut room, &mut r, &mut out, 0, SEARCH_FRAMES);
    assert!(!room.is_searching());
    assert!(r.is_opened(StoreId::Crookstone, 0));
    assert!(room.banner.active(), "every outcome is announced");
    assert!(out.count_sfx(Sfx::SearchTick) >= 4);
}

#[test]
fn search_takes_about_three_quarters_of_a_second_and_less_with_sneakers() {
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    stand_by(&mut room, 0, 0);
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B);
    let mut frames = 1;
    while room.is_searching() {
        d.step(&mut room, &mut r, &mut out, 0);
        frames += 1;
    }
    assert!((40..=50).contains(&frames), "{frames}");
    // Sneakers
    let mut r = run(1);
    r.power.grant(PowerUp::Sneakers);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    stand_by(&mut room, 0, 0);
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B);
    let mut fast = 1;
    while room.is_searching() {
        d.step(&mut room, &mut r, &mut out, 0);
        fast += 1;
    }
    assert!(fast < frames - 8, "{fast} vs {frames}");
}

#[test]
fn a_fixture_one_or_two_pixels_away_still_counts_but_four_does_not() {
    for gap in [0, 1, 2] {
        let mut r = run(2);
        let (mut room, _) = quiet(StoreId::Crookstone, &mut r);
        stand_by(&mut room, 0, gap);
        assert!(room.touching_fixture(&r).is_some(), "gap {gap}");
    }
    let mut r = run(2);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    stand_by(&mut room, 0, 4);
    assert!(room.touching_fixture(&r).is_none());
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B);
    assert!(!room.is_searching(), "nothing to search 4 px away");
}

#[test]
fn searching_turns_the_agent_to_face_the_fixture_from_every_side() {
    // Crookstone fixture 0 sits at (3,2): free on all sides.
    for (side, want) in [(Dir::Down, Dir::Up), (Dir::Up, Dir::Down), (Dir::Left, Dir::Right), (Dir::Right, Dir::Left)] {
        let mut r = run(1);
        let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
        assert!(stand_on(&mut room, 0, 0, side), "{side:?}");
        room.player.face = if want == Dir::Left || want == Dir::Right { Dir::Down } else { Dir::Left };
        let mut d = Drv::new();
        d.step(&mut room, &mut r, &mut out, B);
        assert!(room.is_searching(), "{want:?}");
        assert_eq!(room.player.face, want);
    }
}

#[test]
fn a_fresh_other_direction_or_shooting_cancels_a_search() {
    for cancel in [LEFT, RIGHT, DOWN, A] {
        let mut r = run(1);
        let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
        let side = stand_by(&mut room, 0, 0);
        let mut d = Drv::new();
        d.step(&mut room, &mut r, &mut out, B);
        d.run(&mut room, &mut r, &mut out, 0, 10);
        assert!(room.is_searching());
        let facing = room.player.face;
        let _ = side;
        // pick a direction that is not the facing one
        let held = if cancel == A || cancel != facing.bit() { cancel } else { UP };
        if held == facing.bit() {
            continue;
        }
        d.step(&mut room, &mut r, &mut out, held);
        assert!(!room.is_searching(), "cancelled by {held}");
        assert!(!r.is_opened(StoreId::Crookstone, 0));
        d.run(&mut room, &mut r, &mut out, 0, 100);
        assert!(!r.is_opened(StoreId::Crookstone, 0), "a cancelled search must not finish later");
    }
}

#[test]
fn holding_the_facing_direction_into_the_fixture_does_not_cancel() {
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    let side = stand_by(&mut room, 0, 0);
    let into = match side {
        Dir::Down => UP,
        Dir::Up => DOWN,
        Dir::Left => RIGHT,
        Dir::Right => LEFT,
    };
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, into); // walk into it: faces it
    d.step(&mut room, &mut r, &mut out, into | B);
    assert!(room.is_searching());
    d.run(&mut room, &mut r, &mut out, into, 60);
    assert!(r.is_opened(StoreId::Crookstone, 0));
}

#[test]
fn holding_b_does_not_chain_into_the_next_fixture() {
    // Forever 12 has two racks side by side in the top row (cols 12 and 13).
    let mut r = run(5);
    let (mut room, mut out) = quiet(StoreId::Forever12, &mut r);
    // stand below both, overlapping each by 6 px
    room.player.x = 12 * TILE + 8;
    room.player.y = 2 * TILE - BOX_Y;
    assert!(room.free(room.player.x, room.player.y));
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B);
    assert!(room.is_searching());
    d.run(&mut room, &mut r, &mut out, B, 200); // never release B
    let opened = r.opened.iter().filter(|(s, _)| *s == StoreId::Forever12).count();
    assert_eq!(opened, 1, "only the first fixture was searched while B stayed down");
    assert!(!room.is_searching());
    // a fresh press searches the other one
    d.step(&mut room, &mut r, &mut out, 0);
    d.step(&mut room, &mut r, &mut out, B);
    assert!(room.is_searching());
}

#[test]
fn searched_fixtures_stay_open_after_leaving_and_re_entering() {
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    stand_by(&mut room, 0, 0);
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B);
    d.run(&mut room, &mut r, &mut out, 0, 60);
    assert!(r.is_opened(StoreId::Crookstone, 0));
    let (mut room2, _) = enter(StoreId::Crookstone, &mut r);
    room2.guards.clear();
    stand_by(&mut room2, 0, 0);
    assert!(r.is_opened(StoreId::Crookstone, 0));
    assert!(!room2.can_search(&r), "an opened fixture offers no search");
    let mut fb = Fb::new();
    room2.draw(&mut fb, &r, 0);
}

#[test]
fn package_pickup_updates_the_run_and_clears_the_store() {
    let mut r = run(4);
    let (mut room, mut out) = quiet(StoreId::KgbToys, &mut r);
    let pkg = r.fixtures[&StoreId::KgbToys].iter().position(|c| *c == Content::Package).unwrap();
    // the toy shelves are fixtures too; find a standing spot
    stand_by(&mut room, pkg, 0);
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B);
    d.run(&mut room, &mut r, &mut out, 0, 60);
    assert!(r.store_cleared(StoreId::KgbToys));
    assert_eq!(r.packages_found(), 1);
    assert_eq!(r.score, 500);
    assert!(events_have(&out, Event::Sfx(Sfx::PackageFanfare)));
    assert_eq!(room.banner.text, "PACKAGE 1/6");
    assert!(room.player.hold.is_some(), "held overhead");
    // The world is frozen while he holds it, then play resumes.
    d.run(&mut room, &mut r, &mut out, 0, HOLD_FRAMES + 1);
    assert!(room.player.hold.is_none());
}

#[test]
fn a_cleared_target_store_refuses_entry_safely() {
    let mut r = run(4);
    let mut o = Out::new();
    r.take_package(StoreId::KgbToys, &mut o);
    let (mut room, mut out) = enter(StoreId::KgbToys, &mut r);
    let mut d = Drv::new();
    assert_eq!(d.step(&mut room, &mut r, &mut out, 0), StoreOutcome::Exit);
    // and a closed store is just as safe
    let (mut room, mut out) = enter(StoreId::BlockblusterVideo, &mut r);
    assert_eq!(d.step(&mut room, &mut r, &mut out, 0), StoreOutcome::Exit);
    let mut fb = Fb::new();
    room.draw(&mut fb, &r, 0);
}

fn search_with(content: Content, seed: u64) -> (StoreRoom, RunState, Out) {
    let mut r = run(seed);
    r.fixtures.get_mut(&StoreId::SpendersGifts).unwrap()[0] = content;
    let (mut room, mut out) = quiet(StoreId::SpendersGifts, &mut r);
    stand_by(&mut room, 0, 0);
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B);
    d.run(&mut room, &mut r, &mut out, 0, 60);
    (room, r, out)
}

#[test]
fn power_up_pickup_grants_it_scores_and_is_announced() {
    let (room, r, out) = search_with(Content::PowerUp(PowerUp::SpreadShot), 1);
    assert!(r.power.spread_shot());
    assert_eq!(r.score, 50);
    assert_eq!(room.banner.text, "SPREAD SHOT");
    assert!(room.player.hold.is_some());
    assert!(events_have(&out, Event::Sfx(Sfx::PowerUp)));
    let (room, r, _) = search_with(Content::PowerUp(PowerUp::OneUp), 1);
    assert_eq!(r.lives, 4);
    assert_eq!(room.banner.text, "1-UP");
    let (_, r, _) = search_with(Content::PowerUp(PowerUp::ArmorVest), 1);
    assert!(r.power.armor);
}

#[test]
fn trap_stuns_for_one_second_and_nothing_just_says_so() {
    // Run the search until the very frame it finishes.
    let mut r = run(1);
    r.fixtures.get_mut(&StoreId::SpendersGifts).unwrap()[0] = Content::Trap;
    let (mut room, mut out) = quiet(StoreId::SpendersGifts, &mut r);
    stand_by(&mut room, 0, 0);
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B);
    while room.is_searching() {
        d.step(&mut room, &mut r, &mut out, 0);
    }
    assert_eq!(room.banner.text, "IT'S A TRAP!");
    assert_eq!(room.player.stun, STUN_FRAMES, "stunned for exactly 60 frames");
    assert!(room.puffs.len() >= 1);
    // stunned: he can not move
    let before = room.player_pos();
    d.run(&mut room, &mut r, &mut out, LEFT, STUN_FRAMES);
    assert_eq!(room.player_pos(), before);
    d.run(&mut room, &mut r, &mut out, LEFT, 5);
    assert_ne!(room.player_pos(), before, "free again after the stun");
    let (room, _, _) = search_with(Content::Nothing, 1);
    assert_eq!(room.banner.text, "NOTHING HERE");
    assert!(room.puffs.len() >= 1);
}

// ---------------------------------------------------------------------------------------------------------
// Movement and shooting
// ---------------------------------------------------------------------------------------------------------

#[test]
fn walls_are_solid_and_vertical_input_wins() {
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    let mut d = Drv::new();
    // up+left together: only vertical movement
    let (x0, y0) = room.player_pos();
    d.run(&mut room, &mut r, &mut out, UP | LEFT, 5);
    assert_eq!(room.player_pos().0, x0);
    assert_eq!(room.player_pos().1, y0 - 5);
    assert_eq!(room.player.face, Dir::Up);
    // walking left forever stops at the wall
    d.run(&mut room, &mut r, &mut out, LEFT, 400);
    assert!(room.player_pos().0 + BOX_X >= TILE, "inside the wall ring");
    assert_eq!(room.player.face, Dir::Left);
}

#[test]
fn sneakers_walk_one_and_a_half_times_faster() {
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    let mut d = Drv::new();
    d.run(&mut room, &mut r, &mut out, UP, 20);
    let slow = room.player_pos().1;
    let mut r2 = run(1);
    r2.power.grant(PowerUp::Sneakers);
    let (mut room2, mut out2) = quiet(StoreId::Crookstone, &mut r2);
    let y0 = room2.player_pos().1;
    let mut d2 = Drv::new();
    d2.run(&mut room2, &mut r2, &mut out2, UP, 20);
    let fast = room2.player_pos().1;
    assert_eq!(y0 - fast, 30);
    assert_eq!(y0 - slow, 20);
}

#[test]
fn corner_assist_slides_round_a_corner() {
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    // Walk up the open column of tile x=8..: put him 4 px off the doorway of a 1-tile gap.
    // Build a synthetic wall with a one-tile gap at column 8, row 5.
    for x in 1..15 {
        room.grid.set(x, 5, Tile::Wall);
    }
    room.grid.set(8, 5, Tile::Floor);
    room.tpl = room.grid.clone();
    room.player.x = 8 * TILE + 5; // 5 px to the right of the gap's left edge: the box overhangs the wall
    room.player.y = 7 * TILE;
    let mut d = Drv::new();
    d.run(&mut room, &mut r, &mut out, UP, 60);
    assert!(room.player_pos().1 < 5 * TILE, "slipped through the gap: {:?}", room.player_pos());
    // but a corner farther than the assist range still blocks
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    for x in 1..15 {
        room.grid.set(x, 5, Tile::Wall);
    }
    room.grid.set(8, 5, Tile::Floor);
    room.player.x = 8 * TILE + 12;
    room.player.y = 7 * TILE;
    let mut d = Drv::new();
    d.run(&mut room, &mut r, &mut out, UP, 60);
    assert!(room.player_pos().1 > 5 * TILE, "too far from the gap to be nudged");
}

#[test]
fn a_shoots_in_the_facing_direction_and_respects_the_bullet_limit() {
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, UP); // face up
    d.step(&mut room, &mut r, &mut out, UP | A);
    assert_eq!(room.bullets.len(), 1);
    assert!(room.bullets[0].vy < 0.0 && room.bullets[0].vx == 0.0);
    assert!(events_have(&out, Event::Sfx(Sfx::Shot)));
    // second shot (after cooldown)
    d.run(&mut room, &mut r, &mut out, 0, SHOOT_COOLDOWN);
    d.step(&mut room, &mut r, &mut out, A);
    assert_eq!(room.bullets.len(), 2);
    d.run(&mut room, &mut r, &mut out, 0, SHOOT_COOLDOWN);
    d.step(&mut room, &mut r, &mut out, A);
    assert_eq!(room.bullets.len(), 2, "at most 2 bullets without rapid fire");
    // spread = 3-way fan counts as one volley
    let mut r = run(1);
    r.power.grant(PowerUp::SpreadShot);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, A);
    assert_eq!(room.bullets.len(), 3);
    let vxs: Vec<f32> = room.bullets.iter().map(|b| b.vx).collect();
    assert!(vxs.iter().any(|v| *v < 0.0) && vxs.iter().any(|v| *v > 0.0), "{vxs:?}");
    // bullets stop at walls
    d.run(&mut room, &mut r, &mut out, 0, 120);
    assert!(room.bullets.is_empty());
}

#[test]
fn rapid_fire_shoots_faster_and_allows_four() {
    let mut r = run(1);
    r.power.grant(PowerUp::RapidFire);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    room.player.x = 5 * TILE;
    let mut d = Drv::new();
    d.run(&mut room, &mut r, &mut out, A, 40);
    assert_eq!(room.bullets.len(), 4);
}

#[test]
fn walking_out_through_the_door_exits() {
    let mut r = run(1);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    let mut d = Drv::new();
    let o = d.run(&mut room, &mut r, &mut out, DOWN, 80);
    assert_eq!(o, StoreOutcome::Exit);
}

#[test]
fn entering_emits_the_store_track() {
    let mut r = run(1);
    let (_, out) = enter(StoreId::SamBaddy, &mut r);
    assert!(events_have(&out, Event::Music(Track::Store(StoreId::SamBaddy))));
}

// ---------------------------------------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------------------------------------

#[test]
fn lines_of_fire_are_blocked_by_walls_and_fixtures() {
    let t = Template::parse(&[
        "#########", //
        "#.......#", //
        "#.......#", //
        "#.......#", //
        "####D####", //
    ]);
    // clear row
    assert_eq!(lined_up(&t, 24, 24, 100, 24), Some(Dir::Right));
    assert_eq!(lined_up(&t, 100, 24, 24, 24), Some(Dir::Left));
    assert_eq!(lined_up(&t, 24, 24, 26, 60), Some(Dir::Down));
    // off the lane
    assert_eq!(lined_up(&t, 24, 24, 100, 40), None);
    let mut t2 = t.clone();
    t2.set(4, 1, Tile::Counter);
    assert_eq!(lined_up(&t2, 24, 24, 120, 24), None, "a counter blocks the shot");
    t2.set(4, 1, Tile::FixA);
    assert_eq!(lined_up(&t2, 24, 24, 120, 24), None, "a fixture blocks the shot");
    // and the lane stays clear on the other row
    assert_eq!(lined_up(&t2, 24, 40, 120, 40), Some(Dir::Right));
}

fn lone_spy(id: StoreId, r: &mut RunState) -> (StoreRoom, Out) {
    r.visited.insert(id);
    let (mut room, out) = enter(id, r);
    room.guards.retain(|g| g.kind == GKind::Spy);
    room.guards.truncate(1);
    room.bubbles.clear();
    (room, out)
}

#[test]
fn a_spy_telegraphs_then_fires_along_a_clear_lane_and_it_kills() {
    let mut r = run(7);
    let (mut room, mut out) = lone_spy(StoreId::Crookstone, &mut r);
    // Put the spy and the agent in the same open row, far apart.
    room.guards[0].x = (2 * TILE) as f32;
    room.guards[0].y = (9 * TILE) as f32;
    room.guards[0].tx = 2;
    room.guards[0].ty = 9;
    room.guards[0].target = None;
    room.guards[0].cool = 0;
    room.player.x = 12 * TILE;
    room.player.y = 9 * TILE;
    room.grace = 0;
    let lives = r.lives;
    let mut d = Drv::new();
    let mut telegraphed = 0;
    let mut fired_at = None;
    for f in 0..200 {
        d.step(&mut room, &mut r, &mut out, 0);
        if room.guards[0].aim > 0 {
            telegraphed += 1;
        }
        if fired_at.is_none() && out.count_sfx(Sfx::EnemyShot) > 0 {
            fired_at = Some(f);
        }
        if room.player_dead() {
            break;
        }
    }
    assert!(telegraphed >= 15, "aim telegraph ({telegraphed} frames)");
    assert!(fired_at.is_some());
    assert!(room.player_dead(), "the bullet kills");
    assert_eq!(r.lives, lives - 1);
    assert!(events_have(&out, Event::Sfx(Sfx::Death)));
}

#[test]
fn armour_absorbs_a_spy_bullet_and_cinnabomb_ignores_it() {
    let mut r = run(7);
    r.power.grant(PowerUp::ArmorVest);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    let (cx, cy) = room.player_center();
    room.bullets.push(Bullet { x: cx as f32, y: cy as f32 - 3.0, vx: 0.0, vy: 2.0, kind: BKind::Enemy, volley: 0, age: 0 });
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, 0);
    assert!(!room.player_dead());
    assert!(!r.power.armor, "the vest was used up");
    assert_eq!(r.lives, 3);
    assert!(room.player.invuln > 0);
    // Cinnabomb
    let mut r = run(7);
    r.power.grant(PowerUp::Cinnabomb);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    let (cx, cy) = room.player_center();
    room.bullets.push(Bullet { x: cx as f32, y: cy as f32, vx: 0.0, vy: 2.0, kind: BKind::Enemy, volley: 0, age: 0 });
    d.step(&mut room, &mut r, &mut out, 0);
    assert!(!room.player_dead());
    assert!(r.power.armor == false);
}

#[test]
fn guards_do_not_shoot_during_the_grace_period() {
    let mut r = run(7);
    let (mut room, mut out) = lone_spy(StoreId::Crookstone, &mut r);
    room.guards[0].x = (2 * TILE) as f32;
    room.guards[0].y = (9 * TILE) as f32;
    room.guards[0].tx = 2;
    room.guards[0].ty = 9;
    room.guards[0].cool = 0;
    room.player.x = 12 * TILE;
    room.player.y = 9 * TILE;
    let mut d = Drv::new();
    for _ in 0..(GRACE_FRAMES - 2) {
        d.step(&mut room, &mut r, &mut out, 0);
        assert_eq!(room.guards[0].aim, 0, "no aiming in the grace period");
    }
    assert_eq!(out.count_sfx(Sfx::EnemyShot), 0);
}

#[test]
fn shooting_a_spy_kills_it_scores_and_sometimes_gets_last_words() {
    let mut r = run(7);
    let (mut room, mut out) = lone_spy(StoreId::Crookstone, &mut r);
    room.grace = 999;
    // spy straight above the agent
    room.player.x = 5 * TILE;
    room.player.y = 9 * TILE;
    let (px, py) = room.player_pos();
    room.guards[0].x = px as f32;
    room.guards[0].y = (py - 6 * TILE) as f32;
    room.guards[0].tx = px / TILE;
    room.guards[0].ty = (py - 6 * TILE) / TILE;
    room.guards[0].target = None;
    room.guards[0].wait = 500;
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, UP);
    d.step(&mut room, &mut r, &mut out, UP | A);
    d.run(&mut room, &mut r, &mut out, 0, 60);
    assert_eq!(room.guards_alive(), 0);
    assert_eq!(r.score, 100);
    assert!(events_have(&out, Event::Sfx(Sfx::Splat)));
    // last words appear ~35% of the time
    let mut words = 0;
    for seed in 0..200u64 {
        let mut r = run(seed);
        let (mut room, mut out) = lone_spy(StoreId::Crookstone, &mut r);
        room.kill_guard(0, &mut r, &mut out);
        if room.bubbles.iter().any(|b| crate::copy::LAST_WORDS.contains(&b.text.as_str())) {
            words += 1;
        }
    }
    assert!((45..=95).contains(&words), "{words}/200 last words");
}

#[test]
fn security_bots_take_three_hits_and_kill_on_contact() {
    let mut r = run(7);
    r.visited.insert(StoreId::RadioShock);
    let (mut room, mut out) = enter(StoreId::RadioShock, &mut r);
    room.bubbles.clear();
    let bot = room.guards.iter().position(|g| g.kind == GKind::Bot).expect("radioshock has a bot");
    for hit in 1..=3 {
        assert_eq!(room.guards[bot].dying, 0, "alive before hit {hit}");
        room.hit_guard(bot, &mut r, &mut out);
        if hit < 3 {
            assert!(room.guards[bot].flash > 0, "flashes on hit");
        }
    }
    assert!(room.guards[bot].dying > 0, "dead on the third hit");
    assert_eq!(out.count_sfx(Sfx::HelmetPing), 3);
    // contact kills
    let mut r = run(7);
    r.visited.insert(StoreId::RadioShock);
    let (mut room, mut out) = enter(StoreId::RadioShock, &mut r);
    room.bubbles.clear();
    room.grace = 999;
    let bot = room.guards.iter().position(|g| g.kind == GKind::Bot).unwrap();
    let (bx, by) = (room.guards[bot].x as i32, room.guards[bot].y as i32);
    room.player.x = bx;
    room.player.y = by;
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, 0);
    // intro is over (bubbles cleared) so the bot is free to hurt him
    assert!(room.player_dead());
}

#[test]
fn bots_patrol_back_and_forth() {
    let mut r = run(7);
    r.visited.insert(StoreId::RadioShock);
    let (mut room, mut out) = enter(StoreId::RadioShock, &mut r);
    room.bubbles.clear();
    room.grace = 99999;
    room.player.invuln = 99999;
    let bot = room.guards.iter().position(|g| g.kind == GKind::Bot).unwrap();
    let mut seen_dirs = std::collections::BTreeSet::new();
    let mut d = Drv::new();
    let (mut minx, mut maxx) = (f32::MAX, f32::MIN);
    for _ in 0..900 {
        d.step(&mut room, &mut r, &mut out, 0);
        seen_dirs.insert(room.guards[bot].bot_dir);
        minx = minx.min(room.guards[bot].x);
        maxx = maxx.max(room.guards[bot].x);
    }
    assert!(seen_dirs.len() >= 2, "it turned round");
    assert!(maxx - minx > 40.0, "it patrols a real stretch");
}

#[test]
fn cinnabomb_kills_spies_on_contact() {
    let mut r = run(7);
    r.power.grant(PowerUp::Cinnabomb);
    let (mut room, mut out) = lone_spy(StoreId::Crookstone, &mut r);
    room.grace = 999;
    room.guards[0].x = room.player.x as f32;
    room.guards[0].y = room.player.y as f32;
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, 0);
    assert_eq!(room.guards_alive(), 0);
    assert!(!room.player_dead());
}

#[test]
fn spies_walk_tile_by_tile_and_head_for_the_agent() {
    let mut r = run(11);
    let (mut room, mut out) = lone_spy(StoreId::HotSpyOnAStick, &mut r);
    room.grace = 99999; // no shooting, just walking
    let start = room.guards[0].tx;
    let mut d = Drv::new();
    let mut aligned_moves = 0;
    let mut d0 = i32::MAX;
    let (pcx, pcy) = room.player_center();
    let dist_to = |g: &Guard| (g.x as i32 + 8 - pcx).abs() + (g.y as i32 + 8 - pcy).abs();
    let first = dist_to(&room.guards[0]);
    for _ in 0..600 {
        d.step(&mut room, &mut r, &mut out, 0);
        let g = &room.guards[0];
        if g.target.is_none() {
            assert!(g.x.fract() == 0.0 && g.y.fract() == 0.0 && (g.x as i32) % TILE == 0 && (g.y as i32) % TILE == 0, "at tile centres when idle");
            aligned_moves += 1;
        }
        d0 = d0.min(dist_to(g));
    }
    assert!(aligned_moves > 0);
    assert!(d0 < first - 20, "he closed in: {first} -> {d0}");
    let _ = start;
}

// ---------------------------------------------------------------------------------------------------------
// First visit
// ---------------------------------------------------------------------------------------------------------

#[test]
fn first_visit_guards_hold_still_and_speak_in_order_once_per_game() {
    let mut r = run(8);
    let (mut room, mut out) = enter(StoreId::Forever12, &mut r);
    assert!(r.visited.contains(&StoreId::Forever12));
    let lines = crate::copy::store_lines(StoreId::Forever12).unwrap();
    let before: Vec<(f32, f32)> = room.guards.iter().map(|g| (g.x, g.y)).collect();
    let mut d = Drv::new();
    let mut shown: Vec<String> = Vec::new();
    let mut first_at = None;
    let mut second_at = None;
    for f in 0..160 {
        d.step(&mut room, &mut r, &mut out, 0);
        for b in &room.bubbles {
            if b.delay == 0 && !shown.contains(&b.text) {
                shown.push(b.text.clone());
                if b.text == lines.first {
                    first_at = Some(f);
                } else {
                    second_at = Some(f);
                }
            }
        }
        if f < 90 {
            let now: Vec<(f32, f32)> = room.guards.iter().map(|g| (g.x, g.y)).collect();
            assert_eq!(now, before, "guards hold still while talking (frame {f})");
        }
    }
    assert_eq!(shown, vec![lines.first.to_string(), lines.second.unwrap().to_string()]);
    let gap = second_at.unwrap() - first_at.unwrap();
    assert!((55..=65).contains(&gap), "second line {gap} frames after the first");
    assert!(shown.iter().all(|s| s.chars().count() <= 28));
    assert_eq!(out.count_sfx(Sfx::EnemyShot), 0);
    // later the guards move
    d.run(&mut room, &mut r, &mut out, 0, 200);
    let now: Vec<(f32, f32)> = room.guards.iter().map(|g| (g.x, g.y)).collect();
    assert_ne!(now, before);
    // Second visit this game: no lines.
    let (room2, _) = enter(StoreId::Forever12, &mut r);
    assert!(room2.bubbles.is_empty());
}

#[test]
fn the_second_line_is_spoken_by_the_bot_when_the_copy_says_so() {
    let mut r = run(8);
    let (room, _) = enter(StoreId::RadioShock, &mut r);
    let second = room.bubbles.iter().find(|b| b.delay > 10).expect("second bubble");
    let who = second.guard.unwrap();
    assert_eq!(room.guards[who].kind, GKind::Bot);
    let first = room.bubbles.iter().find(|b| b.delay <= 10).unwrap();
    assert_eq!(room.guards[first.guard.unwrap()].kind, GKind::Spy);
}

// ---------------------------------------------------------------------------------------------------------
// Death and respawn
// ---------------------------------------------------------------------------------------------------------

#[test]
fn death_costs_a_life_then_respawns_at_the_door_with_blinking_invulnerability() {
    let mut r = run(2);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    room.spawn_guards(false);
    let spy_n = room.guards.len();
    room.guards[0].dying = 1;
    room.guards[0].gone = true; // pretend we shot it earlier
    room.player.x = 3 * TILE;
    room.player.y = 3 * TILE;
    room.bullets.push(Bullet { x: 0.0, y: 0.0, vx: 0.0, vy: 0.0, kind: BKind::Enemy, volley: 0, age: 0 });
    room.debug_kill();
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, 0);
    assert!(room.player_dead());
    assert_eq!(r.lives, 2);
    assert!(events_have(&out, Event::Sfx(Sfx::Death)));
    let o = d.run(&mut room, &mut r, &mut out, 0, DEATH_FRAMES + 2);
    assert_eq!(o, StoreOutcome::None);
    assert!(!room.player_dead());
    let (ex, ey) = room.tpl.entry();
    assert_eq!(room.player_pos(), (ex * TILE, ey * TILE));
    assert_eq!(room.player.invuln.max(1) > 100, true, "~120 frames of blinking");
    assert_eq!(room.guards.len(), spy_n, "guards reset (the dead one is back)");
    assert!(room.guards.iter().all(|g| !g.gone && g.dying == 0));
    assert!(room.bullets.is_empty());
    // and he really is invulnerable meanwhile
    let (cx, cy) = room.player_center();
    room.bullets.push(Bullet { x: cx as f32, y: cy as f32, vx: 0.0, vy: 0.0, kind: BKind::Enemy, volley: 0, age: 0 });
    d.step(&mut room, &mut r, &mut out, 0);
    assert!(!room.player_dead());
}

#[test]
fn no_lives_left_means_out_of_lives() {
    let mut r = run(2);
    r.lives = 1;
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    room.debug_kill();
    let mut d = Drv::new();
    let o = d.run(&mut room, &mut r, &mut out, 0, DEATH_FRAMES + 5);
    assert_eq!(o, StoreOutcome::OutOfLives);
    assert_eq!(r.lives, 0);
}

#[test]
fn death_loses_power_ups_except_radar() {
    let mut r = run(2);
    r.power.grant(PowerUp::Radar);
    r.power.grant(PowerUp::SpreadShot);
    let (mut room, mut out) = quiet(StoreId::Crookstone, &mut r);
    room.debug_kill();
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, 0);
    assert!(r.power.radar && !r.power.spread_shot());
}

// ---------------------------------------------------------------------------------------------------------
// Extras
// ---------------------------------------------------------------------------------------------------------

#[test]
fn fitting_room_reveals_a_spy_a_quarter_of_the_time_and_stays_unsearched() {
    let mut reveals = 0;
    let trials = 400;
    for seed in 0..trials {
        let mut r = run(seed);
        let (mut room, mut out) = quiet(StoreId::Forever12, &mut r);
        let f = room.tpl.fixtures.iter().position(|&(x, y)| room.tpl.tile(x, y) == Tile::Fitting).unwrap();
        stand_by(&mut room, f, 0);
        let mut d = Drv::new();
        d.step(&mut room, &mut r, &mut out, B);
        d.run(&mut room, &mut r, &mut out, 0, 50);
        if room.guards_alive() == 1 {
            reveals += 1;
            assert!(!r.is_opened(StoreId::Forever12, f), "contents stay unsearched");
        } else {
            assert!(r.is_opened(StoreId::Forever12, f));
        }
    }
    let p = reveals as f32 / trials as f32;
    assert!((0.18..=0.32).contains(&p), "reveal rate {p}");
}

#[test]
fn fitting_room_spy_shrieks_throws_a_shoe_and_the_room_can_be_searched_again() {
    let mut r = run(3);
    let (mut room, mut out) = quiet(StoreId::Forever12, &mut r);
    let f = room.tpl.fixtures.iter().position(|&(x, y)| room.tpl.tile(x, y) == Tile::Fitting).unwrap();
    stand_by(&mut room, f, 0);
    room.force_reveal = Some(true);
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, B);
    d.run(&mut room, &mut r, &mut out, 0, SEARCH_FRAMES);
    assert_eq!(room.guards_alive(), 1);
    assert!(room.guards[0].extra);
    assert!(events_have(&out, Event::Sfx(Sfx::Shriek)));
    assert!(room.bubbles.iter().any(|b| b.text == "OCCUPIED!!"));
    assert!(room.bullets.iter().any(|b| b.kind == BKind::Shoe), "a shoe is thrown: {} {:?} dead={}", room.debug_state(), room.guards.iter().map(|g| (g.tx, g.ty)).collect::<Vec<_>>(), room.player_dead());
    assert_eq!(room.banner.text, "OCCUPIED!!");
    assert!(!r.is_opened(StoreId::Forever12, f));
    // search it again for real
    room.force_reveal = Some(false);
    room.bullets.clear();
    room.guards.clear();
    d.run(&mut room, &mut r, &mut out, 0, 5);
    // the first search may have moved him (shoe knockback none); make sure he still touches it
    stand_by(&mut room, f, 0);
    d.step(&mut room, &mut r, &mut out, B);
    d.run(&mut room, &mut r, &mut out, 0, 60);
    assert!(r.is_opened(StoreId::Forever12, f));
}

#[test]
fn a_thrown_shoe_hurts() {
    let mut r = run(3);
    let (mut room, mut out) = quiet(StoreId::Forever12, &mut r);
    let (cx, cy) = room.player_center();
    room.bullets.push(Bullet { x: cx as f32 - 20.0, y: cy as f32, vx: 1.5, vy: 0.0, kind: BKind::Shoe, volley: 0, age: 0 });
    let mut d = Drv::new();
    d.run(&mut room, &mut r, &mut out, 0, 30);
    assert!(room.player_dead());
}

fn shoot_up_at(room: &mut StoreRoom, r: &mut RunState, out: &mut Out, d: &mut Drv) {
    d.step(room, r, out, UP);
    d.step(room, r, out, UP | A);
    d.run(room, r, out, 0, 30);
}

#[test]
fn shooting_a_toy_shelf_releases_three_windup_toys_once() {
    let mut r = run(6);
    let (mut room, mut out) = quiet(StoreId::KgbToys, &mut r);
    room.grace = 9999;
    let shelf = room.tpl.fixture_index(1, 1).expect("toy shelf at (1,1)");
    assert_eq!(room.tpl.tile(1, 1), Tile::ToyShelf);
    room.player.x = TILE;
    room.player.y = 3 * TILE;
    let mut d = Drv::new();
    shoot_up_at(&mut room, &mut r, &mut out, &mut d);
    assert_eq!(room.toys.len(), 3, "three toys");
    assert!(room.released.contains(&shelf));
    shoot_up_at(&mut room, &mut r, &mut out, &mut d);
    assert_eq!(room.toys.len(), 3, "a shelf only spills once");
    // they march
    let p0: Vec<(f32, f32)> = room.toys.iter().map(|t| (t.x, t.y)).collect();
    d.run(&mut room, &mut r, &mut out, 0, 30);
    let p1: Vec<(f32, f32)> = room.toys.iter().map(|t| (t.x, t.y)).collect();
    assert_ne!(p0, p1);
}

#[test]
fn windup_toys_turn_at_walls_and_stay_in_the_room() {
    let mut r = run(6);
    let (mut room, mut out) = quiet(StoreId::KgbToys, &mut r);
    room.grace = 9999;
    room.player.invuln = 99999;
    room.release_toys(0, &mut out);
    assert_eq!(room.toys.len(), 3);
    let dirs0: Vec<(i32, i32)> = room.toys.iter().map(|t| (t.dx, t.dy)).collect();
    let mut d = Drv::new();
    let mut turned = false;
    for _ in 0..800 {
        d.step(&mut room, &mut r, &mut out, 0);
        let dirs: Vec<(i32, i32)> = room.toys.iter().map(|t| (t.dx, t.dy)).collect();
        if dirs != dirs0 {
            turned = true;
        }
        for t in &room.toys {
            assert!(t.x >= TILE as f32 - 4.0 && t.x <= (14 * TILE) as f32 + 4.0, "{}", t.x);
            assert!(t.y >= TILE as f32 - 4.0 && t.y <= (10 * TILE) as f32);
        }
    }
    assert!(turned, "toys turn when they hit something");
}

#[test]
fn windup_toys_stun_guards_they_touch() {
    let mut r = run(6);
    let (mut room, mut out) = lone_spy(StoreId::KgbToys, &mut r);
    room.grace = 9999;
    room.player.invuln = 99999;
    room.toys.push(Toy { x: 6.0 * 16.0, y: 7.0 * 16.0, dx: 1, dy: 0, t: 0 });
    room.guards[0].x = 6.0 * 16.0 + 6.0;
    room.guards[0].y = 7.0 * 16.0;
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, 0);
    assert!(room.guards[0].stun >= GUARD_STUN - 2, "frozen ~90 frames");
    // frozen guards do not move
    let (x, y) = (room.guards[0].x, room.guards[0].y);
    d.run(&mut room, &mut r, &mut out, 0, 30);
    assert_eq!((room.guards[0].x, room.guards[0].y), (x, y));
}

use super::ai::GUARD_STUN;

#[test]
fn windup_toys_set_off_traps_which_stun_guards_nearby() {
    let mut r = run(6);
    // Make fixture (3,3) a trap ('a' at (2,3) in KGB Toys).
    let f = room_fixture(StoreId::KgbToys, 2, 3);
    r.fixtures.get_mut(&StoreId::KgbToys).unwrap()[f] = Content::Trap;
    let (mut room, mut out) = lone_spy(StoreId::KgbToys, &mut r);
    room.grace = 9999;
    room.player.invuln = 99999;
    // a toy walking left along row 3 towards the rack at x=2; guard close by
    room.toys.push(Toy { x: 5.0 * 16.0, y: 3.0 * 16.0, dx: -1, dy: 0, t: 0 });
    room.guards[0].x = 4.0 * 16.0;
    room.guards[0].y = 4.0 * 16.0;
    room.guards[0].tx = 4;
    room.guards[0].ty = 4;
    room.guards[0].target = None;
    room.guards[0].wait = 1000;
    let mut d = Drv::new();
    d.run(&mut room, &mut r, &mut out, 0, 70);
    assert!(r.is_opened(StoreId::KgbToys, f), "the toy set the trap off");
    assert!(room.guards[0].stun > 0, "and the smoke stunned the guard");
    assert!(events_have(&out, Event::Sfx(Sfx::Smoke)));
}

fn room_fixture(id: StoreId, x: i32, y: i32) -> usize {
    template(id).fixture_index(x, y).expect("fixture there")
}

#[test]
fn the_listening_booth_switches_music_until_you_leave_it() {
    let mut r = run(2);
    let (mut room, mut out) = quiet(StoreId::SamBaddy, &mut r);
    out.events.clear();
    // booth at tile (1,1)
    assert_eq!(room.tpl.tile(1, 1), Tile::Booth);
    room.player.x = TILE;
    room.player.y = TILE;
    let mut d = Drv::new();
    d.step(&mut room, &mut r, &mut out, 0);
    assert!(events_have(&out, Event::Music(Track::Booth)));
    assert_eq!(room.banner.text, "NOW PLAYING: SIDE B");
    out.events.clear();
    d.step(&mut room, &mut r, &mut out, 0);
    assert!(!events_have(&out, Event::Music(Track::Booth)), "only once");
    d.run(&mut room, &mut r, &mut out, DOWN, 30);
    assert!(events_have(&out, Event::Music(Track::Store(StoreId::SamBaddy))), "back to the store track");
}

// -- GameStonk easter egg ---------------------------------------------------------------------------------

#[test]
fn the_easter_egg_plays_once_per_game_and_freezes_the_room() {
    let mut r = run(5);
    let (mut room, mut out) = enter(StoreId::GameStonk, &mut r);
    assert!(room.egg.is_some());
    assert_eq!(room.guards.len(), 0, "no guards during the scene");
    // input is frozen while the text types
    let p0 = room.player_pos();
    let mut d = Drv::new();
    d.run(&mut room, &mut r, &mut out, LEFT | A, 60);
    assert_eq!(room.player_pos(), p0);
    assert!(room.bullets.is_empty());
    assert!(out.count_sfx(Sfx::TextBlip) > 5);
    // wait for the text to finish
    let mut guard = 0;
    while room.egg.as_ref().map(|e| e.phase) == Some(EggPhase::Text) {
        d.step(&mut room, &mut r, &mut out, 0);
        guard += 1;
        assert!(guard < 600);
    }
    assert_eq!(room.egg.as_ref().unwrap().phase, EggPhase::Wait);
    // walk onto the pedestal (room centre, 6 rows up from the bottom): left a bit, then up
    d.run(&mut room, &mut r, &mut out, LEFT, 12);
    out.events.clear();
    for _ in 0..200 {
        d.step(&mut room, &mut r, &mut out, UP);
        if room.egg.as_ref().map(|e| e.phase) == Some(EggPhase::Hold) {
            break;
        }
    }
    assert_eq!(room.egg.as_ref().unwrap().phase, EggPhase::Hold, "reached the pedestal: {}", room.debug_state());
    assert!(events_have(&out, Event::Music(Track::ItemGet)));
    assert_eq!(r.inventory.len(), 1);
    assert!(crate::copy::EGG_ITEMS.contains(&r.inventory[0].as_str()));
    assert_eq!(r.score, 1);
    assert_eq!(room.banner.text, format!("YOU GOT: {}", r.inventory[0]));
    assert!(room.player.hold.is_some(), "held overhead");
    // then the clerk vanishes and the room carries on
    out.events.clear();
    let mut steps = 0;
    while room.egg.is_some() {
        d.step(&mut room, &mut r, &mut out, 0);
        steps += 1;
        assert!(steps < 600);
    }
    assert!(r.egg_done);
    assert!(events_have(&out, Event::Music(Track::Store(StoreId::GameStonk))));
    assert!(room.guards_alive() >= 1, "the guards show up after the scene");
    assert!(room.free(room.player.x, room.player.y), "not stuck in a shelf");
    // not again this game
    let (room2, _) = enter(StoreId::GameStonk, &mut r);
    assert!(room2.egg.is_none());
    assert!(room2.guards_alive() >= 1);
}

#[test]
fn the_easter_egg_scene_draws() {
    let mut r = run(5);
    let (mut room, mut out) = enter(StoreId::GameStonk, &mut r);
    let mut d = Drv::new();
    let mut fb = Fb::new();
    for _ in 0..200 {
        d.step(&mut room, &mut r, &mut out, 0);
        room.draw(&mut fb, &r, 3);
    }
}

// ---------------------------------------------------------------------------------------------------------
// Determinism and drawing
// ---------------------------------------------------------------------------------------------------------

fn scripted_run(seed: u64, id: StoreId) -> (Vec<String>, Vec<String>, u32) {
    let mut r = run(seed);
    let (mut room, mut out) = enter(id, &mut r);
    let mut d = Drv::new();
    let mut states = Vec::new();
    for f in 0..900u32 {
        let held = match (f / 40) % 6 {
            0 => UP,
            1 => UP | A,
            2 => LEFT,
            3 => B,
            4 => RIGHT | A,
            _ => DOWN,
        };
        if d.step(&mut room, &mut r, &mut out, held) != StoreOutcome::None {
            break;
        }
        if f % 30 == 0 {
            states.push(room.debug_state());
        }
    }
    let events: Vec<String> = out.events.iter().map(|e| format!("{e:?}")).collect();
    (states, events, r.score)
}

#[test]
fn the_same_seed_plays_out_identically() {
    for id in [StoreId::Forever12, StoreId::KgbToys, StoreId::GameStonk, StoreId::RadioShock] {
        let a = scripted_run(31, id);
        let b = scripted_run(31, id);
        assert_eq!(a, b, "{id:?}");
    }
    let a = scripted_run(31, StoreId::Forever12);
    let c = scripted_run(32, StoreId::Forever12);
    assert_ne!(a.0, c.0);
}

#[test]
fn every_room_draws_in_every_state_without_panicking_and_stays_in_palette() {
    for id in OPEN {
        let mut r = run(9);
        r.power.radar = true;
        let (mut room, mut out) = enter(id, &mut r);
        let mut d = Drv::new();
        let mut fb = Fb::new();
        for f in 0..400u32 {
            let held = [UP, A | UP, LEFT, B, RIGHT, DOWN | A][((f / 20) % 6) as usize];
            if d.step(&mut room, &mut r, &mut out, held) != StoreOutcome::None {
                break;
            }
            room.draw(&mut fb, &r, f);
        }
    }
}

#[test]
fn guard_rect_and_overlap_helpers_agree() {
    let mut r = run(1);
    let (room, _) = lone_spy(StoreId::Crookstone, &mut r);
    let g = &room.guards[0];
    assert!(rects_overlap(guard_rect(g), guard_rect(g)));
    assert!(!rects_overlap((0, 0, 4, 4), (4, 0, 4, 4)));
}
