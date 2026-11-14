use mall_action::{collision::*, game::*};
fn mall() -> Game {
    let mut g = Game::new(123, true);
    g.debug(0, 0, 0);
    g.spawn = 99999;
    g
}
fn room() -> Game {
    let mut g = mall();
    g.debug(2, 1, 0);
    g.enemies.clear();
    g.first_t = 99999;
    g.tick(0, 0);
    g
}
fn bullet(x: i32, y: i32, dx: i32, dy: i32, enemy: bool) -> Bullet {
    Bullet {
        x,
        y,
        dx,
        dy,
        enemy,
        ttl: 120,
        volley: 1,
    }
}
#[test]
fn a_bullet_passes_a_fixture_with_a_one_pixel_gap() {
    let mut g = room();
    let f = g.rooms[1].fixtures[0].clone();
    g.bullets.push(bullet(10, f.y - 3, 4, 0, false));
    for _ in 0..20 {
        g.tick(0, 0)
    }
    assert_eq!(g.bullets.len(), 1);
    assert_eq!(g.bullets[0].x, 90);
}
#[test]
fn a_bullet_stops_at_the_first_fixture() {
    let mut g = room();
    let f = g.rooms[1].fixtures[0].clone();
    g.bullets.push(bullet(f.x - 6, f.y + 8, 4, 0, false));
    g.tick(0, 0);
    assert!(g.bullets.is_empty());
}
#[test]
fn walking_into_a_counter_stops_at_the_feet() {
    let mut g = room();
    let f = g.rooms[1].fixtures[0].clone();
    g.debug(3, f.x + 6, f.y + f.h + 8);
    for _ in 0..60 {
        g.tick(UP, 0)
    }
    assert_eq!(g.p.y, f.y + f.h - 10);
    assert!(!room_feet(g.p.x, g.p.y).overlaps(Rect::new(f.x, f.y, f.w, f.h)));
}
#[test]
fn speed_powerup_does_not_tunnel_through_furniture() {
    let mut g = room();
    let f = g.rooms[1].fixtures[0].clone();
    g.debug(3, f.x + 6, f.y + f.h + 8);
    g.p.speed = 1;
    g.p.speed_t = 100;
    for _ in 0..30 {
        g.tick(UP, 0)
    }
    assert_eq!(g.p.y, f.y + f.h - 10);
}
#[test]
fn a_real_corner_gets_one_pixel_of_assistance() {
    let mut g = room();
    let f = g.rooms[1].fixtures[0].clone();
    g.debug(3, f.x - 12, f.y + f.h - 10);
    let old = (g.p.x, g.p.y);
    g.tick(UP, 0);
    assert_eq!((g.p.x, g.p.y), (old.0 - 1, old.1));
    g.tick(UP, 0);
    assert_eq!(g.p.y, old.1 - 1);
}
#[test]
fn solid_lower_walls_only_open_at_the_door() {
    let mut g = room();
    g.debug(3, 90, 144);
    for _ in 0..20 {
        g.tick(DOWN, 0)
    }
    assert_eq!(g.p.y, 144);
    assert_eq!(g.scene, Scene::Store);
    g.debug(3, 122, 144);
    for _ in 0..12 {
        g.tick(DOWN, 0)
    }
    assert_eq!(g.scene, Scene::Mall);
}
#[test]
fn held_down_does_not_bounce_straight_out_of_a_store() {
    let mut g = mall();
    g.debug(1, 1, 47);
    g.tick(DOWN, DOWN);
    assert_eq!(g.scene, Scene::Store);
    for _ in 0..40 {
        g.tick(DOWN, 0)
    }
    assert_eq!(g.scene, Scene::Store);
    g.tick(0, 0);
    g.tick(DOWN, DOWN);
    assert_eq!(g.scene, Scene::Mall);
}
#[test]
fn stepping_off_a_roof_lands_on_the_adjacent_floor() {
    let mut g = mall();
    g.p.x = 162;
    g.lifts[0].y = 88;
    for _ in 0..16 {
        g.tick(0, 0)
    }
    assert_eq!(g.p.roof, Some(0));
    assert_eq!(g.p.y, 88 - CAR_HEIGHT);
    for _ in 0..40 {
        g.tick(LEFT, 0)
    }
    assert_eq!(g.lives, 3);
    assert_eq!(g.p.floor, 1);
    assert_eq!(g.p.y, 88);
    assert!(!g.p.falling);
}
#[test]
fn fatal_falls_do_not_leave_invulnerable_players_falling_through_the_world() {
    let mut g = mall();
    g.p.x = 162;
    g.lifts[0].y = 184;
    g.p.armor = true;
    g.p.inv = 120;
    for _ in 0..30 {
        g.tick(0, 0)
    }
    assert_eq!(g.lives, 2);
    assert_eq!(g.p.y, 40);
    assert!(!g.p.falling);
}
#[test]
fn a_departing_car_floor_catches_an_unboarded_passenger() {
    let mut g = mall();
    g.p.x = 717;
    g.lifts[2].wait = 1;
    g.tick(0, 0);
    assert_eq!(g.p.lift, Some(2));
    for _ in 0..60 {
        g.tick(0, 0)
    }
    assert_eq!(g.p.y, g.lifts[2].y);
    assert_eq!(g.lives, 3);
}
#[test]
fn stopped_car_exit_moves_at_walking_speed() {
    let mut g = mall();
    g.p.lift = Some(0);
    g.p.x = 162;
    for _ in 0..25 {
        let old = g.p.x;
        g.tick(LEFT, 0);
        assert_eq!(old - g.p.x, 1);
    }
    assert!(g.p.lift.is_none());
}
#[test]
fn death_clears_all_projectiles_including_the_in_flight_batch() {
    let mut g = mall();
    g.debug(1, 1, 300);
    g.p.inv = 0;
    g.bullets.push(bullet(301, 73, 2, 0, true));
    g.bullets.push(bullet(500, 73, 4, 0, false));
    g.tick(0, 0);
    assert_eq!(g.lives, 2);
    assert!(g.bullets.is_empty());
}
#[test]
fn mall_walkers_block_enemy_fire_without_penalising_the_player() {
    let mut g = mall();
    g.debug(1, 3, 310);
    g.score = 1000;
    g.bullets.push(bullet(270, 169, 2, 0, true));
    g.tick(0, 0);
    assert!(g.bullets.is_empty());
    assert_eq!(g.score, 1000);
    assert_eq!(g.lives, 3);
}
#[test]
fn a_stunned_player_still_falls_and_lands() {
    let mut g = mall();
    g.p.x = 162;
    g.p.stun = 100;
    g.lifts[0].y = 88;
    for _ in 0..15 {
        g.tick(0, 0)
    }
    assert_eq!(g.p.roof, Some(0));
    assert_eq!(g.p.y, 60);
}
