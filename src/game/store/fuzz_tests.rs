//! Port of `store/fuzz.test.ts`: random-input soak, whatever the player mashes the world keeps its invariants.
use crate::content::powerups::PowerId;
use crate::content::stores::{open_stores, StoreId};
use crate::engine::pad::BtnName;
use crate::engine::rng::Rng;

use super::collision::{box_free, HALF};
use super::room::{is_solid_kind, room_px_h, room_px_w, tile_at, TileKind, TILE};
use super::testutil::{make_world, MakeOpts};

#[test]
fn random_play_never_breaks_the_store_rules() {
    let buttons = [BtnName::Up, BtnName::Down, BtnName::Left, BtnName::Right, BtnName::A, BtnName::B];
    let powers = [PowerId::Armor, PowerId::Cinnabomb, PowerId::Rapid, PowerId::Spread, PowerId::Sneakers];
    for def in open_stores() {
        // TS: one `it` per store ("<NAME>: 3 seeds x 2500 frames of mashing")
        for seed in 1..=3u32 {
            let mut m = make_world(def.id, MakeOpts { seed, guards: true, seen: seed != 1, egg: def.id == StoreId::Gamestonk && seed == 1, ..Default::default() });
            let mut input = Rng::new(seed * 31 + 7);
            let mut held: Vec<BtnName> = Vec::new();
            let mut frames = 0;
            let mut i = 0;
            while i < 2500 && !m.world.died && !m.world.exited {
                if i % 9 == 0 {
                    held = Vec::new();
                    for b in buttons {
                        if input.chance(0.28) {
                            held.push(b);
                        }
                    }
                }
                if i % 400 == 399 {
                    let p = *input.pick(&powers);
                    m.run.give_power(p);
                }
                // seeds 2 and 3: immortal and kept away from the door, so the soak runs the full length
                if seed > 1 {
                    m.world.agent.hurt = 99999;
                    if m.world.agent.y > ((m.world.room.rows - 1) * TILE - 4) as f64 {
                        let sp = m.world.room.spawn;
                        m.teleport(sp.col, sp.row);
                    }
                }
                m.step(&held);
                frames += 1;
                i += 1;
                let w = &m.world;
                let a = &w.agent;
                assert!(a.x.is_finite() && a.y.is_finite());
                assert!(a.x > 0.0);
                assert!(a.x < room_px_w(&w.room) as f64);
                assert!(a.y > 0.0);
                assert!(a.y <= room_px_h(&w.room) as f64);
                // the agent never ends up inside a wall / fixture (the doorway row is walkable)
                if !w.exited {
                    assert!(box_free(&|c, r| is_solid_kind(tile_at(&w.room, c, r)), a.x, a.y, HALF - 0.01), "{} frame {} agent in a solid", def.name, w.frame);
                }
                for g in &w.guards {
                    assert!(g.x.is_finite() && g.y.is_finite());
                    if g.change == 0 {
                        assert!(
                            box_free(&|c, r| is_solid_kind(tile_at(&w.room, c, r)) || tile_at(&w.room, c, r) == TileKind::Door, g.x, g.y, HALF - 0.01),
                            "guard in a solid at frame {}",
                            w.frame
                        );
                    }
                }
                for b in &w.bullets {
                    assert!(b.x.is_finite() && b.y.is_finite());
                }
                assert!(w.bullets.len() < 40);
                assert!(w.guards.len() < 12);
                assert!(w.toys.len() < 30);
                for t in &w.toys {
                    assert!(!is_solid_kind(tile_at(&w.room, (t.x / TILE as f64).floor() as i32, (t.y / TILE as f64).floor() as i32)));
                }
                assert!(w.cam_x <= 0.max(room_px_w(&w.room) - 256));
            }
            if seed > 1 {
                assert_eq!(frames, 2500);
            }
        }
    }
}
