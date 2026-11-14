use mall_action::game::*;
fn game() -> Game {
    let mut g = Game::new(42, true);
    g.debug(0, 0, 0);
    g
}
#[test]
fn complete_mission_and_loop_two() {
    let mut g = game();
    for id in [0, 1, 4, 7, 9, 11] {
        g.debug(2, id, 0);
        let i = g.rooms[id as usize]
            .fixtures
            .iter()
            .position(|f| f.content == 1)
            .unwrap();
        let f = g.rooms[id as usize].fixtures[i].clone();
        g.debug(3, f.x + 4, f.y + f.h);
        g.tick(B, B);
        for _ in 0..46 {
            g.tick(0, 0)
        } // fitting rooms can surprise the player; package is selected outside them for this seed
        if !g.packages[id as usize] {
            g.tick(B, B);
            for _ in 0..46 {
                g.tick(0, 0)
            }
        }
        assert!(g.packages[id as usize], "store {id}");
    }
    for _ in 0..60 {
        g.tick(0, 0);
    }
    g.debug(1, 5, 630);
    g.scene = Scene::Mall;
    g.tick(UP, UP);
    assert_eq!(g.scene, Scene::Clear);
    let s = g.score;
    for _ in 0..3 {
        g.tick(START, START)
    }
    assert_eq!(g.loop_n, 2);
    assert_eq!(g.scene, Scene::Arrival);
    assert_eq!(g.score, s);
    assert_eq!(g.count(), 0);
}
#[test]
fn every_fixture_reachable_from_door() {
    use std::collections::VecDeque;
    let g = game();
    for (id, room) in g.rooms.iter().enumerate() {
        if STORES[id].role == 2 {
            continue;
        }
        let mut seen = vec![false; (room.w * room.h) as usize];
        let mut q = VecDeque::from([(122, 148)]);
        while let Some((x, y)) = q.pop_front() {
            let i = (y * room.w + x) as usize;
            if seen[i] {
                continue;
            }
            seen[i] = true;
            for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                let (nx, ny) = (x + dx, y + dy);
                if !room.solid(nx, ny) && !seen[(ny * room.w + nx) as usize] {
                    q.push_back((nx, ny))
                }
            }
        }
        for f in &room.fixtures {
            assert!(
                (10..room.w - 22).any(|x| (26..room.h - 16)
                    .any(|y| seen[(y * room.w + x) as usize]
                        && overlap(x - 3, y - 3, 18, 18, f.x, f.y, f.w, f.h))),
                "unreachable fixture in {id}"
            )
        }
    }
}
#[test]
fn elevator_crush_removes_spy_permanently() {
    let mut g = game();
    g.enemies.push(Enemy {
        x: 162,
        y: 88,
        floor: 1,
        age: 0,
        aim: 0,
        cooldown: 999,
        dir: 1,
        duck: false,
        hp: 1,
        dead: 0,
        bot: false,
        stun: 0,
        high: true,
        volley: 0,
    });
    g.lifts[0].target = Some(1);
    for _ in 0..85 {
        g.tick(0, 0)
    }
    assert!(g.enemies.is_empty());
    assert_eq!(g.score, 300);
}
#[test]
fn alarm_and_loop_scaling_are_capped() {
    let mut g = game();
    g.level_t = 150 * 60 - 1;
    g.tick(0, 0);
    assert!(g.alarm);
    g.loop_n = 30;
    g.setup();
    g.level_t = 40 * 60 - 1;
    g.tick(0, 0);
    assert!(g.alarm);
}
#[test]
fn neutral_cop_penalty_and_timer() {
    let mut g = game();
    g.cop_floor = 1;
    g.p.floor = 1;
    g.p.y = 88;
    g.p.x = 600;
    g.cop_x = 601;
    g.cop_t = 600;
    g.score = 1000;
    g.tick(0, 0);
    assert_eq!(g.score, 500);
    assert_eq!(g.p.stun, 180);
    assert_eq!(g.lives, 3);
}
#[test]
fn deterministic_fitting_room_surprise() {
    let mut hit = false;
    for seed in 1..100 {
        let mut g = Game::new(seed, true);
        g.debug(2, 0, 0);
        g.debug(3, 28, 68);
        g.tick(B, B);
        for _ in 0..46 {
            g.tick(0, 0)
        }
        if !g.rooms[0].fixtures[0].open {
            assert!(g.enemies.len() >= 2);
            hit = true;
            break;
        }
    }
    assert!(hit);
}
#[test]
fn loop_difficulty_changes_spawn_rate() {
    let mut a = game();
    let mut b = game();
    b.loop_n = 8;
    a.spawn = 1;
    b.spawn = 1;
    a.tick(0, 0);
    b.tick(0, 0);
    assert!(b.spawn < a.spawn);
}
#[test]
fn black_friday_doubles_spawn_rate() {
    let mut a = game();
    let mut b = game();
    b.black = true;
    a.spawn = 1;
    b.spawn = 1;
    a.tick(0, 0);
    b.tick(0, 0);
    assert_eq!(a.spawn, b.spawn * 2);
}
